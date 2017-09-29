angular.module('sampleApp')
    .directive('questionnaire', function () {
        return {
            restrict: 'EA', //E = element, A = attribute, C = class, M = comment
            scope: {
                //@ reads the attribute value, = provides two-way binding, & works with functions
                model: '='
            },

            templateUrl: 'directive/questionnaire/questionnaire.html',
            controller: function($scope,$uibModal,builderSvc,ResourceUtilsSvc,Utilities,GetDataFromServer){

                $scope.answers = [];    //an array of sections with answers. (We'll think about the QR later...)

                $scope.currentSection;  //the

                $scope.input = {};

                $scope.selectDt = function(item,dt) {
                    console.log(item,dt)
                    var vsDetails;
                    var expandedValueSet;

                    //get the binding details
                    var binding = item.myMeta.ed.binding;
                    if (binding) {

                        var urlToValueSet = "";
                        if (binding.valueSetUri) {
                            urlToValueSet = binding.valueSetUri;
                        }
                        if (binding.valueSetReference) {
                            urlToValueSet = binding.valueSetReference.reference;
                        }

                        if (urlToValueSet) {
                            Utilities.getValueSetIdFromRegistry(urlToValueSet,function(vsDetails1) {
                                vsDetails = vsDetails1;  //vsDetails = {id: type: resource: }
                                console.log(vsDetails)
                                if (vsDetails) {
                                    if (vsDetails.type == 'list' || dt == 'code') {
                                        //this has been recognized as a VS that has only a small number of options...
                                        GetDataFromServer.getExpandedValueSet(vsDetails.id).then(
                                            function (vs) {
                                                expandedValueSet = vs;
                                                console.log(expandedValueSet)
                                                getDtValue(item,dt,vsDetails,expandedValueSet)
                                            }, function (err) {
                                                alert(err + ' expanding ValueSet')
                                            }
                                        )
                                    } else {
                                        getDtValue(item,dt,vsDetails)
                                    }
                                }

                            })
                        }

                    } else {
                        getDtValue(item,dt)
                    }





                    function getDtValue(item,dt,vsDetails,expandedValueSet) {
                        $uibModal.open({
                            templateUrl: 'modalTemplates/addPropertyInBuilder.html',
                            size: 'lg',
                            controller: 'addPropertyInBuilderCtrl',
                            resolve : {
                                dataType: function () {
                                    return dt;
                                },
                                hashPath: function () {
                                    return {path:"Condition",noSave:true}; //<<<<< will just return the value...
                                },
                                insertPoint: function () {          //the point where the insert is to occur ...
                                    return {}
                                    //return $scope.currentResource;
                                },
                                vsDetails: function () {
                                    return vsDetails;
                                },
                                expandedValueSet: function () {
                                    console.log(expandedValueSet)
                                    return expandedValueSet;
                                },
                                currentValue : function(){
                                    return {};
                                },
                                container : function() {
                                    return {};
                                }, resource : function(){
                                    return {};
                                }
                            }
                        }).result.then(function (value) {
                            console.log(value)
                            var out = {};
                            //construct a value[x] corrrect for the datatype...
                            builderSvc.addPropertyValue (out,{path:'Value'},dt,value)
                            //console.log(out)

                            var text = ResourceUtilsSvc.getTextSummaryOfDataType(dt,out.Value);
                            //console.log(text)
                            item.myMeta.answer.push({display:text})
                        })
                    }




                }

                $scope.addAnswer = function(item,value){
                    console.log(item,value)
                    item.myMeta.answer.push({"valueString":value})
                }

                $scope.selectSection = function(item) {
                    console.log(item)
                    $scope.selectedSection = item;
                }


                $scope.addSection = function() {
                    console.log('add')
                }


            }
        }
    });
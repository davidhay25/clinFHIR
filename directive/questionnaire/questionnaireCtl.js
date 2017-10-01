angular.module('sampleApp')
    .directive('questionnaire', function () {
        return {
            restrict: 'EA', //E = element, A = attribute, C = class, M = comment
            scope: {
                //@ reads the attribute value, = provides two-way binding, & works with functions
                model: '='
            },

            templateUrl: 'directive/questionnaire/questionnaire.html',
            controller: function($scope,$uibModal,builderSvc,ResourceUtilsSvc,Utilities,GetDataFromServer,questionnaireSvc){

                //$scope.answers = [];    //an array of sections with answers. (We'll think about the QR later...)

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
                                    return {path:"Model",noSave:true}; //<<<<< will just return the value...
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
                                currentStringValue : function(){
                                    if (item.myMeta.answer.length > 0) {
                                        var ans = item.myMeta.answer[0]
                                        if (ans.dt == 'string') {
                                            return ans.display;
                                        }
                                    } else {
                                        return "";
                                    }

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

                            var vo = ResourceUtilsSvc.getTextSummaryOfDataType(dt,out.Value);

                            var ans = {display:vo.summary,dt:dt,value:out.Value,detail:vo.detail};
                            if (item.repeats) {
                                item.myMeta.answer.push(ans)
                            } else {
                                item.myMeta.answer = [ans]
                            }
                            makeDisplay();
                            makeDisplayJson();
                        })
                    }




                }

                $scope.addAnswerDEP = function(item,value){
                    console.log(item,value)
                    item.myMeta.answer.push({"valueString":value})
                }

                $scope.selectSection = function(item) {
                    console.log(item)
                    $scope.selectedSection = item;
                };

                function makeDisplayJson() {
                    $scope.displayModel = angular.copy($scope.model)

                    function removeED(model) {

                        if (model.item) {
                            model.item.forEach(function (item) {

                                if (item && item.myMeta) {
                                    //  var ed = item.myMeta.ed;
                                    // if (ed && ed.type && ed.type[0].code == 'BackboneElement') {
                                    //   removeED(item)
                                    // }
                                    delete item.myMeta.ed
                                }
                                removeED(item)

                            })
                        }

                    }

                    removeED($scope.displayModel)
                }
                $scope.makeDisplayJson = function() {
                    makeDisplayJson();
                }

                //add another copy of this section
                $scope.addSection = function() {
                    //right now, the section will always be off the root. May need to re-visit this for more complex Resources...
                    var newSection = angular.copy($scope.selectedSection);

                    function removeAnswers(node){
                        node.item.forEach(function (item) {
                            if (item.myMeta &&item.myMeta.answer) {
                                item.myMeta.answer.length = 0;
                            }
                            if (item.item) {
                                removeAnswers(item)
                            }
                        })
                    }

                    removeAnswers(newSection)
                    $scope.model.item.push(newSection);
                    $scope.selectedSection = newSection;

                };

                //create a display object
                //for now, assume 2 dimensions - section (off the 'root', and items in that section. Note that a single item can have multiple answers...
                function makeDisplay() {
                    $scope.display = [];
                    $scope.QR = questionnaireSvc.makeQR($scope.model)
                    $scope.model.item.forEach(function (item) {

                        var section = {sectionItem:angular.copy(item) ,item:[]};
                        delete section.sectionItem.item;        //we don;t want the children here...
                        if (section.sectionItem.myMeta){
                            delete section.sectionItem.myMeta.ed;   //or the ed...
                        }

                        $scope.display.push(section);

                        item.item.forEach(function (child) {
                            if (child.myMeta.answer.length > 0) {
                                //only questions for which there has been an answer...
                                var clone = angular.copy(child)
                                delete clone.myMeta.ed;

                                section.item.push(clone)
                            }
                        })

                    })
                    console.log($scope.display)
                }
            }
        }
    });
angular.module('sampleApp')
    .directive('questionnaire', function () {
        return {
            restrict: 'EA', //E = element, A = attribute, C = class, M = comment
            scope: {
                //@ reads the attribute value, = provides two-way binding, & works with functions
                model: '=',             //the actual questionnaire...
                sd : '=',               //not curently used
                bundle : '=',           //not currently used
                resourcehash : '='      //a hash (by type) or all resources for this patient...
            },

            templateUrl: 'directive/questionnaire/questionnaireDir.html',
            controller: function($scope,$uibModal,builderSvc,ResourceUtilsSvc,Utilities,GetDataFromServer,
                                 questionnaireSvc,appConfigSvc){


                //will be triggered when the value of 'model' changes - ie when a questionnaire  is selected......
                $scope.$watch(function(scope) {
                        return scope.model
                    },
                    function(newValue,oldValue) {
                        //console.log('watch:',oldValue,newValue)
                        if (newValue) {
                            //console.log($scope.resourcehash)
                            //establish the hash of data that can be pre-populated from the patients data into the model answers...
                            questionnaireSvc.setUpPrePop($scope.resourcehash);
                        }
                    }
                );

                //console.log($scope.sd)

                //if an SD is passed in, then create a model from the SD. Intended especially for profiles...
                /*
                if ($scope.sd) {
                    questionnaireSvc.makeLMFromProfile($scope.sd).then(
                        function (data) {
                           // console.log(data)

                            $scope.model = questionnaireSvc.makeQ(data.treeData);
                           // console.log($scope.Q)

                        },function(err) {
                            alert(angular.toJson(err))
                        }
                    )
                }

                //if a bundle is passed in (which could be a source of references) then create a hash of resources
                var resourceHash = {}
                if ($scope.bundle) {
                    $scope.bundle.entry.forEach(function (entry) {
                        var resource = entry.resource;
                        var type = resource.resourceType;
                        resourceHash[type] = resourceHash[type] || []
                        resourceHash[type].push(resource)

                        console.log('bundle passed:',resourceHash)


                    });
                    console.log(resourceHash)
                }


               */


                var qItemDescription = appConfigSvc.config().standardExtensionUrl.qItemDescription; //description of the question
                $scope.getDescription = function(item){
                    var ext = Utilities.getSingleExtensionValue(item,qItemDescription);
                    if (ext) {
                        return ext.valueString;
                    }
                }

                //-------- functions and properties to enable the valueset viewer
                $scope.showVSBrowserDialog = {};
                $scope.showVSBrowser = function(vs) {
                    $scope.showVSBrowserDialog.open(vs);        //the open method defined in the directive...
                };

                //called when a concept is selected from the ValueSet dialog...
                $scope.conceptSelected = function(concept) {
                    console.log(concept)
                    $scope.currentItem.myMeta = $scope.currentItem.myMeta || {}
                    $scope.currentItem.myMeta.answer = $scope.currentItem.myMeta.answer || [];

                    var vo = {answer:concept,display:concept.display + " ("+ concept.system + "|" + concept.code}
                    if ($scope.currentItem.repeats) {
                        $scope.currentItem.myMeta.answer.push(vo);
                    } else {
                        $scope.currentItem.myMeta.answer[0] = vo
                    }

                };


                var showValueSet = function(item) {

                    var uri = item.options.reference;

                    //treat the reference as lookup in the repo...
                    GetDataFromServer.getValueSet(uri).then(
                        function(vs) {
                            $scope.showVSBrowserDialog.open(vs);

                        }, function(err) {
                            alert(err)
                        }
                    ).finally (function(){
                        $scope.showWaiting = false;
                    });
                };


                $scope.selectQItem = function(item){
                    $scope.currentItem = item;

                    //var QType = item.type;      //the Questionnaire type. This is not the same as a resource dataType...

                    //choice items are selected from a ValueSet. todo Really need to allow text to be entered for open choice...
                    if (item.type == 'choice' || item.type == 'open-choice') {

                       // var url = item.options.reference;
                        if (item.options &&  item.options.reference) {
                            showValueSet(item);
                        } else {
                            alert("A 'choice' type should have an associated options property...")
                        }

                        return;
                    }





                    $uibModal.open({
                        templateUrl: 'modalTemplates/qDataInput.html',
                        size: 'lg',
                        controller: function($scope,item){
                            $scope.input = {}
                            $scope.item = item;

                            $scope.add = function () {
                                item.myMeta = item.myMeta || {}
                                item.myMeta.answer = item.myMeta.answer || []
                                switch (item.type) {
                                    case 'string' :
                                        var vo = {answer:$scope.input.string,display:$scope.input.string}
                                        addNewAnswer(item,vo)
                                       // item.myMeta.answer.push(vo)
                                        break;
                                    case 'date' :
                                        var v = moment($scope.input.date).format('YYYY-MM-DD');
                                        var vo = {answer:v,display:v}
                                        addNewAnswer(item,vo)
                                        break;
                                }

                                $scope.$close();
                            }

                            function addNewAnswer(item,vo){
                                if (item.repeats) {
                                    item.myMeta.answer.push(vo)
                                } else {
                                    item.myMeta.answer[0] = vo
                                }

                            }

                        },
                        resolve: {
                            item: function () {
                                return item;
                            }
                        }
                    }).result.then(
                        function(data) {

                        }
                    )

                };

                $scope.deleteAnswer = function(item,inx) {
                    item.myMeta.answer.splice(inx,1)
                };


                $scope.currentSection;  //the currently selected section

                $scope.input = {};

                $scope.selectDtDEP = function(item,dt) {
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


                    function getDtValueDEP(item,dt,vsDetails,expandedValueSet) {
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
                    questionnaireSvc.prePopNode(item,$scope.resourceHash)


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
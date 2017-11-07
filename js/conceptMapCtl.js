
angular.module("sampleApp")
    .controller('conceptMapCtrl',
        function ($scope,$q,$http,appConfigSvc,modalService,GetDataFromServer,$uibModal,SaveDataToServer,Utilities) {


            $scope.appConfigSvc = appConfigSvc;

            $scope.input = {};

            $scope.equivalence = ['equal','equivalent','relatedto','wider','subsumes','narrower','specializes','inexact','unmatched','disjoint'];
            $scope.equivalenceDescription = {};
            $scope.equivalenceDescription.equal = "The definitions of the concepts are exactly the same (i.e. only grammatical differences) and structural implications of meaning are identical or irrelevant (i.e. intentionally identical)."
            $scope.equivalenceDescription.equivalent = "The definitions of the concepts mean the same thing (including when structural implications of meaning are considered) (i.e. extensionally identical).";

            $scope.equivalenceDescription.relatedto = "The concepts are related to each other, and have at least some overlap in meaning, but the exact relationship is not known";
            $scope.equivalenceDescription.wider= "The target mapping is wider in meaning than the source concept.";
            $scope.equivalenceDescription.subsumes= "The target mapping subsumes the meaning of the source concept (e.g. the source is-a target).";
            $scope.equivalenceDescription.narrower= "The target mapping is narrower in meaning than the source concept. The sense in which the mapping is narrower SHALL be described in the comments in this case, and applications should be careful when attempting to use these mappings operationally.";
            $scope.equivalenceDescription.specializes= "The target mapping specializes the meaning of the source concept (e.g. the target is-a source).";
            $scope.equivalenceDescription.inexact = "The target mapping overlaps with the source concept, but both source and target cover additional meaning, or the definitions are imprecise and it is uncertain whether they have the same boundaries to their meaning. The sense in which the mapping is narrower SHALL be described in the comments in this case, and applications should be careful when attempting to use these mappings operationally.";
            $scope.equivalenceDescription.unmatched ="There is no match for this concept in the destination concept system.";
            $scope.equivalenceDescription.disjoint="This is an explicit assertion that there is no mapping between the source and target concept.";


            $scope.input.eq = $scope.equivalence[0];


            $scope.showEquivalenceDescription = function(eq) {
                return $scope.equivalenceDescription[eq]
            }

            $scope.appConfigSvc = appConfigSvc;

            if (appConfigSvc.getCurrentConformanceServer().version < 3) {
                modalService.showModal({}, {bodyText: 'This app needs a Conformance Server of release 3 of greater.'})
            }

            $scope.setCurrentCM = function(cm){
                if ($scope.isDirty) {
                    var modalOptions = {
                        closeButtonText: "No, don't lose changes",
                        actionButtonText: 'Yes, select this map, abandoning changes to the old',
                        headerText: 'Load map',
                        bodyText: 'You have updated this map. Selecting another one will lose those changes.'
                    };

                    modalService.showModal({}, modalOptions).then(
                        function(){
                            selectCM(cm)
                        }
                    )
                } else {
                    selectCM(cm)
                }


                function selectCM(cm){
                    delete $scope.lookupUrl;
                    delete $scope.lookupCode;
                    delete $scope.lookupResponse;
                    delete $scope.arLookupUrl;

                    $scope.currentCM = angular.copy(cm);
                    delete $scope.canEdit;
                    if (Utilities.isAuthoredByClinFhir($scope.currentCM)) {
                        $scope.canEdit = true;
                    }

                    $scope.canEdit = true; //todo <<<<<<<< temp

                }

            };



            $scope.setDirty = function(){
                $scope.isDirty = true;
            };


            $scope.makeLookupUrl = function(code) {
                if ($scope.currentCM.group) {
                    $scope.lookupUrl = appConfigSvc.getCurrentConformanceServer().url + 'ConceptMap/'+ $scope.currentCM.id +'/$translate?';

                    var sourceSystem = $scope.currentCM.group[0].source || $scope.currentCM.sourceUri;
                    var targetSystem = $scope.currentCM.group[0].target || $scope.currentCM.targetUri;

                    $scope.lookupUrl += "system="+sourceSystem;// $scope.currentCM.group[0].source;
                    $scope.lookupUrl += "&targetSystem="+targetSystem;//$scope.currentCM.group[0].target;
                    $scope.lookupUrl += "&code="+code


                    //for a nice display - could split on '?' and '&' I guess...
                    $scope.arLookupUrl = [];
                    $scope.arLookupUrl.push(appConfigSvc.getCurrentConformanceServer().url + 'ConceptMap/'+ $scope.currentCM.id +'/$translate')
                    $scope.arLookupUrl.push("?system="+sourceSystem);
                    $scope.arLookupUrl.push("&targetSystem="+targetSystem);
                    $scope.arLookupUrl.push("&code="+code);
                    console.log($scope.lookupUrl)
                } else {
                    alert("Cannot call $translate without a group property")
                }

            };

            $scope.lookup = function() {
                if ($scope.lookupUrl) {
                    $scope.waiting = true;
                    GetDataFromServer.adHocFHIRQuery($scope.lookupUrl).then(
                        function(data) {
                            $scope.lookupResponse = data.data;
                        },
                        function(err) {
                            $scope.lookupResponse = err
                        }
                    ).finally(function(){
                        $scope.waiting = false;
                    })

                }

            }

            $scope.removeItem = function(vo){
                //assume a single group, and that each 'source' code is only represented once in the mapping, with only a single target
                console.log(vo)
                var grp = $scope.currentCM.group[0]
                var inxToDelete = -1;
                grp.element.forEach(function(element,inx){
                    if (element.code == vo.source) {
                        inxToDelete = inx;
                    }
                });

                if (inxToDelete > -1) {
                    //note assumptions above...
                    grp.element.splice(inxToDelete,1)
                    $scope.isDirty = true;
                }
            };

            $scope.saveCM = function () {
               // console.log($scope.currentCM)
                SaveDataToServer.saveResource($scope.currentCM,appConfigSvc.getCurrentConformanceServer().url)
                    .then(function(){
                        if (!$scope.currentCM.id) {
                            delete $scope.currentCM
                            modalService.showModal({}, {bodyText: "The resource has been saved, but you need to re-select it from the side bar. I'll fix that soon..."})
                            loadAllCM();
                            $scope.isDirty = false;
                        } else {
                            modalService.showModal({}, {bodyText: 'The resource has been updated.'})
                            delete $scope.isDirty;
                            loadAllCM();
                        }


                    }
                )
            };

            $scope.editHeader = function() {
                $scope.addConceptMap($scope.currentCM);     //will actually edit..
            };

            $scope.addConceptMap = function (map) {
                $uibModal.open({
                    backdrop: 'static',      //means can't close by clicking on the backdrop.
                    keyboard: false,       //same as above.
                    templateUrl: 'modalTemplates/addConceptMap.html',
                    size: 'lg',
                    controller: function ($scope,Utilities,currentMap) {
                        $scope.input = {};

                        if (currentMap) {
                            $scope.currentMap = currentMap;
                            $scope.canAdd = true;

                            $scope.input.name = currentMap.name;
                            $scope.input.description = currentMap.description;
                            $scope.input.purpose = currentMap.purpose;

                            $scope.input.sourceUri = currentMap.sourceUri;
                            $scope.input.targetUri = currentMap.targetUri;

                            $scope.input.sourceCS = currentMap.group[0].source;
                            $scope.input.targetCS = currentMap.group[0].target;

                        }

                        $scope.checkCanAdd = function(){
                            $scope.canAdd = true;
                        };

                        $scope.findVS = function(typ){
                            console.log(typ)
                            $uibModal.open({
                                backdrop: 'static',      //means can't close by clicking on the backdrop.
                                keyboard: false,       //same as above.
                                templateUrl: 'modalTemplates/vsFinder.html',
                                size: 'lg',
                                controller: 'vsFinderCtrl',
                                resolve  : {
                                    currentBinding: function () {          //the default config
                                        return {};
                                    }
                                },

                            }).result.then(
                                function (vo) {
                                    //vo is {vs,strength}
                                    console.log(vo)
                                   if (type='source') {
                                       $scope.input.sourceUri = vo.vs.url
                                   } else {
                                       $scope.input.targetUri = vo.vs.url
                                   }
                                }
                            )
                        }

                        $scope.add = function () {

                            var vo =  {resourceType:'ConceptMap',status:'draft'}
                            if (currentMap) {
                                vo = currentMap;
                            }

                            Utilities.setAuthoredByClinFhir(vo)
                            vo.name = $scope.input.name;
                            vo.description = $scope.input.description;
                            vo.purpose = $scope.input.purpose;

                            vo.sourceUri = $scope.input.sourceUri;
                            vo.targetUri = $scope.input.targetUri;

                            if (currentMap) {
                                vo.group[0].source = $scope.input.sourceCS;
                                vo.group[0].target = $scope.input.targetCS;

                            } else {
                                var group = {element:[]}
                                group.source = $scope.input.sourceCS;
                                group.target = $scope.input.targetCS;
                                vo.group=[group];          //the single group
                            }

                            $scope.$close(vo)
                        }
                    },
                    resolve : {
                        currentMap : function(){
                            return map
                        }}}
                ).result.then(
                    function(vo) {

                        $scope.currentCM = vo;
                        $scope.isDirty = true;
                        loadAllCM();
                    }
                )
            };

            $scope.addItem = function (item) {
                $uibModal.open({
                    backdrop: 'static',      //means can't close by clicking on the backdrop.
                    keyboard: false,       //same as above.
                    templateUrl: 'modalTemplates/addConceptMapItem.html',
                    controller: function($scope,currentItem,sourceSystem,targetSystem,GetDataFromServer,Utilities,equivalence){
                        $scope.equivalence = equivalence;


                        function getVS(url,type) {
                            if (url) {
                                var key = type+"VS"
                                Utilities.getValueSetIdFromRegistry(url,function(vs){
                                    if (vs) {
                                        $scope[key] = vs;
                                    } else {
                                        modalService.showModal({}, {bodyText: 'The ValueSet:'+url + ' was not found on the terminology server, so autocomplete is disabled'})
                                    }
                                })
                            }
                        }

                        $scope.input = {};
                        $scope.input.eq = $scope.equivalence[0]
                        if (currentItem) {
                            $scope.currentItem = currentItem;
                            $scope.input.source = currentItem.code;

                            $scope.input.target = currentItem.target[0].code;
                            $scope.input.comment = currentItem.target[0].comment;
                            if (currentItem.target[0].equivalence) {
                                $scope.equivalence.forEach(function(eq){
                                    if (eq == currentItem.target[0].equivalence) {
                                        $scope.input.eq= eq
                                    }
                                })
                            }


                        }



                        //autocomplete from a valueset
                        $scope.vsLookup = function(key,text) {

                            console.log(text)
                            var vs = $scope[key+'VS'];
                            if (vs) {
                                var id = vs.id;
                                $scope.showWaiting = true;

                                //filters don't seem to be working...
                                return GetDataFromServer.getExpandedValueSet(id).then(

                                //return GetDataFromServer.getFilteredValueSet(id,text).then(
                                    function(data,statusCode){
                                        if (data.expansion && data.expansion.contains) {
                                            var lst = data.expansion.contains;
                                            return lst;
                                        } else {
                                            return [
                                                {'display': 'No expansion'}
                                            ];
                                        }
                                    }, function(vo){
                                        var msg = vo.error;


                                        alert(msg);

                                        return [
                                            {'display': ""}
                                        ];
                                    }
                                ).finally(function(){
                                    $scope.showWaiting = false;
                                });

                            } else {
                                return [{'display':'Select the ValueSet to query against'}];
                            }
                        }

                        $scope.selectCCfromList = function(item,key){
                            console.log(item,key)
                            $scope.input[key] = item.code;
                            var d = key+'Display'
                            $scope.input[d] = item.display;
                           // $scope.input.source = item.code;
                           // $scope.input.sourceDisplay = item.display;
                        }

                        $scope.add = function(){

                            if (currentItem) {
                                currentItem.code = $scope.input.source;
                                currentItem.target[0].code = $scope.input.target;
                                currentItem.target[0].comment = $scope.input.comment;
                                currentItem.target[0].equivalence = $scope.input.eq;
                                $scope.$close()
                            } else {
                                var vo = {source:$scope.input.source}
                                vo.target = $scope.input.target;
                                vo.comment = $scope.input.comment;
                                vo.equivalence = $scope.input.eq;
                                $scope.$close(vo)
                            }


                        }

                    },
                    resolve : {
                        currentItem : function(){
                            return item
                        },
                        sourceSystem: function () {          //the default config
                            var sourceSystem = $scope.currentCM.group[0].source || $scope.currentCM.sourceUri;
                            return sourceSystem;
                        },
                        targetSystem : function(){
                            var targetSystem = $scope.currentCM.group[0].target || $scope.currentCM.targetUri;
                            return targetSystem
                        },
                        equivalence : function(){

                            return $scope.equivalence
                        }
                    }
                }).result.then(
                    function(vo) {
                        if (vo) {
                            //console.log(vo)
                            //for now, assume only a single group - and that it exists...
                            var grp = $scope.currentCM.group[0]
                            var element = {code:vo.source,target:[]}
                            element.target.push({code:vo.target,equivalence:vo.equivalence,comment:vo.comment});
                            grp.element.push(element)
                            //console.log(grp)
                        }

                        $scope.isDirty = true;

                    }
                )
            }

            $scope.addItemDirect = function(){
                //for now, assume only a single group - and that it exists...
                var grp = $scope.currentCM.group[0]
                var element = {code:$scope.input.sourceCode,target:[]}
                element.target.push({code:$scope.input.targetCode,equivalence:$scope.input.eq,comment:$scope.input.comment});
                grp.element = grp.element || []
                grp.element.push(element)

                delete $scope.input.targetCode;
                delete $scope.input.comment;
                delete $scope.input.sourceCode;
                $scope.input.eq = $scope.equivalence[0];
                $scope.isDirty = true;


            }

            //todo - add clinfhir only

            var loadAllCM = function(){
                var url = appConfigSvc.getCurrentConformanceServer().url + "ConceptMap";
                $scope.waiting = true;
                GetDataFromServer.adHocFHIRQueryFollowingPaging(url).then(
                    function(data) {
                        $scope.bundleCM = data.data;
                        console.log($scope.bundleCM)
                    },
                    function(err) {
                        alert(angular.toJson(err))
                    }
                ).finally(function(){
                    $scope.waiting = false;
                })
            }
            loadAllCM();

        })

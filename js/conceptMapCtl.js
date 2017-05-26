
angular.module("sampleApp")
    .controller('conceptMapCtrl',
        function ($scope,$q,$http,appConfigSvc,modalService,GetDataFromServer,$uibModal,SaveDataToServer,Utilities) {



            $scope.equivalenceDescription = {};
            $scope.equivalenceDescription.equal = "The definitions of the concepts are exactly the same (i.e. only grammatical differences) and structural implications of meaning are identical or irrelevant (i.e. intentionally identical)."
            $scope.equivalenceDescription.equivalent = "The definitions of the concepts mean the same thing (including when structural implications of meaning are considered) (i.e. extensionally identical).";

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

            $scope.editCMDEP = function(key,value) {
                switch (key) {
                    case 'name' :
                        $scope.currentCM.name = value;
                        break;
                    case 'desc' :
                        $scope.currentCM.description = value
                        break;
                    case 'srcCS' :
                        $scope.currentCM.group[0].source = value
                        break;
                    case 'targCS' :
                        $scope.currentCM.group[0].target = value
                        break;
                }
            }

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
                console.log($scope.currentCM)
                SaveDataToServer.saveResource($scope.currentCM,appConfigSvc.getCurrentConformanceServer().url)
                    .then(function(){
                        modalService.showModal({}, {bodyText: 'The resource has been updated.'})
                        delete $scope.isDirty;
                        loadAllCM();
                    }
                )
            };




            $scope.addConceptMap = function () {
                $uibModal.open({
                    backdrop: 'static',      //means can't close by clicking on the backdrop.
                    keyboard: false,       //same as above.
                    templateUrl: 'modalTemplates/addConceptMap.html',
                    size: 'lg',
                    controller: function ($scope,Utilities) {
                        $scope.input = {};

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
                            Utilities.setAuthoredByClinFhir(vo)
                            vo.name = $scope.input.name;
                            vo.description = $scope.input.description;
                            vo.purpose = $scope.input.purpose;

                            vo.sourceUri = $scope.input.sourceUri;
                            vo.targetUri = $scope.input.targetUri;
                            var group = {element:[]}
                            group.source = $scope.input.sourceCS;
                            group.target = $scope.input.targetCS;

                            vo.group=[group];          //the single group

                            $scope.$close(vo)
                        }

                    }
                }).result.then(
                    function(vo) {
                        $scope.currentCM = vo;
                        $scope.isDirty
                        loadAllCM();
                    }
                )
            };


            $scope.addItem = function (item) {
                $uibModal.open({
                    backdrop: 'static',      //means can't close by clicking on the backdrop.
                    keyboard: false,       //same as above.
                    templateUrl: 'modalTemplates/addConceptMapItem.html',
                    controller: function($scope,currentItem,sourceSystem,targetSystem,GetDataFromServer,Utilities){
                      //  sourceSystem="http://hl7.org/fhir/ValueSet/v3-AddressUse";   //todo cheating to get result!

                        //targetSystem="http://hl7.org/fhir/ValueSet/address-type";       //more cheating
                         //   http://hl7.org/fhir/ValueSet/v3-AddressUse


                        $scope.equivalence = ['equal','equivalent','relatedto','wider','subsumes','narrower','specializes'];

/*
                        $scope.sourceSystem = sourceSystem;
                        $scope.targetSystem = targetSystem;

                        getVS($scope.sourceSystem,'source');
                        getVS($scope.targetSystem,'target');

                        */
                        /*
                        if (sourceSystem) {
                            Utilities.getValueSetIdFromRegistry($scope.sourceSystem,function(vs){
                                if (vs) {
                                    $scope.sourceVS = vs;
                                } else {
                                    modalService.showModal({}, {bodyText: 'The ValueSet:'+$scope.sourceSystem + ' was not found on the terminology server, so autocomplete is disabled'})
                                }
                            })
                        }
                        */

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
                            //var targ = currentItem.
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

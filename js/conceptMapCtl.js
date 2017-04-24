
angular.module("sampleApp")
    .controller('conceptMapCtrl',
        function ($scope,$q,$http,appConfigSvc,modalService,GetDataFromServer,$uibModal,SaveDataToServer,Utilities) {


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
                    $scope.currentCM = angular.copy(cm);
                    delete $scope.canEdit;
                    if (Utilities.isAuthoredByClinFhir($scope.currentCM)) {
                        $scope.canEdit = true;
                    }
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
                    controller: function ($scope,Utilities) {
                        $scope.input = {};

                        $scope.checkCanAdd = function(){
                            $scope.canAdd = true;
                        };

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
                    controller: function($scope,currentItem){
                        $scope.input = {};
                        if (currentItem) {
                            $scope.currentItem = currentItem;
                            $scope.input.source = currentItem.code;
                            //var targ = currentItem.
                            $scope.input.target = currentItem.target[0].code;
                            $scope.input.comment = currentItem.target[0].comment;
                        }


                        $scope.add = function(){

                            if (currentItem) {
                                currentItem.code = $scope.input.source;
                                currentItem.target[0].code = $scope.input.target;
                                currentItem.target[0].comment = $scope.input.comment;
                                $scope.$close()
                            } else {
                                var vo = {source:$scope.input.source}
                                vo.target = $scope.input.target;
                                vo.comment = $scope.input.comment;
                                $scope.$close(vo)
                            }


                        }

                    },
                    resolve : {
                        currentItem : function(){
                            return item
                        },
                        sourceSystem: function () {          //the default config
                            return '';
                        },
                        targetSystem : function(){
                            return ''
                        }
                    }
                }).result.then(
                    function(vo) {
                        if (vo) {
                            //console.log(vo)
                            //for now, assume only a single group - and that it exists...
                            var grp = $scope.currentCM.group[0]
                            var element = {code:vo.source,target:[]}
                            element.target.push({code:vo.target,equivalence:'equal',comment:vo.comment});  //assume codes are equal
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
                GetDataFromServer.adHocFHIRQueryFollowingPaging(url).then(
                    function(data) {
                        $scope.bundleCM = data.data;
                        console.log($scope.bundleCM)
                    },
                    function(err) {
                        alert(angular.toJson(err))
                    }
                )
            }
            loadAllCM();

           // Utilities.setAuthoredByClinFhir()
           // Ut






        })

/*has been deprectde - don't call make function - expensive! */

angular.module("sampleApp")
    .controller('profilesCtrl',
        function ($rootScope,$scope,GetDataFromServer,appConfigSvc,Utilities,$uibModal,RenderProfileSvc,SaveDataToServer,modalService,$timeout) {

            $scope.input = {param:'hl7',searchParam:'publisher',searchStatus:'all'};
           // $scope.input = {searchParam:'resource',searchStatus:'all'};

            $scope.$watch('input.searchParam',function(){
               // alert('c')
                delete $scope.profilesArray;
                delete $scope.selectedProfile;
            })


            //called when editing a profile is completed (saved) or cancelled. This requires refactoring...
            $rootScope.$on('profileEditComplete',function(){
                delete $scope.displayMode;
            });


            RenderProfileSvc.getAllStandardResourceTypes().then(
                function(lst) {
                    $scope.allResourceTypes = lst;
                    $scope.input.resourceType = lst[0]
                }
            );

            //called to display the editing and details screen - from the 'eye'...
            $scope.showProfileDetails = function() {



                $scope.displayMode = 'profileEditor'

                var profile = angular.copy($scope.selectedProfile)
                $rootScope.$broadcast('profileSelected',profile);       //allows components to initalise with the profile
                $rootScope.$broadcast('setDisplayMode',{newMode:'profileEditor',currentMode: 'profiles'});  //display the profile editor page


            };

            $scope.treeNodeSelected = function(item){
                console.log(item)
                try {
                    $scope.selectedEd = angular.copy(item.node.data.ed);
                    delete $scope.selectedEd.myMeta
                    $scope.$digest();       //as the event is outside of angular
                } catch (ex){
                    
                }
                
            }

            $rootScope.$on('userLoggedIn',function(){
                var userProfile = $rootScope.userProfile;
               // console.log(userProfile)
                if (userProfile.extDef && userProfile.extDef.defaultPublisher) {
                    $scope.input = {param:userProfile.extDef.defaultPublisher,searchParam:'publisher',searchStatus:'all'};

                }
            });

            $rootScope.$on('userLoggedOut',function() {
                $scope.input = {param:'hl7',searchParam:'publisher',searchStatus:'all'};
            });

            $rootScope.$on('setDisplayMode',function(ev,mode) {
                if (mode.newMode == 'profiles') {
                    delete $scope.profilesArray;
                    delete $scope.selectedProfile;
                }
            });

            $scope.errors = [];
            $scope.appConfigSvc = appConfigSvc;

            //load the new extension page
            $scope.newProfile = function() {
                $uibModal.open({
                    templateUrl: 'modalTemplates/newProfile.html',
                    size: 'lg',
                    controller: "newProfileCtrl"
                }).result.then(
                    function(resource) {
                        //so the resource has been added - call the editing screen with this resource...

                        console.log(resource)

                        $rootScope.$broadcast('profileSelected',resource);       //allows components to initalise with the profile
                        $rootScope.$broadcast('setDisplayMode',{newMode:'profileEditor',currentMode: 'profiles'});  //display the profile editor page

                    })
            };

            $scope.deleteProfile = function(){
                var modalOptions = {
                    closeButtonText: "No, don't Delete",
                    actionButtonText: 'Yes please',
                    headerText: 'Delete ' + $scope.selectedProfile.name,
                    bodyText: 'Are you sure you want to delete this Profile'
                };
                modalService.showModal({}, modalOptions).then(
                    function(){
                        SaveDataToServer.deleteResource(appConfigSvc.getCurrentConformanceServer(),$scope.selectedProfile).then(
                            function(data){
                                //console.log(data);
                                modalService.showModal({}, {bodyText:'Definition is now deleted.'});

                                $scope.profilesArray.splice($scope.index,1);
                                
                                delete $scope.selectedProfile;
                                delete $scope.index;


                            },
                            function(err) {
                                alert('Error updating definition: '+angular.toJson(err))
                            }
                        )
                    }
                )
            };

            $scope.editProfile = function () {
                modalService.showModal({}, {bodyText : "Sorry, editing is not yet enabled"})
            };

            $scope.retireProfile = function(){
                var modalOptions = {
                    closeButtonText: "No, don't Retire",
                    actionButtonText: 'Yes please',
                    headerText: 'Activate ' + $scope.selectedProfile.name,
                    bodyText: 'Are you sure you want to retire this Extension Definition?'
                };
                modalService.showModal({}, modalOptions).then(
                    function(){
                        $scope.selectedProfile.status = 'retire';
                        SaveDataToServer.updateStructureDefinition(appConfigSvc.getCurrentConformanceServer(),$scope.selectedProfile).then(
                            function(data){
                                console.log(data);
                                modalService.showModal({}, {bodyText:'Definition is now retired, and should no longer be used. (It needs to remain in the registry for existing usages of course.)'});
                            },
                            function(err) {
                                alert('Error updating definition: '+angular.toJson(err))
                            }
                        )
                    }
                )
            };

            $scope.activateProfile = function(){
                var modalOptions = {
                    closeButtonText: "No, don't Activate",
                    actionButtonText: 'Yes please',
                    headerText: 'Activate ' + $scope.selectedProfile.name,
                    bodyText: 'Are you sure you want to activate this Extension Definition?'
                };
                modalService.showModal({}, modalOptions).then(
                    function(){
                        $scope.selectedProfile.status = 'active';
                        SaveDataToServer.updateStructureDefinition(appConfigSvc.getCurrentConformanceServer(),$scope.selectedProfile).then(
                            function(data){
                                console.log(data);
                                modalService.showModal({}, {bodyText:'Definition is now active, and can be used by resource instances.'});
                            },
                            function(err) {
                                alert('Error updating definition: '+angular.toJson(err))
                            }
                        )
                    }
                )
            };

            $scope.search = function(param) {
                
                var conformanceServer =  appConfigSvc.getCurrentConformanceServer();
                var query = conformanceServer.url;
                query += "StructureDefinition?kind=resource";
                var fhirVersion = conformanceServer.version;
                
                //because I have to proxy Grahames server. Don't really like this...
                $scope.conformanceServer = conformanceServer.realUrl || conformanceServer.url;  //for the detail display
                var downLoadName = '';
                switch ($scope.input.searchParam) {

                    case 'publisher' :
                        query += "&publisher:contains="+param;
                        downLoadName = 'publisher-'+param;
                        break;
                    case 'description' :
                        query += "&description:contains="+param;
                        downLoadName = 'description-'+param;
                        break;
                    case 'name' :
                        query += "&name:contains="+param;
                        downLoadName = 'name-'+param;
                        break;
                    case 'identifier' :
                        var id = $scope.input.identifierId;
                        var system = $scope.input.identifierSystem;
                        var ident = id;
                        if (!id) {
                            alert("You need to enter an Id")
                            return;
                        }
                        if (system) {
                            ident = system + "|" + id;
                        }

                        query += "&identifier="+ident;
                        downLoadName = 'identifier-'+ident;
                        break;
                    case 'resource' :
                        param = $scope.input.resourceType;
                        var typ = param.name;       //the name of the base type

                        if (fhirVersion == 3) {
                            query += "&base=http://hl7.org/fhir/StructureDefinition/"+typ
                        } else {
                            query += "&type="+typ
                        }


                        downLoadName = 'resource-'+param;

                        break;
                }

                //if the status is not all...
                if ($scope.input.searchStatus !== 'all') {
                    query += "&status="+$scope.input.searchStatus;
                }







                getProfiles(query,downLoadName)
            };

            function getProfiles(query,downLoadName) {
                //$scope.loading=true;
                $rootScope.$broadcast('setWaitingFlag',true);
                delete $scope.profilesArray;
                delete $scope.selectedProfile;
                delete $scope.index;
                console.log(query)
                $scope.query = query;       //for display....



                GetDataFromServer.adHocFHIRQueryFollowingPaging(query).then(
                //GetDataFromServer.adHocFHIRQuery(query).then(
                    function(data) {
                        var bundle = data.data;


                        if (bundle && bundle.entry) {
                            $scope.profilesArray = bundle.entry;

                            $scope.profilesArray.sort(function (a, b) {
                                if (a.resource.name && a.resource.name) {
                                    if (a.resource.name.toUpperCase() > b.resource.name.toUpperCase()) {
                                        return 1
                                    } else {
                                        return -1
                                    }
                                } else {
                                    return 0;
                                }


                            });


                            $scope.downloadLinkJsonContent = window.URL.createObjectURL(new Blob([angular.toJson(bundle, true)], {type: "text/text"}));
                            $scope.downloadLinkJsonName = downLoadName;

                        }


                    },
                    function(err) {

                        alert("Error:"+angular.toJson(err));
                    }
                ).finally(function(){
                    $rootScope.$broadcast('setWaitingFlag',false);
                    //$scope.loading=false;
                })
            }

            //delete $scope.selectedProfile;

            $scope.selectProfile = function(entry,inx){
                $scope.selectedProfile = entry.resource
                $scope.index = inx;

                //$scope.isAuthoredByClinFhir = true;
                $scope.isAuthoredByClinFhir = Utilities.isAuthoredByClinFhir($scope.selectedProfile);


                //console.log($scope.selectedProfile)
            };
        });
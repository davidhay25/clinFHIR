//directile to render a UI for a profile.
angular.module("sampleApp").directive( 'selectProfile', function (Utilities,GetDataFromServer,$uibModal,appConfigSvc  ) {
    return {
        restrict: 'E',
        scope: {
            trigger: '=',
            type: '=',
            profileSelected : '&',
            allResourceTypes:'=',
            recent : '='
        },
        template: '<div></div>',

        link : function ($scope, element, attrs) {

            $scope.internalControl = $scope.trigger || {};

            $scope.internalControl.open = function(vo) {
                console.log(appConfigSvc.getRecentProfile());
                showModal(vo);
            };

            function showModal(vo) {

                $uibModal.open({
                    templateUrl: 'resourceBuilder/selectProfile.html',
                    size:'lg',
                    controller: function($scope,type,profileSelectedFn,allResourceTypes,vo,recent,config,appConfigSvc,modalService) {
                        
                        $scope.config = appConfigSvc.config();
                        $scope.input = {};
                        $scope.heading = "Find Profile or Base Type";

                        if (vo) {
                            if (vo.heading) {
                                $scope.heading = vo.heading;
                            }
                            if (vo.baseResourceType) {
                                $scope.baseResourceType = vo.baseResourceType;
                            }

                        }


                        $scope.config = config;
                        $scope.recent = recent;
                        $scope.allResourceTypes = allResourceTypes;
                        $scope.results = {};
                        $scope.activeTab = "1"; //the search tab
                        $scope.tab = {};

                        $scope.results.type = type;
                        $scope.profileSelectedFn = profileSelectedFn;


                        //load a profile by selecting directly
                        $scope.adhocProfile = function(){
                            var server = $scope.input.adhocServer;
                            var id = $scope.input.adhocId;
                            var url = server.url + 'StructureDefinition/'+id;
                            $scope.showWaiting = true;
                            GetDataFromServer.adHocFHIRQuery(url).then(
                                function(data){
                                    var profile = data.data;
                                    profile.adhocServer = server;
                                    $scope.$close(profile);
                                },
                                function(err){
                                    modalService.showModal({}, {bodyText: 'Sorry, that profile was not found:\n '+url})
                                }
                            ).finally(function(){
                                $scope.showWaiting = false;
                            })

                        };


                        //the display for the list of core resources - adds the (reference) label...
                        $scope.coreResourceDisplay=function(item) {
                            var display = item.name;
                            if (item.reference) {
                                display += " (reference)";
                            }
                            return display;
                        };

                        //searching for a specific profile...
                        $scope.search = function() {
                            $scope.showNone = false;    //turn off message if shown...
                            $scope.showMessage = false;
                            $scope.showWaiting = true;

                            delete $scope.selectedProfile;

                            var searchString = "StructureDefinition?";

                            //for now the search is either extension or not an extension.

                            if ($scope.results.type == 'extension') {
                                searchString += "type=Extension";
                                if ($scope.baseResourceType) {
                                    //alert($scope.baseResourceType);
                                    searchString += "&ext-context:contains="+$scope.baseResourceType+",*,Resource"
                                }
                                $scope.showWaiting = true;
                            } else {
                                //this will be a 'profile'

                                //http://hl7.org/fhir/StructureDefinition/


                                if (! $scope.results.profileType) {
                                    alert("Please select the Base resource type");
                                    $scope.showWaiting = false;
                                    return;
                                } else {

                                    var svr =  appConfigSvc.getCurrentConformanceServer();
                                    if (svr.version == 3) {

                                        searchString += "kind=resource&base-path="+$scope.results.profileType.name;
                                        //searchString += "kind=resource&base=http://hl7.org/fhir/StructureDefinition/"+$scope.results.profileType.name
                                    } else {
                                        searchString += "kind=resource&type="+$scope.results.profileType.name
                                    }

                                    $scope.showWaiting = true;
                                }
                            }

                            ['name','description','publisher'].forEach(function(param){
                                //console.log()
                                if ($scope.results[param]) {
                                    searchString += '&' + param + ":contains=" + $scope.results[param] ;
                                }
                            });

                            searchString += "&_count=100&_sort=_id";
                            
                            $scope.query = searchString;



                            GetDataFromServer.queryConformanceServer(searchString).then(
                                function(data){
                                    var bundle = data.data;
                                    if (bundle.entry && bundle.entry.length > 0) {
                                        $scope.showMessage = true;  //the message that I can't change tabs
                                        $scope.selectedProfiles = bundle;
                                        $scope.results.activeTab = "1";

                                    } else {
                                        $scope.showNone = true;
                                    }

                                    $scope.showWaiting = false;
                                },function(err){
                                    $scope.showWaiting = false;
                                    console.log('Error: ',err);
                                    alert("Unable to retrieve Profile from the server. It may be currently unresponsive." +
                                        "/n The error returned was: " + angular.toJson(err,true))
                                }).finally(function(){
                                $scope.showWaiting = false;
                            });


                        };


                        //when one of the recently selected profiles is chosen..
                        $scope.selectRecent = function(profile) {
                            $scope.$close(profile);
                        };

                        //when a profile has been chosen, and we want to return it...
                        $scope.selectProfile= function(coreProfileName) {

                            if (coreProfileName) {
                                //a core profile was selected. Retrieve the SD and return...
                                $scope.showWaiting = true;
                                var uri = "http://hl7.org/fhir/StructureDefinition/"+coreProfileName;

                                //we get the profile based on the URI (ie SD.url)
                                GetDataFromServer.findConformanceResourceByUri(uri).then(
                                    function(resource){

                                        if (!resource.snapshot) {
                                            alert("This resource does not have a 'snapshot' element, and cannot be used by clinFHIR");
                                            return;
                                        }
                                        console.log(resource)
                                        $scope.$close(resource);
                                        $scope.showWaiting = false;
                                    },
                                    function(err){
                                         alert("There was an error retrieving the profile: "+angular.toJson(err));
                                        $scope.showWaiting = false;
                                        $scope.$dismiss();

                                    }
                                )

                            } else {
                                var actualProfile= angular.copy($scope.selectedProfile);    //set in the dialog...
                                $scope.$close(actualProfile);
                            }






                        };


                        //when we want to display a profile
                        $scope.showProfile = function(entry) {


                            $scope.selectedProfile = entry.resource;     //save the original profile before we hack it...


                        }
                    },
                    resolve : {

                        type : function() {
                            return $scope.type;
                        },
                        profileSelectedFn : function() {
                            return $scope.profileSelected
                        },
                        allResourceTypes : function() {

                          return $scope.allResourceTypes;
                        },
                        vo : function() {
                            return vo;      //passed in when modal invoked...
                        },
                        recent : function() {
                            return appConfigSvc.getRecentProfile();
                        },
                        config : function(){
                            return appConfigSvc.config();
                        }
                    }
                }).result.then(function(selectedProfile){
                        //User clicked save
                        //console.log(selectedProfile)
                        $scope.profileSelected()(selectedProfile)

                    },
                    function(){
                        //alert('Resource not saved. You can continue editing.')
                    });




            };





        },

        controller: function ($scope) {

/*
            $scope.$watch(
                function() {return $scope.trigger},
                function() {
                    console.log($scope.trigger)
                    if ($scope.trigger) {
                        showModal();
                    }
                }
            );

            $scope.$watch('trigger',function() {
                console.log($scope.trigger)
                if ($scope.trigger) {
                   // showModal();
                }

            });

*/


        }
    }
});
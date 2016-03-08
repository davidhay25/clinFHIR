//directile to render a UI for a profile.
angular.module("sampleApp").directive( 'selectProfile', function (Utilities,GetDataFromServer,$modal,appConfigSvc  ) {
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
                console.log(appConfigSvc.getRecent());
                showModal(vo);
            };

            function showModal(vo) {

                $modal.open({
                    templateUrl: 'resourceBuilder/selectProfile.html',
                    size:'lg',
                    controller: function($scope,type,profileSelectedFn,allResourceTypes,vo,recent) {

                        $scope.heading = "Find Profile";

                        if (vo) {
                            if (vo.heading) {
                                $scope.heading = vo.heading;
                            }
                            if (vo.baseResourceType) {
                                $scope.baseResourceType = vo.baseResourceType;
                            }

                        }

                        $scope.recent = recent;
                        $scope.allResourceTypes = allResourceTypes;
                        $scope.results = {};
                        $scope.tab = {};
                        $scope.selectedProfile = {};
                        $scope.results.type = type;
                        $scope.profileSelectedFn = profileSelectedFn;


                        //generate the tree representation of the profile. todo ?move to directive...
                        $scope.createTree = function() {
                            return;
                            $('#treeView').jstree('destroy');
                            console.log($scope.selectedProfile)
                            var tree = Utilities.makeProfileJSTreeArray($scope.selectedProfile);
                            console.log(tree);
                            $('#selectProfileTreeView').jstree({ 'core' : {
                                'data' : tree
                            } }).on('changed.jstree', function (e, data){
                                var path = data.node.text;
                                $scope.$digest();       //as the event occurred outside of angular

                            });

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


                            delete $scope.selectedProfileJson;

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
                                if (! $scope.results.profileType) {
                                    alert("Please select the Base resource type");
                                    return;
                                } else {
                                    searchString += "type="+$scope.results.profileType.name
                                    $scope.showWaiting = true;
                                }
                            }

                            ['name','description','publisher'].forEach(function(param){
                                //console.log()
                                if ($scope.results[param]) {
                                    searchString += '&' + param + ":contains=" + $scope.results[param] ;
                                }
                            });



                            searchString += "&_count=100";


                            console.log(searchString);
                            $scope.query=searchString;



                            GetDataFromServer.queryConformanceServer(searchString).then(
                            //GetDataFromServer.queryFHIRServer(searchString,true).then(
                                function(data){
                                    var bundle = data.data;
                                    if (bundle.entry && bundle.entry.length > 0) {
                                        $scope.selectedProfiles = bundle;
                                        $scope.tab.tabQuery = false;
                                        $scope.tab.tabResults = true;
                                        //   console.log(bundle)
                                    } else {
                                        $scope.showNone = true;
                                    }

                                    $scope.showWaiting = false;
                                },function(err){
                                    $scope.showWaiting = false;
                                    console.log('Error: ',err);
                                    alert("Unable to retrieve Profile from the server. It may be currently unresponsive." +
                                        " You can use the 'show Servers' link at the top of the page to test it, or select " +
                                        "another Conformance server./n The error returned was: " + angular.toJson(err,true))
                                });


                        };


                        $scope.selectRecent = function(profile) {
                            $scope.$close(profile);
                        };

                        //when a profile has been chosen...
                        $scope.selectProfile= function(coreProfileName) {

                            if (coreProfileName) {
                                //a core profile was selected. Retrieve the SD and return...
                                $scope.showWaiting = true;
                                var uri = "http://hl7.org/fhir/StructureDefinition/"+coreProfileName;
                                
                                GetDataFromServer.findConformanceResourceByUri(uri).then(
                                    function(resource){
                                        console.log(resource)
                                        $scope.$close(resource);
                                        $scope.showWaiting = false;
                                    },
                                    function(err){
                                       // alert("There was an error retrieving the profile: "+angular.toJson(err));
                                        $scope.$dismiss();
                                        $scope.showWaiting = false;
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
                            $scope.createTree($scope.selectedProfile);

                            var dispProfile = angular.copy(entry.resource);


                            //immediatly select and return
                            $scope.$close(dispProfile);

                           // delete dispProfile.text;        //because the text can be huge...

                            //$scope.extAnalysis = Utilities.analyseExtensionDefinition($scope.selectedProfile);
                            //console.log($scope.extAnalysis);


                          //  $scope.selectedProfileJson = angular.toJson(dispProfile,true);
                           // $scope.selectedProfileJson = angular.toJson(dispProfile,true);

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
                            return appConfigSvc.getRecent();
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
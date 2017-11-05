//directile to render a UI for a profile.
angular.module("sampleApp").directive( 'vsBrowser', function (Utilities,GetDataFromServer,$uibModal  ) {
    return {
        restrict: 'E',
        scope: {
            trigger: '=',
            allowsearch: '=',
            showcreate : '=',
            hidesearch: '=',
            vsSelected : '&',
            conceptSelected : '&'
        },
        template: '<div></div>',

        link : function ($scope, element, attrs) {
/*
            $scope.tabCtrl = {};

            //default is to show the search tab unless overwritten...

            if ($scope.hidesearch) {
                $scope.tabCtrl.showsearch = false;
                //console.log('hide')
            } else {
                $scope.tabCtrl.showsearch = true;
            }
            if ($scope.showcreate) {
                $scope.tabCtrl.showcreate = true;
            }
*/

            //console.log($scope.vs)
            $scope.internalControl = $scope.trigger || {};

            $scope.internalControl.open = function(x) {
                if (x) {
                    $scope.selectedvs = angular.copy(x);
                    if ($scope.selectedvs.text) {
                        $scope.selectedvs.text.div = "Narrative removed";
                    }
                }

                showModal();
            };



            function showModal() {
                $uibModal.open({

                    templateUrl: 'resourceBuilder/vsBrowser.html',
                    size:'lg',
                    controller: function($scope,selectedvs,GetDataFromServer,$filter,$localStorage) {


                        $scope.config = $localStorage.config;
                        $scope.newVS = {canSave : false};

                        $scope.selectConcept = function(concept) {
                            $scope.$close(concept)
                        };

                        //when the close button is clicked
                        $scope.close = function(){
                            $scope.$dismiss();

                        };

                       // $scope.selectVSFn = selectVSFn;

                        $scope.tab = {};
                        $scope.tab.tabDescription = true;

                        /*
                        //when the directive is being used to select a valueset...
                       // $scope.showVSSelectButton = false;
                        $scope.selectNewVS = function() {
                            $scope.selectVSFn()($scope.selectedvs);
                            $scope.$close();
                        };

                        //if there is no vs passed in, then disable the expand tab...
                        if (!selectedvs) {
                            $scope.tab.noexpand = true;
                            $scope.tab.tabSearch = true;
                            $scope.tab.tabDescription = false;
                        }

                        $scope.searchParams = {};
                        */

                        $scope.results = {};
                        //$scope.results.filter = "diab"; //<< temp
                        $scope.selectedvs = selectedvs;
                        $scope.selectedvsJSON = angular.toJson(selectedvs,true);
                        $scope.helpTopic = "unknown";
                        $scope.showWaiting = false;

                        $scope.setHelpTopic = function(topic){
                            $scope.helpTopic = topic;
                        };


                        $scope.searchForVSDEP = function() {

                            var searchString = "ValueSet?";
                            ['name','description','type','publisher','url'].forEach(function(param){
                                //console.log()
                                if ($scope.searchParams[param]) {
                                    searchString += param + "=" + $scope.searchParams[param] + "&";
                                }
                            });

                            //strip off the trailing &
                            if (searchString.substr(searchString.length-1,1) == '&') {
                                searchString = searchString.substr(0,searchString.length-1)
                            }


                            //console.log(searchString);
                            $scope.query=searchString;

                            $scope.showWaiting = true;
                            GetDataFromServer.queryFHIRServer(searchString,true).then(
                                function(bundle){
                                    if (bundle.entry && bundle.entry.length > 0) {
                                        $scope.selectedVS = bundle;
                                        //$scope.tab.tabQuery = false;
                                        $scope.tab.searchResults = true;
                                           //console.log(bundle)
                                    } else {
                                        $scope.showNone = true;
                                    }

                                    $scope.showWaiting = false;
                                },function(err){
                                    $scope.showWaiting = false;
                                    console.log('Error: '+err);
                                    alert("Unable to retrieve Profile, sorry..." + angular.toJson(err,true))
                                });






                        };



                        $scope.showVSDEP = function(ev,entry) {

                            //this is the callback when a user selects the valueset
                            if ($scope.selectVSFn) {
                                $scope.showVSSelectButton = true;       //allow the user to select the vs
                            }


                            $scope.selectedvs = entry.resource;
                            if ($scope.selectedvs.text) {
                                $scope.selectedvs.text.div = "Narrative removed";
                            } else {
                                $scope.selectedvs.text = {div:"Narrative removed"};
                            }

                            $scope.selectedvsJSON  = angular.toJson(entry.resource,true);

                            $scope.tab.noexpand = false;


                            //$scope.selectVSFn()(entry.resource.id);

                            ev.stopPropagation();
                            ev.preventDefault();
                        };


                        //when the user is performing an expansion...
                        $scope.data = [];

                        $scope.expand = function() {

                            if (!$scope.selectedvs) {
                                alert('You must select a ValueSet before the expansion will work!');
                                return;
                            }

                            $scope.data = [];
                            $scope.showWaiting = true;
                            var filter = $scope.results.filter;
                            //console.log(filter);

                            if (! filter) {

                                //this should really be behind the service - but it's just to display to the user...
                                $scope.query = "ValueSet/"+$scope.selectedvs.id+"/$expand";

                                GetDataFromServer.getExpandedValueSet($scope.selectedvs.id).then(
                                    function(data1){
                                        $scope.showWaiting = false;
                                        if (data1.expansion) {
                                            $scope.data = data1.expansion.contains;
                                            if (! data1.expansion.contains) {
                                                alert('The expansion worked fine, but no expanded data was returned')
                                            }
                                        } else {
                                            alert('Sorry, no expansion occurred');
                                        }
                                    },function(err){
                                        $scope.showWaiting = false;
                                        console.log(err);
                                        if (err.statusCode == 422) {
                                            alert('There were too many concepts to expand - use a filter.');
                                        } else {
                                            alert('Sorry, there was an error performing the expansion: '+angular.toJson(err));
                                        }

                                    }
                                )
                            } else {
                                //this should really be behind the service - but it's just to display to the user...
                                $scope.query = "ValueSet/"+$scope.selectedvs.id+"/$expand?filter="+filter;
                                GetDataFromServer.getFilteredValueSet($scope.selectedvs.id,filter).then(
                                    function(data1){
                                        //console.log(data1);
                                        $scope.showWaiting = false;
                                        if (data1.expansion) {
                                            $scope.data = data1.expansion.contains;

                                            if (! data1.expansion.contains) {
                                                alert('The expansion worked fine, but no expanded data was returned')
                                            }

                                        } else {
                                            alert('Sorry, no expansion occurred');
                                        }

                                    },
                                    function(err){
                                        $scope.showWaiting = false;
                                        console.log(err);
                                        if (err.status == 422) {
                                            alert('There were too many concepts to expand - make the filter more restrictive.');
                                        } else {
                                            alert('Sorry, there was an error performing the expansion: '+angular.toJson(err));
                                        }
                                    }
                                )
                            }




                        };



                    },
                    resolve : {
                        selectedvs : function() {
                            return $scope.selectedvs;
                        }
                    }
                }).result.then(function(selectedConcept){
                        //User clicked save

                    //if there's no handler for selectinf a concept, then catch but ignore the exception...
                    try {
                        $scope.conceptSelected()(selectedConcept)
                    } catch (ex){

                    }


                })

            };





        }
    }
});
//directile to render a UI for a profile.
angular.module("sampleApp").directive( 'vsBrowser', function (Utilities,GetDataFromServer,$uibModal,$http,appConfigSvc  ) {
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

            $scope.internalControl = $scope.trigger || {};


            //invoke the vs browser. first parameter is a complete valueset, the second a url.
            //clinFHIR is changing to expect that a terminology server will support the /$expand?url=...  syntax at the moment
            $scope.internalControl.open = function(vs,url) {
                if (vs) {
                    $scope.selectedvs = angular.copy(vs);
                    if ($scope.selectedvs.text) {
                        $scope.selectedvs.text.div = "Narrative removed";
                    }
                }

                if (url) {
                    $scope.vsUrl = url;
                }

                showModal();
            };



            function showModal() {
                $uibModal.open({

                    templateUrl: 'resourceBuilder/vsBrowser.html',
                    size:'lg',
                    controller: function($scope,selectedvs,GetDataFromServer,$filter,$localStorage,vsUrl) {


                        $scope.config = $localStorage.config;
                        $scope.newVS = {canSave : false};
                        $scope.vsUrl = vsUrl

                        $scope.selectConcept = function(concept) {
                            $scope.$close(concept)
                        };

                        //when the close button is clicked
                        $scope.close = function(){
                            $scope.$dismiss();
                        };

                        $scope.tab = {};
                        $scope.tab.tabDescription = true;


                        $scope.results = {};
                        //$scope.results.filter = "diab"; //<< temp
                        $scope.selectedvs = selectedvs;
                        $scope.selectedvsJSON = angular.toJson(selectedvs,true);
                        $scope.helpTopic = "unknown";
                        $scope.showWaiting = false;

                        $scope.setHelpTopic = function(topic){
                            $scope.helpTopic = topic;
                        };

/*
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

*/
/*
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

*/
                        //when the user is performing an expansion...
                        $scope.data = [];

                        $scope.expand = function() {

                            //if a url was passed in, then use the $expand?url= syntax

                            if ($scope.vsUrl) {
                                var url = "";
                                var filter = $scope.results.filter;
                                //todo - this is a hack to support snomed refset expansion on the NZ server
                                if ($scope.vsUrl.indexOf('http://snomed.info')> -1) {
                                    //this is expanding off a snomed refset. see https://www.hl7.org/fhir/snomedct.html
                                    //assume the syntax is http://snomed.info/ValueSet/{refsetid}
                                    var ar = $scope.vsUrl.split('/');
                                    url = "http://its.patientsfirst.org.nz/RestService.svc/Terminz/ValueSet/$expand?url="
                                    url += "http://snomed.info/sct?fhir_vs=refset/" + ar[ar.length -1]


                                } else {
                                    url = appConfigSvc.getCurrentTerminologyServer().url;
                                    url += "ValueSet/$expand?url="+$scope.vsUrl;


                                }

                                if (filter) {
                                    url += "&filter="+filter;
                                }





                                $scope.query = url;
                                $http.get(url).then(
                                    function(data){
                                        var expandedVs = data.data;
                                        if (expandedVs.expansion) {
                                            $scope.data = expandedVs.expansion.contains;
                                            if (! expandedVs.expansion.contains) {
                                                alert('The expansion worked fine, but no expanded data was returned')
                                            }
                                        } else {
                                            alert('Sorry, no expansion occurred');
                                        }
                                    },
                                    function(err) {
                                        $scope.showWaiting = false;
                                        console.log(err);
                                        if (err.statusCode == 422) {
                                            alert('There were too many concepts to expand - use a filter.');
                                        } else {
                                            alert('Sorry, there was an error performing the expansion: '+angular.toJson(err));
                                        }
                                    }
                                )

                                return;
                            }





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
                        },
                        vsUrl : function() {
                            return $scope.vsUrl;
                        }
                    }
                }).result.then(function(selectedConcept){
                        //User clicked save

                    //if there's no handler for selecting a concept, then catch but ignore the exception...
                    try {
                        $scope.conceptSelected()(selectedConcept)
                    } catch (ex){

                    }


                })

            };





        }
    }
});
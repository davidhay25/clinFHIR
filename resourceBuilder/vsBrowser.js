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
                    backdrop:'static',
                    controller: function($scope,selectedvs,GetDataFromServer,$filter,$localStorage,vsUrl,appConfigSvc) {

                        let snomedUrl = "http://snomed.info/sct";

                        $scope.config = $localStorage.config;
                        $scope.newVS = {canSave : false};
                        $scope.vsUrl = vsUrl
                        $scope.input = {};

                        let authorUrl = appConfigSvc.config().standardExtensionUrl.clinFHIRCreated;

                        //retrieve the actual ValueSet
                        let url = appConfigSvc.getCurrentTerminologyServer().url;
                        url += "ValueSet?url="+ vsUrl;

                        $http.get(url).then(
                            function(data) {
                                console.log(data.statusCode)
                                if (data.data && data.data.entry) {
                                    $scope.valueSet = data.data.entry[0].resource;

                                    let ext = Utilities.getSingleExtensionValue($scope.valueSet,authorUrl);
                                    if (ext && ext.valueBoolean) {
                                        $scope.authoredbyCF = true;
                                    }

                                    console.log($scope.valueSet);
                                } else {
                                    $scope.footerMsg = "This ValueSet was not found on the Terminology server";
                                    $scope.notFound = true;
                                    $scope.authoredbyCF = true;     //will only show the display/edit tab if true...

                                    //create a new, blank valueset
                                    //$scope.isNew = true;
                                    $scope.valueSet = {resourceType:"ValueSet",status:"draft",compose:{include:[]}};
                                    $scope.valueSet.url = $scope.vsUrl;

                                    Utilities.addExtensionOnce($scope.valueSet,authorUrl,{valueBoolean:true});
                                   // let inc = {system:snomedUrl,concept:[]};
                                   // $scope.valueSet.compose.include.push(inc);
                                }
                            },
                            function(err) {
                                console.log(err.statusCode);
                            }
                        );


                        //-------- functions for adding a code to the ValueSet
                        $scope.codeSystemUrl = ""; //snomedUrl;       //default to SNOMED
                        $scope.input.usingSNOMED = true;
                        $scope.lookupCode = function(code) {
                            delete $scope.newCodeDisplay;
                            let url = appConfigSvc.getCurrentTerminologyServer().url + "CodeSystem/$lookup";
                            let params = {resourceType:"Parameters",parameter:[]}
                            params.parameter.push({name:'system',valueUri:snomedUrl})
                            params.parameter.push({name:'code',valueCode:code})
                            $http.post(url,params).then(
                                function(data) {
                                    let params = data.data;
                                    if (params && params.parameter) {
                                        params.parameter.forEach(function(param){
                                            if (param.name=='display') {
                                                $scope.newCodeDisplay = param.valueString;
                                            }
                                        })
                                    }
                                }, function(err) {
                                    alert("No concept with this code was found")
                                    console.log(err)
                                }
                            )
                        };

                        $scope.addNewCode = function(code,display) {

                            //find the include array where this system is located
                            let url = $scope.input.codeSystemUrl
                            if ($scope.input.usingSNOMED) {
                                url = snomedUrl;
                            }

                            $scope.valueSet.compose.include = $scope.valueSet.compose.include || [];
                            let includeToUse;
                            $scope.valueSet.compose.include.forEach(function (include) {
                                if (include.system == url) {
                                    includeToUse = include
                                }
                            });

                            //add a new section if needed
                            if (! includeToUse) {
                                includeToUse = {system:url,concept:[]};
                                $scope.valueSet.compose.include.push(includeToUse);
                            }


                            //and add the concept
                            //$scope.valueSet.compose.include = $scope.valueSet.compose.include || []
                            //let inc = $scope.valueSet.compose.include[0];

                            includeToUse.concept = includeToUse.concept || []
                            includeToUse.concept.push({code:code,display:display})
                            $scope.isDirty = true;
                            delete $scope.newCodeDisplay;
                            delete $scope.input.code;
                        };

                        $scope.removeConcept = function(concept){

                            console.log(concept)

                           // let inc = $scope.valueSet.compose.include[0];
                           // inc.concept.splice(inx,1);
                           // $scope.isDirty = true;
                        };

                        $scope.saveVS = function(){
                            if ($scope.valueSet.id)  {
                                //this is an update
                                let url = appConfigSvc.getCurrentTerminologyServer().url + "ValueSet/"+$scope.valueSet.id;
                                $http.put(url,$scope.valueSet).then(
                                    function(data) {
                                        alert('ValueSet was updated')
                                    },
                                    function(err){
                                        alert("Error saving ValueSet:"+angular.toJson(err.data))
                                    }
                                )
                            } else {
                                //this is new
                                let url = appConfigSvc.getCurrentTerminologyServer().url + "ValueSet";
                                $http.post(url,$scope.valueSet).then(
                                    function(data) {
                                        alert('ValueSet was created. The dialog needs to close.')
                                        $scope.$close();
                                        //need to assign the id so the next update is a put...

                                    },
                                    function(err){
                                        alert("Error saving ValueSet:"+angular.toJson(err.data))
                                    }
                                )
                            }
                        };

                        $scope.selectConcept = function(concept) {
                            $scope.$close(concept)
                        };

                        //when the close button is clicked
                        $scope.close = function(){
                            if ($scope.isDirty) {
                                if (confirm("There are unsaved changes. Are you sure you wish to close without saving?")) {
                                    $scope.$dismiss();
                                }
                            } else {
                                $scope.$dismiss();
                            }

                        };


                        $scope.checkForEnter = function(evt) {
                            var keyCode = evt.which || evt.keyCode;
                            console.log(keyCode)
                            if (keyCode === 13) {
                                $scope.expand();
                            }
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
                                $scope.showWaiting = true
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
                                ).finally(
                                    function(){
                                        $scope.showWaiting = false
                                    }
                                );

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
                                            alert('Sorry, there was an error performing the expansion: '+angular.toJson(err.data));
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
                                            alert('Sorry, there was an error performing the expansion: '+angular.toJson(err.data));
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
angular.module("sampleApp")
    .controller('validateSampleCtrl',
        function ($scope,$uibModal,$http,modalService,$timeout,$firebaseObject,appConfigSvc,$localStorage) {


            $scope.input = {};
            $scope.error = 'error';

            $http.post('/stats/login',{module:'validator'}).then(
                function(data){

                },
                function(err){
                    console.log('error accessing clinfhir to register access',err)
                }
            );

            $scope.allServers = [];

            $scope.allServers.push({display:"FHIR test 3","url":"http://test.fhir.org/r3/"});
            $scope.allServers.push({display:"FHIR test 4","url":"http://test.fhir.org/r4/",selected:true});

            $scope.allServers.push({display:"Public HAPI 3","url":"http://fhirtest.uhn.ca/baseDstu3/"});
            $scope.allServers.push({display:"Public HAPI 4","url":"http://fhirtest.uhn.ca/baseR4/"});

            $scope.allServers.push({display:"Telstra Health R3",url:"http://sqlonfhir-stu3.azurewebsites.net/fhir/",needsParameter:true});
            $scope.allServers.push({display:"Telstra Health R4",url:"http://sqlonfhir-r4.azurewebsites.net/fhir/",needsParameter:true});

            $scope.allServers.push({display:"Ontoserver R3","url":"https://ontoserver.csiro.au/stu3-latest/"});
            $scope.allServers.push({display:"Ontoserver R4","url":"https://r4.ontoserver.csiro.au/fhir/"});
            $scope.allServers.push({display:"Au primary care","url":"https://primarycare.ontoserver.csiro.au/fhir/"});

            if ($localStorage.validationServers) {
                $localStorage.validationServers.forEach(function(svr){
                    svr.local = true;
                    $scope.allServers.push(svr)
                })
            }

            $scope.fetchResource = function(url) {
                $http.get(url).then(
                    function(data) {
                        $scope.input.resource = angular.toJson(data.data);
                    },
                    function(err) {
                        alert(angular.toJson(err))
                    }
                )
            };

            $scope.validate = function( ){

                $scope.allServers.forEach(function(svr){
                    delete svr.response;
                    delete svr.outcome;
                })


                let resource = $scope.input.resource;
                if (resource) {
                    let resourceType;
                    let isJson = false;
                    let config = {headers: {'Content-type':'application/xml+fhir', accept:'application/json+fhir'}};
                    config.timeout = 30000;
                    resource = resource.trim();

                    if (resource.substr(0,1) == '<') {
                        //this is xml
                        let g = resource.indexOf('<?xml');
                        if (g > -1) {
                            let gg = resource.indexOf('?>');
                            resource = resource.substr(gg+2)
                            console.log(resource)
                            resource = resource.trim()
                        }

                        let g1 = resource.indexOf('>');
                        let gg1 = resource.indexOf(' ');
                        if (gg1 < g1) {
                            //there's a space before the '<' - probably means that there's a namespece there...
                            resourceType = resource.substr(1,gg1-1);
                        } else {
                            resourceType = resource.substr(1,g1-1);
                        }


                        //console.log(resourceType)

                    } else {
                        //assume json
                        try {
                            let r = angular.fromJson(resource);
                            resourceType = r.resourceType;
                            config.headers['Content-type'] = 'application/json+fhir'
                            isJson = true;
                        } catch (ex) {
                            alert("I thought this was Json, but I couldn't parse it");
                            return;
                        }
                    }


                    // let resourceType = "Patient";

                    //delete $scope.oo;
                    //let baseUrl = "https://primarycare.ontoserver.csiro.au/fhir/";
                    //let url = baseUrl + resourceType + '/$validate';
                    //$scope.url = url;

                    $scope.showWaiting = true;

                    for (var i=0; i <$scope.allServers.length; i++) {
                        let svr = $scope.allServers[i]
                    //$scope.allServers.forEach(function(svr){
                        if (svr.selected) {

                            svr.message = "Waiting..."

                            var url = svr.url + resourceType + '/$validate';
                            let content = resource;
                            //this assumes that the resource is json...
                            if (svr.needsParameter) {
                                if (! isJson) {
                                    alert('Sorry, the resource must be Json to send to the server '+svr.display);
                                    break;
                                }
                                content = {resourceType:'Parameters',parameter:[]}
                                content.parameter.push({name:'resource',resource:angular.fromJson(resource)})
                                //content.parameter.push({name:'mode',valueCode:'profile'})
                            }

                            //if a validation url has been set, then it must be sent as a parameter
                            if ($scope.profileUrl) {
                                content = {resourceType:'Parameters',parameter:[]}
                                content.parameter.push({name:'resource',resource:angular.fromJson(resource)})
                                //content.parameter.push({name:'mode',valueCode:'profile'})
                                //content.parameter.push({name:'profile',valueUri:$scope.profileUrl})
                                content.parameter.push({name:'profile',value:$scope.profileUrl})
                            }


                            $http.post(url,content,config).then(
                                function(data){
                                    console.log(data)
                                    svr.response = data.data;
                                    svr.outcome = true;
                                    delete svr.message;
                                    updateServer(svr,data.data)
                                   // $scope.oo = data.data;
                                },
                                function(err) {
                                    console.log(err)
                                    //$scope.oo = err.data;
                                    delete svr.message;
                                    if (err.status == -1) {
                                        svr.message = "Timeout"
                                    }

                                    svr.response = err.data;
                                    svr.outcome = false;
                                    updateServer(svr,err.data)

                                    //alert(angular.toJson(err))
                                }
                            ).finally(
                                function(){
                                    $scope.showWaiting = false;
                                }
                            )
                        }

                    }



                }

                function updateServer(svr,oo) {
                    svr.cntError = 0;
                    svr.cntWarning = 0;
                    if (oo) {
                        try {
                            let OO = angular.fromJson(oo)

                            if (OO.issue) {
                                OO.issue.forEach(function (iss) {
                                    switch (iss.severity) {
                                        case 'error' :
                                            svr.cntError++
                                            break;
                                        case 'warning' :
                                            svr.cntWarning++
                                            break;
                                    }
                                })
                            }

                    console.log(svr)

                        } catch (ex){
                            console.log(ex)
                        }
                    }
                }


            }





            $scope.addServer = function(){
                $uibModal.open({
                    backdrop: 'static',      //means can't close by clicking on the backdrop.
                    keyboard: false,       //same as above.
                    templateUrl: 'modalTemplates/addValidationServer.html',
                    size:'lg',
                    controller: function($scope,appConfigSvc,modalService){

                        $scope.input = {valid : false};

                        $scope.add = function() {
                            var svr = {display:$scope.input.name,url:$scope.input.url}
                            if ($scope.input.parameter) {
                                svr.needsParameter=true;
                            }
                            console.log(svr);

                            $scope.$close(svr);

                        };

                        $scope.test = function() {


                            if ($scope.input.url.substr(-1,1) !== '/') {
                                $scope.input.url += '/';
                            }

                            let url = $scope.input.url + "metadata";
                            $scope.waiting=true;
                            $http.get(url).then(
                                function(data){
                                    $scope.input.valid = true;
                                },
                                function(err){
                                    modalService.showModal({}, {bodyText: 'There is no valid FHIR server at this URL:'+url})
                                }
                            ).finally(function(){
                                $scope.waiting=false;
                            });


                        }

                    }
                }).result.then(function (svr) {
                    console.log(svr);
                    svr.local=true;
                    svr.id = 'id-'+ new Date().getTime();
                    $localStorage.validationServers = $localStorage.validationServers ||[]
                    $localStorage.validationServers.push(svr)
                    $scope.allServers.push(svr)
                  //  if ($localStorage.validationServers) {

                })
            }

            $scope.removeServer = function(svr) {
                if (svr && svr.id) {
                    //delete from
                    console.log(svr)
                    for (var i=0; i < $localStorage.validationServers.length; i++) {
                        let s = $localStorage.validationServers[i]
                        if (s.id == svr.id) {
                            //remove from the cache...
                            $localStorage.validationServers.splice(i,1)
                            //now update the allServers...
                            for (j=0; j< $scope.allServers.length; j++) {
                                let s1 = $scope.allServers[j]
                                if (s1.id == svr.id) {
                                    $scope.allServers.splice(j,1);
                                    break;
                                }
                            }
                            break;
                        }
                    }

                }
            }

        }
    )
angular.module("sampleApp")
    .controller('validateSampleCtrl',
        function ($scope,$uibModal,$http,modalService,$timeout,$firebaseObject,appConfigSvc,$location) {


            $scope.input = {};
            $scope.error = 'error';

            $scope.allServers = [];

            $scope.allServers.push({display:"Au primary care","url":"https://primarycare.ontoserver.csiro.au/fhir/",selected:true})
            $scope.allServers.push({display:"Public HAPI 4","url":"http://fhirtest.uhn.ca/baseR4/"})
            $scope.allServers.push({display:"FHIR test 4","url":"http://test.fhir.org/r4/"})
            $scope.allServers.push({display:"Telstra Health R3",url:"http://sqlonfhir-stu3.azurewebsites.net/fhir/",needsParameter:true})
            $scope.allServers.push({display:"Telstra Health R4",url:"http://sqlonfhir-r4.azurewebsites.net/fhir/",needsParameter:true})



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
                let resource = $scope.input.resource;
                if (resource) {
                    let resourceType;
                    let isJson = false;
                    let config = {headers: {'Content-type':'application/xml+fhir', accept:'application/json+fhir'}};
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


                        console.log(resourceType)

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
                            }


                            $http.post(url,content,config).then(
                                function(data){
                                    console.log(data)
                                    svr.response = data.data;
                                    svr.outcome = true;
                                   // $scope.oo = data.data;
                                },
                                function(err) {
                                    console.log(err)
                                    //$scope.oo = err.data;
                                    svr.response = err.data;
                                    svr.outcome = false;

                                    //alert(angular.toJson(err))
                                }
                            ).finally(
                                function(){
                                    $scope.showWaiting = false;
                                }
                            )
                        }

                    }

                    /*
                    $http.post(url,resource,config).then(
                        function(data){
                            console.log(data)
                            $scope.oo = data.data;
                        },
                        function(err) {
                            console.log(err)
                            $scope.oo = err.data;


                            //alert(angular.toJson(err))
                        }
                    ).finally(
                        function(){
                            $scope.showWaiting = false;
                        }
                    )
                    */

                }


            }
            console.log(location.host)
            //will update the config. We don't care if manually entered servers are lost or the default servers changed
            if (appConfigSvc.checkConfigVersion()) {
                alert('The config was updated. You can continue.')
            };

            firebase.auth().onAuthStateChanged(function(user) {


                if (user) {
                    $scope.user = user;

                    console.log(user)


                } else {
                    delete $scope.user

                }

            });

            $scope.login=function(){
                $uibModal.open({
                    backdrop: 'static',      //means can't close by clicking on the backdrop.
                    keyboard: false,       //same as above.
                    templateUrl: 'modalTemplates/login.html',
                    controller: 'loginCtrl'
                })
            };

            $scope.logout=function(){
                firebase.auth().signOut().then(function() {
                    delete $scope.user;
                    modalService.showModal({}, {bodyText: 'You have been logged out of clinFHIR'})

                }, function(error) {
                    modalService.showModal({}, {bodyText: 'Sorry, there was an error logging out - please try again'})
                });

            };


            let appRoot = location.host;

            /*
            //set the servers to the ones used by the csiro project.
            appConfigSvc.setServerType('conformance','http://home.clinfhir.com:8030/baseDstu3/');
            appConfigSvc.setServerType('data','http://home.clinfhir.com:8030/baseDstu3/');       //set the data server to the same as the conformance for the comments
            appConfigSvc.setServerType('terminology',"https://primarycare.ontoserver.csiro.au/fhir/");


            //$scope.uberModel = "http://clinfhir.com/logicalModeller.html#9xmtt";
            //$scope.commonModel = "http://clinfhir.com/logicalModeller.html#f5jor";
            $scope.taskManager = "/taskManager.html"

            $scope.uberModel =  "/logicalModeller.html#$$$CsiroUberModel";
            $scope.commonModel = "/logicalModeller.html#$$$CsiroCommon";
            $scope.testModel = "/logicalModeller.html#$$$ConditionTest";
            //$scope.taskManager = "/taskManager.html";

*/
        }
    )
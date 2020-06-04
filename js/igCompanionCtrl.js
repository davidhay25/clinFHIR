
angular.module("sampleApp")
    .controller('igCompanionCtrl',
        function ($scope,igCompanionSvc,$http,v2ToFhirSvc,$timeout,$window) {

            $scope.input = {}

            //console.log( $window.location)

            $scope.server = "http://home.clinfhir.com:8054/baseR4/";  //default - get from url
            $scope.termServer = "https://r4.ontoserver.csiro.au/fhir/"; //default - get from url
            //$scope.validateServer = "http://home.clinfhir.com:8054/baseR4/";


            $scope.validateServer = "http://hapi.fhir.org/baseR4/";

            let params = $window.location.search;
            if (params) {
                params = decodeURIComponent(params.substr(1));      //remove the '?'
                let ar = params.split('&')
                ar.forEach(function (param) {
                    let ar1 = param.split('=')
                    switch (ar1[0]) {
                        case "server" : {
                            $scope.server = ar1[1]
                            break;
                        }
                        case "termserver" : {
                            $scope.termServer = ar1[1]
                            break;
                        }
                        case "validateserver" : {
                            $scope.validateServer = ar1[1]
                            break;
                        }
                    }
                })
            }

            //retrieve all the samples defined for this IG
            igCompanionSvc.getSamples($scope.server).then(
                function (queries) {
                    $scope.queries = queries;
                    console.log(queries)
                },
                function(err) {
                    alert("Unable to retrieve any examples from " + $scope.server + ". Is this the correct URL to the root of the FHIR server?")
                }
            );


            $scope.validate = function(json) {
                let resource = angular.fromJson(json)
                delete $scope.validateResult;
                delete $scope.validateOutcome;
                let type = resource.resourceType;
                let url = $scope.validateServer + type + "/$validate"
                $http.post(url,resource).then(
                    function(data){
                        $scope.validateOutcome = "pass"
                        $scope.validateResult = data.data;
                    },
                    function (err) {
                        $scope.validateOutcome = "fail"
                        $scope.validateResult = err.data;
                       // alert('Unable to validate. Error:' + angular.toJson(err))
                    }
                )
            };

            //when a query is selected from the list..
            $scope.selectQuery = function(qry) {
                $scope.selectedQuery = qry;
                $scope.input.selectedQueryUrl = qry.url;    //as the user may change it...
            };

            $scope.executeQuery = function(qry) {
                delete $scope.input.selectedResourceInList;
                delete $scope.executeMessage;
                $("#resourcesGraph").empty();

                qry = $scope.server + qry;
                //add _count to the query
                if (qry.indexOf('?') > -1) {
                    qry += "&_count=100"
                } else {
                    qry += "?_count=100"
                }


                $http.get(qry).then(
                    function(data) {
                        $scope.sampleResult = data;

                        if (data.data.link) {
                            data.data.link.forEach(function (link) {
                                if (link.relation == 'next') {
                                    $scope.executeMessage = "The result set was too large to download completely. Refine your search for a complete list"
                                }
                            })
                        }

                        $scope.sampleGraph = makeGraph (data.data,'resourcesGraph')



                    },
                    function(err) {
                        $scope.sampleResult = err

                    }
                )

            }

            $scope.fitGraph = function(graph) {
                if (graph) {
                    $timeout(function () {
                        graph.fit();
                    },500)

                }
            };

            let makeGraph = function(bundle,id) {
                if (!bundle) {
                    return;
                }
                let options = {bundle:bundle,hashErrors:{}};//,centralResourceId:id}

                options.serverRoot =  $scope.server//  "http://home.clinfhir.com:8054/baseR4/"

                // options.showInRef = $scope.input.showInRef;
                //options.showOutRef = $scope.input.showOutRef;

                let vo = v2ToFhirSvc.makeGraph(options);

                let container = document.getElementById(id);
                let graphOptions = {
                    physics: {
                        enabled: true,
                        barnesHut: {
                            gravitationalConstant: -10000,
                        }
                    }
                };

                let graph=new vis.Network(container, vo.graphData, graphOptions);

                graph.on("click", function (obj) {

                    let nodeId = obj.nodes[0];  //get the first node
                    if (nodeId) {
                        let node = vo.visNodes.get(nodeId);

                        $scope.selectedResource = $scope.selectedResource || {}
                        $scope.selectedResource[id] = node.resource;
                    } else {
                        let edgeId = obj.edges[0];
                        if (edgeId) {
                            let edge = vo.visEdges.get(edgeId);

                        }
                    }


                    $scope.$digest();
                })

                return graph

            }

    });

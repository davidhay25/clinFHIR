angular.module("sampleApp")
    .controller('bundleVisualizerCtrl',
        function ($scope,$uibModal,$http,v2ToFhirSvc,$timeout,modalService,GetDataFromServer) {

            //$scope.conformanceServer = 'http://fhirtest.uhn.ca/baseR4/';
            //$scope.dataServer = 'http://fhirtest.uhn.ca/baseR4/';
            //$scope.dataServer = "http://hapi.fhir.org/baseR4/";
            $scope.dataServer = "http://snapp.clinfhir.com:8081/baseDstu3/";
            $scope.conformanceServer = 'http://snapp.clinfhir.com:8081/baseDstu3/';

            $scope.queries = [];
            $scope.queries.push({display:'Patients called eve',query:'Patient?name=hay'});
            $scope.queries.push({display:'All Florence Hays data',query:'Patient/22101/$everything'});

            $scope.importBundle = function() {
                $uibModal.open({
                    templateUrl: 'modalTemplates/importBundle.html',
                    //size: 'lg',
                    controller: function($scope,appConfigSvc,modalService) {
                        $scope.input = {};


                        $scope.import = function() {
                            var raw = $scope.input.raw;

                            var g = raw.indexOf('xmlns="http://hl7.org/fhir"') || raw.indexOf("xmlns='http://hl7.org/fhir'");
                            if (g > -1) {
                                //this is Xml (I think!) Use the Bundle endpoint
                                $scope.waiting = true;
                                var url = $scope.dataServer+"Bundle";

                                var config = {headers:{'content-type':'application/fhir+xml'}}
                                $http.post(url,raw,config).then(
                                    function(data) {
                                        //the bundle was saved - now read it back from the server in Json format...

                                        let serverId = data.headers('Content-Location');
                                        serverId = serverId || data.headers('content-location');
                                        serverId = serverId || data.headers('location');
                                        serverId = serverId || data.headers('Location');

                                        console.log(serverId)

                                        if (serverId) {
                                            url += "/"+serverId;
                                            config = {headers:{'accept':'application/fhir+json'}};
                                            $http.get(url).then(
                                                function(data){
                                                    //now we can import the bundle
                                                    importFromJson(data.data);
                                                }, function (err) {
                                                    var msg = "The bundle was saved Ok, but couldn't be retrieved from the server";
                                                    modalService.showModal({}, {bodyText:msg});
                                                    //$scope.$cancel()
                                                }
                                            ).finally(function(){
                                                $scope.waiting = false;
                                            });

                                        } else {
                                            var msg = "The bundle was saved Ok, but I couldn't determine which Id was assigned to it, so cannot import it. Sorry about that."
                                            modalService.showModal({}, {bodyText:msg});
                                        }
                                    },
                                    function(err) {

                                        var msg = "The server couldn't process the Xml. Is it valid FHIR and a valid bundle?";
                                        var config = {bodyText:msg}
                                        try {
                                            var oo = angular.fromJson(err.data);
                                            console.log(oo);
                                            config.oo = oo;
                                        } catch (ex){
                                            msg += angular.toJson(err);
                                        }

                                        modalService.showModal({}, config);
                                        $scope.waiting = false;
                                    }
                                )
                            } else {
                                //this is json - just return if
                                importFromJson(raw,true)
                            }

                        };

                        let importFromJson = function(json,stripText) {

                            try {
                                var res = angular.fromJson(json)

                            } catch (ex) {
                                modalService.showModal({}, {bodyText:'This is not valid JSON'});
                                return;
                            }

                            delete res.id;      //we'll create our own
                            if (! res.resourceType) {
                                modalService.showModal({}, {bodyText:"The element 'resourceType' must exist."});
                                return;
                            }

                            if (res.resourceType !== 'Bundle') {
                                modalService.showModal({}, {bodyText:"The 'resourceType' must be 'Bundle."});
                                return;
                            }



                            $scope.$close(res);     //close the dialog, passing across the resource

                        }

                    }

                }).result.then(function (bundle) {
                    //the importer will return a resource that is the one to be selected...  (might have been a bundle)

                    let newBundle = deDupeBundle(bundle)
                    console.log(newBundle)
                    processBundle(newBundle);


                })

            };

            $scope.selectIssue = function(issue){
                console.log(issue)
                //find the actual entry - a bit of a hack tttt
                if (issue.location) {
                    let g1 = issue.location[0].indexOf('[')
                    let g2 = issue.location[0].indexOf(']')
                    if (g1 && g2) {
                        let inx = issue.location[0].substr(g1+1,g2-g1-1)
                        console.log(inx -1)
                        $scope.selectedIssueEntry = $scope.fhir.entry[inx-1]
                    }
                }

            };

            $scope.selectBundleEntry = function(entry,hashErrors) {
                $scope.selectedBundleEntry = entry
                $scope.selectedBundleEntryErrors = hashErrors;


                console.log(entry)

                let vo = v2ToFhirSvc.makeGraph($scope.fhir,hashErrors,$scope.serverRoot,false,entry.resource.id)

                console.log(vo);

                let container = document.getElementById('singleResourceGraph');
                let options = {
                    physics: {
                        enabled: true,
                        barnesHut: {
                            gravitationalConstant: -10000,
                        }
                    }
                };
                $scope.singleResourceChart = new vis.Network(container, vo.graphData, options);


            };

            $scope.fitSingleGraph = function(){
                $timeout(function(){
                    if ($scope.singleResourceChart) {
                        $scope.singleResourceChart.fit();

                    }

                },1000)

            };

            $scope.fitGraph = function(){
                $timeout(function(){
                    if ($scope.chart) {
                        $scope.chart.fit();
                    }
                },1000)
            };

            $scope.selectQuery = function(query) {
                delete $scope.selectedBundleEntryErrors;
                delete $scope.selectedBundleEntry;
                $scope.selectedQuery = query;

                GetDataFromServer.adHocFHIRQueryFollowingPaging($scope.dataServer + query.query).then(
                    function(data) {
                        console.log(data)

                        let newBundle = deDupeBundle(data.data)
console.log(newBundle)
                        processBundle(newBundle);
                    },
                    function(err) {
                        console.log(err);
                    }
                )
            };

            //create the various renderings from the bundle...
            let processBundle = function(bundle) {
                delete $scope.serverRoot;
                $scope.fhir = bundle;
                $scope.validate(bundle,function(hashErrors){
                    $scope.hashErrors = hashErrors;


                    //the serverRoot is needed to figure out the references when the reference is relative
                    //we assume that all the resoruces are from the same server, so figure out the server root
                    //by looking at the first fullUrl (remove the /{type}/{id} at the end of the url
                    let serverRoot = "";
                    if ($scope.fhir && $scope.fhir.entry) {
                        let first = $scope.fhir.entry[0]
                        if (first && first.fullUrl) {
                            console.log(first.fullUrl)
                            let ar = first.fullUrl.split('/')
                            ar.pop();
                            ar.pop();
                            serverRoot = ar.join('/') + "/"
                            console.log(serverRoot)
                            $scope.serverRoot = serverRoot;

                        } else {
                            alert('All entries need the fullUrl for the graph generation to work properly. The graph may be incomplete..')
                        }
                    }


                    let centralResourceId = null;
                    let vo = v2ToFhirSvc.makeGraph($scope.fhir,hashErrors,serverRoot,false,centralResourceId)

                    console.log(vo)
                    var container = document.getElementById('resourceGraph');
                    var options = {
                        physics: {
                            enabled: true,
                            barnesHut: {
                                gravitationalConstant: -10000,
                            }
                        }
                    };
                    $scope.chart = new vis.Network(container, vo.graphData, options);

                    $scope.chart.on("click", function (obj) {

                        var nodeId = obj.nodes[0];  //get the first node
                        var node = vo.graphData.nodes.get(nodeId);
                        $scope.selectedNode = node;

                        console.log( $scope.selectedNode)
                        $scope.$digest();
                    })


                    console.log(vo)

                });
            }

            $scope.validate = function(bundle,cb) {
                let url = $scope.conformanceServer + "Bundle/$validate";
                $scope.showWaiting = true;
                //delete $scope.hashErrors;
                $http.post(url,bundle).then(
                    function(data) {
                        console.log(data)
                        $scope.validationResult = data.data;


                    },function(err) {
                        console.log(err)
                        $scope.validationResult = err.data;

                    }
                ).finally(
                    function () {
                        $scope.showWaiting = false;



                        //count of errors for each resource
                        let hashErrors = {};
                        $scope.validationResult.issue.forEach(function (issue) {
                            if (issue.location) {
                                let g1 = issue.location[0].indexOf('[')
                                let g2 = issue.location[0].indexOf(']')
                                if (g1 && g2) {
                                    let inx = issue.location[0].substr(g1+1,g2-g1-1)
                                    //console.log(inx -1)
                                    hashErrors[inx-1] = hashErrors[inx-1] || [];


                                    if (issue.location) {
                                        issue.location.forEach(function (loc,inx) {

                                            let ar = loc.split('.');
                                            ar.splice(0,3);
                                            issue.location[inx] = ar.join('.')

                                        })
                                    }



                                    hashErrors[inx-1].push(issue)
                                }
                            }
                        })

                        cb(hashErrors)


                        if ($scope.validationResult || $scope.validationResult.issue) {
                            $scope.valErrors = 0, $scope.valWarnings=0;

                            $scope.validationResult.issue.forEach(function(iss){
                                if (iss.severity == 'error') {
                                    $scope.valErrors++
                                } else {
                                    $scope.valWarnings++
                                }
                            })

                        }


                    }
                )
            };

            $scope.copyToClipboard = function(){
                if ($scope.fhir) {
                    //https://stackoverflow.com/questions/29267589/angularjs-copy-to-clipboard
                    var copyElement = document.createElement("span");
                    copyElement.appendChild(document.createTextNode(angular.toJson($scope.fhir),2));
                    copyElement.id = 'tempCopyToClipboard';
                    angular.element(document.body.append(copyElement));

                    // select the text
                    var range = document.createRange();
                    range.selectNode(copyElement);
                    window.getSelection().removeAllRanges();
                    window.getSelection().addRange(range);

                    // copy & cleanup
                    document.execCommand('copy');
                    window.getSelection().removeAllRanges();
                    copyElement.remove();

                    alert("The bundle has been copied to the clipboard.")
                }

            }

            function deDupeBundle(bundle) {
                let newBundle = angular.copy(bundle)
                newBundle.entry.length = 0;
                let idHash = {};
                bundle.entry.forEach(function (entry) {
                    if (! idHash[entry.resource.id]) {
                        newBundle.entry.push(entry);
                        idHash[entry.resource.id] = true;
                    }

                });

                newBundle.entry.sort(function(a,b){
                    let a1 = a.resource.resourceType + "/" + a.resource.id;
                    let b1 = b.resource.resourceType + "/" + b.resource.id;
                    if (a1 > b1) {
                        return 1
                    } else if (b1 > a1) {
                        return -1
                    } else {
                        return 0
                    }
                })

                return newBundle;
            }


        }
    );
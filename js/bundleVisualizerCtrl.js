angular.module("sampleApp")
    .controller('bundleVisualizerCtrl',
        function ($scope,$uibModal,$http,v2ToFhirSvc,$timeout,modalService,GetDataFromServer,appConfigSvc,$localStorage) {

            //$scope.conformanceServer = 'http://fhirtest.uhn.ca/baseR4/';
            //$scope.dataServer = 'http://fhirtest.uhn.ca/baseR4/';
            //$scope.dataServer = "http://hapi.fhir.org/baseR4/";
            //$scope.dataServer = "http://snapp.clinfhir.com:8081/baseDstu3/";
            //$scope.conformanceServer = 'http://snapp.clinfhir.com:8081/baseDstu3/';

            //will update the config. We don't care if manually entered servers are lost or the default servers changed
            if (appConfigSvc.checkConfigVersion()) {
                alert('The config was updated. You can continue.')
            }

            $http.post('/stats/login',{module:'bundleVisualizer'}).then(
                function(data){

                },
                function(err){
                    console.log('error accessing clinfhir to register access',err)
                }
            );

            //pre-defined queries
            $scope.queries = [];
            $scope.queries.push({display:'Patients called eve',query:'Patient?name=hay'});
            $scope.queries.push({display:'All Florence Hays data',query:'Patient/112529/$everything'});

            //inward and outwards references in graph
            $scope.input = {};
            $scope.input.showInRef = true;
            $scope.input.showOutRef = true;

            if ($localStorage.bvQueries) {
                $scope.queries = $localStorage.bvQueries
                /*
                $localStorage.bvQueries.forEach(function(query){
                    $scope.queries.push(query)
                })
                */
            }

            $scope.addQuery = function(){
                $uibModal.open({
                    templateUrl: 'modalTemplates/addQuery.html',
                    size: 'lg',
                    controller: function ($scope,dataServer,$http) {
                        $scope.input = {};
                        $scope.dataServer = dataServer

                        $scope.canSave = function() {
                            if (! $scope.response || ! $scope.input.name) {
                                return false;
                            }

                            if ($scope.response) {
                                if ($scope.response.resourceType !== 'Bundle') {
                                    return false;
                                } else {
                                    if (! $scope.response.entry || $scope.response.entry.length ==0) {
                                        return false;
                                    }
                                }
                            }
                            return true;
                        };


                        $scope.save = function(){
                            $scope.$close({query:$scope.input.query,display:$scope.input.name,description:$scope.input.description})
                        };

                        $scope.execute = function(qry) {

                            let options = {headers: {'Accept':'application/fhir+json'}};
                            let fullQry = qry

                            if (qry.substr(0,4) !== 'http') {
                                 fullQry = dataServer.url + qry
                            }

                            $scope.actualQuery = fullQry;

                            $scope.waiting = true;
                            $http.get(fullQry,options).then(
                                function(data) {
                                    $scope.response = data.data;
                                },
                                function(err) {
                                    $scope.response = err.data;
                                }
                            ).finally(
                                function(){
                                    $scope.waiting = false;
                                }
                            )

                        }
                    },
                    resolve : {
                        dataServer: function () {          //the default config
                            return $scope.dataServer;

                        }
                    }
                }).result.then(function(vo) {
                        $localStorage.bvQueries = $localStorage.bvQueries || []
                        $localStorage.bvQueries.push(vo);
                        $scope.queries = $localStorage.bvQueries
                    }
                )
            };

            $scope.deleteQuery = function(inx) {
                if (confirm('Are you sure you wish to remove this query')){
                    $localStorage.bvQueries.splice(inx,1)
                }

            };

            $scope.dataServer = appConfigSvc.getCurrentDataServer();
            $scope.conformanceServer = appConfigSvc.getCurrentConformanceServer();


            //load bundles with an identifier in the cfBundle identifier system
            let identifierSystem = appConfigSvc.config().standardSystem.bundleIdentifierSystem;
            let url = $scope.dataServer.url + "Bundle?identifier="+identifierSystem + "|";
            $http.get(url).then(
                function(data) {
                    console.log(data)
                    $scope.existingBundles = data.data;
                }
            );

            $scope.importBundle = function() {
                $uibModal.open({
                    templateUrl: 'modalTemplates/importBundle.html',
                    size: 'lg',
                    controller: function($scope,appConfigSvc,modalService,dataServer) {
                        $scope.input = {};
                        $scope.identiferChecked = true;     //false if the identifier has been checked (or is null)

                        let identifierSystem = appConfigSvc.config().standardSystem.bundleIdentifierSystem;
                        //let cfCreatedExt = appConfigSvc.config().standardExtensionUrl.clinFHIRCreated;

                        if (!identifierSystem) {
                            alert('identifier system null')
                            return;
                        }

                        $scope.canSave = function() {
                            if (!$scope.identiferChecked) {
                                return false
                            }
                            if (! $scope.input.raw) {
                                return false
                            }
                            return true;
                        };




                        //see if the identifier already exists
                        $scope.testIdentifier = function(){
                            let identifier = $scope.input.identifier;
                            var url = dataServer.url+"Bundle?identifier=";
                            url += identifierSystem + "|" + $scope.input.identifier ;

                            var config = {headers:{'content-type':'application/fhir+json'}}
                            $http.get(url,config).then(
                                function(data) {
                                    if (data.data && data.data.entry && data.data.entry.length > 0) {
                                        alert("This identifier has already been used. Try another.");
                                        delete $scope.input.identifier;
                                        return;
                                    } else {
                                        $scope.identiferChecked = true;
                                        alert("This identifier is ok to use.")
                                    }
                                })
                        };

                        $scope.import = function() {
                            var raw = $scope.input.raw;

                            var g = raw.indexOf('xmlns="http://hl7.org/fhir"') || raw.indexOf("xmlns='http://hl7.org/fhir'");
                            if (g > -1) {
                                //this is Xml (I think!) Use the Bundle endpoint
                                $scope.waiting = true;
                                var url = dataServer.url+"Bundle";

                                var config = {headers:{'content-type':'application/fhir+xml'}}
                                $http.post(url,raw,config).then(
                                    function(data) {
                                        //the bundle was saved - now read it back from the server in Json format...

                                        let serverId = data.headers('Content-Location');
                                        serverId = serverId || data.headers('content-location');
                                        serverId = serverId || data.headers('location');
                                        serverId = serverId || data.headers('Location');

                                        console.log(serverId);
                                        //this seems to be a full URl - is this always the case?

                                        if (serverId) {

                                            //url += "/"+serverId;
                                            config = {headers:{'accept':'application/fhir+json'}};
                                            $http.get(serverId).then(
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
                                modalService.showModal({}, {bodyText:"The 'resourceType' must be 'Bundle'."});
                                return;
                            }



                            if ($scope.input.identifier) {

                                res.identifier = {"system":identifierSystem,value:$scope.input.identifier}

                                if (res.type == 'transaction') {
                                    res.type = 'collection'
                                    alert("Changing bundle type to 'collection' as transactions can't be saved directly")
                                }

                                var url = dataServer.url+"Bundle";
                                var config = {headers:{'content-type':'application/fhir+json'}}
                                $http.post(url,res,config).then(
                                    function() {
                                        alert("Bundle has been saved,")
                                    },
                                    function(err){
                                        console.log(err)
                                        alert("Sorry, there was an error and the bundle wasn't saved:" + angular.toJson(err.data))
                                    }
                                ).finally(
                                    function(){
                                        $scope.$close(res);
                                    }
                                )

                                //identifierSystem + "|" + $scope.input.identifier ;
                            } else {
                                $scope.$close(res);     //close the dialog, passing across the resource
                            }




                        }

                    },
                    resolve : {
                        dataServer: function () {          //the default config
                            return $scope.dataServer;

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


            $scope.selectBundleEntry = function(entry,entryErrors) {
                $scope.selectedBundleEntry = entry
                $scope.selectedBundleEntryErrors = entryErrors;

                $scope.createGraphOneEntry();

/*
                //console.log(entry)
                let id = entry.resource.id || entry.fullUrl;
                let options = {bundle:$scope.fhir,hashErrors:$scope.hashErrors,serverRoot:$scope.serverRoot,centralResourceId:id}
                let vo = v2ToFhirSvc.makeGraph(options);
                //let vo = v2ToFhirSvc.makeGraph($scope.fhir,$scope.hashErrors,$scope.serverRoot,false,id)
                //console.log(vo);

                let container = document.getElementById('singleResourceGraph');
                let graphOptions = {
                    physics: {
                        enabled: true,
                        barnesHut: {
                            gravitationalConstant: -10000,
                        }
                    }
                };
                $scope.singleResourceChart = new vis.Network(container, vo.graphData, graphOptions);
*/
                let treeData = v2ToFhirSvc.buildResourceTree(entry.resource);

                //show the tree structure of this resource (adapted from scenario builder)
                $('#builderResourceTree').jstree('destroy');
                $('#builderResourceTree').jstree(
                    {'core': {'multiple': false, 'data': treeData, 'themes': {name: 'proton', responsive: true}}}
                )

            };

            $scope.createGraphOneEntry = function(){

                let id = $scope.selectedBundleEntry.resource.id || $scope.selectedBundleEntry.fullUrl;
                let options = {bundle:$scope.fhir,hashErrors:$scope.hashErrors,serverRoot:$scope.serverRoot,centralResourceId:id}


                options.showInRef = $scope.input.showInRef;
                options.showOutRef = $scope.input.showOutRef;

                let vo = v2ToFhirSvc.makeGraph(options);
                //let vo = v2ToFhirSvc.makeGraph($scope.fhir,$scope.hashErrors,$scope.serverRoot,false,id)
                //console.log(vo);

                let container = document.getElementById('singleResourceGraph');
                let graphOptions = {
                    physics: {
                        enabled: true,
                        barnesHut: {
                            gravitationalConstant: -10000,
                        }
                    }
                };
                $scope.singleResourceChart = new vis.Network(container, vo.graphData, graphOptions);

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

            $scope.selectBundleFromList = function(entry) {
                delete $scope.selectedBundleEntryErrors;
                delete $scope.selectedBundleEntry;

                $scope.selectedEntry = entry;
                processBundle(entry.resource);

/*
                GetDataFromServer.adHocFHIRQueryFollowingPaging($scope.dataServer.url + query.query).then(
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
                */
            };

            $scope.selectQuery = function(query) {
                delete $scope.selectedBundleEntryErrors;
                delete $scope.selectedBundleEntry;
                $scope.selectedQuery = query;
                $scope.showWaiting = true;
                let url = query.query;

                if (url.indexOf('http') == -1) {
                    url = $scope.dataServer.url + url;
                }

                GetDataFromServer.adHocFHIRQueryFollowingPaging(url).then(
                    function(data) {
                        console.log(data)

                        let newBundle = deDupeBundle(data.data)
console.log(newBundle)
                        processBundle(newBundle);
                    },
                    function(err) {
                        console.log(err);
                    }
                ).finally(function(){
                    $scope.showWaiting = false;
                })
            };

            //create the various renderings from the bundle...
            let processBundle = function(oBundle) {
                delete $scope.serverRoot;
                $scope.fhir = oBundle;

                $scope.validate(oBundle,function(hashErrors){
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

                    let options = {bundle:$scope.fhir,hashErrors:$scope.hashErrors,serverRoot:serverRoot}
                    let vo = v2ToFhirSvc.makeGraph(options)
                    //let vo = v2ToFhirSvc.makeGraph($scope.fhir,hashErrors,serverRoot,false)
                    console.log(vo)
                    var container = document.getElementById('resourceGraph');
                    var graphOptions = {
                        physics: {
                            enabled: true,
                            barnesHut: {
                                gravitationalConstant: -10000,
                            }
                        }
                    };
                    $scope.chart = new vis.Network(container, vo.graphData, graphOptions);

                    $scope.chart.on("click", function (obj) {

                        var nodeId = obj.nodes[0];  //get the first node
                        var node = vo.graphData.nodes.get(nodeId);
                        $scope.selectedNode = node;

                        console.log( $scope.selectedNode)
                        $scope.$digest();
                    })


                    console.log(vo)

                });

                let bundle=angular.copy(oBundle)


                //if this is a document, then
                delete $scope.document;     //contains the document specific resources suitable for layout
                if (bundle.type == 'document') {
                    let arComposition = [];
                    //create a hash by type & id - to find document references
                    let hash = {}

                    bundle.entry.forEach(function (entry) {
                        if (entry.resource) {


                            let key;
                            if (entry.resource.id) {
                                key = entry.resource.resourceType + "/" + id
                            } else {
                                key = entry.fullUrl
                            }

                            //let id = entry.resource.id || entry.fullUrl;
                            //let key = entry.resource.resourceType + "/" + id;



                            hash[key] = entry.resource;
                            if (entry.resource.resourceType == 'Composition') {
                                arComposition.push(entry.resource)
                            }
                        }

                    });
                    switch (arComposition.length) {
                        case 0 :
                            alert('This is a document, but there is no Composition resource')
                            break;
                        case 1 :
                            $scope.document = {composition : arComposition[0]};
                            break;
                        default:
                            alert('There were '+arComposition.length + ' Composition resources, and there should only be 1')
                    }

                    if ($scope.document.composition) {
                        //now get the subject
                        if ($scope.document.composition.subject) {
                            if ($scope.document.composition.subject.reference) {



                                $scope.document.subject = hash[$scope.document.composition.subject.reference];
                                if (!$scope.document.subject) {
                                    alert('The subject reference from Composition ('+$scope.document.composition.subject.reference+') is not in the bundle')
                                }
                            } else {
                                alert('The composition resource is missing the subject reference')
                            }
                        } else {
                            alert('The composition resource is missing the subject property')
                        }

                        //get the resources referenced from the composition
                        $scope.document.sectionResources = []

                        $scope.document.composition.section.forEach(function(section,inx){
                            //let section = angular.copy(oSection)
                            section.realResources = []
                            if (section.entry) {
                                section.entry.forEach(function (entry) {
                                    let resource = hash[entry.reference]
                                    if (resource) {
                                        //todo check for list
                                        section.realResources.push({display:resource.resourceType,resource:resource})
                                    } else {
                                        section.realResources.push({display:'unknown reference:'+entry.reference})
                                    }

                                })
                            }


                        })


console.log($scope.document.composition)



                        //locate the
                    }
                }


            };


            $scope.validate = function(bundle,cb) {
                let url = $scope.conformanceServer.url + "Bundle/$validate";
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
                        });

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

            };

            function deDupeBundle(bundle) {
                let newBundle = angular.copy(bundle)


                //return newBundle;

                //------- tet

                newBundle.entry.length = 0;
                let idHash = {};

                bundle.entry.forEach(function (entry) {

                    if (entry.resource) {
                        let resourceId = entry.fullUrl;
                        if (entry.resource.id) {
                            resourceId = entry.resource.resourceType + "/" + entry.resource.id;
                        }




                        if (! idHash[resourceId]) {
                            newBundle.entry.push(entry);
                            idHash[resourceId] = true;
                        }
                    } else {
                        alert("There is an entry with the fullUrl "+ entry.fullUrl + " that has no resource - ignoring...")
                    }


                });

                newBundle.entry.sort(function(a,b){

                    let ida = a.resource.id || a.fullUrl;
                    let idb = b.resource.id || b.fullUrl;

                    let a1 = a.resource.resourceType + "/" + ida;
                    let b1 = b.resource.resourceType + "/" + idb;

                    //let a1 = a.resource.resourceType + "/" + a.resource.id;
                    //let b1 = b.resource.resourceType + "/" + b.resource.id;

                    if (a1 > b1) {
                        return 1
                    } else if (b1 > a1) {
                        return -1
                    } else {
                        return 0
                    }
                });

                return newBundle;
            }
        }
    );
angular.module("sampleApp")
    .controller('nhipCtrl',
        function ($scope,$firebaseAuth,$uibModal,modalService,nhipSvc,logicalModelSvc,$http,
                  v2ToFhirSvc,$sce,appConfigSvc,v2ToFhirSvc,$timeout,$location) {

            $scope.selectedGroup = 'logical';       //initial group to display
            $scope.input = {};

            appConfigSvc.setServerType('conformance','http://home.clinfhir.com:8054/baseR4/');
            appConfigSvc.setServerType('data','http://home.clinfhir.com:8054/baseR4/');       //set the data server to the same as the conformance for the comments
            //appConfigSvc.setServerType('terminology',"http://home.clinfhir.com:8054/baseR4/");
            appConfigSvc.setServerType('terminology',"https://ontoserver.csiro.au/stu3-latest/");

            $scope.appConfigSvc = appConfigSvc;

            $http.post('/stats/login',{module:"HPI"}).then(
                function(data){
                    //console.log(data);
                },
                function(err){
                    console.log('error accessing clinfhir to register access',err)
                }
            );


            //the capability statement (that has the search's supported). Not sure if there should only be a single one or not...
            $http.get("http://home.clinfhir.com:8054/baseR4/CapabilityStatement/nhip-capstmt").then(
                function(data) {
                    $scope.nhipCapStmt = data.data;
                }
            );

            //get all the NamingSystem resources off the server. May want a more elegant way...
            $http.get("http://home.clinfhir.com:8054/baseR4/NamingSystem?_count=100").then(
                function(data) {
                    $scope.namingSystem = [];
                    data.data.entry.forEach(function (entry) {
                        $scope.namingSystem.push(entry.resource)
                    });

                    $scope.namingSystem.sort(function(a,b){
                        if (a.description > b.description) {
                            return 1
                        } else {
                            return -1
                        }


/*
                        let url1 = getUrl(a)
                        let url2 = getUrl(b)
                        if (url1 > url2) {
                            return 1
                        } else {
                            return -1
                        }


                        function getUrl(ns) {
                            let url = "";
                            if (ns.uniqueId) {

                                ns.uniqueId.forEach(function(id){
                                    if (id.type='uri') {
                                        url = id.value
                                    }
                                })
                            }
                            return url;
                        }
                        */
                    })

                    console.log($scope.namingSystem)
                }
            );
            $scope.showNamingSystem = function(ns,filter) {

                if (!filter) {
                    return true
                } else {
                    let f = filter.toLowerCase()

                    if (ns.usage) {
                        let u = ns.usage.toLowerCase()
                        if (u.indexOf(f) > -1) {
                            return true
                        }
                    }

                    if (ns.description) {
                        let d = ns.description.toLowerCase()
                        if (d.indexOf(f) > -1) {
                            return true
                        }
                    }
                    if (ns.uniqueId) {
                       // ns.uniqueId.forEach(function (id) {
                        for (var i=0; i < ns.uniqueId.length; i++) {
                            let v = ns.uniqueId[i].value.toLowerCase();
//console.log(v,f,v.indexOf(f))
                            if (v.indexOf(f) > -1) {
                                return true
                                break;
                            }

                        }
                    }

                }

            };


            $scope.showValueSet = function(vs,filter) {

                if (!filter) {
                    return true
                } else {
                    let f = filter.toLowerCase()
                    if (vs.url && vs.url.toLowerCase().indexOf(filter) >-1) {
                        return true;
                    }

                    if (vs.valueSet && vs.valueSet.description && vs.valueSet.description.toLowerCase().indexOf(filter) >-1) {
                        return true;
                    }

                    if (vs.codeSystems) {
                        for (i=0; i < vs.codeSystems.length;i++) {
                            if (vs.codeSystems[i].toLowerCase().indexOf(f) > -1) {
                                return true;
                                break;
                            }

                        }

                    }

                    console.log(vs)


                    /*


                    if (ns.usage) {
                        let u = ns.usage.toLowerCase()
                        if (u.indexOf(f) > -1) {
                            return true
                        }
                    }

                    if (ns.description) {
                        let d = ns.description.toLowerCase()
                        if (d.indexOf(f) > -1) {
                            return true
                        }
                    }
                    if (ns.uniqueId) {
                        // ns.uniqueId.forEach(function (id) {
                        for (var i=0; i < ns.uniqueId.length; i++) {
                            let v = ns.uniqueId[i].value.toLowerCase();
//console.log(v,f,v.indexOf(f))
                            if (v.indexOf(f) > -1) {
                                return true
                                break;
                            }

                        }
                    }
*/
                }

            };

            $scope.selectIG = function(igCode) {
                clearDetail();
                $scope.showTabsInView = false;
                $scope.activeTabIndex = 0;

                delete $scope.analysis;
                nhipSvc.getIG(igCode).then(
                    function(data) {
                        $scope.artifacts = data.artifacts;

                        $scope.analyse()


                        $scope.tabs = data.tabs;
                        $scope.hashTabs = {};       //for terminilogy ATM

                        //actually, these would be all bettter as an extension in the IG (adding the includeUrl)
                        $scope.tabs.forEach(function(tab){
                            $scope.hashTabs[tab.title] = tab;
                            switch (tab.title) {
                                case 'Terminology' :
                                    tab.includeUrl  = "/includes/terminology.html"
                                    tab.hideContents = tab.contents;
                                    delete tab.contents;
                                    break;
                                case 'Identifiers' :
                                    tab.includeUrl  = "/includes/identifierSystems.html"
                                    tab.hideContents = tab.contents;
                                    delete tab.contents;

                            }
                        });
                        console.log($scope.hashTabs)

                        //add the dynamic tabs...
                        $scope.tabs.splice(3,0,{title:'Resources',includeUrl:"/includes/oneModel.html"});
                        //$scope.tabs.splice(7,0,{title:'Identifier Systems',includeUrl:"/includes/identifierSystems.html",hideContents:"/includes/identifierSystems.html"})
                        $scope.tabs.splice(8,0,{title:'Sample Queries',includeUrl:"/includes/queryBuilder.html"})

                        $scope.showTabsInView = true;

                        //todo note that we may want to dynamically set the url in the samples...
                        nhipSvc.getSamples().then(
                            function(data) {
                                $scope.samples = data.data
                            }
                        )
                    }
                );




               //neet separate capability statement & IG...
               nhipSvc.getCapabilityStatement('hpi').then(
                   function(data) {
                       console.log(data)
                       $scope.capStmt = data.capStmt;
                       $scope.resourceDef = data.resourceDef;
                   }
               )
            };




            //functions for query builder

            $scope.selectSample = function(sample) {
                delete $scope.sampleResult;
                $scope.selectedSample = sample;
                $scope.input.selectedSampleUrl = sample.url;
            };

            $scope.executeSample = function(url) {
               // delete $scope.sampleResult;
                //let url = "http://home.clinfhir.com:8054/baseR4/"+ sample.url
                $http.get(url).then(
                    function(data) {
                        $scope.sampleResult = data
                        console.log(data)


                        $scope.sampleGraph = makeGraph (data.data,'resourcesGraph')



                    },
                    function(err) {
                        $scope.sampleResult = err
                        console.log(err)
                    }
                )
            };

            $scope.fitGraph = function(graph) {
                if (graph) {
                    $timeout(function () {
                        graph.fit();
                    },500)

                }

            };

            $scope.input.qTypes = ["Practitioner","Organization","PractitionerRole","Location"];
            $scope.input.qType = "search";
            $scope.setQUrl = function() {
                $scope.qUrl = $scope.input.type;

                if ($scope.input.qType == 'search'){
                    if ($scope.input.queryString) {
                        $scope.qUrl += "?" +$scope.input.queryString
                    }
                }

                if ($scope.input.qType == 'read'){
                    if ($scope.input.queryId) {
                        $scope.qUrl += "/" +$scope.input.queryId
                    }
                }
            };

            $scope.executeQuery = function(){
                delete $scope.result;
                let url = "http://home.clinfhir.com:8054/baseR4/"+$scope.qUrl
                $http.get(url).then(
                    function(data) {
                        $scope.qResult = data
                        console.log(data)
                        $scope.adhocGraph = makeGraph (data.data,'adHocRresourcesGraph')


                    },
                    function(err) {
                        $scope.qResult = err
                        console.log(err)
                    }
                )

            };

            let makeGraph = function(bundle,id) {
                if (!bundle) {
                    return;
                }
                let options = {bundle:bundle,hashErrors:{}};//,centralResourceId:id}


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
                     //console.log(obj.edges[0])
                    let nodeId = obj.nodes[0];  //get the first node
                    if (nodeId) {
                        let node = vo.visNodes.get(nodeId);
                        //console.log(node)
                        $scope.selectedResource = $scope.selectedResource || {}
                        $scope.selectedResource[id] = node.resource;
                    } else {
                        let edgeId = obj.edges[0];
                        if (edgeId) {
                            let edge = vo.visEdges.get(edgeId);
                            //console.log(edge)
                        }
                    }
                    //console.log(nodeId)

                    $scope.$digest();
                })

                return graph

            }

            $scope.analyse = function(){
                console.log($scope.artifacts);
                nhipSvc.analyseIG($scope.artifacts).then(



                    function (vo) {
                        //this gets called before all the Valuesets have been located - but as it's a reference, it 'catches up'

                        if (! $scope.selectedArtifact) {
                            $scope.input.showAllAnalysis = true;
                        }


                        $scope.analysis = vo;
                        console.log(vo)

                        //wait a second before sorting. This is a  bit scruffy...
                        $timeout(function(){
                            vo.extensions.sort(function(a,b){
                                if (a.url > b.url) {
                                    return 1
                                } else {
                                    return -1
                                }
                            })
                            vo.valueSets.sort(function(a,b){
                                if (a.valueSetUrl > b.valueSetUrl) {
                                    return 1
                                } else {
                                    return -1
                                }
                            })



                            makeVSDownload()

                            console.log(vo)
                        },3000)
                })
            }




            function makeVSDownload() {
                var download = nhipSvc.makeDownload($scope.analysis.valueSets,"valueSet");

                $scope.vsDownloadLinkJsonContent = window.URL.createObjectURL(new Blob([download],
                    {type: "text/text"}));
                var now = moment().format();
                $scope.vsDwnloadLinkJsonName = $scope.input.igCode + '-ValueSet-' + now + '.csv';
            }


            //$scope.input.igCode = "nzRegistry";
            $scope.input.igCode = "nzRegistry";
            $scope.selectIG($scope.input.igCode);

            //for the iframe
            $scope.trustSrc = function(mi) {
                if (mi) {
                    return $sce.trustAsResourceUrl(mi.url);
                }
            };


            $scope.selectExample = function(art) {
                console.log(art);
                delete $scope.selectedExampleXml;
                delete $scope.selectedExampleJson;
                $scope.selectedArtifact = art;

                $('#exampleTree').jstree('destroy');

                nhipSvc.getResource(art).then(
                    function(resource) {
                        console.log(resource)
                        $scope.selectedExampleJson = resource;

                        $scope.exampleTreeData = v2ToFhirSvc.buildResourceTree(resource);
                        $timeout(function(){
                                $scope.collapseAll()
                            }
                            ,1000
                        );


                        nhipSvc.getResource(art,true).then(
                            function(data) {
                                $scope.selectedExampleXml = data;
                            },function(err) {
                                console.log(err)
                            }
                        );




                    })

            };


            let drawExampleTree = function(resource) {
                //show the tree structure of this resource (adapted from scenario builder)
                $('#exampleTree').jstree('destroy');
                $('#exampleTree').jstree(
                    {'core': {'multiple': false, 'data': $scope.exampleTreeData, 'themes': {name: 'proton', responsive: true}}}
                ).on('changed.jstree', function (e, data) {
                    //seems to be the node selection event...

                    //console.log(data)
                    if (data.node) {

                        //opens or closes the node and all children on select
                        if (data.node.state.opened) {
                            $("#exampleTree").jstree("close_all","#"+data.node.id); // for example :)
                        } else {
                            $("#exampleTree").jstree("open_all","#"+data.node.id); // for example :)
                        }



                        //$('#resourceTree')

                        $scope.selectedNode = data.node;



                    }
                })



            };


            $scope.expandAll = function(){
                $scope.exampleTreeData.forEach(function (item) {
                    item.state.opened = true;
                });

                drawExampleTree();
            };

            $scope.collapseAll = function() {
                $scope.exampleTreeData.forEach(function (item) {
                    item.state.opened = false;
                });
                $scope.exampleTreeData[0].state.opened=true;
                drawExampleTree();
            };


            //mi = more information
            $scope.selectMI = function(mi) {
                $scope.mi = mi;
            };

            function clearDetail() {
                delete $scope.selectedArtifact;
                delete $scope.selectedResource;
                delete $scope.selectedNode;
                delete $scope.selectedED;
                delete $scope.tasks;
                delete $scope.mi;
                delete $scope.arDocs;

                delete $scope.selectedExampleJson;
                $('#exampleTree').jstree('destroy');
                $('#resourceTree').jstree('destroy');
            }
            //get the resource references by the artifact (artifact is the entry in the IG)
           // $scope.showWaiting = true;
            $scope.selectItem = function(typ,art) {
                clearDetail();


                nhipSvc.getDocsForItem(art).then(
                    function(arDocs) {
                        console.log(arDocs);
                        $scope.arDocs = arDocs;
                    }
                );


                //$scope.mi={url:'about:blank'}
                $scope.showWaiting = true;
                let resource = nhipSvc.getResource(art).then(
                    function(resource) {

                        //may want different logic depending on type
                        $scope.selectedArtifact = art;
                        $scope.selectedResource = resource;



                        switch (resource.resourceType) {

                            case 'NamingSystem' :

                                break;
                            case 'StructureDefinition' :
                                //a LM
                                $scope.input.showAllAnalysis = false;
                                $scope.baseTypeForModel = nhipSvc.getModelBaseType($scope.selectedResource);
                                $scope.treeData = logicalModelSvc.createTreeArrayFromSD($scope.selectedResource);  //create a new tree

                                //let canonicalUrl = $scope.selectedResource.url;
                                //let capStmtElement

                                //collapse all but the root...
                                $scope.treeData.forEach(function(node){
                                    node.state = node.state || {}
                                    if (node.parent=='#'){
                                        node.state.opened = true;
                                    } else {
                                        node.state.opened = false;
                                    }

                                });

                                drawTree();

/* - not using tasks ATM
                                nhipSvc.getTasksForModel($scope.treeData,$scope.selectedResource.id).then(
                                    function (tasks) {
                                        $scope.tasks =tasks;
                                    }
                                );

*/
                                break;
                        }

                    }, function(err) {
                        alert('resource not found')
                    }
                ).finally(
                    function () {
                        $scope.showWaiting = false;
                     //   $scope.analyse()
                    }
                )
            };


            $scope.showTableElement = function(row){
                //console.log(row);
                if (row.data && row.data.edStatus == 'excluded') {
                    return false
                } else {
                    return true;
                }

            }

            $scope.showAccordianGroup = function(group){
                $scope.selectedGroup = group;
                //console.log(group)
            };

            $scope.showVSBrowserDialog = {};


            //load the valueset browser. Pass in the url of the vs - the expectation is that the terminology server
            //can use the $expand?url=  syntax
            $scope.viewVS = function(uri) {
                let ar = uri.split('|');    //the version prevents expansion from working
                $scope.showVSBrowserDialog.open(null,ar[0]);
            };



            function drawTree() {

                $('#lmTreeView').jstree('destroy');
                $('#lmTreeView').jstree(
                    {'core': {'multiple': false, 'data': $scope.treeData, 'themes': {name: 'proton', responsive: true}}}
                ).on('changed.jstree', function (e, data) {
                    //seems to be the node selection event...

                    if (data.node) {
                        $scope.selectedNode = data.node;
                        $scope.selectedED = logicalModelSvc.getEDForPath($scope.selectedResource,data.node)
                        console.log($scope.selectedED)
                        console.log(data.node)
                    }

                    $scope.$digest();       //as the event occurred outside of angular...

                }).on('redraw.jstree', function (e, data) {

                    //ensure the selected node remains so after a redraw...
                    if ($scope.treeIdToSelect) {
                        $("#lmTreeView").jstree("select_node", "#"+$scope.treeIdToSelect);
                        delete $scope.treeIdToSelect
                    }

                }).on('open_node.jstree',function(e,data){

                    //set the opened status of the scope property to the same as the tree node so we can remember the state...
                    $scope.treeData.forEach(function(node){
                        if (node.id == data.node.id){
                            node.state.opened = data.node.state.opened;
                        }
                    });
                    $scope.$digest();
                }).on('close_node.jstree',function(e,data){

                    //set the opened status of the scope propert to the same as the tree node so we can remember the state...
                    $scope.treeData.forEach(function(node){
                        if (node.id == data.node.id){
                            node.state.opened = data.node.state.opened;
                        }
                    })
                    $scope.$digest();
                });


            }

        }
    );

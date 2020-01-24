angular.module("sampleApp")
    .controller('nhipCtrl',
        function ($scope,$firebaseAuth,$uibModal,modalService,nhipSvc,logicalModelSvc,$http,
                  v2ToFhirSvc,$sce,appConfigSvc,$localStorage,$timeout,$location) {

            $scope.selectedGroup = 'logical';       //initial group to display
            $scope.input = {};
            $scope.input.mustSupportOnly = false;

            appConfigSvc.setServerType('conformance','http://home.clinfhir.com:8054/baseR4/');
            appConfigSvc.setServerType('data','http://home.clinfhir.com:8054/baseR4/');       //set the data server to the same as the conformance for the comments
            //appConfigSvc.setServerType('terminology',"http://home.clinfhir.com:8054/baseR4/");
            appConfigSvc.setServerType('terminology',"https://ontoserver.csiro.au/stu3-latest/");

            $scope.appConfigSvc = appConfigSvc;

            $http.post('/stats/login',{module:"HPI"}).then(
                function(data){

                },
                function(err){
                    console.log('error accessing clinfhir to register access',err)
                }
            );




            $scope.clinicalView = $localStorage.clinicalView ;//false;    //if true then some tabs hidden
            $scope.setClinicalView = function(state) {
                $localStorage.clinicalView = state
            }


            $scope.rootForDataType = "http://hl7.org/fhir/datatypes.html#"
            //the capability statement (that has the search's supported). Not sure if there should only be a single one or not...
            $http.get("http://home.clinfhir.com:8054/baseR4/CapabilityStatement/nhip-capstmt").then(
                function(data) {
                    $scope.nhipCapStmt = data.data;
                }
            );


            $scope.getExtensionFSH = function(id) {
                console.log(id)
            }

            $scope.selectCodeSystem = function(res) {
                delete $scope.selectedCodeSystem;

                if (res.canUrl) {
                    nhipSvc.getTerminologyResourceByCanUrl('CodeSystem',res.canUrl).then(
                        function(resource){
                            $scope.selectedCodeSystem = resource
                        },
                        function(err) {
                            alert ("This Code system ("+res.canUrl+") is not on the terminology server")
                        }
                    )
                } else {
                    alert("There is no canonical Url in the ImplementationGuide resource")
                }


                console.log(res)
            };




            $scope.showNamingSystemFilter = function(ns,filter) {

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
                    let f = filter.toLowerCase();

                    if (vs.valueSetUrl && vs.valueSetUrl.toLowerCase().indexOf(filter) >-1) {
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

                }

            };

            $scope.sendComment = function(type){
                $uibModal.open({
                    templateUrl: "/modalTemplates/sendComment.html",
                    //size : 'lg',
                    controller: 'sendCommentCtrl',
                    resolve: {
                        vo : function() {
                            return {
                                resourceType: $scope.resourceType
                            }
                        },
                        profileUrl : function() {
                            //if this is a profiled reference...
                            return $scope.profileUrlInReference;
                        }
                    }
                });
            };

            $scope.selectIG = function(igCode) {
                clearDetail();
                $scope.showTabsInView = false;
                $scope.activeTabIndex = 0;

                delete $scope.analysis;
                nhipSvc.getIG(igCode).then(
                    function(data) {
                        $scope.artifacts = data.artifacts; //artifacts are the resources in the IG. Also returns pages.

                        analyse();   //pull out extensions and terminology


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


                        //todo - add an extension to the IG to insert the dynamic tabs...
                        $scope.tabs.splice(3,0,{title:'Models / Profiles',includeUrl:"/includes/oneModel.html"});
                        $scope.tabs.splice(8,0,{title:'Quality',includeUrl:"/includes/quality.html"})
                        $scope.tabs.splice(8,0,{title:'Sample Queries',includeUrl:"/includes/queryBuilder.html"})


                        $scope.showTabsInView = true;


                        //get all the NamingSystem resources off the server.
                        //We do need the full NS for the display, so read them all, then filter to the ones in the IG
                        // May want a more elegant way...

                        //first, create a hash of the NS in the IG
                        let hashNS = {};
                        $scope.artifacts.namingsystem.forEach(function (res) {
                            if (res.reference && res.reference.reference) {
                                let ar = res.reference.reference.split('/')
                                let id = ar[ar.length-1]
                                hashNS[id] = 'x'
                            }

                        })

                        $http.get("http://home.clinfhir.com:8054/baseR4/NamingSystem?_count=100").then(
                            function(data) {
                                $scope.namingSystem = [];

                                data.data.entry.forEach(function (entry) {
                                    if (hashNS[entry.resource.id]) {
                                        $scope.namingSystem.push(entry.resource)
                                    }

                                });

                                $scope.namingSystem.sort(function(a,b){
                                    if (a.description > b.description) {
                                        return 1
                                    } else {
                                        return -1
                                    }
                                })
                            }
                        );



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



                        $scope.sampleGraph = makeGraph (data.data,'resourcesGraph')



                    },
                    function(err) {
                        $scope.sampleResult = err

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

                        $scope.adhocGraph = makeGraph (data.data,'adHocRresourcesGraph')


                    },
                    function(err) {
                        $scope.qResult = err

                    }
                )

            };

            let makeGraph = function(bundle,id) {
                if (!bundle) {
                    return;
                }
                let options = {bundle:bundle,hashErrors:{}};//,centralResourceId:id}
                options.serverRoot =  appConfigSvc.getCurrentConformanceServer().url;//  "http://home.clinfhir.com:8054/baseR4/"

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

            let analyse = function(){

                //pulls out coded data & extensions
                nhipSvc.analyseIG($scope.artifacts).then(

                    function (vo) {
                        //this gets called before all the Valuesets have been located - but as it's a reference, it 'catches up'
                        // {extensions: valueSets}
                        if (! $scope.selectedArtifact) {
                            $scope.input.showAllAnalysis = true;
                        }


                        $scope.analysis = vo;
                       // $scope.quality = quality;
                        console.log(vo.quality)


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

                delete $scope.selectedExampleXml;
                delete $scope.selectedExampleJson;
                $scope.selectedArtifact = art;

                $('#exampleTree').jstree('destroy');

                nhipSvc.getResource(art).then(
                    function(resource) {

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
                delete $scope.selectedProfile;
                delete $scope.selectedProfileHeader;
                delete $scope.selectedNode;
                delete $scope.selectedED;
                delete $scope.tasks;
                delete $scope.mi;
                delete $scope.arDocs;
                delete $scope.input.selectedExtFSH;
                delete $scope.baseTypeForModel

                delete $scope.selectedExampleJson;
                $('#exampleTree').jstree('destroy');
                $('#resourceTree').jstree('destroy');
            }
            //get the resource references by the artifact (artifact is the entry in the IG)
           // $scope.showWaiting = true;
            $scope.selectItem = function(typ,art) {
                clearDetail();


                //not using this right now, but may be useful in the future...
                nhipSvc.getDocsForItem(art).then(
                    function(arDocs) {

                        $scope.arDocs = arDocs;
                    }
                );

                //if there's a profile against this artifact (which must be a logical model), then retrieve it

                if (art.profileId) {


                    nhipSvc.getResourceById("StructureDefinition",art.profileId).then(
                        function(data) {
                            $scope.selectedProfile = data;
                            $scope.selectedProfileHeader = angular.copy(data);
                            delete $scope.selectedProfileHeader.snapshot;
                            delete $scope.selectedProfileHeader.differential;
                            delete $scope.selectedProfileHeader.extension;
                            delete $scope.selectedProfileHeader.mapping;
                            delete $scope.selectedProfileHeader.contact;
                            makeProfileTree(data);

                        }
                    )

                }

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

                    }
                )
            };


            $scope.showTableElement = function(row){

                if (row.data && row.data.edStatus == 'excluded') {
                    return false
                } else {
                    if ($scope.input.mustSupportOnly) {
                        if (row.data.mustSupport) {
                            return true
                        } else {
                            return false
                        }
                    } else {
                        return true;
                    }

                }

            }

            $scope.showAccordianGroup = function(group){
                $scope.selectedGroup = group;

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

                        //console.log($scope.selectedED)


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

            $scope.selectProfileElement = function(ele) {
                $scope.selectedProfileElement = ele
                delete $scope.selectedProfileElement.constraint;
                delete $scope.selectedProfileElement.mapping;

            }

            function makeProfileTree(SD) {
                return;
              /*  $scope.arV2 = profileDiffSvc.generateV2MapFromSD(SD);


                createGraphOfIG($scope.currentIG);


                delete $scope.errorsInLM;
                //-------- logical model
                profileDiffSvc.makeLMFromProfile(angular.copy(SD)).then(
                    function(vo) {

                        //display any errors...
                        if (vo.errors.length) {
                            $scope.errorsInLM = vo.errors;
                        }

                        $('#logicalTree').jstree('destroy');
                        $('#logicalTree').jstree(
                            {
                                'core': {
                                    'multiple': false,
                                    'data': vo.treeData,
                                    'themes': {name: 'proton', responsive: true}
                                }
                            }
                        ).on('select_node.jstree', function (e, data) {
                            if (data.node && data.node.data) {


                                $scope.selectedElementInLM = data.node.data.ed;

                                //create a display version of the element, removing the stuff I added...
                                $scope.selectedElementInLMDisplay = angular.copy(data.node.data.ed);
                                delete $scope.selectedElementInLMDisplay.myMeta;
                                $scope.selectedED1 = data.node.data.ed;

                                $scope.$broadcast("LMElementSelected",data.node.data.ed);


                                $scope.$digest();       //as the event occurred outside of angular...

                            }
                        })
                    }
                );
*/
                //------- raw model
                var treeData = logicalModelSvc.createTreeArrayFromSD(angular.copy(SD))



                $('#profileTree').jstree('destroy');
                $('#profileTree').jstree(
                    {'core': {'multiple': false, 'data': treeData, 'themes': {name: 'proton', responsive: true}}}
                ).on('changed.jstree', function (e, data) {
                    //seems to be the node selection event...
                    delete $scope.selectedED;

                    if (data.node) {

                        $scope.selectedED = data.node.data.ed;
                        $scope.$digest();       //as the event occurred outside of angular...

                    }
                })
            }

        }
    );

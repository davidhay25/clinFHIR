angular.module("sampleApp")
    .controller('nhipCtrl',
        function ($scope,$firebaseAuth,$uibModal,modalService,nhipSvc,logicalModelSvc,$http,$sce,appConfigSvc,v2ToFhirSvc,$timeout) {

            $scope.selectedGroup = 'logical';       //initial group to display
            $scope.input = {};

            appConfigSvc.setServerType('conformance','http://home.clinfhir.com:8054/baseR4/');
            appConfigSvc.setServerType('data','http://home.clinfhir.com:8054/baseR4/');       //set the data server to the same as the conformance for the comments
            //appConfigSvc.setServerType('terminology',"http://home.clinfhir.com:8054/baseR4/");
            appConfigSvc.setServerType('terminology',"https://ontoserver.csiro.au/stu3-latest/");

            $scope.appConfigSvc = appConfigSvc;

            //the capability statement (that has the search's supported). Not sure if there should only be a single one or not...
            $http.get("http://home.clinfhir.com:8054/baseR4/CapabilityStatement/nhip-capstmt").then(
                function(data) {
                    $scope.nhipCapStmt = data.data;
                }
            );

            $scope.selectIG = function(igCode) {
                clearDetail()
                nhipSvc.getIG(igCode).then(
                    function(data) {
                        $scope.artifacts = data;

                        console.log(data)

                    }
                );
            };

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

                delete $scope.selectedExampleJson;
                $('#exampleTree').jstree('destroy');
                $('#resourceTree').jstree('destroy');
            }
            //get the resource references by the artifact (artifact is the entry in the IG)
            $scope.showWaiting = true;
            $scope.selectItem = function(typ,art) {
                clearDetail();

                //$scope.mi={url:'about:blank'}
                $scope.showWaiting = true;
                let resource = nhipSvc.getResource(art).then(
                    function(resource) {

                        //may want different logic depending on type
                        $scope.selectedArtifact = art;
                        $scope.selectedResource = resource;
                        //console.log(resource)

                        switch (resource.resourceType) {

                            case 'NamingSystem' :

                                break;
                            case 'StructureDefinition' :
                                $scope.baseTypeForModel = nhipSvc.getModelBaseType($scope.selectedResource);
                                $scope.treeData = logicalModelSvc.createTreeArrayFromSD($scope.selectedResource);  //create a new tree

                                console.log($scope.treeData);
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


                                nhipSvc.getTasksForModel($scope.treeData,$scope.selectedResource.id).then(
                                    function (tasks) {
                                        $scope.tasks =tasks;
                                    }
                                );


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

angular.module("sampleApp")
    .controller('nhipCtrl',
        function ($scope,$firebaseAuth,$uibModal,modalService,nhipSvc,logicalModelSvc) {

            $scope.selectedGroup = 'logical';       //initial group to display
            $scope.input = {};


            $scope.selectIG = function(igCode) {
                console.log(igCode)
                nhipSvc.getIG(igCode).then(
                    function(data) {
                        $scope.artifacts = data;
                        console.log($scope.artifacts)
                    }
                );
            };

            $scope.input.igCode = "nhip";
            $scope.selectIG($scope.input.igCode);


            //get the resource references by the artifact (artifact is the entry in the IG)
            $scope.showWaiting = true;
            $scope.selectItem = function(typ,art) {
                $scope.selectedArtifact = art;
                delete $scope.selectedResource;
                delete $scope.selectedNode;
                delete $scope.selectedED
                delete $scope.tasks;

                let resource = nhipSvc.getResource(art).then(
                    function(resource) {
                        //may want different logic depending on type
                        $scope.selectedResource = resource;
                        console.log(resource)

                        switch (resource.resourceType) {
                            case 'StructureDefinition' :
                                $scope.treeData = logicalModelSvc.createTreeArrayFromSD($scope.selectedResource);  //create a new tree

                                //collapse all but the root...
                                $scope.treeData.forEach(function(node){
                                    node.state = node.state || {}
                                    if (node.parent=='#'){
                                        node.state.opened = true;
                                    } else {
                                        node.state.opened = false;
                                    }

                                })

                                drawTree();
                                nhipSvc.getTasksForModel($scope.treeData,$scope.selectedResource.id).then(
                                    function (tasks) {
                                        $scope.tasks =tasks;
                                    }
                                )


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



            $scope.showAccordianGroup = function(group){
                $scope.selectedGroup = group;
                console.log(group)
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

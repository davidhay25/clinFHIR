angular.module("sampleApp").controller('packageViewerCtrl',
    function ($scope,$http,packageViewerSvc) {

        $scope.input = {}

        $scope.terminologyServer = {url:"https://r4.ontoserver.csiro.au/fhir/"}

        $http.get('/registry/list').then(
            function (data) {
                $scope.allPackages = data.data;
                console.log(data.data)
            }
        )

        $scope.selectPackage = function(package) {
            let url = "/registry/" + package.name + "/" + package.version;

            $http.get(url).then(
                function (data) {
                    $scope.package = data.data;
                    console.log(data.data)
                }
            )
        }

        function clearAll() {
            delete $scope.expandedVS;
            delete $scope.expandVSError;
            delete $scope.expandUrl;
            //delete $scope.selectedResource;
        }

        $scope.uploadVS = function(vs) {
            if (vs.id) {
                let url = $scope.terminologyServer.url + "ValueSet" + "/" + vs.id;
                $http.put(url,vs).then(
                    function (data) {
                        alert("ValueSet: " + vs.url + " has been uploaded")
                    },
                    function (err) {
                        alert(angular.toJSON(err.data))
                    }
                )
            } else {
                alert("A ValueSet miust have an id to be uploaded")
            }

        }

        $scope.VSExpand = function (vs,filter) {
            clearAll();
            let url = $scope.terminologyServer.url + "ValueSet/$expand?url=" + vs.url;
            if (filter) {
                url += "&filter=" + filter
            }
            $scope.expandUrl = url
            $http.get(url).then(
                function(data) {
                    $scope.expandedVS = data.data
                },
                function(err) {
                    $scope.expandVSError = err.data
                }
            )
        }

        $scope.selectItem = function (item) {
            delete $scope.selectedResource;
            console.log(item)
            clearAll()
            $scope.selectedItem = item;
            let url = "/registry/" + $scope.package.name + "/" + $scope.package.version + "/" + item.name;
            $http.get(url).then(
                function (data) {
                    $scope.selectedResource = data.data;

                    if (item.kind == 'extension') {
                        //generate a summary of the contents of an extension for the display
                        $scope.extensionSummary = packageViewerSvc.extensionSummary($scope.selectedResource)
                    }


                    if (item.type == "StructureDefinition") {
                        packageViewerSvc.makeLogicalModel(data.data).then(
                            function (model) {
                                console.log(model)
                                //$scope.allElements = model

                                $scope.treeData = packageViewerSvc.createTreeArray(data.data)
                                drawTree();

                            },
                            function (err) {
                                console.log(err)
                            }
                        )
                    }

                }
            )
        }

        $scope.showElementPath = function (path) {

            let ar = path.split('.');
            let disp = ar[ar.length - 1]

            for (var i = 0; i < ar.length - 1; i++) {
                //disp = "__" + disp
                disp = "    ." + disp
            }

            return disp;
        }

        //hl7.fhir.uv.ips#1.0.0


        function drawTree() {

            $('#treeView').jstree('destroy');
            $('#treeView').jstree(
                {'core': {'multiple': false, 'data': $scope.treeData, 'themes': {name: 'proton', responsive: true}}}
            ).on('changed.jstree', function (e, data) {
                //seems to be the node selection event...

                if (data.node) {
                    $scope.selectedNode = data.node;
                    $scope.selectedED = data.node.data.ed
                }

                $scope.$digest();       //as the event occurred outside of angular...

            }).on('redraw.jstree', function (e, data) {

                //ensure the selected node remains so after a redraw...
                if ($scope.treeIdToSelect) {
                    $("#lmTreeView").jstree("select_node", "#" + $scope.treeIdToSelect);
                    delete $scope.treeIdToSelect
                }

            });


        }
    })
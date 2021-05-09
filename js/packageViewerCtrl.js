angular.module("sampleApp").controller('packageViewerCtrl',
    function ($scope,$http,packageViewerSvc,$uibModal,$timeout) {

        $scope.input = {}

        $scope.terminologyServer = {url:"https://r4.ontoserver.csiro.au/fhir/"}

        $http.get('/registry/list').then(
            function (data) {
                $scope.allPackages = data.data;
                console.log(data.data)
            }
        )

        //load a package from the server...
        $scope.selectPackage = function(package) {

            packageViewerSvc.loadPackage(package.name,package.version).then(
                function (package) {
                    $scope.package = package;
                }, function (err) {
                    alert ("Package could not be loaded")
                }
            )
            let url = "/registry/" + package.name + "/" + package.version;
        }

        //temp load us core
        $scope.selectPackage({name:'hl7.fhir.us.core',version:'current'})



        function clearAll() {
            delete $scope.expandedVS;
            delete $scope.expandVSError;
            delete $scope.expandUrl;

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
                alert("A ValueSet must have an id to be uploaded")
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

        $scope.selectValueSetDEP = function(binding) {
            //find the item in the package that corresponds to the binding.vs
            let ar = $scope.package.grouped.ValueSet.filter(item => item.url == binding.valueSet)

            if (ar.length == 1) {
                let item = ar[0];       //the package item that has the ValueSet with this url...
                $scope.selectItem(ar[0])
                //$scope.selectedItem = ar[0]
            } else {
                alert("Sorry, this VS is not in the package. Working on it...")
            }

            console.log(ar)



        }

        $scope.selectItem = function (item) {
            delete $scope.selectedResource;
            console.log(item)
            clearAll()
            $scope.selectedItem = item;


            let url = "/registry/" + $scope.package.name + "/" + $scope.package.version + "/" + item.name;

            //packageViewerSvc.getResourceByUrl()
            $http.get(url).then(
                function (data) {
                    $scope.selectedResource = data.data;

                    if (item.kind == 'extension') {
                        //generate a summary of the contents of an extension for the display
                        $scope.extensionSummary = packageViewerSvc.extensionSummary($scope.selectedResource)
                    }

                    if (item.kind == 'resourceprofile') {
                        //default to showing bindings...
                        let graphData = packageViewerSvc.makeGraph(item,{showBindings : true});
                        $scope.redrawGraph()

                        //
                    }

                    if (item.type == "StructureDefinition") {
                        packageViewerSvc.makeLogicalModel(data.data).then(
                            function (model) {
                                console.log(model)
                                //$scope.allElements = model

                                if (item.kind == 'resourceprofile') {
                                    $scope.treeData = packageViewerSvc.createTreeArray(data.data)
                                    drawTree('resourceProfileTreeView');
                                } else {
                                    $scope.treeData = packageViewerSvc.createTreeArray(data.data)
                                    drawTree('datatypeProfileTreeView');
                                }


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


        $scope.edText = function(ed){
            let text = "";
            text += ed.short || ""  ;
            text += "<br/>"
            text += ed.definition || "";
            text += "<br/>"
            text += ed.comment || "";

            return text
        }

        $scope.showTableLine = function(ed) {
            let ar = ed.path.split('.')
            if (ar.length > 1 && ['id','meta','implicitRules','contained','extension','modifierExtension'].indexOf(ar[1]) > -1) {
                return false
            } else {
                return true;
            }
        }

        $scope.selectValueSet = function(binding) {
            $uibModal.open({
                templateUrl: 'modalTemplates/pvViewVS.html',
                size: 'lg',
                controller: function($scope,$http,binding,server,packageViewerSvc){
                    $scope.binding = binding

                    $scope.uploadVS = function() {
                        delete $scope.expandVSError;

                        packageViewerSvc.getResourceByUrl(binding.valueSet,'valueset').then(
                            function(resource) {
                                packageViewerSvc.uploadVS(resource)
                            },
                            function(err) {
                                alert ("Sorry, this ValueSet is neither in the Package or FHIR Core")
                            }
                        )
                    }

                    $scope.expand = function(filter) {
                        let vsUrl = binding.valueSet;
                        let ar = vsUrl.split('|');      //todo do need to think about url versioning at some point
                        let url = server.url + "ValueSet/$expand?url=" + ar[0];
                        if (filter) {
                            url += "&filter=" + $scope.filter
                        }
                        $scope.expandUrl = url
                        $scope.showWaiting = true
                        $http.get(url).then(
                            function(data) {
                                $scope.expandedVS = data.data
                            },
                            function(err) {

                                $scope.expandVSError = err
                            }
                        ).finally(
                            function(){
                                $scope.showWaiting = false
                            }
                        )
                    }


                },
                backdrop: 'static',
                resolve : {
                    binding: function () {          //the default config
                        return binding;
                    },
                    server : function() {
                        return $scope.terminologyServer;
                    }
                 }})

    }

    $scope.redrawGraph = function() {
        let options = {showBindings:$scope.input.showBindings}
        options.showExtensions = $scope.input.showExtensions;
        options.showReferences = $scope.input.showReferences;

        let graphData = packageViewerSvc.makeGraph($scope.selectedItem,options);
        drawGraph(graphData)
    }


    function drawGraph(graphData) {
        delete $scope.selectedGraphItem;
        var container = document.getElementById('profileGraph');
        let options = {
            physics: {
                enabled: true,
                barnesHut: {
                    gravitationalConstant: -10000,
                    centralGravity: .3,
                    springConstant: .04
                }
            },
            layout: {
                randomSeed: 966706  //to ensure the initial layout is always the same - $scope.subGraph.getSeed()
            }
        };
        $scope.profileGraph = new vis.Network(container, graphData, options);

        $scope.profileGraph.on("click", function (obj) {

            let nodeId = obj.nodes[0];  //get the first node
            if (nodeId) {
                //a node was clicked
                var node = graphData.nodes.get(nodeId);

                var item = node.item;
                if (item) {

                    $scope.selectedGraphItem = item
                    $scope.$digest();

                }
            } else {
                let edgeId = obj.edges[0]
                if (edgeId) {
                    let edge = graphData.edges.get(edgeId);
                    $scope.selectEdge(edge)
                    $scope.$digest();
                }
            }

        });


    }
    $scope.fitGraph = function(){
        if ($scope.profileGraph) {
            $timeout(function(){$scope.profileGraph.fit()},500)
        }

    };

    function drawTree(elementId) {
        let nodeId = '#'+elementId;
        $(nodeId).jstree('destroy');
        $(nodeId).jstree(
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
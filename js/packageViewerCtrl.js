angular.module("sampleApp").controller('packageViewerCtrl',
    function ($scope,$http,packageViewerSvc,$uibModal,$timeout,$location,$sanitize) {

        $scope.input = {}

        $scope.terminologyServer = {url:"https://r4.ontoserver.csiro.au/fhir/"}

        function sortAllPackages() {
            $scope.allPackages.sort(function(a,b){
                    if (a.display > b.display) {
                        return -1
                    } else {
                        return 1
                    }
                }

            )
        }


        $http.post('/stats/login',{module:"packView",servers:{terminology:$scope.terminologyServer.url}}).then(
            function(data){

            },
            function(err){
                console.log('error accessing clinfhir to register access',err)
            }
        );


        $http.get('/registry/list').then(
            function (data) {
                $scope.allPackages = data.data;
                sortAllPackages()

            }
        )

        $scope.isSame = function(item) {
            if ($scope.selectedItem) {
                if ((item.name == $scope.selectedItem.name) && (item.display == $scope.selectedItem.display) )
                    return true;
            }

        }

        //retrieve a package from the registry or the IG and download to the server...
        $scope.loadPackage = function (name,version) {
            //enter the name & version, then download from the registry - or build environment...
            if (name && version) {
                // the name & version were supplied - proceed directly to download...
                performDownload(name,version);
            } else {
                // we need to get the name & version from the user...
                $uibModal.open({
                    templateUrl: 'modalTemplates/pvEnterPackageName.html',
                    size: 'lg',
                    controller: function ($scope) {
                        $scope.input = {fromBuild : false}

                        $scope.retrieveManifest = function(url) {
                            packageViewerSvc.retrieveManifestFromBuild(url).then(
                                function (manifest) {
                                    $scope.input.name = manifest.name;
                                    $scope.input.version = manifest.version;

                                },
                                function (err) {
                                    alert ('Cannot retrieve manifest, is this the url to the IG?')
                                }
                            )
                        }

                        $scope.canDownload = function() {
                            if ($scope.input.fromBuild) {
                                if ($scope.input.url && $scope.input.name) {
                                    return true
                                } else {
                                    return false
                                }
                            }

                            if (!$scope.input.fromBuild) {
                                if ($scope.input.version && $scope.input.name) {
                                    return true
                                } else {
                                    return false
                                }
                            }
                        }
                    }
                }).result.then(
                    function(vo) {

                        if (vo.fromBuild) {
                            //From the build environment. a name and url were entered
                            $scope.downloadingFromRegistry = vo;
                            packageViewerSvc.downloadFromBuild(vo.url,vo.name,vo.version).then(
                                function (data) {
                                    //data is {name: version:}
                                    //add to the list of packages
                                    let version = data.version; //'current';        //build downloads are always current
                                    $scope.allPackages.push({name:data.name,version:version,display:data.name + '#' + version})
                                    setDropDown(data.name,version)
                                    sortAllPackages()
                                    $scope.selectPackage(data);     //display the downloaded package
                                  /*  $timeout(
                                        function() {
                                            setDropDown(name,version)
                                        },1000)
                                    */
                                }, function(err) {
                                    alert("The package could not be downloaded. Is the Url correct?")
                                }
                            ).finally(
                                function(){
                                    delete $scope.downloadingFromRegistry;
                                }
                            )

                        } else {
                            //From the registry. a name and version was entered
                            let name = vo.name ;
                            let version = vo.version;
                            performDownload(name,version);
                        }

                    }, function(){

                    })
            }



            function performDownload(name,version) {
                clearAll();
                $scope.downloadingFromRegistry = {name:name,version:version};
                packageViewerSvc.downloadPackage(name,version).then(
                    function(vo){


                        //The packageSummary is returned whether it has to be downloaded first, or not...
                        if (vo.wasDownloaded) {
                            //add to the list of packages
                            $scope.allPackages.push({name:name,version:version,display:name + '#' + version})
                            sortAllPackages()
                        }
                        $scope.selectPackage({name:name,version:version})
                    },
                    function (message){
                        //Usually means the package has already been downloaded
                        //not currently used
                        alert(message)

                    }
                ).finally(function(){
                    delete $scope.downloadingFromRegistry ;
                })
            }
        }

        //load a package from the server (ie assume that it has already been downloaded) ...
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


        // ============================    The module can be invoked passing across the package...
        var hash = $location.hash();

        if (hash) {

            let ar = hash.split('|')
            if (ar.length !== 2) {
                alert("The package details must be in the format {name}|{version}. No package has been selected")
                return;
            }
            let name = ar[0]
            let version = ar[1]

            //invoke the loadPackage function passing across the name#version. This function
            //will select the package if downloaded, or download it if not...
            $scope.loadPackage(name,version)

        } else {
            //temp during debugging
            let name = 'hl7.fhir.uv.ips';
            let version = "1.0.0"
            $scope.selectPackage({name:name,version:version})
            $timeout(
                function() {
                    setDropDown(name,version)
                },1000)

        }

        function setDropDown(name,version) {
            $scope.allPackages.forEach(function (package){
                if (package.name == name && package.version == version) {
                    $scope.input.package = package;
                }
            })
        }

        function clearAll() {
            delete $scope.expandedVS;
            delete $scope.expandVSError;
            delete $scope.expandUrl;

        }


        //upload a ValueSet to the Terminology server...
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

        //upload a CodeSystem to the Terminology server...
        $scope.uploadCS = function(cs) {
            if (cs.id) {
                let url = $scope.terminologyServer.url + "CodeSystem" + "/" + cs.id;
                $http.put(url,cs).then(
                    function (data) {
                        alert("CodeSystem: " + cs.url + " has been uploaded")
                    },
                    function (err) {
                        alert(angular.toJSON(err.data))
                    }
                )
            } else {
                alert("A CodeSystem must have an id to be uploaded")
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





        }

        $scope.getExample = function(item) {
            delete $scope.selectedExample
            delete $scope.selectedExampleXml
            let url = "/registry/example/" + $scope.package.name + "/" + $scope.package.version + "/" + item.filename;
            //packageViewerSvc.getResourceByUrl()
            $http.get(url).then(
                function (data) {
                    $scope.selectedExample = data.data;
                    drawResourceTree($scope.selectedExample)

                    //get the XML version
                    let url = $http.post('transformXML',data.data).then(
                        function (data) {

                            $scope.selectedExampleXml = vkbeautify.xml(data.data);

                        }
                    )



                }
            )
        }

        function drawResourceTree(resource) {
            let treeData = packageViewerSvc.buildResourceTree(resource);

            //show the tree of this version
            $('#resourceTreeViewXXX').jstree('destroy');
            $('#resourceTreeViewXXX').jstree(
                {'core': {'multiple': false, 'data': treeData, 'themes': {name: 'proton', responsive: true}}}
            );
        }



        $scope.selectItem = function (item) {
            delete $scope.selectedResource;
            delete $scope.SD;

            clearAll()
            $scope.selectedItem = item;
            switch (item.kind) {
                case "example" :

                    //examples are special...
                    delete $scope.selectedExample;
                    delete $scope.selectedExampleXml;
                    break;



                default :
                    //default is to assume that the item refers to a single file (item.name) that can be retrieved from the server...
                    let url = "/registry/" + $scope.package.name + "/" + $scope.package.version + "/" + item.name;
                    //packageViewerSvc.getResourceByUrl()
                    $http.get(url).then(
                        function (data) {
                            $scope.selectedResource = data.data;

                            if (item.kind == 'misc') {
                                delete $scope.selectedExample;
                                $scope.selectedExample = data.data;

                            }

                            if (item.kind == "capabilitystatement") {
                                //I copied the code from the server query, which uses this object...
                                $scope.conformance = data.data;
                            }

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

                                //Add to scope so can create snapshot list
                                $scope.SD = data.data

                                packageViewerSvc.makeLogicalModel(data.data).then(
                                    function (model) {


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


    //to support the display of types in a capability statement
    //todo - if this gets too big, consider a separate controller...
    $scope.showType = function(type) {
        $scope.selectedType = type;
    }

    //https://stackoverflow.com/questions/22533491/angularjs-how-can-i-ignore-certain-html-tags

    $scope.clean = function(string) {
        try {
            return $sanitize(string);
        } catch(e) {

            return "The text contained HTML that the sanitizer couldn't properly check, so it is not displayed.";
        }
    };

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
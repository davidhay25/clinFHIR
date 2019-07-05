angular.module("sampleApp")
    .controller('nzCtrl',
        function ($scope,$http,modalService,appConfigSvc,fhirUtilsSvc,v2ToFhirSvc,$timeout) {

            console.log(location.host);
            $scope.input = {}
            //will update the config. We don't care if manually entered servers are lost or the default servers changed
            if (appConfigSvc.checkConfigVersion()) {
                alert('The config was updated. You can continue.')
            }

            firebase.auth().onAuthStateChanged(function(user) {

                if (user) {
                    $scope.user = user;

                    console.log(user)


                } else {
                    delete $scope.user

                }

            });

            $scope.login=function(){
                $uibModal.open({
                    backdrop: 'static',      //means can't close by clicking on the backdrop.
                    keyboard: false,       //same as above.
                    templateUrl: 'modalTemplates/login.html',
                    controller: 'loginCtrl'
                })
            };

            $scope.logout=function(){
                firebase.auth().signOut().then(function() {
                    delete $scope.user;
                    modalService.showModal({}, {bodyText: 'You have been logged out of clinFHIR'})

                }, function(error) {
                    modalService.showModal({}, {bodyText: 'Sorry, there was an error logging out - please try again'})
                });
            };

            let appRoot = location.host;



            //functions and prperties to enable the valueset viewer
            $scope.showVSBrowserDialog = {};
            $scope.showVSBrowser = function(vs) {
                $scope.showVSBrowserDialog.open(vs);        //the open method defined in the directive...
            };


            //load the valueset browser. Pass in the url of the vs - the expectation is that the terminology server
            //can use the $expand?url=  syntax
            $scope.viewVS = function(uri) {
                //var url = appConfigSvc
                $scope.showVSBrowserDialog.open(null,uri);


            };

            $scope.showType = function(param) {
                alert('show the contents of this type')
            }


            $scope.copyExampleToClipboard = function(item) {

                //https://stackoverflow.com/questions/29267589/angularjs-copy-to-clipboard
                var copyElement = document.createElement("span");
                copyElement.appendChild(document.createTextNode(angular.toJson(item),2));
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

                alert("The item has been copied to the clipboard.")

            }
            $scope.exampleTypes = {};       // a hash of the different types of example

            let FHIRVersion =4;
            appConfigSvc.setServerType('conformance','http://home.clinfhir.com:8054/baseR4/');
            appConfigSvc.setServerType('data','http://home.clinfhir.com:8054/baseR4/');       //set the data server to the same as the conformance for the comments
            //appConfigSvc.setServerType('terminology',"http://home.clinfhir.com:8054/baseR4/");
            appConfigSvc.setServerType('terminology',"https://ontoserver.csiro.au/stu3-latest/");


            $scope.capStmt = [{id:'nhi',display:'NHI'},{id:'hpi',display:"HPI"}];
            let hashCapStmt = {};   //keyed on id
            let hashOpDefn = {};    //keyed on url
            $scope.capStmt.forEach(function (item) {
                let url = appConfigSvc.getCurrentConformanceServer().url + "CapabilityStatement/"+item.id;
                $http.get(url).then(
                    function(data) {
                        let capStmt = data.data;
                        hashCapStmt[item.id] = capStmt;
                        //now find the OperationDefinitions  todo - ?move all this to a service
                        if (capStmt.rest && capStmt.rest.length > 0) {
                            capStmt.rest.forEach(function (rest) {
                                if (rest.operation) {
                                    rest.operation.forEach(function (op) {
                                        let url = op.definition;
                                        if (url) {
                                            if (! hashOpDefn[url]) {
                                                let qry = appConfigSvc.getCurrentConformanceServer().url + "OperationDefinition?url=" + url;
                                                $http.get(qry).then(
                                                    function (data) {
                                                        let bundle = data.data
                                                        if (bundle.entry && bundle.entry.length > 0) {
                                                            let opDef = bundle.entry[0].resource;   //todo what if > 1??
                                                            hashOpDefn[url] = opDef;
                                                            console.log(hashOpDefn)
                                                            op.fullDefinition = opDef;      //for the display

                                                        } else {
                                                            console.log(url + " not found on the conformance server")
                                                        }
                                                    }
                                                )
                                            } else {
                                                op.fullDefinition = hashOpDefn[url];      //for the display
                                            }

                                        }
                                    })
                                }
                            })
                        }
                    }
                )
            });

            $scope.selectCapStmt = function(id) {
                $scope.input.selectedCapStmt = hashCapStmt[id]
            };


            //select an example based on the example object created from the IG...
            $scope.selectSample = function(example){
                $scope.input.selectedExample = example;
                delete $scope.input.selectedExampleJson;
                delete $scope.input.selectedExampleXml;
                delete $scope.selectedIGExampleEntry;
                delete $scope.singleResourceChart;
                $('#resourceTree').jstree('destroy');


                let url = example.url;

                if (url.indexOf('http') == -1) {
                    url = 'http://home.clinfhir.com:8054/baseR4/' + url;        //todo
                    $scope.input.selectedExample.url = url;     //so it displays in full on the page
                }



                if (hashExampleJson[url]) {
                    let resource = angular.copy(hashExampleJson[url]);

                    $scope.input.selectedExampleJson = resource;
                    $scope.input.selectedExampleXml = hashExampleXml[url];



                    //create the tree and collapse to one level - draws the tree as well...
                    $scope.treeData = v2ToFhirSvc.buildResourceTree(resource);
                    $timeout(function(){
                            $scope.collapseAll()
                        }
                        ,1000
                    );

                    //create the graph
                    //first, create a bundle with only the details of this resource



                    let options = {bundle:{entry:[]},hashErrors:{},showOutRef:true,showInRef:true}
                    options.serverRoot = appConfigSvc.getCurrentDataServer().url;
                    $scope.examples.forEach(function (ex1) {
                        let ex = angular.copy(ex1)

                        if (ex.url == url) {
                            //this is the focus resource
                            options.centralResourceId = ex.resourceType + "/" + ex.id

                            let entry = {resource:resource}
                            //delete entry.resource.id;
                            entry.fullUrl = ex.url;

                            options.bundle.entry.push(entry)
                        } else {
                            let r = {resourceType:ex.resourceType}; //,id:ex.id}
                            let entry = {resource:r};
                            entry.fullUrl = ex.url;
                            options.bundle.entry.push(entry)
                        }
                    });


                    let vo = v2ToFhirSvc.makeGraph(options);


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


                    $scope.singleResourceChart.on("click", function (obj) {
                        delete $scope.selectedIGExampleEntry;
                        var nodeId = obj.nodes[0];  //get the first node
                        var node = vo.graphData.nodes.get(nodeId);

                        $scope.selectedGraphNode = node;
                        let url = node.url;     //the actual (non canonical) url to the resource
                        $scope.examples.forEach(function (ex) {
                            if (ex.url == url) {
                                $scope.selectedIGExampleEntry = ex
                            }

                        });


                        $scope.$digest();
                    });


                } else {
                    alert('example not found:'+url)
                }


                return;

                $http.get(url).then(
                    function(data) {
                        let resource = data.data;
                        $scope.input.selectedExampleJson = resource;
                        $scope.treeData = v2ToFhirSvc.buildResourceTree(resource);

                        //collapse the tree to one level...
                        $timeout(function(){
                                $scope.collapseAll()
                            }
                            ,1000
                        );

                        //create a bundle with only the details of this resource
                       // $scope.examples.push({display:item.name,url:item.reference.reference,
                           // description:item.description,id:item.id});
                        let options = {bundle:{entry:[]},hashErrors:{},showOutRef:true,showInRef:true}
                        options.serverRoot = appConfigSvc.getCurrentDataServer().url;
                        $scope.examples.forEach(function (ex1) {
                            let ex = angular.copy(ex1)
                            if (ex.url == url) {
                                //this is the focus resource
                                options.centralResourceId = url;// ex.resourceType + "/" + ex.id
                                let entry = {resource:resource}

                                options.bundle.entry.push(entry)
                            } else {
                                let r = {resourceType:ex.resourceType}; //,id:ex.id}
                                let entry = {resource:r};
                                entry.fullUrl = ex.url;
                                options.bundle.entry.push(entry)
                            }
                        });


                        let vo = v2ToFhirSvc.makeGraph(options);

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

                        $scope.singleResourceChart.on("click", function (obj) {

                            var nodeId = obj.nodes[0];  //get the first node
                            var node = vo.graphData.nodes.get(nodeId);

                            $scope.selectedGraphNode = node;
                            let url = node.url;     //the actual (non canonical) url to the resource
                            $scope.examples.forEach(function (ex) {
                                if (ex.fullUrl == url) {
                                    $scope.selectedIGExampleEntry = ex
                                }

                            })


                            $scope.$digest();
                        });



                        //get the Xml version...
                        $http.get(url+"?_format=xml").then(
                            function(data) {
                                $scope.input.selectedExampleXml = data.data;
                            }
                        )




                    },
                    function(err) {
                        console.log(err)
                    }
                );



            };

            $scope.fitSingleGraph = function(){
                $timeout(function(){
                    if ($scope.singleResourceChart) {
                        $scope.singleResourceChart.fit();

                    }

                },1000)

            };


            let drawTree = function(resource) {
                //show the tree structure of this resource (adapted from scenario builder)
                $('#resourceTree').jstree('destroy');
                $('#resourceTree').jstree(
                    {'core': {'multiple': false, 'data': $scope.treeData, 'themes': {name: 'proton', responsive: true}}}
                ).on('changed.jstree', function (e, data) {
                    //seems to be the node selection event...

                    //console.log(data)
                    if (data.node) {

                        //opens or closes the node and all children on select
                        if (data.node.state.opened) {
                            $("#resourceTree").jstree("close_all","#"+data.node.id); // for example :)
                        } else {
                            $("#resourceTree").jstree("open_all","#"+data.node.id); // for example :)
                        }



                        //$('#resourceTree')

                        $scope.selectedNode = data.node;



                    }
                }) /*.on('ready.jstree',function(e) {
                    $scope.collapseAll();
                })
                */



            };

            $scope.expandAll = function(){
                $scope.treeData.forEach(function (item) {
                    item.state.opened = true;
                });

                drawTree();
            };




            $scope.collapseAll = function() {
                $scope.treeData.forEach(function (item) {
                    item.state.opened = false;
                })
                $scope.treeData[0].state.opened=true;
                drawTree();
            };

            $scope.examples = [];

            let igTypeUrl = appConfigSvc.config().standardExtensionUrl.igEntryType;

            //get the IG
            let url = appConfigSvc.getCurrentConformanceServer().url + 'ImplementationGuide/cf-artifacts-nz3';
            let exampleServerBase = appConfigSvc.getCurrentDataServer().url;
            let hashExampleJson = {}, hashExampleXml = {};
            $scope.models = [];
            $http.get(url).then(
                function(data) {
                    $scope.IG = data.data;
/*

                    if (FHIRVersion == 3) {
                        $scope.IG.package.forEach(function (package) {
                            //$scope.modelsByPackage[package.name] = [];      //todo - assume that name exists...
                            package.resource.forEach(function (item) {
                                let type = fhirUtilsSvc.getSingleExtensionValue(item,igTypeUrl);
                                if (type) {
                                    console.log(type.valueCode)
                                    switch (type.valueCode) {
                                        case 'logical' :
                                            //we KNOW that this field exists, and that the url is made up from the url...
                                            //('cause it's all clinFHIR controlled)
                                            let ar = item.sourceReference.reference.split('/');
                                            let id = ar[ar.length-1]
                                            let url = '/logicalModeller.html#$$$'+id;
                                            let entry = {url:url,description:item.description,name:item.name}
                                            $scope.models.push(entry)
                                            //$scope.modelsByPackage[package.name].push(entry)
                                            break;
                                    }
                                }

                            })

                        });
                    }
                    */

                 //   if (FHIRVersion == 4) {
                        $scope.IG.definition.resource.forEach(function (item) {
                            let type = fhirUtilsSvc.getSingleExtensionValue(item,igTypeUrl);
                            if (type) {
                                console.log(type.valueCode)
                                switch (type.valueCode) {
                                    case 'logical' :
                                        //we KNOW that this field exists, and that the url is made up from the url...
                                        //('cause it's all clinFHIR controlled)
                                        let ar = item.reference.reference.split('/');
                                        let id = ar[ar.length-1]
                                        let url = '/logicalModeller.html#$$$'+id;
                                        let entry = {url:url,description:item.description,name:item.name}
                                        $scope.models.push(entry)
                                        //$scope.modelsByPackage[package.name].push(entry)
                                        break;
                                }
                            } else {
                                //if there's no extension, then is is an example?
                                if (item.exampleCanonical || item.exampleBoolean) {
                                    //at the moment the canonical is referencing the LM - not the profile

                                    //get the resource type form the reference
                                    let r = item.reference.reference;   //format {type}/{id}
                                    let ar = r.split("/");
                                    let ResourceType = ar[0]
                                    //the list of examples from the IG
                                    $scope.examples.push(
                                        {
                                            display:item.name,
                                            //url:item.reference.reference,
                                            url:exampleServerBase+item.reference.reference,
                                            description:item.description,id:ar[1],
                                            resourceType:ResourceType
                                        }
                                    );

                                    //update the list of example types, if necessary...
                                    if ($scope.exampleTypes[ResourceType]) {
                                        $scope.exampleTypes[ResourceType] ++
                                    } else {
                                        $scope.exampleTypes[ResourceType] = '1'
                                    }

                                    //now load the Json version of the example
                                    let url = item.reference.reference;
                                    if (url.indexOf('http') == -1) {
                                        url = exampleServerBase + url;        //todo

                                    }
                                    $http.get(url).then(
                                        function(data) {
                                            hashExampleJson[url] = data.data;
                                        },
                                        function(err) {
                                            console.log(err)
                                        }
                                    );

                                    //and the Xml version
                                    $http.get(url+'?_format=xml').then(
                                        function(data) {
                                            hashExampleXml[url] = data.data;
                                        },
                                        function(err) {
                                            console.log(err)
                                        }
                                    )

                                }
                            }
                        });

                    //create an array of exampleTypes so we can sort
                    $scope.arExampleTypes = ['All']
                    angular.forEach($scope.exampleTypes,function(v,k){
                        //$scope.arExampleTypes.push(k + " ("+ v + ")")
                        $scope.arExampleTypes.push(k)
                    })
                    $scope.arExampleTypes.sort();
                    $scope.input.exampleType = $scope.arExampleTypes[0]
                    console.log($scope.arExampleTypes)


                    $scope.showExample=function(ex) {
                        if ($scope.input.exampleType == 'All') {
                            return true
                        } else {
                            if (ex.resourceType == $scope.input.exampleType) {
                                return true
                            }
                        }
                    }
                   // }



console.log($scope.examples)


                }, function(err) {
                    alert(angular.toJson(err));
                }
            );


            $scope.taskManager = "/taskManager.html#$$$cf-artifacts-nz3"


        }
    );
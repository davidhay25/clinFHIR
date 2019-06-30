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


            //get from the IG when everything is moved to R4...
            $scope.selectSample = function(example){
                $scope.input.selectedExample = example;
                delete $scope.input.selectedExampleJson;
                delete $scope.input.selectedExampleXml;
                $('#resourceTree').jstree('destroy');

                let url = example.url;
                if (url.indexOf('http') == -1) {
                    url = 'http://home.clinfhir.com:8054/baseR4/' + url;        //todo
                    $scope.input.selectedExample.url = url;     //so it displays in full on the page
                }

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
                                options.centralResourceId = ex.resourceType + "/" + ex.id
                                let entry = {resource:resource}

                                options.bundle.entry.push(entry)
                            } else {
                                let r = {resourceType:ex.resourceType}; //,id:ex.id}
                                let entry = {resource:r};
                                entry.fullUrl = options.serverRoot + ex.url;
                                options.bundle.entry.push(entry)
                            }
                        });

console.log(options)
                        //let options = {bundle:$scope.fhir,hashErrors:$scope.hashErrors,serverRoot:$scope.serverRoot,centralResourceId:id}
                        //let optionss = {bundle:$scope.fhir,hashErrors:$scope.hashErrors,serverRoot:serverRoot}
                        let vo = v2ToFhirSvc.makeGraph(options);
console.log(vo)

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

                        //$scope.$digest();       //as the event occurred outside of angular...

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

            $scope.expandAtNodeDEP = function(){
                let currentNodeId = $scope.selectedNode.id;

                console.log($("#resourceTree").jstree(true)._model.data)

                let wholeTree = $("#resourceTree").jstree(true)._model.data;
                angular.forEach(wholeTree,function(item){
                    if (item.parents) {
                        item.parents.forEach(function(parentId){
                            if (parentId == currentNodeId) {
                                item.state.opened = true;
                            }
                        })
                    }
                })

               $scope.$digest()


                return
                $("#resourceTree").jstree(true).each_node(function (node) {
                    // 'this' contains the jsTree reference

                    console.log(this)
                    // example usage: hide leaf nodes having a certain data attribute = true
                 //   if (this.is_leaf(node) && node.data[attribute]) {
                      //  this.hide_node(node);
                  //  }
                });
                /*
                $scope.treeData.forEach(function (item) {
                    if (item.parents) {
                        item.parents.forEach(function(parentId){
                            if (parentId == currentNodeId) {
                                item.state.opened = true;
                            }
                        })
                    }

                })
                drawTree();
                */
            }


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
            $scope.models = [];
            $http.get(url).then(
                function(data) {
                    $scope.IG = data.data;


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

                    if (FHIRVersion == 4) {
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
                                    let r = item.reference.reference;
                                    let ar = r.split("/")
                                    $scope.examples.push({display:item.name,url:item.reference.reference,
                                        description:item.description,id:ar[1],resourceType:ar[0]});

                                }
                            }
                        })


                    }



//console.log($scope.models)


                }, function(err) {
                    alert(angular.toJson(err));
                }
            );


            $scope.taskManager = "/taskManager.html#$$$cf-artifacts-nz3"


        }
    );
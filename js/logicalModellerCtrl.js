/*has been deprectde - don't call make function - expensive! */

angular.module("sampleApp")
    .controller('logicalModellerCtrl',
        function ($scope,resourceCreatorSvc,$uibModal,$http,modalService) {

            $scope.input = {};
            $scope.treeData = [];           //populates the resource tree

            $scope.treeData =  [

                { "id" : "ajson1", "parent" : "#", "text" : "Simple root node",state:{opened:true},data : {name:"root",path:"ajson1"} },
                { "id" : "ajson3", "parent" : "ajson1", "text" : "Child 1" ,state:{opened:true},data : {name:"child1"}},
                { "id" : "ajson4", "parent" : "ajson1", "text" : "Child 2",state:{opened:true},data : {name:"child2"} }
            ]




            $scope.treeData =  [

                { "id" : "dhTest", "parent" : "#", "text" : "Simple root node",state:{opened:true},data : {name:"root",path:"dhTest"} }

            ]

            $scope.rootName = 'dhRoot';
            $scope.newModel = function(){
                
            };

            $scope.dataTypes = resourceCreatorSvc.getDataTypesForProfileCreator();
            //console.log($scope.dataTypes);

            $scope.save = function() {
                var url = "http://fhir3.healthintersections.com.au/open/StructureDefinition/dhLogicalModel";
                $http.put(url,$scope.SD).then(
                    function(data) {
                        console.log(data)
                    },
                    function(err) {
                        console.log(err)
                        $scope.error = err;
                    }
                )
            };

            $scope.addNode = function() {
                var parentPath = $scope.selectedNode.data.path;
                editNode(null,parentPath);         //will actually create a new node
            }


            $scope.editNode = function() {
                var parentPath = $scope.selectedNode.data.path;
                editNode($scope.selectedNode,parentPath);         //will edit the node
            }

            var editNode = function(nodeToEdit,parentPath) {
                $uibModal.open({
                    templateUrl: 'modalTemplates/editLogicalItem.html',
                    size: 'lg',
                    controller: function($scope,allDataTypes,editNode,parentPath,findNodeWithPath){

                        //console.log(findNodeWithPath)
                        $scope.canSave = true;
                        $scope.allDataTypes = allDataTypes;
                        $scope.parentPath = parentPath;
                        $scope.input = {};
                        $scope.input.name = 'NewElement';
                        $scope.input.short='This is a new element';
                        $scope.input.description = 'detailed notes about the element'
                        $scope.input.dataType = $scope.allDataTypes[0];

                        if (editNode) {
                            var data = editNode.data;
                            $scope.input.name = data.name;
                            $scope.input.short= data.short;
                            $scope.input.description = data.description;
                        }

                        $scope.checkForDuplicatePath = function(){
                            var pathForThisElement = parentPath + '.'+$scope.input.name;
                            var duplicateNode = findNodeWithPath(pathForThisElement)
                            if (duplicateNode) {
                                $scope.canSave = false;
                                   modalService.showModal({},{bodyText:"This name is a duplicate of another and cannot be used. Try again."})
                                } else {
                                    $scope.canSave = true;
                                }
                            //console.log(duplicateNode)
                        };

                        $scope.save = function() {
                            var vo = {};
                            vo.name = $scope.input.name;
                            vo.short = $scope.input.short;
                            vo.description = $scope.input.description || 'definition';
                            vo.type = [{code:$scope.input.dataType.code}];
                            vo.editNode = editNode;
                            vo.parentPath = parentPath;
                            $scope.$close(vo);
                        };

                        $scope.setDataType = function(dt) {
                           // console.log(dt)
                        }
                    },
                    resolve : {
                        allDataTypes: function () {          //the default config
                            return $scope.dataTypes;
                        }, editNode : function() {
                            return nodeToEdit
                        },
                        parentPath : function(){
                            return parentPath;
                        },
                        findNodeWithPath : function() {
                            return findNodeWithPath
                        }
                    }
                }).result.then(
                    function(result) {

                        var pathForThisElement = result.parentPath + '.'+result.name;
                        var duplicateNode = findNodeWithPath(pathForThisElement)
                        
                       // if (duplicateNode) {
                         //   modalService.showModal({},{bodyText:"This name is a duplicate of another and cannot be used. Try again."})
                        //} else {

                            console.log(duplicateNode)

                            if (result.editNode) {
                                //editing an existing node...
                                $scope.treeData.forEach(function (item, index) {
                                    if (item.id == result.editNode.id) {
                                        var clone = angular.copy(result)
                                        delete clone.editNode;
                                        item.data = clone;
                                        item.text = clone.name;
                                        $scope.selectedNode = item;
                                    }
                                })


                            } else {
                                var parentId = $scope.selectedNode.id;
                                var newId = 't' + new Date().getTime();
                                var newNode = {
                                    "id": newId,
                                    "parent": parentId,
                                    "text": result.name,
                                    state: {opened: true}
                                };
                                newNode.data = angular.copy(result);
                                $scope.treeData.push(newNode);
                                delete $scope.selectedNode;


                                // var rootNodeId = $scope.treeData[0].data.path;
                                // setPath(rootNodeId,rootNodeId)

                            }
                            var rootNodeId = $scope.treeData[0].data.path;
                            setPath(rootNodeId, rootNodeId)


                            drawTree()
                            makeSD();
                       // }

                        function setPath(parentPath,parentId) {
                            $scope.treeData.forEach(function(node){
                                if (node.parent == parentId) {
                                    var childPath = parentPath + '.' + node.data.name;
                                    console.log(childPath);
                                    node.data.path = childPath;
                                    setPath(childPath,node.id)
                                }
                            })

                        }


                       
                    })
                };

            $scope.deleteNode = function() {
                //first assemble list of nodes to remove
                var idToDelete = $scope.selectedNode.id;
                var lst = [idToDelete];

                findChildNodes(lst,idToDelete)
                console.log(lst);

                //now create a new list - excluding the ones to be deleted
                var newList = [];
                $scope.treeData.forEach(function(node){
                    if (lst.indexOf(node.id) == -1) {
                        newList.push(node);
                    }
                });

                $scope.treeData = newList;
                delete $scope.selectedNode;
                drawTree()
                makeSD();
                
                //
                function findChildNodes(lst,parentId) {
                    $scope.treeData.forEach(function(node){
                        if (node.parent == parentId) {
                            lst.push(node.id);
                            findChildNodes(lst,node.id)
                        }
                    })
                    
                }

                
                
            }


            function findNodeWithPath(path) {
                var foundNode;
                $scope.treeData.forEach(function(node){
                    if (node.data.path == path) {
                        foundNode= node;
                    }
                });


                return foundNode;

/*

                var rootNodeId = $scope.treeData[0].data.path;
                var foundNode = findPath(rootNodeId,rootNodeId,path)
                return foundNode;

                function findPath(parentPath,parentId,targetPath) {
                    $scope.treeData.forEach(function(node){
                        if (node.parent == parentId) {
                            var childPath = parentPath + '.' + node.data.name;
                            console.log(childPath);
                            if (childPath == targetPath) {
                                return node;
                            } else {
                                node.data.path = childPath;
                                findPath(childPath,node.id,targetPath)

                            }

                        }
                    })

                }
                
                */


            }



            //create the StructureDefinition resource for the logical model..
            makeSD = function() {
                var sd = {resourceType:'StructureDefinition'};
                sd.id = "dhLogicalModel";
                sd.url = "http://fhir.hl7.org.nz/test";
                sd.name = $scope.rootName;
                sd.status='draft';
                sd.date = moment().format();
                sd.description = $scope.input.description;
                //newResource.short = $scope.input.short;
                sd.publisher = $scope.input.publisher;
                //at the time of writing (Oct 12), the implementaton of stu3 varies wrt 'code' & 'keyword'. Remove this eventually...
                sd.identifier = [{system:"http://clinfhir.com",value:"author"}]
                sd.kind='logical';
                sd.abstract=false;
                sd.baseDefinition ="http://hl7.org/fhir/StructureDefinition/Element"
                sd.type = "dhTest";
                sd.derivation = 'specialization';

                //newResource.type = type;
                //newResource.derivation = 'constraint';
                //newResource.baseDefinition = "http://hl7.org/fhir/StructureDefinition/"+type;
                //newResource.keyword = [{system:'http://fhir.hl7.org.nz/NamingSystem/application',code:'clinfhir'}]


                sd.snapshot = {element:[]};

                $scope.treeData.forEach(function(item){
                    var data = item.data;
                   // console.log(data);
                    var ed = {}
                    ed.id = data.path;
                    ed.path = data.path;
                    ed.short = data.short;
                    ed.definition = data.description || 'definition';
                    ed.min=0;
                    ed.max = '1';
                    if (data.type) {
                        ed.type = [];
                        data.type.forEach(function(typ) {
                            ed.type.push({code:typ.code});
                        })
                    }

                    ed.base = {
                        path : ed.path, min:0,max:'1'
                    };

                    sd.snapshot.element.push(ed)
                });

                $scope.SD = sd;
            };

            function drawTree() {
                

                $('#lmTreeView').jstree('destroy');
                $('#lmTreeView').jstree(
                    {'core': {'multiple': false, 'data': $scope.treeData, 'themes': {name: 'proton', responsive: true}}}
                ).on('changed.jstree', function (e, data) {
                    //seems to be the node selection event...

                    console.log(data)
                    $scope.selectedNode = data.node;


                                //used in the html template...

                    $scope.$digest();       //as the event occurred outside of angular...



                }).on('redraw.jstree', function (e, data) {


                    console.log('redraw')


                    if ($scope.treeData.length > 0) {
                       
                        $scope.$broadcast('treebuilt');
                        $scope.$digest();       //as the event occurred outside of angular...
                    }

                });


            }



            drawTree()
    });
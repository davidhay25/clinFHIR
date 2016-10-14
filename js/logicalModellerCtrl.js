/*has been deprectde - don't call make function - expensive! */

angular.module("sampleApp")
    .controller('logicalModellerCtrl',
        function ($scope,$uibModal,$http,resourceCreatorSvc,modalService,appConfigSvc,logicalModelSvc) {
//resourceCreatorSvc
            $scope.input = {};
            $scope.treeData = [];           //populates the resource tree

            $scope.conformanceServer = appConfigSvc.getCurrentConformanceServer();
            
            //load all the logical models created by clinFHIR
            loadAllModels = function() {
               var url="http://fhir3.healthintersections.com.au/open/StructureDefinition?kind=logical&identifier=http://clinfhir.com|author";
                $http.get(url).then(
                    function(data) {
                        $scope.bundleModels = data.data
                    },
                    function(err){

                    }
                )
            };
            loadAllModels();

            $scope.rootName = 'dhRoot';

            $scope.newModel = function(){
                $uibModal.open({
                    templateUrl: 'modalTemplates/newLogicalModel.html',
                        size: 'lg',
                        controller: function($scope,appConfigSvc,Utilities,GetDataFromServer,modalService) {
                            $scope.input = {};
                            $scope.input.name = 'myModel';
                            $scope.input.short='A new model';
                            $scope.conformanceServer = appConfigSvc.getCurrentConformanceServer();
                            
                            $scope.checkModelExists = function(name) {
                                if (name.indexOf(' ')>-1) {
                                    modalService.showModal({},{bodyText:"The name cannot contain spaces"})
                                    return;
                                }

                                var url = $scope.conformanceServer.url + "StructureDefinition/"+name;
                                $scope.showWaiting = true;
                                $scope.canSaveEd = false;
                                GetDataFromServer.adHocFHIRQuery(url).then(
                                    function(data){

                                        if (Utilities.isAuthoredByClinFhir(data.data)) {
                                            modalService.showModal({},{bodyText:"There's already a profile with this name. If you carry on. it will be replaced."})
                                        } else {
                                            modalService.showModal({},{bodyText:"Sorry, there's already a profile with this name"})
                                        }

                                    },function(err){
                                        console.log(err);
                                        //as long as the status is 404 or 410, it's save to create a new one...
                                        if (err.status == 404 || err.status == 410) {
                                            $scope.canSave = true;

                                        } else {
                                            var config = {bodyText:'Sorry, there was an unknown error: '+angular.toJson(err,true)};
                                            modalService.showModal({}, config)

                                        }
                                    }).finally(function(){
                                    $scope.showWaiting = false;
                                })
                            };

                            $scope.save = function(){
                                var vo = {};
                                vo.name = $scope.input.name;
                                vo.title = $scope.input.short;
                                vo.purpose = $scope.input.purpose || 'purpose';


                                $scope.$close(vo);
                            }
                        }

                    }).result.then(
                        function(result) {
                            $scope.rootName = result.name;      //this is the 'type' of the logical model - like 'Condition'
                            
                            var rootNode = { "id" : $scope.rootName, "parent" : "#", "text" : result.name,state:{opened:true},
                                data : {name:"root",path:$scope.rootName,isRoot:true} };
                            
                            rootNode.data.header = result;      //header based data. keep it in the first node...
                            
                            $scope.treeData =  [rootNode]
                            drawTree();
                            makeSD();

                            $scope.isDirty = true;      //as this has not beed saved;

                            //add it to the list so we can see it
                            $scope.bundleModels.entry.push({resource:$scope.SD})


                        })
                
            };

            $scope.dataTypes = resourceCreatorSvc.getDataTypesForProfileCreator();

            $scope.save = function() {
                
                var url = $scope.conformanceServer.url + "StructureDefinition/" + $scope.SD.id;

                $http.put(url,$scope.SD).then(
                    function(data) {
                        //console.log(data)
                        loadAllModels();
                        $scope.isDirty = false;
                        modalService.showModal({},{bodyText:"The model has been updated. You may continue editing."})
                    },
                    function(err) {
                        //console.log(err)
                        $scope.error = err;
                        modalService.showModal({},{bodyText:"Sorry, there was an error saving the profile. View the 'Error' tab above for details."})
                    }
                )
            };

            $scope.selectModel = function(entry,index) {
                if ($scope.isDirty) {
                    var modalOptions = {
                        closeButtonText: "No, don't lose changes",
                        actionButtonText: 'Yes, select this model, abandoning changes',
                        headerText: 'Load model',
                        bodyText: 'You have updated this model. Selecting another one will lose those changes.'
                    };

                    modalService.showModal({}, modalOptions).then(
                        function (result) {
                            selectEntry(entry)
                        }
                    );



                } else {
                    selectEntry(entry)
                }

                function selectEntry(entry) {
                    $scope.isDirty = false;
                    $scope.treeData = logicalModelSvc.createTreeArrayFromSD(entry.resource)
                    console.log($scope.treeData)
                    $scope.rootName = $scope.treeData[0].id;        //the id of the first element is the 'type' of the logical model
                    drawTree();
                    makeSD();
                }

            };

            $scope.addNode = function() {
                var parentPath = $scope.selectedNode.data.path;
                editNode(null,parentPath);         //will actually create a new node

            };


            $scope.editNode = function() {
                var parentPath = $scope.selectedNode.data.path;
                editNode($scope.selectedNode,parentPath);         //will edit the node
                //$scope.isDirty = true;
            };

            //edit or add a new element to the model
            var editNode = function(nodeToEdit,parentPath) {
                $uibModal.open({
                    templateUrl: 'modalTemplates/editLogicalItem.html',
                    size: 'lg',
                    controller: function($scope,allDataTypes,editNode,parentPath,findNodeWithPath){

                        $scope.canSave = true;
                        $scope.allDataTypes = allDataTypes;
                        $scope.parentPath = parentPath;
                        $scope.input = {};
                        //$scope.input.name = 'NewElement';
                        //$scope.input.short='This is a new element';
                        //$scope.input.description = 'detailed notes about the element'
                        $scope.input.dataType = $scope.allDataTypes[0];

                        if (editNode) {
                            var data = editNode.data;
                            $scope.input.name = data.name;
                            $scope.input.short= data.short;
                            $scope.input.description = data.description;
                        }

                        $scope.checkName = function(){
                            $scope.canSave = true;
                            if (! $scope.input.name || $scope.input.name.indexOf('0') > -1) {
                                $scope.canSave = false;
                                modalService.showModal({},{bodyText:"The name cannot have spaces in it. Try again."})
                            }

                            var pathForThisElement = parentPath + '.'+$scope.input.name;
                            var duplicateNode = findNodeWithPath(pathForThisElement)
                            if (duplicateNode) {
                                $scope.canSave = false;
                                   modalService.showModal({},{bodyText:"This name is a duplicate of another and cannot be used. Try again."})
                                } //else {
                                   // $scope.canSave = true;
                               // }
                            //console.log(duplicateNode)
                        };

                        $scope.save = function() {
                            var vo = {};
                            vo.name = $scope.input.name;
                            vo.short = $scope.input.short;
                            vo.description = $scope.input.description || 'definition';
                            vo.constraints = $scope.input.constraints;
                            vo.type = [{code:$scope.input.dataType.code}];
                            vo.editNode = editNode;
                            vo.parentPath = parentPath;
                            vo.selectedValueSet = $scope.selectedValueSet;
                            $scope.$close(vo);
                        };


                        $scope.setDataType = function(dt) {
                            if (dt.isCoded) {

                                console.log(dt);
                                $uibModal.open({
                                    backdrop: 'static',      //means can't close by clicking on the backdrop.
                                    keyboard: false,       //same as above.
                                    templateUrl: 'modalTemplates/vsFinder.html',
                                    size: 'lg',
                                    controller: function ($scope, appConfigSvc, GetDataFromServer) {
                                        //this code is all from vsFinderCtrl controller - for some reason I can't reference it from here...
                                        //and newExtensionDefinition
                                        $scope.input = {};

                                        var config = appConfigSvc.config();
                                        $scope.termServer = config.servers.terminology;

                                        $scope.input.arStrength = ['required', 'extensible', 'preferred', 'example'];
                                        $scope.input.strength = 'preferred'; //currentBinding.strength;


                                        $scope.select = function () {

                                            $scope.$close({
                                                vs: $scope.input.vspreview,
                                                strength: $scope.input.strength
                                            });
                                        };

                                        //find matching ValueSets based on name
                                        $scope.search = function (filter) {
                                            $scope.showWaiting = true;
                                            delete $scope.message;
                                            delete $scope.searchResultBundle;

                                            var url = $scope.termServer + "ValueSet?name=" + filter;
                                            $scope.showWaiting = true;
                                            GetDataFromServer.adHocFHIRQuery(url).then(
                                                function (data) {
                                                    $scope.searchResultBundle = data.data;
                                                    if (!data.data || !data.data.entry || data.data.entry.length == 0) {
                                                        $scope.message = 'No matching ValueSets found'
                                                    }
                                                },
                                                function (err) {
                                                    alert(angular.toJson(err))
                                                }
                                            ).finally(function () {
                                                $scope.showWaiting = false;
                                            })
                                        };
                                    }
                                }).result.then(
                                    function (vo) {
                                        //vo is {vs,strength}
                                        console.log(vo)
                                        $scope.selectedValueSet = vo;
                                        dt.vs = vo;         //save the valueset against the datatype
                                    }
                                )
                            }
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
                            

                        }
                        var rootNodeId = $scope.treeData[0].data.path;
                        setPath(rootNodeId, rootNodeId)


                        drawTree()
                        $scope.isDirty = true;
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

                findChildNodes(lst,idToDelete);     //all the child nodes (including their children) of the element to be removed
                //console.log(lst);

                //now create a new list - excluding the ones to be deleted
                var newList = [];
                $scope.treeData.forEach(function(node){
                    if (lst.indexOf(node.id) == -1) {
                        newList.push(node);
                    }
                });

                $scope.treeData = newList;
                delete $scope.selectedNode;
                drawTree();
                makeSD();

                $scope.isDirty = true;

                //create a list with the paths of all the nodes
                function findChildNodes(lst,parentId) {
                    $scope.treeData.forEach(function(node){
                        if (node.parent == parentId) {
                            lst.push(node.id);
                            findChildNodes(lst,node.id)
                        }
                    })
                    
                }

                
                
            };


            //locate a node based on the path. Used to detect duplicates...
            function findNodeWithPath(path) {
                var foundNode;
                $scope.treeData.forEach(function(node){
                    if (node.data.path == path) {
                        foundNode= node;
                    }
                });
                return foundNode;
            }

            function findPositionInTree(path){
                var inx = -1;
                for (var i=0; i < $scope.treeData.length; i++) {
                    if ( $scope.treeData[i].data.path == path) {
                        return i;
                        break;
                    }
                }
                return -1;
            }


            //have this as a single finction so we can extract scope properties rather than passing the whole scope across...
            makeSD = function() {
                $scope.SD = logicalModelSvc.makeSD($scope,$scope.treeData);
            };



            $scope.moveUp = function(){
                var path = $scope.selectedNode.data.path;
                var pos = findPositionInTree(path);     //the location of the element we wish to move in the array
                console.log(pos);
                if (pos > 0) {

                    var lst = getListOfPeers(path);
                    if (lst[0].data.path !== path) {
                        //so we're not the first... - need to find the one to shift above...
                        for (var i=0; i < lst.length; i++) {
                            if (lst[i].data.path == path) {
                                //yes! we've got the one to move above, now where is it in the tree?
                                var pos1 = findPositionInTree(lst[i-1].data.path);    //this marks where to do the insert
console.log(pos1)


                                removedBranch = pruneBranch(path);
                                //var arChildren = getChildren(path);
                                //console.log(arChildren)

                                //remove all the children from the array
                                //var removedBranch = $scope.treeData.splice(pos,arChildren.length+1)
                                console.log(removedBranch)

                                insertBranch(removedBranch,pos1);
/*
                                for (var j=removedBranch.length-1; j > -1; j--) {
                                    var nodeToInsert= removedBranch[j];
                                    $scope.treeData.splice(pos1,0,nodeToInsert)
                                }
                                */

                                $scope.isDirty = true;
                                drawTree();
                                makeSD();
                                break;
                            }
                        }
                    }

                }
            };

            $scope.moveDn = function(){
                var path = $scope.selectedNode.data.path;
                var originalPos = findPositionInTree(path);     //need to save where the list is now in case we need to re-insert...
                var lst = getListOfPeers(path);
                //find the position of this node in the peers. If we're already at the bottom, then don't shift
                //if we're second to bottom, then insert point will be right at the bottom.
                //otherwise insert point is above the one 2 down in the list (because of all the child nodes to consider...
                var lengthOfPeers = lst.length;
                var placeInList = -1;
                   for (var i=0; i < lst.length; i++) {    //find where this node is in the list of peers...
                       if (lst[i].data.path == path) {
                           placeInList = i;
                           break;
                       }
                   }
                if (placeInList == lengthOfPeers-1) {
                    //we're at the end of the list - re-insert at original
                } else if (placeInList == lengthOfPeers-2) {
                    //we're second to bottom - insert at bottom
                    removedBranch = pruneBranch(path);      //prune the list
                    var insertPos = $scope.treeData.length; //the bottom
                    insertBranch(removedBranch,insertPos);
                    $scope.isDirty = true;
                    drawTree();
                    makeSD();

                } else {
                    //insert above the secone one down...
                    var pathToInsertAbove = lst[placeInList+2].data.path;   //the node we'll insert above
                    removedBranch = pruneBranch(path);      //prune the list
                    var insertPos= findPositionInTree(pathToInsertAbove);   //insert point (after the list was pruned)
                    insertBranch(removedBranch,insertPos);
                    $scope.isDirty = true;
                    drawTree();
                    makeSD();
                }


                return;



                if (lst[lstlength-1].data.path !== path) {
                    //make sure we're not already at the bottom

                    removedBranch = pruneBranch(path);      //remove the branch we want to move...
                    for (var i=0; i < lst.length; i++) {    //find where this node is in the list of peers...
                        if (lst[i].data.path == path) {
                            //yes! we've got the one to move below, now where is it in the tree?
                            var pos1 = findPositionInTree(lst[i].data.path);    //this is the
                        }
                    }


                }

                return;

                var pos = findPositionInTree(path);
                if (pos < $scope.treeData.length) {     //make sure we're not at the bottom



                    var lst = getListOfPeers(path);
                    if (lst[lstlength-1].data.path !== path) {
                        //so we're not already the last... - need to find the one to shift below...
                        for (var i=0; i < lst.length; i++) {
                            if (lst[i].data.path == path) {
                                //yes! we've got the one to move below, now where is it in the tree?
                                var pos1 = findPositionInTree(lst[i].data.path);
                                var item = $scope.treeData.splice(pos1+1,1)[0]
                                $scope.treeData.splice(pos,0,item)
                                drawTree();
                            }
                        }


                    }

/*
                    //first check that item above is a peer to this one
                    var pathOfAbove = $scope.treeData[pos-1].data.path;
                    if (areSiblings(pathOfAbove,path)) {
                        var item = $scope.treeData.splice(pos-1,1)[0]
                        console.log(item);
                        //item.state = item.state || {}
                        // item.state.selected = true;
                        $scope.treeData.splice(pos,0,item)
                        drawTree();
                    }
                    */
                }
            };

            //remove a nde and all of its children
            pruneBranch = function(path) {
                var arChildren = getChildren(path);
                console.log(arChildren)
                //remove all the children from the array
                var pos = findPositionInTree(path);
                return $scope.treeData.splice(pos,arChildren.length+1)
            };

            insertBranch = function(branch,pos){
                for (var j=branch.length-1; j > -1; j--) {
                    var nodeToInsert= branch[j];
                    $scope.treeData.splice(pos,0,nodeToInsert)
                }
            }

            //are the 2 paths siblings (ie under the same parent)
            areSiblings = function(path1,path2){
                var ar1 = path1.split('.')
                var ar2 = path2.split('.')
                if (ar1.length !== ar2.length) {return false;}
                ar1.pop();
                ar2.pop();
                if (ar1.join('.') !== ar2.join('.')) {return false;}
                return true;

            }

            //return a list of all peers to this one (used by the move functionality)
            getListOfPeers = function(path) {
                var ar = path.split('.')
                var numberOfSteps = ar.length;      //
                ar.pop();
                var parentPath = ar.join('.');
                var parentPathLength = parentPath.length;
                var ar = [];
                $scope.treeData.forEach(function(node){
                    var ar1 = node.data.path.split('.');
                    if ((node.data.path.substr(0,parentPathLength) == parentPath) && (ar1.length == numberOfSteps)) {
                        ar.push(node);
                    }
                })
                return ar;

            }

            //get all the children of this path
            getChildren = function(path) {
                var ar = [];
                $scope.treeData.forEach(function(node){
                    if (node.data.path.lastIndexOf(path,0)=== 0 && node.data.path !==path) {
                        ar.push(node);
                    }
                })
                return ar;

            }

            //create the StructureDefinition resource for the logical model..
            makeSDDEP = function() {
                var sd = {resourceType:'StructureDefinition'};
                sd.id = $scope.rootName;
                sd.url = "http://fhir.hl7.org.nz/test";
                sd.name = $scope.rootName;
                sd.status='draft';
                sd.date = moment().format();
                sd.description = $scope.input.description;
                //newResource.short = $scope.input.short;
                sd.publisher = $scope.input.publisher;
                //at the time of writing (Oct 12), the implementaton of stu3 varies wrt 'code' & 'keyword'. Remove this eventually...
                sd.identifier = [{system:"http://clinfhir.com",value:"author"}]
                sd.keyword = [{system:'http://fhir.hl7.org.nz/NamingSystem/application',code:'clinfhir'}]


                sd.kind='logical';
                sd.abstract=false;
                sd.baseDefinition ="http://hl7.org/fhir/StructureDefinition/Element"
                sd.type = $scope.rootName;
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
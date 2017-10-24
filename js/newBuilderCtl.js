
angular.module("sampleApp")
    .controller('newBuilderCtrl',
        function ($scope,$http,appConfigSvc,profileCreatorSvc,newBuilderSvc,GetDataFromServer,
                  Utilities,builderSvc,resourceCreatorSvc,$localStorage,resourceSvc,$timeout,$filter) {

        //$scope.resource = {resourceType:'Patient'}

        //this means that the data entered in 'builderDataEntry' will be in this scope. watch out for dataTypeCtrl.js & addPropertyInBuilder.js
        $scope.input = {dt:{}}
        $scope.input.textDisplaySummary = true;

        $scope.appConfigSvc = appConfigSvc;

        $scope.displayServers = "Conformance: " + appConfigSvc.getCurrentConformanceServer().name
            + "<div>Data: " + appConfigSvc.getCurrentDataServer().name + "</div>"
            + "<div>Term: " + appConfigSvc.getCurrentTerminologyServer().name + "</div>";


        $scope.pastedResource='{  "resourceType": "Condition",  "identifier": [{"value": "v2","system": "s2"},{"value": "v1","system": "s1"}]}'
        $scope.parseResource = function(r1) {
            var resource = angular.fromJson(r1)
            console.log(resource);
            var tree = angular.copy($scope.treeData)
            console.log(tree);
            var vo = newBuilderSvc.parseResource(tree,resource);

            console.log(tree);

            $scope.parsedTree = tree;



            console.log(vo);

        };


        //startProfile will be set when invoked from Scenario Builder...
        var myScope = $scope;
        var startProfile = $scope.startProfile;

        if (startProfile) {
            //this was invoked from resource builder. Need to wait to allow $scope to be initialized...

            $timeout(function(){
                   // console.log($scope.sunday)
                   // console.log($scope.$parent.sunday)
                   // console.log($scope)
                    $scope.currentProfile = $scope.$parent.startProfile;
                    $scope.resourceType = getResourceType($scope.$parent.startProfile);
                    //startResource
                    $scope.resource = $scope.$parent.startResource;
                    if ($scope.resource) {
                        drawResourceTree($scope.resource)
                        renderResourceTree();
                    }
                    //if resources are passed in, create a hash based on the resource type to use in creating references...
                    $scope.hashResources = {}
                    if ($scope.$parent.bundle) {
                        $scope.$parent.bundle.entry.forEach(function (ent) {
                            var type = ent.resource.resourceType;       //todo check that the resourceType is correct in SB
                            $scope.hashResources[type] = $scope.hashResources[type] || []
                            $scope.hashResources[type].push(ent.resource);
                        })
                    }

                    var bundle = $scope.$parent.bundle;
                    var allResources=[];        //needed to get the references...
                    if (bundle) {
                        bundle.entry.forEach(function (entry) {
                            allResources.push(entry.resource)
                        })
                    }

                    //display all the references to & from this resource...
                    //temp todo var references = resourceSvc.getReference($scope.resource,allResources);
                    //console.log(references)

                    $scope.references = resourceSvc.getReference($scope.resource);
                    $scope.input.nbProfile = $scope.$parent.startProfile.url;

                    if ($scope.$parent.container && $scope.$parent.container.nbTree) {
                        console.log('tree passed back')
                        $scope.treeData = $scope.$parent.container.nbTree;
                        drawTree($scope.treeData);      //this is the 'design' tree...
                        $scope.textDisplay = newBuilderSvc.renderResource($scope.treeData);

                    } else {
                        newBuilderSvc.makeTree($scope.$parent.startProfile).then(
                            function(vo) {
                                $scope.$parent.container.nbTree = vo.treeData;
                                $scope.treeData = vo.treeData;
                                drawTree(vo.treeData);      //this is the 'design' tree...
                            }
                        )
                    }



                },1000)

        } else {

            //temp !!
            var url= appConfigSvc.getCurrentConformanceServer().url + "StructureDefinition/Condition";
            $http.get(url).then(
                function(data) {
                    var SD = data.data;
                    $scope.currentProfile = SD;
                    $scope.resourceType = getResourceType(SD);
                    $scope.clear();     //sets a base resource with type only...

                    $scope.input.nbProfile = SD.url;

                    newBuilderSvc.makeTree(SD).then(
                        function(vo) {
                            $scope.treeData = vo.treeData;

                            console.log(newBuilderSvc.getObjectSize($scope.treeData))

                            drawTree(vo.treeData)

                        }
                    )
                }
            );

        }



        //actually all the resource Types
        $http.get('resourceBuilder/allResources.json').then(
            function(data) {

                data.data.sort(function(a,b){
                    if (a.name > b.name) {
                        return 1
                    } else return -1;

                });


                $scope.standardResourceTypes = data.data;

                //console.log($scope.standardResourceTypes)

            },
            function(err) {
                alert('Error loading allResources.json\n'+angular.toJson(err));
                deferred.reject();
            }
        );


        //------- select a profile --------
        $scope.showFindProfileDialog = {};
        $scope.findProfile = function() {
            delete $scope.input.selectedProfile;
            $scope.showFindProfileDialog.open();        //show the profile select modal...
        };

        //called when a new profile has been selected from the dialog
        $scope.selectedProfileFromDialog = function (profile) {
            console.log(profile);

            newBuilderSvc.cleanProfile(profile)

            $scope.currentProfile = profile;
            $scope.resourceType = getResourceType(profile);
            $scope.clear();     //sets a base resource with type only...
            $scope.input.nbProfile = profile.url;
            $scope.waiting = true;
            newBuilderSvc.makeTree(profile).then(
                function(vo) {
                    //save url in local storage if not aleady there..
                    $localStorage.nbProfile = $localStorage.nbProfile || []
                    if ( $localStorage.nbProfile.indexOf(profile.url) == -1) {
                        $localStorage.nbProfile.push(profile.url)
                    }


                    //console.log($localStorage.nbProfile)



                    $scope.treeData = vo.treeData;
                    drawTree(vo.treeData)

                }
            ).finally(function(){
                $scope.waiting = false;
            })

        };

        //when selecting a profile from one already selected...
        $scope.nbProfile = $localStorage.nbProfile;
        $scope.savedProfileUrl = function(url) {
            $scope.waiting = true;
            GetDataFromServer.findConformanceResourceByUri(url).then(
                function (profile) {

                    console.log(profile);

                    newBuilderSvc.cleanProfile(profile)

                    $scope.currentProfile = profile;
                    $scope.resourceType = getResourceType(profile);
                    $scope.clear();     //sets a base resource with type only...
                    newBuilderSvc.makeTree(profile).then(
                        function (vo) {
                            $scope.treeData = vo.treeData;
                            drawTree(vo.treeData)
                        })

            },function(err){
                    alert(err.msg)
                }).finally(function () {
                $scope.waiting = false;
            })
        };

        //find the resourceType for this profile.  todo - need to allow for stu2 (as well in maketree...
        function getResourceType(profile) {
            var t = profile.baseDefinition || profile.base;     //stu3/2
            var ar = t.split('/');
            var bt = ar[ar.length-1];
            //for a domao=inf resource (ie from core) the first element path is the resource type. Otherwise it's the baseDefinition
            if (bt = 'DomainResource') {
                bt = profile.snapshot.element[0].path;
            }
            return bt

        }

        //------------------------------

        function drawResourceTree(resource) {

            //make a copy to hide all the $$ properties that angular adds...
            var r = angular.copy(resource);
            var newResource =  angular.fromJson(angular.toJson(r));

            $scope.resourceTreeData = resourceCreatorSvc.buildResourceTree(newResource);

            $scope.resourceTreeData.forEach(function (node,inx) {
                node.state = node.state || {}
                if (inx ==0) {
                    node.state.opened=true;
                } else {
                    node.state.opened=false;
                }
            });
            renderResourceTree()

        }

        function renderResourceTree(){
            //show the tree structure of this resource version
            $('#nbbuilderResourceTree').jstree('destroy');
            $('#nbbuilderResourceTree').jstree(
                {'core': {'multiple': false, 'data': $scope.resourceTreeData, 'themes': {name: 'proton', responsive: true}}}
            )
        }

        $scope.toggleTreeExpand = function () {
            if ($scope.resourceTreeExpanded) {
                $scope.resourceTreeData.forEach(function (node,inx) {
                    node.state = node.state || {}
                    if (inx ==0) {
                        node.state.opened=true;
                    } else {
                        node.state.opened=false;
                    }
                })
            } else {
                $scope.resourceTreeData.forEach(function (node,inx) {
                    node.state = node.state || {}
                    node.state.opened=true;
                })
            }
            renderResourceTree()
            $scope.resourceTreeExpanded = ! $scope.resourceTreeExpanded;
        }

        $scope.newCoreResourceType = function(type){
            console.log(type)
        };

            //temp - load a specific resource
        $scope.loadSDDEP = function(id) {
            var url="http://fhirtest.uhn.ca/baseDstu3/StructureDefinition/"+id;
            $http.get(url).then(
                function(data) {
                    var SD = data.data;
                    newBuilderSvc.makeTree(SD).then(
                        function(vo) {
                            $scope.treeData = vo.treeData;
                            drawTree(vo.treeData)

                        }
                    )
                }
            );
        };

        //draw the 'navigator' profile tree
        function drawTree(treeData) {
            $('#nbSDtreeView').jstree('destroy');
            $('#nbSDtreeView').jstree(
                {'core': {'multiple': false, 'data': treeData, 'themes': {name: 'proton', responsive: true}}}
            ).on('select_node.jstree', function (e, data) {

                //clear specific properties
                delete $scope.selectedNode;
                delete $scope.currentDT;
                $scope.referenceTo = []
                $scope.$broadcast('setDT',null);      //sets an event to reset the data-entry form

                if (data.node && data.node.data && data.node.data) {
                    $scope.selectedNode = data.node;

                    getCurrentValue(data.node);

                    if ($scope.selectedNode.data.meta.type){

                        //if there is only a single possible datatype for this node then display it. Otherwise the user will select..
                        var refDt={};
                        $scope.selectedNode.data.meta.type.forEach(function (typ) {
                            refDt[typ.code] = 'x'
                        });

                        if (Object.keys(refDt).length == 1) {
                            //make sure it's not a BBE
                            if ($scope.selectedNode.data.meta.type[0].code !== 'BackboneElement') {
                                $scope.showDEForm($scope.selectedNode.data.meta.type[0].code)
                            }
                        }

                        //see if there are any references (when invoked from SB)...
                        setPotentialReferences($scope.selectedNode.data.meta)

                    }
                }
                $scope.$digest();
            })




        }

        //called on a BBE that is repeatable. we want to make a copy of that node and all childnodes...
        $scope.addNewNode = function() {
            var currentMeta = $scope.selectedNode.data.meta;

            var nodeId = $scope.selectedNode.id;

            var arNewNodes = [];

            var newParent = {data:{}}; // - this is a tree node... angular.copy($scope.selectedNode)
            newParent.text = $scope.selectedNode.text;
            var newMeta =  angular.copy($scope.selectedNode.data.meta)
            newParent.data.meta =newMeta
            newParent.icon = $scope.selectedNode.icon;          //same icon...

            delete newParent.data.meta.value;                   //we don't want to copy the data as well!
            $scope.selectedNode.data.meta.canCopy = false;    //so this node can't be copied - only the new one...

            $scope.selectedNode.text = $scope.selectedNode.text.substr(0,$scope.selectedNode.text.length-2);          //chop off the '*' from the element that was copied...

            newParent.parent = $scope.selectedNode.parent;      //has the same parent as is a peer...

            //create a unique id. Will also be used for the children of a BBE...
            var inx = $scope.treeData.length
            newParent.id = 'id'+inx ;
            newParent.data.meta.index = -1; //ie no data yet newIndex;
            inx++;

            arNewNodes.push(newParent);     //add the new element (a BBE or a single DT)
            var insertPoint = - 1;

            var parents = {};   //the parent
            parents[nodeId] =  {parentId:newParent.id}

            //now figure out the point to insert (so it all lines up nicely). This is different for a BBE & a root child...
            $scope.treeData.forEach(function (node,pos) {

                if (currentMeta.isBBE) {
                    if (node.parent == nodeId) {
                        insertPoint = pos;     //finds the last element with this one as the parent
                    }
                } else {
                    if (node.id == nodeId) {
                        insertPoint = pos;     //finds the element being copied...
                    }
                }

                //if a BBE, then we need to copy the child elements as well. todo ?do we need to update the insertPoint as well
                if (currentMeta.isBBE && parents[node.parent]) {
//console.log(node)
                    var parent = parents[node.parent];
                    //if (currentMeta.isBBE && node.parent == nodeId) {
                    var newChild = {data:{}}; //angular.copy(node);
                    newChild.text = node.text;
                    newChild.icon = node.icon;
                    newChild.data.meta = angular.copy(node.data.meta)
                    delete newChild.data.meta.value;
                    newChild.data.meta.index = -1;
                    newChild.id = 'id'+inx ;
                    inx++;
                    //newChild.parent = newParent.id;
                    newChild.parent = parent.parentId;
//console.log(newChild)
                    arNewNodes.push(newChild);

                    if (node.data.meta.isBBE) {
                        //This is a child BBE (Careplan.activity.detail)
                        //parents[node.id] = {parentId:node.id}
                        parents[node.id] = {parentId:newChild.id}       //set the parent to this node
                        //console.log(parents)
                    }

                }

            });


            //we need to get a serialization of the current contents of teh tree view...
            var ar = $('#nbSDtreeView').jstree(true).get_json('#', {flat:true})

            for (var j=arNewNodes.length-1; j > -1; j--) {
                var nodeToInsert= arNewNodes[j];
            }

            ///insert the new nodes...
            $scope.treeData = ar.slice(0,insertPoint+1).concat(arNewNodes).concat(ar.slice(insertPoint+1));
            drawTree($scope.treeData)

        };

        //to show the data entry form...
        $scope.showDEForm = function(dt){


            delete $scope.vsDetails;
            delete $scope.expandedValueSet


            $scope.currentDT = dt;



            var meta = $scope.selectedNode.data.meta;     //the specific meta node

            if (meta.vs) {
                //this element has a valueSet binding...
                $scope.waiting = true;
                Utilities.getValueSetIdFromRegistry(meta.vs.url,function(vsDetails) {
                    $scope.vsDetails = vsDetails;

                    if ($scope.vsDetails) {
                        if ($scope.vsDetails.type == 'list' || dt == 'code') {
                            //this has been recognized as a VS that has only a small number of options...
                            GetDataFromServer.getExpandedValueSet($scope.vsDetails.id).then(
                                function (vs) {
                                    $scope.expandedValueSet = vs;

                                }, function (err) {
                                    alert(err + ' expanding ValueSet')
                                }
                            ).finally(function () {
                                $scope.waiting = false;
                            })
                        } else {
                            $scope.waiting = false;
                        }
                    } else {
                        $scope.waiting = false;
                    }



                })

            }

            $scope.$broadcast('setDT',dt);      //sets an event to display the data-entry form

            var currentValue = getCurrentValue($scope.selectedNode);

            //console.log(currentValue);
            $scope.$broadcast('currentValue',currentValue);
            //set current values - todo move to service and check on type...

        };

        //remove the specified index of the current element (if multiple) or the full element (if not)
        $scope.deleteElement = function(inx) {
            var meta = $scope.selectedNode.data.meta;     //the specific meta node for the current element...
            //extensions are processed separately...
            if (meta.isExtension) {
                return;
            }

            var ar = meta.path.split('.');

            if (ar.length == 2) {
                //this is an element directly off the root.
                var elementName = newBuilderSvc.checkElementName(ar[1]); //assume not a [x], dt);        //the segment name
                if (meta.isMultiple) {
                    $scope.resource[elementName].splice(inx,1)

                } else {
                    delete $scope.resource[elementName]
                }
                meta.index = -1;        //to indicate that there is no longer a value at thie element / index

                clearAfterDataEntry();

            }

        };

        //when a reference is to be created...
        $scope.linkToResource = function(resource) {
            console.log(resource)
            var dt = $scope.currentDT;
            var value = {resource:resource.resourceType + "/"+resource.id}
            addData(dt,value);


        }

        //return the possible references for a given element (meta). todo not yet profile aware (in terms of references)
        function setPotentialReferences(meta) {
            $scope.potentialReferences = {}
            if ($scope.hashResources) {
               console.log($scope.hashResources);
                meta.type.forEach(function (typ) {

                   if (typ.code == 'Reference') {



                       var targetType = $filter('referenceType') (typ.targetProfile);      //todo  make this the same when doing stu3...
                       if (targetType == 'Resource') {
                           $scope.potentialReferences = $scope.hashResources
                       } else {
                           if ($scope.hashResources[targetType]) {


                               $scope.potentialReferences[targetType] = $scope.hashResources[targetType]

                               /*$scope.hashResources[targetType].forEach(function (resource) {
                                   $scope.potentialReferences.push(resource)
                               })*/
                           }

                       }

                   }

                })

            }
        }

        //called when the user has entered the data and clicks 'Add'
        $scope.addDataType = function() {
            var dt = $scope.currentDT;

            var vo = builderSvc.getDTValue(dt,$scope.input.dt);
            //console.log(vo);
            addData(dt,angular.copy(vo.value));

        };


        var getCurrentValue = function(node) {
            delete $scope.currentValue;
            var meta = node.data.meta;     //the specific meta node for the current element...
            //extensions are processed separately...
            var ar = meta.path.split('.');

            if (ar.length == 2) {
                //this is an element directly off the root.
                var elementName = ar[1];// todo - what to do about '[x]' ?? newBuilderSvc.checkElementName(ar[1], dt);        //the segment name
                $scope.currentValue = getCV(meta,$scope.resource,elementName)

            } else if (ar.length == 3) {
                //var parent = $scope.
            }

            return $scope.currentValue;

            function getCV(meta,root,elementName) {
                if (meta.isMultiple) {
                    if ( meta.index > -1) {
                        var tmp = root[elementName];
                       // $scope.currentValue = tmp[meta.index]
                        return tmp[meta.index]
                    }
                } else {
                    return root[elementName]
                    //$scope.currentValue =$scope.resource[elementName]
                }
            }

        };

        //actually add a new data element
        var addData = function(dt,value){
            var meta = $scope.selectedNode.data.meta;     //the specific meta node for the current element...
            meta.value = {value:value,dt:dt};     //save the data for the text rendering..

            //extensions are processed separately...
            if (meta.isExtension) {
                newBuilderSvc.processExtension(meta,dt,value,$scope.resource).then(
                    function(data){
                        drawResourceTree($scope.resource);
                        clearAfterDataEntry();
                    }
                );
                return;
            }

            var ar = meta.path.split('.');

            if (ar.length == 2) {
                //this is an element directly off the root.

                var elementName = newBuilderSvc.checkElementName(ar[1],dt);        //the segment name

                //if is is not a BBE, then it can be added directly
                if (!meta.isBBE) {
                    if (meta.isMultiple) {
                        if (meta.index == -1) {
                            //this entry has not been added yet
                            $scope.resource[elementName] = $scope.resource[elementName] || []
                            $scope.resource[elementName].push(value)
                        } else {
                            //this is a replacement
                            var tmp = $scope.resource[elementName];
                            tmp[meta.index] = value
                        }

                        meta.index = $scope.resource[elementName].length -1;     //so we know the current value for any element
                    } else {
                        $scope.resource[elementName] = value;
                    }

                } else {
                    alert('A Backbone element does not have a value! Select one of the child nodes....')
                }

            } else if (ar.length == 3) {
                //the child of a BBE off the root. Will need to get more sophisticated for careplan at least, but let's gte this working at least

                //first locate the parent node. We can't just use the path (as we did above) as there ..
                var parentNode = findNode($scope.selectedNode.parent);    //this is the node in the tree
                var parentMeta = parentNode.data.meta;      //the meta data for parent
                var parentRoot;     //this is the root for this element (ie has all the children)
                var parentName = ar[1];     //the element name of the parent - eg component
                if (parentMeta.index == -1) {
                    //there is no entry for this parent (eg Observation.component). wee need to add it and create a root
                    var tmp = $scope.resource[parentName];
                    if ($scope.resource[parentName]) {
                        //there's already some data for this element name - create and add a new parentRoot;
                        //var tmp = $scope.resource[parentName];
                        parentRoot = {}
                        tmp.push(parentRoot)
                        parentMeta.index = tmp.length-1;      //set the index...
                    } else {
                        //this will be the first 'instance' of this element. Add an array, and the preent root to it..
                        //make sure it's multiple
                        if (parentMeta.isMultiple) {
                            $scope.resource[parentName] = []
                            parentRoot = {}
                            $scope.resource[parentName].push(parentRoot)
                            parentMeta.index = 0;      //set the index...
                        } else {
                            parentRoot = {}
                            $scope.resource[parentName] = parentRoot;
                            parentMeta.index = 0;      //set the index...
                        }
                    }

                } else {
                    //there's aleady a root (as an index was assigned) - get it so we can attach child elements to it
                    var tmp = $scope.resource[parentName];
                    parentRoot = tmp[parentMeta.index]
                }

                //at this point, parentRoot is the object that we want to attach the elements to...
               // var childName = ar[2];      //this is the name of the element to add...
                var childName = newBuilderSvc.checkElementName(ar[2],dt);    //the name of the element to insert

                if (meta.isMultiple) {
                    parentRoot[childName] = parentRoot[childName] || []
                    parentRoot[childName].push(value)
                    meta.index = parentRoot[childName].length -1;

                } else {
                    parentRoot[childName] = value
                    meta.index = 0
                }
            } else if (ar.length == 4) {
                var parentNode = findNode($scope.selectedNode.parent);    //this is the parent node in the tree
                var parentMeta = parentNode.data.meta;
                var parentName = ar[2]
                var gpNode = findNode(parentNode.parent);    //this is the node in the tree
                var gpMeta = gpNode.data.meta;
                var gpName = ar[1]
                var elementName = ar[3];        //todo need to check for [x]
                console.log(parentNode,gpNode)

                //start with the grandParent...
                var gpRoot,parentRoot;
                console.log(gpMeta.index)
                if (gpMeta.index == -1) {
                    //there is no grand parent yet..
                    gpRoot = {};
                    $scope.resource[gpName] = $scope.resource[gpName] || []    //assume multiple, may need to check...
                    gpMeta.index = $scope.resource[gpName].length; //0;

                    $scope.resource[gpName].push(gpRoot);
                } else {
                    var tmp = $scope.resource[gpName];
                    gpRoot = tmp[gpMeta.index]
                }
                //so gpRoot (eg Careplan.activity) is ready to have the parent added...

                if (parentMeta.index == -1) {
                    //no parent on the grandparent
                    parentRoot = {};
                    parentMeta.index = 0;
                    gpRoot[parentName] = parentRoot    //todo assume single for now (for careplan, will need to check (auditevent)...
                   // gpRoot[gpName] = gpRoot;
                } else {
                    parentRoot =  gpRoot[parentName];   //todo only works when single...
                }
                console.log(parentRoot)
                //so now we have parentRoot -
                parentRoot[elementName] = value;    //todo check for multiple


            }



            //need to get the json for the current tree (including updated metadata)
            var tree = $('#nbSDtreeView').jstree(true).get_json('#', {flat:true})
            $scope.textDisplay = newBuilderSvc.renderResource(tree);


            clearAfterDataEntry();
            drawResourceTree($scope.resource);
            $scope.parseResource(angular.toJson($scope.resource));

            //if true, this was called from Scenario Builder...
            if ($scope.$parent && $scope.$parent.container && $scope.$parent.container.nbTree) {
                $scope.$parent.container.nbTree = tree;
            }


            console.log(newBuilderSvc.getObjectSize($scope.resource))



        };

        //find the parent node based on an id
        function findNode(id) {
            return $('#nbSDtreeView').jstree(true).get_node(id);
        }

        function clearAfterDataEntry(){
            delete $scope.currentDT;        //hide the data entry form...
            delete $scope.vsDetails;
            delete $scope.expandedValueSet
            delete $scope.currentValue;
        }

        $scope.validate = function() {
            delete $scope.validationResult;
            $scope.showWaiting = true;

            Utilities.validate($scope.resource).then(
                function(data){
                    $scope.validationResult = data.data;

                },
                function(data) {
                    $scope.validationResult = data.data;

                }
            ).finally(function(){
                $scope.waiting = false;
            })
        }

        //this is called when the vsBrowser is displayed and a concept is selected. The binding occures in builderDataEntry.html
        if (! $scope.conceptSelected) { //this happens when being called from newBuilder...
            $scope.conceptSelected = function(concept) {
                console.log(concept)

                switch ($scope.currentDT) {
                    case 'Coding' :
                        addData($scope.currentDT,concept)
                        break;

                    default:
                        //a codeableconcept
                        addData($scope.currentDT,{coding:[concept]})
                }

            }
        }

        $scope.clear = function(){
            $scope.resource = {resourceType:$scope.resourceType}
            if ($scope.treeData) {
                $scope.treeData.forEach(function(item){
                    var meta = item.data.meta;
                    delete meta.value;

                });

                drawTree($scope.treeData)
                $scope.textDisplay = newBuilderSvc.renderResource($scope.treeData);

            }

        }

    });


angular.module("sampleApp")
    .controller('newBuilderCtrl',
        function ($scope,$http,appConfigSvc,profileCreatorSvc,newBuilderSvc,GetDataFromServer,
                  Utilities,builderSvc,resourceCreatorSvc,$localStorage,resourceSvc,$timeout,$filter) {

        //$scope.resource = {resourceType:'Patient'}

        //this means that the data entered in 'builderDataEntry' will be in this scope. watch out for dataTypeCtrl.js & addPropertyInBuilder.js
        $scope.input = {dt:{}}
        $scope.appConfigSvc = appConfigSvc;

        $scope.displayServers = "Conformance: " + appConfigSvc.getCurrentConformanceServer().name
            + "<div>Data: " + appConfigSvc.getCurrentDataServer().name + "</div>"
            + "<div>Term: " + appConfigSvc.getCurrentTerminologyServer().name + "</div>";

       // $scope.sunday='test';
       // $scope.simpleData = "Test value";
       // $scope.complexData = {identifier: {system:'test system',value:'test value'}}

            //console.log($scope.$parent.startProfile);
            //console.log($scope.startProfile);

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
                    var references = resourceSvc.getReference($scope.resource,allResources);
                    console.log(references)

                    $scope.references = resourceSvc.getReference($scope.resource);
                    $scope.input.nbProfile = $scope.$parent.startProfile.url;

                    newBuilderSvc.makeTree($scope.$parent.startProfile).then(
                        function(vo) {
                            $scope.treeData = vo.treeData;
                            drawTree(vo.treeData);      //this is the 'design' tree...
                        }
                    )
                },1000)

        } else {
            /*
            var url= appConfigSvc.getCurrentConformanceServer().url + "StructureDefinition/cf-StructureDefinition-us-core-patient";
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
                            drawTree(vo.treeData)

                        }
                    )
                }
            );
            */
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

            }).finally(function () {
                $scope.waiting = false;
            })
        };


        //find the resourceType for this profile.  todo - need to allow for stu2 (as well in maketree...
        function getResourceType(profile) {
            var t = profile.baseDefinition;
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

                        //if there is only a single possible datatype for this node then display it...
                        if ($scope.selectedNode.data.meta.type.length == 1) {

                            //make sure it's not a BBE
                            if ($scope.selectedNode.data.meta.type[0].code !== 'BackboneElement') {
                                $scope.showDEForm($scope.selectedNode.data.meta.type[0].code)
                            }
                        }

                        //see if there are any references...
                        setPotentialReferences($scope.selectedNode.data.meta)

                    }
                }
                $scope.$digest();
            })




        }

        //called on a BBE that is repeatable. we want to make a copy of that node and all childnodes...
            //todo note that this only works for direct children right now
        $scope.addNewNode = function() {
            var currentMeta = $scope.selectedNode.data.meta;

            var nodeId = $scope.selectedNode.id;
            $scope.selectedNode.data.meta.canCopy = false;    //so this node can't be copied - only the new one...
            //var newIndex = $scope.selectedNode.data.meta.index + 1;  //the index for this copy. assume that last one was selected todo: need to check
            //find the children that we'll need to duplicate. Right now, it's not repeatible - so fail for carePlan for example..
            var arNewNodes = [];
            var newParent = {data:{}}; // - this is a tree node... angular.copy($scope.selectedNode)
            newParent.text = $scope.selectedNode.text;
            var newMeta =  angular.copy($scope.selectedNode.data.meta)
            newParent.data.meta =newMeta
            newParent.data.meta.theNewOne = true;

            $scope.selectedNode.data.meta.copied = true;        //temp to check the copied one

            delete newParent.data.meta.value;
            newParent.parent = $scope.selectedNode.parent;      //has the same parent as is a peer...
            var inx = $scope.treeData.length
            newParent.id = 'id'+inx ;
            newParent.data.meta.index = -1; //ie no data yet newIndex;     //this is used to distinguish this 'branch' from the others
            inx++;
            arNewNodes.push(newParent);
            var insertPoint = - 1;

            $scope.treeData.forEach(function (node,pos) {
                if (node.parent == nodeId) {
                    insertPoint = pos;     //finds the last element with this one as the parent
                }


                if (node.parent == nodeId) {
                    var newChild = {data:{}}; //angular.copy(node);
                    newChild.text = node.text;
                    newChild.icon = node.icon;
                    newChild.data.meta = angular.copy(node.data.meta)
                    newChild.data.meta.index = -1; //newIndex;
                    newChild.id = 'id'+inx ;
                    inx++;
                    newChild.parent = newParent.id;
                   // newChild.text += 'x'

                    console.log(newChild)
                    arNewNodes.push(newChild);
                }

            });


            var ar = $('#nbSDtreeView').jstree(true).get_json('#', {flat:true})
           // var ar = $scope.treeData;

            for (var j=arNewNodes.length-1; j > -1; j--) {
                var nodeToInsert= arNewNodes[j];

            }



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
                /*
                if (meta.isMultiple) {
                    if ( meta.index > -1) {
                        var tmp = $scope.resource[elementName];
                        $scope.currentValue = tmp[meta.index]
                        return tmp[meta.index]
                    }
                } else {
                    $scope.currentValue =$scope.resource[elementName]
                }
                */
            } else if (ar.length == 3) {
                //var parent = $scope.
            }




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

                //first locate the parent...
                var parentName = ar[1];
                var elementName = newBuilderSvc.checkElementName(ar[2],dt);    //the name of the element to insert

                var parent = $scope.resource[parentName];
                //if the parent exists, then if it's multiple then find the right ine based on the index


                if (!parent) {
                    $scope.resource[parentName] = []; //todo assume that they are all multiple - shoud really check the parent.isMultiple

                    //make sure that all the entries prior to this one exist - eg if the node was dupliacted and the second selected...
                    for (var i=0; i < meta.index; i++) {
                        $scope.resource[parentName].push({})
                    }


                    //add the 'base' object for this
                    var rootNodeForParent = {};
                    //rootNodeForParent['_index'] = meta.index + 't'

                    $scope.resource[parentName].push(rootNodeForParent)
                   // var elementToInsert = {};
                   //    elementToInsert[elementName] = data;
                    if (meta.isMultiple) {
                        rootNodeForParent[elementName] = []
                        rootNodeForParent[elementName].push(value)


                    } else {
                        rootNodeForParent[elementName] = value;
                    }
                } else {
                    //the parent does exist - and we are assuming an array. (ie that all BBE off the root are multiple - todo this may not be correct, and we may need to check
                    //search all the parent arrays looking for one where the meta.index value is the same as this one...
                    var parentElement;


                    parentElement = parent[meta.index];
                    if (! parentElement) {  //this is the first time we've added an element to this node...
                        parentElement = {};
                        //make sure any preceeding elements are populated - ?? do we need to do this???
                        /*
                        for (var i=0; i < meta.index; i++) {
                             if (! parent[i]) {
                                 parent[i] = {}
                             }
                        }
                        */

                        parent[meta.index] = parentElement;
                    }


                    var currentElement = parentElement[elementName];
                    if (currentElement) {
                        //the current value for this element. If it exists it's an array add to it, otherwise replace it
                        if (angular.isArray(currentElement)) {
                            currentElement.push(value)
                        } else {
                            currentElement = value
                        }


                    } else {
                        //there is not yet an element with this name. Is it multiple?
                        if (meta.isMultiple) {
                            //yes, make it an array...
                            parentElement[elementName] = [];
                            parentElement[elementName].push(value)
                        } else {
                            //no, just set the value...
                            parentElement[elementName] = value;
                        }

                    }



                }

            }



            //need to get the json for the current tree (including updated metadata)
            var tree = $('#nbSDtreeView').jstree(true).get_json('#', {flat:true})
            $scope.textDisplay = newBuilderSvc.renderResource(tree);


            clearAfterDataEntry();

            drawResourceTree($scope.resource);

        };

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

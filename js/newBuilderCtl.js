
angular.module("sampleApp")
    .controller('newBuilderCtrl',
        function ($scope,$http,appConfigSvc,profileCreatorSvc,newBuilderSvc,GetDataFromServer,
                  Utilities,builderSvc,resourceCreatorSvc,$localStorage,resourceSvc,$timeout,$filter) {

        //$scope.resource = {resourceType:'Patient'}

        //this means that the data entered in 'builderDataEntry' will be in this scope. watch out for dataTypeCtrl.js & addPropertyInBuilder.js
        $scope.input = {dt:{}}
        $scope.appConfigSvc = appConfigSvc;

       // $scope.sunday='test';
       // $scope.simpleData = "Test value";
       // $scope.complexData = {identifier: {system:'test system',value:'test value'}}

            //console.log($scope.$parent.startProfile);
            //console.log($scope.startProfile);

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
            $('#builderResourceTree').jstree('destroy');
            $('#builderResourceTree').jstree(
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
            $('#SDtreeView').jstree('destroy');
            $('#SDtreeView').jstree(
                {'core': {'multiple': false, 'data': treeData, 'themes': {name: 'proton', responsive: true}}}
            ).on('select_node.jstree', function (e, data) {

                //clear specific properties
                delete $scope.selectedNode;
                delete $scope.currentDT;
                $scope.referenceTo = []
                $scope.$broadcast('setDT',null);      //sets an event to reset the data-entry form

                if (data.node && data.node.data && data.node.data) {
                    $scope.selectedNode = data.node;


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



                    //



                }
                $scope.$digest();
            })




        }

        //called on a BBE that is repeatable. we want to make a copy of that node and all childnodes...
            //todo note that this only works for direct children right now
        $scope.addNewNode = function() {
            var nodeId = $scope.selectedNode.id;
            $scope.selectedNode.data.meta.canCopy = false;    //so this node can't be copied - only the new one...
            var newIndex = $scope.selectedNode.data.meta.index + 1;  //the index for this copy. assume that last one was selected todo: need to check
            //find the children that we'll need to duplicate. Right now, it's not repeatible - so fail for carePlan for example..
            var arNewNodes = [];
            var newParent = {data:{}}; //angular.copy($scope.selectedNode)
            newParent.text = $scope.selectedNode.text;
            newParent.data.meta = angular.copy($scope.selectedNode.data.meta)
            newParent.parent = $scope.selectedNode.parent;
            var inx = $scope.treeData.length
            newParent.id = 'id'+inx ;
            newParent.data.meta.index = newIndex;     //this is used to distinguish this 'branch' from the others
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
                    newChild.data.meta.index = newIndex;
                    newChild.id = 'id'+inx ;
                    inx++;
                    newChild.parent = newParent.id;
                   // newChild.text += 'x'

                    arNewNodes.push(newChild);
                }

            });

            var ar = $scope.treeData;

            for (var j=arNewNodes.length-1; j > -1; j--) {
                var nodeToInsert= arNewNodes[j];
             //   $scope.treeData.splice(insertPoint-1,0,nodeToInsert)
            }
          //  $scope.treeData =  $scope.treeData.concat(arNewNodes);

            $scope.treeData = ar.slice(0,insertPoint+1).concat(arNewNodes).concat(ar.slice(insertPoint+1));

          //  $scope.treeData =  $scope.treeData.slice(concat(arNewNodes);
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
            console.log($scope.input.dt)

            var vo = builderSvc.getDTValue(dt,$scope.input.dt);
           console.log(vo);
            addData(dt,angular.copy(vo.value));


            /*
                       return;


                       var value = $scope.input.dt[dt];

                       //not all input values have the datatype as the propertyname (unfortunately)
                       switch (dt) {
                           case 'CodeableConcept' :
                               var tmp = $scope.input.dt['cc'];
                               value = {};
                               if (tmp.text) {value.text = tmp.text};
                               if (tmp.coding) {
                                   if ( angular.isString(tmp.coding)) {            //when a cc is rendered as radio, it's a string...
                                       value.coding = [angular.fromJson(tmp.coding)]
                                   } else {
                                       value.coding = [tmp.coding]
                                   }

                               }




                              // if ( angular.isString(value)) {     //for some reason this appears to be a string???
                                  // value = angular.fromJson(value)
                              // }
                               break;
                           case 'ContactPoint' :
                               value = $scope.input.dt['contactpoint'];
                               break;
                       }

                       console.log(value);
                       addData(dt,angular.copy(value));

           */
        };

        //actually add a new data element
        var addData = function(dt,value){
            var meta = $scope.selectedNode.data.meta;     //the specific meta node for the current element...
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
                        $scope.resource[elementName] = $scope.resource[elementName] || []
                        $scope.resource[elementName].push(value)
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

                    for (var i=0; i < parent.length; i++) {
                       // if (parent[i])
                    }
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




            clearAfterDataEntry();

            drawResourceTree($scope.resource);

        };

        function clearAfterDataEntry(){
            delete $scope.currentDT;        //hide the data entry form...
            delete $scope.vsDetails;
            delete $scope.expandedValueSet
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
                        addData($scope.currentDT,{Coding:[concept]})
                }

            }
        }

        $scope.clear = function(){
            $scope.resource = {resourceType:$scope.resourceType}
        }

    });

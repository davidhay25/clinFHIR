
angular.module("sampleApp")
    .controller('newBuilderCtrl',
        function ($scope,$http,appConfigSvc,profileCreatorSvc,newBuilderSvc,GetDataFromServer) {

        $scope.resource = {resourceType:'Patient'}

        //this means that the data entered in 'builderDataEntry' will be in this scope. watch out for dataTypeCtrl.js & addPropertyInBuilder.js
        $scope.input = {dt:{}}

        $scope.simpleData = "Test value";
        $scope.complexData = {identifier: {system:'test system',value:'test value'}}

        var url="http://fhirtest.uhn.ca/baseDstu3/StructureDefinition/cf-StructureDefinition-us-core-patient";
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

        function drawTree(treeData) {
            $('#SDtreeView').jstree('destroy');
            $('#SDtreeView').jstree(
                {'core': {'multiple': false, 'data': treeData, 'themes': {name: 'proton', responsive: true}}}
            ).on('select_node.jstree', function (e, data) {

                //clear specific properties
                delete $scope.selectedNode;
                delete $scope.currentDT;
                $scope.$broadcast('setDT',null);      //sets an event to reset the data-entry form

                if (data.node && data.node.data && data.node.data) {
                    $scope.selectedNode = data.node;
                    //if there is only a single possible datatype for this node then display it...
                    if ($scope.selectedNode.data.meta.type && $scope.selectedNode.data.meta.type.length == 1){
                        $scope.showDEForm($scope.selectedNode.data.meta.type[0].code)
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
            $scope.currentDT = dt;
            var meta = $scope.selectedNode.data.meta;     //the specific meta node

            if (meta.vs) {
                //this element has a valueSet binding...
                $scope.expandedValueSet = {expansion:{contains:[{display:'test'}]}}
                $scope.vsDetails = {};
                $scope.vsDetails.minLength = 3;

                GetDataFromServer.getValueSet(meta.vs.url).then(
                    function(vs) {
                        $scope.vsDetails.id = vs.id;
                        $scope.vsDetails.resource = vs;
                    }
                )
            } else {
                //testing
                //testing only! is this simple or complex
                var value = $scope.simpleData;
                if (dt.substr(0,1) == dt.substr(0,1).toUpperCase()) {
                    value = $scope.complexData;
                }
               // addData(dt,value);
            }

            $scope.$broadcast('setDT',dt);      //sets an event to display the data-entry form
        };

        //called when the user has entered the data and clicks 'Add'
        $scope.addDataType = function() {
            var dt = $scope.currentDT;
            console.log($scope.input.dt)


            var value = $scope.input.dt[dt];

            //not all input values have the datatype as the propertyname (unfortunately)
            switch (dt) {
                case 'CodeableConcept' :
                    value = $scope.input.dt['cc'];
                    break;
                case 'ContactPoint' :
                    value = $scope.input.dt['contactpoint'];
                    break;
            }


            addData(dt,angular.copy(value));


        };

        //add a new data element
        var addData = function(dt,value){
            var meta = $scope.selectedNode.data.meta;     //the specific meta node
            //extensions are processed separately...
            if (meta.isExtension) {
                newBuilderSvc.processExtension(meta,dt,value,$scope.resource)
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

            delete $scope.currentDT;        //hide the data entry form...
        };


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
            $scope.resource = {resourceType:'Patient'}
        }

    });

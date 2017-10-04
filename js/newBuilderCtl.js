
angular.module("sampleApp")
    .controller('newBuilderCtrl',
        function ($scope,$http,appConfigSvc,profileCreatorSvc,newBuilderSvc,Utilities) {

        $scope.resource = {resourceType:'Patient'}

        $scope.simpleData = "Test value";
        $scope.complexData = {identifier: {system:'test system',value:'test value'}}

        var url="http://fhirtest.uhn.ca/baseDstu3/StructureDefinition/cf-StructureDefinition-us-core-patient";
        $http.get(url).then(
            function(data) {
                var SD = data.data;
                newBuilderSvc.makeTree(SD).then(
                    function(vo) {

                        //this is functionity to be backported into the makeTree function. Leavinf it here during dev




                        $('#SDtreeView').jstree('destroy');
                        $('#SDtreeView').jstree(
                            {'core': {'multiple': false, 'data': vo.treeData, 'themes': {name: 'proton', responsive: true}}}
                        ).on('select_node.jstree', function (e, data) {

                            delete $scope.selectedNode;

                            if (data.node && data.node.data && data.node.data) {
                                $scope.selectedNode = data.node;
                                processNode($scope.selectedNode);
                            }
                            $scope.$digest();
                        })

                    }
                )

            }
        )


        //once a node has been selected in the tree
        function processNode(node){
            $scope.selectedElement = {};     //what is displayed...
            $scope.selectedElement.meta = node.data.meta;
        }


        //special processing for extensions...
        //note that this will only work for a single instance of each url, at the root level. todo more work is needed to support muktiple
        function processExtension(meta,dt,value) {
            var valueType = 'value' + dt.substr(0,1).toUpperCase()+dt.substr(1)     //ie the value[x]
            console.log(meta,value)
            var ar = meta.path.split('.');

            if (meta.isExtensionChild) {
                //retrieve any extensions with this url. For multiple, use the index within the new node added
                var element = $scope.resource;      //should be able to use this at different levels in the resource...
                var ar = Utilities.getComplexExtensions(element,meta.parentUrl);
                console.log(ar);
                if (ar.length ==0) {
                    //no extensions with this url were found

                    var child = {url:meta.code};
                    child[valueType] = value
                    var insrt = {extension:[child]}
                    Utilities.addExtensionOnceWithReplace($scope.resource,meta.parentUrl,insrt)

                } else {
                    //need to find the one to alter...  Right now, we assume that there is only a single instance of each url
                    //iterate through the children to see if there is one with this code. If so delete it. todo ?can there be multiple with the same code??
                    var ext = ar[0];
                    var pos = -1;
                    ext.children.forEach(function (child,inx) {
                        if (child.url == meta.code) {
                            pos = inx
                        }
                    });
                    if (pos > -1) {
                        ext.children.splice(pos,1);     //delete any existing...
                    }
                    //add the new child...
                    var newChild = {url:meta.code};
                    newChild[valueType] = value
                    ext.children.push(newChild);
                    //now construct the updated complex extension
                    var insrt = {extension:[]}
                    ext.children.forEach(function (child) {
                        insrt.extension.push(child)
                    });
                    //and update...
                    Utilities.addExtensionOnceWithReplace($scope.resource,meta.parentUrl,insrt)

                }



            } else {
                //this is a single, stand alone extension
              //  var extension = {url : meta.url};
              //  var valueType = 'value' + dt.substr(0,1).toUpperCase()+dt.substr(1)
                var extValue = {};
                extValue[valueType]= value
                if (meta.isMultiple) {
                    Utilities.addExtensionMultiple($scope.resource,meta.url,extValue)
                } else {
                    Utilities.addExtensionOnceWithReplace($scope.resource,meta.url,extValue)
                }

            }


        }

        $scope.add = function(dt){

            //testing only! is this simple or complex
            var data = $scope.simpleData;
            if (dt.substr(0,1) == dt.substr(0,1).toUpperCase()) {
                data = $scope.complexData;
            }


            var meta = $scope.selectedElement.meta;     //the specific meta node

            //extensions are processed separately...
            if (meta.isExtension) {
                newBuilderSvc.processExtension(meta,dt,data,$scope.resource)
                return;
            }

            var ar = meta.path.split('.');

            if (ar.length == 2) {
                //this is an element directly off the root.

                var segment = ar[1];        //the segment name
                //if is is not a BBE, then it can be added directly
                if (!meta.isBBE) {
                    if (meta.isMultiple) {
                        $scope.resource[segment] = $scope.resource[segment] || []
                        $scope.resource[segment].push(data)
                    } else {
                        $scope.resource[segment] = data;
                    }



                } else {
                    alert('A Backbone element does not have a value! Select one of the child nodes....')
                }

            }
        }

        $scope.clear = function(){
            $scope.resource = {resourceType:'Patient'}
        }

    })

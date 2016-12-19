
angular.module("sampleApp")
    .controller('builderCtrl',
        function ($scope,$http,appConfigSvc,$q,GetDataFromServer,resourceCreatorSvc,RenderProfileSvc,builderSvc,
                  $timeout,$localStorage,$filter,profileCreatorSvc) {

            $scope.input = {};

            $scope.resourcesBundle = $localStorage.builderBundle || {resourceType:'Bundle',entry:[]}


            $scope.clearAllData = function() {
                $localStorage.builderBundle = {resourceType:'Bundle',entry:[]}//
                $scope.resourcesBundle = $localStorage.builderBundle
                //delete $localStorage.builderBundle;
                makeGraph();
            }

            $scope.removeResource = function(resource) {
                //remove this resource from the bundle

                var inx = -1;
                for (var i=0; i < $localStorage.builderBundle.entry.length; i++) {
                    var r = $localStorage.builderBundle.entry[i].resource;
                    if (r.resourceType == resource.resourceType && r.id == resource.id) {
                        inx = i;
                        break;
                    }
                }
                if (inx > -1) {
                    $localStorage.builderBundle.entry.splice(inx,1);
                    makeGraph();
                    delete $scope.currentResource;
                }

            }

            //generate the graph of resources and references between them
            makeGraph = function() {
                var vo = builderSvc.makeGraph($localStorage.builderBundle)   //todo - may not be the right place...


                //console.log(vo);

                var container = document.getElementById('resourceGraph');
                //var container = $('#resourceGraph');

                var options = {
                    physics: {
                        enabled: true,
                        barnesHut: {
                            gravitationalConstant: -10000,
                        }
                    }
                };


                $scope.chart = new vis.Network(container, vo.graphData, options);

                $scope.chart.on("click", function (obj) {
                    console.log(obj)


                    //$scope.selectResource(entry.resource)


                    var nodeId = obj.nodes[0];  //get the first node
                   // console.log(nodeId,graphData)

                    var node = vo.graphData.nodes.get(nodeId);
                    console.log(node)
                    $scope.selectResource(node.cf.resource)

                    $scope.$digest();
                    //selectedNetworkElement

                });



                
                return;

  /*
                //so that we can draw a table with the references in it...
                $scope.modelReferences = vo.references;
                $scope.uniqueModelsList = vo.lstNodes;


                //console.log($scope.uniqueModelsList)
                var allNodesObj = vo.nodes;
*/
               
            }
            $timeout(function(){
                makeGraph()
            }, 1000);


            $scope.removeReference = function(ref) {
                console.log(ref)
                var path = ref.path;
                var target = ref.targ;
                builderSvc.removeReferenceAtPath($scope.currentResource,path,ref.index)
                makeGraph();    //this will update the list of all paths in this model...
                var url = $scope.currentResource.resourceType+'/'+$scope.currentResource.id;
                $scope.currentResourceRefs = builderSvc.getSrcTargReferences(url)
                
            }

            $scope.redrawChart = function(){
                //$scope.chart.fit();
                $timeout(function(){
                    $scope.chart.fit();
                    console.log('fitting...')
                },1000            )

            }

            //add a segment to the resource at this path
            $scope.addSegment = function(hashPath) {


                //var path = $filter('dropFirstInPath')(hashPath.path);
                var insertPoint = $scope.currentResource;
                var ar = hashPath.path.split('.');
                var rootPath = ar.splice(0,1)[0];

                if (ar.length > 0) {
                    for (var i=0; i < ar.length-1; i++) {  //not the last one... -

                        var segment = ar[i];
                        var fullPath = rootPath
                        for (var j=0; j < i; j++) {
                            fullPath += '.' + ar[j];
                        }

                        //todo - will barf for path length > 2
                        console.log(fullPath)
                        var info = builderSvc.getEDInfoForPath(fullPath)
                        if (info.isMultiple) {
                            insertPoint[segment] = insertPoint[segment] || []
                        } else {
                            insertPoint[segment] = insertPoint[segment] || {}  // todo,need to allow for arrays
                        }



                        insertPoint = insertPoint[segment]
                    }
                    path = ar[ar.length-1];       //this will be the property on the 'last'segment
                }


                //todo - actually, need to find out whether the parent already exists, and whether it is single or multiple...

                var ar1 = hashPath.path.split('.');
                ar1.pop();
                var parentPath = ar1.join('.')
                var edParent = builderSvc.getEDInfoForPath(parentPath)

                if (!edParent) {
                    alert("ED not found for path "+ parentPath)
                }

                if (edParent.max == 1) {
                    insertPoint[path] = {}
                }
                if (edParent.max =='*') {
                    insertPoint[path] = insertPoint[path] || []

                    //insertPoint[path].push({reference:resource.resourceType+'/'+resource.id})
                }

            };


            $scope.selectResource = function(resource) {
                delete $scope.input.text;
                //console.log(resource);
                $scope.currentResource = resource;
                var url = resource.resourceType+'/'+resource.id;
                $scope.currentResourceRefs = builderSvc.getSrcTargReferences(url)


                builderSvc.getSD(resource.resourceType).then(
                //var uri = "http://hl7.org/fhir/StructureDefinition/"+resource.resourceType;
                //GetDataFromServer.findConformanceResourceByUri(uri).then(
                    function(SD) {
                        //console.log(SD);


                        profileCreatorSvc.makeProfileDisplayFromProfile(SD).then(
                            function(vo) {
                                //console.log(vo.treeData)

                                $('#SDtreeView').jstree('destroy');
                                $('#SDtreeView').jstree(
                                    {'core': {'multiple': false, 'data': vo.treeData, 'themes': {name: 'proton', responsive: true}}}
                                ).on('select_node.jstree', function (e, data) {




                                    console.log(data.node);
                                    $scope.hashReferences = {}      //a hash of type vs possible resources for that type
                                    delete $scope.hashPath;

                                    if (data.node && data.node.data && data.node.data.ed) {

                                        var path = data.node.data.ed.path;




                                        //var info = builderSvc.getEDInfoForPath(path)
                                        //console.log(info);
                                        //builderSvc.addNodeAtPath($scope.currentResource,path);



                                        $scope.possibleReferences = [];
                                        var ed = data.node.data.ed;
                                        if (ed.type) {
                                            $scope.hashPath = {path: ed.path};
                                            $scope.hashPath.max = ed.max;
                                            $scope.hashPath.offRoot = true;
                                            //is this path off the root, or a sub path?
                                            var ar = ed.path.split('.');
                                            if (ar.length > 2) {
                                                $scope.hashPath.offRoot = false;



                                            }


                                                //is this a reference?
                                            ed.type.forEach(function(typ){
                                                if (typ.code == 'Reference' && typ.profile) {
                                                    //console.log(typ.profile)
                                                    var type = $filter('getLogicalID')(typ.profile);
                                                    //console.log(type);
                                                    $scope.hashReferences[type] = []
                                                    var ar = builderSvc.getResourcesOfType(type,$scope.resourcesBundle);
//console.log(ar);

                                                    if (ar.length > 0) {
                                                        ar.forEach(function(resource){

                                                            //objReferences[path].ref = ref;
                                                            $scope.hashReferences[type].push(resource);
                                                        })
                                                    }

                                                }
                                            })


                                        }


                                    }



                                    console.log($scope.hashReferences)

                                    $scope.$digest();


                                })
                                
                            }
                        )

                        var objReferences = {}      //a hash of path vs possible resources for that path

                        var references = builderSvc.getReferences(SD); //a list of all possible references by path
                        console.log(references);
                        $scope.bbNodes = [];        //backbone nodes to add
                        $scope.l2Nodes = {};        //a hash of nodes off the root that can have refernces. todo: genaralize for more levels

                            references.forEach(function(ref){
                            var path = ref.path
                            //now to determine if there is an object (or array) at the 'parent' of each node. If there
                            //is, then add it to the list of potential resources to link to. If not, then create
                            //an option that allows the user to add that parent
                            var ar = path.split('.');
                              //  ar.pop();




                         //   var parentPath  = ar.join('.');
                               // parentPath =  $filter('dropFirstInPath')(parentPath);

                                //console.log(parentPath,resource[parentPath])

                            if (ar.length == 2 ) {   //|| resource[parentPath]
                                //so this is a reference off the root
                                objReferences[path] = objReferences[path] || {resource:[],ref:ref}
                                //now find all existing resources with this type
                                var type = $filter('getLogicalID')(ref.profile);
//console.log(type)
                                var ar = builderSvc.getResourcesOfType(type,$scope.resourcesBundle);
                                if (ar.length > 0) {
                                    ar.forEach(function(resource){

                                        //objReferences[path].ref = ref;
                                        objReferences[path].resource.push(resource);
                                    })
                                }
                            } else {
                                if (ar.length == 3) {
                                    //a node off the root...
                                    var segmentName = ar[1];    //eg 'entry' in list
                                    $scope.l2Nodes[segmentName] = $scope.l2Nodes[segmentName] || [];
                                    var el = {path:path,name:ar[2]};    //the element that can be a reference

                                    //we need to find out if the parent node for a reference at this path can repeat...
                                    var parentPath = ar[0]+'.'+ar[1];       //I don;t really like this...

                                    var info = builderSvc.getEDInfoForPath(parentPath);
                                    el.info = info
                                    
                                    $scope.l2Nodes[segmentName].push(el)
                                    
                                    $scope.bbNodes.push({level:2,path:path});
                                }
                                //so this is a reference to an insert point where the parent does not yet exist

                            }





                        })

                        console.log(objReferences)
                        $scope.objReferences = objReferences;

                    }
                )


            };

            $scope.linkToResource = function(pth,resource,ref){



                builderSvc.insertReferenceAtPath($scope.currentResource,pth,resource)

                makeGraph();    //this will update the list of all paths in this model...
                var url = $scope.currentResource.resourceType+'/'+$scope.currentResource.id;
                $scope.currentResourceRefs = builderSvc.getSrcTargReferences(url)

/*
                return;     //<<<<<<<<<< temp


                //reference this resource to the current one
                var path = $filter('dropFirstInPath')(pth);
                var insertPoint = $scope.currentResource;
                var ar = path.split('.');
                if (ar.length > 0) {
                    for (var i=0; i < ar.length-1; i++) {
                        //not the last one... -
                        var segment = ar[i];
                        insertPoint[segment] = insertPoint[segment] || {}  // todo,need to allow for arrays
                        insertPoint = insertPoint[segment]
                    }
                    path = ar[ar.length-1];       //this will be the property on the 'last'segment
                }


                if (ref.max == 1) {
                    insertPoint[path] = {reference:resource.resourceType+'/'+resource.id}
                }
                if (ref.max =='*') {
                    insertPoint[path] = insertPoint[path] || []
                    insertPoint[path].push({reference:resource.resourceType+'/'+resource.id})
                }





                console.log(resource,ref)

                makeGraph();    //this will update the list of all paths in this model...
                var url = $scope.currentResource.resourceType+'/'+$scope.currentResource.id;
                $scope.currentResourceRefs = builderSvc.getSrcTargReferences(url)

                */

            }



            $scope.addNewResource = function(type) {
                var resource = {resourceType : type};
                resource.id = 't'+new Date().getTime();
                resource.text = {status:'generated',div:"<div  xmlns='http://www.w3.org/1999/xhtml'>"+
                    $scope.input.text+'</div>'};
                console.log(resource);
                $scope.resourcesBundle.entry.push({resource:resource});
                $localStorage.builderBundle = $scope.resourcesBundle;
                makeGraph();
            };

            $scope.newTypeSelected = function(item) {
                delete $scope.input.text;
                var type = item.name;
                var uri = "http://hl7.org/fhir/StructureDefinition/"+type;
                GetDataFromServer.findConformanceResourceByUri(uri).then(
                    function(data) {
                        console.log(data);
                        $scope.currentType = data;
                        $scope.references = builderSvc.getReferences($scope.currentType)
                        console.log($scope.references);

                    }
                )

            }

            RenderProfileSvc.getAllStandardResourceTypes().then(
                function(lst) {
                    $scope.resources = lst
                    //console.log($scope.resources);


                }
            );






        });
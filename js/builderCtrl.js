
angular.module("sampleApp")
    .controller('builderCtrl',
        function ($scope,$http,appConfigSvc,$q,GetDataFromServer,resourceCreatorSvc,RenderProfileSvc,builderSvc,
                  $timeout,$localStorage,$filter,profileCreatorSvc,modalService,Utilities,$uibModal) {

            $scope.input = {};
            $scope.input.dt = {};   //data entered as part of populating a datatype
            $scope.appConfigSvc = appConfigSvc;


            //var currentBunbleName = 'builderBundle';        //the name of the

            $scope.supportedDt = ['CodeableConcept','string','code','date','Period','dateTime']

            $scope.currentBundleIndex = 0;     //the index of the bundle currently being used
            if (! $localStorage.builderBundles) {
                $localStorage.builderBundles = [{name:'Default',bundle:{resourceType:'Bundle',entry:[]}}]
            }

            $scope.builderBundles = $localStorage.builderBundles;

            $scope.resourcesBundle = $localStorage.builderBundles[$scope.currentBundleIndex].bundle;



            $scope.newBundle = function() {
                var name = prompt('Name of Bundle');
                if (name) {
                    var newBundle = {name:name,bundle:{resourceType:'Bundle',entry:[]}}
                    $localStorage.builderBundles.push(newBundle);
                    $scope.resourcesBundle = newBundle.bundle;
                    $scope.currentBundleIndex= $localStorage.builderBundles.length -1;
                    makeGraph();
                    delete $scope.currentResource;
                }
            }

            $scope.selectBundle = function(inx){
                $scope.currentBundleIndex = inx;
                $scope.resourcesBundle = $localStorage.builderBundles[$scope.currentBundleIndex].bundle;
                makeGraph();
                delete $scope.currentResource;
            }
            
            $scope.displayMode = 'view';    //options 'new', 'view'

            //displays the data entry screen for adding a datatype value
            $scope.addValueForDt = function(hashPath,dt) {

                if ($scope.supportedDt.indexOf(dt) > -1) {
                    delete $scope.input.dt;

                    $uibModal.open({
                        templateUrl: 'modalTemplates/addPropertyInBuilder.html',
                        size: 'lg',
                        controller: 'addPropertyInBuilderCtrl',
                        resolve : {
                            dt: function () {          //the default config
                                return dt;
                            },
                            hashPath: function () {          //the default config
                                return hashPath;
                            },
                            resource: function () {          //the default config
                                return $scope.currentResource;
                            },
                            vsDetails: function () {          //the default config
                                return $scope.vsDetails;
                            },
                            expandedValueSet: function () {          //the default config
                                return $scope.expandedValueSet;
                            }
                        }
                    })

/*
                    var ar = hashPath.path.split('.');
                    if (ar.length > 3) {
                        modalService.showModal({}, {userText:'Sorry, only elements directly off the root can currently have values.'})
                    } else {
                        $uibModal.open({
                            templateUrl: 'modalTemplates/addPropertyInBuilder.html',
                            size: 'lg',
                            controller: 'addPropertyInBuilderCtrl',
                            resolve : {
                                dt: function () {          //the default config
                                    return dt;
                                },
                                hashPath: function () {          //the default config
                                    return hashPath;
                                },
                                resource: function () {          //the default config
                                    return $scope.currentResource;
                                },
                                vsDetails: function () {          //the default config
                                    return $scope.vsDetails;
                                },
                                expandedValueSet: function () {          //the default config
                                    return $scope.expandedValueSet;
                                }
                            }
                        })

                        //return;


                    }
*/


                }


            };
            //adds a new value to a property
            $scope.saveNewValueDEP = function(){

                console.log($scope.input.dt)
               // $scope.enterPropertyValue = false;
               // return;

                builderSvc.addPropertyValue($scope.currentResource,
                    $scope.hashPathBingEntered,
                    $scope.dataTypeBeingEntered,
                    $scope.input.dt)
                $scope.enterPropertyValue = false;
            };

            //--------- code for CodeableConcept lookup

            /*
           // var url = 'http://clinfhir.com/fhir/ValueSet/'+item.name;
            var url = 'http://hl7.org/fhir/ValueSet/condition-code';
            Utilities.getValueSetIdFromRegistry(url,function(vsDetails) {
                $scope.vsDetails = vsDetails;  //vsDetails = {id: type: resource: }
                console.log(vsDetails);
            })

            */

            $scope.vsLookupDEP = function(text,vs) {

                console.log(text,vs)
                if (vs) {
                    var id = vs.id;
                    $scope.showWaiting = true;
                    return GetDataFromServer.getFilteredValueSet(id,text).then(
                        function(data,statusCode){
                            if (data.expansion && data.expansion.contains) {
                                var lst = data.expansion.contains;
                                return lst;
                            } else {
                                return [
                                    {'display': 'No expansion'}
                                ];
                            }
                        }, function(vo){
                            var statusCode = vo.statusCode;
                            var msg = vo.error;


                            alert(msg);

                            return [
                                {'display': ""}
                            ];
                        }
                    ).finally(function(){
                        $scope.showWaiting = false;
                    });

                } else {
                    return [{'display':'Select the ValueSet to query against'}];
                }
            };


            //edit the resource text
            $scope.editResource = function(resource){

                var modalOptions = {
                    closeButtonText: "Cancel",
                    actionButtonText: 'Save',
                    headerText: 'Edit resource text',
                    bodyText: 'Current text:',
                    userText :   $filter('cleanTextDiv')(resource.text.div)
                };

                 modalService.showModal({}, modalOptions).then(
                    function (result) {
                        console.log(result)
                        if (result.userText) {
                            resource.text.div = $filter('addTextDiv')(result.userText);
                            makeGraph();
                        }


                    }
                 );



            }

            //remove a bundle set...
            $scope.deleteBundle = function(inx) {


                var modalOptions = {
                    closeButtonText: "No, I changed my mind",
                    actionButtonText: 'Yes, please remove',
                    headerText: 'Remove resource set',
                    bodyText: 'Are you sure you wish to remove this resource set?'
                };

                modalService.showModal({}, modalOptions).then(
                    function () {
                        $localStorage.builderBundles.splice(inx)   //delete the bundle
                        $scope.currentBundleIndex = 0; //set the current bundle to the first (default) one
                        if ($localStorage.builderBundles.length == 0) {
                            //no bundles left
                            $localStorage.builderBundles = [{name:'Default',bundle:{resourceType:'Bundle',entry:[]}}]
                        } else {

                        }

                        $scope.resourcesBundle = $localStorage.builderBundles[$scope.currentBundleIndex].bundle;


                        makeGraph();
                        delete $scope.currentResource;

                    }
                );





                //$localStorage.builderBundle = {resourceType:'Bundle',entry:[]}//
                //$scope.resourcesBundle = $localStorage.builderBundle


            }

            $scope.removeResource = function(resource) {
                //remove this resource from the bundle


                var modalOptions = {
                    closeButtonText: "No, don't remove",
                    actionButtonText: 'Yes, please remove',
                    headerText: 'Remove resource',
                    bodyText: 'Are you sure you want to remove this resource (Any references to it will NOT be removed'
                };
/*
                modalService.showModal({}, modalOptions).then(
                    function (result) {
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
                );
                */

                modalService.showModal({}, modalOptions).then(
                    function (result) {
                        var inx = -1;
                        for (var i=0; i < $scope.resourcesBundle.entry.length; i++) {
                            var r = $scope.resourcesBundle.entry[i].resource;
                            if (r.resourceType == resource.resourceType && r.id == resource.id) {
                                inx = i;
                                break;
                            }
                        }
                        if (inx > -1) {
                            $scope.resourcesBundle.entry.splice(inx,1);
                            makeGraph();
                            delete $scope.currentResource;
                        }

                    }
                );


            }

            //generate the graph of resources and references between them
            makeGraph = function() {
                //var vo = builderSvc.makeGraph($localStorage.builderBundle)   //todo - may not be the right place...
                var vo = builderSvc.makeGraph($scope.resourcesBundle)   //todo - may not be the right place...



                var container = document.getElementById('resourceGraph');

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


            $scope.showVSBrowserDialog = {};
            $scope.viewVS = function(uri) {
                //var url = appConfigSvc

                GetDataFromServer.getValueSet(uri).then(
                    function(vs) {
                        console.log(vs)
                        $scope.showVSBrowserDialog.open(vs);

                    }
                ).finally (function(){
                    $scope.showWaiting = false;
                });
            };
            
            //add a segment to the resource at this path
            $scope.addSegmentDEP = function(hashPath) {


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
                //delete $scope.input.text;
                delete $scope.hashPath;
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
                                    delete $scope.expandedValueSet;
                                    delete $scope.currentElementValue;

                                    if (data.node && data.node.data && data.node.data.ed) {

                                        var path = data.node.data.ed.path;


                                        $scope.possibleReferences = [];
                                        var ed = data.node.data.ed;

                                        $scope.currentElementValue = builderSvc.getValueForPath($scope.currentResource,path);
                                        
                                        //get the type information
                                        if (ed.type) {


                                            $scope.hashPath = {path: ed.path};
                                            $scope.hashPath.ed = ed;
                                            //$scope.hashPath.max = ed.max;
                                            $scope.hashPath.definition = ed.definition;
                                            $scope.hashPath.comments = ed.comments;


                                            //get the ValueSet if there is one bound...
                                            if ($scope.hashPath.ed.binding && $scope.hashPath.ed.binding.valueSetReference &&
                                                $scope.hashPath.ed.binding.valueSetReference.reference) {

                                                var url = $scope.hashPath.ed.binding.valueSetReference.reference;
                                                Utilities.getValueSetIdFromRegistry(url,function(vsDetails) {
                                                    $scope.vsDetails = vsDetails;  //vsDetails = {id: type: resource: }
                                                    console.log(vsDetails);
                                                    if ($scope.vsDetails.type == 'list' || ed.type[0].code == 'code') {
                                                        //this has been recognized as a VS that has only a small number of options...
                                                        GetDataFromServer.getExpandedValueSet($scope.vsDetails.id).then(
                                                            function(vs) {
                                                                $scope.expandedValueSet = vs;
                                                                console.log(vs);
                                                            },function(err) {
                                                                alert(err + ' expanding ValueSet')
                                                            }
                                                        )
                                                    }
                                                })
                                            }






                                        /*
                                        $scope.hashPath.offRoot = true;
                                        //is this path off the root, or a sub path?
                                        var ar = ed.path.split('.');
                                        if (ar.length > 2) {
                                            $scope.hashPath.offRoot = false;



                                        }
*/

                                                //is this a reference?
                                            ed.type.forEach(function(typ){
                                                if (typ.code == 'Reference' && typ.profile) {
                                                    $scope.hashPath.isReference = true;
                                                    
                                                    var type = $filter('getLogicalID')(typ.profile);


                                                    
                                                    var ar = builderSvc.getResourcesOfType(type,$scope.resourcesBundle);

                                                    if (ar.length > 0) {
                                                        ar.forEach(function(resource){

                                                            type = resource.resourceType;   //allows for Reference

                                                            $scope.hashReferences[type] = $scope.hashReferences[type] || []
                                                            
                                                            $scope.hashReferences[type].push(resource);
                                                        })
                                                    }

                                                }
                                            })


                                        }


                                    }



                                    //console.log($scope.hashReferences)

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


            }




            $scope.addNewResource = function(type) {
                var resource = {resourceType : type};
                resource.id = 't'+new Date().getTime();
                resource.text = {status:'generated',div:  $filter('addTextDiv')($scope.input.text)};

                console.log(resource);
                $scope.resourcesBundle.entry.push({resource:resource});

                $scope.resourcesBundle.entry.sort(function(a,b){
                    if (a.resource.resourceType > b.resource.resourceType) {
                        return 1
                    } else {
                        return -1
                    }
                })

                $scope.displayMode = 'view';

                $scope.selectResource(resource)
                makeGraph();

                //$scope.selectResource(node.cf.resource)
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
                    


                }
            );






        });
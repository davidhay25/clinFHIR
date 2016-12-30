
angular.module("sampleApp")
    .controller('builderCtrl',
        function ($scope,$http,appConfigSvc,$q,GetDataFromServer,resourceCreatorSvc,RenderProfileSvc,builderSvc,
                  $timeout,$localStorage,$filter,profileCreatorSvc,modalService,Utilities,$uibModal,$rootScope,$firebaseObject) {

            $scope.input = {};
            $scope.input.dt = {};   //data entered as part of populating a datatype
            $scope.appConfigSvc = appConfigSvc;

            var idPrefix = 'cf-';   //prefix for the id. todo should probably be related to the userid in some way...

            $scope.saveToLibrary = function(){

                console.log($localStorage.builderBundles[$scope.currentBundleIndex])
                

               builderSvc.saveToLibrary($localStorage.builderBundles[$scope.currentBundleIndex]).then(
                   function (data) {
                       modalService.showModal({}, {bodyText:'The set has been updated in the Library. You can continue editing.'});
                       refreshLibrary();
                       console.log(data)
                   },function (err) {
                       modalService.showModal({}, {bodyText:'Sorry, there was an error updating the library:' + angular.toJson(err)})
                       console.log(err)
                   }
               );
                
            };

            function refreshLibrary() {
                builderSvc.loadLibrary().then(
                    function(bundle){
                        $scope.library = bundle;    //this is a bundle of DocumentReference resources...

                        //add meta information for display. Makes it a non-lgal resource, but don't really care
                        $scope.library.entry.forEach(function(entry){
                            var dr = entry.resource;
                            //now see if the bundle in the DR is cached locally (the id of the dr is the same as the bundle
                            //var cachedLocally = false;
                            $localStorage.builderBundles.forEach(function (local) {
                                if (local.bundle.id == dr.id) {
                                    dr.meta = dr.meta || {}
                                    dr.meta.cachedLocally = true;
                                }
                            })
                        })

                    }
                );
            }

            refreshLibrary();       //initial load...



            /*
            $scope.showLibrary = function(){
                $scope.leftPaneClass = "col-sm-2 col-md-2"
                $scope.midPaneClass = "col-md-5 col-sm-5"
                $scope.rightPaneClass = "col-md-5 col-sm-5";
                $scope.libraryVisible = true;
            };
            
            */


            //---------- related to document builder -------


            $rootScope.$on('docUpdated',function(event,composition){
                //console.log(composition)
                makeGraph();
            });


            function isaDocument() {
                $scope.isaDocument = false;
                $scope.resourcesBundle.entry.forEach(function(entry){
                    if (entry.resource.resourceType =='Composition') {
                        entry.resource.section = entry.resource.section || [];
                        $scope.compositionResource = entry.resource;
                        $scope.isaDocument= true;

                        $scope.generatedHtml = builderSvc.makeDocumentText($scope.compositionResource,$scope.resourcesBundle)
                        //console.log(html)

                    }
                })
            }
            

            //------------------------------------------------



            //called whenever the auth state changes - eg login/out, initial load, create user etc.
            firebase.auth().onAuthStateChanged(function(user) {
                delete $scope.input.mdComment;
//console.log(user)
                if (user) {
                    $rootScope.userProfile = $firebaseObject(firebase.database().ref().child("users").child(user.uid));

                    //logicalModelSvc.setCurrentUser(user);


                    //return the practitioner resource that corresponds to the current user (the service will create if absent)
                    GetDataFromServer.getPractitionerByLogin(user).then(
                        function(practitioner){
                            console.log(practitioner)
                            $scope.Practitioner = practitioner;

                        },function (err) {
                            alert(err)
                        }
                    );

                    delete $scope.showNotLoggedIn;


                } else {
                    console.log('no user')
                    logicalModelSvc.setCurrentUser(null);
                    $scope.showNotLoggedIn = true;
                    delete $scope.Practitioner;
                    delete $scope.taskOutputs;
                    delete $scope.commentTask;
                    // No user is signed in.
                }
            });



            //var currentBunbleName = 'builderBundle';        //the name of the

            $scope.supportedDt = ['CodeableConcept','string','code','date','Period','dateTime','Address','HumanName']

            $scope.currentBundleIndex = 0;     //the index of the bundle currently being used

            if (! $localStorage.builderBundles) {

                //modalService.showModal({}, {bodyText:'To get started, either create a new set or download one from the Library.'});
                $localStorage.builderBundles = []
                $scope.currentBundleIndex = -1;

               // var newBundle = {name:'Default',bundle:{resourceType:'Bundle',entry:[]}}
               // newBundle.bundle.id = idPrefix +new Date().getTime();
               // $localStorage.builderBundles = [newBundle]
            } else {
                if ($localStorage.builderBundles.length > 0) {
                    $scope.resourcesBundle = $localStorage.builderBundles[$scope.currentBundleIndex].bundle;
                    builderSvc.setAllResourcesThisSet($localStorage.builderBundles[$scope.currentBundleIndex].bundle);
                    isaDocument();
                }

            }

            $scope.builderBundles = $localStorage.builderBundles;   //all the bundles cached locally...

            //$scope.resourcesBundle = $localStorage.builderBundles[$scope.currentBundleIndex].bundle;


            console.log($localStorage.builderBundles)

            //set the base path for linking to the spec
            switch (appConfigSvc.getCurrentConformanceServer().version) {
                case 2:
                    $scope.fhirBasePath="http://hl7.org/fhir/";
                    break;
                case 3:
                    $scope.fhirBasePath="http://build.fhir.org/";
                    break;
            }


            $scope.newBundle = function() {
                var name = prompt('Name of Bundle');
                if (name) {
                    delete $scope.isaDocument
                    var newBundle = {name:name,bundle:{resourceType:'Bundle',entry:[]}}
                    newBundle.bundle.id = idPrefix+new Date().getTime();
                    $localStorage.builderBundles.push(newBundle);
                    $scope.resourcesBundle = newBundle.bundle;
                    $scope.currentBundleIndex= $localStorage.builderBundles.length -1;
                    makeGraph();
                    delete $scope.currentResource;
                    $rootScope.$emit('newSet',newBundle);
                }
            };

            $scope.selectLibraryEntry = function(entry,inx){
                //console.log(entry);
                $scope.selectedLibraryEntry = entry;
                $scope.selectedLibraryEntry.bundle =  angular.fromJson(atob(entry.resource.content[0].attachment.data));  //todo not safe

            };

            $scope.downloadFromLibrary = function(entry,inx){
                //note that the entry is a DocumentReference with a contained bundle as an attachment...
                var dr = entry.resource;
                var bundle = angular.fromJson(atob(dr.content[0].attachment.data));   //todo - not safe!
                var id = bundle.id;

                //see if this set (based on the id) already exists.
                var alreadyLocal = false;
                $localStorage.builderBundles.forEach(function (item,inx) {
                    if (item.bundle.id == id) {
                        alreadyLocal = true;
                        modalService.showModal({}, {bodyText:'There is already a copy of this set downloaded. Selecting it now.'});
                        $scope.resourcesBundle = item.bundle;
                        $scope.currentBundleIndex= inx;
                        $scope.libraryVisible = false;
                    }
                });

                if (! alreadyLocal) {
                    var newBundle = {name:dr.description,bundle:bundle}
                    $localStorage.builderBundles.push(newBundle);
                    $scope.resourcesBundle = newBundle.bundle;

                    $scope.currentBundleIndex= $localStorage.builderBundles.length -1;
                    builderSvc.setAllResourcesThisSet($localStorage.builderBundles[$scope.currentBundleIndex].bundle);
                    makeGraph();
                    delete $scope.currentResource;
                    $scope.libraryVisible = false;
                    isaDocument();      //see if this set is a document (has a Composition resource)
                    modalService.showModal({}, {bodyText:'The set has been downloaded from the Library. You can now edit it locally.'});
                }


            };

            $scope.selectBundle = function(inx){
                $scope.currentBundleIndex = inx;
                $scope.resourcesBundle = $localStorage.builderBundles[$scope.currentBundleIndex].bundle;
                builderSvc.setAllResourcesThisSet($localStorage.builderBundles[$scope.currentBundleIndex].bundle);
                makeGraph();
                delete $scope.currentResource;
                isaDocument();      //determine if this bundle is a document (has a Composition resource)
                $rootScope.$emit('newSet',$scope.resourcesBundle);
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
                            $rootScope.$emit('resourceEdited',resource);
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
                        $rootScope.$emit('newSet');
                        delete $scope.currentResource;
                        $localStorage.builderBundles.splice(inx)   //delete the bundle
                        $scope.currentBundleIndex = 0; //set the current bundle to the first (default) one
                        if ($localStorage.builderBundles.length == 0) {
                            //no bundles left
                            $localStorage.builderBundles = []
                            delete $scope.resourcesBundle;
                        } else {
                            $scope.resourcesBundle = $localStorage.builderBundles[$scope.currentBundleIndex].bundle;
                            makeGraph();
                        }




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
                    bodyText: 'Are you sure you want to remove this resource (Any references to it will NOT be removed)'
                };
                
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


            };

            //generate the graph of resources and references between them
            makeGraph = function() {
                if ($scope.resourcesBundle) {
                    var vo = builderSvc.makeGraph($scope.resourcesBundle)   //todo - may not be the right place...
                    $scope.allReferences = vo.allReferences;                //all references in the entire set.
                    //console.log($scope.allReferences)
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
                        //console.log(obj)


                        //$scope.selectResource(entry.resource)


                        var nodeId = obj.nodes[0];  //get the first node
                        // console.log(nodeId,graphData)


                        var node = vo.graphData.nodes.get(nodeId);
                        console.log(node)
                        $scope.selectResource(node.cf.resource)

                        $scope.$digest();
                        

                    });
                }



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
                    if ($scope.chart) {
                        $scope.chart.fit();
                        console.log('fitting...')
                    }

                },1000)

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
                $scope.displayMode = 'view';

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
                                                    if ($scope.vsDetails) {
                                                        if ($scope.vsDetails.type == 'list' || ed.type[0].code == 'code') {
                                                            //this has been recognized as a VS that has only a small number of options...
                                                            GetDataFromServer.getExpandedValueSet($scope.vsDetails.id).then(
                                                                function (vs) {
                                                                    $scope.expandedValueSet = vs;
                                                                    console.log(vs);
                                                                }, function (err) {
                                                                    alert(err + ' expanding ValueSet')
                                                                }
                                                            )
                                                        }
                                                    }

                                                })
                                            }



                                            ed.type.forEach(function(typ){
                                                //is this a reference?
                                                if (typ.code == 'Reference' && typ.profile) {
                                                    //get all the resources of this type  (that are not already referenced by this element
                                                    $scope.hashPath.isReference = true;
                                                    
                                                    var type = $filter('getLogicalID')(typ.profile);

                                                    var ar = builderSvc.getResourcesOfType(type,$scope.resourcesBundle);

                                                    if (ar.length > 0) {
                                                        ar.forEach(function(resource){
                                                            var reference = builderSvc.referenceFromResource(resource); //get the reference (type/id)

                                                            //search all the references for ones from this path. Don't include them in the list
                                                            //$scope.allReferences created when the graph is built...
                                                            var alreadyReferenced = false;
                                                            $scope.allReferences.forEach(function(ref){
                                                                //console.log(ref)
                                                                if (ref.path == path) {

                                                                    if (ref.targ == reference) {
                                                                        alreadyReferenced = true;
                                                                    }

                                                                    //console.log('>>' + ref.targ)
                                                                }

                                                            });


                                                            if (! alreadyReferenced) {
                                                                 type = resource.resourceType;   //allows for Reference
                                                                 $scope.hashReferences[type] = $scope.hashReferences[type] || []
                                                                 $scope.hashReferences[type].push(resource);
                                                            }

                                                        })
                                                    }

                                                }
                                            })


                                        }


                                    }




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

                if (pth == 'Composition.section.entry') {
                    modalService.showModal({}, {bodyText:'Use the special Document controls (middle panel, Document tab) to add sections to the composition'});
                    return;
                }


                builderSvc.insertReferenceAtPath($scope.currentResource,pth,resource)

                makeGraph();    //this will update the list of all paths in this model...
                var url = $scope.currentResource.resourceType+'/'+$scope.currentResource.id;
                $scope.currentResourceRefs = builderSvc.getSrcTargReferences(url)



                //now remove the reference from the list of possibilities...


                var type = resource.resourceType;   //allows for Reference
                var pos = -1;
                $scope.hashReferences[type].forEach(function(res,inx){
                    if (res.id == resource.id) {
                        pos = inx;
                    }
                })

                if (pos > -1) {
                    $scope.hashReferences[type].splice(pos,1);
                   // if ()
                }


               // $scope.hashReferences[type] = $scope.hashReferences[type] || []
               // $scope.hashReferences[type].push(resource);




            }
            
            $scope.addNewResource = function(type) {

                if (type == 'Composition') {
                    if ($scope.isaDocument) {
                        modalService.showModal({}, {bodyText:'There is already a Composition in this set - and there can only be one.'});
                        $scope.displayMode = 'view';
                        return;
                    }

                }

                var resource = {resourceType : type};
                resource.id = idPrefix+new Date().getTime();
                $scope.input.text = $scope.input.text || "";
                resource.text = {status:'generated',div:  $filter('addTextDiv')($scope.input.text)};

                //console.log(resource);

                builderSvc.addResourceToAllResources(resource)

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






                isaDocument();      //determine if this bundle is a document (has a Composition resource)

                $rootScope.$emit('addResource',resource);


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
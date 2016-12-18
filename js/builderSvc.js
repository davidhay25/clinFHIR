angular.module("sampleApp")
    //this returns config options. At the moment it is for servers...
    //also holds the current patient and all their resources...
    //note that the current profile is maintained by resourceCreatorSvc

    .service('builderSvc', function($http,$q,appConfigSvc,GetDataFromServer,Utilities,$filter) {

        var gAllReferences = []
        var gSD = {};   //a has of all SD's reas this session by type

        return {
            insertReferenceAtPath : function(resource,path,referencedResource) {


                console.log(resource,path,referencedResource);
                var info = this.getEDInfoForPath(path);

                var segmentPath = resource.resourceType;

                //var rootPath = $filter('dropFirstInPath')(path);
                var path = $filter('dropFirstInPath')(path);
                var insertPoint = resource;
                var ar = path.split('.');
                if (ar.length > 0) {
                    for (var i=0; i < ar.length-1; i++) {
                        //not the last one... -
                        var segment = ar[i];


                        segmentPath += '.'+segment;
                        console.log(segmentPath)

                        var segmentInfo = this.getEDInfoForPath(segmentPath);

                        if (segmentInfo.isMultiple) {
                            insertPoint[segment] = insertPoint[segment] || []  // todo,need to allow for arrays
                            var node = {};
                            insertPoint[segment].push(node)
                            insertPoint = node
                        } else {
                            insertPoint[segment] = insertPoint[segment] || {}  // todo,need to allow for arrays
                            insertPoint = insertPoint[segment]
                        }




                    }
                    path = ar[ar.length-1];       //this will be the property on the 'last'segment
                }




                if (info.max == 1) {
                    insertPoint[path] = {reference:referencedResource.resourceType+'/'+referencedResource.id}
                }
                if (info.max =='*') {
                    insertPoint[path] = insertPoint[path] || []
                    insertPoint[path].push({reference:referencedResource.resourceType+'/'+referencedResource.id})
                }


                return;


                var that = this;
                var info = this.getEDInfoForPath(path);
                console.log(path);

                var insertPoint = resource;
                var ar = path.split('.');
                var rootPath = ar.splice(0,1)[0];

                if (ar.length > 0) {
                    for (var i=0; i <= ar.length-1; i++) {

                        var segment = ar[i];
                        var fullPath = rootPath
                        for (var j=0; j <= i; j++) {
                            fullPath += '.' + ar[j];
                        }

                        //todo - will barf for path length > 2
                        console.log(fullPath)
                        var info = that.getEDInfoForPath(fullPath)

                        if (info.isMultiple) {
                        
                            insertPoint[segment] = insertPoint[segment] || []

                        } else {
                            insertPoint[segment] = insertPoint[segment] || {}  // todo,need to allow for arrays
                        }



                        insertPoint = insertPoint[segment]
                    }
                    path = ar[ar.length-1];       //this will be the property on the 'last'segment
                }



            },
            getSD : function(type) {
                var deferred = $q.defer();

                if (gSD[type]) {
                    deferred.resolve(gSD[type])
                } else {
                    var uri = "http://hl7.org/fhir/StructureDefinition/"+type;
                    GetDataFromServer.findConformanceResourceByUri(uri).then(
                        function(SD) {
                            gSD[type] = SD;
                            deferred.resolve(SD);
                        },function(err){
                            deferred.reject(err)
                        })
                }
                
                return deferred.promise;
            },
            getEDInfoForPath : function(path) {
                var ar = path.split('.');
                var type = ar[0];       //the resource type is the first segment in the path
                var SD = gSD[type];     //it must have been read at this point...
                var info = {};          //this will be the info about this element...

                //find the path
                if (SD.snapshot && SD.snapshot.element) {
                    SD.snapshot.element.forEach(function (ed) {

                        if (ed.path == path) {
                            info.max = ed.max;
                            if (ed.max == '*') {
                                info.isMultiple = true
                            }
                            

                        }
                    })
                    
                }
                return info;

            },
            getDetailsByPathForResource : function(resource) {
                //return a hash by path for the given resource indicating multiplicty at that point. Used for creating references...
                //var type = resource.resourceType;
                var deferred = $q.defer();
                var uri = "http://hl7.org/fhir/StructureDefinition/" + resource.resourceType;
                GetDataFromServer.findConformanceResourceByUri(uri).then(
                    function (SD) {
                        console.log(SD);
                        var hash = {}
                        if (SD && SD.snapshot && SD.snapshot.element) {
                            SD.snapshot.element.forEach(function (ed) {
                                var path = ed.path;
                                var detail = {};        //key details about this path
                                if (ed.max == '*') {
                                    detail.multiple = true;
                                }
                                hash[path]=detail;
                            })
                        }

                    },
                    function (err) {
console.log(err);
                        deferred.reject(err)
                    })
                return deferred.promise;
            },
            getSrcTargReferences : function(url) {
                //get all the references to & from the resource
                var vo = {src:[],targ :[]}
                gAllReferences.forEach(function(ref){
                    if (ref.src == url) {
                        vo.src.push(ref)
                    }
                    if (ref.targ == url) {
                        vo.targ.push(ref)
                    }
                })
                return vo;
            },
            getReferencesFromResourceDEP : function(resource) {
                var refs = [];
                findReferences(refs,resource,resource.resourceType)
                return refs;

                //find elements of type refernce at this level
                function findReferences(refs,node,nodePath) {
                    angular.forEach(node,function(value,key){
                        //console.log(key,value);
                        //if it's an object, does it have a child called 'reference'?
                        if (angular.isObject(value)) {
                            if (value.reference) {
                                //this is a reference!
                                //console.log('>>>>>>>>'+value.reference)
                                var lpath = nodePath + '.' + key;
                                refs.push({path:lpath,reference : value.reference})
                            } else {
                                //if it's not a reference, then does it have any children?
                                findReferences(refs,value,lpath)
                            }
                        }
                        if (angular.isArray(value)) {
                            value.forEach(function(obj){
                                //examine each element in the array

                                if (obj.reference) {
                                    //this is a reference!
                                    //console.log('>>>>>>>>'+value.reference)
                                    var lpath = nodePath + '.' + key;
                                    refs.push({path:lpath,reference : obj.reference})
                                } else {
                                    //if it's not a reference, then does it have any children?
                                }
                            })


                        }



                    })
                }

            },
            makeGraph : function(bundle) {
                //builds the model that has all the models referenced by the indicated SD, recursively...
                //console.log(SD)
                var that = this;
                var allReferences = [];
                gAllReferences.length = 0;

                var allResources = {};  //all resources hash by id

                var arNodes = [], arEdges = [];
                var objNodes = {};
                
                //for each entry in the bundle, find the resource that it references
                bundle.entry.forEach(function(entry){
                    //console.log(entry);
                    var resource = entry.resource;
                    var url = resource.resourceType+'/'+resource.id;

                    //add an entry to the node list for this resource...
                    var node = {id: arNodes.length +1, label: resource.resourceType, shape: 'box',url:url,cf : {resource:resource}};
                    arNodes.push(node);
                    objNodes[node.url] = node;

                    //var refs = that.getReferencesFromResource(resource)

                    var refs = [];
                    findReferences(refs,resource,resource.resourceType)

                    refs.forEach(function(ref){
                        allReferences.push({src:node,path:ref.path,targ:ref.reference})
                        gAllReferences.push({src:url,path:ref.path,targ:ref.reference});    //all relationsin the collection
                    })


                });


                //so now we have the references, build the graph model...
                allReferences.forEach(function(ref){
                    var targetNode = objNodes[ref.targ];
                    if (targetNode) {
                        var label = $filter('dropFirstInPath')(ref.path);
                        arEdges.push({from: ref.src.id, to: targetNode.id, label: label,arrows : {to:true}})
                    } else {
                        console.log('>>>>>>> error Node Id '+ref.targ + ' is not present')
                    }

                });

                var nodes = new vis.DataSet(arNodes);
                var edges = new vis.DataSet(arEdges);

                // provide the data in the vis format
                var data = {
                    nodes: nodes,
                    edges: edges
                };

                return {graphData : data};

                //find elements of type refernce at this level
                function findReferences(refs,node,nodePath) {
                    angular.forEach(node,function(value,key){
                        //console.log(key,value);
                        //if it's an object, does it have a child called 'reference'?
                        if (angular.isObject(value)) {
                            if (value.reference) {
                                //this is a reference!
                                console.log('>>>>>>>>'+value.reference)
                                var lpath = nodePath + '.' + key;
                                refs.push({path:lpath,reference : value.reference})
                            } else {
                                //if it's not a reference, then does it have any children?
                                findReferences(refs,value,lpath)
                            }
                        } else if (angular.isArray(value)) {
                            value.forEach(function(obj){
                                //examine each element in the array

                                if (obj.reference) {
                                    //this is a reference!
                                    //console.log('>>>>>>>>'+value.reference)
                                    var lpath = nodePath + '.' + key;
                                    refs.push({path:lpath,reference : obj.reference})
                                } else {
                                    //if it's not a reference, then does it have any children?
                                }
                            })


                        }

                    })
                }


                /*
                
                getModelReferences(lst,SD,SD.url);      //recursively find all the references between models...

                console.log(lst);

                //build the tree model...




                lst.forEach(function(reference){

                    var srcNode = getNodeByUrl(reference.src,reference.path,objNodes,arNodes);
                    var targNode = getNodeByUrl(reference.targ,reference.path,objNodes,arNodes);

                    var ar = reference.path.split('.');
                    var label = ar.pop();
                    //ar.splice(0,1);
                    //var label = ar.join('.');
                    arEdges.push({from: srcNode.id, to: targNode.id, label: label,arrows : {to:true}})

                })


                var nodes = new vis.DataSet(arNodes);
                var edges = new vis.DataSet(arEdges);

                // provide the data in the vis format
                var data = {
                    nodes: nodes,
                    edges: edges
                };

                //construct an object that is indexed by nodeId (for the model selection from the graph
                var nodeObj = {};
                arAllModels = []; //construct an array of all the models references by this one
                arNodes.forEach(function(node){
                    nodeObj[node.id] = node;
                    arAllModels.push({url:node.url})
                });






                return {references:lst,graphData:data, nodes : nodeObj,lstNodes : arAllModels};

                function getNodeByUrl(url,label,nodes) {
                    if (nodes[url]) {
                        return nodes[url];
                    } else {
                        var ar = url.split('/')
                        //var label =
                        var node = {id: arNodes.length +1, label: ar[ar.length-1], shape: 'box',url:url};
                        if (arNodes.length == 0) {
                            //this is the first node
                            node.color = 'green'
                            node.font = {color:'white'}
                        }


                        nodes[url] = node;
                        arNodes.push(node);
                        return node;
                    }
                }


                function getModelReferences(lst,SD,srcUrl) {
                    var treeData = that.createTreeArrayFromSD(SD);

                    treeData.forEach(function(item){

                        if (item.data) {
                            //console.log(item.data.referenceUri);
                            if (item.data.referenceUri) {
                                var ref = {src:srcUrl, targ:item.data.referenceUri, path: item.data.path}
                                lst.push(ref);
                                var newSD = that.getModelFromBundle(bundle,item.data.referenceUri);
                                if (newSD) {
                                    getModelReferences(lst,newSD,newSD.url)
                                }

                            }
                        }
                    })

                }

*/

            },
            getResourcesOfType : function(type,bundle){
                //get all the resources in the bundle of the given type
                var ar = [];
                bundle.entry.forEach(function(entry){
                    var resource = entry.resource;
                    if (resource.resourceType == type || type == 'Resource') {
                        ar.push(resource);
                    }
                })
                return ar;
            },
            getReferences: function (SD) {
                //get all the references for a StructureDefinition

                var references = []
                if (SD && SD.snapshot && SD.snapshot.element) {
                    SD.snapshot.element.forEach(function(ed){
                        if (ed.type) {
                            ed.type.forEach(function(type){
                                if (type.code == 'Reference') {
                                    if (type.profile) {

                                        

                                        //note that profile can be an array or a string
                                        if (angular.isArray(type.profile)) {
                                            references.push({path:ed.path,profile:type.profile[0].profile,min:ed.min, max:ed.max})
                                        } else {
                                            references.push({path:ed.path,profile:type.profile,min:ed.min, max:ed.max})
                                        }
                                    }
                                }
                            })
                        }
                    })
                }
                return references;
            }
        }
        
    })
angular.module("sampleApp")
    //this returns config options. At the moment it is for servers...
    //also holds the current patient and all their resources...
    //note that the current profile is maintained by resourceCreatorSvc

    .service('builderSvc', function($http,$q,appConfigSvc,GetDataFromServer,Utilities) {
      
        return {
            makeGraph : function(bundle) {
                //builds the model that has all the models referenced by the indicated SD, recursively...
                //console.log(SD)
                var that = this;
                var allReferences = [];

                var allResources = {};  //all resources hash by id

                var arNodes = [], arEdges = [];
                var objNodes = {};
                
                //for each entry in the bundle, find the resource that it references
                bundle.entry.forEach(function(entry){
                    console.log(entry);
                    var resource = entry.resource;
                    var url = resource.resourceType+'/'+resource.id;

                    //add an entry to the node list for this resource...
                    var node = {id: arNodes.length +1, label: resource.resourceType, shape: 'box',url:url};
                    arNodes.push(node);
                    objNodes[node.url] = node;
                   // allResources[resource.resourceType+'/'+resource.id] =

                    var refs = [];
                    findReferences(refs,resource,resource.resourceType)

                    refs.forEach(function(ref){
                        allReferences.push({src:node,path:ref.path,targ:ref.reference})
                    })


                })


                //so now we have the references, build the graph model...
                allReferences.forEach(function(ref){
                    var targetNode = objNodes[ref.targ];
                    arEdges.push({from: ref.src.id, to: targetNode.id, label: ref.path,arrows : {to:true}})
                })

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
                        console.log(key,value);
                        //if it's an object, does it have a child called 'reference'?
                        if (angular.isObject(value)) {
                            if (value.reference) {
                                //this is a reference!
                                console.log('>>>>>>>>'+value.reference)
                                var lpath = nodePath + '.' + key;
                                refs.push({path:lpath,reference : value.reference})
                            }
                        }



                    })
                }


                
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



            },
            getResourcesOfType : function(type,bundle){
                //get all the resources in the bundle of the given type
                var ar = [];
                bundle.entry.forEach(function(entry){
                    var resource = entry.resource;
                    if (resource.resourceType == type) {
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
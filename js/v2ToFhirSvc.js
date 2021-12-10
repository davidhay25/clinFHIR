angular.module("sampleApp")
    .service('v2ToFhirSvc', function($filter,$q,$http) {

        var objColours ={};
        objColours.Patient = '#93FF1A';
        objColours.Composition = '#E89D0C';
        objColours.Encounter = '#E89D0C';
        objColours.List = '#ff8080';
        objColours.Observation = '#FFFFCC';
        objColours.ValueSet = '#FFFFCC';
        objColours.Practitioner = '#FFBB99';
        objColours.MedicationStatement = '#ffb3ff';
        objColours.MedicationRequest = '#ffb3ff';
        objColours.CarePlan = '#FF9900';
        objColours.Sequence = '#FF9900';
        objColours.CareTeam = '#FFFFCC';
        objColours.Condition = '#cc9900';
        objColours.LogicalModel = '#ff8080';
        objColours.ServiceRequest = '#ff8080';
        objColours.Composition = '#ff8080';
        objColours.Organization = '#FF9900';
        objColours.ProviderRole = '#FFFFCC';
        objColours.Location = '#cc9900';
        objColours.HealthcareService = '#FFFFCC';
        objColours.MedicationDispense = '#FFFFCC';
        //objColours.Composition = '#FFFFCC';
        objColours.Medication = '#FF9900';
        objColours.Measure = '#FF9900';
        objColours.Task = '#FF9900';
        objColours.Immunization = '#aeb76c';

        return {
            makeObservationsHash : function(bundle){
                let hash = {}
                if (bundle.entry){
                    bundle.entry.forEach(function (entry) {
                        let resource = entry.resource
                        if (resource.resourceType == "Observation") {
                            let code = "unknown"
                            cc = {}
                            if (resource.code && resource.code.coding) {
                                code = resource.code.coding[0].code
                                cc = resource.code.coding[0]
                            }
                            hash[code] = hash[code] || {code:cc,resources:[]}
                            hash[code].resources.push(resource)
                        }

                    })
                }

                //within each code, sort by date
                Object.keys(hash).forEach(function (code){

                    hash[code].resources.sort(function(o1,o2){
                        let date1 = o1.effectiveDateTime;
                        let date2 = o2.effectiveDateTime;
                        if (date1 && date2) {
                            if (o1.effectiveDateTime > o2.effectiveDateTime) {
                                return -1
                            } else {
                                return 1
                            }
                        } else {
                            return 0
                        }


                    })
                })



                return hash

            },
            validateBundleDEP : function(validationServer,bundle) {
                //validate the contents of a bundle by making separate calls for each resource in it...
                let deferred = $q.defer();
                let arQuery = [];
                let arResult = [];

                bundle.entry.forEach(function (entry) {
                    if (entry.resource) {
                        let resource = entry.resource;
                        let url = validationServer.url + resource.resourceType + "/$validate"
                        arQuery.push(validate(url,resource))
                    }

                });


                $q.all(arQuery).then(
                    function(data){
                        console.log(data.data)
                        deferred.resolve(arResult)
                    },function(err) {

                    }
                );

                function validate(url,resource) {
                    let deferred = $q.defer();
                    console.log(url)
                    $http.post(url,resource).then(
                        function(data) {

                        },
                        function(err) {

                        }
                    )

                }



            },
            buildResourceTree: function (resource) {
                //pass in a resource instance...
                if (! resource) {
                    //function is also called when clicking on the space between resources...
                    return;
                }
                let tree = [];
                let idRoot = 0;

                function processNode(tree, parentId, element, key, level,pathRoot) {

                    if (angular.isArray(element)) {
                        var aNodeId1 = getId();
                        var newLevel = level++;
                        var data = {key:key, element:element,level:newLevel,path:pathRoot+'.'+key}
                        var newNode1 = {id: aNodeId1, parent: parentId, data:data, text: key, state: {opened: true, selected: false}};
                        tree.push(newNode1);

                        newLevel++
                        element.forEach(function (child, inx) {
                            processNode(tree, aNodeId1, child, '[' + inx + ']',newLevel,pathRoot+'.'+key);
                        })

                    } else if (angular.isObject(element)) {
                        var newLevel = level++;
                        var oNodeId = getId();
                        var data = {key:key, element:element,level:newLevel,path:pathRoot+'.'+key}
                        var newNode2 = {id: oNodeId, parent: parentId, data: data, text: key, state: {opened: true, selected: false}};



                        tree.push(newNode2);

                        //var newLevel = level++;
                        newLevel++;
                        angular.forEach(element, function (child, key1) {
                            processNode(tree, oNodeId, child, key1,newLevel,pathRoot+'.'+key);

                        })
                    } else {

                        //http://itsolutionstuff.com/post/angularjs-how-to-remove-html-tags-using-filterexample.html
                        //strip out the html tags... - elemenyt is not always a string - bit don't care...
                        try {
                            if (element.indexOf('xmlns=')>-1) {
                                element = element.replace(/<[^>]+>/gm, ' ')
                            }
                        } catch (ex) {

                        }

                        var display = key + " " + '<strong>' + element + '</strong>';
                        var data = {key:key, element:element,level:level,path:pathRoot+'.'+key}

                        var newNode = {
                            id: getId(),
                            parent: parentId,
                            data:data,
                            text: display,
                            state: {opened: true, selected: false}
                        };

                        if (display.substr(0,2) !== '$$'){
                            tree.push(newNode);
                        }

                    }

                }


                var rootId = getId();
                var rootItem = {id: rootId, parent: '#', text: resource.resourceType, state: {opened: true, selected: true}}
                tree.push(rootItem);

                angular.forEach(resource, function (element, key) {
                    processNode(tree, rootId, element, key, 1,resource.resourceType);
                });


                return tree;

                //generate a new ID for an element in the tree...
                function getId() {
                    idRoot++;
                    return idRoot;

                }


            },
            makeGraphCanonical : function (bundle) {
                //make a graph using canonical references

                //this is a hash of all resources in the bundle with a url.
                //It will be used by the canonical reference function (if an element has a value in this hash key, it is considered a canonical reference)

                let hashResources = {}
                bundle.entry.forEach(function (entry) {
                    let resource = entry.resource;
                    if (resource.url) {
                        hashResources[resource.url] = resource
                    }
                })

                let refs = []
                bundle.entry.forEach(function (entry) {
                    let resource = entry.resource;
                    switch (resource.resourceType) {
                        case 'Measure' :
                        case 'Library' :
                            processResource(hashResources,resource,refs)
                            break
                    }
                    //console.log(entry.resource.url)
                })


                //console.log(refs)
                //refs = array {source, target, path, url}

                //now that we have the references, we can construct the graph.
                //first create a hash of all nodes / resources to beincluded
                let hashAllNodes = {}
                let arEdges = [], arNodes = []
                let inx = 0
                let hashRefsByResource = {}     //a hash of all the canonical references from a resource. Used for display...
                refs.forEach(function (ref){

                    hashRefsByResource[ref.source.id] = hashRefsByResource[ref.source.id] || []

                    hashRefsByResource[ref.source.id].push({path:ref.path,url:ref.url,type:ref.target.resourceType})

                    let sourceNodeIndex = hashAllNodes[ref.source.id]
                    if (! sourceNodeIndex) {
                        sourceNodeIndex = inx++
                        hashAllNodes[ref.source.id] = sourceNodeIndex
                        arNodes.push({id: sourceNodeIndex, label: ref.source.resourceType,
                            shape: 'box',resource:ref.source})
                    }
                    let targetNodeIndex = hashAllNodes[ref.target.id]
                    if (! targetNodeIndex){
                        targetNodeIndex = inx++
                        hashAllNodes[ref.target.id] = targetNodeIndex
                        arNodes.push({id: targetNodeIndex, label: ref.target.resourceType,
                            shape: 'box',color:objColours[ ref.target.resourceType], resource:ref.target})
                    }
                    //now we can create the link between source and target...
                    if (sourceNodeIndex !== targetNodeIndex) {
                        arEdges.push({id: 'e' + arEdges.length +1,from: sourceNodeIndex, to: targetNodeIndex, label: ref.path,arrows : {to:true}})
                    }
                })

                nodes = new vis.DataSet(arNodes);
                edges = new vis.DataSet(arEdges);
                var data = {
                    nodes: nodes,
                    edges: edges
                };

                return ({graphData: data,hashRefsByResource : hashRefsByResource})

                function processResource(hashResources,resource,refs) {
                    let debug = false
                    //console.log('-----------')
                    //console.log(resource.resourceType + "   " + resource.id)

                    //let refs = []
                    function processBranch(refs,parentPath,branch) {
                        Object.keys(branch).forEach(function (key) {
                            let element = branch[key]
                            let typ = typeof(element)

                            switch (typ) {
                                case "object" :
                                    if (Array.isArray(element)){
                                        if (debug) {console.log(parentPath, key,'array',element.length)}
                                        element.forEach(function (child) {
                                            let path = parentPath + "." + key
                                            //console.log('child',path,child,)
                                            //if the content of the array element is a string, then forEach will iterate over each character
                                            if (typeof(child) == 'string') {
                                                if (debug) {console.log('---leaf:',path,child)}
                                                if (hashResources[child]) {
                                                    //the assumption is that this is a canonical reference...
                                                    let item={source:resource, path:path,url:child,target : hashResources[child]}
                                                    refs.push(item)
                                                }
                                            } else {
                                                processBranch(refs,path,child)
                                            }
                                        })
                                    } else {
                                        if (debug) {console.log(parentPath, key,'object')}
                                        let path = parentPath + "." + key
                                        processBranch(refs,path,element)
                                    }
                                    break
                                case "string" :
                                    //want the value...
                                    let path = parentPath + '.' + key
                                    if (hashResources[element]) {
                                        //the assumption is that this is a canonical reference...
                                        let item={source:resource, path:path,url:element,target : hashResources[element]}
                                        refs.push(item)
                                    }

                                    let display = element.substr(0,80)
                                    if (debug) {console.log('---leaf:',path,display)}
                                    //console.log(key,element)
                                    break
                                default :
                                    if (debug) {console.log('===========>',key,typ)}

                            }
                            //console.log(key, typeof(element) )
                        })

                    }
                    processBranch(refs,resource.resourceType,resource)

                    console.log(refs)

                }




            },
            makeGraph: function (options) {
                //makeGraph: function (bundle,hashErrors,serverRoot,hidePatient,centralResourceId) {

                let bundle = options.bundle;

                if (!bundle || ! bundle.entry) {
                    return {graphData : {}, allReferences:[], nodes: {}, visNodes:{},visEdges:{}};
                }



                let hashErrors = options.hashErrors;
                let serverRoot = options.serverRoot;
                let hidePatient = options.hidePatient;
                let centralResourceId = options.centralResourceId;


                //serverRoot is used when the bundle comes from a server, and we want to convert
                //user to convert relative to absolute references so the fullUrls work
                //centralResourceId - only nodes with a link to that id are present...

                var arNodes = [], arEdges = [];
                var objNodes = {};

                var allReferences = [];
                let centralResourceNodeId;      //the node id of the centralNode (if any)
                //create the nodes...
                bundle.entry.forEach(function(entry,inx) {
                    var resource = entry.resource;

                    //If the fullUrl exists then it is the url for the resource. Otherwise, constructs from the server rool
                    let url = entry.fullUrl;// || resource.resourceType + "/" + resource.id;




                    if (! url) {
                        //If the resource has an id, then construct the url from that.
                        //If a serverRoot has been passed in, then make the url an absolute one.
                        if (resource.id) {
                            if (serverRoot) {
                                url = serverRoot + resource.resourceType + "/" + resource.id;
                            } else {
                                url = resource.resourceType + "/" + resource.id;
                            }
                        }
                    } else {
                        //check if the full url is actually a guid. If it is, then set the url to {type}/{id} as the guid is ignored
                        if (url.indexOf("urn:uuid:") > -1) {
                            url = resource.resourceType + "/" + resource.id

                        } else {
                            //not a urn
                            //set the serverRoot here - it only applies to this entry and is used for resolving references per the spec...

                            let ar1 = url.split('/')
                            ar1.pop()
                            ar1.pop()
                            serverRoot = ar1.join('/')
                            url = serverRoot + resource.resourceType + "/" + resource.id;

                        }
                    }

                    let node = {id: arNodes.length +1, label: resource.resourceType,
                        shape: 'box',url:url,resource:resource, cf : {entry:resource}};

                    let label = ""
                    if (resource.text && resource.text.div) {
                        label = $filter('cleanTextDiv')(resource.text.div);
                        if (label) {
                            label = label.substring(0,40)
                        }
                    }


                    node.label = label + "\n" + resource.resourceType ;

                    if (hashErrors && hashErrors[inx]) {
                        // dh - think it clutters the view... node.label += " ("+hashErrors[inx].length +")";
                        node.issues = hashErrors[inx];
                    }

                    node.entry = entry;
                    node.normalizedId = url;        //this is either the fullUrl or {resource type}/{id}

                    if (objColours[resource.resourceType]) {
                        node.color = objColours[resource.resourceType];
                    }


                    let include = false;
                    if (options.hashShowResourceTypes) {
                        if (options.hashShowResourceTypes[resource.resourceType]) {
                            include = true
                        }
                    } else {
                        include = true;
                    }

                    arNodes.push(node);
/*
                    if (centralResourceId && url == centralResourceId) {
                        //this is the central id
                        centralResourceNodeId = arNodes.length;
                    }
*/
                    if (centralResourceId && url == centralResourceId) {
                        //this is the central id
                        centralResourceNodeId = arNodes.length;
                    }

                    if (hidePatient) {

                       // if (node.title == 'Patient') {
                        if (node.resource &&  node.resource.resourceType == 'Patient') {
                            //objNodes[inx] = node;
                        } else {
                            objNodes[node.url] = node;
                           // arNodes.push(node);
                        }

                    } else {
                        objNodes[node.url] = node;
                       // arNodes.push(node);
                    }



                    var refs = [];
                    findReferences(refs,resource,resource.resourceType);

                    //console.log(refs);
                    let cRefs = []
                    //findCanonicalReferences(cRefs,resource,resource.resourceType);
                    //console.log(cRefs)


                    refs.forEach(function(ref){
                        allReferences.push({src:node,path:ref.path,targ:ref.reference,index:ref.index})
                        //gAllReferences.push({src:url,path:ref.path,targ:ref.reference,index:ref.index});    //all relationsin the collection
                    })

                });
               // console.log(objNodes)

                //so now we have the references, build the graph model...
                let hash = {};      //this will be a hash of nodes that have a reference to centralResourceId (if specified)


                //console.log(allReferences)

                allReferences.forEach(function(ref){


                    let targetNode = objNodes[ref.targ];

                    if (centralResourceId) {


                        //if (ref.src.resource.id == centralResourceId) {
                        if (ref.src.normalizedId == centralResourceId && options.showOutRef) {
                            //this is from the central resource to the given central resource
                            hash[ref.targ] = true;      //this is the url property of the node
                        }
                        //if (targetNode && targetNode.resource.id == centralResourceId) {
                        if (targetNode && targetNode.normalizedId == centralResourceId  && options.showInRef) {
                            //this is a resource eferencing the central node
                            hash[ref.src.url] = true;
                        }

                    }

                    if (targetNode) {
                        var label = $filter('dropFirstInPath')(ref.path);
                        arEdges.push({id: 'e' + arEdges.length +1,from: ref.src.id, to: targetNode.id, label: label,arrows : {to:true}})
                    } else {
                        console.log('>>>>>>> error Node Id '+ref.targ + ' is not present')
                    }
                });

                let nodes;
                let edges;
                if (centralResourceId) {
                    //only include the nodes that have a reference to or from the central node
                    let nodesToInclude = []
                    arNodes.forEach(function(node){

                        //if (node.resource.id == centralResourceId) {
                        if (node.normalizedId == centralResourceId) {
                            //this is the central node
                            nodesToInclude.push(node)
                        } else if (hash[node.url]) {
                            nodesToInclude.push(node)
                        }
                    });

                    nodes = makeNodeDataSet(nodesToInclude,hidePatient)

                    //nodes = new vis.DataSet(nodesToInclude);

                    //if not recursive, remove edges where there isn't a direct reference to or from the centrlal resource id.
                    if (! options.recursiveRef) {
                        let ar = [];
                        arEdges.forEach(function (edge) {
                            if (edge.from == centralResourceNodeId || edge.to == centralResourceNodeId) {
                                ar.push(edge)
                            }
                        });
                        edges = new vis.DataSet(ar);
                    } else {
                        edges = new vis.DataSet(arEdges);
                    }


                    //edges = new vis.DataSet(arEdges);
                } else {
                    //nodes = new vis.DataSet(arNodes);
                    nodes = makeNodeDataSet(arNodes,hidePatient)
                    edges = new vis.DataSet(arEdges);
                }

                // provide the data in the vis format
                var data = {
                    nodes: nodes,
                    edges: edges
                };


                return {graphData : data, allReferences:allReferences, nodes: arNodes, visNodes:nodes,visEdges:edges};


                function makeNodeDataSet(arNodes,hidePatient) {
                    if (! hidePatient) {
                        return new vis.DataSet(arNodes);
                    } else {
                        //remove the patient node
                        let ar = []
                        arNodes.forEach(function (node){
                            if (node.resource &&  node.resource.resourceType !== 'Patient') {
                                ar.push(node)
                            }
                        })
                        return new vis.DataSet(ar);
                    }
                }


                function findReferences(refs,node,nodePath,index) {
                    angular.forEach(node,function(value,key){

                        //if it's an object, does it have a child called 'reference'?

                        if (angular.isArray(value)) {
                            value.forEach(function(obj,inx) {
                                //examine each element in the array
                                if (obj) {  //somehow null's are getting into the array...
                                    var lpath = nodePath + '.' + key;
                                    if (obj.reference) {
                                        //this is a reference!

                                        if (obj.reference && obj.reference.indexOf('urn:uuid') !== -1) {
                                            // this is an uuid
                                            refs.push({path: lpath, reference: obj.reference})
                                        } else {
                                            if (obj.reference.indexOf('http') == 0) {
                                                //this is an absolute reference
                                                refs.push({path: lpath, reference: obj.reference})
                                            } else {
                                                //construct an absolute reference from the server root if possible
                                                //get the 'serverRoot' from the fullUrl of the entry




                                                if (serverRoot) {
                                                    //if there's a serverRoot and it this is a relative reference, then convert to an absolute reference

                                                    refs.push({path: lpath, reference: serverRoot + obj.reference})

                                                } else {
                                                    refs.push({path: lpath, reference: obj.reference})
                                                }
                                            }
                                        }
                                    } else {
                                        //if it's not a reference, then does it have any children?
                                        findReferences(refs,obj,lpath,inx)
                                    }
                                }

                            })
                        } else

                        if (angular.isObject(value)) {
                            var   lpath = nodePath + '.' + key;
                            if (value.reference) {
                                //this is a reference!
                                //if (showLog) {console.log('>>>>>>>>'+value.reference)}


                                if (value.reference.indexOf('urn:uuid') !== -1) {
                                    // this is an uuid
                                    //refs.push({path: lpath, reference: obj.reference})
                                    refs.push({path: lpath, reference: value.reference, index: index})
                                } else {

                                    if (value.reference.indexOf('http') == 0) {
                                        //this is an absolute reference
                                        refs.push({path: lpath, reference: value.reference, index: index})
                                    } else {
                                        if (serverRoot) {
                                            //if there's a serverRoot and it this is a relative reference, then convert to an absolute reference
                                            //todo check if relative first!
                                            refs.push({path: lpath, reference: serverRoot + value.reference, index: index})
                                        } else {
                                            refs.push({path: lpath, reference: value.reference, index: index})
                                        }
                                    }



                                }


                            } else {
                                //if it's not a reference, then does it have any children?
                                findReferences(refs,value,lpath)
                            }
                        }


                    })
                }

                //find canonical references from a single node.
                //A canonical reference is where the
                function findCanonicalReferences() {

                }

/*
                //find canonical references from a single node.
                //A canonical is considered to be an element value starting with http
                function findCanonicalReferences(refs,node,nodePath,index) {
                    angular.forEach(node,function(value,key){

                        //if it's an object, does it have a child called 'reference'?

                        if (angular.isArray(value)) {
                            value.forEach(function(obj,inx) {
                                //examine each element in the array
                                if (obj) {  //somehow null's are getting into the array...
                                    var lpath = nodePath + '.' + key;
                                    if (obj.reference) {
                                        //this is a reference!

                                        if (obj.reference && obj.reference.indexOf('urn:uuid') !== -1) {
                                            // this is an uuid
                                            refs.push({path: lpath, reference: obj.reference})
                                        } else {
                                            if (obj.reference.indexOf('http') == 0) {
                                                //this is an absolute reference
                                                refs.push({path: lpath, reference: obj.reference})
                                            } else {
                                                //construct an absolute reference from the server root if possible
                                                if (serverRoot) {
                                                    //if there's a serverRoot and it this is a relative reference, then convert to an absolute reference

                                                    refs.push({path: lpath, reference: serverRoot + obj.reference})

                                                } else {
                                                    refs.push({path: lpath, reference: obj.reference})
                                                }
                                            }
                                        }
                                    } else {
                                        //if it's not a reference, then does it have any children?
                                        findCanonicalReferences(refs,obj,lpath,inx)
                                    }
                                }

                            })
                        } else

                        if (angular.isObject(value)) {
                            var   lpath = nodePath + '.' + key;
                            if (value.reference) {
                                //this is a reference!
                                //if (showLog) {console.log('>>>>>>>>'+value.reference)}


                                if (value.reference.indexOf('urn:uuid') !== -1) {
                                    // this is an uuid
                                    //refs.push({path: lpath, reference: obj.reference})
                                    refs.push({path: lpath, reference: value.reference, index: index})
                                } else {

                                    if (value.reference.indexOf('http') == 0) {
                                        //this is an absolute reference
                                        refs.push({path: lpath, reference: value.reference, index: index})
                                    } else {
                                        if (serverRoot) {
                                            //if there's a serverRoot and it this is a relative reference, then convert to an absolute reference
                                            //todo check if relative first!
                                            refs.push({path: lpath, reference: serverRoot + value.reference, index: index})
                                        } else {
                                            refs.push({path: lpath, reference: value.reference, index: index})
                                        }
                                    }

                                }


                            } else {
                                //if it's not a reference, then does it have any children?
                                findCanonicalReferences(refs,value,lpath)
                            }
                        }


                    })
                }


*/




            }
        }
    })

angular.module("sampleApp")
    .service('v2ToFhirSvc', function($filter,$q,$http) {

        var objColours ={};
        objColours.Patient = '#93FF1A';
        objColours.Composition = '#E89D0C';
        objColours.Encounter = '#E89D0C';
        objColours.List = '#ff8080';
        objColours.Observation = '#FFFFCC';
        objColours.Practitioner = '#FFBB99';
        objColours.MedicationStatement = '#ffb3ff';
        objColours.MedicationRequest = '#ffb3ff';
        objColours.CarePlan = '#FF9900';
        objColours.Sequence = '#FF9900';
        objColours.CareTeam = '#FFFFCC';
        objColours.Condition = '#cc9900';
        objColours.LogicalModel = '#ff8080';

        objColours.Organization = '#FF9900';
        objColours.ProviderRole = '#FFFFCC';
        objColours.Location = '#cc9900';
        objColours.HealthcareService = '#FFFFCC';
        objColours.MedicationDispense = '#FFFFCC';
        objColours.Composition = '#FFFFCC';
        objColours.Medication = '#FF9900';
        objColours.Immunization = '#aeb76c';

        return {
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
            makeGraph: function (options) {
                //makeGraph: function (bundle,hashErrors,serverRoot,hidePatient,centralResourceId) {

                let bundle = options.bundle;
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
                    }

                    let node = {id: arNodes.length +1, label: resource.resourceType,
                        shape: 'box',url:url,resource:resource, cf : {entry:resource}};
                    node.title = resource.resourceType ;

                    if (hashErrors && hashErrors[inx]) {
                        node.label += " ("+hashErrors[inx].length +")";
                        node.issues = hashErrors[inx];
                    }

                    node.entry = entry;
                    node.normalizedId = url;        //this is either the fullUrl or {resource type}/{id}

                    if (objColours[resource.resourceType]) {
                        node.color = objColours[resource.resourceType];
                    }

                    arNodes.push(node);

                    if (centralResourceId && url == centralResourceId) {
                        //this is the central id
                        centralResourceNodeId = arNodes.length;
                    }

                    if (hidePatient) {

                        if (node.title == 'Patient') {
                            //objNodes[inx] = node;
                        } else {
                            objNodes[node.url] = node;
                        }

                    } else {
                        objNodes[node.url] = node;
                    }



                    var refs = [];
                    findReferences(refs,resource,resource.resourceType);

                    //console.log(refs);



                    refs.forEach(function(ref){
                        allReferences.push({src:node,path:ref.path,targ:ref.reference,index:ref.index})
                        //gAllReferences.push({src:url,path:ref.path,targ:ref.reference,index:ref.index});    //all relationsin the collection
                    })




                });
                console.log(objNodes)

                //so now we have the references, build the graph model...
                let hash = {};      //this will be a hash of nodes that have a reference to centralResourceId (if specified)
                //hash[]


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



                var nodes;
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

                    nodes = new vis.DataSet(nodesToInclude);

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
                    nodes = new vis.DataSet(arNodes);
                    edges = new vis.DataSet(arEdges);
                }





                //var edges = new vis.DataSet(arEdges);

                // provide the data in the vis format
                var data = {
                    nodes: nodes,
                    edges: edges
                };


                return {graphData : data, allReferences:allReferences, nodes: arNodes, visNodes:nodes,visEdges:edges};


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

            }
        }
    })

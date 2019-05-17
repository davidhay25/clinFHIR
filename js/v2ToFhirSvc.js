angular.module("sampleApp")
    .service('v2ToFhirSvc', function($filter) {

        var objColours ={};
        objColours.Patient = '#93FF1A';
        objColours.Composition = '#E89D0C';
        objColours.Encounter = '#E89D0C';
        objColours.List = '#ff8080';
        objColours.Observation = '#FFFFCC';
        objColours.Practitioner = '#FFBB99';
        objColours.MedicationStatement = '#ffb3ff';
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

            makeGraph: function (bundle,hashErrors,serverRoot,hidePatient,centralResourceId) {

                //serverRoot is used when the bundle comes from a server, and we want to convert
                //user to convert relative to absolute references so the fullUrls work
                //centralResourceId - only nodes with a link to that id are present...

                var arNodes = [], arEdges = [];
                var objNodes = {};

                var allReferences = [];

                bundle.entry.forEach(function(entry,inx) {

                    var resource = entry.resource;

                    let url = entry.fullUrl;// || resource.resourceType + "/" + resource.id;

                    //if there's no fullUrl, then make the url a relative one ({type}/{id).
                    if (!url) {
                        url = resource.resourceType + "/" + resource.id;
                    }


                    let node = {id: arNodes.length +1, label: resource.resourceType,
                        shape: 'box',url:url,resource:resource, cf : {entry:resource}};
                    node.title = resource.resourceType ;

                    if (hashErrors && hashErrors[inx]) {
                        node.label += " ("+hashErrors[inx].length +")";
                        node.issues = hashErrors[inx];
                    }

                    node.entry = entry;

                    if (objColours[resource.resourceType]) {
                        node.color = objColours[resource.resourceType];
                    }

                    arNodes.push(node);

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
                    //console.log(ref)

                    let targetNode = objNodes[ref.targ];

                    if (centralResourceId) {

                        if (ref.src.resource.id == centralResourceId) {
                            //this is from the central resource to the given central resource
                            hash[ref.targ] = true;      //this is the url property of the node
                            console.log('ref to central:' + ref.targ)
                        }

                        if (targetNode && targetNode.resource.id == centralResourceId) {
                            //this is a resource eferencing the central node
                            hash[ref.src.url] = true;
                        }

                    }


                    //var targetNode = objNodes[ref.targ];
                    if (targetNode) {
                        var label = $filter('dropFirstInPath')(ref.path);
                        arEdges.push({id: 'e' + arEdges.length +1,from: ref.src.id, to: targetNode.id, label: label,arrows : {to:true}})
                    } else {
                        console.log('>>>>>>> error Node Id '+ref.targ + ' is not present')
                    }
                });



                var nodes;
                if (centralResourceId) {
                    //only include the nodes that have a reference to or from the central node
                    let nodesToInclude = []
                    arNodes.forEach(function(node){
                        if (node.resource.id == centralResourceId) {
                            //this is the central node
                            nodesToInclude.push(node)
                        } else if (hash[node.url]) {
                            nodesToInclude.push(node)
                        }
                    });

                    nodes = new vis.DataSet(nodesToInclude);

                } else {
                    nodes = new vis.DataSet(arNodes);
                }

                var edges = new vis.DataSet(arEdges);

                // provide the data in the vis format
                var data = {
                    nodes: nodes,
                    edges: edges
                };


                return {graphData : data, allReferences:allReferences, nodes: arNodes};


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
                                            if (serverRoot) {
                                                //if there's a serverRoot and it this is a relative reference, then convert to an absolute reference
                                                //todo check if relative first!
                                                refs.push({path: lpath, reference: serverRoot + obj.reference})

                                            } else {
                                                refs.push({path: lpath, reference: obj.reference})
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


                                    if (serverRoot) {
                                        //if there's a serverRoot and it this is a relative reference, then convert to an absolute reference
                                        //todo check if relative first!
                                        refs.push({path: lpath, reference: serverRoot + value.reference, index: index})
                                    } else {
                                        refs.push({path: lpath, reference: value.reference, index: index})
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

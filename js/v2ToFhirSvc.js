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
        objColours.Immunization = '#aeb76c'

        return {

            makeGraph: function (bundle,hashErrors) {
                var arNodes = [], arEdges = [];
                var objNodes = {};

                var allReferences = [];
                //gAllReferences.length = 0;

                bundle.entry.forEach(function(entry,inx) {
                    //should always be a resource.id  todo? should I check
                    var resource = entry.resource;
                    var node = {id: arNodes.length +1, label: resource.resourceType,
                        shape: 'box',url:entry.fullUrl,cf : {entry:resource}};
                    node.title = resource.resourceType ;

                    if (hashErrors && hashErrors[inx]) {
                        node.label += " ("+hashErrors[inx].length +")"
                        node.issues = hashErrors[inx];
                    }

                    node.entry = entry;

                    if (objColours[resource.resourceType]) {
                        node.color = objColours[resource.resourceType];
                    }

                    arNodes.push(node);
                    objNodes[node.url] = node;

                    var refs = [];
                    findReferences(refs,resource,resource.resourceType);

                    console.log(refs);

                    refs.forEach(function(ref){
                        allReferences.push({src:node,path:ref.path,targ:ref.reference,index:ref.index})
                        //gAllReferences.push({src:url,path:ref.path,targ:ref.reference,index:ref.index});    //all relationsin the collection
                    })




                });


                //so now we have the references, build the graph model...
                allReferences.forEach(function(ref){
                    var targetNode = objNodes[ref.targ];
                    if (targetNode) {
                        var label = $filter('dropFirstInPath')(ref.path);
                        arEdges.push({id: 'e' + arEdges.length +1,from: ref.src.id, to: targetNode.id, label: label,arrows : {to:true}})
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

                                        refs.push({path: lpath, reference: obj.reference})
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
                                refs.push({path:lpath,reference : value.reference,index:index})
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

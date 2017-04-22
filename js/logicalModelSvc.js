angular.module("sampleApp")
    //this returns config options. At the moment it is for servers...
    //also holds the current patient and all their resources...
    //note that the current profile is maintained by resourceCreatorSvc

    .service('logicalModelSvc', function($http,$q,appConfigSvc,GetDataFromServer,Utilities,SaveDataToServer) {

        var currentUser;
        var elementsToIgnore =['id','meta','implicitRules','language','text','contained','extension','modifierExtension'];


        //set the first segment of a path to the supplied value. Used when determining differneces from the base type
        String.prototype.setFirstSegment = function(firstSegment) {
            var ar = this.split('.');
            ar[0] = firstSegment;
            return ar.join('.')
        }

        String.prototype.getLastSegment = function() {
            var ar = this.split('.');
            return ar[ar.length-1]
        }




        function makeTreeDataElementDEP(rootName,ed,treeData) {
            //generate an item for the tree

                var path = ed.path;
                var arPath = path.split('.');

                if (arPath.length > 1) { //skip the first one

                    arPath[0] = rootName;           //use the rootname of the Logical Model
                    var idThisElement = arPath.join('.')
                    var treeText = arPath.pop();//
                    var include = true;
                    if (elementsToIgnore.indexOf(treeText) > -1) {
                        if (arPath.length == 2) {
                            include = false;
                        }

                    }

                    if (include) {
                        console.log(idThisElement);
                        var parentId = arPath.join('.');
                        var item = {};

                        item.id = idThisElement;
                        item.text = treeText;
                        item.data = {};
                        item.parent = parentId;


                        //test that the parent exists
                        var found = false;
                        treeData.forEach(function (item) {
                            if (item.id == parentId) {
                                found = true;
                            }

                        });

                        if (!found) {
                            console.log('Missing parent element ' + parentId)
                            throw 'Missing parent element ' + parentId + '. This is because the model definition is incorrect, so I cannot use it.';
                            return;
                        }


                        item.state = {opened: true};     //default to fully expanded

                        item.data.path = idThisElement;     //is the same as the path...
                        item.data.name = item.text;
                        item.data.short = ed.short;
                        item.data.description = ed.definition;
                        item.data.type = ed.type;
                        item.data.min = ed.min;
                        item.data.max = ed.max;

                        item.data.comments = ed.comments;

                        //note that we don't retrieve the complete valueset...
                        if (ed.binding) {
                            item.data.selectedValueSet = {strength: ed.binding.strength};
                            item.data.selectedValueSet.vs = {url: ed.binding.valueSetUri};
                            item.data.selectedValueSet.vs.name = ed.binding.description;


                            //this is a reference not a name - make up a uri (todo - load the reference to get the URL
                            if (ed.binding.valueSetReference) {
                                //todo - this is safe ONLY when loading one of the base types in the spec...
                                item.data.selectedValueSet.vs.url = ed.binding.valueSetReference.reference;
                            }

                        }


                        treeData.push(item);
                         return item;
                    } else {
                        return null;
                    }


                }



        }




        return {

            generateDoc : function(tree) {
                var deferred = $q.defer();
                //var simpleExtensionUrl = appConfigSvc.config().standardExtensionUrl.simpleExtensionUrl;
                var arDoc = []
                var arQueries = [];



                tree.forEach(function (branch) {
                    var data = branch.data;

                    var path = data.path;     //this is the
                    var ar = path.split('.');
                    if (ar.length == 1) {
                        //this is the first node. Has 'model level' data...
                        if (data.header) {
                            var title = data.header.title || data.header.name;

                            arDoc.push("# "+title);
                            arDoc.push("");

                            addTextIfNotEmpty(arDoc,data.header.purpose);

                            if (data.header.baseType){
                                arDoc.push("**Base type is " + data.header.baseType+"**");
                                arDoc.push("");
                            }

                        }


                    } else {
                        //this is an 'ordinary node
                        ar.splice(0,1);     //ar is the path as an array...


                        var hdr = "## "+ar.join(".")    //the name of the element in the model

                        if (data.fhirMappingExtensionUrl) {

                            //This is an extension...
                            hdr += " (Extension)";

                        } else if (data.type) {
                            hdr += " (";
                            data.type.forEach(function(typ,inx){
                                if (inx > 0) {
                                    hdr += " ";
                                }
                                hdr += typ.code;
                            });
                            hdr += ")"

                            hdr += " ["+ data.min + '..' + data.max+']';

                        }

                        //the header...
                        arDoc.push("");
                        arDoc.push(hdr)
                        arDoc.push("");

                        //todo - not sure about this... addTextIfNotEmpty(arDoc,data.short);
                        addTextIfNotEmpty(arDoc,data.description);
                        addTextIfNotEmpty(arDoc,data.comments);

                        if (data.fhirMappingExtensionUrl) {
                            arDoc.push("Extension Url: "+data.fhirMappingExtensionUrl);
                        }

                        if (data.selectedValueSet && data.selectedValueSet.vs) {
                            var vs = "ValueSet: " + data.selectedValueSet.vs.url;
                            if (data.selectedValueSet.strength) {
                                vs += " ("+data.selectedValueSet.strength + ")"
                            }
                            vs = "**"+vs+"**";
                            addTextIfNotEmpty(arDoc,vs);

                        }

                        //show the fhir mapings
                        if (data.mappingFromED) {
                            data.mappingFromED.forEach(function(map){
                                if (map.identity == 'fhir') {
                                    //note that this is a bit hacky as the comment element is only in R3...
                                    arDoc.push("");
                                    var m = map.map;
                                    var c = map.comment;
                                    var ar1 = m.split('|');
                                    m = ar1[0];
                                    if (ar1.length > 1 && ! c) {
                                        c = ar1[1]
                                    }

                                    m = m.replace('|',"");
                                    arDoc.push("###FHIR mapping:"+m)
                                    if (c) {
                                        arDoc.push(c)
                                    }
                                }
                            })

                        }



                    }

                })

                //note - not using any queries yet - thinking is to support looking up extensions...
                if (arQueries.length > 0) {
                    $q.all(queries).then(
                        function () {
                            console.log('DONE')
                            deferred.resolve(treeData)
                        },
                        function (err) {
                            console.log('ERROR: ', err)
                            deferred.reject(err)
                        }
                    );
                } else {
                    deferred.resolve(arDoc.join('\n'));
                }


                return deferred.promise;

                function addTextIfNotEmpty(ar,txt) {
                    if (txt) {
                        ar.push(txt);
                        ar.push("")
                    }
                }
            },
            generateFHIRProfile : function(internalLM) {
                //generate a real FHIR profile from the logical model
                var deferred = $q.defer();
                var fhirVersion = appConfigSvc.getCurrentConformanceServer().version;

                //get the base type for the model.
                var baseType;
                var ext = Utilities.getSingleExtensionValue(internalLM, appConfigSvc.config().standardExtensionUrl.baseTypeForModel)
                if (ext && ext.valueString) {
                    baseType = ext.valueString
                } else {

                    deferred.reject('No base type. A profile cannot be generated.');
                    // return;
                }


                console.log(internalLM);
                var realProfile = angular.copy(internalLM);      //the profile that we will build...
                realProfile.snapshot = {element:[]};            //get rid of the current element defintiions...
                realProfile.id = realProfile.id+'-cf-profile';   //construct an id
                realProfile.url = realProfile.url+'-cf-profile';   //and a url...
                realProfile.kind = 'resource';

                var url = "http://hl7.org/fhir/StructureDefinition/"+ baseType;
                //realProfile.baseDefinition = url;

                if (fhirVersion == 2) {
                    realProfile.base = url;
                    realProfile.constrainedType = baseType;
                } else {
                    realProfile.baseDefinition = url;
                    realProfile.type = baseType;
                }

                delete realProfile.extension;                   //and the extensions



                //retrieve the base profile. We'll use that to ensure that the mappings are valid...
               // var url = appConfigSvc.getCurrentConformanceServer().url + baseType;
             //   var url = "http://hl7.org/fhir/StructureDefinition/"+ baseType;
               // realProfile.baseDefinition = url;

                GetDataFromServer.findConformanceResourceByUri(url).then(
                    function (SD) {
                        if (SD && SD.snapshot && SD.snapshot.element) {
                            makeFHIRProfile(SD);    //just to avoid hard to read nesting..
                        } else {
                            deferred.reject('Base profile (' + url + ') has no snapshot!');
                        }

                    },
                    function(err) {
                       //deferred.reject('Base profile (' + url + ') not found');
                        deferred.reject(angular.toJson(err));


                    }
                );

                return deferred.promise;


                function makeFHIRProfile(SD) {



                    //create a hash of all the paths in the base resource type...
                    var pathHash = {};
                    SD.snapshot.element.forEach(function(ed){
                        pathHash[ed.path] = ed;
                    });

                    var err = []

                    //now work through the model. if there's no mapping, then an error. If an extension then insert the url...
                    internalLM.snapshot.element.forEach(function(ed,inx){
                        var newED = angular.copy(ed);

                        if (inx == 0) {
                            //this is the root element
                            newED.path = baseType;
                        } else {
                            //get the path mapping for this element
                            //var mappedPath;
                            if (ed.mapping) {
                                ed.mapping.forEach(function (map) {
                                    if (map.identity=='fhir') {
                                        // mappedPath = map;
                                        //the hack for the mapping comments
                                        if (map.map) {
                                            var ar1 = map.map.split('|');

                                            newED.path = ar1[0];//map.map
                                        }

                                    }
                                })
                            }
                        }
                        newED.id = baseType + ':' + newED.path;



/*
                        var path = ed.path;
                        var ar = path.split('.');
                        ar[0] = baseType;
                        newED.path = ar.join('.')
*/

                        console.log(newED.path)

                        //if this is an extension then we need to insert the url to the extension...
                        if (newED.path.indexOf('extension') == -1) {

                            if (!pathHash[newED.path]) {
                                err.push("Path: "+newED.path + " is not valid for this resource type")
                            } else {


                                realProfile.snapshot.element.push(newED)
                            }
                        } else {
                            //this is an extension...

                            var ext = Utilities.getSingleExtensionValue(newED, appConfigSvc.config().standardExtensionUrl.simpleExtensionUrl)
                            if (ext && ext.valueString) {
                                extensionUrl = ext.valueString;
                                //need to set the type of the element to 'Extension' (In the LM it is the datatype)
                                newED.type = {code:'Extension',profile:extensionUrl}
                                delete newED.extension; //this is the extension that holds the url
                                realProfile.snapshot.element.push(newED)


                            } else {
                                err.push("Path: "+newED.path + " is an extension, but there is no extension url given")
                            }


                        }



                    })

                    if (err.length > 0) {
                        var msg = err.join(' ');
                        deferred.reject(msg);
                    } else {

                        //write out

                        SaveDataToServer.saveResource(realProfile,appConfigSvc.getCurrentConformanceServer().url).then(
                            function(data) {
                                deferred.resolve(realProfile)
                            },function (err) {
                                deferred.reject(angular.toJson(err));
                            }
                        )

                    }





                }








            },

            makeReferencedMapsModel: function (SD, bundle) {
                //builds the model that has all the models referenced by the indicated SD, recursively...
                //console.log(SD)
                var that = this;
                var lst = [];

                getModelReferences(lst, SD, SD.url);      //recursively find all the references between models...

                //console.log(lst);

                //build the tree model...

                var arNodes = [], arEdges = [];
                var objNodes = {};


                lst.forEach(function (reference) {

                    var srcNode = getNodeByUrl(reference.src, reference.path, objNodes, arNodes);


                    var targNode = getNodeByUrl(reference.targ, reference.path, objNodes, arNodes);
//
                   // var targNode = getNodeByUrl(reference.targ + reference.src, reference.path, objNodes, arNodes);


                    //If there's already a


                    var ar = reference.path.split('.');
                    var label = ar.pop();

                    arEdges.push({from: srcNode.id, to: targNode.id, label: label, arrows: {to: true}})

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
                arNodes.forEach(function (node) {
                    nodeObj[node.id] = node;
                    arAllModels.push({url: node.url})
                });



                return {references: lst, graphData: data, nodes: nodeObj, lstNodes: arAllModels};

                function getNodeByUrl(url, label, nodes) {
                    if (nodes[url]) {
                        return nodes[url];
                    } else {
                        var ar = url.split('/')
                        //var label =
                        var node = {id: arNodes.length + 1, label: ar[ar.length - 1], shape: 'box', url: url};
                        if (arNodes.length == 0) {
                            //this is the first node
                            node.color = 'green'
                            node.font = {color: 'white'}
                        }


                        nodes[url] = node;
                        arNodes.push(node);
                        return node;
                    }
                }


                function getModelReferences(lst, SD, srcUrl) {
                    var treeData = that.createTreeArrayFromSD(SD);

                    treeData.forEach(function (item) {

                        if (item.data) {
                            //console.log(item.data.referenceUri);
                            if (item.data.referenceUri) {
                                var ref = {src: srcUrl, targ: item.data.referenceUri, path: item.data.path}
                                lst.push(ref);
                                var newSD = that.getModelFromBundle(bundle, item.data.referenceUri);
                                if (newSD) {
                                    getModelReferences(lst, newSD, newSD.url)
                                }

                            }
                        }
                    })

                }


            },
            importFromProfile: function () {
                var that = this;
                var deferred = $q.defer();
                var serverUrl = "http://fhir.hl7.org.nz/dstu2/";
                var url = serverUrl + "StructureDefinition/ohAllergyIntolerance";
                var queries = []

                GetDataFromServer.adHocFHIRQuery(url).then(
                    function (data) {
                        var profile = data.data;

                        var treeData = that.createTreeArrayFromSD(profile);

                        //now, pull out all the extensions and resolve the name and datatypes...

                        treeData.forEach(function (item) {
                            if (item.text.substr(0, 9) == 'extension') {
                                if (item.data) {
                                    var uri = item.data.referenceUri;
                                    if (uri) {
                                        //now retrieve the SD that describes this extension and update the tree. Assume it is on the same server...
                                        queries.push(checkExtensionDef(uri, item));
                                    }

                                }
                            }

                        });


                        $q.all(queries).then(
                            function () {
                                console.log('DONE')
                                deferred.resolve(treeData)
                            },
                            function (err) {
                                console.log('ERROR: ', err)
                            }
                        );


                        function checkExtensionDef(extUrl, item) {
                            var deferred = $q.defer();
                            var url = serverUrl + "StructureDefinition?url=" + extUrl;
                            GetDataFromServer.adHocFHIRQuery(url).then(
                                function (data) {
                                    var bundle = data.data;
                                    if (bundle && bundle.entry) {
                                        var extensionDef = bundle.entry[0].resource;     //should really only be one...
                                        var analysis = Utilities.analyseExtensionDefinition3(extensionDef);
                                        //console.log(analysis)
                                        if (analysis.name) {
                                            item.text = analysis.name;
                                            //console.log(item)
                                        }
                                        item.data.analysis = analysis;
                                    }
                                    //console.log(data.data)
                                    deferred.resolve();
                                },
                                function (err) {
                                    deferred.reject();
                                }
                            );
                            return deferred.promise;
                        };


                    }, function (err) {
                        console.log(err)
                    }
                )


                return deferred.promise;
            },
            mergeModel: function (targetModel, pathToInsertAt, modelToMerge) {



                //var pathToInsertAt = $scope.selectedNode.id;

                //find the position in the current SD where this path is...
                var posToInsertAt = -1;
                for (var i = 0; i < targetModel.snapshot.element.length; i++) {
                    var ed = targetModel.snapshot.element[i];
                    if (ed.path == pathToInsertAt) {
                        posToInsertAt = i + 1;
                    }
                }


                if (posToInsertAt > -1) {
                    //posToInsertAt
                    //right. here is where we are ready to insert. Start from the second one...
                    //var arInsert = [];      //the array of ed's to insert
                    for (var j = modelToMerge.snapshot.element.length - 1; j > 0; j--) {     //needs to be descending, due the inset at the same point

                        //for (var j = 1; j < modelToMerge.snapshot.element.length; j++) {
                        var edToInsert = angular.copy(modelToMerge.snapshot.element[j]);
                        //now, change the path in the edToInsert to it's consistent with the parent...
                        var ar = edToInsert.path.split('.');
                        ar.shift();     //remove the root
                        edToInsert.path = pathToInsertAt + '.' + ar.join('.');
                        edToInsert.id = edToInsert.path;

                        targetModel.snapshot.element.splice(posToInsertAt, 0, edToInsert)
                        //arInsert.push(edToInsert);
                    }

                    return true;


                } else {
                    return false;
                }
            },

            getModelFromBundle: function (bundle, url) {
                if (bundle) {
                    for (var i = 0; i < bundle.entry.length; i++) {
                    var resource = bundle.entry[i].resource;
                    if (resource.url == url) {
                        return resource
                        break;
                    }
                }
                }
            },

            mapToFHIRBundle: function (input, model) {
                //map an incomming message to a FHIR bundle (using v2 input)
                //assume v2 message is in JSON format
                //strategy: locate patient first (as most resources have a reference to patient)
                //then process each entry in turn assuming a 1:1 mapping from segment -> resource (todo may need to revisit this)
                // use the mapping in the model to construct the resource.


            },

            generateSample: function (treeObject) {


                function processNode(resource, node) {
                    console.log(node, node.children);


                    //resource[node.text] = {};


                    if (node.children && node.children.length > 0) {
                        node.children.forEach(function (lnode) {


                            if (lnode.children && lnode.children.length > 0) {
                                var obj = {};
                                resource[lnode.text] = obj;
                                processNode(obj, lnode)
                            } else {
                                resource[lnode.text] = 'sample value';
                            }


                        })
                    } else {
                        //resource.value = "ValueForNode";
                    }

                }

                var sample = {};
                processNode(sample, treeObject[0])

                console.log(sample)
                return sample;
            },

            getOptionsFromValueSet: function (element) {
                //return the expanded set of options from the ValueSet
                var deferred = $q.defer();
                //console.log(element);


                if (element && element.selectedValueSet && element.selectedValueSet.vs && element.selectedValueSet.vs.url) {
                    GetDataFromServer.getValueSet(element.selectedValueSet.vs.url).then(
                        function (vs) {
                            //console.log(vs)

                            //the extension that indicates the vs (authored by CF) has direct concepts that are not snomed so can't be expanded
                            var extensionUrl = appConfigSvc.config().standardExtensionUrl.vsDirectConcept;
                            var ext = Utilities.getSingleExtensionValue(vs, extensionUrl)
                            if (ext && ext.valueBoolean) {
                                //first, create an array with all of the composed concepts...
                                var ar = [];
                                vs.compose.include.forEach(function (inc) {
                                    ar = ar.concat(inc.concept)
                                });

                                //now create a filtered return array
                                var returnArray = []
                                if (ar && ar.length > 0) {
                                    ar.forEach(function (item) {
                                        returnArray.push(item)
                                    });
                                }

                                deferred.resolve(returnArray);

                            } else {
                                var id = vs.id;

                                GetDataFromServer.getExpandedValueSet(id).then(
                                    function (data) {
                                        if (data.expansion && data.expansion.contains) {
                                            deferred.resolve(data.expansion.contains);

                                        } else {
                                            deferred.resolve()
                                        }
                                    }, function (err) {
                                        deferred.reject(err)
                                    }
                                )
                            }

                        },
                        function (err) {
                            deferred.reject(err);
                        }
                    )
                } else {
                    deferred.resolve();
                }

                return deferred.promise;


            },
            insertModel: function (element, insertModel) {

            },
            addSimpleExtension: function (sd, url, value) {
                //add a simple extension as a string;
                sd.extension = sd.extension || []
                sd.extension.push({url: url, valueString: value})
            },
            setCurrentUser: function (user) {
                currentUser = user;
            },
            getCurrentUser: function () {
                return currentUser;
            },
            getAllPathsForType: function (typeName) {
                //return all the possible paths for a base type...
                var deferred = $q.defer();
                var url = "http://hl7.org/fhir/StructureDefinition/" + typeName;

                GetDataFromServer.findConformanceResourceByUri(url).then(
                    function (SD) {
                        if (SD && SD.snapshot && SD.snapshot.element) {
                            var lst = []
                            SD.snapshot.element.forEach(function (ed) {
                                lst.push(ed.path)
                            })
                            deferred.resolve(lst)
                        }


                    }, function (err) {
                        alert("error qith query: " + url + "\n" + angular.toJson(err));
                        deferred.reject();
                    }
                )
                return deferred.promise;


            },
            clone: function (baseSD, rootName) {
                //make a copy of the SD changing the rootName in the path...
                var newSD = angular.copy(baseSD);
                newSD.id = rootName;
                var arUrl = newSD.url.split('/');
                arUrl[arUrl.length - 1] = rootName;
                newSD.url = arUrl.join('/');
                newSD.name = rootName;
                newSD.status = 'draft';
                newSD.date = moment().format()


                newSD.snapshot.element.forEach(function (ed) {
                    var path = ed.path;
                    var arPath = path.split('.');
                    arPath[0] = rootName;
                    ed.path = arPath.join('.')
                })
                return newSD;

            },
            createFromBaseType: function (treeData, typeName, rootName) {
                //create a model from the base type, only bringing across stuff we want.
                //todo - very similar to the logic in createTreeArrayFromSD() - ?call out to separate function...
                var deferred = $q.defer();
                var elementsToIgnore = ['id', 'meta', 'implicitRules', 'language', 'contained', 'extension', 'modifierExtension'];
                var url = "http://hl7.org/fhir/StructureDefinition/" + typeName;

                var serverUrl;  //set this for STU-2 - will default to the current one if not set...

/*
                if (useStu2) {
                    //for now get the st2 resources directly off HAPI server. todo - this needs to be configurable in some way...
                    serverUrl = "http://fhirtest.uhn.ca/baseDstu2/";
                    //serverUrl = "http://fhir2.healthintersections.com.au/open/";
                    console.log('getting from STU-2')

                }
*/

                GetDataFromServer.findConformanceResourceByUri(url, serverUrl).then(
                    function (SD) {
                        try {
                            makeTreeData(SD, treeData);

                            console.log(treeData);

                            deferred.resolve(treeData);
                        } catch (ex) {
                            deferred.reject(ex)
                        }


                    },
                    function (err) {
                        alert(angular.toJson(err))
                        deferred.reject(err)
                    }
                );


                return deferred.promise;

                function makeTreeData(SD, treeData) {

                    //The hAPI server is missing the snapshot element for some reason.
                    // Hopefully the differential is complete... - this was an issue with the SD ? todo needto d this
                    var elements = SD.snapshot || SD.differential;

                    elements.element.forEach(function (ed) {
                        var path = ed.path;
                        var arPath = path.split('.');

                        if (arPath.length > 1) { //skip the first one

                            arPath[0] = rootName;           //use the rootname of the Logical Model
                            var include = true;
                            //don't include the main text element
                            if (arPath.length == 2) {
                                if (arPath[1] == 'text') {
                                    include = false;
                                }
                            }

                            var idThisElement = arPath.join('.')
                            var treeText = arPath.pop();//

                            if ((elementsToIgnore.indexOf(treeText) > -1) && (arPath.length == 1)) { //note that the first segment of the path has been popped off...
                                include = false;
                            }

                            if (treeText == 'extension' || treeText == 'modifierExtension' || treeText == 'id') {
                                include = false;
                            }

                            if (include) {
                                console.log(idThisElement);
                                var parentId = arPath.join('.');
                                var item = {};

                                item.id = idThisElement;
                                item.text = treeText;
                                item.data = {};
                                item.parent = parentId;


                                //test that the parent exists
                                var found = false;
                                treeData.forEach(function (item) {
                                    if (item.id == parentId) {
                                        found = true;
                                    }

                                });

                                if (!found) {
                                    console.log('Missing parent element ' + parentId)
                                    throw 'Missing parent element ' + parentId + '. This is because the model definition is incorrect, so I cannot use it.';
                                    return;
                                }


                                item.state = {opened: true};     //default to fully expanded

                                item.data.path = idThisElement;     //is the same as the path...
                                item.data.name = item.text;
                                item.data.short = ed.short;
                                item.data.description = ed.definition;
                                item.data.type = ed.type;
                                item.data.min = ed.min;
                                item.data.max = ed.max;

                                item.data.comments = ed.comments;

                                //set the mapping
                                item.data.mappingPath = path; //[{identity: 'fhir', map: path}]



                                //note that we don't retrieve the complete valueset...
                                if (ed.binding) {
                                    item.data.selectedValueSet = {strength: ed.binding.strength};
                                    item.data.selectedValueSet.vs = {url: ed.binding.valueSetUri};
                                    item.data.selectedValueSet.vs.name = ed.binding.description;


                                    //this is a reference not a name - make up a uri (todo - load the reference to get the URL
                                    if (ed.binding.valueSetReference) {
                                        //todo - this is safe ONLY when loading one of the base types in the spec...
                                        item.data.selectedValueSet.vs.url = ed.binding.valueSetReference.reference;
                                    }

                                }


                                treeData.push(item);
                            }


                        }
                    })


                }


            },
            getModelHistory: function (id) {


                var url = appConfigSvc.getCurrentConformanceServer().url + "StructureDefinition/" + id + "/_history";
                return GetDataFromServer.adHocFHIRQueryFollowingPaging(url)

                //return $http.get(url);
            },
            createTreeArrayFromSD: function (sd) {
                //generate the array that the tree uses from the StructureDefinition
                var mappingCommentUrl = appConfigSvc.config().standardExtensionUrl.edMappingComment;
                var mapToModelExtensionUrl = appConfigSvc.config().standardExtensionUrl.mapToModel;
                var baseTypeForModel = appConfigSvc.config().standardExtensionUrl.baseTypeForModel;
                var simpleExtensionUrl = appConfigSvc.config().standardExtensionUrl.simpleExtensionUrl;

                var cntExtension = 0;
                var arTree = [];
                if (sd && sd.snapshot && sd.snapshot.element) {

                    sd.snapshot.element.forEach(function (ed) {
                        var include = true;

                        var path = ed.path;     //this is always unique in a logical model...
                        var arPath = path.split('.');
                        var item = {}
                        item.id = path;
                        item.text = arPath[arPath.length - 1];   //the text will be the last entry in the path...

                        //give a unique name if an extension...
                        if (item.text === 'extension') {
                            item.text = 'extension_' + cntExtension;
                            item.id = path += "_" + cntExtension;

                            cntExtension++;


                            //console.log(ed);

                            //see if this extension points to an extension definition
                            if (ed.type && ed.type[0].profile) {

                            } else {
                                include = false;
                            }


                        }


                        //show if an element is multiple...
                        if (ed.max == '*') {
                            //    item.text += " *"
                        }

                        item.data = {};
                        if (arPath.length == 1) {
                            //this is the root node
                            item.parent = '#';
                            item.data.isRoot = true;
                            //now set the header data...
                            item.data.header = {};
                            item.data.header.name = sd.name;

                            //the name of the next 2 elements changed after baltimore, so look in both places until the other stu3 servrs catch up...
                            item.data.header.purpose = sd.purpose || sd.requirements;
                            item.data.header.title = sd.title || sd.display;
                            item.data.header.publisher = sd.publisher;
                            item.data.header.extension = sd.extension;     //save any resource level extensions...

                            //see if this model has a base type
                            var ext1 = Utilities.getSingleExtensionValue(sd, baseTypeForModel)
                            if (ext1 && ext1.valueString) {
                                item.data.header.baseType = ext1.valueString;

                            }


                            //note that mapping node is different in the SD and the ED - but in the same place in the treeData
                            if (sd.mapping && sd.mapping.length > 0) {

                                item.data.header.mapping = sd.mapping[0].comments;
                                item.data.mapping = sd.mapping[0].comments;     //for the report & summary view...
                            }
                            if (sd.useContext) {
                                item.header = {type: sd.useContext[0].valueCodeableConcept.code};
                            }

                        } else {
                            //otherwise the parent can be inferred from the path
                            arPath.pop();//
                            item.parent = arPath.join('.');
                            if (ed.min == 1) {
                                item['li_attr'] = {class: 'elementRequired'};
                            }

                            if (ed.fixedString) {
                                item['li_attr'] = {class: 'elementFixed'};
                            }


                        }
                        item.state = {opened: true};     //default to fully expanded


                        item.data.fixedString = ed.fixedString;      //todo, this should probably be a type compatible with this element
                        item.data.path = path;
                        item.data.name = item.text;
                        item.data.short = ed.short;
                        item.data.description = ed.definition;
                        item.data.type = ed.type;



                        var extSimpleExt = Utilities.getSingleExtensionValue(ed, simpleExtensionUrl);
                        if (extSimpleExt) {
                            item.data.fhirMappingExtensionUrl = extSimpleExt.valueString;
                        }


                        //in STU3 type.profile became type.targetProfile - should be able to drop 'profile' eventually...
                        if (ed.type && ed.type[0].profile) {
                            item.data.referenceUri = ed.type[0].profile;

                            //in stu2 this is an array - just grab the first one...
                            if (angular.isArray(item.data.referenceUri)) {
                                item.data.referenceUri = item.data.referenceUri[0];
                            }

                        }

                        if (ed.type && ed.type[0].targetProfile) {
                            item.data.referenceUri = ed.type[0].targetProfile;

                            //in stu2 this is an array - just grab the first one...
                            if (angular.isArray(item.data.referenceUri)) {
                                item.data.referenceUri = item.data.referenceUri[0];
                            }

                        }

                        //determine if this is a coded or a reference type
                        if (ed.type) {
                            ed.type.forEach(function (typ) {
                                if (['CodeableConcept', 'Coding', 'code'].indexOf(typ.code) > -1) {
                                    item.data.isCoded = true;
                                }

                                if (typ.code == 'Reference') {
                                    item.data.isReference = true;   //used to populate the 'is reference' table...
                                }

                            })
                        }


                        item.data.min = ed.min;
                        item.data.max = ed.max;

                        if (ed.mapping) {           //the mapping path in the target resource...


                            item.data.mappingFromED = ed.mapping;       //save all the mappings in an array...

                            //this is a horrible hack to cover the fact that hapi doesn't yet support the final R3...
                            item.data.mappingFromED.forEach(function(map){
                                var value = map.map;    //the mapping
                                var g = value.indexOf('|')
                                if (g > -1) {
                                    map.comment = value.substr(g+1);
                                    map.map = value.substr(0,g);
                                }
                            });

                            //tofo get the extension, always on the first - I'm not sure this is correvt
                            if (ed.mapping[0]) {
                                //there are extensions on this item - find the comment...
                                var ext = Utilities.getSingleExtensionValue(ed.mapping[0], mappingCommentUrl)
                                if (ext && ext.valueString) {
                                    item.data.mapping = ext.valueString;

                                    //a temporary function to map across comments from the previous version (saved as an extension)
                                    if (! item.data.mappingFromED[0].comment) {
                                        item.data.mappingFromED[0].comment = ext.valueString;
                                    }


                                }





                                var ext1 = Utilities.getSingleExtensionValue(ed.mapping[0], mapToModelExtensionUrl)
                                if (ext1 && ext1.valueUri) {
                                    item.data.mapToModelUrl = ext1.valueUri;
                                    item.data.referenceUri = ext1.valueUri;     //for the table dsplay...
                                    item.data.isReference = true;   //this element references another model
                                }


                            }

/*
                            //the 'named' maps...
                            ed.mapping.forEach(function(mapItem){

                                switch (mapItem.identity) {
                                    case 'fhir' :
                                        //var mapItem = ed.mapping[0];    //the actual map - assume only 1...
                                        item.data.mappingPath = mapItem.map;      //the identity is currently hard coded


                                        break;
                                    case 'hl7V2' :
                                        item.data.mappingPathV2 = mapItem.map;      //the identity is currently hard coded
                                        break;

                                }


                            })

                            */




                        }


                        item.data.comments = ed.comments;

                        //note that we don't retrieve the complete valueset...
                        if (ed.binding) {
                            item.data.selectedValueSet = {strength: ed.binding.strength};
                            item.data.selectedValueSet.vs = {url: ed.binding.valueSetUri};
                            item.data.selectedValueSet.vs.name = ed.binding.description;
                        }


                        /*
                         if (data.selectedValueSet) {
                         ed.binding = {strength:data.selectedValueSet.strength};
                         ed.binding.valueSetUri = data.selectedValueSet.vs.url;
                         ed.binding.description = 'The bound valueset'

                         }
                         */


                        if (include) {
                            arTree.push(item);
                        }

                    });


                }
                return arTree;
            },
            makeSD: function (scope, treeData) {
                //create a StructureDefinition from the treeData //todo - don't pass in scope...
                var header = treeData[0].data.header || {};     //the first node has the header informatiion

                var mappingCommentUrl = appConfigSvc.config().standardExtensionUrl.edMappingComment;
                var mapToModelExtensionUrl = appConfigSvc.config().standardExtensionUrl.mapToModel;
                var baseTypeForModelUrl = appConfigSvc.config().standardExtensionUrl.baseTypeForModel;
                var simpleExtensionUrl = appConfigSvc.config().standardExtensionUrl.simpleExtensionUrl;

                //todo - should use Utile.addExtension...
                var sd = {resourceType: 'StructureDefinition'};
                if (currentUser) {
                    this.addSimpleExtension(sd, appConfigSvc.config().standardExtensionUrl.userEmail, currentUser.email)
                }




                if (header.baseType) {
                    Utilities.addExtensionOnce(sd, baseTypeForModelUrl, {valueString: header.baseType})
                    // this.addSimpleExtension(sd,baseTypeForModel,header.baseType)
                }


                sd.id = scope.rootName;
                sd.url = appConfigSvc.getCurrentConformanceServer().url + "StructureDefinition/" + sd.id;
                sd.name = header.name;
                sd.title = header.title;
                sd.publisher = header.publisher;
                sd.status = 'draft';
                sd.date = moment().format();


                //sd.

                sd.purpose = header.purpose;
                sd.description = header.description;

                //sd.publisher = scope.input.publisher;
                //at the time of writing (Oct 12), the implementaton of stu3 varies wrt 'code' & 'keyword'. Remove this eventually...
                sd.identifier = [{system: "http://clinfhir.com", value: "author"}]
                sd.keyword = [{system: 'http://fhir.hl7.org.nz/NamingSystem/application', code: 'clinfhir'}]

                if (header.mapping) {
                    //mapping comments for the target resource as a whole...
                    sd.mapping = [{identity: 'fhir', name: 'Model Mapping', comments: header.mapping}]
                }

                if (header.type) {
                    var uc = {
                        code: {
                            code: 'logicalType',
                            system: 'http:www.hl7.org.nz/NamingSystem/logicalModelContext'
                        }
                    };
                    uc.valueCodeableConcept = {
                        coding: [{
                            code: header.type,
                            'system': 'http:www.hl7.org.nz/NamingSystem/logicalModelContextType'
                        }]
                    };
                    sd.useContext = [uc]

                }

                sd.kind = 'logical';
                sd.abstract = false;
                sd.baseDefinition = "http://hl7.org/fhir/StructureDefinition/Element";
                sd.type = scope.rootName;
                sd.derivation = 'specialization';

                sd.snapshot = {element: []};

                treeData.forEach(function (item) {
                    var data = item.data;
                    // console.log(data);
                    var ed = {}
                    //this element is mapped to a simple extension. Do this first so the extensions are at the top...
                    if (data.fhirMappingExtensionUrl) {
                        Utilities.addExtensionOnce(ed, simpleExtensionUrl, {valueString: data.fhirMappingExtensionUrl})
                    }


                    ed.id = data.path;
                    ed.path = data.path;
                    ed.short = data.short;
                    ed.definition = data.description || 'No description';
                    ed.min = data.min;
                    ed.max = data.max;
                    ed.comments = data.comments;


                  //  if (data.mappingPath) {         //the actual path in the target resource
                        //ed.mapping = [{identity: 'fhir', map: data.mappingPath}]
                    //}

/*
                    if (data.mappingPathV2) {         //the actual path in the target resource
                        ed.mapping = ed.mapping || [];
                        ed.mapping.push({identity: 'hl7V2', map: data.mappingPathV2});
                    }

*/
                    if (data.mappingFromED ) {
                        ed.mapping =  [];

                        data.mappingFromED.forEach(function(map){
                            if (map.map) {
                                map.comment = map.comment || "";
                                //a horrible hack as hapi doesn't yet support comments
                                var ar = map.map.split('|')
                                map.map = ar[0]+ "|"+map.comment;
                                ed.mapping.push({identity:map.identity, map: map.map, comment: map.comment});
                            }

                        })
                    }
/* - temp - need to migrate...

                    if (data.mapping) {
                        //comments about the mapping - added as an extension to the first mapping node mapping
                        //todo - might want separate notes per
                        var mappingNode = {}
                        if (ed.mapping) {
                            //just in case there is more than one mapping
                            mappingNode = ed.mapping[0]
                        } else {
                            ed.mapping = []
                        }

                        //adds an extension of this url once only to the specified node. Won't replace existing...
                        Utilities.addExtensionOnce(mappingNode, mappingCommentUrl, {valueString: data.mapping})
                        //ed.mapping = ed.mapping || []
                        ed.mapping[0] = mappingNode;
                    }

*/


                    //todo - not sure about this..
                    if (data.mapToModelUrl) {
                        //this element will actually be mapped to another model (eventually another profile)
                        //also added as an extension to the first mapping node mapping
                        var mapToModelNode = {}
                        if (ed.mapping) {
                            mapToModelNode = ed.mapping[0]
                        } else {
                            ed.mapping = []
                        }

                        //adds an extension of this url once only to the specified node
                        Utilities.addExtensionOnce(mapToModelNode, mapToModelExtensionUrl, {valueUri: data.mapToModelUrl})
                        ed.mapping = ed.mapping || []
                        ed.mapping[0] = mapToModelNode;


                    }


                    if (data.type) {
                        ed.type = [];
                        data.type.forEach(function (typ) {
                            //actually, there will only ever be one type at the moment...
                            ed.type.push(typ);
                        })
                    }

                    ed.base = {
                        path: ed.path, min: 0, max: '1'
                    };

                    if (data.selectedValueSet) {
                        ed.binding = {strength: data.selectedValueSet.strength};
                        ed.binding.valueSetUri = data.selectedValueSet.vs.url;
                        ed.binding.description = data.selectedValueSet.vs.name;

                    }

                    ed.fixedString = data.fixedString;  //todo needs to be a compatible type
                    sd.snapshot.element.push(ed)
                });

                return sd;



            },
            reOrderTree: function (treeData) {
                //ensure the elements in the tree array are sorted by parent / child
                var arTree = [treeData[0]];

                findChildren(treeData[0].data.path, treeData[0].id, arTree);
                return arTree;


                function findChildren(parentPath, parentId, arTree) {
                    treeData.forEach(function (node) {
                        if (node.parent == parentId) {
                            arTree.push(node);
                            var childPath = parentPath + '.' + node.data.name;
                            //console.log(childPath);
                            // node.data.path = childPath;
                            findChildren(childPath, node.id, arTree)
                        }
                    })

                }

            },
            generateChatDisplay: function (chatFromServer) {


                var ar = [];    //a list of all comments in display order

                function parseComment(ar, lvl, comment, levelKey) {
                    //lvl- display level, comment - the chat being examined

                    if (lvl == 1) {
                        levelKey = comment.id;
                    }

                    var displayComment = {level: lvl, comment: comment, levelKey: levelKey}
                    ar.push(displayComment);
                    //console.log(displayComment)
                    if (comment.children) {
                        lvl++;
                        comment.children.forEach(function (childComment) {
                            parseComment(ar, lvl, childComment, levelKey)
                        })
                    }

                }

                parseComment(ar, 0, chatFromServer);

                console.log(ar)

                return ar


            },
            resolveProfile: function (url) {
                //return a SD as a logical model from a profile that resolves extensions....
                var deferred = $q.defer();
                GetDataFromServer.findConformanceResourceByUri(url).then(
                    function (SD) {
                        console.log(SD)

                        if (SD && SD.snapshot && SD.snapshot.element) {
                            SD.snapshot.element.forEach(function (ed) {
                                console.log(ed.path)
                            })

                        }

                    }
                )
                return deferred.promise;

            },
            loadAllModels: function (conformanceServerUrl) {
                //$scope.conformanceServer
                var deferred = $q.defer();
                var url = conformanceServerUrl + "StructureDefinition?kind=logical&identifier=http://clinfhir.com|author";

                //var url="http://fhir3.healthintersections.com.au/open/StructureDefinition?kind=logical&identifier=http://clinfhir.com|author";
                GetDataFromServer.adHocFHIRQueryFollowingPaging(url).then(
                    // $http.get(url).then(
                    function (data) {
                        var bundleModels = data.data
                        bundleModels.entry = bundleModels.entry || [];    //in case there are no models
                        bundleModels.entry.sort(function (ent1, ent2) {
                            if (ent1.resource.id > ent2.resource.id) {
                                return 1
                            } else {
                                return -1
                            }
                        })
                        deferred.resolve(bundleModels);


                    },
                    function (err) {
                        deferred.reject('Error loading models: ' + angular.toJson(err));
                    }
                )
                return deferred.promise;
            },

            differenceFromBase : function(lm) {
               // var elementsToIgnore = ['id', 'meta', 'implicitRules', 'language', 'text', 'contained', 'extension', 'modifierExtension'];
                var that = this;
                var deferred = $q.defer();

                var lmBaseType = lm.snapshot.element[0].path;       //always the first in the list...

                //generate the differences between the Logical model and any base model defined
                var baseTypeForModel = appConfigSvc.config().standardExtensionUrl.baseTypeForModel;
                var extensionValue = Utilities.getSingleExtensionValue(lm,baseTypeForModel);
                if (extensionValue && extensionValue.valueString) {
                    var baseType = extensionValue.valueString;      //the type name of the core resource this one is based on.
                    baseProfileUrl = "http://hl7.org/fhir/StructureDefinition/"+baseType
                    var lmHash = getSDHash(lm);     //a hash keyed by path
                    console.log(lmHash,baseType)
                    GetDataFromServer.findConformanceResourceByUri(baseProfileUrl).then(
                        function(SD) {
                            var baseTypeHash = getSDHash(SD)
                            //console.log(baseTypeHash)
                            var analysis = {removed:[],added:[],changed:[]}
                            //first, move through all the elements in the lm. If there is not a corresponding path in the base profile (allowing for name changes) then it was added...
                            lm.snapshot.element.forEach(function(ed){
                                var adjustedPath = ed.path.setFirstSegment(baseType)    //note the setFirstSegment function was added to the string prototype at the top of this service
                                //console.log(adjustedPath)
                                if (! baseTypeHash[adjustedPath]) {
                                    analysis.added.push(ed);
                                } else {
                                    //so the element is still present, was it changed?
                                    var lst = getDifferenceBetweenED(baseTypeHash[adjustedPath],ed)
                                    if (lst.length > 0) {
                                        analysis.changed.push({ed:ed,list:lst})
                                    }
                                }

                            });

                            //now move through the base profile. Any ed's not in the lm have been removed
                            SD.snapshot.element.forEach(function(ed){
                                var adjustedPath = ed.path.setFirstSegment(lmBaseType)    //note the setFirstSegment function was added to the string prototype at the top of this service

                                if (! lmHash[adjustedPath]) {
                                    //nope, gone. Do we care?
                                    if (elementsToIgnore.indexOf(adjustedPath.getLastSegment()) == -1 ) {
                                        //yes, we do...
                                        analysis.removed.push(ed);
                                    }
                                }

                            });




                            console.log(analysis);
                            deferred.resolve(analysis)

                        },
                        function(err) {
                            deferred.reject(err)
                        }
                    )



                } else {
                    //this is not based on a single core resource type
                }
                return deferred.promise;

                function getDifferenceBetweenED(EDSource,EDTarg) {
                    var lst = []
                    if (EDSource.min !== EDTarg.min) {
                        lst.push({code:'minChanged',display: 'Minimum changed from '+ EDSource.min + ' to ' + EDTarg.min})
                    }
                    if (EDSource.max !== EDTarg.max) {
                        lst.push({code:'maxChanged',display: 'Maximum changed from '+ EDSource.min + ' to ' + EDTarg.min})
                    }

                    //todo check for both url and reference
                    if (EDSource.binding) {
                        if (EDTarg.binding) {
                            //the target has a binding - is it the same?
                            if (EDSource.binding.valueUri !== EDTarg.binding.valueUri) {
                                lst.push({code:'bindingUriChanged',display: 'ValueSet changed from '+ EDSource.binding.valueUri + ' to ' + EDTarg.binding.valueUri})
                            }
                        } else {
                            lst.push({code:'bindingUriChanged',display: 'Source Binding removed.'})
                        }

                    } else {
                        //the source has no binding, has the target?
                        if (EDTarg.binding) {

                        }
                    }


                    return lst;
                }

                function getSDHash(SD) {
                    var hash = {};
                    if (SD && SD.snapshot && SD.snapshot.element){
                        SD.snapshot.element.forEach(function(ed){
                            hash[ed.path] = ed;
                        })

                    }
                    return hash;
                }

            }

        }
    });
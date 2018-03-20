angular.module("sampleApp")
    //this returns config options. At the moment it is for servers...
    //also holds the current patient and all their resources...
    //note that the current profile is maintained by resourceCreatorSvc

    .service('logicalModelSvc', function($http,$q,appConfigSvc,GetDataFromServer,Utilities,$filter,
                                         $localStorage) {

        var currentUser;
        var elementsToIgnore =['id','meta','implicitRules','language','text','contained','extension','modifierExtension'];
        var hashTreeState = {};   //save the state of the tree wrt expanded nodes so it can be restored after editing

        //VS that are too large to expand in full...
        var expansionBlacklist = [];
        expansionBlacklist.push('http://hl7.org/fhir/ValueSet/observation-codes');

        //the url to the extension in an element...
        var simpleExtensionUrl = appConfigSvc.config().standardExtensionUrl.simpleExtensionUrl


        var dataTypes = [];
        $http.get("artifacts/dt.json").then(
            function(data) {
                dataTypes = data.data;

            }
        );

        //logical models (like Dosage). Might extend to complex datatypes for expanding logical models later on...
        var fhirLM = {}
        $http.get("artifacts/fhirLM.json").then(
            function(data) {
                fhirLM = data.data;

            }
        );


        //set the first segment of a path to the supplied value. Used when determining differneces from the base type
        String.prototype.setFirstSegment = function(firstSegment) {
            var ar = this.split('.');
            ar[0] = firstSegment;
            return ar.join('.')
        };
        String.prototype.getLastSegment = function() {
            var ar = this.split('.');
            return ar[ar.length-1]
        };

        //get the mapping for this logicam model element to FHIR...
        var getFhirMapping = function(map) {
            var fhirPath;
            if (map) {
                map.forEach(function (mp) {
                    if (mp.identity == 'fhir') {
                        fhirPath =  mp.map;
                    }
                })
            }
            return fhirPath;
        };


        //common function for decorating various properties of the treeview when building form an SD. Used when creating a new one & editing
        function decorateTreeView(item,ed) {
            //decorate the type elements...
            if (item.data.type) {
                item.data.type.forEach(function(typ){
                    if (typ.code) {
                        var first = typ.code.substr(0,1);
                        if (first == first.toUpperCase()) {
                            typ.isComplexDT = true;
                        }
                    }
                })

            }
            var ar = ed.path.split('.')
            //don't set for the first element (oterwise the colour cascades down....
            if (ed.min == 1 && ar.length > 1) {
                item['li_attr'] = {class: 'elementRequired'};
            } else {
                item['li_attr'] = {class: 'elementOptional'};
            }

            if (ed.fixedString) {
                item['li_attr'] = {class: 'elementFixed'};
            }
        }


        //a cache of patient references by type. todo may need to enhance this when supporting profiles...
        var patientReferenceCache = {};
        var multiple = {}       //todo hack!!!  multiple paths...
        multiple['Composition.section.entry'] = "*"

        return {
            makeIG : function(tree){
                var deferred = $q.defer();
                //construct an Implementation Guide based on the model...
                var hash = {};      //track urls to avoid duplication...
                var IG = {resourceType:'ImplementationGuide',status:'draft',package:[{name:'complete',resource:[]}]};
                IG.id = 'cf-artifacts-cc3';
                IG.description = "Logical Model Profiles";
                IG.extension = [{url: "http://clinfhir.com/fhir/StructureDefinition/cfAuthor",valueBoolean:true}]

                tree.forEach(function (node,inx) {
                    if (inx === 0) {
                      /*  var ext = Utilities.getSingleExtensionValue(node.data.header,
                            appConfigSvc.config().standardExtensionUrl.baseTypeForModel)
                        if (ext && ext.valueString) {
                            var resource = {resourceType: ext.valueString, id: node.id}
                            hash[node.id] = resource;
                            bundle.entry.push({resource: resource})
                        }
                        */
                    } else {
                        if (node.data && node.data.referenceUrl) {
                            //this is a reference to a resource. Eventually this will be a profile - for now add the base type as well...
                            var resourceType = $filter('referenceType')(node.data.referenceUrl)
                            var resource = {resourceType: resourceType, id: node.id}
                            var description = node.data.short;
                            if (node.data.short) {
                                resource.text = {div: node.data.short}
                            }
                            if (! hash[node.data.referenceUrl]) {
                                //create an entry for this

                                var IGEntry = {description:description,sourceReference:{reference:node.data.referenceUrl}};
                                addExtension(IGEntry,'profile')

                                IG.package[0].resource.push(IGEntry);

                                hash[node.data.referenceUrl] = 'x'
                            }


                        }
                    }
                });

                deferred.resolve(IG);


                return deferred.promise;


                function addExtension(entry,term) {
                    entry.extension = [];
                    var extension = {url:'http://clinfhir.com/StructureDefinition/igEntryType'}
                    extension.valueCode = term;
                }


            },
            makeMappingDownload : function(SD) {
                var download = "Path,Type,Multiplicity,Definition,Comment,Mapping,Fixed Value,Extension Url\n";

                if (SD && SD.snapshot && SD.snapshot.element) {
                    SD.snapshot.element.forEach(function (ed) {
                        //don't add the first element
                        var ar = ed.path.split('.')
                        if (ar.length > 1) {
                            ar.splice(0,1)
                            var lne = ar.join('.') + ',';
                            if (ed.type) {
                                lne += ed.type[0].code + ',';
                            } else {
                                lne += ','
                            }

                            lne += ed.min + '..'+ed.max + ',';
                            lne += makeSafe(ed.definition) + ",";
                            lne += makeSafe(ed.comment) + ",";

                            if (ed.mapping) {
                                ed.mapping.forEach(function(map){
                                    lne += map.identity + ':' +  $filter('showMapOnly')(map.map)
                                })
                            };
                            lne += ',';
                            if (ed.fixedString) {
                                lne += ed.fixedString
                            }
                            lne += ',';

                            var ext = Utilities.getSingleExtensionValue(ed,simpleExtensionUrl);
                            if (ext && ext.valueString) {
                                lne += ed.valueString
                            }


                            download += lne + "\n";
                        }

                    })

                }
                return download;

                //remove comma's and convert " -> '
                function makeSafe(s) {
                    if (s) {
                        s = s.replace(/"/g, "'");
                        s = s.replace(/,/g, "-");
                        return '"' + s + '"';
                    }

                }


            },
            saveScenario : function(bundle,modelName) {
                //save a bundle as a scenario. Make the name of the scenario the same as the model name,

                //create the container...
                var container = {name:modelName,bundle:bundle};
                //container.tracker = [];
                //container.history = [];
                //container.index = 0;
                container.server = {data:appConfigSvc.getCurrentDataServer()};

                $localStorage.builderBundles = $localStorage.builderBundles || []
                var pos = -1;
                $localStorage.builderBundles.forEach(function(container,inx){
                    if (container.name == modelName) {
                        pos = inx
                    }
                });

                if (pos > -1) {
                    //replace
                    $localStorage.builderBundles[pos] = container;
                } else {
                    //new
                    $localStorage.builderBundles.push(container);
                }


                if ($localStorage.builderBundles.length == 0) {

                }

            },
            getSample : function(ed) {
                //return a sample based on an ed.
                var dt;
                if (ed && ed.type) {
                    dt = ed.type[0].code;
                }

                var sample;
                //look for fixed values - always stored as a string
                var fixed = ed.fixedString;
                if (fixed) {
                    console.log(fixed)

                    if (fixed.indexOf('{') > -1) {
                        try {


                            return angular.fromJson(fixed);
                        } catch (ex){
                            console.log('error parsing '+fixed);
                        }
                    } else {
                        return fixed;
                    }



                }


/*
                for (var key in ed) {
                    if (ed.substr(0,5)== 'fixed') {
                        sample = ed[key]
                    }
                }
             */


                sample = "sample";      //default to a string
                switch (dt) {
                    case 'Identifier' :
                        sample = {'system':'http://moh.govt.nz/nhi','value':'WER4568'};
                        break;
                    case 'CodeableConcept' :
                        sample = {text:'Sample Data',coding:[{'system':'http://snomed.info/sct','code':'12234556'}]};
                        break;
                    case 'dateTime' :
                        sample= '1955-12-16T12:30';
                        break;
                    case 'HumanName' :
                        sample = {use:'official',family:'Doe',given:['John'],text:'John Doe'};
                        break;
                    case 'code' :
                        sample = 'm';
                        break;
                    case 'Address' :
                        sample = {"use": "home","type": "both","text": "534 Erewhon St PeasantVille, Rainbow, Vic  3999","line": ["534 Erewhon St"],"city": "PleasantVille"}
                        break;
                    case 'ContactPoint' :
                        sample = {"system": "email",value:"here@there.com",use:"home"};
                        break;
                    case 'Period' :
                        sample = {start:"1974-11-25T14:35",end:"1974-12-25T14:35"};
                        break;
                    case 'boolean' :
                        sample = true;
                        break;
                    case 'Dosage' :
                        sample = {text:"1 tab twice a day",route:{text:'oral'}}
                        break;
                    case 'Reference' :
                        sample = null;
                        break;
                }

                return sample;
            },
            isMultiple : function(path) {
                //true if a given path is multiple. todo - need to read from the SD...
                if (multiple[path]) {
                    return true
                } else {
                    return false;
                }
            },
            makeScenario : function(tree) {
                var deferred = $q.defer();
                var that = this;
                //generate a scenario from the model (as a tree)
                var bundle = {resourceType:'Bundle',entry:[],type:'collection'};
                var patient = null;   //if there's a patient resource in the model...
                var hash = {};
                var arQuery = [];

                //function to put in a sample value for all direct children of a resource...
                function populateElements(resource) {
                    var id = resource.id;   //the node (&resource) id
                    //find all the nodes on the tree that are direct children of this node
                    tree.forEach(function (node) {
                        if (node.parent == id) {
                            //console.log(node.id)

                            var mappingPath = getMapValueForIdentity(node.data.ed,'fhir')
                            //console.log(mappingPath)
                            if (mappingPath) {
                                var ar = mappingPath.split('.')
                                var eleName = ar[1];
                                var sampleData = that.getSample(node.data.ed) ;
                                if (sampleData) {
                                    if (node.data.ed.max == 1) {
                                        resource[eleName] = sampleData;
                                    } else {
                                        resource[eleName] = [sampleData];
                                    }
                                }

                            }
                        }
                    })
                }

                tree.forEach(function (node,inx) {
                    if (inx === 0) {
                        //this is the root
                        var ext = Utilities.getSingleExtensionValue(node.data.header,
                            appConfigSvc.config().standardExtensionUrl.baseTypeForModel)
                        if (ext && ext.valueString) {
                            //the model has a base resource (like a Document)
                            var resource = {resourceType:ext.valueString,id:node.id};
                            resource.text = {div:"test"}
                            populateElements(resource)
                            hash[node.id] = resource;

                            bundle.entry.push({resource:resource})

                            if (ext.valueString == 'Composition') {
                                //this is a Document...
                                bundle.type='document';
                            }
                        }
                    } else {
                        if (node.data && node.data.referenceUrl) {
                            var resourceType = $filter('referenceType')(node.data.referenceUrl);
                            var resource = {resourceType:resourceType,id:node.id};
                            populateElements(resource);
                            var fullUrl = appConfigSvc.getCurrentDataServer().url+resourceType + "/" + node.id;

                            if (node.data.short) {
                                resource.text = {div:node.data.short}
                            }

                            if (resourceType == 'Patient') {
                                if (patient) {
                                    //if there's already a patient, then don't add another..
                                    hash[node.id] = patient
                                } else {
                                    //otherwise add it...
                                    patient = resource;
                                    hash[node.id] = resource
                                    bundle.entry.push({fullUrl:fullUrl,resource:resource})


                                }
                            } else {
                                //any resource other than a patient...
                                hash[node.id] = resource;
                                bundle.entry.push({fullUrl:fullUrl,resource:resource})
                                arQuery.push(getPatientReference(resourceType));
                            }
                        }
                    }
                });

                //set up any references that can be done by referring to a parent...
                for (var i=1; i< tree.length;i++) {

                    var node = tree[i];

                    var ed;
                    if (node.data) {
                        ed = node.data.ed;
                    }


                    //the hash contains  nodes which have an associated resource(reference) in it...
                    if (hash[node.id]) {
                        //yes, this node has an associated resource (only nodes with a resource are in the hash)...
                        var thisResource = hash[node.id];       //this resource - the one that the psrent will reference
                        var parentNodeResource = hash[node.parent];
                        //console.log(parentNodeResource)

                        if (parentNodeResource) {
                            var mappingPath = getMapValueForIdentity(node.data.ed,'fhir')
                            //and the parent is also a resource - create a reference...
                            if (mappingPath) {
                                //console.log(mappingPath);
                                var ar = mappingPath.split('.');
                                switch (ar.length) {
                                    case 2 :
                                        //eg Composition.subject
                                        //assume the source is always multiple as the logical model may have more than one reference...
                                        var elementName = ar[1];


                                        console.log(mappingPath,parentNodeResource[elementName])

                                        //see if the mapping path is multiple...
                                        //note that a consequence of this is that if a singular mappingpath (like Composition.author) is present more than once, only the last one will be in the sample...
                                        if (that.isMultiple(mappingPath)) {
                                            parentNodeResource[elementName] = parentNodeResource[elementName] || [] ;//<<<<<<<<<<<<<
                                            parentNodeResource[elementName].push({reference: thisResource.resourceType + "/"+ thisResource.id})
                                        } else {
                                           // parentNodeResource[elementName] = parentNodeResource[elementName] || [] ;//<<<<<<<<<<<<<
                                            parentNodeResource[elementName] = {reference: thisResource.resourceType + "/"+ thisResource.id}

                                        }




                                       // parentNodeResource[elementName] = {reference: thisResource.resourceType + "/"+ thisResource.id}
                                        //console.log(parentNodeResource)
                                        break;
                                    case 3 :
                                        //eg Composition.section.entry
                                        //assume for now that the parent is always multiple (todo - not true for careplan, likely need to look this up)
                                        var parentElementName = ar[1];
                                        var elementName = ar[2];
                                        //var reference = thisResource.resourceType + "/"+ thisResource.id;

                                        parentNodeResource[parentElementName] = parentNodeResource[parentElementName] || [];
                                        var arParentElement = parentNodeResource[parentElementName];    //eg Composition.section
                                        var elementToAdd = {}
                                        //elementToAdd[elementName] = {reference: thisResource.resourceType + "/"+ thisResource.id};


                                        //console.log(mappingPath,ed.max)
                                        if (that.isMultiple(mappingPath)) {     //true if there can be multiple elements at this path...
                                            elementToAdd[elementName] = [{reference: thisResource.resourceType + "/"+ thisResource.id}];
                                        } else {
                                            elementToAdd[elementName] = {reference: thisResource.resourceType + "/"+ thisResource.id};
                                        }


                                        arParentElement.push(elementToAdd)


                                        //console.log(parentNodeResource)
                                        break;
                                }



                            }




                        }

                    }

                }



                //if there's a patient, then set all the patient references for all resources.
                //***** note **** this will only work for references off the resource root - like Condition.patient
                if (patient) {
                    if (arQuery.length > 0) {


                        $q.all(arQuery).then(
                            function(data){
                                //all the SDs have been collected and analysed. patientReferenceCache has the pateint refernecs by type......
                                //console.log(patientReferenceCache)

                                //now go through the bundle, setting the patient reference for all
                                bundle.entry.forEach(function (entry) {
                                    var resource = entry.resource;
                                    var pp = patientReferenceCache[resource.resourceType];
                                    if (pp) {
                                        var ar = pp.split('.');
                                        if (ar.length == 2) {
                                            //assume an entry like Conditon.patient
                                            var elementName = ar[1];
                                            resource[elementName] = {reference:'Patient/'+patient.id};
                                        }
                                    }

                                });

                                //now set up references based on the parent...


                                deferred.resolve(bundle)

                            })


                        } else {
                        //no other types in the model yet

                            deferred.resolve(bundle)

                        }



                } else {
                    //no patient so can't create any references...

                    deferred.resolve(bundle)
                }



                return deferred.promise;

                function getMapValueForIdentity(ed,identity){
                    //get the path for a given identity - fhir in this case
                    if (ed && ed.mapping) {
                        for (var i =0; i < ed.mapping.length; i++) {
                            var map =  ed.mapping[i];
                            if (map.identity == identity) {
                                var fhirPath = map.map;
                                if (fhirPath) {
                                    var ar = fhirPath.split('|');   //because the comment is in the same element (should have used an extension)
                                    return ar[0];
                                    break;
                                }

                            }
                        }
                    }

                }


                function getPatientReference(type) {
                    //find the patient reference path for this type (if it exists)
                    var deferred = $q.defer();


                    if (patientReferenceCache[type]) {

                        deferred.resolve(patientReferenceCache[type])
                    } else {
                        var url = 'http://hl7.org/fhir/StructureDefinition/'+type;  //right now, assume core types only
                        GetDataFromServer.findConformanceResourceByUri(url).then(
                            function(SD){

                                var patRef = gpr(SD);
                                if (patRef) {
                                    patientReferenceCache[type] = gpr(SD)
                                    deferred.resolve(patientReferenceCache[type])
                                } else {
                                    deferred.resolve();
                                }

                            },
                            function(err){
                                deferred.reject(err)
                            })
                    }


                    return deferred.promise


                }
                function gpr(SD) {
                    //find any patient reference in the SD..
                    var patRef;
                    if (SD.snapshot && SD.snapshot.element) {
                        for (var i=0; i< SD.snapshot.element.length; i++) {
                            var path = SD.snapshot.element[i].path;
                            var ar = path.split('.');
                            var seg = ar[ar.length-1]
                            if (seg == 'patient' || seg == 'subject') {
                                return path;
                                break;
                            }
                        }

                    }



                    return
                }


            },

            getMappingFile : function(url) {
                url = url || "http://fhir.hl7.org.nz/baseDstu2/StructureDefinition/OhEncounter";    //testing
                var deferred = $q.defer();
                var that = this;
                GetDataFromServer.findConformanceResourceByUri(url).then(
                    function(LM){
                        //create a v2 -> fhir mapping file for a given logical model. Used by the message comparer...
                        var treeData = that.createTreeArrayFromSD(LM)
                        var relativeMappings = that.getRelativeMappings(treeData); //items with both v2 & fhir mappings

                        var map = []
                        relativeMappings.forEach(function(m) {

                            map.push({description: m.branch.data.path,v2:m.sourceMap,fhir:m.targetMap,fhirPath:m.fhirPath})
                        })


                        deferred.resolve(map)

                    },
                    function(err) {
                        deferred.reject(err);
                    }
                )

                return deferred.promise;


            },

            getRelativeMappings : function(tree) {
                //find elements in the model that have mappings to both source and target

                var source="hl7V2";
                var target = "fhir";
                var arRelative = []
                tree.forEach(function (branch) {
                    var fhirPath = null;
                    var data = branch.data;
                    //see if there's a mapping for both source and target
                    if (data.mappingFromED) {
                        var sourceMap = "", targetMap = ""
                        data.mappingFromED.forEach(function (map) {
                            if (map.identity == source) {
                                sourceMap = map.map;
                            }
                            if (map.identity == target) {
                                targetMap = map.map;
                            }

                            if (map.identity == 'fhirpath') {
                                fhirPath = map.map
                            }

                        });
                        if (sourceMap && targetMap) {
                            var item = {source:source,sourceMap:sourceMap,target:target, targetMap:targetMap, branch:branch};
                            item.fhirPath = fhirPath;
                            item.type = data.type;



                            arRelative.push(item)
                        }



                    }
                })
                return arRelative;

            },
            getConceptMapMappings : function(url) {
                var deferred = $q.defer();
                if (url) {
                    $http.get(url).then(
                        function (data) {
                            if (data && data.data) {
                                var vo = {element:[]}
                                var group = data.data.group[0];
                                vo.sourceCS = group.source;
                                vo.targetCS = group.target;
                                if (group.element) {
                                    group.element.forEach(function(element){
                                        if (element.target) {
                                            element.target.forEach(function (target) {
                                                var map = {source:element.code,target:target.code,comment:target.comment,eq:target.equivalence}
                                                vo.element.push(map)

                                            })
                                        }
                                    })
                                    deferred.resolve(vo)
                                }
                            }
                            deferred.reject();

                        },function () {
                            deferred.reject();
                        }
                    )
                }
                return deferred.promise;

            },
            getEDForPath : function(SD,node){
                //return the ElementDefinition that corresponds to the mapped FHIR element..
                var path = node.data.path;
                /*
                if (node && node.data && node.data.mappingFromED) {
                    node.data.mappingFromED.forEach(function (map) {
                        if (map.identity == 'fhir') {
                            path = map.map;
                        }
                    })
                }
*/

                if (path && SD && SD.snapshot && SD.snapshot.element) {
                    for (var i=0;i < SD.snapshot.element.length;i++) {
                        var ed = SD.snapshot.element[i];
                        if (ed.path == path) {
                            return ed;
                            break;
                        }
                    }
                }

            },
            openTopLevelOnly : function(tree) {
                tree.forEach(function (node,inx) {
                    node.state = node.state || {}
                    if (inx ==0) {
                        node.state.opened=true;
                    } else {
                        node.state.opened=false;
                    }
                })
                this.saveTreeState(tree);
            },
            saveTreeState : function(tree) {
                //save the current state of the tree...
                hashTreeState= {}
                if (tree) {
                    tree.forEach(function(node){
                        var opened = false;
                        if (node.state && node.state.opened) {
                            opened = true;
                        }
                        hashTreeState[node.id] = {opened:opened}
                    })
                }

            },
            resetTreeState : function(tree) {
                //reset the tree state wrt opened/closed nodes
                if (tree) {
                    tree.forEach(function(node){
                        node.state = node.state || {}
                        node.state.opened = false;
                        if (hashTreeState[node.id]) {
                            node.state.opened = hashTreeState[node.id].opened;
                        }
                    })
                }
            },
            setAsDiscriminator : function(selectedNode,treeData){
                //set the FHIR path for this node to be the discriminator for all nodes which have the same FHIR path...
                if (selectedNode.data && selectedNode.data.mappingFromED)
                var discriminator = getFhirMapping(selectedNode.data.mappingFromED);    //the fhir path for this element will be the discriminator for
                var ar = discriminator.split('.')
                var rootPath = ar[0]+'.'+ar[1];     //assume that the element that is duplicated is always attached to the root  NOT TRUE
                //now check all the other nodes in the tree...
                treeData.forEach(function (node) {
                    if (node.data) {
                        var map = node.data.mappingFromED;
                        if (map) {
                            var fmp = getFhirMapping(map)   //this is the FHIR path. If it starts with the same path as rootPath, then set the discriminator
                            if (fmp.substr(rootPath) === rootPath){
                                node.data.discriminator = discriminator;
                            }

                        }

                    }

                })


            },
            isDiscriminatorRequired : function(node,treeData){
                var discriminatorReq = false;
                if (node.data && node.data.mappingFromED) {
                    var fhirPath = getFhirMapping(node.data.mappingFromED);     //the map for this element
                    //there is a mapping
                    var cnt = 0;
                    treeData.forEach(function (node) {
                        if (node.data) {
                            var map = node.data.mappingFromED;
                            if (map) {
                                var fmp = getFhirMapping(map)
                                if (fmp == fhirPath){
                                    cnt ++
                                }

                            }

                        }

                    })
                    if (cnt > 1) {
                        discriminatorReq = true;
                    }
                }
                return discriminatorReq;

                function getFhirMappingDEP(map) {
                    var fhirPath;
                    if (map) {
                        map.forEach(function (mp) {
                            if (mp.identity == 'fhir') {
                                fhirPath =  mp.map;
                            }
                        })
                    }
                    return fhirPath;
                }


            },

            explodeResource : function(treeData,node,url) {
                //get all teh child nodes for a resource...\\

                //todo need to exlute text if path length is 2...
                var arExclude=['id','extension','meta','implicitRules','modifierExtension','contained','language','text'];
                var deferred = $q.defer();

                var parentId = node.id;
                var parentPath = node.data.path;        //the path of the element that is being expanded...
                var lmRoot = treeData[0].data.path;     //the root of this model... (eg OhEncounter)
                var baseType = 'unknown';
                if (treeData[0] && treeData[0].data && treeData[0].data.header) {
                    baseType = treeData[0].data.header.baseType;    //base type
                }




                //var url = appConfigSvc.getCurrentConformanceServer().url + 'StructureDefinition/'+dt;

                GetDataFromServer.findConformanceResourceByUri(url).then( //     .adHocFHIRQuery(url).then(
                    function(dtSD) {
                        //var dtSD = data.data;
                        if (dtSD.snapshot && dtSD.snapshot.element) {

                            dtSD.snapshot.element.forEach(function (ele,inx) {

                                var originalPath = ele.path;        //used for the FHIR mapping in the 'imported' resource...
                                //the first letter needs to be lowercase, as it will be part of a path...
                                ele.path = ele.path.charAt(0).toLowerCase() + ele.path.slice(1);


                                var ar = ele.path.split('.')

                                if (ar.length == 2 && arExclude.indexOf(ar[1]) == -1) {

                                    ar.splice(0,1);     //remove the first part of the path (the dt name eg CodeableConcept)
                                    var pathForThisElement = parentPath + '.'+  ar.join('.');

                                    var newId = pathForThisElement; ///'t' + new Date().getTime()+inx;
                                    var newNode = {
                                        "id": newId,
                                        "parent": parentId,
                                        "text": ar[0],
                                        state: {opened: true},
                                        data : {}
                                    };


                                    newNode.data.name = ar[0];
                                    newNode.data.short = ele.short;



                                    newNode.data.path = pathForThisElement;///parentPath + '.'+  ar.join('.')
                                    newNode.data.min = ele.min;
                                    newNode.data.max = ele.max;



                                    //newNode.data.mappingFromED = [{identity:'fhir',map:baseType + '.'+ ele.path}]
                                    //the path is that of the resource being 'imported'
                                    newNode.data.mappingFromED = [{identity:'fhir',map: originalPath}]
                                    newNode.data.type = ele.type;
                                    newNode.data.type.forEach(function(typ){
                                        var first = typ.code.substr(0,1);
                                        if (first == first.toUpperCase()) {
                                            typ.isComplexDT = true;
                                        }
                                    })

                                    treeData.push(newNode);
                                }

                            })

                        }




                        deferred.resolve();

                    },function (err) {
                        deferred.reject(err)
                    }
                )
                return deferred.promise;
            },
            explodeDataType : function(treeData,node,dt) {
                var arExclude=['id','extension','modifierExtension'];
                var deferred = $q.defer();

                var parentId = node.id;
                var parentPath = node.data.path;            //the path of the element that is being expanded...
                var suffix = generateSuffix(treeData,node); //new Date().getTime();      //a prefix for the path to support multiple expands
                var lmRoot = treeData[0].data.path;         //the root of this model... (eg OhEncounter)
                var baseType = 'unknown';                   //base FHIR type for this node
                if (treeData[0] && treeData[0].data && treeData[0].data.header) {
                    baseType = treeData[0].data.header.baseType;    //base type
                }

                //if the parent node has a FHIR mapping, then we can create FHIR mappings for the children also...
                var fhirParentPath;
                if (node.data && node.data.mappingFromED) {
                    node.data.mappingFromED.forEach(function (map) {
                        if (map.identity == 'fhir') {
                            fhirParentPath = map.map;
                        }
                    })
                }


                var url = appConfigSvc.getCurrentConformanceServer().url + 'StructureDefinition/'+dt;
                GetDataFromServer.adHocFHIRQuery(url).then(
                    function(data) {
                        var dtSD = data.data;
                        if (dtSD.snapshot && dtSD.snapshot.element) {

                            dtSD.snapshot.element.forEach(function (ele,inx) {

                                //the first letter needs to be lowercase, as it will be part of a path...
                                ele.path = ele.path.charAt(0).toLowerCase() + ele.path.slice(1);    //this will be a codeableconcept


                                var ar = ele.path.split('.')

                                if (ar.length ==2 && arExclude.indexOf(ar[1]) == -1) {

                                    ar.splice(0,1);     //remove the first part of the path (the dt name eg CodeableConcept)

                                    //pathSegment used when adding a datatype to th emodel...
                                    var pathSegment = ar.join('.') + "_"+suffix;
                                    var pathForThisElement = parentPath + '.'+  pathSegment;

                                    var newId = pathForThisElement + 't' + new Date().getTime()+inx;
                                    var newNode = {
                                        "id": newId,
                                        "parent": parentId,
                                        "text": ar[0],
                                        state: {opened: true},
                                        data : {}
                                    };


                                    newNode.data.pathSegment = pathSegment;
                                    newNode.data.name = ar[0];
                                    newNode.data.short = ele.short;


                                    newNode.data.path = pathForThisElement;///parentPath + '.'+  ar.join('.')
                                    newNode.data.min = ele.min;
                                    newNode.data.max = ele.max;

                                    if (fhirParentPath) {

                                       // var fhirPath = baseType + '.'+ ele.path
                                        var fhirPath = fhirParentPath + '.' + ar.join('.')

                                        newNode.data.mappingFromED = [{identity:'fhir',map:fhirPath}]
                                    }




                                    newNode.data.type = ele.type;
                                    newNode.data.type.forEach(function(typ){
                                        var first = typ.code.substr(0,1);
                                        if (first == first.toUpperCase()) {
                                            typ.isComplexDT = true;
                                        }
                                    })

                                    treeData.push(newNode);
                                }

                            })

                        }




                        deferred.resolve();

                    },function (err) {
                        deferred.reject(err)
                    }
                )
                return deferred.promise;

                function generateSuffix(treeData,node){
                    //create a suffix which is the count of the number of child nodes +1
                    var nodeId = node.id;
                    ctr = 1;
                    treeData.forEach(function (node) {
                        if (node.parent == nodeId) {
                            ctr++;
                        }
                    })
                    return ctr;
                }

            },
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
                            //arDoc.push("### FHIPath and Mappings")
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
                                   // arDoc.push("###FHIR mapping:"+m)
                                    arDoc.push("**FHIR path:** " + m)
                                    if (c) {
                                        arDoc.push("")
                                        arDoc.push(c)
                                    }
                                } else {
                                    if (1==3) {
                                        arDoc.push("");
                                        var m = map.map;
                                        if (m) {
                                            var c = map.comment;
                                            var ar1 = m.split('|');
                                            m = ar1[0];
                                            if (ar1.length > 1 && ! c) {
                                                c = ar1[1]
                                            }

                                            m = m.replace('|',"");
                                            //arDoc.push("###"+map.identity+ " mapping:"+m)
                                            arDoc.push('**'+ map.identity + ":** " + m)
                                            if (c) {
                                                arDoc.push("")
                                                arDoc.push(c)
                                            }
                                        }
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
                }



                var realProfile = angular.copy(internalLM);      //the profile that we will build...
                realProfile.snapshot = {element:[]};            //get rid of the current element defintiions...
                realProfile.id = realProfile.id+'-cf-profile';   //construct an id
                realProfile.url = realProfile.url+'-cf-profile';   //and a url...
                realProfile.kind = 'resource';

                realProfile.derivation = 'constraint'


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
                        deferred.reject(angular.toJson(err));
                    }
                );

                return deferred.promise;


                //SD is the base profile from the core spec...
                function makeFHIRProfile(SD) {
                    var discriminatorUrl = appConfigSvc.config().standardExtensionUrl.discriminatorUrl;

                    var err = [];
                    var ok = [];
                    var slices = [];            // a collection of all sliced elements
                    var ignorePath = [];        //paths to be ignored. Used for child elements of References...
                    var arDiscriminator = [];   //paths for which a discriminator entry has been made
                    var arPathsAdded = [];      //paths added so far...



                    //create a hash of all the paths in the base resource type (That is being profiled)...
                    var basePathHash = {};
                   // var listOfDataTypes = {};   //a hash of all the datatypes used by the model
                    SD.snapshot.element.forEach(function(ed){
                        basePathHash[ed.path] = ed;
                        if (ed.type) {
                            ed.type.forEach(function (typ) {
                                //if the type is a complex datatype, then add the children... the dataTypes array is read at the top of this service
                                if (dataTypes[typ.code]) {
                                    dataTypes[typ.code].forEach(function (child) {
                                        var childPath = ed.path + "." + child;
                                        basePathHash[childPath] = ed;

                                    })
                                }

                            })
                        }

                    });



                    //now work through the model. if there's no mapping, then an error. If an extension then insert the url...
                    internalLM.snapshot.element.forEach(function(ed,inx){
                        var newED = angular.copy(ed);

                        //remove invalid property that was added in the logival model to support internal processing
                        if (newED.type){
                            newED.type.forEach(function (typ) {
                                delete typ.isComplexDT;
                            })
                        }

                        //the current path will not be correct (it is in the logical model) - we need to get this from the FHIR mapping
                        var oldPath = newED.path;       //save the old path
                        delete newED.path;

                        if (inx == 0) {
                            //this is the root element
                            newED.path = baseType;
                        } else {
                            //get the path mapping for this element and update the path in the newED element
                            if (ed.mapping) {
                                ed.mapping.forEach(function (map) {
                                    if (map.identity=='fhir') {

                                        //the hack for the mapping comments
                                        if (map.map) {
                                            var ar1 = map.map.split('|');
                                            var fhirPath = ar1[0];      //this is the 'real' path in the SD



                                            //if the mapping path has '[ ', then this is a sliced element.
                                            /* I don't think this is true any more...
                                            var ar2 = fhirPath.split('[')
                                            if (ar2.length > 1) {
                                                newED.path = map.map;//map.map
                                                slices.push(newED)
                                            } else {
                                                newED.path = fhirPath;//map.map
                                            }
                                            */
                                            newED.path = fhirPath;//map.map
                                        }
                                    }
                                })
                            }

                        }

                        var addToProfile = true;

                        newED.id = baseType + ':' + newED.path + '-' + inx ;    //id is mandatory - but not used...
                        var path = newED.path;



                        //if the oldPath value is in the list of ignorePaths then ignore
                        if (addToProfile) {
                            ignorePath.forEach(function (ignore) {
                                if (oldPath.substr(0,ignore.length) === ignore) {
                                    addToProfile = false;
                                }

                            })
                        }

                        if (addToProfile) {
                            if (path && path.indexOf('[x]') > -1) {
                                ignorePath.push(oldPath)    //don't include any of the children in the profile. May need to revisit this...

                                //this is a choice type - change the name to the first type

/*


                                if (newED.type){
                                    var cd = newED.type[0].code; // the datatype
                                    cd = cd.substr(0,1).toUpperCase() + cd.substr(1)

                                    //now change the path segment with the [x]
                                    var ar = path.split('.');
                                    newAr = []
                                    ar.forEach(function (s) {
                                        var g = s.indexOf('[x]');
                                        if (g > -1) {
                                            s = s.substr(0,g) +cd;
                                        }
                                        newAr.push(s)

                                    })


                                    //var g = path.indexOf('[x]');
                                    newED.path = path + " " + newAr.join('.'); //path.substr(0,g) +cd;//  path.splice(g,3,cd);

                                    //newED.path = newED.path.substr(0,newED.path.length-4) + cd.substr(0,1).toUpperCase() + cd.substr(1)


                                    basePathHash[newED.path] = newED;   //add to the list of acceptable paths. (Assumes that the path before the [x] is legit...
                                }
                                */

                            }
                        }

                        //check for a path in the FHIR mapping
                        if (addToProfile && ! newED.path) {
                            //there is no path - which means that there was no FHIR mapping
                            err.push("Path: " + oldPath + " needs to have a FHIR mapping")
                            addToProfile = false;
                        }

                        //exclude meta elements for now
                        if (addToProfile) {
                            var arNewPath = newED.path.split('.')
                            if (arNewPath.length > 1 && arNewPath[1] == 'meta') {
                                addToProfile = false;
                            }
                        }
/*
                        //if the oldPath value is in the list of ignorePaths then ignore
                        if (addToProfile) {
                            ignorePath.forEach(function (ignore) {
                                if (oldPath.substr(0,ignore.length) === ignore) {
                                    addToProfile = false;
                                }

                            })
                        }
*/

                        //if this is datatype of reference, then add it to the list of 'ignorePaths' so the children will not be included
                        if (addToProfile) {
                            if (ed.type) {
                                ed.type.forEach(function (typ) {
                                    if (typ.code == 'Reference') {
                                        ignorePath.push(oldPath);   //ignorePath works on the path in the model, not the mapping... Note we still add this element
                                    }
                                })
                            }
                        }


                        //if we still want to add to the profile, check for an extension...
                        if (addToProfile) {
                            if (newED.path.indexOf('extension') == -1) {
                                //not an extension...

                                if (!basePathHash[newED.path]) {
                                    err.push("Path: "+newED.path + " is not valid for this resource type")
                                    addToProfile = false;
                                }

                            } else {
                                //this is an extension...//if this is an extension then we need to insert the url to the extension...
                                addToProfile = false;       //Will add here, or not at all...
                                var ext = Utilities.getSingleExtensionValue(newED, appConfigSvc.config().standardExtensionUrl.simpleExtensionUrl)
                                if (ext && ext.valueString) {
                                    extensionUrl = ext.valueString;
                                    //need to set the type of the element to 'Extension' (In the LM it is the datatype)
                                    newED.type = {code:'Extension',profile:extensionUrl}
                                    delete newED.extension; //this is the extension that holds the url
                                    realProfile.snapshot.element.push(newED)

                                    ignorePath.push(oldPath); //If this is a complex extension and there are children in the model then ignore them...


                                } else {
                                    err.push("Path: "+newED.path + " is an extension, but there is no extension url given")
                                }


                            }
                        }


                        //If this path has already been added, then see if it matches a rootPath defined by a discriminator.
                        //If so, then it can be added. If not, then add to paths to ignore
                        if (addToProfile) {
                            var lPath = newED.path
                            if (arPathsAdded.indexOf(lPath) > -1) {
                                //a possible dupe - is this root covered by a discriminator?
                                var coveredByDiscriminator = false;
                                arDiscriminator.forEach(function (item) {
                                    if (lPath.substr(0,item.length) === item) {
                                        coveredByDiscriminator = true
                                    }
                                });

                                if (!coveredByDiscriminator ) {
                                    //no, it isn't. Don't add to the profile
                                    addToProfile = false;
                                }
                            }
                        }


                        //an element not yet added to the real profile
                        if (addToProfile) {

                            //if there's a discriminator, then add an entry - but once only
                            var extDiscriminator = Utilities.getSingleExtensionValue(ed, discriminatorUrl);
                            if (extDiscriminator) {
                                if (arDiscriminator.indexOf(newED.path) == -1) {
                                    var discriminator = extDiscriminator.valueString;
                                    var element = {id:'discriminator'+inx,path: newED.path}
                                    element.min = newED.min;
                                    element.max = newED.max;
                                    element.definition = "Discriminator";
                                    if (fhirVersion == 2) {
                                        element.slicing = {discriminator: discriminator}
                                    } else {
                                        element.slicing = {
                                            rules:'open',discriminator: {path: discriminator, type: 'value'}
                                        }
                                    }
                                    realProfile.snapshot.element.push(element)

                                    arDiscriminator.push(newED.path)    //so it only gets added once...
                                }
                            }

                            realProfile.snapshot.element.push(newED)
                            arPathsAdded.push(newED.path);
                            ok.push("Path: "+newED.path + " mapped ")
                        }
                    })







                    if (err.length > 0) {
                       // var msg = err.join(' ');
                        deferred.reject({err:err,ok:ok});
                    } else {

                        //write out
                        //
                       // deferred.resolve(realProfile)

                        deferred.resolve(realProfile)

/*
                        SaveDataToServer.saveResource(realProfile,appConfigSvc.getCurrentConformanceServer().url).then(
                            function(data) {
                                deferred.resolve(realProfile)
                            },function (err) {
                                deferred.reject(angular.toJson(err));
                            }
                        )
                        */


                    }

                }



            },

            makeReferencedMapsModel: function (SD, bundle) {
                //builds the model that has all the models referenced by the indicated SD, recursively...

                var that = this;
                var lst = [];

                //not recursive any more (ie just references from this model)
                getModelReferences(lst, SD, SD.url);      //recursively find all the references between models...



                //build the tree model...

                var arNodes = [], arEdges = [];
                var objNodes = {};


                //build all the edges - ie references
                lst.forEach(function (reference) {

                    var srcNode = getNodeByUrl(reference.src, reference.path, objNodes, arNodes);
                    var targNode = getNodeByUrl(reference.targ, reference.path, objNodes, arNodes);

                    var ar = reference.path.split('.');
                    var label = ar.pop();

                    arEdges.push({from: srcNode.id, to: targNode.id, label: label, arrows: {to: true}})
                });


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

                            if (item.data.referenceUrl) {
                                var resourceType = $filter('referenceType')(item.data.referenceUrl)  //todo currently only supports references to core resourc etypes...
                                var ref = {src: srcUrl, targ: item.data.referenceUrl, path: item.data.path, type: resourceType}
                                lst.push(ref);
                                /*  Not quite sure why I was doing this recursively...
                                var newSD = that.getModelFromBundle(bundle, item.data.referenceUrl);
                                if (newSD) {
                                    getModelReferences(lst, newSD, newSD.url)
                                }
                                */
                            }
                        }
                    })

                }


            },

            makeDocBundleWithComposition : function(SD) {

              //  return;

                //make a Bundle, assuming that the SD profiles a Composition
                var bundle = {resourceType:'Bundle',type:'document',entry:[]};

                var composition = {resourceType:'Composition',status:'preliminary',type:{text:'unknown'},title:'Autogenerated doc from Logical Modeller'}
                composition.date = moment().format();
                composition.section=[];
                composition.text = $filter('addTextDiv')('Composition')
                bundle.entry.push({resource:composition});
                var sectHash = {};
                var currentSectHash;
                var sectionReferences = [];     //all the references from a section...

                //all the non-sections for now...
                SD.snapshot.element.forEach(function (ed,inx) {

                    var mapPath = _.find(ed.mapping, {identity: 'fhir'});

                    var arPath = ed.path.split('.');
                    if (mapPath && mapPath.map && mapPath.map.indexOf('.section') > -1) {
                        if (arPath.length == 2) {
                            //the first entry for this section..
                            var sectName = arPath[1];   //the namm given to this section
                            sectHash[sectName] = {entry: []}
                            currentSectHash = sectHash[sectName]
                            composition.section.push(currentSectHash)

                        } else if (arPath.length == 3) {
                            //a section property - is there a fixed value? todo - currently only strings
                            if (ed.fixedString) {
                                var prop = arPath[2];   //?? should get this from the mapping???
                                if (prop != 'entry') {
                                    currentSectHash[prop] = ed.fixedString;
                                }
                            }
                        }
                    }

                    if (ed.type) {
                        ed.type.forEach(function (typ) {

                            if (typ.code == 'Reference') {

                                var profile = typ.targetProfile;        //internal represntation is this...
                                if (profile) {
                                    var type = $filter('getLogicalID')(profile) //todo only work for core types

                                    var resource = {resourceType: type};
                                    bundle.entry.push({resource: resource});
                                    resource.id = 'auto' + inx;
                                    resource.text = $filter('addTextDiv')(type);

                                    var ref = {reference: type + "/" + resource.id,display:$filter('dropFirstInPath')(ed.path)};



                                    //this will only work for sections directly off the root...
                                    if (mapPath && mapPath.map && mapPath.map.indexOf('.section.') > -1) {
                                        //this is a reference within a section. add a reference to it from the current section hash

                                        currentSectHash.entry.push(ref);


                                    } else {
                                        //this is a reference that is not off a section
                                        if (arPath.length ==2) {    //todo - are there references off the root?
                                            var segment = arPath[1];
                                            if (ed.max == 1) {
                                                composition[segment] = ref;
                                            } else {
                                                composition[segment] = composition[segment] || []
                                                composition[segment].push(ref)
                                            }

                                        }

                                    }

                                }
                            }
                        })
                    }

                });

                //console.log(composition)
                return bundle;
            },

            makeDocBundle : function(lst){
                //lst {src:, targ:, path:, type} = from getModelReferences function()
                //make a bundle that has an instance of all the referenced models (and their paths). suitable for Scenario Builder
                //For each reference, create a new instance of the target resource...
                var bundle = {resourceType:'Bundle',type:'document',entry:[]};
                var composition = {resourceType:'Composition',status:'preliminary',type:{text:'unknown'},title:'Autogenerated doc from Logical Modeller'}
                composition.date = moment().format();
                composition.section=[];
                bundle.entry.push({resource:composition});

                //
                lst.forEach(function (item,inx) {
                    var resource ={resourceType:item.type};
                    bundle.entry.push({resource:resource});
                    resource.id = 'auto'+inx;
                    if (item.type == 'Patient') {
                        composition.subject = {reference:'Patient/'+resource.id}
                    } else {
                        //for now, every references resource (other than the Patient) is in a separate section...

                        var ar = item.path.split('.');
                        ar.splice(0,1);
                        var display = ar.join('.')


                        var sect = {title:display}
                        sect.entry = [{reference:resource.resourceType + "/"+ resource.id}]
                        composition.section.push(sect);
                    }

                });
                return bundle;
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

                                        if (analysis.name) {
                                            item.text = analysis.name;

                                        }
                                        item.data.analysis = analysis;
                                    }

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


                return sample;
            },

            getOptionsFromValueSet: function (element) {
                //return the expanded set of options from the ValueSet
                var deferred = $q.defer();

                if (element && element.selectedValueSet && element.selectedValueSet.vs && element.selectedValueSet.vs.url) {

                    if (expansionBlacklist.indexOf(element.selectedValueSet.vs.url) > -1) {
                        deferred.resolve([{display:'Not expanded - list too long'}]);
                        return deferred.promise;
                    }

                    GetDataFromServer.getValueSet(element.selectedValueSet.vs.url).then(
                        function (vs) {


                            //the extension that indicates the vs (authored by CF) has direct concepts that are not snomed so can't be expanded
                            var extensionUrl = appConfigSvc.config().standardExtensionUrl.vsDirectConcept;
                            var ext = Utilities.getSingleExtensionValue(vs, extensionUrl);
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

                                //return only 100
                                GetDataFromServer.getExpandedValueSet(id,100).then(
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
            getAllPathsForType: function (typeName,explode) {
                //return all the possible paths for a base type...
                //if explode true then add 'child nodes' for some complex elements


                var deferred = $q.defer();
                var url = "http://hl7.org/fhir/StructureDefinition/" + typeName;

                GetDataFromServer.findConformanceResourceByUri(url).then(
                    function (SD) {
                        if (SD && SD.snapshot && SD.snapshot.element) {
                            var lst = [], hash={}, dtDef = {};
                            SD.snapshot.element.forEach(function (ed) {
                                var path = ed.path;

                                //expand the [x] element. Todo - this might muck up the profile generation... ?could just look for multiple types
                                if (path.indexOf('[x]')> -1 && ed.type) {
                                    var pathRoot = path.substr(0,path.length-3);
                                    ed.type.forEach(function(typ){
                                        if (typ.code) {
                                            var cd = typ.code[0].toUpperCase()+typ.code.substr([1]);
                                            var newPath = pathRoot + cd;
                                            lst.push(newPath)
                                            hash[newPath] = ed;
                                            //dtDef[newPath] =
                                        }
                                    })

                                } else {
                                    lst.push(path)
                                    hash[path] = ed;
                                    if (ed.type && explode) {
                                        //see if this is a FHIR logical model (like dosage). If so, add the child nodes
                                        //may want to do this for codeableconcept and others as well...
                                        var typ = ed.type[0].code;
                                        if (fhirLM[typ]) {
                                            fhirLM[typ].forEach(function(child){
                                                lst.push(path + "." + child.name)
                                                hash[path] = ed;
                                            })
                                        }
                                    }
                                }

                            });
                            deferred.resolve({list:lst,hash:hash,dtDef:fhirLM});
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
                var fhirVersion = appConfigSvc.getCurrentConformanceServer().version;
                //create a model from the base type, only bringing across stuff we want.
                //todo - very similar to the logic in createTreeArrayFromSD() - ?call out to separate function...
                var deferred = $q.defer();
                var elementsToIgnore = ['id', 'meta', 'implicitRules', 'language', 'contained', 'extension', 'modifierExtension'];
                var url = "http://hl7.org/fhir/StructureDefinition/" + typeName;

                var serverUrl;  //set this for STU-2 - will default to the current one if not set...



                GetDataFromServer.findConformanceResourceByUri(url, serverUrl).then(
                    function (SD) {
                        try {
                            makeTreeData(SD, treeData);



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

                                //if this is stu2, then the 'profile' array becomes a single 'targetType' on each type
                                if (ed.type) {
                                    if (fhirVersion == 2) {
                                        //need to walk through each type in the type array and set the 'targetProfile' property...
                                        item.data.type = [];

                                        ed.type.forEach(function (typ) {
                                            if (typ.profile) {
                                                //if there's a profile, then this is a refrence.. todo - what about quantity???
                                                typ.targetProfile = typ.profile[0];
                                                delete typ.profile;
                                                item.data.type.push(typ)
                                                //item.data.type.targetProfile = typ.profile[0]
                                            } else {
                                                //Other data types
                                                item.data.type.push(typ)
                                            }
                                        })
                                    } else {
                                        item.data.type = ed.type;
                                    }
                                }
/*

                                if (fhirVersion == 2 && ed.type) {
                                    var item.data.type = []
                                    //the profile is multiple
                                    ed.type.forEach(function (typ) {
                                        if (typ.profile) {
                                            item.data.type.targetProfile = typ.profile[0]
                                        }
                                    })

                                } else {
                                    item.data.type.targetProfile = typ.targetProfile;
                                }
*/
                                //item.data.type = ed.type;
                                item.data.min = ed.min;
                                item.data.max = ed.max;

                                item.data.comments = ed.comments;

                                //set the mapping
                                //item.data.mappingPath = path; //[{identity: 'fhir', map: path}]

                                item.data.mappingFromED = [{identity: 'fhir', map: path}];
                                //decorate the type elements...

                                decorateTreeView(item,ed);     //common decorator functions like isComplex

                                /*
                                if (item.data.type) {
                                    item.data.type.forEach(function(typ){
                                        if (typ.code) {
                                            var first = typ.code.substr(0,1);
                                            if (first == first.toUpperCase()) {
                                                typ.isComplexDT = true;
                                            }
                                        }
                                    })
                                }
                                */


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
                var fhirVersion = appConfigSvc.getCurrentConformanceServer().version;
                var mappingCommentUrl = appConfigSvc.config().standardExtensionUrl.edMappingComment;
                var mapToModelExtensionUrl = appConfigSvc.config().standardExtensionUrl.mapToModel;
                var baseTypeForModel = appConfigSvc.config().standardExtensionUrl.baseTypeForModel;
                var simpleExtensionUrl = appConfigSvc.config().standardExtensionUrl.simpleExtensionUrl;
                var discriminatorUrl = appConfigSvc.config().standardExtensionUrl.discriminatorUrl;
                var conceptMapUrl = appConfigSvc.config().standardExtensionUrl.conceptMapUrl;
                var cntExtension = 0;
                var arTree = [];
                if (sd && sd.snapshot && sd.snapshot.element) {

                    sd.snapshot.element.forEach(function (ed,inx) {
                        var include = true;

                        var path = ed.path;     //this is always unique in a logical model...
                        var arPath = path.split('.');
                        var item = {data:{}}
                        item.id = path

                        var text = arPath[arPath.length - 1];   //the text will be the last entry in the path...

                        //if the text has an underscore, then remove it...
                        var ar = text.split('_');
                        item.text = ar[0];
                        item.data.pathSegment = text;    //this is the actual path segment (possibly with _n). Needed for the setpath() finction in the controller

                        //give a unique name if an extension...
                        if (item.text === 'extension') {
                            item.text = 'extension_' + cntExtension;
                            item.id = path += "_" + cntExtension;

                            cntExtension++;

                            //see if this extension points to an extension definition
                            if (ed.type && (ed.type[0].profile || ed.type[0].targetProfile) ) {

                            } else {
                                include = false;
                            }

                        }


                        //show if an element is multiple...
                        if (ed.max == '*') {
                            //    item.text += " *"
                        }

                       // item.data = {};
                        if (arPath.length == 1) {
                            //this is the root node
                            item.parent = '#';
                            item.data.isRoot = true;
                            //now set the header data...
                            item.data.header = {};
                            item.data.header.SDID = sd.id;
                            item.data.header.name = sd.name;
                            item.data.header.SDUrl = sd.url;

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


                        }
                        item.state = {opened: true};     //default to fully expanded


                        item.data.fixedString = ed.fixedString;      //todo, this should probably be a type compatible with this element
                        item.data.path = path;
                        item.data.name = item.text;
                        item.data.short = ed.short;
                        item.data.description = ed.definition;
                        item.data.ed = ed;  //added for profileDiff
                        //item.data.type = ed.type;


                        //decorate the type elements...
                        decorateTreeView(item,ed);

                        var extSimpleExt = Utilities.getSingleExtensionValue(ed, simpleExtensionUrl);
                        if (extSimpleExt) {
                            item.data.fhirMappingExtensionUrl = extSimpleExt.valueString;
                        }

                        var extDiscriminator = Utilities.getSingleExtensionValue(ed, discriminatorUrl);
                        if (extDiscriminator) {
                            item.data.discriminator = extDiscriminator.valueString;
                        }

                        var extConceptMap = Utilities.getSingleExtensionValue(ed, conceptMapUrl);
                        if (extConceptMap) {
                            item.data.conceptMap = extConceptMap.valueString;
                        }

                        //format of type prpfile changed between 2 & 3
                        if (ed.type) {
                            var tvType = []

                            ed.type.forEach(function(typ){

                                if (typ.code) {
                                    var newTyp = {code:typ.code}
                                    if (fhirVersion == 2) {
                                        //the profile is multiple
                                        if (typ.profile) {
                                            newTyp.targetProfile = typ.profile[0]
                                        }
                                    } else {
                                        newTyp.targetProfile = typ.targetProfile;
                                    }
                                    // item.type = newTyp;

                                    //is this a coded type
                                    if (['CodeableConcept', 'Coding', 'code'].indexOf(typ.code) > -1) {
                                        item.data.isCoded = true;
                                    }






                                    //is this a reference
                                    if (typ.code == 'Reference') {
                                        item.data.isReference = true;   //used to populate the 'is reference' table...

                                        //stu2/3
                                        if (typ.profile) {
                                            item.data.referenceUrl = typ.profile[0];
                                        } else {
                                            item.data.referenceUrl = typ.targetProfile;
                                        }



                                    }

                                    //is this complex
                                    var first = newTyp.code.substr(0,1);
                                    if (first == first.toUpperCase()) {
                                        newTyp.isComplexDT = true;
                                    }

                                    tvType.push(newTyp)
                                } else {
                                    alert('The Path '+ ed.path + ' has a type with no code')
                                    console.log(ed)
                                }




                            })



                            item.data.type = tvType;

                        }

                        item.data.min = ed.min;
                        item.data.max = ed.max;

                        if (ed.mapping) {           //the mapping path in the target resource...
                            item.data.mappingFromED = []; //ed.mapping;       //save all the mappings in an array...

                            //this is a horrible hack to cover the fact that hapi doesn't yet support the final R3...



                            //item.data.mappingFromED.forEach(function(map){
                            ed.mapping.forEach(function(map){
                                var internalMap = {identity:map.identity}
                                var ar = map.map.split('|');        //the 'map' will always include the comment separated by '|'
                                internalMap.map = ar[0];            //the first entry is the actual map

                                //is this an extensiom
                                if (internalMap.map.indexOf('extension') > -1) {
                                    item.data.isExtension = true;
                                }


                                if (map.comment) {
                                    internalMap.comment = map.comment
                                } else {
                                    internalMap.comment = ar[1];
                                }

                                item.data.mappingFromED.push(internalMap);

                            });





                        }



                        if (fhirVersion == 2) {
                            item.data.comments = ed.comments;
                        } else {
                            item.data.comments = ed.comment;
                        }


                        //note that we don't retrieve the complete valueset...
                        if (ed.binding) {
                            item.data.selectedValueSet = {strength: ed.binding.strength};




                            //  12/2/2018  change to using vsReference, but need to preserve the old stuff...
                            if (ed.binding.valueSetUri) {
                                item.data.selectedValueSet.vs = {url: ed.binding.valueSetUri};
                            }

                            if (ed.binding.valueSetReference && ed.binding.valueSetReference.reference) {
                                item.data.selectedValueSet.vs = {url: ed.binding.valueSetReference.reference};
                            }

                            if (item.data.selectedValueSet.vs) {
                                item.data.selectedValueSet.vs.name = ed.binding.description;
                            }


                        }

                        if (include) {
                            arTree.push(item);
                        }

                    });


                }







                return arTree;
            },
            makeSD: function (scope, treeData) {
                var fhirVersion = appConfigSvc.getCurrentConformanceServer().version;


                //create a StructureDefinition from the treeData //todo - don't pass in scope...
                var header = treeData[0].data.header || {};     //the first node has the header informatiion

                var mappingCommentUrl = appConfigSvc.config().standardExtensionUrl.edMappingComment;
                var mapToModelExtensionUrl = appConfigSvc.config().standardExtensionUrl.mapToModel;
                var baseTypeForModelUrl = appConfigSvc.config().standardExtensionUrl.baseTypeForModel;
                var simpleExtensionUrl = appConfigSvc.config().standardExtensionUrl.simpleExtensionUrl;
                var discriminatorUrl = appConfigSvc.config().standardExtensionUrl.discriminatorUrl;
                var conceptMapUrl = appConfigSvc.config().standardExtensionUrl.conceptMapUrl;

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

                //these are some of the fhir version changes...
                if (fhirVersion ==2) {
                    sd.display = header.title;
                    sd.requirements = header.purpose;
                } else {
                    sd.title = header.title;
                    sd.purpose = header.purpose;
                }


                sd.publisher = header.publisher;
                sd.status = 'draft';
                sd.date = moment().format();

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

                    var ed = {}
                    //this element is mapped to a simple extension. Do this first so the extensions are at the top...
                    if (data.fhirMappingExtensionUrl) {
                        Utilities.addExtensionOnce(ed, simpleExtensionUrl, {valueString: data.fhirMappingExtensionUrl})
                    }


                    //the 'name'(stu2) or 'label'(r3) is used for the display in the logical model generated from the profile
                    if (fhirVersion == 2) {
                        ed.name = item.text;
                        ed.comments = data.comments;
                    } else {
                        ed.label = item.text;
                        ed.comment = data.comments;
                    }


                    ed.id = data.path;
                    ed.path = data.path;
                    ed.short = data.short;
                    ed.definition = data.description || 'No description';
                    ed.min = data.min;
                    ed.max = data.max;




                    //a conceptMap associated with this element
                    if (data.conceptMap) {
                        Utilities.addExtensionOnce(ed, conceptMapUrl, {valueString: data.conceptMap})
                    }

                    //so all the mapping data for ED is in the 'mappingFromED' array...  {identity:, map:, comment:}
                    if (data.mappingFromED ) {
                        ed.mapping =  [];

                        //this will always have data as {identity:, map:, comment: }
                        data.mappingFromED.forEach(function(map){
                            if (map.identity && map.map) {

                                var savedMap = {identity:map.identity}
                                if (map.comment) {
                                    savedMap.map = map.map + "|" + map.comment
                                } else {
                                    savedMap.map = map.map + "|"
                                }
                                ed.mapping.push(savedMap);
                                /*
                                map.comment = map.comment || "";
                                //a horrible hack as hapi doesn't yet support comments. Always add the comments to the map.

                                var ar = map.map.split('|')
                                map.map = ar[0]+ "|"+map.comment;
                                ed.mapping.push({identity:map.identity, map: map.map, comment: map.comment});
                                */
                            }

                        })
                    }



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


                    //the format and name of the 'profile' property changed between 2 & 3...
                    if (data.type) {
                        ed.type = [];
                        data.type.forEach(function (typ) {
                            var newTyp;
                            // {code:, targetProfile} - actually, there will only ever be one type at the moment...

                            if (typ.code == 'Reference') {
                                newTyp = {code:'Reference'}
                                //in the treeview, the profile is always named targetProfile and is single
                                if (fhirVersion == 2) {
                                    newTyp.profile = [typ.targetProfile]
                                } else {
                                    newTyp.targetProfile = typ.targetProfile;
                                }
                            } else {
                                newTyp = typ;
                            }
                            ed.type.push(newTyp);
                        })
                    }

                    ed.base = {
                        path: ed.path, min: 0, max: '1'
                    };

                    if (data.selectedValueSet) {
                        ed.binding = {strength: data.selectedValueSet.strength};

                        //  12/2/2018 - change to a reference...
                        //ed.binding.valueSetUri = data.selectedValueSet.vs.url;

                        ed.binding.valueSetReference = {reference: data.selectedValueSet.vs.url};
                        ed.binding.description = data.selectedValueSet.vs.name;




                    }

                    ed.fixedString = data.fixedString;  //todo needs to be a compatible type


                    //used for slicing...
                    if (data.discriminator) {
                        Utilities.addExtensionOnce(ed, discriminatorUrl, {valueString: data.discriminator})
                    }

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



                return ar


            },
            resolveProfileDEP: function (url) {
                //return a SD as a logical model from a profile that resolves extensions....
                var deferred = $q.defer();
                GetDataFromServer.findConformanceResourceByUri(url).then(
                    function (SD) {


                        if (SD && SD.snapshot && SD.snapshot.element) {
                            SD.snapshot.element.forEach(function (ed) {

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

                    GetDataFromServer.findConformanceResourceByUri(baseProfileUrl).then(
                        function(SD) {
                            var baseTypeHash = getSDHash(SD)

                            var analysis = {removed:[],added:[],changed:[]}
                            //first, move through all the elements in the lm. If there is not a corresponding path in the base profile (allowing for name changes) then it was added...
                            lm.snapshot.element.forEach(function(ed){
                                var adjustedPath = ed.path.setFirstSegment(baseType)    //note the setFirstSegment function was added to the string prototype at the top of this service

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
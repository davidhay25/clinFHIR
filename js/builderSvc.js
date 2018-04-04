angular.module("sampleApp")
    .service('builderSvc', function($http,$q,appConfigSvc,GetDataFromServer,Utilities,$filter,supportSvc,
                                    resourceCreatorSvc,SaveDataToServer) {

        var gAllReferences = []
        var gSD = {};   //a has of all SD's reas this session by type
        var showLog = false;
        var gAllResourcesThisSet = {};      //hash of all resources in the current set
        var manualMarkerString = "<a name='mm'/>";     //a marker string to separate manually entered text (above the marker) from generated text below
        var baseHl7ConformanceUrl = "http://hl7.org/fhir/";
        var gCurrentResource;       //the current resource being examined

        //return the profile url of the current resource. This is needed for getEDInfoForPath() and assumes we're tracking the current resource...
        var getProfileUrlCurrentResource = function() {

            var profileUrl="";
            if (gCurrentResource){
                profileUrl = baseHl7ConformanceUrl+"StructureDefinition/"+gCurrentResource.resourceType;

                if (gCurrentResource.meta && gCurrentResource.meta.profile) {
                    profileUrl= gCurrentResource.meta.profile[0]
                } else {

                }
            }


            return profileUrl;

        };

        //get the url for the SD of a resource. Default to the 'core' spec, but check the meta element...
        var getProfileUrlFromResource = function(resource) {
            var profileUrl = baseHl7ConformanceUrl+"StructureDefinition/"+resource.resourceType;
            if (resource && resource.meta && resource.meta.profile) {
                profileUrl= resource.meta.profile[0]
            } else {

            }
            return profileUrl;

        };

        //colours from node-red
        //#3FADB5 #87A980 #A6BBCF #AAAA66 #C0C0C0 #C0DEED #C7E9C0 #D7D7A0 #D8BFD8 #DAC4B4 #DEB887 #DEBD5C #E2D96E #E6E0F8 #E7E7AE #E9967A #F3B567 #FDD0A2 #FDF0C2 #FFAAAA #FFCC66 #FFF0F0 #FFFFFF


        var objColours ={};
        objColours.Patient = '#93FF1A';
        objColours.Composition = '#E89D0C';
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

        var hashProfile = {};   //hash of profile url & core type

        return {

            getBaseTypeForProfile : function(url) {
                //retrieve the base type for any profile - core or derived...
                console.log(url)
                var deferred = $q.defer();

                //stu2/3 thing
                if (angular.isArray(url)) {
                    url = url[0]
                }

                var fhirVersion = appConfigSvc.getCurrentConformanceServer().version;

                //is this a core profile?
                var coreRoot='http://hl7.org/fhir/StructureDefinition/';
                if (url.indexOf(coreRoot) > -1) {
                    deferred.resolve($filter('getLogicalID')(url))
                   //return $filter('getLogicalID')(url);
                } else if (hashProfile[url]) {
                    //have we already retrieved this url?
                    deferred.resolve(hashProfile[url])
                    //return hashProfile[url];
                } else {
                    //no, this is a derived profile. Retrieve the definition and determine the core resource..
                    GetDataFromServer.findConformanceResourceByUri(url).then(
                        function(profile){

                            var baseType;
                            if (fhirVersion == 2) {
                                baseType = profile.constrainedType || $filter('getLogicalID')(profile.base);
                            } else {
                                //baseType = profile.baseDefinition;
                                baseType = $filter('getLogicalID')(profile.baseDefinition);
                            }
                            if (baseType) {
                                hashProfile[url] = baseType;
                                deferred.resolve(baseType)
                            }



                            return baseType;
                        },
                        function(){
                            alert("The profile url "+url + " was not found on the conformance server: "+ appConfigSvc.getCurrentConformanceServer().name)
                        }
                    )

                }
                return deferred.promise;

            },
            documentQualityReport : function(nodes,edges) {
                //how good is the document
                var report = {cntNodes:nodes.length,cntEdges:edges.length}
                //find nodes with no links
                var hash = {};
                nodes.forEach(function (node) {
                    hash[node.id] = {from:0,to:0,node:node};      //number of
                })

                edges.forEach(function (edge) {
                    var from = edge.from;
                    var nodeFrom = hash[from]
                    if (nodeFrom) {
                        nodeFrom.from++
                    } else {
                        console.log(from);  //can this happen???
                    }

                    var nodeTo = hash[edge.to]
                    if (nodeTo) {
                        nodeTo.to++
                    } else {
                        //this will occur when the reference is to the patient, as that node is not in the graph...
                        //todo - do I need to look into this further??  Ignore for now...
                        console.log(edge.to);  //can this happen???
                    }

                });

                report.hash = hash;
                report.orphans = []
                //now find the nodes with to references to them...
                angular.forEach(hash,function (v,k) {
                   // console.log(v,k)
                    if (v.to == 0) {
                        if (v.node.resource.resourceType !== 'Composition') {
                            report.orphans.push(v.node.resource)
                        }
                    }

                });

                console.log(report)
                return report

            },
            makeDisplayBundle : function(bundle) {
                //remove extensions (track validation & stuff) todo = will likely need to be more granular in teh future...
                if (bundle) {
                    var newBundle = {resourceType:'Bundle',id:bundle.id,type: bundle.type,entry:[]}
                    if (bundle && bundle.entry) {
                        bundle.entry.forEach(function(entry){
                            var resource = entry.resource;
                            if (resource.extension && resource.extension.length == 0) {
                                delete resource.extension;
                            }

                            if (resource.resourceType == 'Composition') {
                                //composition goes first
                                newBundle.entry.splice(0,0,{resource:resource})
                                newBundle.type = 'document'
                            } else if (resource.resourceType == 'MessageHeader') {
                                //composition goes first
                                newBundle.entry.splice(0,0,{resource:resource})
                                newBundle.type = 'message'
                            } else {
                                newBundle.entry.push({resource:resource})
                            }

                            //response.entry.push({resource:resource})
                        })

                    }
                    return newBundle;
                } else {
                    return {}
                }

            },
            makeDocumentTree : function(bundle,hideError) {
                var tree = []
                var hashByType = {};
                var hashByRef = {};
                var idRoot = 0;

                bundle.entry.forEach(function (entry) {
                    var resource = entry.resource;
                    hashByType[resource.resourceType] = hashByType[resource.resourceType] || []
                    hashByType[resource.resourceType].push(resource);

                    if (entry.fullUrl && entry.fullUrl.indexOf('urn:uuid') > -1 ) {
                        //this is a urn... (the ccda transform uses)
                        hashByRef[entry.fullUrl] = resource;
                    } else {
                        //assume a relative reference (that cf uses)
                        hashByRef[resource.resourceType + "/" + resource.id] = resource;
                    }
                });

                var comp = getResource(hashByType,'Composition',false);
                if (! comp) {
                    if (! hideError) {
                        alert('No Composition');    //shouldn't ever get this
                    }

                    return;
                }


                var rootId = getId();
                var rootItem = {id: rootId, parent: '#', text: 'Composition', state: {opened: true, selected: false}}
                rootItem['a_attr'] = {class : 'resourceInDocTree'};
                rootItem.data = {resource:comp}
                tree.push(rootItem);

                //add all the resources referenced by the composition.
                addResourceToRoot(comp, tree,'subject',rootId,hashByRef);
                addResourceToRoot(comp, tree,'encounter',rootId,hashByRef);
                addResourceToRoot(comp, tree,'custodian',rootId,hashByRef);


                //add all the sections...

                //first a section element...
                var sectParentId = getId();
                var item = {id: sectParentId, parent: rootId, text: 'Sections', state: {opened: true, selected: false}}

                tree.push(item);

                comp.section.forEach(function (sect) {
                    //add the title
                    var id = getId();
                    var item = {id: id, parent: sectParentId, text: sect.title, state: {opened: true, selected: false}}
                    if (sect.code && sect.code.coding) {
                        item.text += " ("+sect.code.coding[0].code + ")"
                    }
                    item.data = {text:sect.text};
                    item.data.section = sect;
                    tree.push(item);
                    //now, add the resources that are directly refereced by the section (if any)...
                    if (sect.entry) {
                        sect.entry.forEach(function (entry) {
                            var sectId = getId();
                            var sectItem = {id: sectId, parent: id, text: entry.reference, state: {opened: true, selected: false}}
                            sectItem['a_attr'] = {class : 'resourceInDocTree'};
                            sectItem.data = {resource:hashByRef[entry.reference],path:entry.display}
                           // sectItem.data.entry = entry;

                            var isList = false;
                            if (entry.reference.indexOf('List') > -1) {
                                isList = true;
                            }
                            var res = hashByRef[entry.reference];
                            if (res) {
                                sectItem.text = res.resourceType;
                                if (res.resourceType == 'List') {
                                    isList = true;
                                }
                            }

                            tree.push(sectItem);

                            //if it's a list, then display the resources they reference...


                            if (isList){
                            //if (entry.reference.indexOf('List') > -1) {
                                var list = hashByRef[entry.reference];
                                if (list && list.entry) {
                                    list.entry.forEach(function (entry) {
                                        var entryId = getId();
                                        var entryItem = {id: entryId, parent: sectId, text: entry.item.reference, state: {opened: true, selected: false}}
                                        entryItem.data = {};
                                        entryItem.data.resource = hashByRef[entry.item.reference]
                                        entryItem.data.entry = entry;
                                       // entryItem.data.sectionText =


                                        //entryItem.data = {attributes : {class : 'rounded-box'}};
                                        entryItem['a_attr'] = {class : 'resourceInDocTree'};
                                        // entryItem['li_attr'] = {style : 'margin-bottom:8px'};
                                        tree.push(entryItem);


                                    })

                                }
                            }


                        })
                    }


                })


                return tree;


                function addResourceToRoot(comp, tree,segment,parentId,hashByRef) {
                    var t = comp[segment]      //the element on the composition
                    if (t && t.reference) {
                        var resource = hashByRef[t.reference];
                        if (resource) {
                            var id = getId();
                            var item = {id: id, parent: parentId, text: t.reference, state: {opened: true, selected: false}}

                            //entryItem.data = {attributes : {class : 'rounded-box'}};
                            item['a_attr'] = {class : 'resourceInDocTree'};
                            item.data = {resource:hashByRef[t.reference],path:segment}
                            // entryItem['li_attr'] = {style : 'margin-bottom:8px'};

                            item.text = resource.resourceType;



                            tree.push(item);
                        }
                    }
                }

                function getResource(hash,type,multiple) {
                    var ar = hash[type];
                    if (multiple) {return ar;}
                    if (ar) {
                        return ar[0]
                    } else {
                        return null;
                    }

                }

                //generate a new ID for an element in the tree...
                function getId() {
                    idRoot++;
                    return idRoot;

                }

            },

            makeElementsPopulatedReport : function(bundle){
                var hide=['resourceType','id','text','[1]','[2]','[3]'];
                //var segmentsToRemove=['<strong>','</strong>','.[0]']


                var report = []
                bundle.entry.forEach(function(entry){
                    var resource = entry.resource;
                    var treeData = resourceCreatorSvc.buildResourceTree(resource);
                    var item = {elements:[]}
                    item.resourceType = treeData[0].text;       //first element is always the resource type
                    treeData.forEach(function (line) {
                        if (line.data && line.data.path) {
                            var ar = line.data.path.split('.');
                            var include = true;
                            ar.forEach(function (segment) {
                                if (hide.indexOf(segment) > -1) {
                                    include = false;
                                }
                            });/*
                            //remove entries I don't want in the display
                            for (var i=0; i<ar.length;i++) {
                                if (segmentsToRemove.indexOf(ar[i])>-1) {
                                    ar.splice(i);
                                    break;
                                }
                            }*/


                            var text = line.text
                            text = text.replace('<strong>','')
                            text = text.replace('</strong>','')

                           // var path = ed.path
                            if (include) {
                                var t = {path:ar.join('.'),text:text}
                                item.elements.push(t)
                            }

                        }



                    })
                    report.push(item)




                    //console.log(treeData);
                })


            return report;

           },
            generateDocumentDEP : function(bundle) {
                //todo move composition to top
                var newBundle = {resourceType:'Bundle', type:'document',entry:[]}
                bundle.entry.forEach(function (entry) {
                    var resource = entry.resource;
                    if (resource.resourceType == 'Composition') {
                        //composition goes first
                        newBundle.entry.splice(0,0,{resource:resource})
                    } else {
                        newBundle.entry.push({resource:resource})
                    }
                });

                return {doc:newBundle};

            },
            createProvenance : function(responseBundle,scenario,note) {



                //if there's no provenance resource, then add one that points to all the resources in the bundle
                //>>>> just add one...
                //var provExt = appConfigSvc.standardExtensionUrl().scenarioProvenance;
                var provExt = appConfigSvc.config().standardExtensionUrl.scenarioProvenance;
                var provNoteUrl = appConfigSvc.config().standardExtensionUrl.scenarioNote;
                var provTargetUrl = appConfigSvc.config().standardExtensionUrl.provenanceTargetUrl;


                console.log(responseBundle)
                //var currentProvenanceInx;
                var prov = {resourceType:'Provenance', target:[], agent:[]}
                prov.recorded = moment().toISOString();
                prov.agent.push({whoUri:'http://clinfhir.com'});

                //prov.id = 'cf-'+new Date().getTime();

                //mark that this provenance is being used to track the contents of a scenario
                Utilities.addExtensionOnce(prov,provExt,{valueString:scenario});

                if (note) {
                    //mark that this provenance is being used to track the contents of a scenario
                    Utilities.addExtensionOnce(prov,provNoteUrl,{valueString:note});
                }

                //build a provenance resource pointing to all the resources in the bundle...
                responseBundle.entry.forEach(function (ent,inx) {
                    var res = ent.response;  //{eTag, lastModified, location, status}  http://test.fhir.org/r3/Condition/cf-1494878404520/_history/9
                    var ar = res.location.split('/');
                    var version = ar[ar.length-1];
                    var id = ar[ar.length-3];
                    var type = ar[ar.length-4];
                    var ref = type+ '/'+id + '/_history/'+version;

                    //Patient is not version specific - all the others are.
                    if (type == 'Patient') {
                        ref = type+ '/'+id;
                    }

                    var item = {reference: ref};
                   // Utilities.addExtensionOnce(item,provTargetUrl,{valueString:res.location});
                    prov.target.push(item)

                });

                console.log(prov);

                return prov;



            },

            updateMostRecentVersion : function(container,bundle) {
                //when editing - make sure the most current history is updated as well...
                if (!container.history) {       //when migrating from existing scenarios...
                    container.history = [];
                    container.index = 0;
                }

                container.history[container.history.length-1] = {bundle:angular.copy(bundle)};
                //container.history[container.index] = {bundle:angular.copy(bundle)};    //todo ?should this be a copy??

            },
            setMostRecentVersionActive : function(container) {
                //set the most recent bundle in the container to be the active one (.bundle)
                if (container && container.history) {
                    if (container.history.length > 0) {
                        container.index = container.history.length -1;
                        container.bundle = container.history[container.index].bundle;
                    }

                }
            },
            isVersionMostRecent : function(container) {
                //return true if the bundle currently being viewed is the most recent one
                if (container) {
                    if (! container.history) {
                        return true;
                    } else {
                        if (container.index == container.history.length-1 ) {
                            return true
                        } else {
                            return false;
                        }
                    }
                }

            },
            getLinkingUrlFromId : function(resource) {
                //return the url used for referencing. If a Uuid then just return it - otherwise make a relatibe

                if (resource && resource.id) {
                    if (resource.id.lastIndexOf('urn:uuid:', 0) === 0) {
                        return resource.id;
                    } else {
                        return resource.resourceType + "/" + resource.id;
                    }
                } else {
                    //in theory, shouldn't happen...
                    alert("There is a resource with no id! " + angular.toJson(resource))
                }


            },
            importResource : function(resource,scope,idPrefix){
                //import a resource or resource bundle //todo - add document check later...
                var that = this;
                var importedResource;

                if (resource.resourceType == 'Bundle') {

                    resource.entry.forEach(function(ent){
                        var res = ent.resource;
                        if (res) {
                            if (! res.id) {
                                if (ent.fullUrl) {
                                    res.id = ent.fullUrl;
                                } else {
                                    res.id = idPrefix+new Date().getTime();
                                }
                            }

                            importOneResource(res,scope);
                            if (! importedResource) {
                                //make the first resource in the bundle the selected one...
                                importedResource = res;
                            }

                        }



                    })


                } else {
                    if (!resource.id ) {
                        resource.id = idPrefix+new Date().getTime();        //always assign a new id..
                    }

                    //todo ??? why did I disabel this ???
                    //resource.id = idPrefix+new Date().getTime();        //always assign a new id..
                    importOneResource(resource,scope);
                    importedResource = resource;
                }

                sortBundle(scope.selectedContainer.bundle);

                return importedResource;     //not strictly necessary, but makes it clear...

                function importOneResource(resource,scope) {
                    that.addResourceToAllResources(resource);
                    scope.selectedContainer.bundle.entry.push({resource:resource});
                }

                function sortBundle(bundle){
                    bundle.entry.sort(function(a,b){
                        if (a.resource.resourceType > b.resource.resourceType) {
                            return 1
                        } else {
                            return -1
                        }
                    })
                }

            },
            getLibraryCategories : function(){
                //get the codesystem resource that represents the categories. Needs to be more robust...
                //todo - need to implement a 'getByUrl for CodeSystems' This will do for now...
                var deferred = $q.defer();

                var url = appConfigSvc.getCurrentTerminologyServer().url+'CodeSystem/cfLibraryCategories';
                $http.get(url).then(
                    function(data){
                        deferred.resolve(data.data)
                    },function(err) {
                        deferred.reject();
                    }

                );
                return deferred.promise;

            },
            getExistingDataFromServer : function(patient) {
                var deferred = $q.defer();
                supportSvc.getAllData(patient.id).then(
                    function(data) {
                        var newBundle = {};
                        angular.forEach(data, function (bundle,type) {
                            newBundle[type] = {resourceType:'Bundle',entry:[],total:0}
                            if (bundle.entry) {
                                bundle.entry.forEach(function(entry){
                                    var resource = entry.resource;
                                    var id = resource.resourceType + "/"+ resource.id;

                                    newBundle[type].entry.push(entry)
                                    newBundle[type].total++;

                                })
                            }


                        });


                        deferred.resolve(newBundle)
                    },
                    function(err) {
                        console.log(err);
                        deferred.reject(err);
                    }
                );
                return deferred.promise;
            },

            sendToFHIRServer : function(container,note) {
                //create a new bundle to submit as a transaction. excludes logical models
                var that=this;
                var bundle = this.makeDisplayBundle(container.bundle);      //does things like make it a correct document..
                var deferred = $q.defer();
                var transBundle = {resourceType:'Bundle',type:'transaction',entry:[]}
                transBundle.id = bundle.id;     //needed when saving against /Bundle
                bundle.entry.forEach(function(entry) {

                    if (entry.isLogical) {
                        console.log('Ignoring Logical Model: ' + entry.resource.resourceType)
                    } else {

                        if (entry.resource.resourceType == 'DocumentReference') {
                            //need to set the attackent uri to the location of the bundle...
                            var bundleUrl = appConfigSvc.getCurrentDataServer().url + 'Bundle/'+bundle.id;
                            var resource = entry.resource;
                            if (resource.content) {
                                resource.content[0].attachment.url=bundleUrl;
                            }

                        }

                        var transEntry = {resource:entry.resource};
                        transEntry.request = {method:'PUT',url:entry.resource.resourceType+'/'+entry.resource.id}
                        transBundle.entry.push(transEntry)
                    }
                });

                var url = appConfigSvc.getCurrentDataServer().url;

                //post the transaction bundle to the server root so the individual resources are saved...
                $http.post(url,transBundle).then(
                    function(data) {

                        var responseBundle = data.data;


                        console.log(responseBundle);


                        //save the bundle directly against the /Bundle endpoint. Use the original bundle...

                        SaveDataToServer.saveResource(bundle).then(
                            function(data){
                                //saveProvenance will resolve the promise...
                                saveProvenance(responseBundle,container.name,note,deferred)


                            },function (err) {
                                //??? add error status to provenance
                                alert('error saving bundle ' + angular.toJson(err))
                                saveProvenance(responseBundle,container.name,note,deferred);
                            }
                        );


                        //the response contains the location where all resources were stored. Create a provenance resource...

                    },
                    function(err) {
                        alert('Error saving scenario resources\n'+angular.toJson(err));
                    }
                );

                return deferred.promise

                //save the provenence resource and resolve the promise. Note that we resolve anyway
                //?? todo what to do if the provenance save fails??
                function saveProvenance(data,name,note,deferred) {
                    var prov = that.createProvenance(data,name,note);
                    SaveDataToServer.saveResource(prov).then(
                        function(data) {
                            deferred.resolve()
                        },
                        function(err) {
                            alert('error saving provenance ' + angular.toJson(err))

                            deferred.resolve();
                        }
                    )
                }


            },
            validateAll : function(bundle) {
                var deferred = $q.defer();
                var queries = [];

                bundle.entry.forEach(function(entry){

                    if (entry.isLogical) {
                       // console.log('Ignoring Logical Model: '+resource.resourceType)
                    } else {
                        queries.push(
                            Utilities.validate(entry.resource).then(
                                function(data){
                                    var oo = data.data;

                                    entry.valid='yes'
                                    entry.response = {outcome:oo};


                                },
                                function(data) {
                                    var oo = data.data;
                                    entry.response = {outcome:oo};

                                    entry.valid='no'

                                }
                            )
                        )
                    }



                })

                $q.all(queries).then(
                    function () {
                        deferred.resolve();
                    },
                    function (err) {



                        deferred.reject(err)


                    }
                )

                return deferred.promise;

            },
            getPatientResource : function(){
                var patient;
                angular.forEach(gAllResourcesThisSet,function(res){
                    if (res.resourceType == 'Patient') {
                        patient = res;
                    }

                });
                return patient
            },
            makeLogicalModelFromSD : function(profile){
              //given a StructureDefinition which is a profile (ie potentially has extensions) generate a logical model by de-referencing the extensions
              //currently only working for simple extensions
                var deferred = $q.defer();
                if (profile && profile.snapshot && profile.snapshot.element) {

                    var logicalModel = angular.copy(profile);       //this will be the logical model
                    var queries = [];       //the queries to retrieve the extension definition
                    logicalModel.snapshot.element.length = 0; //remove the current element definitions

                    profile.snapshot.element.forEach(function (ed) {
                        logicalModel.snapshot.element.push(ed)
                        var path = ed.path;
                        var ar = path.split('.');
                        if (ar.indexOf('extension') > -1) {
                            //this is an extension

                            if (ed.type) {
                                var profileUrl = ed.type[0].profile;
                                if (profileUrl) {

                                    queries.push(GetDataFromServer.findConformanceResourceByUri(profileUrl).then(
                                        function (sdef) {
                                            var analysis = Utilities.analyseExtensionDefinition3(sdef);


                                            if (! analysis.isComplexExtension) {


                                                if (! ed.name) {
                                                    ed.name = analysis.name;
                                                }

                                                ed.type = analysis.type;
                                                ed.binding = analysis.binding;
                                                //now update the path and other key properties of the ed
                                                var text = $filter('getLogicalID')(profileUrl);

                                                //oct3-2017 why did I do this???
                                                ed.path = ed.path.replace('extension',text)


                                                //ed.builderMeta || {}
                                                ed.builderMeta = {isExtension : true};  //to colourize it, and help with the build..
                                                ed.builderMeta.extensionUrl = profileUrl;

                                                ed.comments = sdef.description;

/*
                                                //locate the entry in the ED which is 'valueX' and update the ed.
                                                if (sdef && sdef.snapshot && sdef.snapshot.element) {
                                                    sdef.snapshot.element.forEach(function (el) {
                                                        if (el.path.indexOf('.value') > -1) {
                                                            ed.type = el.type;
                                                            ed.binding = analysis.binding;
                                                            //now update the path and other key properties of the ed
                                                            var text = $filter('getLogicalID')(profileUrl);

                                                            ed.path = ed.path.replace('extension',text)
                                                            //ed.builderMeta || {}
                                                            ed.builderMeta = {isExtension : true};  //to colourize it, and help with the build..
                                                            ed.builderMeta.extensionUrl = profileUrl;

                                                            ed.comments = sdef.description;     //to be eble to show the description on the screen..

                                                        }

                                                    })

                                                }
                                                */
                                            } else {
                                                console.log(profileUrl + " is complex, not processed")
                                            }



                                            /*
                                            //locate the entry in the ED which is 'valueX' and update the ed. todo - need to accomodate complex extensions
                                            if (sdef && sdef.snapshot && sdef.snapshot.element) {
                                                sdef.snapshot.element.forEach(function (el) {
                                                    if (el.path.indexOf('.value') > -1) {
                                                        ed.type = el.type;

                                                        //now update the path and other key properties of the ed
                                                        var text = $filter('getLogicalID')(profileUrl);

                                                        ed.path = ed.path.replace('extension',text)
                                                        //ed.builderMeta || {}
                                                        ed.builderMeta = {isExtension : true};  //to colourize it, and help with the build..
                                                        ed.builderMeta.extensionUrl = profileUrl;

                                                        ed.comments = sdef.description;     //to be eble to show the description on the screen..

                                                    }

                                                })

                                            }
                                            */

                                        },
                                        function(err) {
                                            //unable to locate extension
                                            console.log(profileUrl + " not found")
                                        }
                                    ))
                                }

                            }

                        }


                    });

                    if (queries.length > 0) {
                        //yes - execute all the queries and resolve when all have been completed...
                        $q.all(queries).then(
                            function () {
                                deferred.resolve(logicalModel);
                            },
                            function (err) {

                                //return the error and the incomplete model...
                                deferred.reject({err:err,lm:logicalModel})



                            }
                        )

                    } else {
                        //no - we can return the list immediately...
                        deferred.resolve(logicalModel)

                    }



                } else {
                    deferred.reject();
                }

                return deferred.promise;

            },
            setCurrentResource : function(resource) {
                gCurrentResource = resource;
            },
            getCurrentResource : function(resource) {
                return gCurrentResource;
            },
            analyseInstanceForPath : function(resource,path){
                //analyse the path. if it has an ancestor of type backbone element that is multiple, then show the current entries in the instance
                var that = this;
                var ar = path.split('.');
                var arExistingElements = []
                var testPath;
                var currentTestPoint = resource;           //where we are checking...

                var testPath = ar[0]
                var response = {path:path};
                for (var inx=1; inx < ar.length-1; inx++) {
                    var segment = ar[inx];
                    testPath += '.' + segment

                    var info = that.getEDInfoForPath(testPath);

                    if (info.isBBE ) {
                        //if it's a BBE, then is it one that can have multiple children? Note: This algorithm will not work on deeply nested paths...
                        if (info.isMultiple) {
                            //the path being passed in has an ancestor that is a multiple bbe. We need to get the existing elements at this path
                            //afaik this will always be directly off the root -todo: might want to check
                            arExistingElements = currentTestPoint[segment] || []
                            response.isMultipleBbe = true;          //indicates that this element does belonge to a repreating bbe (even if the list is currently empty)
                            if (currentTestPoint) {
                                currentTestPoint = currentTestPoint[segment]
                            }
                        } else {
                            // ?? do what
                        }
                    }

                }

                if (! currentTestPoint) {
                    //a parent node doesn't exist. return an empty array for the list - this will trigger a message to create the path first...
                    response.list = [];
                    response.modelPoint=resource;


                } else {
                    response.list = arExistingElements;
                    response.modelPoint=currentTestPoint;
                    //return both the list of nodes that are parents to this element, as well as the position in the instance where it was found (so new ones can be added)

                }

                return response;


            },
            isEmptyText : function(text){
                //return true if the text is empty

                if (text == "<div xmlns='http://www.w3.org/1999/xhtml'>" + this.getManualMarker() + "</div>") {
                    return true
                } else {
                    return false;
                }


            },
            splitNarrative : function(narrative) {

                //get the manual part of resource text - the text above the marker string. default to manual text..
                //assume that the narrative MAY be surrounded by <div> tags...

                var raw = $filter('cleanTextDiv')(narrative);       //the raw text - with 'divs' removed if they are present


                var generated='',manual = raw;

                var g = raw.indexOf(manualMarkerString);
                if (g > -1) {
                    manual = raw.substr(0,g);
                    generated = raw.substr(g+manualMarkerString.length);
                }

                //manual = manual.substr(raw)

                return {manual:manual,generated:generated}
            },
            getManualMarker : function() {
                return manualMarkerString;
            },
            addGeneratedText:function(manualText,generatedText){
                //create a narrative text surrounded by divs. \
                //assume that 'plain text' is input - returns narrative surrounded by 'divs'
                var narrative = manualText + manualMarkerString + generatedText;


                return $filter('addTextDiv')(narrative);




            },
            generateSectionText : function(section) {

                //construct section text from the text of all resources directly in the section.
                //for each resource in the section, if it is a List then construct the text from the text of the
                //immediate children. Otherwise just use the text of the resource.

                //generate the text for a section. todo - needs to become recursive...

                var html = "";
                var that = this;
                section.entry.forEach(function(entry){

                    var resource = that.resourceFromReference(entry.reference);

                    if (resource) {
                        if (resource.resourceType == 'List') {
                            //get the text from all of the references resoruces...
                            var manual = that.splitNarrative(resource.text.div).manual;  //manually entered text
                            var generated = "";     //will replace the generated text...

                            if (resource.entry) {
                                resource.entry.forEach(function(entry){

                                    var refResource = that.resourceFromReference(entry.item.reference);
                                    if (refResource) {

                                        //remove the div as we are concatenating strings here
                                        //$filter('getLogicalID')(profileUrl);

                                        html +=   $filter('cleanTextDiv')(refResource.text.div)+ " ";

                                        //we only want the manually entered text...
                                        generated += that.splitNarrative(refResource.text.div).manual;  //manually entered text

                                    }
                                })
                            }

                            resource.text.div = that.addGeneratedText(manual,generated);

                        } else {
                            //html += resource.text.div
                            html +=  $filter('cleanTextDiv')(resource.text.div) + " ";
                            html += resource.text.div
                        }
                    }
                });

                var div = $filter('addTextDiv')(html)
                section.text = {div:div,status:'generated'} ;
                return html;


                //function getText(text,)


            },
            resourceFromReference : function(reference) {
                //get resource from a reference
                return gAllResourcesThisSet[reference]
            },
            setAllResourcesThisSet : function(allResourcesBundle) {
                //create the hash of all resources in this set;
                var that = this;
                gAllResourcesThisSet = {};
                allResourcesBundle.entry.forEach(function(entry){
                    var resource = entry.resource;
                    gAllResourcesThisSet[that.referenceFromResource(resource)] = resource;

                });
            },
            setPatient : function(resource,SD) {
                //if there's a Patient resource already, then scan for 'subject' or 'patient' properties...
                var that = this;
                var Patient = null;
                angular.forEach(gAllResourcesThisSet,function(value,key){

                    if (value.resourceType == 'Patient') {
                        Patient = value;
                    }
                });

                if (Patient) {
                    //so there is a patient resource - does this resource have a 'patient' or 'subject' property?
                    if (SD && SD.snapshot && SD.snapshot.element) {
                        for (var i=0; i < SD.snapshot.element.length; i++) {
                            var ed =  SD.snapshot.element[i];
                            var path = ed.path;
                            if (path.substr(-7) == 'subject' || path.substr(-7) == 'patient') {

                                that.insertReferenceAtPath(resource,path,Patient)
                                break;
                            }
                        }
                    }
                }
            },
            addResourceToAllResources : function(resource) {
                //add a new resource to the hash

                gAllResourcesThisSet[this.referenceFromResource(resource)] = resource;



            },
            makeDocumentText : function(composition,allResourcesBundle){
                //construct the text representation of a document
                // order is patient.text, composition.text, sections.text
                var html = "";
                if (composition) {
                    var that = this;


                    var manual = that.splitNarrative(composition.text.div).manual;  //manually entered text
                    var generated = "";     //will replace the genereated text...

                    //add generated text from resources...
                    var references = ['subject','encounter','author','custodian']
                    angular.forEach(composition,function(value,key){

                        var arResources = [];

                        if (references.indexOf(key) > -1) {

                            if (angular.isArray(value)) {
                                //var ar = value
                                value.forEach(function(el) {
                                    var r = that.resourceFromReference(el.reference)
                                    arResources.push(r)
                                })
                            } else {
                                arResources.push(that.resourceFromReference(composition[key].reference))
                            }

                        }

                        //this was a resource reference
                        if (arResources.length > 0) {
                            arResources.forEach(function(resource){
                                if (resource) {
                                    generated += "<div><strong class='inset'>"+key+": </strong>" + that.splitNarrative(resource.text.div).manual + "</div>";
                                }
                            })
                        }
                    });

                    composition.text.div = that.addGeneratedText(manual,generated);

                    html += "<h3>Composition</h3>" + "<div class='inset'>"+ composition.text.div + "</div>";
                    html += "<h3>Sections</h3>";

                    composition.section.forEach(function(section){

                        html += "<h4>"+section.title+"</h4>";
                        html += "<div class='inset'>";

                        // - don't do that here any more... html += that.generateSectionText(section)
                        if (section.text) {
                            html += section.text.div;
                        }

                        html += "</div>";



                    })


                }

                return html;



            },
            referenceFromResource : function(resource) {
                //create the reference from the resource
                return resource.resourceType + "/" + resource.id;
            },
            saveToLibrary : function (bundleContainer,user) {
                //save the bundle to the library. Note that the 'container' of the bundle (includes the name) is passed in...



                var bundle = bundleContainer.bundle;

                //remove all the 'valid' propertis on entry (generated during validation...
                bundle.entry.forEach(function (entry) {
                    delete entry.valid;
                });


                var docref = {resourceType:'DocumentReference',id:bundle.id};
                docref.type = {coding:[{system:'http://clinfhir.com/docs',code:'builderDoc'}]};
                //bundleContainer.category is a Coding datatype
                docref.class = {coding:[bundleContainer.category]};

                docref.status = 'current';
                docref.indexed = moment().format();
                docref.description = bundleContainer.name;  //yes, I know these names are confusing...


                if (user) {
                    //todo - add Practitioner stuff as well...
                    docref.author = {display:user.user.email}
                }

                var extensionUrl = appConfigSvc.config().standardExtensionUrl.docrefDescription;
                Utilities.addExtensionOnce(docref,extensionUrl,{valueString:bundleContainer.description})




                if (bundleContainer.isPrivate) {
                    docref.meta = {security : [{code:'R',system:'http://hl7.org/fhir/v3/Confidentiality'}]}
                }
                docref.content = [{attachment:{data:btoa(angular.toJson(bundle))}}]


                //add any history - as an object to allow for later expansion...
                if (bundleContainer.history && bundleContainer.history.length > 1) {
                    var dr = {history:bundleContainer.history}
                    docref.content.push({attachment:{data:btoa(angular.toJson(dr))}})
                }

                var url = appConfigSvc.getCurrentDataServer().url + 'DocumentReference/'+docref.id;
                return $http.put(url,docref);

            },
            getBundleContainerFromDocRef : function(dr){
                //generate a bundleContainer (how the bundle is stored locally) from a documentreference...

                if (dr && dr.content && dr.content[0] && dr.content[0].attachment && dr.content[0].attachment.data) {
                    var container = {};
                    if (dr.class) {
                        container.category = dr.class.coding[0];    //category is a Coding
                    } else {
                        //default class to 'default'. This is just transitional...
                        container.category = {code:'default',display:'Default'};
                        container.category.system = 'http://clinfhir.com/fhir/CodeSystem/LibraryCategories';   //todo get from appConfig
                    }


                    /*
                    //scenario tags are saved as tags against the
                    if (dr.meta && dr.meta.tags) {
                        container.tags = dr.meta.tags
                    }
*/

                    //the bundle of resources that makes up the scenario. stores as a b64 encoded attachment in the DR


                    //there was some rubbish in the library...
                    try {
                        container.bundle = angular.fromJson(atob(dr.content[0].attachment.data));
                    } catch (ex) {
                        console.log('error loading library item: ',ex)
                    }

                    //get the history (if any)
                    if (dr.content.length > 1) {
                        var hx = angular.fromJson(atob(dr.content[1].attachment.data))
                        container.history = hx.history;
                        container.showVersion = true;       //displays the version bar..
                    }

                   // if (bundleContainer.history && bundleContainer.history.length > 1) {
                     //   var dr = {history:bundleContainer.history}
                       // docref.content.push({attachment:{data:btoa(angular.toJson(dr))}})
                   // }



                    //create the summary of resources in the container
                    container.resources = [];       //this will be a sorted list (by type) ...
                    var obj = {}
                    if (container.bundle.entry) {
                        container.bundle.entry.forEach(function(entry){
                            var resourceType = entry.resource.resourceType;
                            if (obj[resourceType]) {
                                obj[resourceType].count++
                            } else {
                                obj[resourceType] = {type:resourceType,count:1}
                            }
                        })
                    }

                    for (var o in obj) {
                        container.resources.push(obj[o])
                    }
                    container.resources.sort(function(a,b){
                        if (a.type < b.type) {
                            return 1
                        } else {
                            return -1
                        }
                    });
                    container.author = dr.author;

                    if (dr.meta) {
                        container.lastUpdated = dr.meta.lastUpdated;
                        container.version = dr.meta.versionId
                    }



                    container.name = dr.description;
                    container.url = appConfigSvc.getCurrentDataServer().url + "DocumentReference/"+dr.id;
                    //container.description = dr.description;

                    //the description is stored in an extension - the dr.description filed is actually the set name...
                    var extensionUrl = appConfigSvc.config().standardExtensionUrl.docrefDescription;
                    var ext = Utilities.getSingleExtensionValue(dr,extensionUrl);
                    if (ext && ext.valueString) {
                        container.description = ext.valueString;  //yes, I know these names are confusing...
                    }
                    container.isDirty = false;
                    //get the security tags.
                    if (dr.meta && dr.meta.security) {
                        dr.meta.security.forEach(function(coding){
                            if (coding.system='' && coding.code == 'R') {
                                container.isPrivate = true;
                            }
                        })
                    }
                    return container;
                }
            },
            loadLibrary : function (builderBundles) {
                //download ALL the DocumentReferences that are the library references...
                var that = this;
                //create a hash for the current sets in the local cache based on id...
                //determine which are already stored loca
                var cache = {};
                if (builderBundles) {
                    builderBundles.forEach(function(bundle){
                        cache[bundle.bundle.id] = true;
                    });
                }

                var deferred = $q.defer();
                var url = appConfigSvc.getCurrentDataServer().url + 'DocumentReference?type=http://clinfhir.com/docs|builderDoc';

                GetDataFromServer.adHocFHIRQueryFollowingPaging(url).then(
                    function (data) {

                        var bundle = data.data;
                        if (bundle && bundle.entry) {
                            var arContainer = [];
                            bundle.entry.forEach(function(entry){
                                var dr = entry.resource;
                                var container = that.getBundleContainerFromDocRef(dr)
                                //console.log(container);
                                if (cache[dr.id]) {
                                    container.cachedLocally = true;
                                }
                                arContainer.push(container);  //saves the doc as a container...
                            })
                        }

                        //sort by scenario name - shouldalways be a name. but just tobesure, wrap in an extension...
                        try {
                            arContainer.sort(function(a,b){
                                a.name = a.name || 'No Name!'
                                b.name = b.name || 'No Name!'


                                if (a.name.toUpperCase() > b.name.toUpperCase()) {
                                    return 1
                                } else {
                                    return -1
                                }
                            })
                        } catch (ex) {
                            console.log('Error sorting library entries. Is there an empty name?')
                        }



                        deferred.resolve(arContainer)

                    },function (err) {

                        deferred.reject(err);
                    }
                )



                return deferred.promise;
            },
            deleteLibraryEntry : function(container){
                //delete an entry from the library.
                return $http.delete(container.url)
            },
            getValueForPath : function(resource,inPath) {
                //return a string display for a path value. root only at this stage...
                var path = $filter('dropFirstInPath')(inPath);   //the path off the root
                var info = this.getEDInfoForPath(inPath)

                if (info.isBBE) {
                    return {raw:{},display:""}
                } else {
                    var rawValue = resource[path];
                    if (info.isMultiple && resource[path]) {
                        rawValue = resource[path][0];
                    }
                    var display = "";
                    if (rawValue) {
                        display = rawValue;

                        //figure out the display
                        if (rawValue.coding && angular.isArray(rawValue.coding)) {
                            //this is a cc
                            display = rawValue.coding[0].display;
                            //display = rawValue.coding[0].code + " ("+rawValue.coding[0].system+")";
                        } else if (rawValue.start || rawValue.end) {
                            //this is a period

                        }
                    }

                    return {raw:rawValue,display:display}
                }




            },
            addStringToText : function(resource,txt) {

                return;     //todo - fix 'undefined' errors
                //add the txt to the resource.text.div element...
                if (resource.text && resource.text.div) {

                    //strip off the leading resource type
                    var g = txt.indexOf('.');
                    if (g > -1) {

                        txt = txt.substring(g+1)
                    }


                    var vo = this.splitNarrative(resource.text.div)
                    var manual = vo.manual + txt;
                    resource.text.div = this.addGeneratedText(manual,vo.generated);

                }

            },
            getDTValue : function(dt,value){
                //get the value for a datatype - implemented for newBuilder...
                var v,text;
                switch (dt) {

                    case 'positiveInt' :
                        v = parseInt(value.integer,10);
                        break;
                    case 'unsignedInt' :
                        v = parseInt(value.integer,10);
                        break;


                    case 'Reference':
                        v = {};
                        if (value.reference) {
                            v.reference = value.reference.url;
                            v.identifier = value.reference.identifier;
                            v.display = value.reference.display;
                        }
                        break;

                    case 'Narrative' :
                        v = {div:value.narrative.div,status:'additional'};
                        break;
                    case 'instant' :
                        //value is a Date object...
                        v = moment(value.date).format();
                        break;
                    case 'Attachment' :
                        v = {title:value.attachment.title};

                        addIfNotEmpty(value.attachment.contentType,v,'contentType');
                        addIfNotEmpty(value.attachment.language,v,'language');
                        addIfNotEmpty(value.attachment.url,v,'url');
                        addIfNotEmpty(value.attachment.size,v,'size');
                        addIfNotEmpty(value.attachment.hash,v,'hash');

                        if (value.attachment.creation) {
                            var cr = moment(value.attachment.creation).format();
                            addIfNotEmpty(cr,v,'creation');

                        }


                        //simpleInsert(insertPoint,info,path,insrt,dt);




                        break;

                    case 'Quantity' :
                        var f = parseFloat(value.quantity.value)

                        if (f !== f) {      //test for Nan (http://stackoverflow.com/questions/30314447/how-do-you-test-for-nan-in-javascript)
                            alert('Must be a numeric value')        //todo - shouldn't really use alert here...
                        } else {
                            v = {value:f,unit:value.quantity.unit}
                        }

                        break;
                    case 'Dosage' :
                        var insrt = {};
                        //addIfNotEmpty(value.HumanName.use,insrt,'use');

                        insrt.text = value.dosage.text;
                        insrt.sequence = value.dosage.sequence;
                        insrt.patientInstruction = value.dosage.patientInstructions;
                        insrt.timing =  value.dosage.timing;

                        if (value.dosage.route) {
                            insrt.route = value.dosage.route
                        }
                        if (value.dosage.dose) {
                            insrt.doseQuantity = {value: value.dosage.dose.value}
                            insrt.doseQuantity.unit = value.dosage.dose.unit;
                        }
                        if (value.dosage.prn) {
                            if (value.dosage.prn.reason) {
                                insrt.asNeededCodeableConcept = {text:value.dosage.prn.reason}
                            }

                        }


                        v = insrt;
                        break;
                    case 'extension' :


                        break;
                    case 'integer' :
                        v = parseInt(value.integer,10);
                        break;

                    case 'decimal' :
                        v = parseFloat(value.integer)
                        break;

                    case 'uri' :
                        v = value.uri;
                        break;

                    case 'ContactPoint':
                        v = {value:value.contactpoint.value,system:value.contactpoint.system,use:value.contactpoint.use}
                        break;
                    case 'Identifier' :
                        v = {value:value.identifier.value,system:value.identifier.system}
                        break;

                    case 'boolean' :
                        v = value.boolean;
                        break;
                    case 'Annotation' :
                        v = {text:value.Annotation.text,time:moment().format()}
                        break;

                    case 'HumanName' :
                        var fhirVersion = appConfigSvc.getCurrentDataServer().version; //format changed between versions

                        var insrt = {}

                        addIfNotEmpty(value.HumanName.use,insrt,'use');
                        addIfNotEmpty(value.HumanName.prefix,insrt,'prefix',true);
                        addIfNotEmpty(value.HumanName.given,insrt,'given',true);
                        addIfNotEmpty(value.HumanName.middle,insrt,'given',true);
                        if (fhirVersion == 2) {
                            addIfNotEmpty(value.HumanName.family,insrt,'family',true);
                        } else {
                            addIfNotEmpty(value.HumanName.family,insrt,'family');
                        }


                        addIfNotEmpty(value.HumanName.suffix,insrt,'suffix',true);
                        addIfNotEmpty(value.HumanName.text,insrt,'text');
                        v = insrt;
                        break;

                    case 'Address' :
                        var insrt = {}

                        addIfNotEmpty(value.Address.use,insrt,'use');
                        addIfNotEmpty(value.Address.type,insrt,'type');

                        addIfNotEmpty(value.Address.line1,insrt,'line',true);
                        addIfNotEmpty(value.Address.line2,insrt,'line',true);
                        addIfNotEmpty(value.Address.line3,insrt,'line',true);

                        addIfNotEmpty(value.Address.city,insrt,'city');
                        addIfNotEmpty(value.Address.district,insrt,'district');
                        addIfNotEmpty(value.Address.state,insrt,'state');
                        addIfNotEmpty(value.Address.postalCode,insrt,'postalCode');

                        addIfNotEmpty(value.Address.country,insrt,'country');



                        addIfNotEmpty(value.Address.text,insrt,'text');
                        v = insrt;
                        break;

                    case 'Period' :
                        if (value.period) {
                            var start = value.period.start;
                            var end = value.period.end;
                            v = {start:start,end:end}

                        } else {
                            alert('No period data selected');   //todo - shuldn't really call alert here
                        }


                        break;

                    case 'date' :
                        //value is a Date object...
                        v = moment(value.date).format('YYYY-MM-DD');
                        break;
                    case 'dateTime' :
                        //value is a Date object...

                        //var v = moment(value.date).format();

                        v = moment(value.date).format('YYYY-MM-DD');
                        if (value.time) {
                            value.date.setHours(value.time.getHours());
                            value.date.setMinutes(value.time.getMinutes());
                        }


                        console.log(value.time)
                        v = moment(value.date).format();




                        break;

                    case 'code' :
                        v = value.code;
                        break;
                    case 'string' :
                        v = value.string;
                        break;
                    case "CodeableConcept" :
                        //value is an object that can have properties code, system, display, text
                        var cc = {},text="";
                        if (value && value.cc) {

                            //when a CC is rendered as a set of radios the output is a json string...

                            if (angular.isString(value.cc)) {
                                value.cc = {coding:angular.fromJson(value.cc)}
                                delete value.cc.coding.extension;
                            }


                            if (value.cc.coding && value.cc.coding.code) {

                                cc.coding = [] ; //[value.cc.coding]
                                var coding = {}
                                coding.code = value.cc.coding.code;      //from the specific input box
                                coding.system = value.cc.coding.system;
                                coding.display = value.cc.coding.display;
                                cc.coding.push(coding)
                              //  if (value.cc.coding.display) {
                                   // text = value.cc.coding.display
                               // }
                            }
                            if (value.cc.text) {
                                cc.text = value.cc.text;
                                text = value.cc.text;
                            }



                            v = cc;

                        }

                        break;
                    case "Coding" :
                        //value is an object that can have properties code, system, display, text
                        var cc = {},text="";
                        if (value && value.coding) {
                            v = value.coding

                        }

                        break;
                }
                return {value:v,text:text};

                function addIfNotEmpty(value,obj,prop,isArray) {
                    if (value) {
                        if (isArray) {
                            obj[prop] = obj[prop] || []
                            obj[prop].push(value);

                        } else {
                            obj[prop] = value;
                        }



                    }
                }

            },
            addPropertyValue : function(insertPoint,hashPath,dt,value) {
                //add a value at the insertPoint (eg the resource root).
                // the last segment of hashPath.path is the actual propertyname. (we need to full path to get the ED)
                // type of value will depend on datatype
                var that = this;
                var info = this.getEDInfoForPath(hashPath.path)
                //for now, we only allow values for properties directly off the root...
                var path = hashPath.path;
                var valueSaved;     //needed for tracking;

                //=============  TODO - USE THE getDTValue() FUNCTION ABOVE IN PLACE OF THE SWITCH...

                switch (dt) {


                    case 'positiveInt' :

                        simpleInsert(insertPoint,info,path,parseInt(value.integer,10),dt);

                       // v = parseInt(value.integer,10);
                        break;
                    case 'unsignedInt' :
                        simpleInsert(insertPoint,info,path,parseInt(value.integer,10),dt);

                       // v = parseInt(value.integer,10);
                        break;



                    case 'Reference':
                        var v = {};
                        v.reference = value.reference.url;
                        v.identifier = value.reference.identifier;
                        v.display = value.reference.display;
                        simpleInsert(insertPoint,info,path,v,dt);
                        break;

                    case 'instant' :
                        //value is a Date object...
                        var v = moment(value.date).format();
                        simpleInsert(insertPoint,info,path,v,dt);
                        this.addStringToText(insertPoint,path+": "+ v)
                        break;
                    case 'Attachment' :
                        var insrt = {title:value.attachment.title}


                        this.addStringToText(insertPoint,path+": "+ insrt.title)
                        addIfNotEmpty(value.attachment.contentType,insrt,'contentType');
                        addIfNotEmpty(value.attachment.language,insrt,'language');
                        addIfNotEmpty(value.attachment.url,insrt,'url');
                        addIfNotEmpty(value.attachment.size,insrt,'size');
                        addIfNotEmpty(value.attachment.hash,insrt,'hash');

                        if (value.attachment.creation) {
                            var cr = moment(value.attachment.creation).format();
                            addIfNotEmpty(cr,insrt,'creation');

                        }


                        simpleInsert(insertPoint,info,path,insrt,dt);

                        break;

                    case 'Quantity' :

                        var v = parseFloat(value.quantity.value)
                        console.log(v)
                        if (v !== v) {      //test for Nan (http://stackoverflow.com/questions/30314447/how-do-you-test-for-nan-in-javascript)
                            alert('Must be a numeric value')        //todo - shouldn't really use alert here...
                        } else {
                            var insrt = {value:v,unit:value.quantity.unit}
                            simpleInsert(insertPoint,info,path,insrt,dt);
                        }



                        break;
                    case 'Dosage' :
                        var insrt = {};
                        //addIfNotEmpty(value.HumanName.use,insrt,'use');

                        insrt.text = value.dosage.text;
                        insrt.sequence = value.dosage.sequence;
                        insrt.patientInstruction = value.dosage.patientInstructions;
                        insrt.timing =  value.dosage.timing;

                        if (value.dosage.route) {
                            insrt.route = value.dosage.route
                        }
                        if (value.dosage.dose) {
                            insrt.doseQuantity = {value: value.dosage.dose.value}
                            insrt.doseQuantity.unit = value.dosage.dose.unit;
                        }
                        if (value.dosage.prn) {
                            if (value.dosage.prn.reason) {
                                insrt.asNeededCodeableConcept = {text:value.dosage.prn.reason}
                            }

                        }


                        simpleInsert(insertPoint,info,path,insrt,dt);
                        break;
                    case 'extension' :
                        simpleInsert(insertPoint,info,path,value.extValue,dt);

                        break;
                    case 'integer' :
                        simpleInsert(insertPoint,info,path,parseInt(value.integer,10),dt);
                        break;

                    case 'decimal' :
                        simpleInsert(insertPoint,info,path,parseFloat(value.integer),dt);
                        break;

                    case 'uri' :
                        simpleInsert(insertPoint,info,path,value.uri,dt);

                        //this.addStringToText(insertPoint,path+": "+ value.string)
                        break;

                    case 'ContactPoint':
                        var insrt = {value:value.contactpoint.value,system:value.contactpoint.system,use:value.contactpoint.use}
                        simpleInsert(insertPoint,info,path,insrt,dt);
                        this.addStringToText(insertPoint,path+": "+ insrt.value)
                        break;
                    case 'Identifier' :
                        var insrt = {value:value.identifier.value,system:value.identifier.system}
                        simpleInsert(insertPoint,info,path,insrt,dt);
                        this.addStringToText(insertPoint,path+": "+ insrt.value)
                        break;

                    case 'boolean' :
                       var v = value;
                        simpleInsert(insertPoint,info,path,value.boolean,dt);
                        this.addStringToText(insertPoint,path+": "+ v)
                        break;
                    case 'Annotation' :
                        var insrt = {text:value.Annotation.text,time:moment().format()}
                        simpleInsert(insertPoint,info,path,insrt,dt);
                        this.addStringToText(insertPoint,path+": "+ insrt.text)
                        break;

                    case 'HumanName' :
                        var fhirVersion = appConfigSvc.getCurrentDataServer().version; //format changed between versions

                        var insrt = {}

                        addIfNotEmpty(value.HumanName.use,insrt,'use');
                        addIfNotEmpty(value.HumanName.prefix,insrt,'prefix',true);
                        addIfNotEmpty(value.HumanName.given,insrt,'given',true);
                        addIfNotEmpty(value.HumanName.middle,insrt,'given',true);
                        if (fhirVersion == 2) {
                            addIfNotEmpty(value.HumanName.family,insrt,'family',true);
                        } else {
                            addIfNotEmpty(value.HumanName.family,insrt,'family');
                        }


                        addIfNotEmpty(value.HumanName.suffix,insrt,'suffix',true);
                        addIfNotEmpty(value.HumanName.text,insrt,'text');

                        simpleInsert(insertPoint,info,path,insrt,dt);

                        this.addStringToText(insertPoint,path+": "+ insrt.text)
                        break;

                    case 'Address' :
                        var insrt = {}

                        addIfNotEmpty(value.Address.use,insrt,'use');
                        addIfNotEmpty(value.Address.type,insrt,'type');

                        addIfNotEmpty(value.Address.line1,insrt,'line',true);
                        addIfNotEmpty(value.Address.line2,insrt,'line',true);
                        addIfNotEmpty(value.Address.line3,insrt,'line',true);

                        addIfNotEmpty(value.Address.city,insrt,'city');
                        addIfNotEmpty(value.Address.district,insrt,'district');
                        addIfNotEmpty(value.Address.state,insrt,'state');
                        addIfNotEmpty(value.Address.postalCode,insrt,'postalCode');

                        addIfNotEmpty(value.Address.country,insrt,'country');



                        addIfNotEmpty(value.Address.text,insrt,'text');

                        //var insrt = {text:value.Address.text}
                        simpleInsert(insertPoint,info,path,insrt,dt);
                        this.addStringToText(insertPoint,path+": "+ insrt.text)
                        break;

                    case 'Period' :
                        if (value.period) {
                            var start = value.period.start;
                            var end = value.period.end;
                            var insrt = {start:start,end:end}
                            simpleInsert(insertPoint,info,path,insrt,dt);
                        } else {
                            alert('No period data selected');   //todo - shuldn't really call alert here
                        }


                        break;

                    case 'date' :
                        //value is a Date object...
                        var v = moment(value.date).format('YYYY-MM-DD');
                        simpleInsert(insertPoint,info,path,v,dt);
                        this.addStringToText(insertPoint,path+": "+ v)
                        break;
                    case 'dateTime' :
                        //value is a Date object...
                        //var v = moment(valuedate).format();

                        //var v = moment(value.date).format('YYYY-MM-DD');
                        value.date = value.date || new Date();//moment(value.date).format('YYYY-MM-DD');
                        if (value.time) {
                            value.date.setHours(value.time.getHours());
                            value.date.setMinutes(value.time.getMinutes());


                            //v = moment(value.date).format('YYYY-MM-DD hh:mm:ss');

                            //value.date.setHours(v.time.getHours());
                           // value.date.setMinutes(v.time.getMinutes());
                        }

                        //simpleInsert(insertPoint,info,path,v,dt);
                        simpleInsert(insertPoint,info,path,value.date,dt);

                        this.addStringToText(insertPoint,path+": "+ v)
                        break;

                    case 'code' :
                        simpleInsert(insertPoint,info,path,value.code,dt);

                        this.addStringToText(insertPoint,path+": "+ value.code)
                        break;
                    case 'string' :
                        simpleInsert(insertPoint,info,path,value.string,dt);

                        this.addStringToText(insertPoint,path+": "+ value.string)
                        break;
                    case "CodeableConcept" :
                        //value is an object that can have properties code, system, display, text
                        var cc = {},text="";
                        if (value && value.cc) {

                            //when a CC is rendered as a set of radios the output is a json string...

                            if (angular.isString(value.cc)) {
                                value.cc = {coding:angular.fromJson(value.cc)}
                                delete value.cc.coding.extension;
                            }

                            if (value.cc.coding && value.cc.coding.code) {

                                cc.coding = [] ; //[value.cc.coding]
                                var coding = {}
                                coding.code = value.cc.coding.code;      //from the specific input box
                                coding.system = value.cc.coding.system;
                                coding.display = value.cc.coding.display;
                                cc.coding.push(coding)

                                //  if (value.cc.coding.display) {
                                // text = value.cc.coding.display
                                // }
                            }

                           /* if (value.cc.coding && value.cc.coding.code) {
                                cc.coding = [value.cc.coding]
                                if (value.cc.coding.display) {
                                    text = value.cc.coding.display
                                }
                            }*/
                            if (value.cc.text) {
                                cc.text = value.cc.text;
                                text = value.cc.text;
                            }

                            //if there was enough data for a cc to be generated...
                            if (cc.text || cc.coding) {
                                simpleInsert(insertPoint,info,path,cc,dt);

                                if (text) {
                                    this.addStringToText(insertPoint, path + ": " + text)
                                }
                            }

                        }

                        break;
                    case "Coding" :
                        //value is an object that can have properties code, system, display, text
                        var cc = {},text="";

                        if (value && value.cc && value.cc.coding) {
                            simpleInsert(insertPoint,info,path,value.cc.coding,dt);
                        } /*else if (value && value.coding) {
                            //todo - this doesn;t seen to work...
                            simpleInsert(insertPoint,info,path,value.coding,dt);
                        }*/

                        break;
                }


                return valueSaved;

                function addIfNotEmpty(value,obj,prop,isArray) {
                    if (value) {
                        if (isArray) {
                            obj[prop] = obj[prop] || []
                            obj[prop].push(value);

                        } else {
                            obj[prop] = value;
                        }



                    }
                }


                function simpleInsert(insertPoint,info,path,insrt,dt) {

                    var elementInfo = that.getEDInfoForPath(path);  //information about the element we're about to insert...

                    var ar = path.split('.');
                    var propertyName = ar[ar.length-1];     //so we insert at insertPoint[propertyName]


                    //rename the propertyname if it can have different datatypes...
                    if (propertyName.substr(-3) == '[x]') {
                        var elementRoot = propertyName.substr(0,propertyName.length-3);     //the propertyname with the [x] removed

                        propertyName = elementRoot + dt.substr(0,1).toUpperCase() + dt.substr(1);   //the new property name

                        //delete any existing elements with this root
                        angular.forEach(insertPoint,function(value,key){

                            if (key.substr(0,elementRoot.length) == elementRoot) {
                                delete insertPoint[key]
                            }

                        })
                    }

                    //now do the actual insert...
                    if (elementInfo.isMultiple) {

                        insertPoint[propertyName] = insertPoint[propertyName] || []
                        insertPoint[propertyName].push(insrt)
                    } else {
                        //is this an extension?
                        if (info && info.isExtension) {

                            


                            var dtValue = 'value' + info.extensionType.substr(0,1).toUpperCase() + info.extensionType.substr(1);
                            var ext = {}
                            ext[dtValue] = insrt

                                Utilities.addExtensionOnceWithReplace(insertPoint,info.ed.builderMeta.extensionUrl,ext)



                        } else {
                            insertPoint[propertyName] =insrt;
                        }


                    }

                    valueSaved =  insrt;

                }







            },

            makeInsertPoint : function(resource,path,insertPoint) {
                //construct an insertion point,If the insert point is passed in, then
                //add the reference at that point. Otherwise, start from the root of the resource and traverse
                //the path, adding parent elements (array or object) as required
                var info = this.getEDInfoForPath(path);
                var elementName;
                var path;
                if (insertPoint) {
                    //the element name will be the last se
                    var ar = path.split('.');
                    elementName = ar[ar.length-1]
                } else {
                    var segmentPath = resource.resourceType;

                    path = $filter('dropFirstInPath')(path);
                    insertPoint = resource;
                    var ar = path.split('.');
                    if (ar.length > 0) {
                        for (var i=0; i < ar.length-1; i++) {
                            //not the last one... -
                            var segment = ar[i];
                            segmentPath += '.'+segment;
                            var segmentInfo = this.getEDInfoForPath(segmentPath);
                            if (segmentInfo.isMultiple) {

                                insertPoint[segment] = insertPoint[segment] || []  // todo,need to allow for arrays

                                //todo this used to always add  a node - ? should it???
                                //var node = {};
                                //insertPoint[segment].push(node)
                                //insertPoint = node

                                if (insertPoint[segment].length == 0) {
                                    var node = {};
                                    insertPoint[segment].push(node)

                                    insertPoint = node
                                } else {
                                    insertPoint = insertPoint[segment][0]
                                }

                            } else {
                                insertPoint[segment] = insertPoint[segment] || {}  // todo,need to allow for arrays
                                insertPoint = insertPoint[segment]
                            }
                        }
                        //path = ar[ar.length-1];       //this will be the property on the 'last'segment
                        elementName = ar[ar.length-1];
                    }

                }
                return {insertPoint: insertPoint,elementName:elementName};
            },

            insertReferenceAtPath : function(resource,path,referencedResource,insertPoint) {
                //insert a reference to a resource from a resource. If the insert point is passed in, then
                //add the reference at that point. Otherwise, start from the root of the resource and traverse
                //the path, adding parent elements (array or object) as required

                //sat var info = this.getEDInfoForPath(path);
                var originalPath = path;
                var vo = this.makeInsertPoint(resource,path,insertPoint)
                var insertPoint = vo.insertPoint;
                var elementName = vo.elementName;


                /* abstracting this to a separate function
                //DON'T REMOVE UNTIL SURE IT IT WORKING
                var elementName;
                var path;
                if (insertPoint) {
                    //the element name will be the last se
                    var ar = path.split('.');
                    elementName = ar[ar.length-1]
                } else {
                    var segmentPath = resource.resourceType;

                    path = $filter('dropFirstInPath')(path);
                    insertPoint = resource;
                    var ar = path.split('.');
                    if (ar.length > 0) {
                        for (var i=0; i < ar.length-1; i++) {
                            //not the last one... -
                            var segment = ar[i];
                            segmentPath += '.'+segment;
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
                        //path = ar[ar.length-1];       //this will be the property on the 'last'segment
                        elementName = ar[ar.length-1];
                    }

                }

                */


                //for polymorphic references...
                if (elementName.substr(-3) == '[x]') {
                    var elementRoot = elementName.substr(0,elementName.length-3);     //the propertyname with the [x] removed
                    elementName = elementRoot + 'Reference';   //the new property name
                }



                //if the id of thee referenced resource is a uuid, then don't add the resourceType prefix...
                var reference = referencedResource.resourceType+'/'+referencedResource.id;
                if (referencedResource.id.lastIndexOf('urn:uuid:', 0) === 0) {
                    reference = referencedResource.id;
                }

                //now actually add the reference. this will be at insertPoint[elementName]
                var info = this.getEDInfoForPath(originalPath);
                if (info.max == 1) {
                    insertPoint[elementName] = {reference:reference}
                    //insertPoint[elementName] = {reference:referencedResource.resourceType+'/'+referencedResource.id}
                }
                if (info.max =='*') {
                    insertPoint[elementName] = insertPoint[elementName] || []

/*
                    //if the id of thee referenced resource is a uuid, then don't add the resourceType prefix...
                    var reference = referencedResource.resourceType+'/'+referencedResource.id;
                    if (referencedResource.id.lastIndexOf('urn:uuid:', 0) === 0) {
                        reference = referencedResource.id;
                    }

*/


                    //make sure there isn't already a reference to this resource
                    var alreadyReferenced = false;
                    insertPoint[elementName].forEach(function(ref){
                        if (ref.reference == reference) {
                            alreadyReferenced = true;
                        }
                    })

                    if (! alreadyReferenced) {
                        insertPoint[elementName].push({reference:reference})
                    }

                }

            },
            addSDtoCache : function(profile) {
                gSD[profile.url] = profile;
            },
            getSD : function(resource) {
                //return the SD (profile) for a resource based on it's cannonical url...
                var deferred = $q.defer();
                var that = this;
                //if this resource is a profiled resource, then there will be a meta.profile property. If not, assume a core resource

                var profileUrl = getProfileUrlFromResource(resource); //getProfileUrlCurrentResource();

                if (gSD[profileUrl]) {
                    deferred.resolve(gSD[profileUrl])
                } else {

                    GetDataFromServer.findConformanceResourceByUri(profileUrl).then(
                        function(SD) {

                            //I think it's always safe to call the 'convert to logical model' function...
                            that.makeLogicalModelFromSD(SD).then(
                                function (lm) {
                                    gSD[profileUrl] = lm;
                                    deferred.resolve(lm);
                                }
                            )




                        },function(err){
                            deferred.reject(err)
                        })
                }

                return deferred.promise;
            },
            getSDDEP : function(type) {
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
                var profileUrl = getProfileUrlCurrentResource();
                var SD = gSD[profileUrl];     //it must have been read at this point...

                //var SD = gSD[type];     //it must have been read at this point...
                var info = {path:path};          //this will be the info about this element...


                if (!SD) {
                    //when usig=ng this for the questionnaire
                   // alert("whoops - can't find the profile for this resource - I cannot continue.")
                    return info;
                }


                //find the path
                if (SD.snapshot && SD.snapshot.element) {
                    SD.snapshot.element.forEach(function (ed) {

                        if (ed.path == path) {
                            //is this multiple?
                            info.max = ed.max;
                            info.min = ed.min;
                            info.depth = ar.length;     //the depth of this item in the
                            info.ed = ed;       //never know when you might need it!
                            if (ed.builderMeta && ed.builderMeta.isExtension) {
                                info.isExtension = true;
                                info.extensionType = 'string';      //default to string...
                                if (ed.type) {
                                    info.extensionType = ed.type[0].code;
                                }

                            }
                            if (ed.max == '*') {
                                info.isMultiple = true
                            }

                            //is this a backbone element
                            if (ed.type) {
                                ed.type.forEach(function(typ){
                                    if (typ.code == 'BackboneElement') {
                                        info.isBBE = true
                                    }



                                })
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

                        deferred.reject(err)
                    })
                return deferred.promise;
            },
            getSrcTargReferences : function(url) {
                //get all the references to & from the resource
                var vo = {src:[],targ :[]}
                gAllReferences.forEach(function(ref){
                    if (ref.src == url) {
                        vo.src.push(ref)        //this refernece is a from this resource
                    }
                    if (ref.targ == url) {
                        vo.targ.push(ref)       //this refernece is to this resource
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

                        //if it's an object, does it have a child called 'reference'?
                        if (angular.isObject(value)) {
                            if (value.reference) {
                                //this is a reference!

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
            makeGraph : function(bundle,centralResource,hideMe,showText) {
                //builds the model that has all the models referenced by the indicated SD, recursively...
                //if hideMe is true, then hide the central node and all references to it
                //treat Composition.section as if it were a reference...

                var that = this;
                var allReferences = [];
                gAllReferences.length = 0;


                var allResources = {};  //all resources hash by id
                var centralResourceNodeId;

                var arNodes = [], arEdges = [];
                var objNodes = {};

                //for each entry in the bundle, find the resource that it references
                bundle.entry.forEach(function(entry){
                    //should always be a resource.id  todo? should I check
                    var resource = entry.resource;
                    var addToGraph = true;

                    var url = that.getLinkingUrlFromId(resource);

/*
                    var url = resource.resourceType+'/'+resource.id;
                    //if this is a uuid (starts with 'urn:uuid:' then don't add the resourceType as a prefix.
                    //added to support importing bundles with uuids...
                    if (resource.id.lastIndexOf('urn:uuid:', 0) === 0) {
                        url = resource.id;
                    }
                    */

                    //add an entry to the node list for this resource...
                    var node = {id: arNodes.length +1, label: resource.resourceType, shape: 'box',url:url,cf : {resource:resource}};
                    if (resource.text) {
                        node.title = resource.text.div;
                        if (showText) {

                            var labelText = $filter('manualText')(resource);
                            if (labelText) {
                                node.label += "\n"+labelText.substr(0,20);
                            }

                        }
                    }


                    //the id of the centralResource (if any)
                    if (centralResource) {
                        if (resource.resourceType == centralResource.resourceType && resource.id == centralResource.id) {
                            centralResourceNodeId = node.id

                            if (hideMe) {
                                //hide the node
                                node.hidden = true;
                                node.physics=false;
                            }
                        }
                    }


                    if (objColours[resource.resourceType]) {
                        node.color = objColours[resource.resourceType];
                    }

                    //if there are implicit rules, then assume a logical model //todo - might want a url for this...
                    if (resource.implicitRules) {
                        console.log(resource)
                        node.shape='ellipse';
                        node.color = objColours['LogicalModel'];
                        node.font = {color:'white'}
                    }

                    arNodes.push(node);
                    objNodes[node.url] = node;

                    var refs = [];
                    findReferences(refs,resource,resource.resourceType)

                    refs.forEach(function(ref){
                        allReferences.push({src:node,path:ref.path,targ:ref.reference,index:ref.index})
                        gAllReferences.push({src:url,path:ref.path,targ:ref.reference,index:ref.index});    //all relationsin the collection
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


                //if hideMe is set, then don't show references to the centralResource (which will have been hidden)
                if (hideMe) {
                    arEdges.forEach(function (edge) {
                        if (edge.from == centralResourceNodeId || edge.to == centralResourceNodeId) {
                            edge.hidden = true;
                            edge.physics=false;
                        }

                    })
                }

                //if there's a centralResource - and not hideMe - , then only include resources with a reference to or from it...
                if (centralResource && ! hideMe) {


                   // var centralUrl = centralResource.resourceType + "/" + centralResource.id;
                    var centralUrl = that.getLinkingUrlFromId(centralResource);

                    var allRefs = that.getSrcTargReferences(centralUrl)

                    var hashNodes = {};

                    //move through the nodes an find the references to & from the central node
                    arNodes.forEach(function (node) {
                        var include = false;
                        var id = node.cf.resource.id;
                        //var url = node.cf.resource.resourceType + "/"+node.cf.resource.id;
                        var url = that.getLinkingUrlFromId(node.cf.resource);
                        if (id == centralResource.id) {
                            include = true
                        } else {
                            //does the node have a reference to the central one?
                            //iterate though the references where this is the target
                            allRefs.targ.forEach(function(targ){
                                if (targ.src == url) {
                                    //yes, this resource has a reference to the central one...
                                    include = true;
                                }
                            });

                            allRefs.src.forEach(function(src){
                                if (src.targ == url) {
                                    //yes, this resource has a reference to the central one...
                                    include = true;
                                }
                            })

                        }

                        if (! include) {
                            //hide the node
                            node.hidden = true;
                            node.physics=false;
                        } else {
                            hashNodes[url] = true;
                        }


                    })

                    //only show edges where either the source or the target in the central node
                    arEdges.forEach(function (edge) {
                        if (edge.from == centralResourceNodeId || edge.to == centralResourceNodeId) {

                        } else {
                            edge.hidden = true;
                            edge.physics=false;
                        }

                    })

                }





                var nodes = new vis.DataSet(arNodes);
                var edges = new vis.DataSet(arEdges);

                // provide the data in the vis format
                var data = {
                    nodes: nodes,
                    edges: edges
                };

                return {graphData : data, allReferences:allReferences, nodes: arNodes};

                //find elements of type refernce at this level
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
                                if (showLog) {console.log('>>>>>>>>'+value.reference)}
                                refs.push({path:lpath,reference : value.reference,index:index})
                            } else {
                                //if it's not a reference, then does it have any children?
                                findReferences(refs,value,lpath)
                            }
                        }


                    })
                }




            },
            getResourcesOfType : function(type,bundle,fullProfile){
                //get all the resources in the bundle of the given type. fullProfile is the complete profile - not just the type (at the end of the url)

                console.log(type)
               if (fullProfile) {
                   //new search - will replace the other eventually...
                   // note that LMs can refer to 'core' types, but not other LM's (at present)
                  // var type =


               }


                var ar = [];
                var baseTypeForModel = appConfigSvc.config().standardExtensionUrl.baseTypeForModel;
                bundle.entry.forEach(function(entry){
                    var resource = entry.resource;
                    //core resource types
                    if (resource.resourceType == type || type == 'Resource') {
                        ar.push(resource);
                    } else {
                        //logical models based on a core resoruce
                        var extensionValue = Utilities.getSingleExtensionValue(resource,baseTypeForModel);
                        if (extensionValue && extensionValue.valueString == type) {
                            ar.push(resource);
                        } else {
                            //could be a profiled resource. see if the resource being examined claims to be confirmant...
                            //todo - this may no longer be needed as we're deriving the core type from the profile...
                            if (resource.meta && resource.meta.profile) {
                                //so it does claim conformance to some resources...
                                for (var i=0; i < resource.meta.profile.length; i++) {
                                    if (resource.meta.profile[i].indexOf(type) > -1) {      //todo a strict equality check might be best
                                        ar.push(resource);
                                    }
                                }
                            }
                        }
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
                                    var profile = type.profile || type.targetProfile;       //stu3 difference...
                                    if (profile) {



                                        //note that profile can be an array or a string
                                        if (angular.isArray(profile)) {
                                            references.push({path:ed.path,profile:profile[0].profile,min:ed.min, max:ed.max,ed:ed})
                                        } else {
                                            references.push({path:ed.path,profile:profile,min:ed.min, max:ed.max,ed:ed})
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
angular.module("sampleApp").service('profileDiffSvc',
    function($q,$http,GetDataFromServer,Utilities,appConfigSvc,$filter,resourceSvc,profileCreatorSvc,$localStorage) {

        $localStorage.extensionDefinitionCache = $localStorage.extensionDefinitionCache || {}

        var objColours ={};

        objColours.profile = '#ff8080';
        objColours.extension = '#ffb3ff';
        objColours.terminology = '#FFFFCC';

        objColours.profile_loaded = '#ffcece';
        objColours.extension_loaded = '#ffb3ff';
        objColours.terminology_loaded = '#FFFFCC';

        objColours.Patient = '#93FF1A';

        objColours.List = '#ff8080';
        objColours.Observation = '#FFFFCC';
        objColours.Practitioner = '#FFBB99';
        objColours.MedicationStatement = '#ffb3ff';
        objColours.CarePlan = '#FF9900';
        objColours.Sequence = '#FF9900';
        objColours.CareTeam = '#FFFFCC';
        objColours.Condition = '#cc9900';


        objColours.Organization = '#FF9900';
        objColours.ProviderRole = '#FFFFCC';
        objColours.Location = '#cc9900';
        objColours.HealthcareService = '#FFFFCC';

        objColours.Medication = '#FF9900';

    return {

        findResourceInIGPackage : function(IG,profileUrl) {
            var res;
            IG.package.forEach(function (pkg) {
                pkg.resource.forEach(function (r) {
                    if (r.sourceReference) {
                        if (r.sourceReference.reference == profileUrl) {
                            res = r;
                        }
                    }

                })
            });
            return res;
        },

        createDownloadBundle : function(IG){
            var deferred = $q.defer();
            var that = this;
            var bundle = {resourceType:'Bundle',type:'collection',entry:[]}
            var arQuery = [];
            bundle.entry.push({resource:IG});
            IG.package.forEach(function (package) {
                package.resource.forEach(function (resource) {
                    arQuery.push(addResource(that,resource.sourceReference.reference,bundle));
                })
            });

            $q.all(arQuery).then(
                function() {
                    deferred.resolve(bundle)
                }, function() {
                    //any failure to read will cause a rejection...
                    deferred.reject(bundle)
                }
            );

            return deferred.promise;

            function addResource(that,url,bundle) {
                var deferred1 = $q.defer();
                console.log(url)
                that.getSD(url).then(
                    function (SD) {
                        bundle.entry.push({resource:SD});
                        deferred1.resolve()
                    }, function(err) {
                        deferred1.reject()
                    }
                )
                return deferred1.promise;
            }


        },
        //generate a chart showing the interrelationships of artifacts in the IG...
        createGraphOfIG: function (inIG,options) {

            var IG = angular.copy(inIG);    //as teh IG gets mutated by this function....
            options = options || {profiles:[]};

            var deferred = $q.defer();

            var that = this;

            var arNodes = [], arEdges = [];

            //create a hash indexed on the url and a node of all the artifacts...
            var hash = {};
            var allNodeHashById = {};
            var IdToUse = 0;
            IG.package.forEach(function (package) {
                package.resource.forEach(function (item,inx) {
                    IdToUse++;
//console.log(inx)
                    var include = true;
                    switch (item.purpose) {
                        case 'extension' :
                            if (! options.includeExtensions) {
                                include = false;
                            }
                            break;
                        case 'terminology' :
                            if (! options.includeTerminology) {
                                include = false;
                            }
                            break;

                    }


                    if (include) {
                        var url = item.sourceReference.reference;   //the url of the node
                        if (url) {
                            // console.log(url,IdToUse)

                            var label = path = $filter('referenceType')(url);
                            var node = {id: IdToUse, label: label, shape: 'box',color:objColours[item.purpose]};
                            node.data = item;
                            node.data.url = url;
                            //node.hidden = true;
                            hash[url]={purpose:item.purpose,description:item.description,nodeId:IdToUse,usedBy:[],node:node};  //usedBy is for extensions - what uses them...

                            allNodeHashById[node.id] = node;
                            arNodes.push(node);
                        } else {
                            console.log("---> ",item,'No url')
                        }

                    }

                })
            });

           // console.log(hash)
           // return;

            //now load all the profiles, and figure out the references to extensions and other types. Do need to create all the nodes first...
            var arQuery = []
            angular.forEach(hash,function(item,key){

                //console.log(key,item);
                var parentId = item.nodeId;

                if (item.purpose == 'profile' || item.purpose == 'extension') {
                    var url = key;//item.sourceReference.reference;
                    arQuery.push(getEdges(that, url,hash,parentId,arEdges,options,item.node));
                }
            });




            $q.all(arQuery).then(
                function(){

                    //now - after all the edges have been created, if there is a specificed set of nodes to display then hide those without a reference
                    hashRelationships = {};   //this will be a hash of relationships we know about...
                    if (options.profiles.length > 0) {

                        //first hide all the nodes
                        arNodes.forEach(function (node) {
                            node.hidden = true;
                        });

                        //and the edges...
                        arEdges.forEach(function (node) {
                            node.hidden = true;
                            node.paths = [];    //this will have all the paths between 2 resources (we aggregate them below against the first one
                        });

                        var hashInclude = {};       //a hash of the nodes to include
                        //create the initial hash from the urls passed in...
                        options.profiles.forEach(function (url) {
                            arNodes.forEach(function (node) {
                                if (node.data.url == url) {
                                    hashInclude[node.id] = node;
                                    node.hidden=false;
                                }
                            })
                        });

                        //now move through all the nodes showing the ones  with a relation to that one.
                        //iterate until no more changes...

                        var moreToCheck = true;

                        while (moreToCheck) {
                            moreToCheck = false;
                            arNodesToAdd = [];  //array of new nodes to add after this iteration. Adding it in the iteration mucks of forEach..

                            angular.forEach(hashInclude,function (node,key) {
                                arEdges.forEach(function (edge) {
                                    if (edge.from == node.id){
                                        //this is a relationship from this node.

                                        var hash = node.id+"-"+edge.to;
                                        //is the 'to' node in the hash of nodes (It can get added during iterations...)?
                                        if (! hashInclude[edge.to]) {
                                            //have to add it after the iteration
                                            var nn = allNodeHashById[edge.to]
                                            if (nn) {
                                                //nn.hidden = false;
                                                arNodesToAdd.push(nn);
                                            }
                                            moreToCheck = true;     //we'll need to go around again..
                                        }

                                        if (! hashRelationships[hash]) { //do we already know about this relationship?
                                            //no we don't, is the target already in the list of nodes to include
                                            if (! hashInclude[edge.to]) {
                                                //no it isn't - add it to the hash...
                                                hashInclude[edge.to] = edge;
                                                //and set the hidden for the 'to' node to false...
                                                for (var i=0; i< arNodes.length; i++)  {
                                                    if (arNodes[i].id == edge.to) {

                                                        if (options.includePatient) {
                                                            arNodes[i].hidden = false;
                                                        } else {
                                                            if (node.data.url.indexOf('atient') == -1) {
                                                                arNodes[i].hidden = false;
                                                            }
                                                        }
                                                        break;
                                                    }
                                                }
                                                moreToCheck = true; // ...and set the flag for another round
                                                edge.hidden = false;
                                                //edge.paths.push(edge.data.path)

                                            }
                                            var pathHash = {};
                                            pathHash[edge.data.path]= edge.data.ed;
                                            hashRelationships[hash] = {pathHash : pathHash}; //mark that we know about this relationship...
                                            hashRelationships[hash].from = hashInclude[edge.from]
                                            hashRelationships[hash].to = hashInclude[edge.to]
                                        } else {

                                            hashRelationships[hash].pathHash[edge.data.path]= edge.data.ed;

                                        }
                                    }
                                })

                            });

                            //add the new nodes found in this iteration to the main hash of nodes
                            arNodesToAdd.forEach(function (node) {
                                hashInclude[node.id] = node;
                            });

                            //are we following the full chain?
                            if (options.immediateChildren) {
                                moreToCheck = false;
                            }
                        }
                    }

                    //actually remove all the hidden nodes & edge
                    var newArNodes = [], newArEdges=[];
                    arNodes.forEach(function (node) {
                        if (! node.hidden) {
                            newArNodes.push(node);
                        }
                    });

                    arEdges.forEach(function (edge) {
                        if (! edge.hidden) {
                            newArEdges.push(edge);
                        }
                    });

                    var nodes = new vis.DataSet(newArNodes);
                    var edges = new vis.DataSet(newArEdges);

                    // provide the data in the vis format
                    var data = {
                        nodes: nodes,
                        edges: edges,
                        hash:hash,
                        hashRelationships : hashRelationships
                    };

                    deferred.resolve(data)
                },
                function(err){
                    deferred.reject(err)
                }
            );


            return deferred.promise;
            //----------

            function addNode(url,purpose) {
                //return;
                if (url && ! hash[url]) {
                    //adds a new node (generally a core node)
                    var label = path = $filter('referenceType')(url);
                    //console.log(url)

                    var id = new Date().getTime() + "-" + Math.random();
                    var node = {id: id, label: label, shape: 'box',color:objColours[purpose+'_loaded']};
                    //var node = {id: id, label: label, shape: 'box',color:'#f7eaea'};

                    node.data ={purpose:purpose, sourceReference: {reference:url}};
                    node.data.url = url;
                    node.hidden = true;
                    //these objects are all defined outside of the function...
                    arNodes.push(node);

                    hash[url]={purpose:purpose,description:"",nodeId:node.id,usedBy:[]}  //usedBy is for extensions - what uses them...
                    allNodeHashById[node.id] = node;
                    return id;
                }


            }

            //get all the outward edges from this resource...
            function getEdges(that, url,hash,parentId,arEdges,options,node) {
                var deferred1 = $q.defer();
                that.getSD(url).then(
                    function (SD) {
                        node.data.SD = SD;


                        SD.snapshot.element.forEach(function (ed) {
                            //a reference to an extension

                            if (ed.max !== '0') {

                                if (options.includeExtensions) {
                                    if (ed.path.indexOf('xtension') > -1) {
                                        if (ed.type) {
                                            var profile = ed.type[0].profile;
                                            var ref = hash[profile];
                                            if (ref) {
                                                //hurrah! we have a target resource
                                                arEdges.push({from: parentId, to: ref.nodeId, data:{path:ed.path,ed:ed}})
                                                ref.usedBy.push(url)
                                            }
                                        }
                                    }
                                }




                                //is there a binding to a ValueSet?
                                if (ed.binding) {
                                    var url = ed.binding.valueSetUri;
                                    if (ed.binding.valueSetReference) {
                                        url = ed.binding.valueSetReference.reference
                                    }

                                    if (url) {
                                        var ref = hash[url];
                                        if (ref) {
                                            //hurrah! we have a target ValueSet
                                            arEdges.push({from: parentId, to: ref.nodeId, data:{path:ed.path,ed:ed}})
                                            ref.usedBy.push(url)
                                        } else {
                                            //this is a reference to a resource not in the IG
                                           // console.log(url)
                                            if (options.includeCore && options.includeTerminology) {
                                                var newNodeId = addNode(url,'terminology')
                                                arEdges.push({from: parentId, to: newNodeId, data:{path:ed.path,ed:ed}})
                                            }

                                        }

                                    }
                                }

                                //a reference to another resource type
                                if (ed.type) {
                                    ed.type.forEach(function (typ) {

                                        if (typ.code == 'Reference') {
                                            var targetProfile = typ.targetProfile;
                                            if (typ.profile) {
                                                //stu 2 - get the first one only...
                                                targetProfile = typ.profile[0]
                                            }
                                            var ref = hash[targetProfile];
                                            if (ref) {
                                                //hurrah! we have a target resource
                                                arEdges.push({from: parentId, to: ref.nodeId, data:{path:ed.path,ed:ed}})

                                            } else {
                                                //this is a reference to a resource not in the IG
                                                //console.log(url)
                                                if (options.includeCore) {
                                                    var newNodeId = addNode(targetProfile,'profile')
                                                    arEdges.push({from: parentId, to: newNodeId, data:{path:ed.path,ed:ed}})
                                                }
                                            }
                                        }


                                    })
                                }

                            }

                        });
                        deferred1.resolve();


                    }
                );

                return deferred1.promise;

            }


        },

        clearCache : function(){
            delete $localStorage.extensionDefinitionCache;
            $localStorage.extensionDefinitionCache = {};
            alert('Done! (Be warned that the app will be a bit sluggish until the caches are re-filled)')
        },

        findProfiles : function(svr,type) {
            //var svr =  appConfigSvc.getCurrentConformanceServer();
            var searchString = appConfigSvc.getCurrentConformanceServer().url + "StructureDefinition?";

            if (svr.version == 3) {
                searchString += "kind=resource&base=http://hl7.org/fhir/StructureDefinition/"+$scope.results.profileType.name
            } else {
                //var base = "http://hl7.org/fhir/StructureDefinition/DomainResource";
                searchString += "kind=resource&type="+baseType.name;
            }

            //console.log(searchString)
            $scope.waiting = true;

            $http.get(searchString).then(       //first get the base type...
                function(data) {
                    $scope.profilesOnBaseType = data.data;

                    var url1 =  appConfigSvc.getCurrentConformanceServer().url + "StructureDefinition/"+baseType.name;
                    $http.get(url1).then(       //and then the profiles on that server
                        function (data) {
                            if (data.data) {
                               // console.log(data.data)
                                $scope.profilesOnBaseType.entry = $scope.profilesOnBaseType.entry || []
                                $scope.profilesOnBaseType.entry.push({resource:data.data});

                            }

                        },
                        function () {
                            //just ignore if we don't fine the base..
                        }
                    ).finally(function () {
                       // console.log($scope.profilesOnBaseType)
                    })

                },
                function(err){
                    console.log(err)
                }
            ).finally(function () {
                $scope.waiting = false;
            });

        },


        makeLogicalModelFromTreeData : function(SD,inTreeData) {
            //so this receives the treeData array that was created by profileCreatorSvc.makeProfileDisplayFromProfile()
            //and we need to convert it into the format used by the logicalmodel builder as they ar enot the same! TODO At some point cold be worth looking at whether they can be made the same...


            var deferred = $q.defer();

            var elementsToIgnore = ['id', 'meta', 'implicitRules', 'language', 'contained'];

            var baseType = SD.snapshot.element[0].path;
            var rootName = 'myResource';
            var vo ={rootName:rootName,baseType:baseType};
            var queries = []

            setHeaderInfo(SD,vo);       //set the herader info

            //adjust the elementDefinitions
            var newElementArray = [];
            SD.snapshot.element.forEach(function (el) {
                var include = true;
                var arPath = el.path.split('.');
                arPath[0] = rootName;
                el.path = arPath.join('.')
                delete el.constraint;       // these are usually just copied from the base resource
                delete el.mapping;          //ditto todo: ?? add the fhir path
                delete el.alias;
                delete el.condition;

                if (elementsToIgnore.indexOf(arPath[arPath.length-1]) !== -1) {
                    include = false;
                }

                if (arPath[arPath.length-1] == 'extension') {
                   // console.log(el)
                    include = false;
                    if (el.type) {
                        el.type.forEach(function (typ) {
                            if (typ.profile) {

                                //stu2/3 difference
                                var profile = typ.profile
                                if (angular.isArray(typ.profile)) {
                                    profile = typ.profile[0]
                                }

                                //if there's profile, then we'll pull in the profile definition to update the model.
                                include = true;
                                arPath[arPath.length-1] = el.name;      //todo check exists
                                el.path = arPath.join('.')
                                queries.push(checkExtensionDef(profile, el));
                            }
                        })
                    }
                }

                if (include) {
                    newElementArray.push(el);
                }

            });

            $q.all(queries).then(
                function () {
                   // console.log('DONE')
                    //now that we have all the analysis objects,



                    deferred.resolve(SD);
                },
                function (err) {
                    console.log('ERROR: ', err)
                    deferred.reject(SD);
                }
            );


            SD.snapshot.element = newElementArray;



            return deferred.promise;

            function checkExtensionDef(extUrl, el) {
                var deferred = $q.defer();
                var url = appConfigSvc.getCurrentConformanceServer().url + "StructureDefinition?url=" + extUrl;
                GetDataFromServer.adHocFHIRQuery(url).then(
                    function (data) {
                        var bundle = data.data;
                        if (bundle && bundle.entry) {
                            var extensionDef = bundle.entry[0].resource;     //should really only be one...
                            var analysis = Utilities.analyseExtensionDefinition3(extensionDef);
                            //console.log(analysis)
                            if (analysis.name) {
                                var ar = el.path.split('.');
                                ar[ar.length-1] = analysis.name;
                                el.path = ar.join('.')
                                //console.log(item)
                            }
                            el.analysis = analysis;
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



            function setHeaderInfo(sd,vo) {
                //vo {currentuser: rootName: baseType: name:
                //set the header information that makes this a Logical Model rather than a Profile...
                var mappingCommentUrl = appConfigSvc.config().standardExtensionUrl.edMappingComment;
                var mapToModelExtensionUrl = appConfigSvc.config().standardExtensionUrl.mapToModel;
                var baseTypeForModelUrl = appConfigSvc.config().standardExtensionUrl.baseTypeForModel;
                var simpleExtensionUrl = appConfigSvc.config().standardExtensionUrl.simpleExtensionUrl;
                var discriminatorUrl = appConfigSvc.config().standardExtensionUrl.discriminatorUrl;
                var conceptMapUrl = appConfigSvc.config().standardExtensionUrl.conceptMapUrl;

                //todo - should use Utile.addExtension...
          //      var sd = {resourceType: 'StructureDefinition'};
                if (vo.currentUser) {
                    this.addSimpleExtension(sd, appConfigSvc.config().standardExtensionUrl.userEmail, vo.currentUser.email)
                }



                Utilities.addExtensionOnce(sd, baseTypeForModelUrl, {valueString: vo.baseType})



                sd.id = vo.rootName;
                sd.url = appConfigSvc.getCurrentConformanceServer().url + "StructureDefinition/" + sd.id;
               /* sd.name = vo.name;

                //these are some of the fhir version changes...
                if (appConfigSvc.getCurrentConformanceServer().version ==2) {
                    sd.display = header.title;
                    sd.requirements = header.purpose;
                } else {
                    sd.title = header.title;
                    sd.purpose = header.purpose;
                }
*/

               // sd.publisher = header.publisher;
               // sd.status = 'draft';
                sd.date = moment().format();

             //   sd.purpose = header.purpose;
               // sd.description = header.description;

                //sd.publisher = scope.input.publisher;
                //at the time of writing (Oct 12), the implementaton of stu3 varies wrt 'code' & 'keyword'. Remove this eventually...
                sd.identifier = [{system: "http://clinfhir.com", value: "author"}]
                sd.keyword = [{system: 'http://fhir.hl7.org.nz/NamingSystem/application', code: 'clinfhir'}]
/*
                if (header.mapping) {
                    //mapping comments for the target resource as a whole...
                    sd.mapping = [{identity: 'fhir', name: 'Model Mapping', comments: header.mapping}]
                }
                */
/*
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
*/
                sd.kind = 'logical';
                sd.abstract = false;
                sd.baseDefinition = "http://hl7.org/fhir/StructureDefinition/Element";
                sd.type = vo.rootName;
                sd.derivation = 'specialization';

            }


        },
        findProfilesOnBase : function(baseType){
            var conformanceServer = appConfigSvc.getCurrentConformanceServer();
            var url = conformanceServer.url;
            if (conformanceServer.version == 2) {
                url += "StructureDefinition?kind=resource&type="+baseType;
            }


           return GetDataFromServer.adHocFHIRQueryFollowingPaging(url);     //this is a promise

        },
        reportOneProfile : function(SD) {
            var result = {required:[],valueSet:{},reference:{}}
            if (SD.snapshot && SD.snapshot.element) {
                SD.snapshot.element.forEach(function (el) {
                    //look for required elements
                    if (el.min > 0 && el.max !== '0') {
                        result.required.push(el);
                    }

                    //look for ValueSets & references
                    if (el.type) {
                        el.type.forEach(function(typ) {
                            //this is a coded element, add the bound valueset
                            if (['code', 'Coding', 'CodeableConcept'].indexOf(typ.code) > -1){
                                    if (el.binding) {
                                        var item = {strength:el.binding.strength, path:el.path, min:el.min, max:el.max};
                                        var url;
                                        if ( el.binding.valueSetReference) {
                                            item.type='reference';
                                            url = el.binding.valueSetReference.reference;
                                        } else if (el.binding.valueSetUri){
                                            item.type = 'uri'
                                            url = el.binding.valueSetUri;
                                        }
                                        if (url) {
                                            result.valueSet[url] = result.valueSet[url] || []
                                            result.valueSet[url].push(item)
                                        }
                                    }
                                }


                            if (typ.code == 'Reference' && typ.profile) {
                                var item = {url:typ.profile,path:el.path, min:el.min, max:el.max}
                                result.reference[typ.profile] = result.reference[typ.profile] || []
                                result.reference[typ.profile].push(item);
                            }
                        })
                    }


                })

                //create an array of valueset usages and sort it..
                result.valueSetArray = []
                angular.forEach(result.valueSet,function (v,k) {
                    var item = {url:k,paths:v}
                    result.valueSetArray.push(item)
                })

                result.valueSetArray.sort(function (a,b) {
                    if (a.url > b.url) {
                        return 1
                    } else {
                        return -1;
                    }
                })

                //do the same with references
                result.referenceArray = []
                angular.forEach(result.reference,function (v,k) {
                    var item = {url:k,paths:v}
                    result.referenceArray.push(item)
                })

                result.referenceArray.sort(function (a,b) {
                    if (a.url > b.url) {
                        return 1
                    } else {
                        return -1;
                    }
                })

            }
            //console.log(result)
            return result;



        },
        makeCanonicalObj : function(SD,svr) {
            //svr is the current server (may not be the same as the one in appConfig - eg for the comparison view...
            var deferred = $q.defer();
            var queries = [];   //retrieve extension definitions
            var quest = {resourceType:'Questionnaire',status:'draft',item:[]}   //questionnaire for form

            if (SD && SD.snapshot && SD.snapshot.element) {
                var hashPath = {}
                var newSD = {snapshot: {element:[]}}        //a new SD that removes the excluded elements (max=0)
                var canonical = {item:[]}      //the canonical object...
                var excludeRoots = []           //roots which have been excluded...

                var topLineLevel = 1;           //the point at which a top level line should be drawn
                var topLineRoot = "";



                SD.snapshot.element.forEach(function(ed){
                    var include = true;
                    var path = ed.path;

                    if (path.indexOf(topLineRoot) == -1) {
                        topLineLevel = 1;
                    }


                    var arPath = path.split('.');

                    if (arPath.length > 1) {
                        arPath = arPath.splice(1)
                    }

                    if (['id','meta','language','text','implicitRules','contained'].indexOf(arPath[0]) > -1) {
                        include = false;
                    }
                    if (arPath.length > 1 && arPath[arPath.length - 1] == 'id') {
                        include = false;
                    }


                    var item = {path:arPath.join('.')};


                    //set a top line in the display
                    if (arPath.length == topLineLevel) {
                        item.groupParent = true;
                    }


                    item.originalPath = path;
                    item.ed = ed;
                    item.min = ed.min;
                    item.max = ed.max;
                    item.multiplicity = ed.min + ".."+ed.max;
                    item.type = ed.type;
                    item.difference = {};       //a # of differences - set during the analysis phase...
                    item.isModifier = ed.isModifier;

                    //work out the help display...
                    item.display = ed.definition || ed.short;       //definition in preference to short...
                    if (ed.comments && ed.comments.indexOf('stigma') == -1 && ed.comments.indexOf('/[type]/[id]') == -1) {
                        //don't include 'standard' comments
                        item.display += ed.comments;
                    }

                    if (ed.slicing) {
                        item.slicing = ed.slicing;
                    }

                    //look for any fixed items
                    angular.forEach(ed,function (v,k) {
                        if (k.substr(0,5) == 'fixed') {
                            item.fixed = item.fixed || []
                            item.fixed.push({v:v,k:k})
                            //console.log(v,k)
                        }
                    })

                    //console.log(item.fixed)


                    //if multiplicity is 0, then add to the exclude roots
                    if (item.max == 0) {
                        include = false;
                        excludeRoots.push(path)
                    }

                    //if this path starts with any of the exclude roots, then don't include...
                    excludeRoots.forEach(function(root){
                        if (path.substr(0,root.length) == root) {
                            include = false;
                        }
                    });

                    //special processing for coded elements
                    if (item.type) {
                        item.type.forEach(function(typ) {

                            //set a top line in the display
                            if (typ.code == 'BackboneElement') {
                                item.groupParent = true;
                                topLineLevel = 2;       //todo - this might need to be reactive
                                topLineRoot = path;
                            }

                            //this is a coded element, add the bound valueset
                            if (['code', 'Coding', 'CodeableConcept'].indexOf(typ.code) > -1){
                                if (ed.binding) {
                                    item.coded = {strength:ed.binding.strength}
                                    if ( ed.binding.valueSetReference) {
                                        item.coded.valueSetReference = ed.binding.valueSetReference.reference;
                                    }
                                    item.coded.valueSetUri = ed.binding.valueSetUri;
                                }
                            }
                        }
                    )}

                    //special processing for extensions...
                    if (arPath[arPath.length-1].indexOf('extension') > -1 || arPath[arPath.length-1] == 'modifierExtension') {
                        include = false;
                        //item.extension = {name:ed.name}
                        item.extension = {}
                        if (item.type) {
                            item.type.forEach(function(typ) {
                                if (typ.profile) {
                                    include = true;
                                    if (angular.isArray(typ.profile)) {
                                        item.extension.url = typ.profile[0]
                                    } else {
                                        item.extension.url = typ.profile
                                    }
                                    item.originalPath += '_'+item.extension.url;    //to make it unique
                                    queries.push(resolveExtensionDefinition(item,svr))
                                }
                            })
                        }

                        //see if we can make a nicer display...
                        var display = ed.name;
                        if (! display) {
                            var display =  $filter('referenceType')(item.extension.url);
                        }
                        if (display) {
                            item.path = display;// + " (ext)";    //to make a nicer display...
                        }

                    }
                    if (include) {
                        canonical.item.push(item)

                        //check for a duplicate path
                        var p = ed.path;
                        if (hashPath[p]) {
                            hashPath[p] ++;
                            ed.path = ed.path + '_'+hashPath[p];

                        } else {
                            hashPath[p] = 1;
                        }
                        newSD.snapshot.element.push(ed);
                    }
                });

                if (queries.length) {
                    $q.all(queries).then(
                        function () {
                            //process all extension analyses. Do this after all the extensions have loaded as we'll be inserting entries for complex extensions
                            var extensions = []
                            for (var i=0; i < canonical.item.length; i++) {
                                var item = canonical.item[i];
                                if (item.extension && item.extension.analysis) {

                                    var analysis = item.extension.analysis;
                                    if (analysis.isComplexExtension) {

                                    } else {
                                        //
                                        item.type = angular.copy(analysis.dataTypes);
                                    }
                                    var extension = angular.copy(item)
                                    var ar = extension.originalPath.split('_')
                                    extension.extensionPath = ar[0];
                                    delete extension.groupParent;

                                    extensions.push(extension);

                                }
                            }

                            deferred.resolve({canonical:canonical, SD : newSD,extensions:extensions});
                        },
                        function (err) {


                            alert("error getting SD's for children " + angular.toJson(err))
                            // return with what we have...
                            deferred.resolve({canonical:canonical, SD : newSD});

                        }
                    )
                } else {
                    deferred.resolve({canonical:canonical, SD : newSD});
                }


            } else {
                deferred.reject()
            }

            return deferred.promise

            function resolveExtensionDefinition(item,svr) {
                //console.log(item);
                var deferred = $q.defer();
                var url = item.extension.url;

                if ($localStorage.extensionDefinitionCache[url]) {
                    //note that this is an async call - some duplicate calls are inevitible
                    //console.log('cache')
                    item.extension.analysis = angular.copy(Utilities.analyseExtensionDefinition3($localStorage.extensionDefinitionCache[url]));
                    deferred.resolve()
                } else {
                   // $localStorage.extensionDefinitionCache[url] = 'x'
                    //if a server was passed in then use that, otherwise use the default one...
                    var serverUrl = appConfigSvc.getCurrentConformanceServer().url;
                    if (svr) {
                        serverUrl = svr.url;
                    }
                    GetDataFromServer.findConformanceResourceByUri(url,serverUrl).then(
                        function (sdef) {
                            //console.log(sdef);

                            delete sdef.text;       //large text
                            $localStorage.extensionDefinitionCache[url] = sdef


                            item.extension.analysis = angular.copy(Utilities.analyseExtensionDefinition3(sdef));
                            //console.log(item.extension.analysis)
                            deferred.resolve()
                        },function (err) {
                            console.log(err)
                            deferred.resolve()
                        }
                    )
                }
                return deferred.promise;

            }

        },
        getTerminologyResource : function(url,resourceType) {
            var deferred = $q.defer();
            if ($localStorage.extensionDefinitionCache[url]) {
                //note that this is an async call - some duplicate calls are inevitible
                console.log('cache')
                deferred.resolve($localStorage.extensionDefinitionCache[url]);
            } else {
                // This assumes that the terminology resources are all on the terminology service...
                var serverUrl = appConfigSvc.getCurrentTerminologyServer().url;
                GetDataFromServer.findConformanceResourceByUri(url,serverUrl,resourceType).then(
                    function (sdef) {
                        //remove elements we don't use to save space...
                        delete sdef.text;
                        delete sdef.mapping;
                        delete sdef.differential;




                        $localStorage.extensionDefinitionCache[url] = sdef
                        deferred.resolve($localStorage.extensionDefinitionCache[url]);
                    },function (err) {
                        console.log(err)
                        deferred.reject();
                    }
                )
            }
            return deferred.promise;
        },
        clearSDProfile : function(url) {
            delete $localStorage.extensionDefinitionCache[url];
        },
        getSD : function(url) {
            var deferred = $q.defer();
            if ($localStorage.extensionDefinitionCache[url]) {

                //note that this is an async call - some duplicate calls are inevitible
                //console.log('cache')
                deferred.resolve($localStorage.extensionDefinitionCache[url]);
            } else {
                // $localStorage.extensionDefinitionCache[url] = 'x'
                GetDataFromServer.findConformanceResourceByUri(url).then(
                    function (sdef) {
                        //console.log(sdef);
                        delete sdef.text;   //text can be v large in some profiles

                        $localStorage.extensionDefinitionCache[url] = sdef


                        deferred.resolve($localStorage.extensionDefinitionCache[url]);
                    },function (err) {
                        console.log(err)
                        deferred.reject(err);
                    }
                )
            }
            return deferred.promise;
        },
        analyseDiff : function(primary,secondary) {
            //pass in the canonical model (NOT the SD or ED)
            //var analysis = {};
            if (!primary || !secondary) {
                return;
            }

            secondary.report = {fixed:[],missing:[],valueSet:[]};

            var primaryHash = {};
            primary.item.forEach(function(item){
                var path = item.originalPath;   //extensions will be made unique
                primaryHash[path]= item
            });


            secondary.item.forEach(function (item) {

               // console.log(item)

                //may want to check the primary...
                if (item.fixed) {
                    //console.log(item.fixed)
                   // secondary.report.fixed = secondary.report.fixed || []
                    secondary.report.fixed.push({item:item,fixed:item.fixed})

                    item.difference.fixed = item.fixed;
                }

                if (!primaryHash[item.originalPath] ) {
                    //this is a new path in the secondary. Either an extension, or is core, but not in the primary...
                    //analysis.notInPrimary.push(item)
                    var reportItem = {path:item.path,min:item.min}
                    if (item.extension) {
                        reportItem.extension = item.extension.url
                    }


                    if (item.min !== 0) {
                        item.difference.brk = true;         //breaking change
                       // reportItem.
                    } else {
                        item.difference.nip = true;         //not in primary
                    }
                    secondary.report.missing.push(reportItem);

                } else {
                    var primaryItem = primaryHash[item.originalPath];
                    //the path is in both, has it changed? First the multiplicity
                    if (primaryItem.multiplicity !== item.multiplicity ){
                        item.difference.mc = true;         //multiplicity changed
                    }

                    if (item.coded) {
                        //the secondary is coded
                        if (! primaryItem.coded) {

                            item.difference.vsd = true;     //the primary is not!
                        } else {
                            var vsItem = {}
                            if (item.coded.valueSetReference) {
                                if (primaryItem.coded.valueSetReference !== item.coded.valueSetReference) {
                                    item.difference.vsd = true;
                                    vsItem = {path:item.path,different:true,vsReference:item.coded.valueSetReference}
                                } else {
                                    vsItem = {path:item.path,different:false,vsReference:item.coded.valueSetReference}
                                }
                            }

                            if (item.coded.valueSetUri) {
                                if (item.coded.valueSetUri !== primaryItem.coded.valueSetUri) {
                                    item.difference.vsd = true;
                                    vsItem = {path:item.path,different:true,vsUri:item.coded.valueSetUri}
                                } else {
                                    vsItem = {path:item.path,different:false,vsUri:item.coded.valueSetUri}
                                }
                            }

                            secondary.report.valueSet.push(vsItem);

                        }

                    }

                }

                })

            //console.log(analysis)
            console.log(secondary.report)

        }
    }

    });
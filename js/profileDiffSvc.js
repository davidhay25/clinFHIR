angular.module("sampleApp").service('profileDiffSvc',
    function($q,$http,GetDataFromServer,Utilities,appConfigSvc,$filter) {

    var extensionDefinitionCache = {}


    return {
        findProfilesOnBase : function(baseType){
            var conformanceServer = appConfigSvc.getCurrentConformanceServer();
            var url = conformanceServer.url;
            if (conformanceServer.version == 2) {
                url += "StructureDefinition?kind=resource&type="+baseType;
            }

           return GetDataFromServer.adHocFHIRQueryFollowingPaging(url);     //this is a promise

        },
        reportOneProfile : function(SD) {
            var result = {required:[],valueSet:{}}
            if (SD.snapshot && SD.snapshot.element) {
                SD.snapshot.element.forEach(function (el) {
                    //look for required elements
                    if (el.min > 0 && el.max !== '0') {
                        result.required.push(el);
                    }

                    //look for ValueSets
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
                            }
                        )}


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
            }
            //console.log(result)
            return result;



        },
        makeCanonicalObj : function(SD) {
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
                                    queries.push(resolveExtensionDefinition(item))
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

            function resolveExtensionDefinition(item) {
                //console.log(item);
                var deferred = $q.defer();
                var url = item.extension.url;

                if (extensionDefinitionCache[url]) {
                    //note that this is an async call - some duplicate calls are inevitible
                    //console.log('cache')
                    item.extension.analysis = angular.copy(Utilities.analyseExtensionDefinition3(extensionDefinitionCache[url]));
                    deferred.resolve()
                } else {
                   // extensionDefinitionCache[url] = 'x'
                    GetDataFromServer.findConformanceResourceByUri(url).then(
                        function (sdef) {
                            //console.log(sdef);
                            extensionDefinitionCache[url] = sdef
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
            if (extensionDefinitionCache[url]) {
                //note that this is an async call - some duplicate calls are inevitible
                console.log('cache')
                deferred.resolve(extensionDefinitionCache[url]);
            } else {
                // This assumes that the terminology resources are all on the terminology service...
                var serverUrl = appConfigSvc.getCurrentTerminologyServer().url;
                GetDataFromServer.findConformanceResourceByUri(url,serverUrl,resourceType).then(
                    function (sdef) {
                        //console.log(sdef);
                        extensionDefinitionCache[url] = sdef
                        deferred.resolve(extensionDefinitionCache[url]);
                    },function (err) {
                        console.log(err)
                        deferred.reject();
                    }
                )
            }
            return deferred.promise;
        },
        getSD : function(url) {
            var deferred = $q.defer();
            if (extensionDefinitionCache[url]) {
                //note that this is an async call - some duplicate calls are inevitible
                console.log('cache')
                deferred.resolve(extensionDefinitionCache[url]);
            } else {
                // extensionDefinitionCache[url] = 'x'
                GetDataFromServer.findConformanceResourceByUri(url).then(
                    function (sdef) {
                        //console.log(sdef);
                        extensionDefinitionCache[url] = sdef
                        deferred.resolve(extensionDefinitionCache[url]);
                    },function (err) {
                        console.log(err)
                        deferred.reject();
                    }
                )
            }
            return deferred.promise;
        },
        analyseDiff : function(primary,secondary) {
            //pass in the canonical model (NOT the SD or ED)
            //var analysis = {};
return;
            secondary.report = {fixed:[],missing:[],valueSet:[]};

            var primaryHash = {};
            primary.item.forEach(function(item){
                var path = item.originalPath;   //extensions will be made unique
                primaryHash[path]= item
            });

          //  console.log(primaryHash)
            //fields in secondary, not in primary
            //analysis.notInPrimary = []


            secondary.item.forEach(function (item) {

               // console.log(item)

                //may want to check the primary...
                if (item.fixed) {
                    console.log(item.fixed)
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
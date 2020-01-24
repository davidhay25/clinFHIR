angular.module("sampleApp")

    .service('nhipSvc', function($q,$http,taskSvc,appConfigSvc,$filter) {

        let serverUrl = "http://home.clinfhir.com:8054/baseR4/";
        let termServerUrl = "https://ontoserver.csiro.au/stu3-latest/";


        let extIGEntryType = "http://clinfhir.com/StructureDefinition/igEntryType";
        let extIGMoreInfo = "http://clinfhir.com/StructureDefinition/igMoreInfo";
        let extModelBaseType = "http://clinfhir.com/fhir/StructureDefinition/baseTypeForModel";
        let extProfileForLM = "http://clinfhir.com/fhir/StructureDefinition/profileForLM";
        let extExtensionUrl = "http://clinfhir.com/fhir/StructureDefinition/simpleExtensionUrl";
        let extFSHUrl = "http://clinfhir.com/fhir/StructureDefinition/fshUrl";
        let extCanUrl = "http://clinfhir.com/fhir/StructureDefinition/canonicalUrl";

        let docKey = "http://clinfhir.com/StructureDefinition/docKey";

        var pathExtUrl = appConfigSvc.config().standardExtensionUrl.path;

        //the code for tasks that correstond to notes against the model
        let taskCode =  {system:"http://loinc.org",code:"48767-8"};

        //let cache = {};

        //get the value of a single extension
        function getExtension(resource, url) {
            let ar = [];        //return an array of values...
            if (resource.extension) {
                resource.extension.forEach(function (ext) {
                    if (ext.url == url) {
                        ar.push(ext)
                    }
                })
            }
            return ar;
        }


        function performQueryFollowingPaging(url,limit){
            //Get all the resurces specified by a query, following any paging...
            //http://stackoverflow.com/questions/28549164/how-can-i-do-pagination-with-bluebird-promises

            var returnBundle = {total:0,type:'searchset',link:[],entry:[]};
            returnBundle.link.push({relation:'self',url:url})

            //add the count parameter
            if (url.indexOf('?') > -1) {
                url += "&_count=100"
            } else {
                url += "?_count=100"
            }


            var deferred = $q.defer();

            limit = limit || 100;


            // var returnBundle = {total:0,type:'searchset',link:[],entry:[]};
            //returnBundle.link.push({relation:'self',url:url})
            getPage(url);

            //get a single page of data
            function getPage(url) {

                return $http.get(url).then(
                    function(data) {
                        var bundle = data.data;     //the response is a bundle...

                        //copy all resources into the array..
                        if (bundle && bundle.entry) {
                            bundle.entry.forEach(function(e){
                                returnBundle.entry.push(e);
                            })
                        }

                        //is there a link
                        if (bundle.link) {
                            var moreToGet = false;
                            for (var i=0; i < bundle.link.length; i++) {
                                var lnk = bundle.link[i];

                                //if there is a 'next' link and we're not at the limit then get the next page
                                if (lnk.relation == 'next'){// && returnBundle.entry.length < limit) {
                                    moreToGet = true;
                                    var url = lnk.url;
                                    getPage(url);
                                    break;
                                }
                            }

                            //all done, return...
                            if (! moreToGet) {
                                deferred.resolve(returnBundle);
                            }
                        } else {
                            deferred.resolve(returnBundle);
                        }
                    },
                    function(err) {
                        deferred.reject(err);
                    }
                )
            }

            return deferred.promise;

        }

        let hashResource = {}
        //get a resource based on its url (to the resource NOT the canonical url)
        function getResourceAsync(url) {
            let deferred = $q.defer();
            if (hashResource[url]) {
                deferred.resolve(hashResource[url])
            } else {
                let fullUrl = serverUrl + url;
                $http.get(fullUrl).then(
                    function(data){
                        hashResource[url] = data.data;
                        deferred.resolve(hashResource[url])
                    },
                    function(err) {
                        deferred.reject(err.data);
                    }
                )
            }

            return deferred.promise

        }

        function getConformanceResourceByCanUrl(canUrl,type){
            //get a  conformance resource based on the type and canonical url. cached.
            //todo refactor to include getTerminologyResourceByCanUrl
            type = type || "StructureDefinition";
            let deferred = $q.defer();
            if (confCache[canUrl]) {
                deferred.resolve(confCache[canUrl])
            } else {
                let url = serverUrl + type + "?url=" + canUrl;
                $http.get(url).then(
                    function(data) {
                        if (data.data && data.data.entry && data.data.entry.length > 0) {
                            let resource = data.data.entry[0].resource;
                            confCache[canUrl] = resource;
                            deferred.resolve(confCache[canUrl])

                        } else {
                            deferred.reject({msg:"Resource not found"})
                        }
                    },
                    function(err) {
                        deferred.reject(err)
                    }
                )
            }
            return deferred.promise;

        }


        let cache = {}, termCache = {}, confCache = {}

        return {




            getTerminologyResourceByCanUrl : function(type,canUrl){
                //get a  terminology resource based on the type and canonical url. cached.
                let deferred = $q.defer();
                if (termCache[canUrl]) {
                    deferred.resolve(termCache[canUrl])
                } else {
                    let url = termServerUrl + type + "?url=" + canUrl;
                    $http.get(url).then(
                        function(data) {
                            if (data.data && data.data.entry && data.data.entry.length > 0) {
                                let resource = data.data.entry[0].resource;
                                termCache[canUrl] = resource;
                                deferred.resolve(termCache[canUrl])

                            } else {
                                deferred.reject({msg:"Resource not found"})
                            }
                        },
                        function(err) {
                            deferred.reject(err)
                        }
                    )
                }
                return deferred.promise;

            },


            getResourceById : function(type,id){
                //get a resource based on the type and Id. cached.
                let url = serverUrl + type + "/" + id;

                let deferred = $q.defer();
                //get an artifact by direct url (not canonocal). cache the SD
                if (cache[url]) {
                    deferred.resolve(cache[url])
                } else {
                    $http.get(url).then(
                        function(data) {
                            cache[url] = data.data;
                            deferred.resolve(cache[url])
                        },
                        function(err) {
                            deferred.reject(err)
                        }
                    )
                }

                return deferred.promise;

            },

            getArtifactDEP : function(url) {
                //note - nott actually using this ATM
                let deferred = $q.defer();
                //get an artifact by direct url (not canonocal). cache the SD
                if (cache[url]) {
                    deferred.resolve(cache[url])
                } else {
                    $http.get(url).then(
                        function(data) {
                            cache[url] = data.data;
                            deferred.resolve(cache[url])
                        },
                        function(err) {
                            deferred.reject(err)
                        }
                    )
                }

                return deferred.promise;
            },


            getCapabilityStatement : function(code) {
                let deferred = $q.defer();
                let fullUrl = serverUrl + "CapabilityStatement/" + code;

                let capStmt;
                let resourceDef = {}
                $http.get(fullUrl).then(
                    function(data) {
                        capStmt = data.data;
                        if (capStmt.rest) {
                            capStmt.rest[0].resource.forEach(function(resourceDesc){
                                resourceDef[resourceDesc.type] = resourceDesc
                            })
                        }

                        deferred.resolve({'capStmt':capStmt,'resourceDef':resourceDef})

                    }
                )


                return deferred.promise;

            },

            getDocsForItem : function(art){
                let deferred = $q.defer();
                //retrieve documentation files
                let ar = getExtension(art,docKey);      //all the extensions with document keys in it
                let arDocs = [];                        //will contain the retrieve docs

                let arQuery = [];
                ar.forEach(function (ext) {
                    //todo - for now, assume that all the docs are in the cf tree...
                    arQuery.push(getFile(ext));
                });

                $q.all(arQuery).then(function(){
                    deferred.resolve(arDocs);
                })

                return deferred.promise;

                function getFile(ext) {
                    let url = "content/nhip/"+ ext.valueString;
                    return $http.get(url).then(
                        function (data) {

                            arDocs.push({url:url,contents:data.data})

                        },
                        function(err) {
                            console.log(err)
                        }
                    )
                }

            },

            makeDownload : function(ar,typ) {
                //make a csv download for a valueset or extension analyis
               let download = "";
               if (typ == 'valueSet') {
                   download ="Model,Path,ValueSetUrl,Description,Strength,CodeSystem Urls,Note\n";
                    ar.forEach(function (vs) {
                        let lne = $filter("referenceType")(vs.url)+ ',';
                        lne += $filter('dropFirstInPath')(vs.ed.path)+ ',';
                        lne += vs.valueSetUrl + ',';
                        if (vs.valueSet) {
                            lne += makeSafe(vs.valueSet.description);
                        }
                        lne +=  ',';
                        lne += vs.strength + ',';

                        if (vs.codeSystems) {
                            vs.codeSystems.forEach(function (cs) {
                                lne += cs + " ";
                            })
                        }


                        /*
                        if (vs.valueSet && vs.valueSet.compose && vs.valueSet.compose.include) {
                            vs.valueSet.compose.include.forEach(function (inc) {
                                lne += inc.system + " ";
                            });
                        }
                        */


                        lne += ",";

                        lne += makeSafe(vs.note);
                        download += lne + "\n";
                    })
               }



                return download;




                function getStringExtensionValue(ed,url) {
                    var ext = Utilities.getSingleExtensionValue(ed,url); //in case this is an extension
                    if (ext && ext.valueString) {
                        return ext.valueString
                    } else {
                        return "";
                    }
                }

                //remove comma's and convert " -> '
                function makeSafe(s) {
                    if (s) {
                        //the string 'definition' is inserted if no comment is entered (it is mandatory in the ED)
                        if (s == 'definition' || s == 'No description') {
                            return ""
                        }

                        s = s.replace(/"/g, "'");
                        s = s.replace(/,/g, "-");
                        return '"' + s + '"';
                    } else {
                        return "";
                    }


                }


            },

            analyseIG : function(artifacts) {
                let deferred = $q.defer();
                let arWork = [];

                let arExtension = [], arValueSet=[], quality = {arCoded:[],arExtension:[],arModel:[]};

                artifacts.logical.forEach(function (art) {

                    arWork.push(lookForExtensions(art)) //can do this in a single call as at most one HTTP call is needed

                    let url = art.reference.reference;

                    //is there a reference to a profile? (This was set when the IG was first loaded and parsed...
                    if (! art.profileForLM) {
                        let modelName =  $filter('getLastInPath')(url);
                        quality.arModel.push({type:'noProfile',display:'There is no Profile for this model',ed:{path:modelName}})
                    }

                    //now look for Valuesets. Need to do this here as there can be multiple per model


                    getResourceAsync(url).then(
                        function(SD) {

                            SD.snapshot.element.forEach(function (ed,inx) {

                                //is there a FHIR mapping
                                if (inx > 0) {      //don't look at the model root...
                                    if (ed.mapping) {
                                        let hasMapping = false;
                                        ed.mapping.forEach(function (map) {
                                            if (map.identity == 'fhir') {
                                                hasMapping = true;
                                            }
                                        });

                                        if (!hasMapping) {
                                            quality.arModel.push({type:'noMap',display:'The path ' + ed.path + ' has no FHIR mapping',ed:ed})
                                        }
                                    } else {
                                        quality.arModel.push({type:'noMap',display:'The path ' + ed.path + ' has no FHIR mapping',ed:ed})
                                    }


                                    //is this a coded element type
                                    if (ed.type) {
                                        let typ = ed.type[0].code;
                                        let isCoded = typ=='CodeableConcept' || typ=='Coding' || typ=='code';

                                        if (isCoded) {
                                            arWork.push(processCoded(url,ed));
                                        }
                                    }
                                }


                            })
                        }, function(err) {
                            console.log(err)
                        }
                    )

                });

                //now perform all the async tasks...
                //does seem to work, although work items are added asynchronoiusly...
                if (arWork.length > 0) {
                    $q.all(arWork).then(
                        function () {

                            deferred.resolve({extensions:arExtension,valueSets:arValueSet,quality:quality})
                        }
                    )

                } else {
                    deferred.resolve({})
                }


                return deferred.promise;
                //--------------------------------------------
                
                
                //look for coded data in an element definition
                function processCoded(url,ed) {
                    let deferred = $q.defer();
                    let item = {url:url,ed:ed};
                    if (! ed.binding) {
                        //quality.arCoded.push({display:ed.path + ' has no binding'})
                        quality.arCoded.push({type:'noBinding',display:'The path ' + ed.path + ' has a coded type, but no ValueSet binding',ed:ed})
                        item.note = "There was no binding";
                        deferred.resolve();
                        return;
                    }

                    item.valueSetUrl=ed.binding.valueSet;
                    item.strength= ed.binding.strength;

                    if (ed.binding.valueSet) {
                        let ar = ed.binding.valueSet.split('|')

                        let url = termServerUrl + "ValueSet?url="+ar[0];
                        $http.get(url).then(
                            function (data) {
                                //will be a Bundle
                                if (data.data && data.data.entry && data.data.entry.length > 0) {
                                    let ValueSet = data.data.entry[0].resource;
                                    item.valueSet = ValueSet


                                    //get the codesystems in use by the ValueSet
                                    item.codeSystems = []
                                    let hash = {}
                                    if (ValueSet.compose && ValueSet.compose.include) {
                                        ValueSet.compose.include.forEach(function (inc) {
                                            let sys = inc.system;
                                            if (sys && !hash[sys]) {
                                                item.codeSystems.push(sys)
                                                hash[sys] = 'x'
                                            }
                                        });
                                    }

                                    if (data.data.entry.length > 1) {
                                        item.note = "There was more than one VS with this url on the term server"
                                    }
                                } else {
                                    //The VS was not found on the term server...
                                    quality.arCoded.push({type:'missingVS',display:'The valueSet ' + ar[0] + ' was not found on the Terminology server',ed:ed})
                                    item.note = "The VS was not found on the Terminology server"
                                }

                            },
                            function (err) {
                                console.log(err)
                            }
                        ).finally(function () {
                            arValueSet.push(item)
                            deferred.resolve();
                        })
                    } else {
                        //There is no valueSet
                        quality.arCoded.push({type:'noBinding',display:'The path ' + ed.path + ' has a coded type, but no ValueSet binding',ed:ed})
                        item.note = "There was no ValueSet in the binding";
                        deferred.resolve();
                    }

                    return deferred.promise;
                    
                }

                function lookForExtensions(art){
                    let deferred = $q.defer();

                    let url = art.reference.reference;  //the reference to to the LM

                    getResourceAsync(url).then(
                        function(SD) {
                            let currentItem = {}
                            SD.snapshot.element.forEach(function (ed) {
                                //look for extension mapping...
                                if (ed.mapping) {
                                    ed.mapping.forEach(function (map) {
                                        if (map.identity == 'fhir' && map.map.indexOf('xtension')>-1) {
                                            //this is mapped to an extension

                                            let item = {url:url,ed:ed,elements:[]};
                                            let arExt = getExtension(ed,extExtensionUrl);

                                            if (arExt.length > 0) {
                                                item.extensionUrl = arExt[0].valueString;   //the url of the extension

                                                //If there's an FSH file, then it will be at the Binary endpoint with an id of extension-{id}
                                                //where id is the last element in the url
                                                let ar = item.extensionUrl.split('/');
                                                let id = ar[ar.length-1];
                                                let binUrl = serverUrl + "Binary/extension-"+id;
                                                $http.get(binUrl).then(
                                                    function(data) {
                                                        item.fsh = data.data;
                                                    },
                                                    function (err) {
                                                        item.fsh = "No FSH file found";
                                                        //quality.arModel.push({type:'noFSH',ed: {path:url},display:'The model has no FSH mapping - and therefore no profile'})
                                                    }
                                                )
                                            }

                                            //add the element details unless a backbone element
                                            if (ed.type && ed.type.length > 0) {
                                                if (ed.type[0].code !== 'BackboneElement') {
                                                    let elementName = $filter('getLastInPath')(ed.path);
                                                    let elementType = ed.type[0].code

                                                    //console.log(elementType);

                                                    if (elementType == 'CodeableConcept') {

                                                       // processCoded("urlhere",ed)
                                                    }


                                                    item.elements.push({name:elementName,type:elementType,short:ed.short});
                                                }





                                            }

                                            if (map.map.indexOf('odifierExtension')>-1) {
                                                item.isModifier=true;
                                            }



                                            arExtension.push(item);

                                            //see if the extension definition is on the conformance server...
                                            if (item.extensionUrl) {
                                                getConformanceResourceByCanUrl(item.extensionUrl).then(
                                                    function(){
                                                        //do nothing - the conformance resource was retrieved and is in the cache...



                                                    }, function() {
                                                        //the resource was not found...
                                                        quality.arExtension.push({type:'noDefFound',display:'The path ' + ed.path + ' is an extension, but the definition (SD) is not on the Conformance server',ed:ed})

                                                    }
                                                );
                                            } else {
                                                quality.arExtension.push({type:'noDefInModel',display:'The path ' + ed.path + ' is an extension, but there is no binding to a Definition',ed:ed})

                                            }




                                            currentItem = item;
                                        } else {
                                            //this was not an extesnion...

                                           // lastElementWasExtension = false;
                                        }

                                        //now look for children
                                        if (map.identity == 'fhir' && map.map.indexOf('#')>-1) {
                                            //this is a child element of the extension
                                            if (ed.type && ed.type.length > 0) {
                                                let elementName = $filter('getLastInPath')(ed.path);
                                                let elementType = ed.type[0].code
                                                currentItem.elements.push({name:elementName,type:elementType,short:ed.short});

                                            }

                                        }

                                    })
                                }
                                //now for any bound ValueSets. Even if it is an extension, the logical model should still have the ValueSet binding...

                                if (ed.binding) {
                                    let item = {valueSet:ed.binding.valueSet,ed:ed}
                                    item.strength = ed.binding.strength;
                                    
                                }

                            });

                            deferred.resolve();

                        },
                        function (err) {
                            console.log(err)
                        }
                    );

                    return deferred.promise;
                }


            },

            getModelBaseType :function(SD) {

                let baseType = getExtension(SD,extModelBaseType)
                if (baseType && baseType.length > 0) {
                    return baseType[0].valueString
                }
            },

            getTasksForModel : function(treeData,modelCode){
                let deferred = $q.defer();
                let tasks = [];

                let hash = {};  //hash of current path to original path
                if (treeData) {
                    treeData.forEach(function(item){

                        let originalPath = item.data.idFromSD;
                        let currentPath = item.id;
                        hash[originalPath] = currentPath;
                    })
                }



                let url = serverUrl + "Task";    //from parent controller

                url += "?code="+taskCode.system +"|"+taskCode.code;
                url += "&focus=StructureDefinition/"+modelCode;


                performQueryFollowingPaging(url).then(
                    function(bundle) {
                        if (bundle && bundle.entry) {

                            bundle.entry.forEach(function (entry) {
                                let resource = entry.resource;      //the fhir Task

                                let pathExt = getExtension(resource,pathExtUrl)
                                if (pathExt && pathExt.length > 0) {
                                    let path = pathExt[0].valueString;
                                    let iTask = taskSvc.getInternalTaskFromResource(resource,4);
                                    iTask.currentPath = hash[iTask.path]
                                    tasks.push(iTask)


                                } else {
                                    console.log('Task #'+ resource.id + ' has no extension for the path')
                                }

                            });

                            deferred.resolve(tasks)

                        }


                    },function(err) {
                        console.log(err)
                        deferred.reject(err)
                    }
                );


                return deferred.promise;

            },

            getResource: function(artifact,asXml) {
                //get the resource references by the artifact

                let deferred = $q.defer();
                if (artifact.reference && artifact.reference.reference) {
                    let url = serverUrl + artifact.reference.reference;
                    if (asXml) {
                        url += '?_format=xml';
                    }
                    $http.get(url).then(
                        function(data) {
                            deferred.resolve(data.data)
                        }, function(err) {
                            deferred.reject();
                        }
                    )

                }
                return deferred.promise;

            },
            getSamples : function(igCode) {
                let fullUrl = "content/nhip/samples.json" ;
                return $http.get(fullUrl)
            },
            getIG : function(igCode) {
                //assume the IG is on the conformance server (serverUrl)
                let deferred = $q.defer();
                let fullUrl = serverUrl + "ImplementationGuide/" + igCode;
                let tabs = [];  //will return a set of tabs. These are the equivalent to the formal IG tool

                $http.get(fullUrl).then(
                    function (data) {
                        let IG = data.data;
                        if (! IG.definition) {
                            deferred.reject('No definition');
                            return;
                        }

                        //get the pages.
                        let queries = [];
                        if (IG.definition.page) {
                            let topPage = IG.definition.page

                            let firstTab = {title:topPage.title};
                            tabs.push(firstTab)
                            queries.push(getContentFile(firstTab,topPage.nameUrl));

                            if (topPage.page) {
                                topPage.page.forEach(function (page) {
                                    let tab = {title:page.title};
                                    tabs.push(tab)
                                    queries.push(getContentFile(tab,page.nameUrl));
                                })
                            }
                        }


                        let artifacts = {};
                        IG.definition.resource.forEach(function (res) {
                            if (res.reference && res.reference.reference) {


                                //get the moreinfo, if any
                                //todo - moreinfo is deprecated (I think) - but keep it as it does allow a reference to an external link so may be halpful
                                let moreInfo = getExtension(res, extIGMoreInfo);
                                moreInfo.forEach(function (ext) {
                                    let moreInfo = {};
                                    ext.extension.forEach(function (child) {
                                        switch (child.url) {
                                            case 'title' :
                                                moreInfo.title = child.valueString;
                                                break;
                                            case 'url' :
                                                moreInfo.url = child.valueUrl;
                                                break;
                                        }
                                    });
                                    res.moreInfo = res.moreInfo || []
                                    res.moreInfo.push(moreInfo)

                                });




                                //is there a canonical url set in the IG resource? If so, add it to the resource / artifact
                                //just to make it easier to get later
                                let canUrl = getExtension(res, extCanUrl);
                                if (canUrl.length > 0) {
                                    res.canUrl = canUrl[0].valueUrl;
                                }

                                //what short of entry is it in the IG - Logical, profile, valueset etc
                                let typ = getExtension(res, extIGEntryType);
                                //add the IG resource to the artifacts hash
                                if (typ && typ.length > 0) {
                                    let code = typ[0].valueCode;
                                    artifacts[code] = artifacts[code] || [];

                                    //if the entry has an extension that references an FSH file, then retrieve the FSH fiel and add to the entry
                                    var ext = getExtension(res,extFSHUrl);
                                    if (ext && ext.length > 0 && ext[0].valueString) {

                                        let url = serverUrl + "Binary/"+ext[0].valueString;
                                        $http.get(url).then(
                                            function(data) {
                                                res.fsh = data.data;     //for Binary, the content is directly returned
                                            },
                                            function(err) {
                                                console.log(err)
                                            }
                                        )
                                    }

                                    //-----
                                    //is there an extension for the profile that is derived from the LM?
                                    let prof = getExtension(res, extProfileForLM);
                                    if (prof && prof.length > 0) {
                                        res.profileForLM = prof[0].valueString;

                                    }

                                    //if there's a reference to a profile, then save it as a property of the item
                                    var ext = getExtension(res,extProfileForLM);
                                    if (ext && ext.length > 0 && ext[0].valueString) {
                                        res.profileId = ext[0].valueString;
                                    }



                                    artifacts[code].push(res)

                                } else {
                                    //this might be an example
                                    if (res.exampleBoolean || res.exampleCanonical) {
                                        artifacts.example = artifacts.example || []
                                        let ar = res.reference.reference.split('/');
                                        res.baseType = ar[0]
                                        res.fsh = "No FSH defined. This example was manually generated.";
                                        var ext = getExtension(res,extFSHUrl);
                                        if (ext && ext.length > 0 && ext[0].valueString) {
                                           // res.fsh = ext[0].valueString;


                                            let binUrl = serverUrl + "Binary/"+ext[0].valueString;
                                            $http.get(binUrl).then(
                                                function(data) {
                                                    res.fsh = data.data;

                                                },
                                                function (err) {
                                                    res.fsh = "No FSH file found";
                                                    //quality.arModel.push({type:'noFSH',ed: {path:url},display:'The model has no FSH mapping - and therefore no profile'})
                                                }
                                            )


                                            console.log(res.fsh)
                                        }


                                        artifacts.example.push(res)
                                    }
                                }
                            }
                        });

                        if (queries.length == 0) {
                            //if there are no pages, then can resolve...
                            deferred.resolve({artifacts:artifacts})
                        } else {
                            // ... Otherwise get all the pages into tabs...
                            $q.all(queries).then(
                                function(){
                                    deferred.resolve({artifacts:artifacts,tabs:tabs})
                                }
                            )
                        }

                    }
                );
                return deferred.promise;


                function getContentFile(tab,nameUrl) {
                    let url = "content/nhip/"+ nameUrl;
                    return $http.get(url).then(
                        function (data) {

                            tab.contents = data.data;


                        },
                        function(err) {
                            console.log(err)
                        }
                    )
                }



                }

        }
    }

);
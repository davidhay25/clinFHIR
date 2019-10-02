angular.module("sampleApp")

    .service('nhipSvc', function($q,$http,taskSvc,appConfigSvc) {

        let serverUrl = "http://home.clinfhir.com:8054/baseR4/";
        let termServerUrl = "https://ontoserver.csiro.au/stu3-latest/";


        let extIGEntryType = "http://clinfhir.com/StructureDefinition/igEntryType";
        let extIGMoreInfo = "http://clinfhir.com/StructureDefinition/igMoreInfo";
        let extModelBaseType = "http://clinfhir.com/fhir/StructureDefinition/baseTypeForModel";
        let extProfileForLM = "http://clinfhir.com/StructureDefinition/profileForLM";
        let extExtensionUrl = "http://clinfhir.com/fhir/StructureDefinition/simpleExtensionUrl";

        var pathExtUrl = appConfigSvc.config().standardExtensionUrl.path;


        //the code for tasks that correstond to notes against the model
        let taskCode =  {system:"http://loinc.org",code:"48767-8"};

        let cache = {};

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


        return {

            analyseIG : function(artifacts) {
                let deferred = $q.defer();
                let arWork = [];

                let arExtension = [], arValueSet=[];

                artifacts.logical.forEach(function (art) {
                    arWork.push(lookForExtensions(art)) //can do this in a single call as at most one HTTP call is needed

                    //now look for Valuesets. Need to do this here as there can be multiple per model
                    let url = art.reference.reference;
                    console.log(url)

                    getResourceAsync(url).then(
                        function(SD) {
                            //console.log(SD)
                            SD.snapshot.element.forEach(function (ed) {
                                if (ed.binding) {
                                    arWork.push(processCoded(url,ed));
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
                            deferred.resolve({extensions:arExtension,valueSets:arValueSet})
                        }
                    )

                } else {
                    deferred.resolve({})
                }


                return deferred.promise;
                //--------------------------------------------
                
                
                //look for coded data in an ed
                function processCoded(url,ed) {
                    let deferred = $q.defer();
                    let item = {url:url,ed:ed};
                    if (! ed.binding) {
                        item.note = "There was no binding";
                        deferred.resolve();
                        return;
                    }

                    item.valueSetUrl=ed.binding.valueSet
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
                                    if (data.data.entry.length > 1) {
                                        item.note = "There was more than one VS with this url on the term server"
                                    }
                                } else {
                                    //The VS was not found on the term server...
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
                        item.note = "There was no ValueSet in the binding";
                        deferred.resolve();
                    }






                    return deferred.promise;
                    
                }

                function lookForExtensions(art){
                    let deferred = $q.defer();

                    let url = art.reference.reference;

                    console.log(url)

                    getResourceAsync(url).then(
                        function(SD) {
                            //console.log(SD)
                            SD.snapshot.element.forEach(function (ed) {
                                //look for extension mapping...
                                if (ed.mapping) {
                                    ed.mapping.forEach(function (map) {
                                        if (map.identity == 'fhir' && map.map.indexOf('xtension')>-1) {
                                            //this is mapped to an extension
                                            //let ar = url.split('/')

                                            let item = {url:url,ed:ed};
                                            let arExt = getExtension(ed,extExtensionUrl);
                                            if (arExt.length > 0) {
                                                item.extensionUrl = arExt[0].valueString;
                                            }
                                            arExtension.push(item)
                                            //console.log(ed)
                                        }
                                    })
                                }
                                //now for any bound ValueSets. Even if it is an extension, the logical model should still have the ValueSet binding...
                                if (ed.binding) {
                                    let item = {valueSet:ed.binding.valueSet,ed:ed}
                                    item.strength = ed.binding.strength;
                                    
                                }



                            })

                            deferred.resolve();

                        },
                        function (err) {
                            console.log(err)
                        }
                    )






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
                        //console.log(item)
                        let originalPath = item.data.idFromSD;
                        let currentPath = item.id;
                        hash[originalPath] = currentPath;
                    })
                }

                //console.log('loading tasks for model...')

                let url = serverUrl + "Task";    //from parent controller

                url += "?code="+taskCode.system +"|"+taskCode.code;
                url += "&focus=StructureDefinition/"+modelCode;


                performQueryFollowingPaging(url).then(
                    function(bundle) {
                        if (bundle && bundle.entry) {
                            //console.log(bundle)
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
                            //console.log(tasks)
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
            getIG : function(igCode) {
                //assume the IG is on the conformance server (serverUrl)
                let deferred = $q.defer();
                let fullUrl = serverUrl + "ImplementationGuide/" + igCode;

               // let url = "http://home.clinfhir.com:8054/baseR4/ImplementationGuide/nhip";
                $http.get(fullUrl).then(
                    function (data) {
                        let IG = data.data;
                        let artifacts = {};
                        IG.definition.resource.forEach(function (res) {
                            if (res.reference && res.reference.reference) {


                                //get the moreinfo, if any
                                let moreInfo = getExtension(res, extIGMoreInfo);
                                //console.log(res,moreInfo);
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

                                //is there an extension for the profile that defines the LM?
                                let prof = getExtension(res, extProfileForLM);
                                if (prof && prof.length > 0) {
                                    res.profileForLM = prof[0].valueUrl;

                                }


                                let typ = getExtension(res, extIGEntryType);
                                if (typ && typ.length > 0) {
                                    let code = typ[0].valueCode;
                                    artifacts[code] = artifacts[code] || [];
                                    artifacts[code].push(res)
                                    //console.log(res)
                                } else {
                                    //this might be an extension
                                    if (res.exampleBoolean || res.exampleCanonical) {
                                        artifacts.example = artifacts.example || []
                                        let ar = res.reference.reference.split('/');
                                        res.baseType = ar[0]
                                        artifacts.example.push(res)


                                    }
                                }
                            }
                        });

                        deferred.resolve(artifacts)
                    }
                );
                return deferred.promise;
                }

        }
    }

);
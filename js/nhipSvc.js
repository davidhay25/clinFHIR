angular.module("sampleApp")

    .service('nhipSvc', function($q,$http,taskSvc,appConfigSvc) {

        let serverUrl = "http://home.clinfhir.com:8054/baseR4/";
        let extIGEntryType = "http://clinfhir.com/StructureDefinition/igEntryType";
        let extIGMoreInfo = "http://clinfhir.com/StructureDefinition/igMoreInfo"

        var pathExtUrl = appConfigSvc.config().standardExtensionUrl.path;


        //the code for tasks that correstond to notes against the model
        let taskCode =  {system:"http://loinc.org",code:"48767-8"}

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




        return {

            getTasksForModel : function(treeData,modelCode){
                let deferred = $q.defer();
                let tasks = []

                let hash = {};  //hash of current path to original path
                if (treeData) {
                    treeData.forEach(function(item){
                        //console.log(item)
                        let originalPath = item.data.idFromSD;
                        let currentPath = item.id;
                        hash[originalPath] = currentPath;
                    })
                }

                console.log('loading tasks for model...')

                let url = serverUrl + "Task";    //from parent controller

                url += "?code="+taskCode.system +"|"+taskCode.code;
                url += "&focus=StructureDefinition/"+modelCode;


                performQueryFollowingPaging(url).then(
                    function(bundle) {
                        if (bundle && bundle.entry) {
                            console.log(bundle)
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
                            console.log(tasks)
                            deferred.resolve(tasks)

                        }


                    },function(err) {
                        console.log(err)
                        deferred.reject(err)
                    }
                );


                return deferred.promise;

            },


            getResource: function(artifact) {
                //get the resource references by the artifact
                let deferred = $q.defer();
                if (artifact.reference && artifact.reference.reference) {
                    let url = serverUrl + artifact.reference.reference;
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

                            //get the moreinfo
                            let moreInfo = getExtension(res,extIGMoreInfo);
                            //console.log(res,moreInfo);
                            moreInfo.forEach(function (ext) {
                                let moreInfo = {};
                                ext.extension.forEach(function(child){
                                    switch (child.url) {
                                        case 'title' :
                                            moreInfo.title = child.valueString;
                                            break;
                                        case 'url' :
                                            moreInfo.url = child.valueUrl;
                                            break;
                                    }
                                })
                                res.moreInfo = res.moreInfo || []
                                res.moreInfo.push(moreInfo)

                            })

                            let typ = getExtension(res,extIGEntryType);
                            if (typ && typ.length > 0) {
                                let code = typ[0].valueCode;
                                artifacts[code] = artifacts[code] || [];
                                artifacts[code].push(res)
                                //console.log(res)
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


angular.module("sampleApp")
    //this returns config options. At the moment it is for servers...
    //also holds the current patient and all their resources...
    //note that the current profile is maintained by resourceCreatorSvc



    .service('bundleVisualizerSvc', function($http,$q) {

            let deepValidateMax = 30    //maximum number of resources allowed in deep validation

        return {
                makeGraph : function(bundle,options) {
                    let dummyBase = "http://dummybase/"
                    let hashByFullUrl = {}
                    //create a hash indexed on fullUrl. If there is no fullUrl, then create one using a dummy base
                    bundle.entry.forEach(function (entry){
                        let resource = entry.resource
                        let fullUrl = entry.fullUrl || dummyBase + resource.resourceType + "/" + resource.id
                        hashByFullUrl[fullUrl] = resource

                    })

                },
            deepValidation : function (bundle,serverUrl) {
                //performs a validation by copying all the bundle contents to a server, then using $validate against Bundle
                //each resource must have an id
                //returns an OO
                let deferred = $q.defer();
                let arQuery = [];
                let arResult = [];
                let OOerrors = {issue:[]}

                if (!bundle.entry ||  bundle.entry.length > deepValidateMax) {
                    OOerrors.issue.push({diagnostics:"The bundle must have a maximum number of " + deepValidateMax + " entries."})
                    deferred.reject(OOerrors)
                    return
                }

                //save each resource to the validation server, using minimal validation
                bundle.entry.forEach(function (entry,inx) {
                    if (entry.resource) {
                        let resource = entry.resource;
                        if (resource.id) {
                            arQuery.push(saveResource(serverUrl,resource))
                        } else {
                            OOerrors.issue.push({diagnostics:"The resource at entry #" + inx + " does not have an id"})
                        }

                    } else {
                        OOerrors.issue.push({diagnostics:"entry #" + inx + " has no resource"})
                    }
                });

                if (OOerrors.issue.length > 0) {
                    deferred.reject(OOerrors)
                    return
                }


                $q.all(arQuery).then(
                    function(data){
                        //all of the resources saved correctly. Now invoke the Bundle validate
                        console.log(data)
                        let validateUrl = serverUrl + "/Bundle/$validate"
                        //now we can POST the bundle
                        $http.post(validateUrl,bundle).then(
                            function(data) {
                                deferred.resolve(data.data)
                            }, function(err) {
                                deferred.reject(err.data)
                            }
                        )

                    },function(err) {
                        //some of the resources were not saved
                        console.log(err)
                        deferred.reject(err)
                    }
                );

                return deferred.promise


                function saveResource(serverUrl,resource) {
                    let deferred1 = $q.defer();
                    let url = serverUrl + resource.resourceType + "/" + resource.id
                    console.log(url)
                    $http.put(url,resource).then(
                        function(data) {
                            deferred1.resolve(data.data)
                        },
                        function(err) {
                            deferred1.reject(err.data)
                        }
                    )

                    return deferred1.promise

                }


            },
            performQueryFollowingPaging : function(url,limit,accessToken){
                //Get all the resurces specified by a query, following any paging...
                //http://stackoverflow.com/questions/28549164/how-can-i-do-pagination-with-bluebird-promises

                let config = {}
                if (accessToken) {
                    config.headers = {Authorization:"Bearer " + accessToken}
                }

                var returnBundle = {resourceType:'Bundle',total:0,type:'searchset',link:[],entry:[]};
                returnBundle.link.push({relation:'self',url:url})

                //add the count parameter
                if (url.indexOf('?') > -1) {
                    url += "&_count=100"
                } else {
                    url += "?_count=100"
                }


                var deferred = $q.defer();

                limit = limit || 100;



                getPage(url);

                //get a single page of data
                function getPage(url) {
                    return $http.get(url,config).then(
                        function(data) {
                            var bundle = data.data;     //the response is a bundle...

                            //added May 2019 - check for when the response is not a query...
                            if (bundle && bundle.resourceType !== 'Bundle') {
                                deferred.resolve(bundle);       //isn't really a bundle...
                                return;
                            }

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
        }
    }
    )


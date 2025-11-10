
angular.module("sampleApp")

    .service('projectSvc', function($q,$http,$localStorage) {




        return {

            //save a resource to a SMART protected server - get a refresh token if forbidden. Only try once.
            smartPut : function (url,resource) {
                console.log('smartPut')
                var deferred = $q.defer();
                $http.put(url,resource).then(
                    function(data) {
                        //all good - the PUT succeeded - return
                        deferred.resolve(data);
                    }, function(err) {
                        if (err.status == 401) {
                            //this is forbidden. Try to get a refresh token...
                            console.log('getting new auth token...')
                            return $http.get('/refresh').then(
                                function(data) {
                                    //we were able to refresh. The new auth token will be in data.data.accessToken;
                                    console.log(data);
                                    //save the new token...
                                    $http.defaults.headers.common.Authorization = 'Bearer '+ data.data.accessToken;
                                    $localStorage.cfAt = data.data.accessToken;
                                    //... and retry the Put
                                    $http.put(url,resource).then(
                                        function(data) {
                                            //success! return...
                                            deferred.resolve(data)
                                        },
                                        function(err) {
                                            //error - we only try once - return
                                            deferred.reject()
                                        }
                                    )

                                },
                                function(err) {
                                    console.log(err)
                                    deferred.reject();
                                }
                            );
                        } else {
                            //some other error. reject...
                            deferred.reject(err)
                        }

                    }
                );

                return deferred.promise;
            },

            //issue a get request to a SMART protected server
            smartGet : function (url) {
                console.log('smartGet')
                var deferred = $q.defer();
                $http.get(url).then(
                    function(data) {
                        //all good - the GET succeeded - return
                        deferred.resolve(data);
                    }, function(err) {
                        if (err.status == 401) {
                            //this is forbidden. Try to get a refresh token...
                            console.log('getting new auth token...')
                            return $http.get('/refresh').then(
                                function(data) {
                                    //we were able to refresh. The new auth token will be in data.data.accessToken;
                                    console.log(data);
                                    //save the new token...
                                    $http.defaults.headers.common.Authorization = 'Bearer '+ data.data.accessToken;
                                    $localStorage.cfAt = data.data.accessToken;
                                    //... and retry the Get
                                    $http.get(url).then(
                                        function(data) {
                                            //success! return...
                                            deferred.resolve(data)
                                        },
                                        function(err) {
                                            //error - we only try once - return
                                            deferred.reject()
                                        }
                                    )

                                },
                                function(err) {
                                    console.log(err)
                                    deferred.reject();
                                }
                            );
                        } else {
                            //some other error. reject...
                            deferred.reject(err)
                        }

                    }
                );

                return deferred.promise;
            },



            smartGetFollowingPaging : function (url) {
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

                                        //todo - this is a real hack as the NZ server is not setting the paging correctly...

                                        url = url.replace('http://127.0.0.1:8080/baseDstu2','http://fhir.hl7.org.nz/baseDstu2')




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




            },
            refreshDEP : function () {
                console.log('refresh')

                var deferred = $q.defer();
                return $http.get('/refresh').then(
                    function(data) {
                        console.log(data);
                        $http.defaults.headers.common.Authorization = 'Bearer '+ data.data.accessToken;
                        $localStorage.cfAt = data.data.accessToken;
                        deferred.resolve()
                    },
                    function(err) {
                        console.log(err)
                        deferred.reject();
                    }
                );




                return deferred.promise;
            }
        }

    });

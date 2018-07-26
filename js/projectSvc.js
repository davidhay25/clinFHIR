
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

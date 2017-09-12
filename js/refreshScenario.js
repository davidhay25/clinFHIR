
angular.module("sampleApp")
    .controller('refreshScenarioCtrl',
        function ($scope,$http,appConfigSvc,$q,container) {
            //var deferred = $q.defer();

            function makeKey(resource) {
                return resource.resourceType+'/'+resource.id;
            }
            $scope.bundle = container.bundle;       //the current bundle...

            //todo - check that the data server is the same as the container...

            $scope.update = function(){
                $scope.report = {updated:0}
                var latestResource = [];     //the latest version of each resource, indexed by
                var arQuery = [];
                //retrieve the latest version of each resource in the bundle from the server. This has to be a POST to avoid caching...
                $scope.bundle.entry.forEach(function (entry) {
                    var resource = entry.resource;
                    entry.outcome='checking...'
                    var url = appConfigSvc.getCurrentDataServer().url + resource.resourceType + '/_search?_id='+ resource.id;
                    var config = {headers : {
                        'content-type':'application/fhir+json'
                    }};
                    arQuery.push(
                        $http.post(url,resource,config).then(
                            function(data){
                                var bundle = data.data;
                                if (bundle && bundle.entry && bundle.entry.length ==1) {
                                    entry.resource = bundle.entry[0].resource;
                                    console.log('updated '+ entry.resource.resourceType + '/_search?_id='+ entry.resource.id)
                                    $scope.report.updated++
                                    entry.outcome='Updated'
                                } else {
                                    entry.outcome='Ignored'
                                }
                            },
                            function(err) {
                                console.log(err)
                            }
                        )
                    );

                });

                $q.all(arQuery).then(
                    function() {
                        //now download the bundle and see if there are any new resources (could lood for deletions too is needed)
                        //not that can't just update from the bundle, as the resources may have changed independantly of the scenario...
                        $scope.state='done'

                        return;

                        //a bug in hapi...

                        var url = appConfigSvc.getCurrentDataServer().url + '/Bundle/_search?_id='+ $scope.bundle.id;
                        $http.post(url,{},config).then(
                            function(data){
                                var srchBundle = data.data;
                                if (srchBundle && srchBundle.entry && srchBundle.entry.length ==1) {

                                    var serverBundle = srchBundle.entry[0].resource;  //the latest bundle
                                    //make a hash of the current contents of the bundle...
                                    var hash = {}
                                    _.each($scope.bundle.entry,function(entry){
                                        var resource=entry.resource;
                                        hash[makeKey(entry.resource)] = resource
                                    })

                                    //now iterate through the bundle, adding any new ones...
                                    serverBundle.entry.forEach(function (entry1) {
                                        var key = makeKey(entry1.resource);
                                        if (! hash[key]) {
                                            entry1.outcome='Added'
                                            $scope.bundle.entry.push(entry1)
                                        }
                                    });



                                    console.log('updated '+ entry.resource.resourceType + '/_search?_id='+ entry.resource.id)

                                } else {

                                }
                            },
                            function(err) {
                                console.log(err)
                            }
                        ).finally(function () {
                            $scope.state='done'
                        })


                    },function (err) {
                        alert('There was an error: ' + angular.toJson(err));
                        $scope.close()

                    }
                );


            }

            $scope.close = function(){
                $scope.bundle.entry.forEach(function (entry,index) {
                    delete entry.outcome;       //don't want it polluting the bundle...
                })
                $scope.$close()
            }


    })

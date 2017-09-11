
angular.module("sampleApp")
    .controller('refreshScenarioCtrl',
        function ($scope,$http,appConfigSvc,$q,container) {
            //var deferred = $q.defer();
            $scope.bundle = container.bundle;       //the current bundle...

            //todo - check that the data server is the same as the container...

            $scope.update = function(){
                $scope.report = {updated:0}
                var latestResource = [];     //the latest version of each resource, indexed by
                var arQuery = [];
                //retrieve the latest version of each resource in the bundle from the server. This has to be a POST to avoid caching...
                $scope.bundle.entry.forEach(function (entry,index) {
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

                        //$scope.$close()
                        $scope.state='done'

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

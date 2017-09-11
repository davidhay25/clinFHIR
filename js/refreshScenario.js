
angular.module("sampleApp")
    .controller('refreshScenarioCtrl',
        function ($scope,$http,appConfigSvc,$q,container) {
            $scope.bundle = container.bundle;

            //todo - check that the data server is the same as the container...

            $scope.update = function(){
                $scope.bundle.entry.forEach(function (entry) {
                    var resource = entry.resource;
                    var url = appConfigSvc.getCurrentDataServer().url + resource.resourceType + '/'+ resource.id
                    console.log(url);



                })
            }


    })

/*has been deprectde - don't call make function - expensive! */

angular.module("sampleApp")
    .controller('setServersCtrl',
        function ($scope,appConfigSvc) {

            $scope.allServers = appConfigSvc.getAllServers()
            $scope.input = {}

            $scope.input.dataServer = setCurrent(appConfigSvc.getCurrentDataServer());
            $scope.input.confServer = setCurrent(appConfigSvc.getCurrentConformanceServer());
            $scope.input.termServer = setCurrent(appConfigSvc.getCurrentTerminologyServer());

            console.log($scope.allServers)

            $scope.save = function(){
                console.log($scope.input)
                appConfigSvc.setServerType('data',$scope.input.dataServer.url);
                appConfigSvc.setServerType('conformance',$scope.input.confServer.url);
                appConfigSvc.setServerType('terminology',$scope.input.termServer.url);
                $scope.$close()
            }

            function setCurrent(svr){
                var sel = {}
                $scope.allServers.forEach(function(s){
                    if (svr.url == s.url) {
                        sel = s
                    }
                })
                return sel;
            }

    });
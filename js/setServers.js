/*has been deprectde - don't call make function - expensive! */

angular.module("sampleApp")
    .controller('setServersCtrl',
        function ($scope,appConfigSvc) {

            $scope.allServers = appConfigSvc.getAllServers();
            $scope.terminologyServers = appConfigSvc.getAllTerminologyServers();

            $scope.input = {}



            function showConfig(){
                $scope.input.dataServer = setCurrent(appConfigSvc.getCurrentDataServer());
                $scope.input.confServer = setCurrent(appConfigSvc.getCurrentConformanceServer());
                $scope.input.termServer = setCurrent(appConfigSvc.getCurrentTerminologyServer());
            }
            showConfig();

            //when the user selects the 'default' option from the launcher...
            $scope.$on('setDefault',function(){
                showConfig();
            })

            //console.log($scope.allServers)

            $scope.save = function(){
                //console.log($scope.input)
                appConfigSvc.setServerType('data',$scope.input.dataServer.url);
                appConfigSvc.setServerType('conformance',$scope.input.confServer.url);
                appConfigSvc.setServerType('terminology',$scope.input.termServer.url);

                //$close only exists when being called as a dialog. This controller is also used from the launcher...
                if ($scope.$close) {
                    $scope.$close()
                } else {
                    $scope.$emit('serverUpdate')
                }

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
angular.module("sampleApp")
    .controller('setServerCtrl',
        function ($scope,$http,appConfigSvc,type) {
            $scope.allServers = appConfigSvc.getAllServers(4)
            $scope.input = {}

            //when a pre-defined server is selected
            $scope.selectServer = function(row){
                appConfigSvc.setServerType(type,row.url)
                $scope.$close()
            }

            $scope.test = function() {
                //only shown if $scope.input.url populated
                if ($scope.input.url.substr($scope.input.url.length-1) !== '/') {
                    $scope.input.url = $scope.input.url + '/'
                }

                let url = $scope.input.url + "metadata"
                $scope.waiting = true
                $http.get(url).then(
                    function(data) {
                        //returned the capability statement
                        $scope.cs = data.data;
                        $scope.input.valid = true;
                    }, function (err) {
                        alert("Unable to retrieve CapabilityStatement")
                    }
                ).finally(
                    function (){
                        $scope.waiting = false
                    }
                )
            }

            $scope.addServer = function() {
                let name = $scope.input.name || "Not named"
                let svr = {"name":name,url:$scope.input.url, version:4}
                svr.everything = $scope.input.everything;
                appConfigSvc.addServer(svr)
                appConfigSvc.setServerType(type,$scope.input.url)
                $scope.$close()

            }

        })
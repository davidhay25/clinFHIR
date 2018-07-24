
angular.module("sampleApp")
    .controller('projectCtrl',
        function ($scope,$localStorage,$http,$window) {
            $scope.iframeUrl = ""

            $scope.login = function () {
                $http.get('/init').then(
                    function (data) {
                        console.log(data.data)

                        $window.location.href = "/auth?scope=Patient/*" ;


                    }, function (err) {
                        console.log(err)
                    }
                )
            }




    });

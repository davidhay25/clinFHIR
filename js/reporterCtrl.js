/*has been deprectde - don't call make function - expensive! */

angular.module("sampleApp")
    .controller('reporterCtrl',
        function ($scope,$http) {


        var url = '/errorReport';
        $http.get(url).then(
            function(data) {
                console.log(data.data);
                $scope.errors = data.data;
            }
        );

        $scope.errorSelected = function(err) {
            $scope.selectedError = err;
            $scope.selectedErrorMeta = angular.copy(err);
            delete $scope.selectedErrorMeta.resource;
            delete $scope.selectedErrorMeta.oo;
        }

    });
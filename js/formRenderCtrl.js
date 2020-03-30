angular.module("sampleApp")
    .controller('formRenderCtrl', function ($scope) {

        $scope.dateHash = {}
        $scope.popup1 = {
            opened: false
        };

        $scope.open = function(id) {
            $scope.dateHash[id] = $scope.dateHash[id] || {}
            $scope.dateHash[id].opened = true
        };

        $scope.change = function () {
            console.log($scope.input.form)
        }
    }
);
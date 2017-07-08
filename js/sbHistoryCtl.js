
angular.module("sampleApp")
    .controller('sbHistoryCtrl',
        function ($scope) {

            $scope.selectItem = function(item) {
                $scope.selectedItem = item
            }
    })

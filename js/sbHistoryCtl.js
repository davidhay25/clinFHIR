
angular.module("sampleApp")
    .controller('sbHistoryCtrl',
        function ($scope) {

            $scope.selectItem = function(item) {
                $scope.selectedItem = item
                console.log(item.details.value)
                $scope.selectedItemValue = item.details.value;
            }
    })

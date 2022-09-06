angular.module("sampleApp")
    .controller('terminologyExplorerCtrl',
        function ($scope) {

            $scope.selectSystem = function(system) {
                $scope.selectedTerminologySummary =$scope.terminologySummary[system]
                    let resources = $scope.terminologySummary[system]

            }

            $scope.selectResource = function(resource) {
                $scope.selectedTermResource = resource
            }


            $scope.selectItem = function (item) {
                $scope.selectedItem = item
            }
        })

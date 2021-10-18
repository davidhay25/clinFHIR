
angular.module("sampleApp")
    .controller('q-editVSCtrl',
        function ($scope,VS) {
            $scope.input = {}
            $scope.currentVS = VS  //not null if editing


            if ($scope.currentVS) {
                $scope.VS = angular.copy($scope.currentVS)
            } else {
                $scope.VS = {concepts:[]}
            }

            $scope.addConcept = function () {
                let concept = {code:$scope.input.code,display:$scope.input.display,  system:$scope.input.system}
                $scope.VS.concepts.push(concept)
                //don't clear system
                delete $scope.input.code
                delete $scope.input.display
            }

            $scope.deleteConcept = function (inx) {

            }

            $scope.close = function(){
                $scope.VS.name = $scope.input.name
                $scope.$close( $scope.VS)
            }

    })

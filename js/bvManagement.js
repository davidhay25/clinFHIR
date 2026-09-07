angular.module("sampleApp")
    .controller('bvManangementCtrl',
        function ($scope,$http,$timeout,$localStorage,$uibModal) {

            $scope.applyBundle = function () {
                let bundle = $scope.fhir
                console.log(bundle)
                if (confirm('Are you sure you wish to save the contents of this bundle to the local FHIR server')) {
                    $http.post("bv/applyBundleToServer",bundle).then(
                        function (data) {
                            $scope.response = data.data
                        }, function (err) {
                            $scope.response = err.data
                        }
                    )

                }
            }

        }
    )

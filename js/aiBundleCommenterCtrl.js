angular.module("sampleApp")
    .controller('aiBundleCommenterCtrl',
        function ($scope,$http,$timeout,ooCompressService) {

            $scope.input = {}

            //$scope.fhir - the bundle
            //$scope.OO - the latest OO

            //roles get added to system prompt
            $scope.role = []
            $scope.role.push({role:'author', display:"Bundle Author"})
            $scope.role.push({role:'consumer', display:"Bundle Consumer"})
            $scope.selectedRole = $scope.role[0]

            //

            $scope.getAdvice = function () {
                let bundle = compressBundle(true)

                let text = ooCompressService.compress($scope.validationOO);
                let text2 = ooCompressService.compress(oo, {includeInformation: false});

                console.log(text2)
            }




            //remove unneeded (for AI) parts of bundle
            function compressBundle(stripText) {
                let aiBundle = angular.copy($scope.fhir)

                for (let entry of aiBundle.entry || []) {
                    delete entry.resource.meta
                    if (stripText) {
                        delete entry.text
                    }
                }

                return angular.toJson(aiBundle)

            }

        })

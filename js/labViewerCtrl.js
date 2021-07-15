angular.module("sampleApp")
    .controller('labViewerCtrl',
        function ($scope,$http) {

            $scope.input = {}

            let nhiSystem = "https://standards.digital.health.nz/ns/nhi-id"
            $scope.input.nhi = "abc1234"



            $scope.input.server = "http://home.clinfhir.com:8054/baseR4/"

            $scope.input.arResourceType = ['DiagnosticReport','Observation']
            $scope.input.selectedType = $scope.input.arResourceType[0]


            $scope.execute = function () {
                delete $scope.response
                delete $scope.error
                let query = $scope.input.server + $scope.input.selectedType
                query += "?patient.identifier="+nhiSystem + '|' + $scope.input.nhi
                if ($scope.input.qry) {
                    query += "&" + $scope.input.qry;

                }
                $scope.fullQuery = query;

                $http.get(query).then(
                    function (data) {
                        $scope.response = data.data;
                    }, function (err) {
                        $scope.error = err.data
                    }
                )

            }




        }
    )
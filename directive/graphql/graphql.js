angular.module('sampleApp')
    .directive('graphql', function () {
        return {
            restrict: 'EA', //E = element, A = attribute, C = class, M = comment
            scope: {
                //@ reads the attribute value, = provides two-way binding, & works with functions
                resource: '='
            },

            templateUrl: 'directive/graphql/graphql.html',
            controller: function($scope,$http,appConfigSvc){

                $scope.input = {};

                $scope.input.gql = " {name { text given family } gender birthDate }";

                $scope.$watch(
                    function() {return $scope.resource},
                    function() {
                        console.log($scope.resource)
                        if ($scope.resource) {
                            //assume this is a Patient

                            //$scope.serverBase= "http://test.fhir.org/r3/" + $scope.resource.resourceType + "/" + $scope.resource.id;
                            $scope.serverBase= appConfigSvc.getCurrentDataServer().url + $scope.resource.resourceType + "/" + $scope.resource.id;
                            $scope.serverBase += "/$graphql?query=";

                        }


                        delete $scope.gqlResult;
                        //delete $scope.input.gql;

                    }
                );

                $scope.executeGQL = function(path) {
                    delete $scope.gqlResult;
                    delete $scope.gqlError

                    var url = $scope.serverBase + $scope.input.gql;

                    $http.get(url).then(
                        function(data) {
                            //console.log(data.data)
                            $scope.gqlResult = data.data;
                        },
                        function (err){
                            $scope.gqlError = err;
                            console.log(err)
                        }
                    );

                }
            }
        }
    });
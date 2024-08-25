angular.module('sampleApp')
    .directive('fhirpath', function () {
        return {
            restrict: 'EA', //E = element, A = attribute, C = class, M = comment
            scope: {
                //@ reads the attribute value, = provides two-way binding, & works with functions
                resource: '=',
                selectItem : '&',
                showEDE : '&',
                selectExtensionFromProfileE : '&',
                showValueSetE : '&'
            },

            templateUrl: 'directive/fhirpath/fhirpath.html',
            controller: function($scope,$http){

                $scope.input = {};

                $scope.$watch(
                    function() {return $scope.resource},
                    function() {

                        delete $scope.FHIRPathResult;
                        delete $scope.input.JSONPath;
                    }
                );

                $scope.executeJSONPath = function(path) {
                    delete $scope.FHIRPathResult;
                    delete $scope.FHIRPathError;
                    try {



                        $scope.FHIRPathResult = fhirpath.evaluate($scope.resource, path,null,fhirpath_r4_model);
                       // $scope.FHIRPathResult = fhirpath.evaluate($scope.resource, path);
                    } catch (ex) {
                        $scope.FHIRPathError = ex.message;
                    }

/*
 var url = "clinFHIR/executeFP";
                    var data = {path:path,resource:$scope.resource}

                    $http.post(url,data).then(
                        function(data) {
                            //console.log(data.data)
                            $scope.FHIRPathResult = data.data;
                        },
                        function (err){
                            console.log(err)
                        }
                    );

*/
                }
            }
        }
    });
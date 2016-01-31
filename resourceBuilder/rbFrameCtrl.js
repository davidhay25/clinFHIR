angular.module("sampleApp").controller('rbFrameCtrl', function ($rootScope, $scope,$http,supportSvc,resourceSvc) {

    var serverBase = "http://fhir.hl7.org.nz/dstu2/"

    $scope = {dynamic : {}}

    var url = serverBase + "StructureDefinition/Basic";
    $http.get(url).then(
        function(data) {
            $scope.dynamic.profile = angular.copy(data.data);
            console.log(data.data)
        },
        function(err) {
            console.log(err);
        }
    )




})
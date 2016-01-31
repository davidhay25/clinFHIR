angular.module("sampleApp").controller('rbFrameCtrl', function ( $scope,$http) {
    //controller for the rbFrame page that holds the resource builder - renderProfile.js

    var serverBase = "http://fhir.hl7.org.nz/dstu2/"

    //the 'dynamic' property is used to communicate with the profile-form directive...
    $scope.dynamic  =  {};
    $scope.dynamic.updated =function(){
        //called when a new element is added to a resource...
        console.log('updated called')
        $scope.dirty = true;
    };



    var url = serverBase + "StructureDefinition/Condition";
    $http.get(url).then(
        function(data) {
            $scope.dynamic.profile = angular.copy(data.data);
           // console.log(data.data)
        },
        function(err) {
            console.log(err);
        }
    )




});
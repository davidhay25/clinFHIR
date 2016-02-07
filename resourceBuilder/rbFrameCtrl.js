angular.module("sampleApp").controller('rbFrameCtrl', function ($rootScope, $scope,$http,RenderProfileSvc,appConfig) {
    //controller for the rbFrame page that holds the resource builder - renderProfile.js

    //var serverBase = "http://fhir.hl7.org.nz/dstu2/";
    var config = appConfig.config();

    //get all the standard resource types - the one defined in the fhor spec...
    RenderProfileSvc.getAllStandardResourceTypes().then(
        function(standardResourceTypes) {
            $scope.standardResourceTypes = standardResourceTypes ;

        }
    );

    //generate the display in the standard resource type selection combo...
    $scope.standardResourceDisplay=function(item) {
        var display = item.name;
        if (item.reference) {
            display += " (reference)";
        }
        return display;
    };

    $scope.resourceTypeSelected = function(type) {
        //when a standard resource is selected from the list
        var url = config.servers.conformance + "StructureDefinition/"+type;
        $http.get(url).then(
            function(data) {
                $scope.dynamic.profile = angular.copy(data.data);
                // console.log(data.data)
            },
            function(err) {
                console.log(err);
            }
        )
    };

    //==========================================
    //the 'dynamic' property is used to communicate with the profile-form directive which actually generates the form...
    $scope.dynamic  =  {};
    $scope.dynamic.updated =function(){
        //called when a new element is added to a resource...
        console.log('updated called')
        $scope.dirty = true;
    };
    //the user is used if a message is send from the builder.
    $scope.dynamic.user = {};

    $scope.dynamic.parkResource = function(){
        alert('Park functionality not enabled yet')
    };
    $scope.dynamic.loadAllData = function(id) {

    };
    $scope.dynamic.updated = function(id) {
        //called after a resource has been saved

    };
    $scope.dynamic.selectProfile = function(id) {
        alert('selecting a profile not enabled')

    };


    //--------------------------------------------------

    //a watcher for when the current patient is changed in the sample controller. There are likely more elegant ways of doing this like a common service...
    //note that the assumption is that allresources is set before currentPatient
    $scope.$watch(
        function() {return $rootScope.currentPatient},
        function() {

            $scope.dynamic.allResources = $rootScope.allResources;
            $scope.dynamic.currentPatient = $rootScope.currentPatient;

        }
    );





    $scope.resourceTypeSelected('Basic');

/*
    var url = config.servers.conformance + "StructureDefinition/Basic";
    $http.get(url).then(
        function(data) {
            $scope.dynamic.profile = angular.copy(data.data);
           // console.log(data.data)
        },
        function(err) {
            console.log(err);
        }
    )
    */



});
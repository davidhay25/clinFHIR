angular.module("sampleApp")
    .controller('compartmentCtrl',
        function ($scope,$q,$http) {
            $scope.compartments = []

            let carePlanCompartment = {resourceType:"CompartmentDefinition"}
            carePlanCompartment.url = "http://clinfhir/com/carePlanCompartment"
            carePlanCompartment.name = "A compartment to return all resources directly referenced by a CarePlan"



        })
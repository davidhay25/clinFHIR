angular.module("sampleApp")
    .controller('labViewerCtrl',
        function ($scope,$http) {


            $scope.input = {}
            $http.get("https://r4.ontoserver.csiro.au/fhir/ConceptMap/ClinFHIRLabToNZPOC").then(
                function(data) {
                    let conceptMap = data.data
                    let hash = {}   //will hold the translated code from bespoke lab to NZPOC
                    //iterate through the groups & elements to create the hash. No error checking performed.
                    conceptMap.group.forEach(function(group){
                        if (group.source == 'http://clinfhir.com/ns/clinFHIRLab' &&
                            group.target == 'http://loinc.org') {
                                group.element.forEach(function (element) {
                                    hash[element.code] = element.target[0].code
                                })
                        }
                    })
                    console.log(hash['glu'])    //should output 15075-8
                }
            )


        }
    )
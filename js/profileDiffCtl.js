
angular.module("sampleApp")
    .controller('profileDiffCtrl',
        function ($scope,$http,profileDiffSvc,$uibModal) {




            $scope.pairs = []      //the pairs of profiles to compare. move to a file...
            $scope.pairs.push({name:"Patient",
                primary:{display:"Orion Patient",url:"http://fhir.hl7.org.nz/baseDstu2/StructureDefinition/OhPatient-cf-profile"}
                ,secondary:{display:"Argonaut Patient",url:"http://fhir.hl7.org.nz/dstu2/StructureDefinition/argo-patient"}})


            $scope.pairs.push({name:"Allergy",
                primary:{display:"Orion Allergy",url:"http://fhir.hl7.org.nz/baseDstu2/StructureDefinition/OhAllergy-cf-profile"}
                ,secondary:{display:"Argonaut Allergy",url:"http://fhir.hl7.org.nz/dstu2/StructureDefinition/argo-allergyintolerance"}})



            $scope.showED = function(ed) {
                //console.log(ed)
                $uibModal.open({
                    templateUrl: 'modalTemplates/diffED.html',
                    // size: 'sm',
                    controller: function($scope,ed){
                        $scope.ed = ed;
                        console.log($scope.ed)
                    },
                    resolve : {
                        ed: function () {          //the default config
                            return ed;
                        }
                    }
                })
            };

            $scope.loadPair = function(name) {


                var pair;
                $scope.pairs.forEach(function(p){
                    if (p.name == name) {
                        loadPair(p)
                    }
                })


            }

/*
            //load all the current tasks on the data server
            var qry = "http://fhir.hl7.org.nz/baseDstu2/StructureDefinition/OhPatient-cf-profile";
            $http.get(qry).then(
                function(data){
                    console.log(data)
                    $scope.primary = {json: data.data};
                    $scope.primary.cannonical = profileDiffSvc.makeCannonicalObj($scope.primary.json)
                    $scope.primary.display = "Orion Patient"
                    console.log($scope.primary)
                }
            );

            var qry = "http://fhir.hl7.org.nz/dstu2/StructureDefinition/argo-patient";
            $http.get(qry).then(
                function(data){
                    console.log(data)
                    $scope.secondary = {json:data.data};
                    $scope.secondary.cannonical = profileDiffSvc.makeCannonicalObj($scope.secondary.json)
                    $scope.secondary.display = "Argonaut Patient"
                }
            )

            */

        function loadPair(pair) {
            //load all the current tasks on the data server
            //var qry = "http://fhir.hl7.org.nz/baseDstu2/StructureDefinition/OhPatient-cf-profile";
            $http.get(pair.primary.url).then(
                function(data){
                    console.log(data)
                    $scope.primary = {json: data.data};
                    $scope.primary.cannonical = profileDiffSvc.makeCannonicalObj($scope.primary.json)
                    $scope.primary.display = pair.primary.display;
                    console.log($scope.primary)
                }
            );

            //var qry = "http://fhir.hl7.org.nz/dstu2/StructureDefinition/argo-patient";
            $http.get(pair.secondary.url).then(
                function(data){
                    console.log(data)
                    $scope.secondary = {json:data.data};
                    $scope.secondary.cannonical = profileDiffSvc.makeCannonicalObj($scope.secondary.json)
                    $scope.secondary.display = pair.secondary.display;
                }
            )
        }


        loadPair($scope.pairs[0]);
        $scope.pr = $scope.pairs[0];



      //  loadPair("http://fhir.hl7.org.nz/baseDstu2/StructureDefinition/OhPatient-cf-profile",
      //      "http://fhir.hl7.org.nz/dstu2/StructureDefinition/argo-patient")




    })

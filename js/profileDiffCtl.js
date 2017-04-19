
angular.module("sampleApp")
    .controller('profileDiffCtrl',
        function ($scope,$q,$http,profileDiffSvc,$uibModal,logicalModelSvc) {




            $scope.pairs = []      //the pairs of profiles to compare. move to a file...
            $scope.pairs.push({name:"Argonaut Patient",
                primary:{display:"Orion Patient",url:"http://fhir.hl7.org.nz/baseDstu2/StructureDefinition/OhPatient-cf-profile"}
                ,secondary:{display:"Argonaut Patient",url:"http://fhir.hl7.org.nz/dstu2/StructureDefinition/argo-patient"}})


            $scope.pairs.push({name:"Argonaut Allergy",
                primary:{display:"Orion Allergy",url:"http://fhir.hl7.org.nz/baseDstu2/StructureDefinition/OhAllergy-cf-profile"}
                ,secondary:{display:"Argonaut Allergy",url:"http://fhir.hl7.org.nz/dstu2/StructureDefinition/argo-allergyintolerance"}})

            //https://github.com/INTEROPen/CareConnect-profiles/tree/feature/initial_clinical_resources


            $scope.pairs.push({name:"Interopen Patient",
                primary:{display:"Orion Patient",url:"http://fhir.hl7.org.nz/baseDstu2/StructureDefinition/OhPatient-cf-profile"}
                ,secondary:{display:"Interopen Patient",url:"http://fhir.hl7.org.nz/dstu2/StructureDefinition/ccPatient"}})

            $scope.pairs.push({name:"Interopen Allergy",
                primary:{display:"Orion Allergy",url:"http://fhir.hl7.org.nz/baseDstu2/StructureDefinition/OhAllergy-cf-profile"}
                ,secondary:{display:"Interopen Allergy",url:"http://fhir.hl7.org.nz/dstu2/StructureDefinition/ccAllergy"}})


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


        function loadPair(pair) {
            //load all the current tasks on the data server
            //var qry = "http://fhir.hl7.org.nz/baseDstu2/StructureDefinition/OhPatient-cf-profile";

            var arQuery = [];
            arQuery.push ($http.get(pair.primary.url).then(
                function(data){
                   // console.log(data)
                    $scope.primary = {json: data.data};
                    var vo = profileDiffSvc.makeCanonicalObj($scope.primary.json);
                    $scope.primary.canonical = vo.canonical;// profileDiffSvc.makeCanonicalObj($scope.primary.json)
                    $scope.primary.display = pair.primary.display;
                    //console.log($scope.primary)
                })
            );

            //var qry = "http://fhir.hl7.org.nz/dstu2/StructureDefinition/argo-patient";
            arQuery.push ($http.get(pair.secondary.url).then(
                function(data){
                    //console.log(data)
                    $scope.secondary = {json:data.data};
                    var vo = profileDiffSvc.makeCanonicalObj($scope.secondary.json);
                    $scope.secondary.canonical = vo.canonical
                    $scope.secondary.display = pair.secondary.display;


                    var secTreeData = logicalModelSvc.createTreeArrayFromSD(vo.SD)
                    $('#pdSecondary').jstree('destroy');
                    $('#pdSecondary').jstree(
                        {'core': {'multiple': false, 'data': secTreeData, 'themes': {name: 'proton', responsive: true}}}
                    )


                }
            ))

            $q.all(arQuery).then(function(){
                profileDiffSvc.analyseDiff($scope.primary.canonical,$scope.secondary.canonical);
            })

           //
        }


        loadPair($scope.pairs[0]);
        $scope.pr = $scope.pairs[0];



      //  loadPair("http://fhir.hl7.org.nz/baseDstu2/StructureDefinition/OhPatient-cf-profile",
      //      "http://fhir.hl7.org.nz/dstu2/StructureDefinition/argo-patient")




    })

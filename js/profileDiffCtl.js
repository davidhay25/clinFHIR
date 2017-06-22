
angular.module("sampleApp")
    .controller('profileDiffCtrl',
        function ($scope,$q,$http,profileDiffSvc,$uibModal,logicalModelSvc,appConfigSvc,
                  Utilities,GetDataFromServer,profileCreatorSvc) {

            $scope.input = {};
            $scope.appConfigSvc = appConfigSvc;

            //load the lists that describe 'collections' of conformance aritfacts - like CareConnect & Argonaut
            var url = appConfigSvc.getCurrentConformanceServer().url + "ImplementationGuide";
            $http.get(url).then(
                function(data) {
                    $scope.listOfIG = data.data
                },
                function(err){
                    console.log(err)
                }
            );


            //functions and prperties to enable the valueset viewer
            $scope.showVSBrowserDialog = {};
            $scope.showVSBrowser = function(vs) {
                $scope.showVSBrowserDialog.open(vs);        //the open method defined in the directive...
            };

            $scope.showValueSet = function(uri,type) {
                //treat the reference as lookup in the repo...
                GetDataFromServer.getValueSet(uri).then(
                    function(vs) {

                        $scope.showVSBrowserDialog.open(vs);

                    }, function(err) {
                        alert(err)
                    }
                ).finally (function(){
                    $scope.showWaiting = false;
                });
            };


            //note that we're using a List to hold all the resources in this collection
            $scope.selectIG = function(IG){
                $scope.currentIG=IG;     //the List the holds this collection
                console.log(IG)
                //now pull out the various artifacts into an easy to use object
                $scope.artifacts = {}
                $scope.currentIG.package.forEach(function (package) {
                    package.resource.forEach(function (resource) {
                        var purpose = resource.purpose;
                        $scope.artifacts[purpose] = $scope.artifacts[purpose] || []
                        $scope.artifacts[purpose].push({url:resource.sourceReference.reference, description:resource.description})

                    })

                })
            };


            //select an extension from within a profile...
            $scope.selectExtensionFromProfile = function (itemExtension) {
                console.log(itemExtension);

                profileDiffSvc.getSD(itemExtension.url).then(
                    function (SD) {
                        $scope.selectedItemType = 'extension';
                        $scope.selectedExtension = SD;

                        $scope.selectedExtensionAnalysis = Utilities.analyseExtensionDefinition3(SD)
                    }
                )

            }

            $scope.selectItem = function(item,type){
               $scope.selectedItemType = type;
               $scope.selectedItem = item;

               if (type == 'terminology') {
                   //really only works for ValueSet at this point...
                   profileDiffSvc.getTerminologyResource(item.url,'ValueSet').then(
                       function (vs) {
                           $scope.selectedValueSet = vs;
                       }, function (err) {
                           console.log(err)
                       }
                   )
               }

               if (type=='extension') {
                    profileDiffSvc.getSD(item.url).then(
                        function (SD) {
                            $scope.selectedExtension = SD;

                            $scope.selectedExtensionAnalysis = Utilities.analyseExtensionDefinition3(SD)
                        }
                    )
               }

               if (type=='profile') {
                   //this is a profiled resource - - an SD





                   $scope.waiting = true;
                   GetDataFromServer.findConformanceResourceByUri(item.url).then(
                       function(SD){
                            $scope.selectedSD = SD;


                           //-------- logical model

                           profileCreatorSvc.makeProfileDisplayFromProfile(SD).then(
                               function(vo) {
                                   $('#profileTree1').jstree('destroy');
                                   $('#profileTree1').jstree(
                                       {
                                           'core': {
                                               'multiple': false,
                                               'data': vo.treeData,
                                               'themes': {name: 'proton', responsive: true}
                                           }
                                       }
                                   ).on('select_node.jstree', function (e, data) {
                                       if (data.node) {
                                           console.log(data.node && data.node.data);
                                           $scope.selectedED1 = data.node.data.ed;
                                           $scope.$digest();       //as the event occurred outside of angular...

                                       }
                                   })
                               }
                           )




                           //------- physical model
                           var treeData = logicalModelSvc.createTreeArrayFromSD(SD)
                           $('#profileTree').jstree('destroy');
                           $('#profileTree').jstree(
                               {'core': {'multiple': false, 'data': treeData, 'themes': {name: 'proton', responsive: true}}}
                           ).on('changed.jstree', function (e, data) {
                               //seems to be the node selection event...
                                delete $scope.selectedED;
                               //console.log(data)
                               if (data.node) {
                                   console.log(data.node && data.node.data);
                                   $scope.selectedED = data.node.data.ed;
                                   $scope.$digest();       //as the event occurred outside of angular...

                               }
                           })


                           var vo = profileDiffSvc.makeCanonicalObj(SD);
                           profileDiffSvc.makeCanonicalObj(SD).then(
                               function (vo) {
                                   $scope.canonical = vo.canonical;
                               },function (err) {
                                   console.log(err)
                               }
                           )




                       }, function (err) {
                           console.log(err)
                       }
                   ).finally(function () {
                       $scope.waiting = false;
                   })



               }


            }



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


       // loadPair($scope.pairs[0]);
       // $scope.pr = $scope.pairs[0];



      //  loadPair("http://fhir.hl7.org.nz/baseDstu2/StructureDefinition/OhPatient-cf-profile",
      //      "http://fhir.hl7.org.nz/dstu2/StructureDefinition/argo-patient")




    })

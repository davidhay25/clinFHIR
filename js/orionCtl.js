
angular.module("sampleApp")
    .controller('workflowCtrl',
        function ($scope,$http,modalService,resourceCreatorSvc) {

            $scope.nhi="WER4568";
            $scope.item = {};       //hash of items based on resource.id

            $scope.selectItem = function(id) {
                console.log(id);
/*
                if ($scope.item[id]) {
                    $scope.item[id] = false;
                } else {
                    $scope.item[id] = true;
                }

*/
                $scope.selectedResource = $scope.mdResource[id];
                $scope.selectedInternal = $scope.hashMedicationDispense[id];

                var treeData = resourceCreatorSvc.buildResourceTree($scope.selectedResource);

                //show the tree structure of this resource version
                $('#builderResourceTree').jstree('destroy');
                $('#builderResourceTree').jstree(
                    {'core': {'multiple': false, 'data': treeData, 'themes': {name: 'proton', responsive: true}}}
                ).on('loaded.jstree', function () {
                    $('#builderResourceTree').jstree('close_all');
                })

            }

            $scope.read = function(nhi) {
                delete $scope.sealed;
                delete $scope.selectedResource;
                delete $scope.medicationDispense;
                console.log(nhi)
                if (nhi) {
                   // var url = "https://frontend1.solution-nzmoh-dataset-leahr-graviton-jump-host-auckland.graviton.odl.io/fhir/1.0/";
                   // url += "MedicationDispense?patient.identifier=SYS_A|WER4568";
                    $scope.waiting = true;
                    $http.get('/orion/'+nhi.toUpperCase()).then(
                        function (data) {
                            console.log(data)
                            var length = 0;
                            if (data.data && data.data.entry) {
                                length = data.data.entry.length
                            }
                            //the nature of the links being returns seems to vary...
                            if(data.data && data.data.link) {
                                data.data.link.forEach(function(link){
                                    if (link.relation == "orionhealth:describe-patient-sealed" && length == 0) {
                                        $scope.sealed = true;
                                    }

                                    if (link.url == '/fhir/1.0/explain/patientsealed') {
                                        $scope.sealed = true;
                                    }


                                })
                            }





                            $scope.bundle = data.data;
                            processBundle(data.data)
                        }
                    ).finally(function(){
                        $scope.waiting = false;
                    }
                )
                } else {
                    modalService.showModal({}, {bodyText : "You must specify an NHI"})
                }

            }

            function processBundle(bundle){
                $scope.mdResource = {};
                $scope.hashMedicationDispense = {};
                $scope.medicationDispense = [];        //will be an array of medicationDispense
                if (bundle && bundle.entry) {
                    bundle.entry.forEach(function (entry) {
                        var resource = entry.resource;
                        //set the contained resources as a hash
                        resource.hashReferenced = {};   //this makes it explicit that these are 'real' resources...
                        resource.contained.forEach(function (res) {
                            //each entry in the contained array is a resource.
                            resource.hashReferenced[res.id] = res;
                        });


                        //now create the internal object. We know the structure we are dealing with...
                        var md = {};
                        md.id = resource.id;

                        var clone = angular.copy(resource)
                        delete clone.hashReferenced;
                        $scope.mdResource[md.id] = clone;
                        try {
                            //we know that there will be a medication reference here, but just in case
                            var medRef = resource.medicationReference.reference.substr(1);      //this will be the key in the hash
                            md.medication = resource.hashReferenced[medRef].code.coding[0];
                        } catch (ex) {
                            md.medication = {display: "No medication specified"}
                        }

                        md.quantity = resource.quantity;
                        md.dispensed = resource.whenHandedOver;
                        if (resource.dosageInstruction) {
                            md.dose = resource.dosageInstruction[0];
                        }
                        $scope.medicationDispense.push(md);
                        $scope.hashMedicationDispense[md.id] = md;
                    })
                }
            }

    })

/*has been deprectde - don't call make function - expensive! */

angular.module("sampleApp")
    .controller('fopCtrl',
        function ($scope,modalService,ResourceUtilsSvc,resourceCreatorSvc,resourceType,appConfigSvc,GetDataFromServer) {
            $scope.input = {};
            $scope.ResourceUtilsSvc = ResourceUtilsSvc;
            $scope.resourceType = resourceType
            
            //when one of the matching patients is selected
            $scope.selectPatient = function(patient) {
                console.log(patient);
                $scope.selectedPatient = patient;
                var url = appConfigSvc.getCurrentDataServer().url + resourceType + "?subject._id="+patient.id;



               // var url = http://fhirtest.uhn.ca/baseDstu3/Condition?patient._id=21561
                console.log(url);
                GetDataFromServer.adHocFHIRQuery(url).then(
                    function(data) {
                        console.log(data)
                        $scope.resourcesFromOtherPatient = data.data;
                        
                    },
                    function(err) {
                        alert(angular.toJson(err))
                    }
                ).finally(function(){
                    $rootScope.$broadcast('setWaitingFlag',false);
                });
                
                
                
            }



            //find patients with matching names...
            $scope.searchForPatient = function(name) {
                $scope.nomatch=false;   //if there were no matching patients
                delete $scope.matchingPatientsList;
                if (! name) {
                    alert('Please enter a name');
                    return true;
                }
                $scope.waiting = true;
                resourceCreatorSvc.findPatientsByName(name).then(
                    function(data){
                        $scope.matchingPatientsList = data;
                        if (! data || data.length == 0) {
                            $scope.nomatch=true;
                        }
                    },
                    function(err) {
                        modalService.showModal({}, {bodyText: 'Error finding patient - have you selected the correct Data Server?'})
                    }
                ).finally(function(){
                    $scope.waiting = false;
                })
            };
            
            //when the actual resource has been selected...
            $scope.selectResource = function(resource) {
                $scope.$close({resource:resource,patient:$scope.selectedPatient});
            }


    });
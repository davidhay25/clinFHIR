angular.module("sampleApp")
    .controller('addScenarioCtrl',
        function ($scope,GetDataFromServer,appConfigSvc,categories,$uibModal,ResourceUtilsSvc) {
            $scope.canSave = true;
            $scope.input = {};
            $scope.categories = categories;     //categories in a ValueSet...
            $scope.selectedPatient;
            $scope.ResourceUtilsSvc = ResourceUtilsSvc;

            if (categories && categories.concept) {
                $scope.input.category = categories.concept[0];
            } else {
                $scope.input.category = {code:'default',display:'Default',definition:'Default'}
            }

            $scope.findPatient = function(){
                $uibModal.open({
                    backdrop: 'static',      //means can't close by clicking on the backdrop. stuffs up the original settings...
                    keyboard: false,       //same as above.
                    templateUrl: 'modalTemplates/searchForPatient.html',
                    size:'lg',
                    controller: 'findPatientCtrl'
                }).result.then(
                    function(resource){
                        console.log(resource)
                        if (resource) {
                            $scope.selectedPatient = resource;
                           // $scope.selectedPatientDisplay =
                        }
                    }
                );
            }



            $scope.server = appConfigSvc.getCurrentDataServer();
            $scope.checkNameDEP = function(){
                if ($scope.name) {
                    //alert($scope.name)
                    $scope.canSave = true;
                }
            };

            $scope.save = function(){
                //represent the category as a Coding. $scope.category is a concept

                var cat = {code:$scope.input.category.code,display:$scope.input.category.display}
                cat.system = 'http://clinfhir.com/fhir/CodeSystem/LibraryCategories';   //todo get from appConfig
                $scope.$close({name:$scope.input.name,description:$scope.input.description,category:cat,patient:$scope.selectedPatient})
            }


        }
    );
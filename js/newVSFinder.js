angular.module("sampleApp").controller('vsFinderCtrl',
    function ($scope, Utilities, appConfigSvc,SaveDataToServer,GetDataFromServer,currentBinding) {


        $scope.input = {};

        var config = appConfigSvc.config();
        $scope.termServer = config.servers.terminology;
        //$scope.valueSetRoot = config.servers.terminology + "ValueSet/";

        $scope.input.arStrength = ['extensible','preferred','example'];
        $scope.input.strength = currentBinding.strength;


        $scope.select = function() {

            $scope.$close({vs: $scope.input.vspreview,strength:$scope.input.strength});
        };

        //find matching ValueSets based on name
        $scope.search = function(filter){
            $scope.showWaiting = true;
            delete $scope.message;
            delete $scope.searchResultBundle;
            
            var url = $scope.termServer+"ValueSet?name="+filter;
            $scope.showWaiting = true;
            GetDataFromServer.adHocFHIRQuery(url).then(
                function(data){
                    $scope.searchResultBundle = data.data;
                    if (! data.data || ! data.data.entry || data.data.entry.length == 0) {
                        $scope.message = 'No matching ValueSets found'
                    }
                },
                function(err){
                    alert(angular.toJson(err))
                }
            ).finally(function(){
                $scope.showWaiting = false;
            })
        };
        
        
    }
);
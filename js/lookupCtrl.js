/*has been deprectde - don't call make function - expensive! */

angular.module("sampleApp")
    .controller('lookupCtrl',
        function ($scope,parsed,concept,resourceCreatorSvc,GetDataFromServer,appConfigSvc,raw) {

        //need to be passed in via 'resolve'...
        $scope.parsed = parsed
        $scope.concept = concept;
        $scope.raw = raw;

        $scope.selectCode = function (item) {
            var qry = appConfigSvc.getCurrentTerminologyServer().url +
                'CodeSystem/$lookup?code=' + item.value + "&system=" + concept.system;
            //console.log(qry);

            $scope.showWaiting = true;
            GetDataFromServer.adHocFHIRQuery(qry).then(
                function(data) {
                    console.log(data)
                    $scope.raw = data.data
                    $scope.parsed = resourceCreatorSvc.parseCodeLookupResponse(data.data);
                    console.log($scope.parsed)
                    $scope.concept.code = item.value;
                    $scope.concept.display = item.description;
                }
            ).finally(function(){
                $scope.showWaiting = false;
            });
        }


    });
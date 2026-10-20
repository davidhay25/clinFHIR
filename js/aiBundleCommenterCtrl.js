angular.module("sampleApp")
    .controller('aiBundleCommenterCtrl',
        function ($scope) {


                $scope.selectResource = function (entryIndex, resource,tab) {
                        $scope.aiSelectedEntry = $scope.fhir.entry[entryIndex];   // the whole entry, found instantly
                       // $scope.aiSelectedEntry = entry.resource;                    // the resource itself
                        console.log(tab,$scope.aiSelectedEntry)


                    $scope.selectBundleEntry ($scope.aiSelectedEntry,[])

                    //$scope.selectFromMainGraph($scope.aiSelectedEntry.resource)



                };
        })

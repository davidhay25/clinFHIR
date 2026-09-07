angular.module("sampleApp")
    .controller('terminologyExplorerCtrl',
        function ($scope) {

            $scope.termInput = {}


            $scope.$on('processBundle',function (evt) {
                delete $scope.selectedTermResource
                delete $scope.selectedTerminologySummary
                delete $scope.selectedItem
                delete $scope.input.selectedSystem
            })

            $scope.canShowSummaryLine = function (lne) {
                if (! $scope.input.selectedSystem || $scope.input.selectedSystem == 'All') {return true}

                if (lne.system == $scope.input.selectedSystem) {
                    return true
                } else {
                    return false
                }

            }

            $scope.selectSystem = function(system) {
                $scope.selectedTerminologySummary =$scope.terminologySummary[system]
                    let resources = $scope.terminologySummary[system]

            }

            $scope.selectResource = function(resource) {
                $scope.selectedTermResource = resource
            }

            $scope.selectSystem = function() {
                delete $scope.selectedItem
            }

            $scope.canShowConcept = function(concept) {
                if (! $scope.input.selectedSystem || $scope.input.selectedSystem == 'All') {return true}
                if (concept.system == $scope.input.selectedSystem) {
                    return true
                } else {
                    return false
                }

            }

            $scope.canShowItem = function(item) {
                //console.log(item)

                if (! $scope.input.selectedSystem || $scope.input.selectedSystem == 'All') {return true}

                let canShow = false
                if (item.coded) {
                    item.coded.forEach(function (concept) {
                        if (concept.system == $scope.input.selectedSystem) {canShow = true}
                    })
                }


                return canShow
            }

            $scope.selectItem = function (item) {
                $scope.selectedItem = item
            }
        })

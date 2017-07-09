
angular.module("sampleApp")
    .controller('sbHistoryCtrl',
        function ($scope,$rootScope) {


            //when the recording is displayed, re-build the filter. 'thingToDisplay' is from the parent scope...
            $scope.$watch(function(scope) { return scope.thingToDisplay },
                function(newValue, oldValue) {
                    if (newValue == 'recording') {
                        buildFilter();
                       // $scope.$digest()
                    }
                }
            );

            $scope.input = {}
            $scope.filterResources = []


            function buildFilter() {
                var allResources = {}
                $scope.filterResources.length = 0;
                //get all resources in history
                $scope.selectedContainer.tracker.forEach(function (item) {
                    var resourceType = item.details.resourceType;
                    var id = resourceType + "/" + item.id;
                    if (allResources[id]) {
                        allResources[id].items.push(item)
                    } else {
                        allResources[id] = {items:[item]}
                    }
                });
                $scope.filterResources = ["All resources"];
                angular.forEach(allResources,function (v,k) {
                    $scope.filterResources.push(k)

                })
                $scope.input.filterResource = $scope.filterResources[0]
            }

            $scope.applyFilter = function(item){
                //if ()
                console.log(item)
            }


            //called when rendering the list of changes...
            $scope.showItem = function(item) {

                if ($scope.input.filterResource == "All resources") {
                    return true;
                } else {
                    //only show items that apply to this resource
                    var fullUrl = item.details.resourceType + "/"+item.id;
                    if (fullUrl == $scope.input.filterResource) {
                        return true;
                    } else {
                        return false;
                    }


                }


            }

            $scope.selectItem = function(item) {
                $scope.selectedItem = item
                console.log(item.details.value)
                $scope.selectedItemValue = item.details.value;
            }
    })

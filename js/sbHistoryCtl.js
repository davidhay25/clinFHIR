
angular.module("sampleApp")
    .controller('sbHistoryCtrl',
        function ($scope,modalService) {


            //when the recording is displayed, re-build the filter. 'thingToDisplay' is from the parent scope...
            $scope.$watch(function(scope) { return scope.thingToDisplay },
                function(newValue, oldValue) {
                    if (newValue == 'recording') {
                        buildFilter();
                        $scope.makeReport();
                    }
                }
            );

            $scope.input = {};
            $scope.filterResources = [];
            $scope.report = [];

            function buildFilter() {
                var allResources = {};
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

                });
                $scope.input.filterResource = $scope.filterResources[0]
            }

            $scope.deleteItem = function(){
                //if ()

                var modalOptions = {
                    closeButtonText: "No, I changed my mind",
                    actionButtonText: 'Yes, delete this entry',
                    headerText: 'Delete entry',
                    bodyText: 'Are you sure you wish to delete this entry. This cannot be undone.'
                };

                modalService.showModal({}, modalOptions).then(
                    function (){
                        console.log($scope.selectedItemInx)
                        $scope.selectedContainer.tracker.splice($scope.selectedItemInx,1);

                        delete $scope.selectedItemInx;
                        delete $scope.selectedItem;

                        $scope.makeReport();
                    }
                )


            };


            $scope.makeReport = function(){
                $scope.report.length = 0;
                $scope.selectedContainer.tracker.forEach(function (item) {
                    if ($scope.showItem(item)) {
                        var ri = {notes:item.notes};
                        switch (item.type) {
                            case 'addCore' :
                                ri.action = 'Add core resource';
                                ri.detail = [item.details.resourceType];
                                break;
                            case 'dt' :
                                ri.action = 'Add element to resource';
                                ri.detail = ['Path: ' + item.details.path]
                                ri.json = item.details.value;
                                break;
                            case 'link':
                                ri.action = 'Create a resource reference';
                                ri.detail = ['Source path: ' + item.details.path]
                                ri.detail.push('Target resource: ' + item.details.to.resourceType + "/" + item.details.to.id)
                                break;
                        }
                        $scope.report.push(ri)
                    }

                });
            }

            //called when rendering the list of changes...
            $scope.showItem = function(item) {
             //   if (inx) {
                   // var item = $scope.selectedContainer.tracker[inx];

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
             //   }



            };

            $scope.selectItem = function(inx) {
                var item = $scope.selectedContainer.tracker[inx];
                $scope.input.noteChanged = false;
                $scope.selectedItem = item
                console.log(item.details.value)
                $scope.selectedItemInx = inx;
            };

            $scope.moveItemUp = function (evt,inx) {
                evt.stopPropagation();
                var list = $scope.selectedContainer.tracker;
                var b = list[inx-1];
                list[inx-1] = list[inx];
                list[inx] = b;
                $scope.makeReport();
            }

            $scope.moveItemDn = function (evt,inx) {
                evt.stopPropagation();
                var list = $scope.selectedContainer.tracker;
                var b = list[inx+1];
                list[inx+1] = list[inx];
                list[inx] = b;
                $scope.makeReport();
            }

    })

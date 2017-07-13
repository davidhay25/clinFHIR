/*has been deprectde - don't call make function - expensive! */

angular.module("sampleApp")
    .controller('addPropertyInBuilderCtrl',
        function ($scope,dataType,hashPath,builderSvc,insertPoint,vsDetails,expandedValueSet,GetDataFromServer,
                  currentValue,container,resource,sbHistorySvc) {
            $scope.dataTypeBeingEntered = dataType;
            //hashPath.path is the absolute path where the insertion is to occur. The last segment in the path is
            //the propertyname on the insert point (which can be the

            console.log(currentValue)

            $scope.hashPath = hashPath;

            $scope.vsDetails = vsDetails;
            $scope.expandedValueSet = expandedValueSet;
            $scope.input = {};
            $scope.input = {dt: {contactpoint: {use:'home',system:'phone'}}};

            var path = hashPath.path;

            $scope.dtDisplay = path;       //the display in the header
            if (path.substr(-3) == '[x]') {
                var elementRoot = path.substr(0, path.length - 3);
                $scope.dtDisplay = elementRoot + dataType.substr(0, 1).toUpperCase() + dataType.substr(1);
            }

            if (dataType == 'date' ||dataType == 'dateTime' ) {
                $scope.input.dt = new Date();
            }


            $scope.save = function(){

                //>>>>>> just for new maker...
                if ($scope.hashPath.noSave) {
                    $scope.$close($scope.input.dt);
                    return;
                }

                var valueSaved = builderSvc.addPropertyValue(insertPoint,
                    $scope.hashPath,
                    $scope.dataTypeBeingEntered,
                    $scope.input.dt);

                //{type, id, succeed, details, container
                var details = {dataType: $scope.dataTypeBeingEntered};
                details.resourceType = resource.resourceType;
                details.path = hashPath.path;
                details.value = valueSaved;
                //details.insertPoint = insertPoint;      //todo - this is the branch

                //var details = {ip:insertPoint,dt : $scope.dataTypeBeingEntered,hp:hashPath,value:$scope.input.dt};
                sbHistorySvc.addItem('dt',resource.id,true,details,container);

                $scope.$close();
            };

            $scope.vsLookup = function(text,vs) {

                console.log(text,vs)
                if (vs) {
                    var id = vs.id;
                    $scope.showWaiting = true;
                    return GetDataFromServer.getFilteredValueSet(id,text).then(
                        function(data,statusCode){
                            if (data.expansion && data.expansion.contains) {
                                var lst = data.expansion.contains;
                                return lst;
                            } else {
                                return [
                                    {'display': 'No expansion'}
                                ];
                            }
                        }, function(vo){
                            var statusCode = vo.statusCode;
                            var msg = vo.error;


                            alert(msg);

                            return [
                                {'display': ""}
                            ];
                        }
                    ).finally(function(){
                        $scope.showWaiting = false;
                    });

                } else {
                    return [{'display':'Select the ValueSet to query against'}];
                }
            };

            
            
        });
/*has been deprectde - don't call make function - expensive! */

angular.module("sampleApp")
    .controller('addPropertyInBuilderCtrl',
        function ($scope,dataType,hashPath,builderSvc,resource,vsDetails,expandedValueSet,GetDataFromServer) {
            $scope.dataTypeBeingEntered = dataType;
            $scope.hashPath = hashPath;

            $scope.vsDetails = vsDetails;
            $scope.expandedValueSet = expandedValueSet;
            $scope.input = {};

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


                builderSvc.addPropertyValue(resource,
                    $scope.hashPath,
                    $scope.dataTypeBeingEntered,
                    $scope.input.dt)

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
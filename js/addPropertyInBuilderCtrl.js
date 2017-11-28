/*
 * This is the controller whne the data entry forms are called as a modal form from the current builder..
 * It contains only those functions used by the current builder when invoked....
  *
  * */

angular.module("sampleApp")
    .controller('addPropertyInBuilderCtrl',
        function ($scope,dataType,hashPath,builderSvc,insertPoint,vsDetails,expandedValueSet,GetDataFromServer,
                  currentStringValue,container,resource,sbHistorySvc) {



            $scope.dataTypeBeingEntered = dataType;

            //when a concept is selected in the VS Browser (after expansion)
            $scope.conceptSelected = function(concept) {

                $scope.input.dt.cc = $scope.input.dt.cc || {}
                $scope.input.dt.cc.coding = concept;
                $scope.save();

            }


            $scope.hashPath = hashPath;

            $scope.vsDetails = vsDetails;
            $scope.expandedValueSet = expandedValueSet;
            $scope.input = {};
            $scope.input = {dt: {contactpoint: {use:'home',system:'phone'}}};

            //a string value can be pre-populated

            if (currentStringValue) {
                $scope.input.dt.string = currentStringValue
            }

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

                //>>>>>> just for new maker - and the questionnaire...
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

                sbHistorySvc.addItem('dt',resource.id,true,details,container);

                $scope.$close();
            };


            
        });
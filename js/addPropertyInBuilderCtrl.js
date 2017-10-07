/*
 * This is the controller whne the data entry forms are called as a modal form from the current builder..
 * It contains only those functions used by the current builder when invoked....
  *
  * */

angular.module("sampleApp")
    .controller('addPropertyInBuilderCtrl',
        function ($scope,dataType,hashPath,builderSvc,insertPoint,vsDetails,expandedValueSet,GetDataFromServer,
                  currentStringValue,container,resource,sbHistorySvc,RenderProfileSvc) {


            //-------->>>>>>>>>>>>>moved from dataTypeCtrl

            /*

            $scope.timingArray = RenderProfileSvc.populateTimingList();

            $scope.updateTimingDetails = function(item) {

                if (item && item.timing) {
                    $scope.input.dt.dosage.timing.duration = item.timing.duration;
                    $scope.input.dt.dosage.timing.units = item.timing.units;
                    $scope.input.dt.dosage.timing.freq = item.timing.freq;
                    $scope.input.dt.dosage.timing.freq_max = item.timing.freqMax;
                    $scope.input.dt.dosage.timing.period = item.timing.period;
                    $scope.input.dt.dosage.timing.period_max = item.timing.periodMax;
                    $scope.input.dt.dosage.timing.period_units = item.timing.periodUnits;
                    $scope.input.dt.dosage.timing.when = item.timing.when;
                }
            };

            //These may have been set in a parent scope so be careful!
            $scope.input = $scope.input || {}

            //this is for new builder to signal what datatype has been seelcted - todo = try to refactor...
            $scope.$on('setDT',function(event,dt){
                $scope.dataTypeBeingEntered = dt;

                //reset the data entry values here...
                $scope.input.dt = {}
                $scope.input.dt.dosage = {timing:{}};
                $scope.input.dt.cc =  $scope.input.dt.cc || {}

                console.log(dt)
            });

            $scope.results = {timing:{}};
            $scope.routeCodes = {id:'route-codes'};

*/
            $scope.dataTypeBeingEntered = dataType;
            //hashPath.path is the absolute path where the insertion is to occur. The last segment in the path is
            //the propertyname on the insert point (which can be the root)


            //input.dt.string
/*

            //the ValueSet lookup & select for CodeableConcept
            $scope.showVSBrowserDialog = {};
            $scope.showVs = function(vs) {      //pass in the actual valueset...

                $scope.showVSBrowserDialog.open(vs);

            }
*/

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

            /*
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

            */
            
        });
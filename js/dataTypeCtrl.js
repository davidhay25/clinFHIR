
/*
* This is a controller invoked by the BuilderDataEntry page. it is a child of addPropertyInBuilder...
*       It contains common 'config' and other functions needed by the data entry form.
*
* */


angular.module("sampleApp").controller('dataTypeCtrl',
    function ($scope,RenderProfileSvc,GetDataFromServer) {


        //These may have been set in a parent scope so be careful!
        $scope.input = $scope.input || {}

        $scope.$on('currentValue',function(ev,currentValue) {

            //console.log($scope.dataTypeBeingEntered,currentValue)


            if (currentValue) {
                $scope.input.dt = $scope.input.dt || {}
                switch ($scope.dataTypeBeingEntered) {
                    case 'Identifier' :
                        $scope.input.dt.identifier = {};
                        $scope.input.dt.identifier.value = currentValue.value;
                        $scope.input.dt.identifier.system = currentValue.system;
                        break;
                }

            }


        })

        //this is for new builder to signal what datatype has been seelcted - todo = try to refactor...
        $scope.$on('setDT',function(event,dt){
            $scope.dataTypeBeingEntered = dt;

            //reset the data entry values here...
            $scope.input.dt = {}
            $scope.input.dt.dosage = {timing:{}};
            $scope.input.dt.cc = {}; // $scope.input.dt.cc || {}

            $scope.input.dt.contactpoint = {use:'home',system:'phone'};

            if (dt == 'date' ||dt == 'dateTime' ) {
               // $scope.input.dt = new Date();
            }


        });

        $scope.results = {timing:{}};
        $scope.routeCodes = {id:'route-codes'};

        //the ValueSet lookup & select for CodeableConcept
        $scope.showVSBrowserDialog = {};
        $scope.showVs = function(vs){ //pass in the actual valueset...

                $scope.showVSBrowserDialog.open(vs);
            }

        $scope.systemArray = [];
        $scope.systemArray.push('http://loinc.org')
        $scope.systemArray.push('http://snomed.info/sct')
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


        $scope.selectCCfromList = function(item,model,label,event){
           // console.log(item,model,label,event)

            $scope.input.dt.cc = $scope.input.dt.cc || {}
            $scope.input.dt.cc.coding = $scope.input.dt.cc.coding || {}
            $scope.input.dt.cc.coding.system = item.system;
            $scope.input.dt.cc.coding.code = item.code;
        }


        $scope.vsLookup = function (text, vs) {
                $scope.waiting = true;
                delete $scope.ooError;


                if (vs) {
                    var id = vs.id;
                    $scope.waiting = true;
                    return GetDataFromServer.getFilteredValueSet(id, text).then(
                        function (data, statusCode) {
                            if (data.expansion && data.expansion.contains) {
                                var lst = data.expansion.contains;
                                return lst;
                            } else {
                                return [
                                    {'display': 'No expansion'}
                                ];
                            }
                        }, function (vo) {
                            var statusCode = vo.statusCode;
                            $scope.ooError = vo.data;       //will display in builderDataEntry

                            //var msg = vo.data;      //should be an OO



                            //alert(msg);

                            /*
                            return [
                                {'display': ""}
                            ];
                            */
                        }
                    ).finally(function () {
                        $scope.waiting = false;
                    });

                } else {
                    return [{'display': 'Select the ValueSet to query against'}];
                }
            };




    });
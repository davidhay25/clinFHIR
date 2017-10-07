
/*
* This is a controller invoked by the BuilderDataEntry page. it is a child of addPropertyInBuilder...
*       It contains common 'config' and other functions needed by the data entry form.
*
* */


angular.module("sampleApp").controller('dataTypeCtrl',
    function ($scope,RenderProfileSvc,GetDataFromServer) {


        //These may have been set in a parent scope so be careful!
        $scope.input = $scope.input || {}

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

            console.log(dt)
        });

        $scope.results = {timing:{}};
        $scope.routeCodes = {id:'route-codes'};



     //   $scope.input.dt = $scope.input.dt || {}
       // $scope.input.dt.dosage = {timing:{}};
       // $scope.input.dt.cc =  $scope.input.dt.cc || {}

      //  if (! $scope.showVs) {      //this happens when being called from newBuilder...

            //the ValueSet lookup & select for CodeableConcept
            $scope.showVSBrowserDialog = {};
            $scope.showVs = function(vs){ //pass in the actual valueset...
                console.log(vs)
                $scope.showVSBrowserDialog.open(vs);
            }
     //   }


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
            console.log(item,model,label,event)
        }

        //added this for the newBuilder. The scope heirarchy is bit confused I think - need to merge this controller with 'addPropertyInBuilder'
      //  if (! $scope.vsLookup) {
            $scope.vsLookup = function (text, vs) {

                console.log(text, vs)
                if (vs) {
                    var id = vs.id;
                    $scope.showWaiting = true;
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
                            var msg = vo.error;


                            alert(msg);

                            return [
                                {'display': ""}
                            ];
                        }
                    ).finally(function () {
                        $scope.showWaiting = false;
                    });

                } else {
                    return [{'display': 'Select the ValueSet to query against'}];
                }
            };
        //}



    });
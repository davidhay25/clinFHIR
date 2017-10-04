angular.module("sampleApp").controller('dataTypeCtrl',
    function ($scope,RenderProfileSvc) {


        //this is for new builder to signal what datatype has been seelcted - todo = try to refactor...
        $scope.$on('setDT',function(event,dt){
            $scope.dataTypeBeingEntered = dt;
            console.log(dt)
        });

        $scope.results = {timing:{}};


        $scope.routeCodes = {id:'route-codes'};


        //These may have been set in a parent scope so be careful!
        $scope.input = $scope.input || {}
        $scope.input.dt = $scope.input.dt || {}
        $scope.input.dt.dosage = {timing:{}};
        $scope.input.dt.cc =  $scope.input.dt.cc || {}

        if (! $scope.showVs) {      //this happens when being called from newBuilder...

            //the ValueSet lookup & select for CodeableConcept
            $scope.showVSBrowserDialog = {};
            $scope.showVs = function(vs){ //pass in the actual valueset...
                console.log(vs)
                $scope.showVSBrowserDialog.open(vs);
            }
        }

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

    });
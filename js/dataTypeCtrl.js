angular.module("sampleApp").controller('dataTypeCtrl',
    function ($scope,RenderProfileSvc) {

        $scope.results = {timing:{}}



        $scope.routeCodes = {id:'route-codes'}

        //$scope.input.dt has already been set by the parent controller
        $scope.input.dt.dosage = {timing:{}};


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
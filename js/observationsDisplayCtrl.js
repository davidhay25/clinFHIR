/*has been deprectde - don't call make function - expensive! */

angular.module("sampleApp")
    .controller('observationsDisplayCtrl',
        function ($scope,ResourceUtilsSvc) {



            //load the Vital signs pfofile



            //when an obeservation code is selected, draw the chart...
            $scope.obsSelected = function(key,value) {
                $('#observationsChart').empty();
                var container = document.getElementById('observationsChart');
                var dataset = new vis.DataSet(value.list);
                var options = {};
                var graph2d = new vis.Graph2d(container, dataset, options);
            }





            //fired when a patient is selected, passing across the bundle of Boservations
            $scope.$on('patientObservations',function(event,obsBundle) {
                delete $scope.observations;
                console.log(obsBundle)
                if (obsBundle && obsBundle.entry) {

                    //create a hash of unique observation codes, and actual observations for thay code
                    var obsCodes = {}
                    obsBundle.entry.forEach(function(entry){
                        var res = entry.resource;
                        if (res.code && res.code.coding) {
                            var code = res.code.coding[0].system + '|' + res.code.coding[0].code //the code
                            if (! obsCodes[code]) {
                                obsCodes[code] = {list:[]}
                                obsCodes[code].display = ResourceUtilsSvc.getCCSummary(res.code)
                            }

                            //really only works for a quantity right now...
                            if (res.valueQuantity) {
                                var da = res.effectiveDateTime;
                                var v = res.valueQuantity.value;
                                obsCodes[code].list.push({x:da,y:v})
                            }
                        }

                    });


                    $scope.observations = {}    //a hash of the hash (!) to make seletion easier...
                    var cnt = 0
                    angular.forEach(obsCodes,function(value,code){
                        if (value.list.length >0 ) {
                            $scope.observations[code] = value;
                            cnt++;
                        }
                    });

                    //there are no numeric observations
                    if (cnt == 0) {
                        delete $scope.observations;
                    }

                }

            })
           


        });
/*has been deprectde - don't call make function - expensive! */

angular.module("sampleApp")
    .controller('observationsDisplayCtrl',
        function ($rootScope,$scope,modalService,$timeout) {

            $scope.obsSelected = function(key,value) {

                console.log(key,value);
                $('#observationsChart').empty();
                var container = document.getElementById('observationsChart');
                
                var dataset = new vis.DataSet(value.list);

                var options = {};
                var graph2d = new vis.Graph2d(container, dataset, options);
                //$scope.$digest();
/*
                $timeout(function(){
                    graph2d.fit()
                    console.log('fitting...')
                },500)

                */
            }

            $rootScope.$on('patientObservations',function(event,obsBundle) {
                delete $scope.observations;
                console.log(obsBundle)
                if (obsBundle) {

                    var obsCodes = {}
                    obsBundle.entry.forEach(function(entry){
                        var res = entry.resource;
                        if (res.code && res.code.coding) {
                            var code = res.code.coding[0].system + '|' + res.code.coding[0].code //the code
                            if (! obsCodes[code]) {
                                obsCodes[code] = {list:[],display:res.code.text}
                            }


                            //really only works for a quantity right now...
                            if (res.valueQuantity) {
                                var da = res.effectiveDateTime;
                                var v = res.valueQuantity.value;
                                obsCodes[code].list.push({x:da,y:v})
                            }


                            console.log(res);

                            //obsCodes[code].list.push(res)

                        }

                    });
                    console.log(obsCodes);

                    $scope.observations = {}
                    var cnt = 0
                    angular.forEach(obsCodes,function(value,code){

                        console.log(code,value)
                        if (value.list.length >0 ) {
                            $scope.observations[code] = value;
                            cnt++;
                        }
                    });
                    
                    if (cnt == 0) {
                        delete $scope.observations;
                    }




                    //$scope.observations = obsCodes;
                }

            })
           


        });
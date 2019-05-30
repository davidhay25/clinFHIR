angular.module("igApp")
    .controller('igCtrl',
        function ($scope,$uibModal,$http) {

            $scope.hashExtension = {}
            //let url = "http://test.fhir.org/usage-stats";
            registerAccess();

            let url = "/artifacts/usagestats.json";
            $http.get(url).then(
                function(data) {
                    let vo = data.data;
                    for (var IGurl in vo) {

                        let IG = vo[IGurl];
                        //console.log(IG)
                        for (var extUrl in IG.usage) {
                            let arExt = IG.usage[extUrl];
                            $scope.hashExtension[extUrl] = $scope.hashExtension[extUrl] || []
                            arExt.forEach(function (res) {
                                let item = {path : res,ig:IGurl};


                                $scope.hashExtension[extUrl].push(item)
                            })

                        }

                    }
                    //console.log($scope.hashExtension)

                    for (var ext in $scope.hashExtension) {
                        let arExt = $scope.hashExtension[ext];
                        //console.log(arExt)
                        arExt.sort(function (a, b) {
                            if (a.ig > b.ig) {
                                return 1
                            } else {
                                return -1
                            }

                        })
                    }



                }

            );

            $scope.selectED = function(k,v) {
                $scope.selectedEDUrl = k;
                $scope.selectedED = v;
                //console.log(k,v)
            }

            function registerAccess(){
                //register access for the logs...
/*
                var servers = {};
                servers.conformance = appConfigSvc.getCurrentConformanceServer().name;
                servers.terminology = appConfigSvc.getCurrentTerminologyServer().name;
                servers.data = appConfigSvc.getCurrentDataServer().name;
*/
                $http.post('/stats/login',{module:'igAnalysis'}).then(
                    function(data){

                    },
                    function(err){
                        console.log('error accessing clinfhir to register access',err)
                    }
                );

            }

        })
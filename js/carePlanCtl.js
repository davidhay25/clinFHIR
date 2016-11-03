
angular.module("sampleApp")
    .controller('carePlanCtrl',
        function ($scope,$http,appConfigSvc,$q) {


            $scope.input = {identifier:'S3j4UuF8lLD8V7AQirBUiA=='};
            $scope.loadPlans = function(identifier) {
                var allServers = appConfigSvc.getAllServers();
                allServers.forEach(function(server){
                    if (server.version == 3) {
                        loadCPForIdentifier(server,identifier).then(
                            function(plans) {
                                console.log(plans)
                            }
                        )
                    }
                })
            };


            //load a CarePlan from a server based on patient identifier. Need to get the patiet first, as
            //can't assume that the server will support chaining...
            //do assume that the server supports patient query by identifier...
            //and careplan query by patient id
            function loadCPForIdentifier(server,identifier) {
                var deferred = $q.defer();
                //first retrieve the patient
                var result = {server:server};
                var url = server.url+'Patient?identifier='+identifier;
              //  console.log(url);
                $http.get(url).then(
                    function(data){
                        //console.log(data.data)
                        if (data.data && data.data.entry) {
                            //at least 1 patient was found. Just get the first for now, but later reject if >1...
                            result.patient = data.data.entry[0].resource;
                            var patientId = data.data.entry[0].resource.id;
                            var cpUrl = server.url+'CarePlan?subject='+patientId;
                            //console.log(cpUrl);
                            $http.get(url).then(
                                function(data){
                                    //console.log(data.data)
                                    //if (data.data)
                                    result.plans = data.data
                                    deferred.resolve(result);

                                },function(err) {
                                    result.err = err;
                                    deferred.resolve(result);
                                    //console.log(err)
                                })

                        }


                    },function(err) {
                        //console.log(err)
                        deferred.reject();
                    }
                )
                return deferred.promise;
            }


    });

angular.module("sampleApp")
    .controller('carePlanCtrl',
        function ($scope,$http,appConfigSvc,$q) {

            $scope.input = {identifier:'123-456'};
            $scope.input.plans = []

            $scope.output = {showDetail:{}};


            $scope.combine1 = function() {
                //first combine function;
                var cp = {};


            }

            $scope.toggleDetail = function(inx){
                console.log(inx);
                $scope.output.showDetail[inx] = ! $scope.output.showDetail[inx]
            }

            //load plans for all stu3 servers...
            $scope.loadPlans = function(identifier) {
                var allServers = appConfigSvc.getAllServers();
                $scope.input.plans.length = 0;
                allServers.forEach(function(server){
                    if (server.version == 3) {

                        loadCPForIdentifier(server,identifier).then(
                            function(plans) {
                                //return with an object patient: plans(bundle:)
                                console.log(plans)
                                if (plans && plans.plans && plans.plans.entry && plans.plans.entry.length > 0) {
                                    plans.plans.entry.forEach(function(ent){
                                        console.log(ent)
                                        var item = {};
                                        item.patient =plans.patient;
                                        item.server = server;
                                        item.plan = ent.resource;
                                        $scope.input.plans.push(item)
                                    })
                                }

                            }
                        )
                    }
                })
            };


            //load a CarePlan from a server based on patient identifier. Need to get the patient first, as
            //can't assume that the server will support chaining...
            //do assume that the server supports patient query by identifier...
            //and careplan query by patient id
            function loadCPForIdentifier(server,identifier) {
                var deferred = $q.defer();
                //first retrieve the patient
                var result = {server:server};

                var url = server.url + "Patient?identifier=" +
                    appConfigSvc.config().standardSystem.identifierSystem + "|"+identifier


                $http.get(url).then(
                    function(data){
                        //console.log(data.data)
                        if (data.data && data.data.entry) {
                            //at least 1 patient was found. Just get the first for now, but later reject if >1...
                            result.patient = data.data.entry[0].resource;
                            var patientId = data.data.entry[0].resource.id;
                            var cpUrl = server.url+'CarePlan?subject='+patientId;
                            //console.log(cpUrl);
                            $http.get(cpUrl).then(
                                function(data){

                                    result.plans = data.data
                                    deferred.resolve(result);

                                },function(err) {
                                    result.err = err;
                                    deferred.resolve(result);

                                })
                        }

                    },function(err) {

                        deferred.reject();
                    }
                )
                return deferred.promise;
            }


    })

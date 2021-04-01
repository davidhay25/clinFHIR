angular.module("sampleApp")
    .controller('immRegistryCtrl',
        function ($scope,$http,immRegistrySvc,$q) {
            $scope.input = {}

            let plan = "pd2"
            let server = "http://home.clinfhir.com:8054/baseR4/"

            $scope.hashAD = {} //all activitydefinitions keyed by url

            //load all the AD's from the server. May need to get smarter if the use of the app extends...
            let url = server + "ActivityDefinition"
            $scope.showWaiting = true;
            $http.get(url).then(
                function (data) {
                    console.log(data)
                    if (data.data.entry) {
                        data.data.entry.forEach(function (entry){
                            let ad = entry.resource;
                            $scope.hashAD[ad.url] = ad
                        })

                        loadPlan('pd2').then(
                            function (plan) {
                                let treeData = immRegistrySvc.makeTreeData(plan,$scope.hashAD)
                                //show the tree structure of this resource (adapted from scenario builder)
                                $('#planTree').jstree('destroy');
                                $('#planTree').jstree(
                                    {'core': {'multiple': false, 'data': treeData, 'themes': {name: 'proton', responsive: true}}}
                                ).on('changed.jstree', function (e, data) {
                                    //the node selection event...
                                    delete $scope.selectedAD;
                                    delete $scope.selectedPlanSubAction
                                    if (data.node) {
                                        $scope.selectedPlanSubAction = data.node.data;

                                        if ($scope.selectedPlanSubAction) {
                                            $scope.selectedAD = $scope.hashAD[$scope.selectedPlanSubAction.definitionCanonical]
                                        }
                                        $scope.$digest();       //as the event occurred outside of angular...

                                    }
                                })
                            }
                        )
                        //makeTreeData: function (plan,hashAD) {
                    }

                },
                function (err) {
                    console.log(err)
                }
            ).finally(
                function () {
                    $scope.showWaiting = false;
                }
            )

            //console.log(hashAD)

            function loadPlan(planId) {
                let deferred = $q.defer()
                let url = server + "PlanDefinition/" + planId;

                $http.get(url).then(
                    function (data) {
                        $scope.plan = data.data;
                        deferred.resolve(data.data)
                    },
                    function (err) {
                        console.log(err)
                        deferred.reject(err)
                    }
                )
                return deferred.promise
            }

            $scope.addVaccine = function(vaccineCode) {
                $scope.catchupVaccine = $scope.catchupVaccine || {}
                $scope.catchupVaccine[vaccineCode] = $scope.catchupVaccine[vaccineCode] || 0
                $scope.catchupVaccine[vaccineCode] ++

                //re-do the analysis - assuming we add these vaccines
                let vo = immRegistrySvc.analyseImms($scope.plan,$scope.hashAD,$scope.immunizations,$scope.catchupVaccine)
                $scope.analysis = vo.analysis

            }

            $scope.loadPatient = function(patientId) {
                //todo - add patient select
                let url = server + "Immunization?patient=" + patientId

                $http.get(url).then(
                    function (data) {
                        console.log(data)
                        $scope.immunizations = []
                        data.data.entry.forEach(function (entry) {
                            $scope.immunizations.push(entry.resource)
                        })
                        //analyseImms: function(plan,hashAD,arImmunizations) {
                        let vo = immRegistrySvc.analyseImms($scope.plan,$scope.hashAD,$scope.immunizations,$scope.catchupVaccine)
                        $scope.analysis = vo.analysis
                        $scope.hashVaccine = vo.hashVaccine;

                    }, function (err) {
                        console.log(err)
                    }
                )

            }

        }
    )
angular.module("sampleApp")
    .controller('immRegistryCtrl',
        function ($scope,$http,immRegistrySvc,$q,$uibModal) {
            $scope.input = {}

            $scope.input.age = 2;
            $scope.input.ageUnit = "m";


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

            $scope.showExpectedVaccine = function (topAction) {
                //return true if this topAction should be shown for this age
                let patientAge = getAgeInDays();
                let ageDue = topAction.timingAge.value * 7;      //default is weeks
                if (topAction.timingAge.code == 'mo') {
                    ageDue = topAction.timingAge.value * 30;    //is in months
                }

                if (ageDue <= patientAge) {
                    return true;
                }

            }

            function getAgeInDays() {
                let ageInDays = 0
                let age = $scope.input.age;
                let unit = $scope.input.ageUnit;
                switch (unit) {
                    case 'w' :
                        ageInDays = age * 7
                        break;
                    case 'm' :
                        ageInDays = age * 30
                        break;
                    case 'y' :
                        ageInDays = age * 365
                        break;
                }

                return ageInDays;
            }

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
                let vo = immRegistrySvc.analyseImms($scope.plan,$scope.hashAD,$scope.immunizations,$scope.catchupVaccine,getAgeInDays())
                $scope.analysis = vo.analysis

            }
            $scope.removeVaccine = function(vaccineCode) {

                if ($scope.catchupVaccine) {
                    let cnt = $scope.catchupVaccine[vaccineCode]

                    if (cnt > 0) {
                        $scope.catchupVaccine[vaccineCode] --
                        //re-do the analysis - assuming we add these vaccines
                        let vo = immRegistrySvc.analyseImms($scope.plan,$scope.hashAD,$scope.immunizations,$scope.catchupVaccine,getAgeInDays())
                        $scope.analysis = vo.analysis
                    }
                }


            }

            $scope.addPatientDEP = function () {
                $uibModal.open({
                    templateUrl: 'modalTemplates/immPatient.html',
                    //size: 'xlg',
                    controller : function($scope,plan){

                    },
                    backdrop : 'static',
                    resolve : {
                        plan : function () {
                            return $scope.plan
                        }
                    }

                }).result.then(
                    function(queue) {


                    }
                )

            }



            $scope.analyse = function(patientId) {
                //todo - add patient select
                let vo = immRegistrySvc.analyseImms($scope.plan,$scope.hashAD,$scope.immunizations,$scope.catchupVaccine,getAgeInDays())
                $scope.analysis = vo.analysis
                $scope.hashVaccine = vo.hashVaccine;
                $scope.vaccinesDueByAge = vo.vaccinesDueByAge;

                return;
                let url = server + "Immunization?patient=" + patientId

                $http.get(url).then(
                    function (data) {
                        console.log(data)
                        $scope.immunizations = []
                        data.data.entry.forEach(function (entry) {
                            $scope.immunizations.push(entry.resource)
                        })

                        let vo = immRegistrySvc.analyseImms($scope.plan,$scope.hashAD,$scope.immunizations,$scope.catchupVaccine,getAgeInDays())
                        $scope.analysis = vo.analysis
                        $scope.hashVaccine = vo.hashVaccine;
                        $scope.vaccinesDueByAge = vo.vaccinesDueByAge;


                    }, function (err) {
                        console.log(err)
                    }
                )

            }

            function loadImmunizations(patientId) {
                let url = server + "Immunization?patient=" + patientId

                $http.get(url).then(
                    function (data) {
                        console.log(data)
                        $scope.immunizations = []
                        data.data.entry.forEach(function (entry) {
                            $scope.immunizations.push(entry.resource)
                        })

                        let vo = immRegistrySvc.analyseImms($scope.plan,$scope.hashAD,$scope.immunizations,$scope.catchupVaccine,getAgeInDays())
                        $scope.analysis = vo.analysis
                        $scope.hashVaccine = vo.hashVaccine;
                        $scope.vaccinesDueByAge = vo.vaccinesDueByAge;


                    }, function (err) {
                        console.log(err)
                    }
                )
            }
            loadImmunizations('pat')


        }
    )
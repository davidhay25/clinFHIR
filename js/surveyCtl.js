
angular.module("sampleApp")
    .controller('surveyCtrl',
        function ($scope,$http,modalService) {
            $scope.input = {deployType:{}, notes:{}}
            $scope.lst = []

            $http.get('artifacts/allResources.json').then(
                function(data) {
                    //console.log(data.data);
                    $scope.allResources = data.data
                    $scope.allResources.sort(function(a,b) {
                        if (a.name > b.name) {
                            return 1
                        } else {
                            return -1;
                        }
                    })
                    $scope.setFilter("")
                }
            );

            function loadSurveyResults(){
                $http.get('survey/results').then(
                    function (data) {
                        $scope.results = data.data;

                    }, function (err) {
                        console.log(err)
                        alert('Unable to contact survey server')
                    }
                );
            }
            loadSurveyResults()

            $scope.selectedOnly = function(so) {
                console.log(so)
                if (so) {
                    $scope.lst.length = 0;
                    $scope.allResources.forEach(function (item) {
                        var name = item.name; //.toLowerCase();
                        if ($scope.input.selected[name]) {
                            $scope.lst.push(item)
                        }
                    })
                } else {
                    $scope.setFilter($scope.input.filter)
                }


            };

            $scope.setFilter = function(filter) {
                if (filter !== "" && filter !== undefined) {
                    filter = filter.toLowerCase()

                    $scope.lst.length = 0;
                    $scope.allResources.forEach(function (item) {
                        var name = item.name.toLowerCase();
                        if (name.indexOf(filter) > -1) {
                            $scope.lst.push(item)
                        }
                    })
                } else {
                    $scope.lst.length = 0;
                    $scope.allResources.forEach(function (item) {

                        $scope.lst.push(item)
                    })

                }
            };


            $scope.submit = function() {


                var modalOptions = {
                    closeButtonText: "No, I'm not finished",
                    actionButtonText: 'Yes, all finished',
                    headerText: 'Save survey',
                    bodyText: "Are you sure you're ready to save the survey ?"
                };

                modalService.showModal({}, modalOptions).then(function () {
                    let result = {name:$scope.input.name,contact : $scope.input.contact,resources:[]}

                    $scope.allResources.forEach(function (item) {
                        var name = item.name;
                        if ($scope.input.selected[name]) {
                            let resource = {name:name,deployType : $scope.input.deployType[name], notes: $scope.input.notes[name]}
                            result.resources.push(resource)
                        }

                    });

                    console.log(result)

                    $http.post('/survey',result).then(
                        function (data) {
                            loadSurveyResults()
                            alert('Survey has been saved. Thanks for responding')
                        }, function (err) {
                            console.log(err)
                            alert('Sorry, there was an error saving the survey. Can you please raise an issue on the clinFHIR stream of the FHIR chat?')
                        }
                    )
                })





            }

            $scope.checked = function(row){
                if (row) {
                    if (! $scope.input.deployType[row.name]) {
                        $scope.input.deployType[row.name] = 'dev'
                    }

                }

            }


        $scope.canShowDEP = function (row) {
            console.log(row.name)
            if ($scope.input.filter) {
                if (row.name.indexOf($scope.input.filter) > -1) {
                    return true
                } else {
                    return false;
                }
            } else {
                return true;
            }

        }


    });

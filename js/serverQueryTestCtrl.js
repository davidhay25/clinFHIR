angular.module("sampleApp")
    .controller('serverQueryTestCtrl',
        function ($scope,$http) {


            $scope.getScript = function(id) {
                //load the testscript.
                let url = "/testing/testSet/"+id
                $http.get(url).then(
                    function (data) {
                        $scope.script = data.data

                    }
                )
            }

            //load all the defined sets
            let urlAllScripts = "/testing/testSet"
            $http.get(urlAllScripts).then(
                function (data) {
                    $scope.allScripts = data.data
                    console.log($scope.allScripts)

                    $scope.selectedScript = $scope.allScripts[0]
                    $scope.getScript($scope.selectedScript.id)

                }
            )



            $scope.executeTest = function(selectedTest) {
                let fullQuery =  selectedTest.query;
                fullQuery = fullQuery.replace('{identifier}',$scope.script.patientIdentifier)
                $scope.executeAdHoc(fullQuery)
            }

            //todo - only supporting POST right now
            $scope.executeUpdate = function (verb,selectedTest) {
                delete $scope.updateResponse
                delete $scope.updateStatus;

                let qry = $scope.server.url;    //default is post to the root...

                if (selectedTest.fullUrl) {
                    //the url to post the resource to is specified in the test
                    qry = selectedTest.fullUrl
                } else if (selectedTest.query) {
                    //if there is a 'query' element in the test, then append it to the query (it is usually a resource type).
                    qry += selectedTest.query;
                }

                let resource = selectedTest.resource;

                if ($scope.input.useProxy) {
                    qry = "/proxyfhir/" + qry;
                }


                if (verb == 'POST') {
                    $http.post(qry,resource).then(
                        function (data) {
                            $scope.updateResponse = data.data;
                            $scope.updateStatus = data.status
                        },
                        function (err) {
                            $scope.updateResponse = err.data;
                            $scope.updateStatus = err.status
                        }
                    )
                }

                if (verb == 'PUT') {
                    qry += "/" + resource.id;
                    $http.put(qry,resource).then(
                        function (data) {
                            $scope.updateResponse = data.data;
                            $scope.updateStatus = data.status
                        },
                        function (err) {
                            $scope.updateResponse = err.data;
                            $scope.updateStatus = err.status
                        }
                    )
                }
            }

            $scope.selectTest = function(test) {
                delete  $scope.selectedTestResource
                delete $scope.updateResponse;
                $scope.selectedTest = angular.copy(test)
                if ($scope.selectedTest.v2) {
                    let segments = []
                    const regex = /|/
                    $scope.selectedTest.v2.forEach(function (segment){
                        let lne = segment.split("|").join("| ")
                        segments.push(lne.split("^").join("^ "))
                    })
                    $scope.selectedTest.v2 = segments

                }




            }

        })
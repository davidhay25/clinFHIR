angular.module("sampleApp")
    .controller('serverQueryTestCtrl',
        function ($scope,$http) {


            $scope.getScript = function(id) {
                //load the testscript. will eventually have a selector
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
                delete $scope.updateResponse
                delete $scope.updateStatus;

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
                $scope.selectedTest = angular.copy(test)
                /*
                if ($scope.selectedTest.resource) {
                    let json1 = $scope.selectedTest.resource
                    let json2 = JSON.stringify(JSON.parse(json1),null,2)

                    $scope.selectedTestResource = json2
                }
*/
                //let fullQuery = $scope.script.server + test.query;

            }
/*
            //retrieve a test script. Maybe store in local cache and hove UI to paste one in (in json)...
            $scope.getTestScript = function() {
                //server is default server - or use selected one????
                //maybe if there is a server in the script it forces that server to be selected
                let script = {server:'http://hapi.fhir.org/baseR4/',tests:[]}
                script.patientIdentifier = "http://www.clinfhir.com/base|abc1234";  //the patient to test against

                let test = {name:'single code',description:'Get all results for a single test'}
                test.query = "Observation?patient.identifier={identifier}&code=http://loinc.org|26464-8"
                test.expected = {note:"A single observation"}
                script.tests.push(test)

                let test1 = {name:'DR include observations',description:'Get all results in the past year including observations'}
                test1.query = "DiagnosticReport?patient.identifier={identifier}&code=http://loinc.org|58410-2&date=ge2021-01-01&_include=DiagnosticReport:result"
                test1.expected = {note:"One DR & 2 Observations"}
                script.tests.push(test1)

                let test2 = {name:'FBC include observations & ordering provider',description:'All FBC panels including Observations and ordering provider'}
                test2.query = "DiagnosticReport?patient.identifier=http://www.clinfhir.com/base|abc1234&code=http://loinc.org|58410-2&_include=DiagnosticReport:result&_include=DiagnosticReport:based-on&_include:iterate=ServiceRequest:requester"
                test2.expected = {note:"One DR & 2 Observations"}
                script.tests.push(test2)

                $scope.script = script;

                console.log(angular.toJson(script))

            }
            $scope.getTestScript();

            */
        })
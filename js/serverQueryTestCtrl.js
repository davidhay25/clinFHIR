angular.module("sampleApp")
    .controller('serverQueryTestCtrl',
        function ($scope,$http) {


            //load the testscript. will eventually have a selector
            let url = "/testing/testSet/labAPI"
            $http.get(url).then(
                function (data) {
                    $scope.script = data.data
                }
            )


            $scope.executeTest = function(selectedTest) {
                let fullQuery =  selectedTest.query;
                fullQuery = fullQuery.replace('{identifier}',$scope.script.patientIdentifier)
                //$scope.selectedTest.fullQuery = fullQuery;
                $scope.executeAdHoc(fullQuery)
            }


            $scope.selectTest = function(test) {
                $scope.selectedTest = angular.copy(test)
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
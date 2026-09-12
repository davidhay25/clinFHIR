angular.module("sampleApp")
    .controller('prePopConfigCtrl',
        function ($scope,$http,prePopConfig) {

            $scope.prePopConfig = prePopConfig

            $scope.input = {}

            $scope.resourceTypes = [
                {type:'Condition',patient:'patient'},
                {type:'AllergyIntolerance',patient:'patient'}
            ]

            $scope.showResource = function (ref) {
                let qry = `${prePopConfig.dataServer}/${ref}`
                $http.get(qry).then(
                    function (data) {
                        $scope.input.selectedResource = data.data

                    }
                )

            }
            
            
            $scope.save = function () {
                $scope.$close($scope.prePopConfig)
            }

            $scope.makeContextPatient = function (patient) {
                $scope.prePopConfig.patient = {reference:`Patient/${patient.id}`}
                let display = patient.name?.[0].text ||
                    (patient.name?.[0].given?.[0] +" " + patient.name?.[0].family) || 'No name'
                $scope.prePopConfig.patient.display = display
                $scope.input.mainTabActive = 0
            }

            $scope.makeContextPractitioner = function (practitioner) {
                $scope.prePopConfig.practitioner = {reference:`Practitioner/${practitioner.id}`}
                let display = practitioner.name?.[0].text ||
                    (practitioner.name?.[0].given?.[0] +" " + practitioner.name?.[0].family) || 'No name'
                $scope.prePopConfig.practitioner.display = display
                $scope.input.mainTabActive = 0
            }


            $scope.testDataServer = function (url) {
                let url1 = url.endsWith('#') ? url : url + '/';
                $http.get(`${url1}metadata`).then(
                    function (data) {
                        alert("Server is online")
                    }, function (err) {
                        alert("Server did not respond to a metadata request")
                    }
                )
            }
            
            $scope.doQuery = function (inQry) {
                delete $scope.qryError
                delete $scope.responseJson
                let qry = `${prePopConfig.dataServer}/${inQry}`
                $scope.displayQuery = qry
                $http.get(qry).then(
                    function (data) {
                        let response = data.data
                        $scope.responseJson = response



                    }, function (err) {
                        $scope.qryError = err.data

                    }
                )

            }

            $scope.upload= function () {
                delete $scope.qryError
                let json
                try {
                    json = angular.fromJson($scope.input.resource)
                } catch (ex) {
                    alert("invalid Json")
                    return
                }

                let id = json.id
                if (! id) {
                    alert("must have Id")
                    return
                }

                let type = json.resourceType
                if (! type) {
                    alert("must have resource type")
                    return
                }


                let qry = `${prePopConfig.dataServer}/${type}/${id}`
                if (confirm(`Are you sure you want to upload ${qry}`)) {
                    $http.put(qry,json).then(
                        function () {
                            alert("Upload complete")
                        }, function (err) {
                            alert(angular.toJson(err.data))
                        }
                    )
                }


            }

        })
angular.module("sampleApp")
    .controller('viewIPSCtrl', function ($scope,$http,$sce) {

        $scope.input = {nhi:"ZKT9319"}



        //https://terminz.azurewebsites.net/fhir/Patient/$summary?profile=http://hl7.org/fhir/uv/ips/StructureDefinition/Bundle-uv-ips&identifier=https://standards.digital.health.nz/ns/nhi-id|ZKT9319&_format=json

        let ipsProfile = "http://hl7.org/fhir/uv/ips/StructureDefinition/Bundle-uv-ips"
        let nhiSystem = "https://standards.digital.health.nz/ns/nhi-id"

        $scope.endPoints = []

        let tnzConfig = {name:"Terminz test",baseUrl:"https://terminz.azurewebsites.net/fhir/"}
        tnzConfig.nhi = "https://standards.digital.health.nz/ns/nhi-id|NNJ9186"
        $scope.endPoints.push(tnzConfig)

        let tnzConfig1 = {name:"Iosefa Test-Fuimaono",baseUrl:"https://terminz.azurewebsites.net/fhir/"}
        tnzConfig1.nhi = "https://standards.digital.health.nz/ns/nhi-id|ZKT9319"
        $scope.endPoints.push(tnzConfig1)

        $scope.input.endpoint = $scope.endPoints[0]


        $scope.to_trusted = function(html_code) {
            return $sce.trustAsHtml(html_code);
        }

        $scope.selectEP = function (ep) {
            delete $scope.composition
            delete $scope.hashResources
            delete $scope.selectedResource
            delete $scope.OO
        }

        $scope.load = function (endPoint) {


            $scope.qry = `${endPoint.baseUrl}Patient/$summary?profile=${ipsProfile}&identifier=${endPoint.nhi}&_format=json`

            $scope.showWaiting = true
            $http.get($scope.qry).then(
                function (data) {
                    $scope.ips = data.data
                    processIPS($scope.ips)
                    $scope.showWaiting = false
                }, function (err) {
                    $scope.showWaiting = false
                    alert(angular.toJson(err.data))
                }
            )


            //https://terminz.azurewebsites.net/fhir/Patient/$summary?profile=http://hl7.org/fhir/uv/ips/StructureDefinition/Bundle-uv-ips&identifier=https://standards.digital.health.nz/ns/nhi-id|ZKT9319&_format=json

        }
        
        $scope.selectResource = function (ref) {
            $scope.selectedResource = $scope.hashResources[ref.reference]
        }

        $scope.validate = function (resource) {
            let url = `http://hapi.fhir.org/baseR4/${resource.resourceType}/$validate`
            $scope.showWaiting = true
            $http.post(url,resource).then(
                function (data) {
                    $scope.OO = data.data

                    $scope.showWaiting = false
                }, function (err) {
                    $scope.showWaiting = false
                    $scope.OO = err.data
                }
            )

        }

        function processIPS(bundle) {
            if (bundle.entry) {
                $scope.hashResources = {}
                $scope.composition = bundle.entry[0].resource
                $scope.entries = []
                bundle.entry.forEach(function (entry) {
                    let resource = entry.resource
                    let ref = `${resource.resourceType}/${resource.id}`
                    $scope.hashResources[ref] = resource

                    if (resource.resourceType == 'Patient') {
                        $scope.patient = resource
                    }
                })

                $scope.composition.section.forEach(function (section) {

                })


            }

        }

    }
);
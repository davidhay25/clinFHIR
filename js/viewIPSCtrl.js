angular.module("sampleApp")
    .controller('viewIPSCtrl', function ($scope,$http,$sce) {

        $scope.input = {nhi:"ZKT9319"}



        //https://terminz.azurewebsites.net/fhir/Patient/$summary?profile=http://hl7.org/fhir/uv/ips/StructureDefinition/Bundle-uv-ips&identifier=https://standards.digital.health.nz/ns/nhi-id|ZKT9319&_format=json

        let ipsProfile = "http://hl7.org/fhir/uv/ips/StructureDefinition/Bundle-uv-ips"
        let nhiSystem = "https://standards.digital.health.nz/ns/nhi-id"

        $scope.config = []
        $scope.config.push({name:"Terminz",baseUrl:"https://terminz.azurewebsites.net/fhir/"})

        $scope.to_trusted = function(html_code) {
            return $sce.trustAsHtml(html_code);
        }

        $scope.load = function (nhi) {
            let server = $scope.config[0]

            $scope.qry = `${server.baseUrl}Patient/$summary?profile=${ipsProfile}&identifier=${nhiSystem}|${nhi}&_format=json`

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

        function processIPS(bundle) {
            if (bundle.entry) {
                let hashResources = {}
                $scope.composition = bundle.entry[0].resource
                $scope.entries = []
                bundle.entry.forEach(function (entry) {
                    let resource = entry.resource
                    let ref = `${resource.resourceType/resource.id}`
                    hashResources[ref] = resource
                })

                $scope.composition.section.forEach(function (section) {

                })


            }

        }

    }
);
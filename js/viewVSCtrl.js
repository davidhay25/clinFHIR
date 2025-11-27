angular.module("sampleApp")
    .controller('viewVSCtrl',
        function ($scope,url,$http,$uibModal,terminologyServer) {


            $scope.url = url


            $scope.input = {}
//There was no ValueSet with the url:http://hl7.org/fhir/ValueSet/allergyintolerance-clinical|4.0.1



            let snomed = "http://snomed.info/sct"

            $scope.languages = []       //languages that can be used for the expansion
            $scope.languages.push({display:"Default",code:""})      //todo find nz expansion
            $scope.languages.push({display:"CanShare",code:"en-x-sctlang-23162100-0210105"})

            $scope.input.selectedLanguage = $scope.languages[1]


            $scope.expandVSInTS = function (url) {
                let queryUrl = url          //the actual url query to use (version removed)
                let version

                let ar = $scope.url.split('|')
                if (ar.length > 1) {
                    queryUrl = ar[0]
                    version = ar[1]
                }


                delete $scope.expandedVS
                let qry = `${terminologyServer}/ValueSet/$expand?url=${queryUrl}&_summary=false`
                /*
                              if (version) {
                                  qry += "&version="+version
                              }

                              if ($scope.input.selectedLanguage && $scope.input.selectedLanguage.code) {
                                  qry += `&displayLanguage=${$scope.input.selectedLanguage.code} `
                              }
              */
                if ($scope.input.filter) {
                    qry += `&filter=${$scope.input.filter}`
                }
//let newQry = `proxyRequest?qry=${encodeURIComponent(item.qry)}`
                $scope.expandQry = qry
                //let encodedQry = encodeURIComponent(qry)
                $scope.showWaiting = true

                let newQry = `proxyGet?qry=${encodeURIComponent(qry)}`

                $http.get(newQry).then(
                    function (data) {
                        $scope.expandedVS = data.data
                        console.log(data.data)
                    }, function (err) {
                        alert(`There was no ValueSet with the url:${url}`)
                    }
                ).finally(
                    function () {
                        $scope.showWaiting = false
                    }
                )

            }

            //expand by default. Can always change later
            $scope.expandVSInTS($scope.url)

            $scope.lookup = function (concept) {


                let code = concept.code
                let system = concept.system || snomed

                let qry = `CodeSystem/$lookup?system=${system}&code=${code}`


                let encodedQry = encodeURIComponent(qry)
                $scope.showWaiting = true
                $http.get(`nzhts?qry=${encodedQry}`).then(

                    //$http.get(url).then(
                    function (data) {
                        //console.log(data.data)
                        //alert(data.data)
                        $scope.showWaiting = false
                        $uibModal.open({
                            templateUrl: 'modalTemplates/showParameters.html',
                            //backdrop: 'static',
                            //size : 'lg',
                            controller : "showParametersCtrl",

                            resolve: {
                                parameters: function () {
                                    return data.data
                                },
                                title : function () {
                                    return `Concept lookup (${code})`
                                },
                                code: function () {
                                    return code
                                },
                                system : function () {
                                    return snomed
                                }
                            }

                        })


                    }, function (err) {
                        alert(angular.toJson(err.data))
                    }
                )
            }




        }
    )
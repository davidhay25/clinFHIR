
angular.module("sampleApp")
    .controller('projectCtrl',
        function ($scope,$localStorage,$http,$window,projectSvc) {


            delete $localStorage.cfModel;

            //$scope.state=''
            //get the current status - ie whether logged in or not...

            $scope.loadModel = function(entry){
                //save the model in browser memory & load the Logical modeller
                console.log(entry)
                $localStorage.cfModel = entry.resource;
                $window.location.href = "logicalModeller.html#$$$";

            };

            $http.get('/status').then(
                function (data) {
                    console.log(data.data)
                    $scope.status = data.data;

                    if ($scope.status.status == 'loggedin') {

                        $scope.expires = data.data.expires;
                        setServerType('terminology',"https://ontoserver.csiro.au/stu3-latest/");
                        setServerType('data',"https://hof.smilecdr.com:8000/");
                        setServerType('conformance',"https://hof.smilecdr.com:8000/");

                        $localStorage.cfAt = $scope.status.accessToken;
                        $localStorage.user = $scope.status.user;

                        getModels();
                    }
                }, function (err) {
                    alert(angular.toJson(err))
                }
            );

            function setServerType(type,url) {
                $localStorage.config.servers[type] = url;
            }

            $scope.test = function(){
                getModels()
                /*
                var url = "/proxyfhir/StructureDefinition";
                $http.get(url).then(
                    function (data) {
                        console.log(data.data)
                })
                */
            };


            function getModels() {

                var url = "/proxyfhir/StructureDefinition?kind=logical&identifier=http://clinfhir.com|author";
                $http.get(url).then(
                    function (data) {
                        console.log(data.data)
                        $scope.modelsBundle = data.data;
                    })
            }

            //refresh the
            $scope.refresh = function () {
                projectSvc.refresh().then(
                    function(data) {
                       // cons
                    }
                );
            }

            $scope.login = function () {
                $scope.status = 'loggingIn'
                $http.get('/init').then(
                    function (data) {
                        console.log(data.data)
                        $window.location.href = "/auth" ;
                    }, function (err) {
                        console.log(err)
                    }
                )
            }




    });

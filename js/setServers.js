/*has been deprectde - don't call make function - expensive! */

angular.module("sampleApp")
    .controller('setServersCtrl',
        function ($scope,appConfigSvc,$uibModal,GetDataFromServer) {

            $scope.allServers = appConfigSvc.getAllServers();
            $scope.terminologyServers = appConfigSvc.getAllTerminologyServers();

            $scope.input = {}

            //console.log($scope.allServers)


            $scope.addServer = function(){
                $uibModal.open({
                    backdrop: 'static',      //means can't close by clicking on the backdrop.
                    keyboard: false,       //same as above.
                    templateUrl: 'modalTemplates/addServer.html',
                    size:'lg',
                    controller: function($scope,appConfigSvc,modalService){
                        $scope.input={version:"2"}
                        $scope.input.valid = false;

                        $scope.add = function() {
                            var svr = {name:$scope.input.name,url:$scope.input.url,
                                version:parseInt($scope.input.version,10),everythingOperation:$scope.input.everything}



                            console.log(svr);
                            appConfigSvc.addServer(svr,$scope.input.terminology);
                            $scope.$close();

                        };

                        $scope.test = function() {


                            if ($scope.input.url.substr(-1,1) !== '/') {
                               // alert('no trailing slash')
                                $scope.input.url += '/';
                            }


                            var svr = appConfigSvc.getServerByUrl($scope.input.url);
                            if (svr) {
                                modalService.showModal({}, {bodyText: 'That URL is already defined as '+svr.name + ' and cannot be added again.'})
                                $scope.input.valid = false;
                                return;
                            }


                            var qry = $scope.input.url + "metadata";
                            $scope.waiting=true;
                            GetDataFromServer.adHocFHIRQuery(qry).then(
                                function(data){
                                    modalService.showModal({}, {bodyText: 'Conformance resource returned. Server can be added'})
                                    $scope.input.valid = true;

                                    //get the fhir version from the conformance resource
                                    $scope.fhirVersion = data.data.fhirVersion;


                                },
                                function(err){
                                    console.log(err)
                                    modalService.showModal({}, {bodyText: 'There is no valid FHIR server at this URL:'+qry})

                                }
                            ).finally(function(){
                                $scope.waiting=false;
                            })

                        }

                    }

                })
            }


            function showConfig(){
                $scope.input.dataServer = setCurrent(appConfigSvc.getCurrentDataServer());
                $scope.input.confServer = setCurrent(appConfigSvc.getCurrentConformanceServer());
                $scope.input.termServer = setCurrent(appConfigSvc.getCurrentTerminologyServer());
            }
            showConfig();

            //when the user selects the 'default' option from the launcher...
            $scope.$on('setDefault',function(){
                showConfig();
            })

            //console.log($scope.allServers)

            $scope.save = function(){
                //console.log($scope.input)
                appConfigSvc.setServerType('data',$scope.input.dataServer.url);
                appConfigSvc.setServerType('conformance',$scope.input.confServer.url);
                appConfigSvc.setServerType('terminology',$scope.input.termServer.url);

                //$close only exists when being called as a dialog. This controller is also used from the launcher...
                if ($scope.$close) {
                    $scope.$close()
                } else {
                    $scope.$emit('serverUpdate')
                }

            }

            function setCurrent(svr){
                var sel = {}
                $scope.allServers.forEach(function(s){
                    if (svr.url == s.url) {
                        sel = s
                    }
                })
                return sel;
            }

    });
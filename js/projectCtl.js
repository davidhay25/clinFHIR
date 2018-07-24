
angular.module("sampleApp")
    .controller('launcherCtrl',
        function ($scope,modalService,$firebaseObject,GetDataFromServer,$uibModal,appConfigSvc,$interval,$http,logicalModelSvc,$timeout) {

            GetDataFromServer.registerAccess('launcher');


            $scope.testing = {};
            $scope.showServers = false;
            $scope.displayMode = 'front';

            if (appConfigSvc.checkConfigVersion()) {
                var txt = 'The default configuration has been updated (including the patient data and conformance server). Please re-load the page for it to take effect.';
                txt += " (Note that the servers have been re-set to the defaults, and also you will need to re-enter any direct servers you have added via the 'gear' icon)"
                modalService.showModal({}, {bodyText: txt})
            }

            //---------- login stuff
            //called whenever the auth state changes - eg login/out, initial load, create user etc.
            firebase.auth().onAuthStateChanged(function(user) {


                if (user) {
                    $scope.userProfile = $firebaseObject(firebase.database().ref().child("users").child(user.uid));
                    //logicalModelSvc.setCurrentUser(user);


                    //return the practitioner resource that corresponds to the current user (the service will create if absent)
                    GetDataFromServer.getPractitionerByLogin(user).then(
                        function(practitioner){

                            $scope.Practitioner = practitioner;

                        },function (err) {
                            console.log('Current data server cannot create Practitioners...')
                            //just swallow any error

                        }
                    );

                    delete $scope.showNotLoggedIn;


                } else {
                    console.log('no user')
                    logicalModelSvc.setCurrentUser(null);
                    $scope.showNotLoggedIn = true;
                    delete $scope.Practitioner;

                }
            });

            $scope.firebase = firebase;

            $scope.login=function(){
                $uibModal.open({
                    backdrop: 'static',      //means can't close by clicking on the backdrop.
                    keyboard: false,       //same as above.
                    templateUrl: 'modalTemplates/login.html',
                    controller: 'loginCtrl'
                })
            };

            $scope.logout=function(){
                firebase.auth().signOut().then(function() {

                    modalService.showModal({}, {bodyText: 'You have been logged out of clinFHIR'})

                }, function(error) {
                    modalService.showModal({}, {bodyText: 'Sorry, there was an error logging out - please try again'})
                });

            };


            // an event that is called after the date range is changed in the graph...
            var evt = function(min,max){

                //re- call the summary endpoint, but only update the moduleList and countryList properties...
                GetDataFromServer.getAccessAudit(null,min,max).then(
                    function(log){
                        $scope.accessAudit.moduleList = log.moduleList;
                        $scope.accessAudit.countryList = log.countryList;

                    },
                    function(err) {

                    }
                );
            };

            GetDataFromServer.getAccessAudit(evt).then(
                function(log){
                    $scope.accessAudit = log;

                },
                function(err) {

                }
            );



            $scope.showChart = function() {
                if ($scope.displayMode == 'access') {
                    $scope.displayMode = 'front'
                } else {
                    $scope.displayMode = 'access';
                    //otherwise the chart is not full screen
                    $timeout(function(){
                        // $scope.accessAudit.tmp='s';
                        $('#hcAccessAudit').highcharts().reflow();
                    }, 0);


                }
            }

            $scope.testServer = function(type) {
                var opn = 'getCurrent'+type + 'Server'
                var svr = appConfigSvc[opn]()
                $scope.testing = {testData : {}, testConformance:{}, textTerminology:{}};

                $scope.message = 'Reading the capabilityStatement from '+ svr.url + ' Please wait...';


                //Display a countdown timer so the user knows something is happenning
                var stop;
                $scope.elapsed= 15;     //this timeout is set in the resourceCreatorSvc.getConformanceResource as well...
                timer = function() {

                    if ( angular.isDefined(stop) ) return;      //only have 1 at a time...

                    stop = $interval(function() {
                        $scope.elapsed --;

                        if ($scope.elapsed < 0) {
                            //stopTimer();
                            $interval.cancel(stop);
                        }
                    }, 1000);
                };

                timer();        //Start the timer...


                $scope.testing['test'+type] = {loading : true};



                var url = svr.url + "metadata"
                $http.get(url, {timeout: 10000}).then(

                    function(data) {
                        $scope.testing['test'+type] = {ok:true}
                    },
                    function(err) {
                        $scope.testing['test'+type] = {fail:true}
                    }
                ).then(function(){
                    delete $scope.message;
                    delete $scope.elapsed;
                    $interval.cancel(stop);
                });

            };


            $scope.allTheSame = function(){
                var url = appConfigSvc.getCurrentDataServer().url;
                appConfigSvc.setServerType('terminology',url);
                appConfigSvc.setServerType('conformance',url);
                $scope.$broadcast('setDefault');        //will just refresh the display...
                $scope.showServers = false;
            }

            $scope.setToDefault = function(){
                $scope.testing = {};
                appConfigSvc.setToDefault();

                $scope.$broadcast('setDefault');
                $scope.showServers = false;
            }

            $scope.$on('serverUpdate',function() {

                $scope.testing = {};
                $scope.showServers = false;

                var version = appConfigSvc.getCurrentDataServer().version;
                if (appConfigSvc.getCurrentTerminologyServer().version !== version ||
                    appConfigSvc.getCurrentConformanceServer().version !== version ) {

                    modalService.showModal({}, {bodyText:'You have selected servers with different FHIR versions. I strongly suggest that you fix that.'});
                } else {
                    modalService.showModal({}, {bodyText:'The servers that clinFHIR will access has been updated for all modules.'});
                }



            })

    })

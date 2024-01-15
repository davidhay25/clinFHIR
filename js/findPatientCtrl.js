angular.module("sampleApp")
    .controller('findPatientCtrl',
            function($scope,ResourceUtilsSvc,resourceSvc,supportSvc,resourceCreatorSvc,
                     $localStorage,appConfigSvc,GetDataFromServer,createSampleBundleSvc, $http,serverInteractionSvc,
                     modalService){

                $scope.input={mode:'find',gender:'male'};   //will be replaced by name randomizer
                $scope.input.dob = new Date(1982,9,31);     //will be replaced by name randomizer
                $scope.outcome = {log:[]};
                $scope.appConfigSvc = appConfigSvc;


                //oct-2020 - allow user to enter acccess token
                $scope.input.oauthAccessToken = $localStorage.oauthAccessToken;

                $scope.saveOauthAccessToken = function(token) {

                    if (token) {
                        let t = token.toLowerCase();
                        if (t.substr(0,7) !== "bearer ") {
                            token = "Bearer " + token
                        }

                        console.log ('saving token: ' + token)

                        $localStorage.oauthAccessToken = token
                    } else {
                        delete $localStorage.oauthAccessToken
                        console.log("removing token")
                    }


                }



                $scope.input.createSamples = true;
                //when the 'Add new patient' is selected...
                $scope.seletNewPatientOption = function(){

                    $scope.input.mode='new';
                    $scope.waiting = true;
                    supportSvc.getRandomName().then(
                        function(data) {
                            try {
                                //moment(input.dob).format('YYYY-MM-DD');

                                var user = data.data.results[0];
                                $scope.input.dob = moment(user.dob).toDate(); //format();
                                $scope.input.fname  = user.name.first.toProperCase();
                                $scope.input.lname = user.name.last.toProperCase();
                                $scope.input.gender = user.gender;
                            } catch (ex) {
                                //in the case of an error - simply use the defaults
                                console.log('error getting sample name: ',ex)
                            }

                        }
                    ).finally(function(){
                        $scope.waiting = false;
                    });

                    //alert ('Sorry, new patient functionality not available from here')
                };

                var addLog = function(display) {
                    $scope.outcome.log.push(display);
                };

                $scope.ResourceUtilsSvc = ResourceUtilsSvc;

                $scope.selectNewPatient = function(patient) {
                    appConfigSvc.setCurrentPatient(patient);

                    $scope.$close(patient);
                };

                //directly load a patient based on their id
                $scope.loadPatient = function(id) {
                    var url = appConfigSvc.getCurrentDataServer().url + "Patient/"+id;
                    GetDataFromServer.adHocFHIRQuery(url).then(
                        function(data){
                            var patient = data.data;
                            if (patient) {
                                appConfigSvc.setCurrentPatient(patient);

                                $scope.$close(patient);

                            }
                        },
                        function(err){
                            modalService.showModal({}, {bodyText: 'No patient with that Id found.'})

                        }
                    )

                };

                $scope.searchForIdentifier = function(identifier) {
                    $scope.nomatch=false;   //if there were no matching patients
                    delete $scope.matchingPatientsList;
                    if (! identifier) {
                        alert('Please enter an identifier');
                        return true;
                    }
                    $scope.waiting = true;

                    resourceCreatorSvc.findPatientsByIdentifier(identifier).then(
                        function(data){

                            $scope.matchingPatientsList = data;
                            if (! data || data.length == 0) {
                                $scope.nomatch=true;
                            }
                        },
                        function(err) {
                            modalService.showModal({}, {bodyText: 'Error finding patient - have you selected the correct Data Server?'})

                        }
                    ).finally(function(){
                        $scope.waiting = false;
                    })
                };


                $scope.searchForPatient = function(name) {
                    $scope.nomatch=false;   //if there were no matching patients
                    delete $scope.matchingPatientsList;
                    if (! name) {
                        alert('Please enter a name');
                        return true;
                    }
                    $scope.waiting = true;
                    // todo resourceCreatorSvc.findPatientsByName(name, $scope.input.oauthAccessToken).then(
                    resourceCreatorSvc.findPatientsByName(name).then(
                        function(data){

                            $scope.matchingPatientsList = data;
                            if (! data || data.length == 0) {
                                $scope.nomatch=true;
                            }


                        },
                        function(err) {

                            modalService.showModal({}, {bodyText: 'Error finding patient - ' + angular.toJson(err)})

                            //modalService.showModal({}, {bodyText: 'Error finding patient - have you selected the correct Data Server?'})

                        }
                    ).finally(function(){
                        $scope.waiting = false;
                    })
                };

                //add - and select - a new patient..
                //note that Grahames server can't handle multiple concurrent requests - which is why theres
                //a rather inelegant 'pyramid of doom' sync calls....
                //not any more! Now we can just use a single transaction...
                $scope.addNewPatient = function() {
                    $scope.showLog = true;
                    $scope.allowClose = false;
                    $scope.waiting = true;
                    let nameText = $scope.input.fname + " " + $scope.input.lname;
                    addLog('Adding '+nameText);

//-------
                    //create the patient resource which will be added to the transaction
                    let patient = {"resourceType": "Patient"};
                    patient.name = [{use:'official',family:$scope.input.lname,given:[$scope.input.fname],text:nameText}];
                    patient.gender = $scope.input.gender;
                    patient.birthDate= moment($scope.input.dob).format('YYYY-MM-DD');
                    if ($scope.input.identifier) {
                        patient.identifier = [{system:appConfigSvc.config().standardSystem.identifierSystem,value:$scope.input.identifier}]
                    }
                    patient.text = {status:'generated',div:"<div xmlns='http://www.w3.org/1999/xhtml'>"+nameText+'</div>'};

//-----------

                    //let patient = {resourceType:"Patient",name:[{text:"John Doe"}]}
                    //this is a new approach that uses a single bundle...
                    createSampleBundleSvc.makeSampleBundle(patient).then(
                        function (bundle) {
                            //console.log(JSON.stringify(bundle))

                            var url = appConfigSvc.getCurrentDataServerBase();
                            //$scope.waiting = false;
                            let config = serverInteractionSvc.getServerConfig()

                            //as IS server isists on the correct mime type
                            config.headers = {'content-type':'application/fhir+json'}

                            /* LEAVE - might be useful in debugging after changes - eg adding new resources
                            //perform validation
                            let validateUrl = appConfigSvc.getCurrentDataServerBase() + "Bundle/$validate"

                            $http.post(validateUrl,bundle,config).then(
                                function (data) {
                                    $scope.validationResult = data.data
                                },
                                function(err){
                                    $scope.validationResult = data.data

                                })
                            */

                            /* this is the save,*/
                            //console.log(bundle)
                            $http.post(url,bundle,config).then(
                                function (data) {
                                    //alert("Data saved")
                                    $scope.saveMessage = "Data has been saved. Close the dialog to display"

                                    //need to find the patient in the returned bundle so we can set the id
                                    data.data.entry.forEach(function (entry) {
                                        let loc = entry.response.location
                                        if (loc.indexOf('Patient') > -1) {
                                            //this is the created patient
                                            let ar = loc.split('/')
                                            let patientId = ar[ar.length -1]    //assume not _history
                                            if (loc.indexOf('_history') > -1) {
                                                //this is a versioned response (hapi
                                                 patientId = ar[ar.length -3]   //hapi includes history
                                            }

                                            patient.id = patientId
                                            $scope.currentPatient = patient;
                                        }
                                    })

                                },
                                function(err){
                                    alert(angular.toJson(err))

                                }
                            ).finally(
                                function(){
                                    $scope.waiting = false
                                    $scope.allowClose = true;
                                }

                            )




                        },function (err) {
                            console.log(err)
                        }
                    )


                    return

                    supportSvc.createPatient($scope.input).then(
                        function(patient){
                            var patientId = patient.id;
                            $scope.currentPatient = patient;

                            addLog('Added patient with the id : '+ patientId)
                            appConfigSvc.setCurrentPatient(patient);

                            //let patient = {resourceType:"Patient",name:[{text:"John Doe"}]}
                            //this is a new approach that uses a single bundle...
                            createSampleBundleSvc.makeSampleBundle(patient).then(
                                function (bundle) {
                                    console.log(JSON.stringify(bundle))

                                    var url = appConfigSvc.getCurrentDataServerBase();
                                    $scope.waiting = false;
                                    let config = serverInteractionSvc.getServerConfig()

                                    //perform validation
                                    let validateUrl = appConfigSvc.getCurrentDataServerBase() + "Bundle/$validate"

                                    $http.post(validateUrl,bundle,config).then(
                                        function (data) {
                                           $scope.validationResult = data.data
                                        },
                                        function(err){
                                            $scope.validationResult = data.data

                                        })

                                    /* TEMP - this is the save,*/
                                    $http.post(url,bundle,config).then(
                                        function (data) {
                                            alert("Data saved")
                                        },
                                        function(err){
                                            alert(angular.toJson(err))

                                        }
                                    ).finally(
                                        function(){
                                            $scope.waiting = false
                                            $scope.allowClose = true;
                                        }

                                    )




                                },function (err) {
                                    console.log(err)
                                }
                            )


                            if ( false && $scope.input.createSamples) {
                                addLog('Checking that the required reference resources exist');
                                supportSvc.checkReferenceResources().then (
                                    function() {
                                        addLog('adding Conditions...');
                                        supportSvc.buildConditionList(patientId,{logFn:addLog}).then(
                                            function(bundleConditions) {
                                                addLog('adding Encounters...');
                                                supportSvc.createEncounters(patientId,{},bundleConditions).then(
                                                    function(msg){
                                                        addLog('added encounters ' + msg);
                                                        var query = [];

                                                        supportSvc.createObservations(patientId,{logFn:addLog}).then(
                                                            function() {
                                                                supportSvc.buildMedicationList(patientId,{logFn:addLog}).then(
                                                                    function() {
                                                                        supportSvc.createAppointments(patientId,{logFn:addLog}).then(
                                                                            function() {
                                                                                supportSvc.buildAllergiesList(patientId,{logFn:addLog}).then(
                                                                                    function () {
                                                                                        $scope.saving = false;
                                                                                        supportSvc.resetResourceReferences();   //remove all the newly created resources from the reference resource list...
                                                                                        // not yet.. $scope.$close();
                                                                                        appConfigSvc.setCurrentPatient(patient);

                                                                                        $scope.loading = false;
                                                                                        $scope.allowClose = true;
                                                                                        $scope.allDone = true;
                                                                                    },
                                                                                    function (err) {
                                                                                        //error for allergies...
                                                                                        modalService.showModal({}, {bodyText: "Error saving allergies:"+angular.toJson(err)})
                                                                                        $scope.allowClose = true;

                                                                                    }
                                                                                )

                                                                            },
                                                                            function(err) {
                                                                                //error for appointments
                                                                                modalService.showModal({}, {bodyText: "Error saving appointments:"+angular.toJson(err)})
                                                                                $scope.allowClose = true;
                                                                            }
                                                                        )

                                                                    },
                                                                    function(err) {
                                                                        //error for meds
                                                                        modalService.showModal({}, {bodyText: "Error saving meds:"+angular.toJson(err)})
                                                                        $scope.allowClose = true;
                                                                    }



                                                                )


                                                            },function(err) {
                                                                //error for obs
                                                                modalService.showModal({}, {bodyText: "Error saving obs:"+angular.toJson(err)})
                                                                $scope.allowClose = true;

                                                            }
                                                        );



                                                        /* - this is an async create - works for hapi,but not Grahame. Maybe a server option?
                                                         addLog('adding Observations...');
                                                         query.push(supportSvc.createObservations(patientId,{logFn:addLog}));


                                                         addLog('adding Appointments...');
                                                         query.push(supportSvc.createAppointments(patientId,{logFn:addLog}));
                                                         addLog('adding Medication List...');
                                                         query.push(supportSvc.buildMedicationList(patientId,{logFn:addLog}));
                                                         addLog('adding Allergy List...');
                                                         query.push(supportSvc.buildAllergiesList(patientId,{logFn:addLog}));

                                                         $q.all(query).then(
                                                         //regardless of success or failure, turn off the saving flag
                                                         function() {
                                                         $scope.saving = false;
                                                         supportSvc.resetResourceReferences();   //remove all the newly created resources from the reference resource list...
                                                         // not yet.. $scope.$close();
                                                         appConfigSvc.setCurrentPatient(patient);
                                                         $rootScope.$emit('patientSelected',patient);
                                                         $scope.loading = false;
                                                         $scope.allowClose = true;
                                                         $scope.allDone = true;


                                                         },
                                                         function(err) {
                                                         alert('error creating sample resources\n'+angular.toJson(err))
                                                         $scope.allowClose = true;
                                                         $scope.loading = false;
                                                         }
                                                         )


                                                         */


                                                    },
                                                    function(err){
                                                        alert('error creating Encounters '+ angular.toJson(err));
                                                        $scope.allowClose = true;
                                                    }
                                                )




                                            },
                                            function(err) {
                                                alert('error building the condition list ' + angular.toJson(err))
                                                $scope.allowClose = true;
                                            }
                                        )},
                                    function(err){
                                        //service will display error
                                        alert('error checking reference resources')
                                        $scope.allowClose = true;
                                    }
                                ).finally(function(){
                                    $scope.waiting = false;
                                })



                            } else {

                              //  $scope.waiting = false;
                              //  $scope.allowClose = true;
                            }


                        },
                        function(err) {
                            var msg = "Unable to create the Patient. This can be caused by a CORS error on the server you're talking to. ";
                            msg += "Here's the error I got: "+angular.toJson(err);
                            modalService.showModal({}, {bodyText: msg})


                            $scope.waiting = false;
                            $scope.allowClose = true;
                        }
                    );


                };

                $scope.cancel = function () {
                    $scope.$close();
                }

        })
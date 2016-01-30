angular.module("sampleApp").controller('sampleCtrl', function ($rootScope, $scope,$http,supportSvc,resourceSvc) {

    $scope.input = {observations:[]};
    $scope.outcome = {};



    $scope.input.serverBase = "http://localhost:8080/baseDstu2/";

    supportSvc.setServerBase("http://localhost:8080/baseDstu2/");
    $scope.input.fname  = "Pater";
    $scope.input.lname = "Jones";
    $scope.input.gender = "male";

    $scope.input.action='patient';

    //$scope.input.dob = format('YYYY-MM-DD');

/*
    $scope.input.observations.push({code:'8310-5',display:'Body Temperature',min:36, max:39,unit:'C',round:10});
    $scope.input.observations.push({code:'8867-4',display:'Heart Rate',min:70,max:90,unit:'bpm',round:1});
    $scope.input.observations.push({code:'9279-1',display:'Respiratory Rate',min:25,max:35,unit:'resp/min',round:1});
    $scope.input.observations.push({code:'8302-2',display:'Height',max:90,min:90,unit:'cm',round:10});
    $scope.input.observations.push({code:'3141-9',display:'Weight',max:90,min:70,unit:'Kg',round:10});

*/
    var cfOrganization = null;
    //check that the reference resources need for creating sample resources exist - creating them if not...
    supportSvc.checkReferenceResources().then(
        function(referenceResources){

            //find the Organization resource that refers to the authoring tool (how we know whch patients were created by it)
            referenceResources.forEach(function(res){
                if (res.identifier && res.identifier.value == 'cf') {
                    cfOrganization = res;
                    loadSamplePatients();         //initial list of patients loaded through sample
                }
            });

            if (!cfOrganization) {
                alert("There was an error finding the clinFHIR Organization resource")
            }

            $scope.input.referenceResourcesAvailable = true;

        }
    );

    $scope.showPatient = function(patient) {
        console.log(patient);
    };

    $scope.typeSelected = function(vo) {
        //vo created to better support the display - has the type and the bundle containing all resources of that type
        delete $scope.outcome.selectedResource;
        delete $scope.vitalsTable;
        //console.log(type,bundle)
        $scope.outcome.selectedType = vo.type;
        $scope.outcome.allResourcesOfOneType = vo.bundle;

    };


    //when anindividual resource has been selected...
    $scope.resourceSelected = function(entry) {
        var resource = entry.resource;
        $scope.outcome.selectedResource = resource;     //for the json display
        $scope.resourceReferences = resourceSvc.getReference(resource,$scope.allResourcesAsList,$scope.allResourcesAsDict);
        console.log($scope.resourceReferences);
    };

    $scope.save = function() {
        $scope.outcome.log = [];

        //save the patient, get back the id then create & save the observations
        createPatient(function(err,id){
            if (id) {


                //createAppointments(id);
                supportSvc.createAppointments(id,{logFn:addLog});
                supportSvc.createEncounters(id).then(
                    function(msg) {
                        addLog(msg)
                        //at this point the new encounters are now in the referece array, so any resources that need to refer to an encounter can do so

                        supportSvc.createConditions(id,{logFn:addLog});
                        supportSvc.createObservations(id,{logFn:addLog});


                    }
                )
            }
        });
    };

    $scope.getVitals = function(){
        delete $scope.outcome.selectedResource;
        delete $scope.outcome.selectedType;
        delete $scope.outcome.allResourcesOfOneType;

        supportSvc.getVitals({patientId:$scope.currentPatient.id}).then(
            function(vo){
                var codes = vo.vitalsCodes;     //an array of codes - todo: add display
                var grid = vo.grid;             //obects where each property is a date (to become a colum
                //get a list of dates
                var dates = [];
                angular.forEach(grid,function(item,date){
                    dates.push(date);
                });
                dates.sort(function(a,b){
                    if (b > a) {
                        return 1
                    } else {
                        return -1
                    }
                });
             //   console.log(dates)




                //convert the data grid into one suitable for display - ie the dates (properties) as columns
                $scope.vitalsTable = {rows:[],dates:[]};




                var firstRow = true;
                codes.forEach(function(code){
                    var row = {code:code.code,unit:code.unit,display:code.display,cols:[]};
                    //now, add a column for each date...
                    dates.forEach(function(date){
                        item = grid[date];
                        var v = '';
                        if (item[code.code]) {      //is there a value for this code on this date
                            v = item[code.code].valueQuantity.value;
                        }
                        row.cols.push({value:v});
                        //add the date to the list of dates on the first row only
                        if (firstRow) {
                            $scope.vitalsTable.dates.push(date);
                        }

                    });
                    firstRow = false
                    $scope.vitalsTable.rows.push(row);
                });


//console.log($scope.vitalsTable)

            }
        )
    };

    var addLog = function(display) {
        $scope.outcome.log.push(display);
    };

    var createPatient = function(cb){
        var patient = {"resourceType": "Patient"};
        var nameText = $scope.input.fname + " " + $scope.input.lname;
        patient.name = [{use:'official',family:[$scope.input.lname],given:[$scope.input.fname],text:nameText}];
        patient.gender = $scope.input.gender;
        patient.birthDate= moment($scope.input.dob).format('YYYY-MM-DD');
        patient.managingOrganization = {display : 'sampleBuilder',reference : "Organization/"+cfOrganization.id};      //<<<< todo make a real org... - check at startus

        patient.text = {status:'generated',div:nameText};
        var uri = $scope.input.serverBase + "Patient";



        $http.post(uri,patient).then(
            function(data) {
               // console.log(data)
                var location = data.headers('location');
                $scope.outcome.patientId = location;
                var ar = location.split('/');
                var id = ar[5];
                loadSamplePatients();
               // console.log(id)
                cb(null,id);
                addLog('Added patient: '+ location)
            },
            function(err) {
               // console.log(err)
                alert(angular.toJson(err));
                cb(err);
            }
        )


    };

    var createAppointmentsDEP = function(patientId) {
        var bundle = {resourceType: 'Bundle', type: 'transaction', entry: []};
        var data = [
            {status:'pending',type:{text:'Cardiology'},description:'Investigate Angina',who:{text:'Clarence cardiology clinic'},delay:4},
            {status:'pending',type:{text:'GP Visit'},description:'Routine checkup',who:{text:'Dr Dave'},delay:7}
        ];

        var cnt = data.length;

        data.forEach(function(item){
            var appt = {resourceType:'Appointment',status:item.status};
            appt.type = {text : item.type.text};
            appt.description = item.description;
            appt.start = moment().add('days',item.delay).format();
            appt.end = moment().add('days',item.delay).add('minutes',15).format();
            appt.minutesDuration = 15;

            appt.participant = [{actor:{display:item.who.text},status:'accepted'}];    //the perfromed
            var txt ="<div><div>"+item.description + "</div><div>"+item.who.text+"</div></div>"
            appt.text = {status:'generated',div:txt}

            //the patient is modelled as a participant
            appt.participant.push({actor:{reference:'Patient/'+patientId},status:'accepted'});
            bundle.entry.push({resource:appt,request: {method:'POST',url: 'Appointment'}});


        });


        supportSvc.postBundle(bundle).then(
            function(data){
                addLog('Added '+cnt +' Appointments')
            }
        )




    };


    var createObservationsDEP = function(patientId,cb) {
        var bundle = {resourceType:'Bundle',type:'transaction',entry:[]};


        var cnt = 0;
        for (var i=0; i < 3; i++) {
            var date = moment().subtract(i,'weeks');
           // console.log(date.format());
            $scope.input.observations.forEach(function(item) {

                var value = item.min + (item.max - item.min) * Math.random();   //to be improved...
                value = Math.round(value * item.round) / item.round;


                var obs = {resourceType:'Observation',status:'final'};
                obs.valueQuantity = {value:value,unit:item.unit};
                obs.effectiveDateTime = date.format();
                obs.code = {'text':item.display,coding:[{system:'http://loinc.org',code:item.code}]};
                obs.subject = {reference:'Patient/'+patientId};
                //obs.text = {status:'generated',div:item.display + ", "+ value + " "+ item.unit + " "+ obs.effectiveDateTime}
                obs.text = {status:'generated',div:item.display + ", "+ value + " "+ item.unit };
                bundle.entry.push({resource:obs,request: {method:'POST',url: 'Observation'}});
                cnt ++;
            })
        }

        supportSvc.postBundle(bundle).then(
            function(data){
                addLog('Added '+cnt +' Observations')
            }
        );      //don't care about the response



    };



    var loadSamplePatients = function() {

        supportSvc.loadSamplePatients({organizationId:cfOrganization.id}).then(
            function(data){
                $scope.outcome.samplePatientsBundle = data.data
            },
            function(err){
                alert(angular.toJson(err));
            }
        )

    };


    $scope.showPatient = function(patient){
        $scope.currentPatient = patient;
        supportSvc.getAllData(patient.id).then(
            //returns an object hash - type as hash, contents as bundle
            function(allResources){
              //  console.log(allResources);

                $scope.outcome.allResources = allResources;
                //create a display object that can be sorted alphabetically...
                $scope.outcome.resourceTypes = [];
                angular.forEach(allResources,function(bundle,type){

                    if (bundle && bundle.total > 0) {
                        $scope.outcome.resourceTypes.push({type:type,bundle:bundle});
                    }


                });

                $scope.outcome.resourceTypes.sort(function(a,b){
                    if (a.type > b.type) {
                        return 1
                    } else {
                        return -1
                    }
                })


                //for the reference navigator we need a plain list of resources...
                $scope.allResourcesAsList = [];
                $scope.allResourcesAsDict = {};
                angular.forEach(allResources,function(bundle,type){
                    //console.log(bundle,type)
                    if (bundle.entry) {
                        bundle.entry.forEach(function(entry){
                            $scope.allResourcesAsList.push(entry.resource);
                            var hash = entry.resource.resourceType + "/"+entry.resource.id;
                            $scope.allResourcesAsDict[hash] = entry.resource;

                        })
                    }
                    //also need to add the reference resources to the dictionary (so thay can be found in outgoing references)
                    supportSvc.getReferenceResources().forEach(function(resource){
                        var hash = resource.resourceType + "/"+resource.id;
                        $scope.allResourcesAsDict[hash] = resource;
                    });
                    //and finally the patient!
                    var hash = "Patient/"+patient.id;
                    $scope.allResourcesAsDict[hash] = patient;


                })

            }
        )
    };




});
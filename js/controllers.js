angular.module("sampleApp").controller('sampleCtrl', function ($rootScope, $scope,$http,supportSvc) {

    $scope.input = {observations:[]};
    $scope.outcome = {};

    var organizationId = 5;

    $scope.input.serverBase = "http://localhost:8080/baseDstu2/";

    supportSvc.setServerBase("http://localhost:8080/baseDstu2/");
    $scope.input.fname  = "Pater";
    $scope.input.lname = "Jones";
    $scope.input.gender = "male";

    $scope.input.action='patient';

    //$scope.input.dob = format('YYYY-MM-DD');


    $scope.input.observations.push({code:'8310-5',display:'Body Temperature',min:36, max:39,unit:'C',round:10});
    $scope.input.observations.push({code:'8867-4',display:'Heart Rate',min:70,max:90,unit:'bpm',round:1});
    $scope.input.observations.push({code:'9279-1',display:'Respiratory Rate',min:25,max:35,unit:'resp/min',round:1});
    $scope.input.observations.push({code:'8302-2',display:'Height',max:90,min:90,unit:'cm',round:10});
    $scope.input.observations.push({code:'3141-9',display:'Weight',max:90,min:70,unit:'Kg',round:10});


    $scope.showPatient = function(patient) {
        console.log(patient);
    };

    $scope.typeSelected = function(type,bundle) {
        delete $scope.outcome.selectedResource;
        delete $scope.vitalsTable;
        //console.log(type,bundle)
        $scope.outcome.selectedType = type;
        $scope.outcome.allResourcesOfOneType = bundle;

    };

    $scope.save = function() {
        $scope.outcome.log = [];

        //save the patient, get back the id then create & save the observations
        createPatient(function(err,id){
            if (id) {

                createObservations(id);
                createAppointments(id)
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
                    //angular.forEach(grid,function(item,date){
                        console.log(item,date)
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
        patient.managingOrganization = {display : 'sampleBuilder',reference : "Organization/"+organizationId};      //<<<< todo make a real org... - check at startus

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

    var createAppointments = function(patientId) {
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


    var createObservations = function(patientId,cb) {
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

        supportSvc.loadSamplePatients({organizationId:organizationId}).then(
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
            }
        )
    };

    loadSamplePatients();         //initial list of patients loaded through sample


});
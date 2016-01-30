angular.module("sampleApp").controller('sampleCtrl', function ($rootScope, $scope,$http,supportSvc,resourceSvc) {

    $scope.input = {observations:[]};
    $scope.outcome = {};
    $scope.global = {state:'view'}



    $scope.input.serverBase = "http://localhost:8080/baseDstu2/";

    supportSvc.setServerBase("http://localhost:8080/baseDstu2/");
    $scope.input.fname  = "Pater";
    $scope.input.lname = "Jones";
    $scope.input.gender = "male";

    $scope.input.action='patient';

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


    //when an individual resource has been selected...
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


    var loadSamplePatients = function() {

        supportSvc.loadSamplePatients({organizationId:cfOrganization.id}).then(
            function(data){
                $scope.outcome.samplePatientsBundle = data.data
                $scope.outcome.patientsArray = []
  /*
                //create an array of patients for the UI - why should  have to do this?
                data.data.entry.forEach(function(entry){
                    $scope.outcome.patientsArray.push(entry.resource);
                })

*/

            },
            function(err){
                alert(angular.toJson(err));
            }
        )

    };


    //show a single patient - get their resources, create summary & display objects etc...
    $scope.showPatient = function(patient){



        $scope.currentPatient = patient;

        $scope.outcome.demographicsHtml = patient.text.div;


        supportSvc.getAllData(patient.id).then(
            //returns an object hash - type as hash, contents as bundle
            function(allResources){
                console.log(allResources);

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


    $scope.selectNewResource = function(reference) {
        console.log(reference)
        console.log($scope.allResourcesAsDict[reference.reference])

        $scope.resourceSelected({resource:reference.resource})
        //$scope.resourceSelected({resource:$scope.allResourcesAsDict[reference.reference]})

    }


});
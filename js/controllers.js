/* Controller for the sample creator
* Whan a patient is created, the 'managingOrganization' will be set to the pre-defined origanizatiion that the tool
* creates (see cfOrganization). Then, when displaying patients created by the tool we search on that organization.
* If the data server doesn't support that search, then the patient will be created, but can't be displayed at the moment
* */


angular.module("sampleApp").controller('sampleCtrl', function ($rootScope, $scope,$http,supportSvc,resourceSvc, $q,
                                                        CommonDataSvc,appConfigSvc) {

    //function to capitalize the first letter of a word...
    String.prototype.toProperCase = function () {
        return this.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
    };

    //config - in particular the servers defined. The samples will be going to the data server...
    //var config = appConfig.config();
    $scope.config = appConfigSvc.config();


    //set the current dataserver...
    $scope.dataServer = $scope.config.allKnownServers[0];   //{name:,url:}
    appConfigSvc.setCurrentDataServer($scope.dataServer);


    //allows the user to select a different server at run time to save the samples...
    $scope.input = {observations:[]};
    //$scope.input.serverBase = $scope.config.servers.data;

    $scope.outcome = {};

    //the initial state when viewing an existing patient.
    // 'new' = create a new resource using the resource builder. view = view existing data...
    $scope.global = {state:'view'}; //view | new

    //set defaults for the patients demographics. uses an on-line service if available
    $scope.input.fname  = "Peter";
    $scope.input.lname = "Jones";
    $scope.input.gender = "male";
    $scope.input.dob = "1972-05-15";



    //when a new resource is added by the resource builder, it fires an event. This is handled by the
    //host controller (rbFrameCtrl), but the sample creator also needs to know so it can update the patients
    //list of resources for display. This does seem a bit messy...
    $rootScope.$on('newresourcecreated',function(){
        //re-real all the data and update the local variables.
        //todo - should pull out the patient updating to a separate function and call from both...

        $scope.showPatient($scope.currentPatient);
    });




    //create a random name, and set the local scope. Set as a function so can use elsewhere...
    function getRandomName() {
        //this will call the external randomizing service...
        supportSvc.getRandomName().then(
            function(data) {
                try {
                    var user = data.data.results[0].user;
                    $scope.input.dob = moment(user.dob).format();
                    $scope.input.fname  = user.name.first.toProperCase();
                    $scope.input.lname = user.name.last.toProperCase();
                    $scope.input.gender = user.gender;
                } catch (ex) {
                    //in the case of an error - simply use the defaults
                    console.log('error getting sample name: ',ex)
                }

            }
        );
    }
    getRandomName();    //invoke the function above...




    //when setting the parameters for the sample data, set the initial page to the patient demographics
    $scope.input.action='patient';


    var cfOrganization = null;
    //check that the reference resources (Practitioner, Organization etc) need for creating sample resources exist
    // on the data server - creating them if not...
    supportSvc.checkReferenceResources().then(
        function(referenceResources){


            //find the Organization resource that refers to the authoring tool (how we know whch patients were created by it)
            referenceResources.forEach(function(res){
                if (res.resourceType == 'Organization'&& res.identifier && res.identifier[0].value == 'cf') {
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


    $scope.typeSelected = function(vo) {
        //vo created to better support the display - has the type and the bundle containing all resources of that type
        delete $scope.outcome.selectedResource;
        delete $scope.vitalsTable;

        $scope.outcome.selectedType = vo.type;
        $scope.outcome.allResourcesOfOneType = vo.bundle;
    };


    //when an individual resource has been selected...
    $scope.resourceSelected = function(entry) {
        var resource = entry.resource;
        $scope.outcome.selectedResource = resource;     //for the json display
        $scope.resourceReferences = resourceSvc.getReference(resource,$scope.allResourcesAsList,$scope.allResourcesAsDict);

    };

    $scope.save = function() {
        $scope.outcome.log = [];
        $scope.saving = true;

        supportSvc.createPatient($scope.input,cfOrganization).then(
            //create the patient, returning the patientid created by the server...
            function(id){
                //now we can create the other resources...
                addLog('Added patient with the id : '+ id)
                loadSamplePatients();   //update the sample patients list...

                supportSvc.createEncounters(id).then(
                    function(msg) {
                        addLog(msg);

                        //at this point the new encounters are now in the referece array, so any resources that need to refer to an encounter can do so

                        //process in a

                        var query = [];
                        query.push(supportSvc.createConditions(id,{logFn:addLog}));
                        query.push(supportSvc.createObservations(id,{logFn:addLog}));
                        query.push(supportSvc.createAppointments(id,{logFn:addLog}));
                        query.push(supportSvc.buildMedicationList(id,{logFn:addLog}));

                        

                        $q.all(query).then(
                            //regardless of success or failure, turn off the saving flag
                            function() {
                                $scope.saving = false;
                                supportSvc.resetResourceReferences();   //remove all the newly created resources from the reference resource list...
                            }
                        )
                    }
                )


            },
            function(err){
                alert('Unable to create patient: ' + angular.toJson(err));
                $scope.saving = false;
            }
        );


    };


    $scope.getVitals = function(){
        //return the list of vitals observations so that a table can be generated
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


            }
        )
    };

    var addLog = function(display) {
        $scope.outcome.log.push(display);
    };


    var loadSamplePatients = function() {

        supportSvc.loadSamplePatients({organizationId:cfOrganization.id}).then(
            function(data){
                $scope.outcome.samplePatientsBundle = data.data
                $scope.outcome.patientsArray = []


            },
            function(err){
                alert(angular.toJson(err));
            }
        )

    };


    //show a single patient - get their resources, create summary & display objects etc...
    $scope.showPatient = function(patient){
        //triggerred by the 'onChange' event of the patiet selection - hence when the server is changed and a
        //new set of patients retrieved, the eveny will be triggerred with no actual patient selected...
        if (! patient) {
            return;
        }


        $scope.loadingPatient = true;       //will display the loading gif...
        $scope.currentPatient = patient;

        $scope.outcome.demographicsHtml = patient.text.div;


        supportSvc.getAllData(patient.id).then(
            //returns an object hash - type as hash, contents as bundle - eg allResources.Condition = {bundle}
            function(allResources){

//console.log(allResources);

                //this is so the resourceBuilder directive  knows who the patient is - and their data.
                //the order is significant - allResources must be set first...
                CommonDataSvc.setAllResources(allResources);
                $rootScope.currentPatient = patient;

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
                });


                //for the reference navigator we need a plain list of resources...
                $scope.allResourcesAsList = [];
                $scope.allResourcesAsDict = {};
                angular.forEach(allResources,function(bundle,type){

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

        ).finally(function(){
            $scope.loadingPatient = false;
        })
    };


    $scope.selectNewResource = function(reference) {
        $scope.resourceSelected({resource:reference.resource})

    };

    $scope.selectServer = function(server){
        appConfigSvc.setCurrentDataServer(server);
        //need to check that the refernence resources (Practitioner, Organization) exist on the new server...
        $scope.saving = true;
        supportSvc.checkReferenceResources().then(
            function(){
                $scope.dataServer = server;        //so we can show the data server...
                appConfigSvc.setCurrentDataServer($scope.dataServer);
                loadSamplePatients();       //get all the sample patients created by this app on that server

                //these are all removing the patient specific structures. Might be better to move to a function...
                delete $scope.currentPatient;   //no current patient selected
                delete $scope.outcome.allResources;     //all the resources for the patient
                delete $scope.outcome.resourceTypes;    //all the resource types for the patient
                delete $scope.outcome.allResourcesOfOneType;    //the resources of a selected type

                if ($scope.outcome && $scope.outcome.log) {
                    $scope.outcome.log.length = 0;          //the log of actions...
                }


                //selected resource & vitals...
                delete $scope.outcome.selectedResource;  //the currently selected resource
                delete $scope.vitalsTable;

                getRandomName();                        //get a new patient name (just in case)
                CommonDataSvc.setAllResources(null);    //the service that lets the resource builder know the patients resources (needed for resource references)
                //$scope.input.serverBase= server.url;    // the resource creator routines use this...
            },
            function(err){
                alert('error creating the reference resoruces:' +angular.toJson(err));
            }
        ).finally(function(){
                $scope.saving = false;
            })


    }

});
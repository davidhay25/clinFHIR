angular.module("sampleApp").service('supportSvc', function($http,$q,appConfigSvc,GetDataFromServer,Utilities) {

    //options for building the samples that will come from a UI
    var buildConfig = {};
    buildConfig.encounterObservation = 1; //.5;      //chance that a group of observations will reference an encounter
    buildConfig.createProblemList = 'yes';      // yes | no | empty
    buildConfig.problemListLength = 3;          //size of the problemlist

    //so we can identify identifiers that we create...
    var identifierSystem ='http://fhir.hl7.org.nz/identifier';

    var observations=[];    //used for generating sample data plus vitals...
    observations.push({code:'8310-5',display:'Body Temperature',min:36, max:37,unit:'C',round:10,isVital:true});
    observations.push({code:'8867-4',display:'Heart Rate',min:70,max:90,unit:'bpm',round:1,isVital:true});
    observations.push({code:'9279-1',display:'Respiratory Rate',min:25,max:35,unit:'resp/min',round:1,isVital:true});
    observations.push({code:'8302-2',display:'Height',max:90,min:90,unit:'cm',round:10});
    observations.push({code:'3141-9',display:'Weight',max:80,min:70,unit:'Kg',round:10,isVital:true});

    //load the json file with all the optional values for creating samples...

    var optionalValues;
    $http.get("artifacts/options.json").then(
        function(data) {
            optionalValues = data.data
        }
    );

    //create as a 'global' function - todo: is this the best way?
    var getResourceIdFromHeaders = function(headers) {
        //get the Id that the server assigned to the resource. The spec allows this to be either Location or Content-Location


        //find where the serverId is...
        var serverId;
        serverId = headers('Content-Location');
        if (! serverId) {
            serverId = headers('Location');
        }
        if (! serverId) {
            return null;
        }
        //the is is (or should be) of the format: [base]/[type]/[id]/_history/[vid] - so get the 3rd frm the end...
        var ar = serverId.split('/');

        if (serverId.indexOf('_history') > -1) {
            return ar[ar.length-3];     //version specfic
        } else {
            //not version specific
            return ar[ar.length-1];
        }

    }



    //resources that are used as reference targets by other resources. These need to be reset each time a
    // patient is created or a server changed, as when a patient is created some of the resources are added
    // to this arrray (like Encounter) so that they can be targets of other resources (eg when setting
    // Condition.encounter..
    var referenceResources = [];

    function setUpReferenceResources(fhirVersion) {
        referenceResources.length = 0;

        if (fhirVersion == 3) {
            referenceResources.push({resourceType:'Practitioner',name:[{text:'Dr John Doe'}],
                identifier : [{value:'jd',system:identifierSystem}],text:{status:'generated',div:"<div xmlns='http://www.w3.org/1999/xhtml'>Dr John Doe</div>"}});
            referenceResources.push({resourceType:'Practitioner',name:[{text:'Dr Annette Jones'}],
                identifier : [{value:'aj',system:identifierSystem}],text:{status:'generated',div:"<div xmlns='http://www.w3.org/1999/xhtml'>Dr Annette Jones</div>"}});
            referenceResources.push({resourceType:'Organization',name:'clinFHIR Sample creator',
                identifier : [{value:'cf',system:identifierSystem}],text:{status:'generated',div:"<div xmlns='http://www.w3.org/1999/xhtml'>clinFhir</div>"}});
        } else {
            referenceResources.push({resourceType:'Practitioner',name:{text:'Dr John Doe'},
                identifier : [{value:'jd',system:identifierSystem}],text:{status:'generated',div:"<div>Dr John Doe</div>"}});
            referenceResources.push({resourceType:'Practitioner',name:{text:'Dr Annette Jones'},
                identifier : [{value:'aj',system:identifierSystem}],text:{status:'generated',div:"<div>Dr Annette Jones</div>"}});
            referenceResources.push({resourceType:'Organization',name:'clinFHIR Sample creator',
                identifier : [{value:'cf',system:identifierSystem}],text:{status:'generated',div:"<div>clinFhir</div>"}});
        }
    }

    //when invoking the create, we need the fhir verson as Practioner.name chnaged multiplicity..
    var serverBase = appConfigSvc.getCurrentDataServerBase();
    var serverObject = appConfigSvc.getServerByUrl(serverBase);
    var fhirVersion = 2
    if (serverObject) {
        fhirVersion = serverObject.version;
    }
    setUpReferenceResources(fhirVersion);

    return {
        getResourceIdFromHeaders : getResourceIdFromHeaders,
        resetResourceReferences : function() {
            setUpReferenceResources();
        },
        getRandomName : function() {
            //get a random name from an on-line service...

            return $http.get('https://randomuser.me/api/?format=json&nat=nz');



        },
        getReferenceResources : function(){
            return referenceResources;
        },
        createPatient : function(input,cfOrganization) {
            var deferred = $q.defer();

            var patient = {"resourceType": "Patient"};
            var nameText = input.fname + " " +input.lname;
            //multiplicity of famly name changed in stu 3
            if (appConfigSvc.getCurrentDataServerBase().version ==2) {
                patient.name = [{use:'official',family:[input.lname],given:[input.fname],text:nameText}];
            } else {
                patient.name = [{use:'official',family:input.lname,given:[input.fname],text:nameText}];
            }


            patient.gender = input.gender;
            patient.birthDate= moment(input.dob).format('YYYY-MM-DD');
            if (input.identifier) {
                //var identifier = appConfigSvc.config().standardSystem.identifierSystem + "|"+input.identifier;
                patient.identifier = [{system:appConfigSvc.config().standardSystem.identifierSystem,value:input.identifier}]
            }



            if (cfOrganization) {
                patient.managingOrganization = {display : 'sampleBuilder',reference : "Organization/"+cfOrganization.id};      //<<<< todo make a real org... - check at startus

            }

            patient.text = {status:'generated',div:"<div xmlns='http://www.w3.org/1999/xhtml'>"+nameText+'</div>'};


            var uri = appConfigSvc.getCurrentDataServerBase() + "Patient";

            $http.post(uri,patient).then(
                function(data) {

                    var id = getResourceIdFromHeaders(data.headers)
                    if (id) {
                        patient.id = id;
                        //NOTE  - CHANGED RESPONSE !!!
                        deferred.resolve(patient);
                    } else {
                        deferred.reject({err:'The server did not return a valid id'})
                    }

                },
                function(err) {

                    deferred.reject(err)

                }
            );

            return deferred.promise;
        },
        createAppointments : function(patientId,options) {
            var deferred = $q.defer();
            var bundle = {resourceType: 'Bundle', type: 'transaction', entry: []};
            var data = [
                {status:'pending',type:{text:'Cardiology'},description:'Investigate Angina',who:{text:'Clarence cardiology clinic'},delay:4},
                {status:'pending',type:{text:'GP Visit'},description:'Routine checkup',who:{text:'Dr Dave'},delay:7}
            ];

            var cnt = data.length;

            data.forEach(function(item,index){
                var id = 't'+ new Date().getTime() + index;
                var appt = {resourceType:'Appointment',status:item.status};
                appt.id = id;
                //note that this is serviceType in STU-2 appt.type = {text : item.type.text};
                appt.description = item.description;
                appt.start = moment().add('days',item.delay).format();
                appt.end = moment().add('days',item.delay).add('minutes',15).format();
                appt.minutesDuration = 15;

                appt.participant = [{actor:{display:item.who.text},status:'accepted'}];    //the perfromed
                var txt ="<div xmlns='http://www.w3.org/1999/xhtml'><div>"+item.description + "</div><div>"+item.who.text+"</div></div>"
                appt.text = {status:'generated',div:txt}

                //the patient is modelled as a participant
                appt.participant.push({actor:{reference:'Patient/'+patientId},status:'accepted'});
                bundle.entry.push({fullUrl:id,resource:appt,request: {method:'POST',url: 'Appointment'}});


            });


            this.postBundle(bundle).then(
                function(data){
                    if (options.logFn) {
                        options.logFn('Added '+cnt +' Appointments')
                    }
                    deferred.resolve();
                }, function(err) {
                    alert(angular.toJson(err));
                    if (options.logFn) {
                        options.logFn('Adding appointments failed')
                    }
                    deferred.reject();
                }
            );

            return deferred.promise;


        },
        createObservations : function(patientId,options) {
            var deferred = $q.defer();
            var bundle = {resourceType:'Bundle',type:'transaction',entry:[]};

            var cnt = 0;
            for (var i=0; i < 6; i++) {                 //5 sets per type of observation
                var date = moment().subtract(i,'weeks');


                //decide if this set of observations will be linked to an encounter...
                var encounter = this.getRandomReferenceResource('Encounter',buildConfig.encounterObservation);    //half the time it will be null

                observations.forEach(function(item,j) {
                    var id = 't'+ new Date().getTime() + i + j;
                    var value = item.min + (item.max - item.min) * Math.random();   //to be improved...
                    value = Math.round(value * item.round) / item.round;


                    var obs = {resourceType:'Observation',status:'final'};
                    obs.id = id;
                    obs.valueQuantity = {value:value,unit:item.unit};
                    obs.effectiveDateTime = date.format();
                    obs.code = {'text':item.display,coding:[{system:'http://loinc.org',code:item.code}]};
                    obs.subject = {reference:'Patient/'+patientId};
                    if (encounter) {
                        obs.encounter = {reference:'Encounter/'+encounter.id}
                    }

                    //obs.text = {status:'generated',div:item.display + ", "+ value + " "+ item.unit + " "+ obs.effectiveDateTime}
                    var text = item.display + ", "+ value + " "+ item.unit;
                    obs.text = {status:'generated',div: "<div  xmlns='http://www.w3.org/1999/xhtml'>"+text+'</div>'};
                    bundle.entry.push({fullUrl:id,resource:obs,request: {method:'POST',url: 'Observation'}});
                    cnt ++;
                })
            }

            this.postBundle(bundle).then(
                function(data){
                    if (options && options.logFn){options.logFn('Added '+cnt +' Observations')}

                    deferred.resolve();
                },
                function(err) {
                    alert('error saving Observations '+ angular.toJson(err));
                    deferred.reject();
                }
            );      //don't care about the response
            return deferred.promise;
        },
        createConditionsDEP : function (patientId,options) {

            //create a set of encounters for the patient and add them to the referenceResources (just for this session)
            var deferred = $q.defer();
            var that = this;
            options = options || {}
            options.count = options.count || 5;     //number to reate
            options.period = options.period || 30;  //what period of time the enounters should be over
            var bundle = {resourceType: 'Bundle', type: 'transaction', entry: []};

            var fhirVersion = appConfigSvc.getCurrentFhirVersion();
            for (var i = 0; i < options.count; i++) {
                var id = 't'+ new Date().getTime() + i;
                var cond = {resourceType: 'Condition'};
                cond.id = id;
                if (fhirVersion == 2) {
                    cond.patient = {reference:'Patient/'+patientId};
                } else {
                    cond.subject = {reference:'Patient/'+patientId};
                }

                cond.verificationStatus = this.getRandomEntryFromOptions('conditionVerificationStatus');
                cond.code = this.getRandomEntryFromOptions('conditionCode');
                var encounter = this.getRandomReferenceResource('Encounter');   //there may not be an encounter (if they aren't being created)
                if (encounter) {
                    cond.encounter = {reference: "Encounter/"+ encounter.id};
                }
                var practitioner = this.getRandomReferenceResource('Practitioner');     //there will always be a practitioner
                cond.asserter = {reference: "Practitioner/"+ practitioner.id};

                cond.text = {status:'generated',div:"<div  xmlns='http://www.w3.org/1999/xhtml'>"+cond.code.text+'</div>'};
                bundle.entry.push({fullUrl:id,resource:cond,request: {method:'POST',url: 'Condition'}});
            }

            this.postBundle(bundle,referenceResources).then(
                function(data){
                    //now add the the referenceResources array in memory so that they can be used by other resources.
                    data.data.entry.forEach(function(entry){

                    });

                    if (options.logFn) {
                        options.logFn('Added ' + options.count + ' Conditions')
                    }

                    //now to see if a problem list shuld be created
                    switch (buildConfig.createProblemList) {
                        case 'yes' :
                            that.buildProblemList(patientId).then(
                                function(){
                                    if (options.logFn) {
                                        options.logFn('Added ProblemList')
                                    }
                                },
                                function() {
                                    if (options.logFn) {
                                        options.logFn('Error creating ProblemList- not saved')
                                    }
                                }
                            ).finally(function(){
                                //don't need to do anything different based on the outcome of the operation

                                deferred.resolve();
                            });
                            break;
                        default :
                            deferred.resolve();
                            break;
                    }


                },
                function(err) {
                    deferred.reject("Error saving Conditions")
                }
            );
            return deferred.promise;

        },
        buildProblemListDEP : function(id,empty) {
            //make a problem list from the conditions
            var deferred = $q.defer();
            var today = moment().format();
            var problemList = {resourceType : 'List',title:'Problem List', entry:[], date : today,
                subject : {reference:'Patient/'+id},
                status : 'current',
                mode: 'snapshot',
                code : {coding : [{code:'problems',system:'http://hl7.org/fhir/list-example-use-codes'}]}};


            var encounter = this.getRandomReferenceResource('Encounter');   //there may not be an encounter (if they aren't being created)
            if (encounter) {
                problemList.encounter = {reference: "Encounter/"+ encounter.id};
            }

            //now add the conditions to the list
            for (var i=0; i < buildConfig.problemListLength; i++) {
                var condition = this.getRandomReferenceResource('Condition');
                var entry = {date: today, item : {reference : 'Condition/'+condition.id}}
                problemList.entry.push(entry);
            }
            
            
            // ... and save
            var url = appConfigSvc.getCurrentDataServerBase()+ "List";
            $http.post(url,problemList).then(
                function (data) {
                    deferred.resolve();
                },
                function(err){
                    alert('Error saving problem list:\n'+angular.toJson(err))
                    deferred.reject(err)
                }
            );

            return deferred.promise;

        },
        buildAllergiesList : function(patientId,options) {

            var deferred = $q.defer();
            deferred.resolve();
            return deferred.promise;



            var today = moment().format();
            var allergyList = {resourceType : 'List',title:'Allergies List', entry:[], date : today,
                subject : {reference:'Patient/'+patientId},
                status : 'current',
                mode: 'snapshot',
                code : {coding : [{code:'allergies',system:'http://hl7.org/fhir/list-example-use-codes'}]}};


            var url = "artifacts/allergies.json";     //the reference list of medications to add to the list
            var bundle = {resourceType:'Bundle',type:'transaction',entry:[]};
            var listBundleEntry = {resource : allergyList,request:{method:'POST',url:'List/'}};

            bundle.entry.push(listBundleEntry);
            GetDataFromServer.localServerQuery(url).then(
                function(data) {
                    var refList = data.data;
                    refList.forEach(function(allergy,inx){
                        //each entry is a basic medication statement - needs to have the patient specific stuff added
                        allergy.patient = {reference:'Patient/'+patientId};
                        allergy.id = 'al'+inx;
                        allergy.reporter = {reference:'Patient/'+patientId};

                       
                        var entry = {date: today, item : {reference : 'AllergyIntolerance/'+allergy.id}}
                        allergyList.entry.push(entry);

                        var bundleEntry = {resource : allergy,request:{method:'POST',url:'AllergyIntolerance/'}};

                        bundle.entry.push(bundleEntry);

                    });


                    //console.log(angular.toJson(bundle));


                    // ... and save - as a transaction
                    var url = appConfigSvc.getCurrentDataServerBase();
                    $http.post(url,bundle).then(
                        function (data) {
                            if (options.logFn) {
                                options.logFn('Added Allergies List')
                            }
                            //deferred.resolve(refList);
                            deferred.resolve(refList);
                        },
                        function(err){
                            alert('Error saving allergy list:\n'+angular.toJson(err))
                            deferred.reject(err)
                        }
                    );



                },
                function(err) {
                    alert('error getting list of allergies to create: ' + angular.toJson(err))
                }
            );



            return deferred.promise;

        },
        buildConditionList : function(patientId,options) {
            var today = moment().format();
            var conditionList = {resourceType : 'List',title:'Problems List', entry:[], date : today,
                subject : {reference:'Patient/'+patientId},
                status : 'current',
                mode: 'snapshot',
                code : {coding : [{code:'problems',system:'http://hl7.org/fhir/list-example-use-codes'}]}};

            var deferred = $q.defer();
            var url = "artifacts/conditions.json";     //the reference list of conditions to add to the list
            var bundle = {resourceType:'Bundle',type:'transaction',entry:[]};
            var listBundleEntry = {resource : conditionList,request:{method:'POST',url:'List/'}};

            bundle.entry.push(listBundleEntry);
            GetDataFromServer.localServerQuery(url).then(
                function(data) {
                    var refList = data.data;
                    var fhirVersion = appConfigSvc.getCurrentFhirVersion();
                    refList.forEach(function(condition,inx){
                        //each entry is a basic condition - needs to have the patient specific stuff added
                        if (fhirVersion == 2) {
                            //the onset[x] property got renamed...
                            var onset = condition.onsetAge
                            condition.onsetQuantity = onset;
                            delete condition.onsetAge;

                            condition.patient = {reference:'Patient/'+patientId};
                        } else {
                            condition.subject = {reference:'Patient/'+patientId};

                            //category became multiple in stu3
                            var category = angular.copy(condition.category );
                            condition.category =[category];

                            if (condition.evidence && condition.evidence[0].code) {
                                var eCode = angular.copy(condition.evidence[0].code);
                                condition.evidence[0].code = [eCode]
                            }

                        }

                        condition.id = 'cond'+inx;
                        var entry = {date: today, item : {reference : 'Condition/'+condition.id}}
                        conditionList.entry.push(entry);

                        var bundleEntry = {resource : condition,request:{method:'POST',url:'Condition/'}};

                        bundle.entry.push(bundleEntry);

                    });

                    // ... and save - as a transaction
                    var url = appConfigSvc.getCurrentDataServerBase();
                    $http.post(url,bundle).then(
                        function (data) {
                            //deferred.resolve(refList);
                            if (options.logFn) {
                                options.logFn('Added Conditions List')
                            }
                            deferred.resolve(data.data);
                        },
                        function(err){
                            alert('Error saving condition list:\n'+angular.toJson(err))
                            deferred.reject(err)
                        }
                    );

                }
                ,
                function(err) {
                    alert('error getting list of conditions to create: ' + angular.toJson(err))
                }
            );

            return deferred.promise;

        },
        buildMedicationList : function(patientId,options) {
            var today = moment().format();
            var medList = {resourceType : 'List',title:'Medication List', entry:[], date : today,
                subject : {reference:'Patient/'+patientId},
                status : 'current',
                mode: 'snapshot',
                code : {coding : [{code:'medications',system:'http://hl7.org/fhir/list-example-use-codes'}]}};

            var deferred = $q.defer();
            var url = "artifacts/medications.json";     //the reference list of medications to add to the list
            var bundle = {resourceType:'Bundle',type:'transaction',entry:[]};
            var listBundleEntry = {resource : medList,request:{method:'POST',url:'List/'}};

            bundle.entry.push(listBundleEntry);
            GetDataFromServer.localServerQuery(url).then(
                function(data) {
                    var fhirVersion = appConfigSvc.getCurrentFhirVersion();

                    var refList = data.data;
                    refList.forEach(function(medStmt,inx){
                        //each entry is a basic medication statement - needs to have the patient specific stuff added
                        if (fhirVersion == 2) {
                            medStmt.patient = {reference:'Patient/'+patientId};
                        } else {
                            medStmt.subject = {reference:'Patient/'+patientId};
                            medStmt.taken='y';
                        }

                        medStmt.status = "active";
                        medStmt.id = 'med'+inx;
                        //console.log(angular.toJson(medStmt));


                        var entry = {date: today, item : {reference : 'MedicationStatement/'+medStmt.id}}
                        medList.entry.push(entry);

                        var bundleEntry = {resource : medStmt,request:{method:'POST',url:'MedicationStatement/'}};

                        bundle.entry.push(bundleEntry);

                    });


                    // ... and save - as a transaction
                    var url = appConfigSvc.getCurrentDataServerBase();
                    $http.post(url,bundle).then(
                        function (data) {
                            if (options.logFn) {
                                options.logFn('Added Medications List')
                            }
                            deferred.resolve(refList);
                        },
                        function(err){
                            alert('Error saving medication list:\n'+angular.toJson(err))
                            deferred.reject(err)
                        }
                    );



                    //deferred.resolve(refList);
                },

                function(err) {
                    alert('error getting list of medications to create: ' + angular.toJson(err))
                }
            );

            
            
            return deferred.promise;
            
        },
        createEncounters : function (patientId,options,bundleConditions) {
            //create a set of encounters for the patient and add them to the referenceResources (just for this session)
            var fhirVersion = appConfigSvc.getCurrentDataServer().version; //format changed between versions
            console.log(bundleConditions)
            var deferred = $q.defer();
            options = options || {}
            options.count = options.count || 10;     //number to reate
            options.period = options.period || 60;  //what period of time the enounters should be over
            var bundle = {resourceType:'Bundle',type:'transaction',entry:[]};

            for (var i= 0; i< options.count;i++) {
                var id = 't'+ new Date().getTime() + i;
                var enc = {resourceType:'Encounter',status:'finished'};
                enc.id = id;


                if (fhirVersion == 2) {
                    enc.indication = []
                } else {
                    enc.diagnosis = []
                }
                //find a random number of Random Condition as the indication

                var cnt = parseInt(5 * Math.random());
                for (var j=0; j < cnt; j++) {
                    var ref = bundleConditions.entry[parseInt(bundleConditions.entry.length * Math.random())];
                    //console.log(ref)
                    if (ref.response.location && ref.response.location.indexOf('Condition') > -1) {

                        if (fhirVersion == 2) {
                            enc.indication.push({reference:ref.response.location});
                        } else {
                            enc.diagnosis.push({condition: {reference:ref.response.location}});
                        }
                    }

                }

                //an empty array causes a parsing error on Grahames server...
                if (enc.indication && enc.indication.length == 0) {
                    delete enc.indication;
                }

                if (enc.diagnosis && enc.diagnosis.length == 0) {
                    delete enc.diagnosis;
                }


                //version difference...
                if (fhirVersion == 2) {
                    enc.patient = {reference:'Patient/'+patientId};
                } else {
                    enc.subject = {reference:'Patient/'+patientId};
                }




                enc.reason = [];
                enc.reason.push(this.getRandomEntryFromOptions('encounterReason'));
                enc.type = [(this.getRandomEntryFromOptions('encounterType'))];
                //var da = moment().subtract(parseInt(options.period * Math.random()),'days');
                enc.period = {start:moment().subtract(parseInt(options.period * Math.random()),'days')};
                var practitioner = this.getRandomReferenceResource('Practitioner');
                enc.participant = [];
                enc.participant.push({individual:{reference:'Practitioner/'+practitioner.id,display:practitioner.name.text}});  //safe 'cause I created the practitioner...


                bundle.entry.push({fullUrl:id,resource:enc,request: {method:'POST',url: 'Encounter'}});

            }

            console.log(bundle)

            this.postBundle(bundle,referenceResources).then(
                function(data){


                    deferred.resolve('Added ' + options.count + ' Encounters')
                },
                function(err) {
                    deferred.reject(err)
                }
            );
            return deferred.promise;

        },
        getRandomEntryFromOptions : function(key){
            //return a random edtry from the options onject. The caller must know what the type of subjct object will be...
            var lst = optionalValues[key];
            if (lst) {
                return lst[parseInt(lst.length * Math.random())];
            } else {
                return {};
            }
        },
        getRandomReferenceResource : function(type,probabliliyOfNull) {
            //get a reference resource of some type at random.

            //First - can the response be empty?
            if (probabliliyOfNull) {
                if (Math.random() < probabliliyOfNull) {
                    return;
                }
            }
            // Next assemble the list of possiilities..
            var lst = [];
            referenceResources.forEach(function(res){

                if (res.resourceType == type) {
                    lst.push(res)
                }
            });
            //now, choose one at randomn
            return lst[parseInt(lst.length * Math.random())];
        },
        checkReferenceResources : function() {
            //there are some reference resources that need to be created or located at startup...
            var deferred = $q.defer();
            var arQuery = [];
            referenceResources.forEach(function(res){
                delete res.id;      //because this function is called when a server is selected, any Id from a previous server must be removed...
                arQuery.push(
                checkAndInsert(res).then(
                    function(){
                        //maybe not neded
                    })
                )
            });


            $q.all(arQuery).then(
                function(data){

                    deferred.resolve(referenceResources);
                },
                function(err){
                    alert("error checking reference data:\n\n"+ angular.toJson(err));
                    deferred.reject(err);
                });

            return deferred.promise;

            //a function to check whether a resource already exists (based on the identifier), adding it if new...
            //used by the 'reference' resources - eg Practitioner, Organization...
            function checkAndInsert(res) {
                var deferred = $q.defer();

                //only check the resources with an identifier.
                if (!res.identifier) {
                    //alert('The resource has no identifer: '+angular.toJson(res))
                    deferred.resolve();
                    return deferred.promise;
                }

                var identifierQuery = res.identifier[0].system + '|' + res.identifier[0].value;
                var url = appConfigSvc.getCurrentDataServerBase() + res.resourceType + "?identifier="+identifierQuery;

                $http.get(url).then(
                    function(data) {
                        if (data.data && data.data) {
                            var cnt = data.data.total;
                            switch (cnt) {
                                case 0 :
                                    //need to add this one
                                    var postUrl = appConfigSvc.getCurrentDataServerBase() + res.resourceType;
                                    $http.post(postUrl,res).then(
                                        function(data){
                                            //need to get the resource id
                                            var id = getResourceIdFromHeaders(data.headers)
                                            if (! id) {
                                                deferred.reject({err:'The server did not return a valid id'})
                                            }


                                            res.id = id;

                                            deferred.resolve()
                                        },
                                        function(err) {
                                            alert(angular.toJson(err))
                                            deferred.resolve()
                                        }
                                    )
                                    break;
                                case 1 :
                                    //there is 1 resource in the response - use it
                                    //should be safe...
                                    res.id = data.data.entry[0].resource.id;  //todo - might want the whole resourc...
                                    deferred.resolve()
                                    break;
                                default :

                                    console.log('There are ' + cnt + ' resources with the identifier '+identifierQuery+'(Picking the first one)');
                                    res.id = data.data.entry[0].resource.id;
                                    deferred.resolve()
                                    break;
                            }
                        }
                    },function(err) {
                        console.log(err);
                        alert("There was an error accessing the server. It may not be set up for CORS, " +
                            "in which case this application won't work. Sorry.\n Status code:"+err.status);
                    }
                );
                return deferred.promise;
            }

        },

        getVitals : function(vo) {
            //get the observation types shown as vitals, and return the raw bundle plus a grid for display...
            //only 100 observations at the moment
            var deferred = $q.defer();
            var patientId = vo.patientId;

            var that = this;
            var response = {vitalsCodes:[]};      //the response object as we want to return more than one thing...

            //create the url for retrieving the vitals data. Want to show how it could be done...
            var url = appConfigSvc.getCurrentDataServerBase()+"Observation?subject=Patient/"+patientId;

            //create the list of codes to include in the query
            var filterString="";
            observations.forEach(function(item){
                if (item.isVital) {
                    filterString += ","+item.code;      //update the filter string used in the query
                    response.vitalsCodes.push({code:item.code,display:item.display,unit:item.unit});    //the list of codes used by the display
                }
            });

            filterString = filterString.substring(1);
            url += "&code="+filterString;
            url += "&_count=100";


            $http.get(url).then(
                function(data){

                    response.grid = that.getGridOfObservations(data.data);      //an object hashed by date.

                    deferred.resolve(response)

                },
                function(err){
                    alert(angular.toJson(err))
                    deferred.reject(err)
                }
            );
            return deferred.promise;
        },

        getAllResourcesFollowingPaging : function(url,limit){
            //Get all the resurces specified by a query, following any paging...
            //http://stackoverflow.com/questions/28549164/how-can-i-do-pagination-with-bluebird-promises

            //add the count parameter
            if (url.indexOf('?') > -1) {
                url += "&_count=50"
            } else {
                url += "?_count=50"
            }

            var deferred = $q.defer();

            limit = limit || 500;           //absolute max of 500

            var allResources = [];

            getPage(url);

            //get a single page of data
            function getPage(url) {
                return $http.get(url).then(
                    function(data) {
                        var bundle = data.data;     //the response is a bundle...

                        //copy all resources into the array..
                        if (bundle && bundle.entry) {
                            bundle.entry.forEach(function(e){
                                allResources.push(e.resource);
                            })
                        }

                        //is there a link
                        if (bundle.link) {
                            var moreToGet = false;
                            for (var i=0; i < bundle.link.length; i++) {
                                var lnk = bundle.link[i];

                                //if there is a 'next' link and we're not at the limit then get the next page
                                if (lnk && lnk.relation == 'next' && allResources.length < limit) {
                                    moreToGet = true;
                                    var url = lnk.url;
                                    getPage(url);
                                    break;
                                }
                            }
                            
                            //all done, return...
                            if (! moreToGet) {
                                deferred.resolve(allResources);
                            }
                        } else {
                            deferred.resolve(allResources);
                        }
                    },
                    function(err) {
                        deferred.reject(err);
                    }
                )
            }

            return deferred.promise;

        },
        getAllData : function(patientId) {
            //get all the data for a patient. Follow paging to get them all...

            var deferred = $q.defer();
            var allResources = {};
            //the currently selected data server object (not just the url)
            var dataServer = appConfigSvc.getCurrentDataServer();
            var resourceHash = {};      //this is used to avoid duplications that $everything can return...

            if (dataServer.everythingOperation) {
                //The everything operation will return all patient related resources. not all servers recognize this, and
                //some implement paging and small default sizes (hapi) and some don't (grahame)

                var url = dataServer.url + "Patient/"+patientId + '/$everything';

                this.getAllResourcesFollowingPaging(url).then(
                    function(arrayOfResource){

                        console.log(arrayOfResource)

                        if (arrayOfResource) {
                            arrayOfResource.forEach(function(resource){        //this is a bundle
                                //var resource = entry.resource;
                                var type = resource.resourceType;
                                //Grahame returns AuditEvents in $everything...
                                if (type !== 'AuditEvent') {
                                    //check to see if we have aleady retrieved this resource...
                                    var location = type+'/'+resource.id
                                    if (!resourceHash[location] ) {
                                        resourceHash[location] = 'x';
                                        if (! allResources[type]) {
                                            allResources[type] = {entry:[],total:0};        //this is also supposed to be a bundle
                                        }

                                        allResources[type].entry.push({resource:resource});
                                        allResources[type].total ++;
                                    }

                                }

                            })
                        }

                        deferred.resolve(allResources);
                    },
                    function(err){
                        //alert("error loading all patient data:\n\n"+ angular.toJson(err));
                        deferred.reject(err);
                    }
                );


                return deferred.promise;
            }



            //return all the data for the indicated patient. Doesn't use the 'everything' operation so there is a fixed set of resources...
            //currently only get a max of 100 resources of each type. Need to implement paging to get more...

            var resources = [];
            resources.push({type:'Observation',patientReference:'subject'});
            resources.push({type:'Encounter',patientReference:'patient'});
            resources.push({type:'Appointment',patientReference:'patient'});
            resources.push({type:'Condition',patientReference:'patient'});
            resources.push({type:'List',patientReference:'subject'});
            resources.push({type:'Basic',patientReference:'subject'});

            resources.push({type:'AllergyIntolerance',patientReference:'patient'});
            resources.push({type:'MedicationStatement',patientReference:'patient'});

            var arQuery = [];


            resources.forEach(function(item){

                //if the reference is a subject (rather than a patient) then be explicit about the
                //type that is being searched.
                var uri;
                if (item.patientReference == 'subject') {
                    uri = appConfigSvc.getCurrentDataServerBase() + item.type + "?" + item.patientReference + "=" + patientId + "&_count=100";
                } else {
                    uri = appConfigSvc.getCurrentDataServerBase() + item.type + "?" + item.patientReference + "=" + patientId + "&_count=100";
                }


                arQuery.push(

                    //GetDataFromServer.adHocFHIRQueryFollowingPaging(uri).then(

                    getAllResources(uri).then(
                        function(bundle){



                            if (bundle.resourceType == 'Bundle' && bundle.entry && bundle.entry.length > 0) {
                                if (! bundle.total) {
                                    bundle.total = bundle.entry.length;
                                }
                                allResources[item.type] = bundle;    //this will be a bundle
                            }

                            //console.log(bundle)
                        }
                    )
                )
            });

            $q.all(arQuery).then(
                function(data){
                    //console.log(allResources)
                    deferred.resolve(allResources);
                },
                function(err){
                    alert("error loading all patient data:\n\n"+ angular.toJson(err));
                    deferred.reject(err);
                });

            return deferred.promise;

            //get all the resources for a single type.
            function getAllResources(uri) {
                var deferred = $q.defer();
                var bundle = {entry:[]}
                /*

                                Utilities.perfromQueryFollowingPaging(uri).then(
                                    function(data) {
                                        deferred.resolve(data);
                                    }
                                );
                                return deferred.promise;




                                GetDataFromServer.adHocFHIRQueryFollowingPaging(uri).then(
                                    function(data) {
                                        deferred.resolve(data);
                                    }
                                )


                                return deferred.promise;
                */

                //thereIsMore = true;
                //while (thereIsMore) {



                loadPage(uri).then(
                    function(data){
                        var pageBundle = data.data;     //the bundle representing this page...
                        //thereIsMore = false
                        if (pageBundle.link){
                            //if there's a link, then need to check for a 'next' link...
                        }


                        deferred.resolve(pageBundle)
                    },
                    function() {
                        //if the call fails, then return an empty bundle todo : is this the correct behaviour?
                        deferred.resolve({resourceType:'Bundle',entry:[]});
                    }
                );
                //}


                return deferred.promise;



            }

            function loadPage(uri,start) {
                return $http.get(uri);



            }


        },

        getAllDataDEP : function(patientId) {


            
            var deferred = $q.defer();
            var allResources = {};
            //the currently selected data server object (not just the url)
            var dataServer = appConfigSvc.getCurrentDataServer();
            
            if (dataServer.everythingOperation) {
                //The everything operation will return all patient related resources. not all servers recognize this, and
                //some implement paging and small default sizes (hapi) and some don't (grahame)
                var url = dataServer.url + "Patient/"+patientId + '/$everything?_count=100'
                if (dataServer.everythingOperationCount) {
                    url += "?_count="+dataServer.everythingOperationCount;
                }

                //console.log(url);

                $http.get(url).then(
                    function(data){
                        if (data.data) {
                            data.data.entry.forEach(function(entry){        //this is a bundle
                                var resource = entry.resource;
                                var type = resource.resourceType;
                                //Grahame returns AuditEvents in $everything...
                                if (type !== 'AuditEvent') {
                                    if (! allResources[type]) {
                                        allResources[type] = {entry:[],total:0};        //this is also supposed to be a bundle
                                    }
                                    allResources[type].entry.push({resource:resource});
                                    allResources[type].total ++;
                                }

                            })
                        }

                        deferred.resolve(allResources);
                    },
                    function(err){
                        alert("error loading all patient data:\n\n"+ angular.toJson(err));
                        deferred.reject(err);
                    }
                );

                
                return deferred.promise;
            }



            //return all the data for the indicated patient. Doesn't use the 'everything' operation so there is a fixed set of resources...
            //currently only get a max of 100 resources of each type. Need to implement paging to get more...

            var resources = [];
            resources.push({type:'Observation',patientReference:'subject'});
            resources.push({type:'Encounter',patientReference:'patient'});
            resources.push({type:'Appointment',patientReference:'patient'});
            resources.push({type:'Condition',patientReference:'patient'});
            resources.push({type:'List',patientReference:'subject'});
            resources.push({type:'Basic',patientReference:'subject'});

            var arQuery = [];


            resources.forEach(function(item){

                //if the reference is a subject (rather than a patient) then be explicit about the
                //type that is being searched.
                var uri;
                if (item.patientReference == 'subject') {
                    uri = appConfigSvc.getCurrentDataServerBase() + item.type + "?" + item.patientReference + "=Patient/" + patientId + "&_count=100";
                } else {
                    uri = appConfigSvc.getCurrentDataServerBase() + item.type + "?" + item.patientReference + "=" + patientId + "&_count=100";
                }





                arQuery.push(

                    getAllResources(uri).then(
                        function(bundle){
                            allResources[item.type] = bundle;    //this will be a bundle
                        }
                    )
                )
            });

            $q.all(arQuery).then(
                function(data){
                    deferred.resolve(allResources);
                },
                function(err){
                    alert("error loading all patient data:\n\n"+ angular.toJson(err));
                    deferred.reject(err);
            });

            return deferred.promise;

            //get all the resources for a single type.
            function getAllResources(uri) {
                var deferred = $q.defer();
                var bundle = {entry:[]}



                //thereIsMore = true;
                //while (thereIsMore) {
                    loadPage(uri).then(
                        function(data){
                            var pageBundle = data.data;     //the bundle representing this page...
                            //thereIsMore = false
                            if (pageBundle.link){
                                //if there's a link, then need to check for a 'next' link...
                            }


                            deferred.resolve(pageBundle)
                        },
                        function() {
                            //if the call fails, then return an empty bundle todo : is this the correct behaviour?
                            deferred.resolve({resourceType:'Bundle',entry:[]});
                        }
                    );
                //}


                return deferred.promise;



            }

            function loadPage(uri,start) {
                return $http.get(uri);



            }


        },
        loadSamplePatients : function(vo) {
            //var deferred = $q.defer();
            var uri = appConfigSvc.getCurrentDataServerBase() + "Patient?organization="+vo.organizationId+"&_count=100";     //<<<<<
            return $http.get(uri);
        },

        getServerBaseDEP : function(sb) {
            return appConfigSvc.getCurrentDataServerBase();
        },
        postBundle : function(bundle,referenceResources) {
            //sent the bundle to the server. If referenceResources is supplied, then add the resources to that list (with id)
            var deferred = $q.defer();
            $http.post(appConfigSvc.getCurrentDataServerBase(),bundle).then(
                function(data) {


                    if (referenceResources) {
                        data.data.entry.forEach(function (entry, index) {

                            var resource = entry.resource;
                            if (resource && resource.id ) {
                                //there is already a resource with an id, nothing else to be donr...
                            } else if (resource && entry.response && entry.response.location) {
                                //if not a resource, ten is there a location
                                var location = entry.response.location;
                                var ar = location.split('/');
                                var id = ar[1];
                               // var resource = bundle.entry[index].resource;
                                resource.id = id;
                            } else if (entry.response && entry.response.location){
                                //no resource, but there is an id. The position in the response is the same as the request...
                                var resource = bundle.entry[index].resource;
                                resource.id = getId(entry.response.location)
                            } else {
                                deferred.reject("a resource was added, but no id was supplied")
                            }

                            referenceResources.push(resource)

                        });
                    }
                    deferred.resolve(data)

                    function getId(location) {
                        var ar = location.split('/');
                        //console.log(ar);
                        if (ar[ar.length-2] == '_history') {
                            return ar[ar.length-3]
                        } else {
                            return ar[ar-1]
                        }
                    }



                },
                function(err) {

                    alert(angular.toJson(err));
                    deferred.reject(err)

                }
            );

            return deferred.promise;

        },
        getGridOfObservations : function(bundle) {
            //generate the vitals observations grid
            var grid = {};      //there will be a property for each unique datetime, with a collection of matching observations for each time.
            if (bundle && bundle.entry) {
                bundle.entry.forEach(function(entry){
                    var obs = entry.resource;
                    var code = obs.code.coding[0].code;
                    var date = obs.effectiveDateTime;
                    if (date) {
                        if (! grid[date]) {
                            grid[date] = {}
                        }
                        var g = grid[date];
                        g[code] = obs

                        //grid[date].push(obs)
                    }

                });


                return grid;

            }
        }

        }
    }
);
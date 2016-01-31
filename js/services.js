angular.module("sampleApp").service('supportSvc', function($http,$q) {


    //options for building the samples that will come from a UI
    var buildConfig = {};
    buildConfig.encounterObservation = .5;      //chance that a group of observations will reference an encounter
    buildConfig.createProblemList = 'yes';      // yes | no | empty
    buildConfig.problemListLength = 3;          //size of the problemlist


    var identifierSystem ='http://fhir.hl7.org.nz/identifier';
    var serverBase;
    var observations=[];    //used for generating sample data plus vitals...
    observations.push({code:'8310-5',display:'Body Temperature',min:36, max:39,unit:'C',round:10,isVital:true});
    observations.push({code:'8867-4',display:'Heart Rate',min:70,max:90,unit:'bpm',round:1,isVital:true});
    observations.push({code:'9279-1',display:'Respiratory Rate',min:25,max:35,unit:'resp/min',round:1,isVital:true});
    observations.push({code:'8302-2',display:'Height',max:90,min:90,unit:'cm',round:10});
    observations.push({code:'3141-9',display:'Weight',max:90,min:70,unit:'Kg',round:10,isVital:true});


    //load the json file with all the optional values for creating samples...
    var options;
    $http.get("artifacts/options.json").then(
        function(data) {
            options = data.data
        }
    );



    //resources that are used as reference targets by other resources...
    var referenceResources = [];
    referenceResources.push({resourceType:'Practitioner',name:{text:'Dr John Doe'},
        identifier : {value:'jd',system:identifierSystem},text:{status:'generated',div:'<div>Dr John Doe</div>'}});
    referenceResources.push({resourceType:'Practitioner',name:{text:'Dr Annette Jones'},
        identifier : {value:'aj',system:identifierSystem},text:{status:'generated',div:'<div>Dr Annette Jones</div>'}});
    referenceResources.push({resourceType:'Organization',name:'clinFHIR Sample creator',
        identifier : {value:'cf',system:identifierSystem},text:{status:'generated',div:'<div>clinFhir</div>'}});

    return {
        getReferenceResources : function(){
            return referenceResources;
        },
        createAppointments : function(patientId,options) {
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


            this.postBundle(bundle).then(
                function(data){
                    if (options.logFn) {
                        options.logFn('Added '+cnt +' Appointments')
                    }

                }
            )




        },
        createObservations : function(patientId,options) {
            var bundle = {resourceType:'Bundle',type:'transaction',entry:[]};

            var cnt = 0;
            for (var i=0; i < 3; i++) {
                var date = moment().subtract(i,'weeks');


                //decide if this set of observations will be linked to an encounter...
                var encounter = this.getRandomReferenceResource('Encounter',buildConfig.encounterObservation);    //half the time it will be null

                observations.forEach(function(item) {

                    var value = item.min + (item.max - item.min) * Math.random();   //to be improved...
                    value = Math.round(value * item.round) / item.round;


                    var obs = {resourceType:'Observation',status:'final'};
                    obs.valueQuantity = {value:value,unit:item.unit};
                    obs.effectiveDateTime = date.format();
                    obs.code = {'text':item.display,coding:[{system:'http://loinc.org',code:item.code}]};
                    obs.subject = {reference:'Patient/'+patientId};
                    if (encounter) {
                        obs.encounter = {reference:'Encounter/'+encounter.id}
                    }

                    //obs.text = {status:'generated',div:item.display + ", "+ value + " "+ item.unit + " "+ obs.effectiveDateTime}
                    obs.text = {status:'generated',div:item.display + ", "+ value + " "+ item.unit };
                    bundle.entry.push({resource:obs,request: {method:'POST',url: 'Observation'}});
                    cnt ++;
                })
            }

            this.postBundle(bundle).then(
                function(data){
                    if (options && options.logFn)
                        options.logFn('Added '+cnt +' Observations')
                }
            );      //don't care about the response



        },
        createConditions : function (id,options) {
           // console.log(referenceResources);
            //create a set of encounters for the patient and add them to the referenceResources (just for this session)
            var deferred = $q.defer();
            var that = this;
            options = options || {}
            options.count = options.count || 5;     //number to reate
            options.period = options.period || 30;  //what period of time the enounters should be over
            var bundle = {resourceType: 'Bundle', type: 'transaction', entry: []};

            for (var i = 0; i < options.count; i++) {
                var cond = {resourceType: 'Condition', status: 'finished'};
                cond.patient = {reference:'Patient/'+id};
                cond.verificationStatus = this.getRandomEntryFromOptions('conditionVerificationStatus');
                cond.code = this.getRandomEntryFromOptions('conditionCode');
                var encounter = this.getRandomReferenceResource('Encounter');   //there may not be an encounter (if they aren't being created)
                if (encounter) {
                    cond.encounter = {reference: "Encounter/"+ encounter.id};
                }
                var practitioner = this.getRandomReferenceResource('Practitioner');     //there will always be a practitioner
                cond.asserter = {reference: "Practitioner/"+ practitioner.id};

                cond.text = {status:'generated',div:cond.code.text};
                bundle.entry.push({resource:cond,request: {method:'POST',url: 'Condition'}});
            }

            this.postBundle(bundle,referenceResources).then(
                function(data){
                    //now add the the referenceResources array in memory so that they can be used by other resources.
                    data.data.entry.forEach(function(entry){
                        console.log(entry)
                       // referenceResources.push(entry.resource)
                    });

                    if (options.logFn) {
                        options.logFn('Added ' + options.count + ' Conditions')
                    }

                    //now to see if a problem list shuld be created
                    switch (buildConfig.createProblemList) {
                        case 'yes' :
                            that.buildProblemList(id).then(
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
                                console.log('finally')
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
        buildProblemList : function(id,empty) {
            //make a problem list from the conditions
            var deferred = $q.defer();
            var today = moment().format();
            var problemList = {resourceType : 'List',title:'Problem List', entry:[], date : today,
                subject : {reference:'Patient/'+id},
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
            var url = serverBase+ "List";
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
        createEncounters : function (id,options) {
            //create a set of encounters for the patient and add them to the referenceResources (just for this session)
            var deferred = $q.defer();
            options = options || {}
            options.count = options.count || 5;     //number to reate
            options.period = options.period || 30;  //what period of time the enounters should be over
            var bundle = {resourceType:'Bundle',type:'transaction',entry:[]};

            for (var i= 0; i< options.count;i++) {
                var enc = {resourceType:'Encounter',status:'finished'};
                enc.patient = {reference:'Patient/'+id};
                enc.reason = [];
                enc.reason.push(this.getRandomEntryFromOptions('encounterReason'));
                enc.type = [(this.getRandomEntryFromOptions('encounterType'))];
                //var da = moment().subtract(parseInt(options.period * Math.random()),'days');
                enc.period = {start:moment().subtract(parseInt(options.period * Math.random()),'days')};
                var practitioner = this.getRandomReferenceResource('Practitioner');
                enc.participant = [];
                enc.participant.push({individual:{reference:'Practitioner/'+practitioner.id,display:practitioner.name.text}});  //safe 'cause I created the practitioner...


                bundle.entry.push({resource:enc,request: {method:'POST',url: 'Encounter'}});
                //console.log(enc)
            }

            this.postBundle(bundle,referenceResources).then(
                function(data){
                    //now add the the referenceResources array in memory so that they can be used by other resources.
                   /* data.data.entry.forEach(function(entry,index){
                        console.log(entry)
                        var location = entry.response.location;
                        var ar = location.split('/');
                        var id = ar[1];
                        var resource = bundle.entry[index].resource;
                        resource.id = id;
                        referenceResources.push(resource)

                        console.log(resource)


                    }); */


                    deferred.resolve('Added ' + options.count + ' Encounters')
                },
                function(err) {
                    deferred.reject("Error saving Encounters")
                }
            );
            return deferred.promise;

        },
        getRandomEntryFromOptions : function(key){
            //return a random edtry from the options onject. The caller must know what the type of subjct object will be...
            var lst = options[key];
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
               // console.log(res);
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
                arQuery.push(
                checkAndInsert(res).then(
                    function(){
                        //maybe not neded
                    })
                )
            });


            $q.all(arQuery).then(
                function(data){
                   // console.log(referenceResources);
                    deferred.resolve(referenceResources);
                },
                function(err){
                    alert("error checking reference data:\n\n"+ angular.toJson(err));
                    deferred.reject(err);
                });



            return deferred.promise;


            //a function to check whether a resource already exists (based on the identifier), adding it if now...
            function checkAndInsert(res) {
                var deferred = $q.defer();
                var identifierQuery = res.identifier.system + '|' + res.identifier.value;
                var url = serverBase + res.resourceType + "?identifier="+identifierQuery;
                //console.log(url);
                $http.get(url).then(
                    function(data) {
                        if (data.data && data.data) {
                            var cnt = data.data.total;
                            switch (cnt) {
                                case 0 :
                                    //need to add this one
                                    var postUrl = serverBase + res.resourceType;
                                    $http.post(postUrl,res).then(
                                        function(data){
                                            //need to get the resource id
                                            var location = data.headers('location');
                                            var ar = location.split('/');
                                            res.id = ar[5];
                                            console.log('inserting:' + res);
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
                                    deferred.resolve()
                                    alert('There are ' + cnt + ' resources with this identifier');
                                    break;
                            }
                        }
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
            var url = serverBase+"Observation?subject="+patientId;

            //create the list of codes to include in the query
            var filterString="";
            observations.forEach(function(item){
                if (item.isVital) {
                    filterString += ","+item.code;
                    response.vitalsCodes.push({code:item.code,display:item.display,unit:item.unit});
                }
            });

            filterString = filterString.substring(1);
            url += "&code="+filterString;
            url += "&_count=100";

            console.log('url='+url);
            $http.get(url).then(
                function(data){
                    console.log(data);
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
        getAllData : function(patientId) {
            //return all the data for the indicated patient. Don't use the 'everything' operation
            //currently only get a max of 100 resources of each type. Need to implement paging to get more...
            var deferred = $q.defer();
            var resources = [];
            resources.push({type:'Observation',patientReference:'subject'});
            resources.push({type:'Encounter',patientReference:'patient'});
            resources.push({type:'Appointment',patientReference:'patient'});
            resources.push({type:'Condition',patientReference:'patient'});
            resources.push({type:'List',patientReference:'subject'});

            var arQuery = [];
            var allResources = {};

            resources.forEach(function(item){
                var uri = serverBase + item.type + "?" + item.patientReference + "=" + patientId + "&_count=100";
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
            var uri = serverBase + "Patient?organization="+vo.organizationId+"&_count=100";     //<<<<<
            return $http.get(uri);
        },
        setServerBase : function(sb) {
            serverBase = sb;
        },
        postBundle : function(bundle,referenceResources) {
            //sent the bundle to the server. If referenceResources is supplied, then add the resources to that list (with id)
            var deferred = $q.defer();

           // var config = {headers: {Prefer:'return=representation'}};    //to return the resource in the bundle
            //Prefer: return=representation

            $http.post(serverBase,bundle).then(
                function(data) {


                    if (referenceResources) {
                        data.data.entry.forEach(function (entry, index) {
                            //console.log(entry)
                            var location = entry.response.location;
                            var ar = location.split('/');
                            var id = ar[1];
                            var resource = bundle.entry[index].resource;
                            resource.id = id;
                            referenceResources.push(resource)

                            //console.log(resource)


                        });
                    }


                    deferred.resolve(data)

                },
                function(err) {

                    alert(angular.toJson(err));
                    deferred.reject(err)

                }
            );

            return deferred.promise;

        },
        getGridOfObservations : function(bundle) {
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

                console.log(grid);

                return grid;

            }
        }
        }
    }
);
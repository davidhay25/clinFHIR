//create a sample bundle for the Patient Visualizer. The current one is rather old & flaky!


angular.module("sampleApp").service('createSampleBundleSvc', function(
    $http,$q) {

    //Note that the return 'methods of the service' object is at the bottom...


    let observations=[];    //used for generating sample data plus vitals...
    observations.push({code:'8310-5',display:'Body Temperature',min:36, max:37,unit:'C',round:10,isVital:true});
    observations.push({code:'8867-4',display:'Heart Rate',min:70,max:90,unit:'bpm',round:1,isVital:true});
    observations.push({code:'9279-1',display:'Respiratory Rate',min:25,max:35,unit:'resp/min',round:1,isVital:true});
    observations.push({code:'8302-2',display:'Height',max:90,min:90,unit:'cm',round:10});
    observations.push({code:'3141-9',display:'Weight',max:80,min:70,unit:'Kg',round:10,isVital:true});

    function createUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    function createEntry(resource) {
        let serverRoot = "http://clinfhir.com/fhir/"
        //assume that these are all POST with uuid as id...
        let entry = {}
        //entry.fullUrl = serverRoot + resource.resourceType + "/" + resource.id // "urn:uuid:" + resource.id
        entry.fullUrl = "urn:uuid:" + resource.id
        entry.resource = resource
        entry.request = {method:'POST',url:resource.resourceType}
       // entry.request = {method:'PUT',url:resource.resourceType + "/" + resource.id}
        return entry
    }


    //create a set of observations
    function createObservations(patient,arPractitioners,arEncounters) {
       let arObservations = []

        var cnt = 0;
        for (var i=0; i < 6; i++) {                 //5 sets per type of observation
            var date = moment().subtract(i,'weeks');

            //decide if this set of observations will be linked to an encounter...
            //temp var encounter = this.getRandomReferenceResource('Encounter',buildConfig.encounterObservation);    //half the time it will be null

            observations.forEach(function(item,j) {

                var value = item.min + (item.max - item.min) * Math.random();   //to be improved...
                value = Math.round(value * item.round) / item.round;

                var obs = {resourceType:'Observation', id:createUUID(), status:'final'};

                obs.valueQuantity = {value:value,unit:item.unit};
                obs.effectiveDateTime = date.format();
                obs.code = {'text':item.display,coding:[{system:'http://loinc.org',code:item.code}]};
                obs.subject = {reference:'urn:uuid:'+patient.id};

                let encounter = arEncounters[parseInt(arEncounters.length * Math.random())]
                let practitioner = arPractitioners[parseInt(arPractitioners.length * Math.random())]

                obs.performer = [{reference:"urn:uuid:" + practitioner.id}]
                obs.encounter = {reference:"urn:uuid:" + encounter.id}

                /* temp
                if (encounter) {
                    obs.encounter = {reference:'Encounter/'+encounter.id}
                }
*/
                //obs.text = {status:'generated',div:item.display + ", "+ value + " "+ item.unit + " "+ obs.effectiveDateTime}
                var text = item.display + ", "+ value + " "+ item.unit;
                obs.text = {status:'generated',div: "<div  xmlns='http://www.w3.org/1999/xhtml'>"+text+'</div>'};
                arObservations.push(obs);
                cnt ++;
            })
        }
        return arObservations

    }

    function createEncounters (patient,arConditions,arPractitioners) {
        //create a set of encounters for the patient and add them to the referenceResources (just for this session)

        options = {}
        options.count = options.count || 10;     //number to create
        options.period = options.period || 60;  //what period of time the enounters should be over
        let arEncounter = []
        var bundle = {resourceType:'Bundle',type:'transaction',entry:[]};

        for (var i= 0; i< options.count;i++) {
            var enc = {resourceType:'Encounter',id:createUUID(), status:'finished'};
            enc.diagnosis = []
            enc.subject = {reference:"urn:uuid:" + patient.id}

            //find a random number of Random Condition as the indication
            var cnt = parseInt(4 * Math.random()) + 1;      //random number between 1 & 4
            for (var j=0; j < cnt; j++) {
                var condition = arConditions[parseInt(arConditions.length * Math.random())];    //a randdom condition
                enc.diagnosis.push({condition: {reference:"urn:uuid:" + condition.id}});
            }


            enc.class = {system:'http://terminology.hl7.org/CodeSystem/v3-ActCode',code:'AMB'}
            enc.text = {status:'generated',div:"<div xmlns='http://www.w3.org/1999/xhtml'>"+txt+"</div>"}

            enc.reasonCode = [{text:"Sore throat"}]
            enc.type = [{text:"Primary care visit"}]

            enc.period = {start:moment().subtract(parseInt(options.period * Math.random()),'days')};

            var txt = moment(enc.period.start).format("MMM Do YYYY") + " for " + enc.reasonCode[0].text;


            let practitioner = arPractitioners[parseInt(arPractitioners.length * Math.random())]

            enc.participant = [];
            enc.participant.push({individual:{reference:'urn:uuid:'+practitioner.id,display:practitioner.name[0].text}});  //safe 'cause I created the practitioner...


            arEncounter.push(enc);

        }

        return arEncounter

    }


    function createAppointments(patient,arPractitioners) {
       let lst = []
        var data = [
            {status:'pending',type:{text:'Cardiology'},description:'Investigate Angina',who:{text:'Clarence cardiology clinic'},delay:4},
            {status:'pending',type:{text:'GP Visit'},description:'Routine checkup',who:{text:'Dr Dave'},delay:7}
        ];

        data.forEach(function(item){

            var appt = {resourceType:'Appointment',id:createUUID(), status:item.status};
            appt.description = item.description;
            appt.start = moment().add('days',item.delay).format();
            appt.end = moment().add('days',item.delay).add('minutes',15).format();
            appt.minutesDuration = 15;

            let practitioner = arPractitioners[parseInt(arPractitioners.length * Math.random())]
            appt.participant = []

            appt.participant.push({actor:{reference:'urn:uuid:'+practitioner.id},status:'accepted'});
            //appt.participant = [{actor:{display:item.who.text},status:'accepted'}];    //the perfromed



            var txt ="<div xmlns='http://www.w3.org/1999/xhtml'><div>"+item.description + "</div><div>"+item.who.text+"</div></div>"
            appt.text = {status:'generated',div:txt}

            //the patient is modelled as a participant
            appt.participant.push({actor:{reference:'urn:uuid:'+patient.id},status:'accepted'});
            lst.push(appt);


        })
        return lst




    }


    return {
        makeSampleBundle : function(patient) {
            let deferred = $q.defer();

            let bundle = {resourceType:"Bundle",type:"transaction",entry:[]}

            //assume that the patient has been created but not yet saved.
            patient.id = createUUID()
            bundle.entry.push(createEntry(patient))

            let lstConditions = []          //a list of conditions for the encounters

            let arPractitioners = []         //array of demo practitoners. A number of the resources will use one of these

            //sample practitioners
            arPractitioners.push({resourceType:"Practitioner",id:createUUID(), name:[{text:"Mary Smith"}]})
            arPractitioners.push({resourceType:"Practitioner",id: createUUID(), name:[{text:"Joseph Jones"}]})
            arPractitioners.push({resourceType:"Practitioner",id: createUUID(), name:[{text:"Karen Kobold"}]})
            arPractitioners.forEach(function (prac) {
                bundle.entry.push(createEntry(prac))
            })

            //Create list resources
            let listProblems = {resourceType:"List", id: createUUID(), mode:'snapshot', status:'current',entry : []}
            listProblems.code = {coding : [{code:'problems',system:'http://hl7.org/fhir/list-example-use-codes'}]}
            listProblems.subject = {reference:'urn:uuid:' + patient.id}
            listProblems.text = {status:'generated',div:"<div xmlns='http://www.w3.org/1999/xhtml'>Problem list</div>"}

            let listAllergies = {resourceType:"List", id: createUUID(), mode:'snapshot', status:'current',entry : []}
            listAllergies.code = {coding : [{code:'allergies',system:'http://hl7.org/fhir/list-example-use-codes'}]}
            listAllergies.subject = {reference:'urn:uuid:' + patient.id}
            listAllergies.text = {status:'generated',div:"<div xmlns='http://www.w3.org/1999/xhtml'>Allergies list</div>"}

            let listMedications = {resourceType:"List", id: createUUID(), mode:'snapshot', status:'current',entry : []}
            listMedications.code = {coding : [{code:'medications',system:'http://hl7.org/fhir/list-example-use-codes'}]}
            listMedications.subject = {reference:'urn:uuid:' + patient.id}
            listMedications.text = {status:'generated',div:"<div xmlns='http://www.w3.org/1999/xhtml'>Medications list</div>"}

            $http.get("artifacts/allSampleData.json").then(
                function (data) {
                    let sampleData = data.data
                    sampleData.forEach(function (resource) {
                        resource.id = createUUID()
                        //resource.subject = {reference:'Patient/' + patient.id}
                        switch (resource.resourceType) {
                            case "Condition" :
                               resource.subject = {reference:'urn:uuid:' + patient.id}
                                listProblems.entry.push({item:{reference:'urn:uuid:' + resource.id}})
                                lstConditions.push(resource)
                                break
                            case "AllergyIntolerance" :
                                resource.patient = {reference:'urn:uuid:' + patient.id}
                                let practitioner = arPractitioners[parseInt(arPractitioners.length * Math.random())]
                                resource.recorder = {reference:"urn:uuid:" + practitioner.id}
                                listAllergies.entry.push({item:{reference:'urn:uuid:' + resource.id}})
                                break
                            case "MedicationStatement" :
                                resource.subject = {reference:'urn:uuid:' + patient.id}
                                listMedications.entry.push({item:{reference:'urn:uuid:' + resource.id}})
                                break
                            default :
                                break

                        }
                       bundle.entry.push(createEntry(resource))

                    })

                    //Add the lists to the bundle...
                    bundle.entry.push(createEntry(listProblems))
                    bundle.entry.push(createEntry(listAllergies))
                    bundle.entry.push(createEntry(listMedications))


                    //the encounters
                    let arEncounters = createEncounters(patient,lstConditions,arPractitioners)
                    arEncounters.forEach(function (enc) {
                        bundle.entry.push(createEntry(enc))
                    })

                    //now, add the observations
                    let arObservations = createObservations(patient,arPractitioners,arEncounters)
                    arObservations.forEach(function (obs) {
                        bundle.entry.push(createEntry(obs))
                    })

                    let arAppointments = createAppointments(patient,arPractitioners)
                    arAppointments.forEach(function (appt) {
                        bundle.entry.push(createEntry(appt))
                    })

                    deferred.resolve(bundle)


                },function (err) {
                    console.log(err)
                    deferred.reject(err)
                }
            )



            return deferred.promise



        }
    }

})
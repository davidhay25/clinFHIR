#!/usr/bin/env node

//var urlRoot = "http://conman.fhir.org:8080/baseDstu3/";

var urlRoot = "https://nzlfhirsrvt7ss7ccrrakte.azurewebsites.net/";

var moment = require('moment');

var syncRequest = require('sync-request');
var fs = require('fs')
var upload = false;
var errors = 0;
var EXITCONDITION = false;


var uploadPatient = true;
var uploadAI = false;
var uploadCondition = false;
var uploadMedication = false;
//var uploadCondition = false;
var uploadAR = false;

function getArray(fileName) {

    var myPromise = new Promise(function(resolve, reject){
        var lineReader = require('readline').createInterface({
            input: require('fs').createReadStream(fileName)
        });

        var ar = []
        lineReader.on('line', function (line) {
            console.log('Line from file:', line);

            var line1 = line.replace(/\"/g, "");
            ar.push(line1)
        })

        lineReader.on('end', function () {
            console.log('end')
            resolve(ar);
        });

        lineReader.on('error', function () {
            console.log('eerrornd')
            reject(ar);
        });
    })

    return myPromise;
}

var fileRoot = "/Users/davidha/Downloads/bpac-adr-extract/";


var fs = require('fs');
var arReport = fs.readFileSync(fileRoot+'Report.txt').toString().split("\n");
var hashReport = {};
var hashPatient = {}, patientId = 0;        //age+gender is the same patient...
var hashReaction = {}, reactionId=0;        //a hash of all unique reaction texts. Try to get SNOMED codes for some of these...
var arCondition = [];       //all reactions have a separate condition
var substance = {};

var maxReport = 500;

for (var i=0; i < maxReport; i++ ) {
//for(i in arReport) {
    var lne =  arReport[i].replace(/\"/g, "");

    var ar = lne.split(',');


   // var ai = {resourceType:'AllergyIntolerance', id : 'a' + ar[0], verificationStatus:'confirmed'};
   // ai.onset =  moment().subtract(parseInt(Math.random()*1000),'days').format('YYYY-MM-DD');


    var adverseEvent = {resourceType:'AdverseEvent', id : 'a' + ar[0]};
    adverseEvent.date =  moment(ar[1],'D/MM/YYYY').format('YYYY-MM-DD');      //todo convert format

    hashReport[adverseEvent.id] = adverseEvent;
    //hashReport[ai.id] = ai;

    var hPatient = ar[2]+ar[3] + parseInt(Math.random()*1000);
    if (hashPatient[hPatient]) {
        adverseEvent.subject = {reference:'Patient/'+hashPatient[hPatient].id}

        //console.log('patient hit!');
    } else {
        var patient = {resourceType:'Patient',id:'p'+patientId++};
        if (ar[3]) {
            patient.gender = ar[3].toLowerCase().replace(/\r/g, "");
        }
        if (ar[2]) {
            var age = ar[2];
            var arAge = age.split(' ');
            if (arAge.length == 1) {
                age = age * 12
            } else {
                age = arAge[0]
            }

            var dob = moment().subtract(age, 'months').add(parseInt(Math.random()*30),'days');
            patient.birthDate = dob.format('YYYY-MM-DD');
           // ai.onset =  dob.add(parseInt(Math.random()*1000),'days').format('YYYY-MM-DD');
            patient.name = [{text:'Patient ' + patient.id}];
        }
        //console.log(age)

        hashPatient[hPatient] = patient;
        adverseEvent.subject = {reference:'Patient/'+patient.id}
        //ai.patient = {reference:'Patient/'+hashPatient[hPatient].id}
    }
   // console.log(adverseEvent);

}

var content =  JSON.stringify(hashPatient)
fs.writeFileSync(fileRoot + 'patients.json', content, 'utf8')


var arReaction = fs.readFileSync(fileRoot+'Reaction.txt').toString().split("\n");
arReaction.forEach(function(lne){
    var lne =  lne.replace(/\"/g, "");
    var ar = lne.split(',');
    var report = hashReport['a'+ar[1]];

    if (report) {
        var reactionTxt = ar[2].replace(/\r/g, "");
        if ( ! hashReaction[reactionTxt]) {
            hashReaction[reactionTxt] = 'x';
        }

       // report.reaction = report.reaction || []

        //report.reaction.push({manifestation:{text:reactionTxt}})


        var condition =  {resourceType:'Condition',id:'c'+ arCondition.length};
        condition.code = {text:reactionTxt};
        condition.subject = report.subject
        arCondition.push(condition);

        report.reaction = report.reaction || []
        report.reaction.push({reference:'Condition/'+condition.id,display:reactionTxt})

        if (report.reaction.length > 0) {
           // console.log(report.reaction.length)
        }


    } else {
        //console.log('report id missing: '+ ar[1])
    }
});

var arMedication = [];
var arMeds = fs.readFileSync(fileRoot+'Medicine.txt').toString().split("\n");
var inx=0
arMeds.forEach(function(lne){
    var lne =  lne.replace(/\"/g, "");
    var ar = lne.split(',');
    var report = hashReport['a'+ar[1]];

    if (report) {
        var medTxt = ar[2].replace(/\r/g, "");
//console.log(medTxt)
       // report.code = {text:medTxt};
        //report.category='medication';

        var medication =  {resourceType:'Medication',id:'m'+ inx++};
        medication.ingredient = [{itemCodeableConcept: {text:medTxt}}]
        arMedication.push(medication);

        report.suspectEntity = report.suspectEntity || [];
        report.suspectEntity.push({instance:{reference:'Medication/'+medication.id,display:medTxt}})
console.log(report)


    } else {
        //console.log('report id missing: '+ ar[1])
    }
});





var content =  JSON.stringify(arCondition)
fs.writeFileSync(fileRoot + 'conditions.json', content, 'utf8')

//console.log(hashReaction)
var content =  JSON.stringify(hashReport)
fs.writeFileSync(fileRoot + 'reactions.json', content, 'utf8')


console.log('patient count:'+patientId)

if (uploadPatient) {
    for (var key in hashPatient) {
        var patient =  hashPatient[key];


        var url = urlRoot + "Patient/"+patient.id;
        var options = {}
        options.body = JSON.stringify(patient);
        options.headers = {"content-type": "application/json"}
        options.timeout = 20000;        //20 seconds

        var response = syncRequest('PUT', url, options);

        console.log(response.statusCode)


        console.log(patient)

    }
}

if (uploadCondition) {
    arCondition.forEach(function(condition) {

        var url = urlRoot + "Condition/"+condition.id;
        var options = {}
        options.body = JSON.stringify(condition);
        options.headers = {"content-type": "application/json"}
        options.timeout = 20000;        //20 seconds

        var response = syncRequest('PUT', url, options);

        console.log(response.statusCode)



        console.log(condition)

    })
}


if (uploadMedication) {
    arMedication.forEach(function(medication) {

        var url = urlRoot + "Medication/"+medication.id;
        var options = {}
        options.body = JSON.stringify(medication);
        options.headers = {"content-type": "application/json"}
        options.timeout = 20000;        //20 seconds

        var response = syncRequest('PUT', url, options);

        console.log(response.statusCode)



        console.log(medication)

    })
}


if (uploadAR) {
    for (var key in hashReport) {
        var ai =  hashReport[key];


        var url = urlRoot + "AdverseEvent/"+ai.id;
        var options = {}
        options.body = JSON.stringify(ai);
        options.headers = {"content-type": "application/json"}
        options.timeout = 20000;        //20 seconds

        var response = syncRequest('PUT', url, options);

        console.log(response.statusCode)


        console.log(ai)

    }
}


if (uploadAI) {
    for (var key in hashReport) {
        var ai =  hashReport[key];


        var url = urlRoot + "AllergyIntolerance/"+ai.id;
        var options = {}
        options.body = JSON.stringify(ai);
        options.headers = {"content-type": "application/json"}
        options.timeout = 20000;        //20 seconds

        var response = syncRequest('PUT', url, options);

        console.log(response.statusCode)


        console.log(ai)

    }
}


//console.log(hashReport)
return

getArray(fileRoot+'Report.txt').then(function(ar){

    console.log('done',ar)
    EXITCONDITION = true

},function(err) {
    console.log(err)
    }

);


function wait () {
    if (!EXITCONDITION)
        setTimeout(wait, 1000);
};
wait();

//console.log(arReport)

return;

var report = fs.readFileSync(fileRoot+'Report.txt').toString();



console.log(report)






//var urlRoot = "http://localhost:4000/config/";
var urlRoot = "http://snapp.clinfhir.com:4001/config/";


console.log("Dont't do this now!");
return;





//var contents = fs.readFileSync(pathToFile,{encoding:'utf8'})

var lineReader = require('readline').createInterface({
    input: require('fs').createReadStream(fileName)


});

lineReader.on('line', function (line) {
    // console.log('Line from file:', line);
    var ar = line.split('\t');

    var name = ar[0];
    name = name.replace(/\"/g,"");
    name = name.trim();
    console.log(name)
    var id = 'id' + new  Date().getTime(), idHash = {};     //default id
    var ar1 = name.split(',')
    if (ar1.length == 2) {
        console.log(ar1);
        name = ar1[1].trim() + " " + ar1[0]
        id = ar1[1].trim() + ar1[0]
    }
    if (idHash[id]) {
        //2 people with the same name!!!
        id = id + getRandomInt(100);        //choose a random suffix 0->100
    }





    if (name) {
        var json = {id:id,name:name,organization:ar[1]};

        var options = {}

        var url = urlRoot + "person"
        options.body = JSON.stringify(json);
        options.headers = {"content-type": "application/json"}
        options.timeout = 20000;        //20 seconds

        var response = syncRequest('POST', url, options);

        console.log(response.statusCode)
        if (response.statusCode !== 200 && response.statusCode !== 201) {
            console.log('--------------->   error uploading '+ url)
            console.log(response.body.toString())
            //return false
        } else {
            console.log('uploaded '+ url)
            ///return true;
        }
    }




});



function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
}
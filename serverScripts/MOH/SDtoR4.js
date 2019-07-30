#!/usr/bin/env node

//convert SD from r3 to r4
let fs = require('fs');
let syncRequest = require('sync-request');


let r3FhirServer = "http://home.clinfhir.com:8040/baseDstu3/StructureDefinition/";
let r4FhirServer = "http://home.clinfhir.com:8054/baseR4/StructureDefinition/";



let id = "HpiCareTeam";

let options = {};
options.headers = {"accept": "application/json+fhir"}
options.timeout = 20000;        //
let urlModel = r3FhirServer + id;

let response = syncRequest('GET', urlModel, options);
let model = JSON.parse(response.body.toString());

model.snapshot.element.forEach(function(ed,inx) {
    if (inx == 0) {
        delete ed.label;
        delete ed.code;
        delete ed.requirements;
    }
    if (ed.binding) {
        let strength = ed.binding.strength;
        let VsRef;
        if (ed.binding.valueSetReference) {
             vsRef = ed.binding.valueSetReference.reference;
        }


        delete ed.binding
        ed.binding = {strength:strength};
        if (vsRef){
            ed.binding.valueSet = vsRef;
        }


    }

});


//let validateUrl = r4FhirServer + id + "/$validate";
let r4Url = r4FhirServer + id ;
console.log(r4Url)
//not we can't just use the contents loaded form the file as we may have altered it...
options.body = JSON.stringify(model);
options.headers = {"content-type": "application/json+fhir"}
options.timeout = 20000;        //20 seconds


 var response1 = syncRequest('PUT', r4Url, options);

 console.log(response1.statusCode);
 if (response1.statusCode !== 200 && response1.statusCode !== 201) {

    console.log(response1.body.toString())
 }

#!/usr/bin/env node
let syncRequest = require('sync-request');
let options = {};
options.headers = {"accept": "application/json+fhir"}
options.timeout = 20000;        //20 seconds

let remoteFhirServer = "http://home.clinfhir.com:8054/baseR4/"; //the server where the models are stored

//load a Practitioner resource
let url = remoteFhirServer + 'Practitioner/practitionerY';
let response = syncRequest('GET', url, options);
let practitioner = JSON.parse(response.body.toString());

let arDegree = []           //degrees
let arRegistration = [] ;    //registrations
if (practitioner.qualification) {
    practitioner.qualification.forEach(function(q){

        let value = {};     //the value, regardless of type
        value.code = q.code;    //leave it as a CC for now...

        let type = 'degree';    //the default. We could make it required in the profile of course...
        let typeCode = getSingleExtensionValue(q,'http://hl7.org.nz/fhir/StructureDefinition/practitioner-qualification-type');
        if (typeCode) {
            type = typeCode.valueCode;
        }
        switch (type) {
            case 'degree' :
                //get specific degree related stuff here...
                arDegree.push(value);
                break;
            case 'registration' :
                //registration specific stuff here...
                arRegistration.push(value)
        }
    });

    console.log("====== Registrations =====")
    arRegistration.forEach(function (reg) {
        console.log(reg.code.coding[0].display);

    });

    console.log("====== Degrees =====")
    arDegree.forEach(function (reg) {
        console.log(reg.code.coding[0].display);

    })
}


//return the value of an extension assuming there is only 1...
function getSingleExtensionValue(resource,url) {
    var extension;
    if (resource && url) {
        resource.extension = resource.extension || []
        resource.extension.forEach(function(ext){
            if (ext.url == url) {extension = ext}
        });
    }

    return extension;
}
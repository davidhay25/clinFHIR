#!/usr/bin/env node

//generate questionnaire from models

//if an extension is used more than once in the

let fs = require('fs');
let syncRequest = require('sync-request');

//let remoteFhirServer = "http://home.clinfhir.com:8040/baseDstu3/";
let remoteFhirServer = "http://home.clinfhir.com:8054/baseR4/"; //the server where the models are stored


//if the url is null, then no upload
let uploadServer = "http://home.clinfhir.com:8054/baseR4/";     //the server to upload the Questionnaire to...
//let uploadServer = null;


//where a copy of the questionnaire is placed
let outFolder = "/Users/davidhay/tmp/";


//let arModels = ["HpiPractitionerRole"];
let arModels = [];

let options = {};
options.headers = {"accept": "application/json+fhir"}
options.timeout = 20000;        //20 seconds

//get all the models in the IG


let modelId = "HpiPractitioner";


// console.log('Examining '+modelId)
let urlModel = remoteFhirServer + "StructureDefinition/"+modelId;
//console.log("Load model: "+ urlModel)


let response = syncRequest('GET', urlModel, options);
let model = JSON.parse(response.body.toString());
let hashExtension = {};
let currentItem;        //

let quest = {resourceType:"Questionnaire",id:modelId,status:'draft',item:[]}

let hashItem = {};      //a has of item by path
model.snapshot.element.forEach(function(ed,inx) {
    let path = ed.path;         //the path for this element...
    let item = makeItem(ed);    //the individual questionnaire item
    let parentPath;
    let ar = path.split('.');
    if (ar.length == 1) {
        //this is  the root
        hashItem[path] = quest;     //direct children will add to the Questionnaire.item element...
        //quest.item.push(item)
    } else {
        //this is an 'ordinary' item.
        ar.pop();

        //let parentPath = ar.splice(0,1)
        let parentPath = ar.join('.')
        let parent =  hashItem[parentPath]
        //console.log(path,parent)
        if (parent) {
            parent.item = parent.item || []
            parent.item.push(item)
            // Is it a group - then need to set it up to have children and a
            if (item.type == 'group') {

            }

            hashItem[path] = item;
            //is the parent item a group? If so then add it to the items colection of the group

        } else {
            console.log("Can't find item for "+parentPath)
        }
    }
});



//console.log(JSON.stringify(quest))
let filePath = outFolder + "quest.json"
fs.writeFileSync(filePath,JSON.stringify(quest,null,2))



if (uploadServer) {

    let qUrl = uploadServer + "Questionnaire/"+modelId;

    let qOptions = {}
    qOptions.body = JSON.stringify(quest);
    qOptions.headers = {"content-type": "application/fhir+json"}
    qOptions.timeout = 20000;        //20 seconds
    console.log('Uploading '+qUrl);
    let putResponse = syncRequest('PUT', qUrl, qOptions);
    if (putResponse.statusCode !== 200 && putResponse.statusCode !== 201) {
        console.log('--------------->   error uploading '+ qUrl)
        console.log(putResponse.statusCode)
         console.log(putResponse.body.toString())

    } else {
        console.log(putResponse.statusCode + ' uploaded '+ qUrl)

    }
}




function makeItem(ed) {
    let item = {}
    item.text = ed.definition + " "+ed.path;
    if (ed.max !== 1) {
        item.repeats = true;
    }
    if (ed.min == 1) {
        item.required = true;
    }
    if (ed.type && ed.type.length > 0) {
        item.type = getQtype(ed.type[0]);
    }
    //item.items = [];
    return item;
}


//function addNo

function getQtype(datatype) {
    let qtype = 'string';
    switch (datatype) {
        case 'boolean' :
            qtype = 'boolean'
            break;
        case 'date' :
            qtype = 'date';
            break;
        case 'dateTime' :
            qtype = 'dateTime';
            break;
        case 'backboneElement':
            qtype = 'group';
            break;
    }
    return qtype;
}

function getSingleExtensionValue(resource,url) {
    //return the value of an extension assuming there is only 1...
    var extension;
    if (resource && url) {
        resource.extension = resource.extension || []
        resource.extension.forEach(function(ext){
            if (ext.url == url) {extension = ext}
        });
    }

    return extension;
}
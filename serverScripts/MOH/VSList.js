#!/usr/bin/env node
let fs = require('fs');
let syncRequest = require('sync-request');


let remoteFhirServer = "http://home.clinfhir.com:8040/baseDstu3/";

let hashValueSet = {missing:[]}   //all the valuesets in the models. missing are coded with no VS




//let arModels = ["NzNHIPatient"];
let arModels = [];

let options = {};
options.headers = {"accept": "application/json+fhir"}
options.timeout = 20000;        //20 seconds


//get all the models in the IG
let url = remoteFhirServer + 'ImplementationGuide/cf-artifacts-nz3';
let response = syncRequest('GET', url, options);
let IG = JSON.parse(response.body.toString());

IG.package.forEach(function (package) {
    package.resource.forEach(function (item) {
        let ar = item.sourceReference.reference.split('/');
        let id = ar[ar.length - 1]
        console.log(id)
        arModels.push(id)
    })
})



arModels.forEach(function (modelId) {
    let urlModel = remoteFhirServer + "StructureDefinition/"+modelId;
    console.log("Load model: "+ urlModel)
    let response = syncRequest('GET', urlModel, options);
    let model = JSON.parse(response.body.toString());

    model.snapshot.element.forEach(function(ed,inx) {
        let modelPath = ed.path;
        let description = ed.definition;
        if (ed.type) {
            ed.type.forEach(function (typ) {
                if (typ.code == "CodeableConcept" || typ.code == "code") {        //pretty sure there we only use
                    if (! ed.binding || ! ed.binding.valueSetReference || ! ed.binding.valueSetReference.reference) {
                        //there is no VS bound to this coded element
                        let item = {path:modelPath,description:description,type:typ.code}
                        hashValueSet.missing.push(item)

                    } else {
                        let vsUrl = ed.binding.valueSetReference.reference;
                        hashValueSet[vsUrl] = hashValueSet[vsUrl] || []
                        let item = {path:modelPath,description:description,type:typ.code}
                        hashValueSet[vsUrl].push(item)
                    }
                }
            })
        }


    })



});


//save the json
let filePath = "./vs.json";
let contents = JSON.stringify(hashValueSet)
fs.writeFileSync(filePath,contents)

//write to a csv




console.log(hashValueSet)
let arCSV = []

let regex = new RegExp(',', "g");



for (var key in hashValueSet){
    let ar = hashValueSet[key];
    ar.forEach(function(line,inx){
        let path = line.path;
        let description = line.description;
        let type = line.type
        description = description.replace(regex,'-');


        arCSV.push(key+ ',' + path + "," + description + "," + type)


        /*
        if (inx == 0) {
            arCSV.push(key+ ',' + path + "," + description + "," + type)
        } else {
            arCSV.push(" " + ',' + path + "," + description + "," + type)
        }
*/



    })
}

arCSV.sort()

arCSV.splice(0,0,'ValueSet  Url,Path,Description,dataType ')


let text = arCSV.join('\r\n')
fs.writeFileSync("./vs.csv",text)

console.log(text)




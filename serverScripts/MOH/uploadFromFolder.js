#!/usr/bin/env node

// upload files from a folder to a server

const fs = require('fs');
const syncRequest = require('sync-request');


let IGEntryType = 'http://clinfhir.com/StructureDefinition/igEntryType';
let canonicalUrl = 'http://clinfhir.com/fhir/StructureDefinition/canonicalUrl';

let IGPath = "/Users/davidhay/Dropbox/contracting/MOH/ResourcesForIG/nzRegistry.json"
let IG = JSON.parse(fs.readFileSync(IGPath).toString());

//console.log(IG);




//const confServerRoot = "http://snapp.clinfhir.com:8081/baseDstu3/"
const confServerRoot = "http://home.clinfhir.com:8054/baseR4/";
const termServerRoot = "https://ontoserver.csiro.au/stu3-latest/";


//const termServerRoot = "http://home.clinfhir.com:8054/baseR4/";     //conf server (hapi) needs a copy too...


//where the files to upload are
let folderPath = "/Users/davidhay/Dropbox/contracting/MOH/ResourcesForIG/Terminology/";

//load the IG and update...

let folder = fs.readdirSync(folderPath);


var options = {};
options.headers = {"content-type": "application/json+fhir"}
options.timeout = 20000;        //20 seconds


folder.forEach(file => {

    if (file.substr(0,1)!== '.') {
        let fullPath = folderPath + file;
        let resource = fs.readFileSync(fullPath);
        if (resource) {
            let json = JSON.parse(resource)
            //console.log(json.resourceType, json.id)

            let url;        //the url to uplaod to
            let igType = 'other';     //the type of resource (used by the IG viewer
            if (json.resourceType && json.id) {
                switch (json.resourceType) {
                    case 'CodeSystem':
                        url = termServerRoot + "CodeSystem/";
                        igType = 'codesystem';
                        break;
                    case 'ValueSet':
                        url = termServerRoot + "ValueSet/";
                        igType = 'valueset';
                        break;
                    default :
                        url = confServerRoot + json.resourceType + "/";
                        break

                }
                url += json.id;

                console.log(url);
                options.body = resource;
                var response = syncRequest('PUT', url, options);
                console.log(response.statusCode)
                if (response.statusCode !== 200 && response.statusCode !== 201) {




                    console.log('  error' + response.body.toString())
                } else {
                    console.log('  success');
                    //update the IG if necessary...
                    let reference = json.resourceType + "/" + json.id;      //the reference to this resource in the IG
                    if (IG) {
                        //is there already a reference to this resource
                        let found = false
                        IG.definition.resource.forEach(entry =>{

                            if (entry.reference && entry.reference.reference == reference) {
                                found = true
                            }
                        });
                        if (! found) {
                            console.log('Adding to IG')
                            let entry = {}
                            entry.extension = [{url:IGEntryType,valueCode:igType},{url:canonicalUrl,valueUrl:json.url}]
                            entry.reference = {reference:reference};
                            entry.name = json.name;
                            entry.description = json.id;
                            IG.definition.resource.push(entry)

                        }
                    }


                }



            } else {
                console.log('err ===> resource has no id or resourceType: '+ fullPath)
            }

        }
    }
});


fs.writeFileSync(IGPath,JSON.stringify(IG))



#!/usr/bin/env node

var fs = require('fs');

let fileRoot = "/Users/davidhay/clinfhir/clinFHIR/serverScripts/";
let fileName = "taskList.Json";



let contents = fs.readFileSync(fileRoot + fileName,{encoding:'utf8'})
try {
    let bundle = JSON.parse(contents);

    bundle.type='transaction';
    delete bundle.id;
    delete bundle.meta;
    delete bundle.total;
    delete bundle.link;
    if (bundle.entry) {
        bundle.entry.forEach(function (entry) {
            let resource = entry.resource;
            delete entry.fullUrl
            delete entry.search;        //remove the search related node
            entry.request = {method:'PUT'}
            entry.request.url = resource.resourceType +"/"+resource.id;



        })


    }
    //console.log(bundle)
    let outFileName =fileRoot + 'write-'+fileName;
    fs.writeFileSync(outFileName,JSON.stringify(bundle))
    console.log(outFileName + " created.")




} catch (ex) {
    console.log(ex)
}

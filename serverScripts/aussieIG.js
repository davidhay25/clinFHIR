#!/usr/bin/env node

//Australian version 3 profiles...


var fs = require('fs');
var syncRequest = require('sync-request');

var upload = false;
var errors = 0;


//remoteFhirServer is the conformance server
var remoteFhirServer = "http://snapp.clinfhir.com:8081/baseDstu3/";   //the real one when ready...
//var remoteFhirServer = "https://hof.smilecdr.com:8000/";   //the real one when ready...
var remoteTerminologyServer = "https://ontoserver.csiro.au/stu3-latest/";   //the real one when ready...

//remoteExampleServer is where the examples will be placed
var remoteExampleServer = "http://snapp.clinfhir.com:8081/baseDstu3/";   //the real one when ready...



//Create an implementation guide to hold the artifacts
var IG = {resourceType:'ImplementationGuide',status:'draft',package:[{name:'complete',resource:[]}]};
IG.id = 'cf-artifacts-au3';
IG.url = "http://hof.smile.com/ImplementationGuide/aussie";
IG.description = "Australian Profiles";
IG.extension = [{url: "http://clinfhir.com/fhir/StructureDefinition/cfAuthor",valueBoolean:true}]

//var localFileRoot - all files are in this folder
var localFileRoot = "/Users/davidhay/Dropbox/healthcareInterop/csiro/validator/";

//location of the examples...
var localExamplesRoot = "/Users/davidhay/Dropbox/healthcareInterop/csiro/examples.json/";

console.log('-------- Uploading Examples --------')
var filePath = localFileRoot ;
console.log(filePath);
var fileNames = getFilesInFolder(localExamplesRoot);
//console.log(fileNames)

errors += uploadExamples(remoteExampleServer,localExamplesRoot,fileNames);

//console.log(errors);
//return;



console.log('-------- Uploading StructureDefinitions --------')
var filePath = localFileRoot ;
console.log(filePath);
var fileNames = getFilesInFolder(filePath,'StructureDefinition');
console.log(fileNames)

errors += uploadSD(remoteFhirServer,filePath,fileNames);

console.log('------ Uploading CodeSystems -------')
var fileNames = getFilesInFolder(localFileRoot,'CodeSystem');
errors += uploadCodeSystems(remoteTerminologyServer,localFileRoot,fileNames)


console.log('------ Uploading ValueSets -------')
var fileNames = getFilesInFolder(localFileRoot,'ValueSet');

errors += uploadValueSets(remoteTerminologyServer,localFileRoot,fileNames)



//console.log(IG)

console.log('-------- Uploading ImplementationGuide --------');
var url = remoteFhirServer  + "ImplementationGuide/" + IG.id;
var success = uploadOneFile(url,IG)

if (! success) {
    console.log("Error saving ImplementationGuide.")
} else {
    console.log("Uploaded ImplementationGuide.")
}

if (errors > 0) {
    console.log('-------------------------------------------------------')
    console.log(errors + ' errors')



    console.log('-------------------------------------------------------')
} else {
    console.log('-------------------------------------------------------')
    console.log('No errors')
    console.log('-------------------------------------------------------')
}


return;




function uploadExamples(serverRoot,filePath,arFiles) {
    var noUpload = {'ValueSet':'x','StructureDefinition':'x',CodeSystem:'x'}
    var errors = 0;
    arFiles.forEach(function (fileName) {


        var pathToFile = filePath + fileName;
        var contents = fs.readFileSync(pathToFile,{encoding:'utf8'})
        try {
            var json = JSON.parse(contents);
            var id = json.id;
            console.log('---------------')
            console.log(fileName)
            console.log(json.resourceType)

            var url = serverRoot + json.resourceType + "/"+id;

            var description = 'Exammple ' + json.resourceType;

            if (! noUpload[json.resourceType]) {
                //get rid of all the fluff in the text
                //json.text = {status:'generated',div:'<div xmlns="http://www.w3.org/1999/xhtml"></div>'};

                var IGEntry = {description:json.name,sourceReference:{reference:url},example:true};
                IG.package[0].resource.push(IGEntry);


                IGEntry.acronym = 'example'
                addExtension(IGEntry,'example')

                console.log(IGEntry.acronym)

                //now save to FHIR server

                console.log(IGEntry)


                var success = uploadOneFile(url,json)
                if (! success) {
                    errors++

                }

            }



        } catch (ex) {
            console.log('error processing '+ fileName + " "+ ex)
        }

    })
    return errors;
}




function uploadSD(serverRoot,filePath,arFiles) {
    var errors = 0;
    arFiles.forEach(function (fileName) {


        var ar=fileName.split('-')

        var pathToFile = filePath + fileName;
        var contents = fs.readFileSync(pathToFile,{encoding:'utf8'})
        try {
            var json = JSON.parse(contents);
            var id = json.id;
            //get rid of all the fluff in the text
            json.text = {status:'generated',div:'<div xmlns="http://www.w3.org/1999/xhtml"></div>'};

            var IGEntry = {description:json.name,sourceReference:{reference:json.url},example:false};
            IG.package[0].resource.push(IGEntry);

            if (json.type== 'Extension') {
                //an extension
                IGEntry.acronym = 'extension'
                addExtension(IGEntry,'extension')

            } else {
                IGEntry.acronym = 'profile'
                addExtension(IGEntry,'profile')

            }

            console.log(IGEntry.acronym)

            //now save to FHIR server
            var url = remoteFhirServer + "StructureDefinition/"+id;


            //console.log(json)


            var success = uploadOneFile(url,json)
            if (! success) {
                errors++
            }


        } catch (ex) {
            console.log('error processing '+ fileName + " "+ ex)
        }

    })
    return errors;
}



function uploadCodeSystems(serverRoot,filePath,arFiles) {
    var errors = 0;
    arFiles.forEach(function (fileName) {
        //console.log(fileName);


        var pathToFile = filePath + fileName;
        var contents = fs.readFileSync(pathToFile,{encoding:'utf8'})
        try {
            var json = JSON.parse(contents);
            var id = json.id;

            //var IGEntry = {description:json.name,sourceReference:{reference:json.url}};



            //now save to FHIR server
            var url = serverRoot + "CodeSystem/"+id;

            var success = uploadOneFile(url,json)
            if (! success) {
                errors ++
            } else {
                //only add to the IG if the save succeeded
                //var IGEntry = {acronym:'codesystem',description:json.name,sourceReference:{reference:json.url}};
                //use the sourceUri rather than the sourceReference...
                var IGEntry = {acronym:'codesystem',description:json.name,sourceUri:json.url,example:false};
                addExtension(IGEntry,'codesystem')

                console.log(IGEntry)

                IG.package[0].resource.push(IGEntry);
            }

        } catch (ex) {
            console.log('error processing '+ fileName + " "+ ex)
        }

    })
    return errors;
}

function uploadValueSets(serverRoot,filePath,arFiles) {
    var errors = 0;
    arFiles.forEach(function (fileName) {



        var pathToFile = filePath + fileName;
        var contents = fs.readFileSync(pathToFile,{encoding:'utf8'})
        try {
            var json = JSON.parse(contents);

            //now save to Terminology server
            var url = serverRoot + "ValueSet/"+json.id;

            var success = uploadOneFile(url,json)
            if (! success) {
                errors ++
            } else {
                //add to the IG is save succeeded
                var IGEntry = {acronym:'terminology',description:json.name,sourceReference:{reference:json.url},example:false};
                addExtension(IGEntry,'terminology')
                IG.package[0].resource.push(IGEntry);
            }

        } catch (ex) {
            console.log('error processing '+ fileName + " "+ ex)
        }

    })
    return errors;
}

function addExtension(entry,term) {
    entry.extension = [];
    var extension = {url:'http://clinfhir.com/StructureDefinition/igEntryType'}
    extension.valueCode = term;
    entry.extension.push(extension)
}

function uploadOneFile(url,json) {
    //now save to FHIR server



    var options = {}
    options.body = JSON.stringify(json);
    options.headers = {"content-type": "application/json+fhir"}
    options.timeout = 20000;        //20 seconds


    var un = 'admin'
    var pw = 'ne11ieh@y'


    options.headers.Authorization = 'Basic ' + Buffer.from(un + ':' + pw).toString('base64')


    console.log(url)
    console.log(options.headers)
    try {
        var response = syncRequest('PUT', url, options);
    } catch(ex) {
        console.log('exception:',ex)
    }



    console.log(response.statusCode)
    if (response.statusCode !== 200 && response.statusCode !== 201) {
        console.log('--------------->   error uploading '+ url)
        console.log(response.body.toString())
        return false
    } else {
        console.log('uploaded '+ url)
        return true;
    }

}


function getFilesInFolder(path,filter) {
    var ar = []
    fs.readdirSync(path).forEach(function(file) {



        if (filter) {
            if (file.indexOf(filter) >-1) {

                ar.push(file)
            }
        } else {
            ar.push(file)
        }

    })
    return ar;
}
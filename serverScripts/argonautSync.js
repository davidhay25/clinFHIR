#!/usr/bin/env node

//upload conformance files in a folder structire to a FHOR server
//currently set for careconnect profiles
//works synchronously - easier to programme, and easier on the target server...
var fs = require('fs');
var syncRequest = require('sync-request');


//var remoteFhirServer = "http://snapp.clinfhir.com:8080/baseDstu2/";
var remoteFhirServer = "http://fhirtest.uhn.ca/baseDstu2/";
//var remoteFhirServer = "http://localhost:8079/baseDstu2/";


//Create an implementation guide to hold the artifacts
var IG = {resourceType:'ImplementationGuide',status:'draft',package:[{name:'complete',resource:[]}]};
IG.id = 'cf-argonaut';
IG.description = "Argonaut";
IG.extension = [{url: "http://clinfhir.com/fhir/StructureDefinition/cfAuthor",valueBoolean:true}]

//var localFileRoot = __dirname;
var localFileRoot = "/Users/davidha/Dropbox/orion/argonaut/";


var arFileNames = getFilesInFolder(localFileRoot);


//descending - so valuesets come first
arFileNames.sort(function (a,b) {
    if (a > b) {
        return -1
    } else {
        return 1
    }
})

//console.log(arFileNames)

var errors=0,count=0,ignore=0

arFileNames.forEach(function (name) {
    var fileName = localFileRoot + name;
    //console.log(fileName)

    var contents = fs.readFileSync(fileName, {encoding: 'utf8'})

    var json;
    try {
        var json = JSON.parse(contents);
    } catch (ex) {
        console.log(fileName + ': error parsing into json')
    }

    if (json) {
        var resourceType = json.resourceType;
        console.log(resourceType + ' ' + fileName)


        var ar = name.split('.');
        var id = 'cf-' + ar[0];       //construct an id to use to store the file. This needs review!
        id = id.substr(0, 64);   //max length of a FHIR Id...
        json.id = id;
        var url = remoteFhirServer + resourceType + "/" + id;
        console.log('id=' + id)
        //console.log('url=' + url)

        var purpose, description;
        description = json.description;
        var include = false;
        switch (resourceType) {
            case 'CapabilityStatement' :
                purpose = 'other';
                include = true;
                break;
            case 'ValueSet' :
            case 'CodeSystem' :
                purpose = 'terminology';
                include = true;
                break;
            case 'StructureDefinition':
                include = true;
                //need to look at the resource contents to decide...
                if (json.constrainedType == 'Extension' || json.type=='Extension') {
                    purpose = 'extension'
                } else {
                    purpose = 'profile'
                    //add a 'name' property to all ED's for the logical model
                    json.snapshot.element.forEach(function (ed) {
                        if (! ed.label) {
                            var ar = ed.path.split('.');
                            ar.splice(0,1);
                            ed.label = ar.join('.')
                        }
                    })
                    
                    
                    
                    
                }
        }


        console.log(json.url);




        if (include) {



            var IGEntry = {acronym: purpose, description: description, sourceReference: {reference: json.url}}

            if (json.url.substr(0,3) == 'urn') {
                //this is to adjust cdcrec which has an oid as a url...

                IGEntry.sourceUri = json.url;
            }

            IG.package[0].resource.push(IGEntry);


            //console.log(varIGEntry)

            var options = {};
            //not we can't just use the contents loaded form the file as we may have altered it...
            options.body = JSON.stringify(json);
            options.headers = {"content-type": "application/json+fhir"}
            options.timeout = 20000;        //20 seconds

            var response = syncRequest('PUT', url, options);
            console.log('-->' + response.statusCode)
            if (response.statusCode !== 200 && response.statusCode !== 201) {
                errors++
                console.log(response.body.toString())
            } else {
                count ++
            }
        } else {
            ignore++;
            console.log('...Ignored')
        }


    }

    })

console.log(count + " uploded, "+ errors + " errors," + ignore + " ignored.")



console.log('-------- Uploading ImplementationGuide --------');
var url = remoteFhirServer  + "ImplementationGuide/" + IG.id;
var options = {};
options.body = JSON.stringify(IG);
options.headers = {"content-type": "application/json+fhir"};
options.timeout = 20000;        //20 seconds
var response = syncRequest('PUT', url, options);


console.log(response.statusCode)
if (response.statusCode !== 200 && response.statusCode !== 201) {
    console.log("Error saving ImplementationGuide:" + response.body.toString())
} else {

    console.log("Uploaded ImplementationGuide. id: "+IG.id)
}


function getFilesInFolder(path) {
    var ar = []
    fs.readdirSync(path).forEach(function(file) {
        ar.push(file)
        //console.log(file);
    })
    return ar;
}
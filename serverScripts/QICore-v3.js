#!/usr/bin/env node

//QICore version 3 profiles...


var fs = require('fs');
var syncRequest = require('sync-request');

var upload = false;
var errors = 0;


var remoteFhirServer = "http://localhost:8080/baseDstu3/";

//var remoteFhirServer = "http://snapp.clinfhir.com:8081/baseDstu3/";   //the real one when ready...
//var remoteFhirServer = "http://fhirtest.uhn.ca/baseDstu3/";   //the real one when ready...

//Create an implementation guide to hold the artifacts
var IG = {resourceType:'ImplementationGuide',status:'draft',package:[{name:'complete',resource:[]}]};
IG.id = 'cf-artifacts-qicore';
IG.url = "http://hl7.org/fhir/us/qicore/ImplementationGuide/qicore";
IG.description = "QI Core";
IG.name = "QI Core Implementation Guide";
IG.extension = [{url: "http://clinfhir.com/fhir/StructureDefinition/cfAuthor",valueBoolean:true}];
IG.page = {source:'http://hl7.org/fhir/us/qicore/2018Jan/index.html',title:'Specification',kind:'page',page:[]};



//var localFileRoot = __dirname;
var localFileRoot = "/Users/davidha/Dropbox/fhirIGs/QICore/";


console.log('------ Uploading ValueSets -------');
var filePath = localFileRoot;
var fileNames = getFilesInFolder(filePath);
errors += uploadValueSets(remoteFhirServer,filePath,fileNames);


console.log('------ Uploading CodeSystems -------');
var filePath = localFileRoot;
var fileNames = getFilesInFolder(filePath);
errors += uploadCodeSystem(remoteFhirServer,filePath,fileNames);



console.log('-------- Uploading StructureDefinitions --------');
var filePath = localFileRoot;
console.log(filePath);
var fileNames = getFilesInFolder(filePath);
errors += uploadSD(remoteFhirServer,filePath,fileNames);





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


function uploadSD(serverRoot,filePath,arFiles) {
    var errors = 0;
    arFiles.forEach(function (fileName) {

        if (fileName.substr(0,9) == 'Structure') {
            var ar=fileName.split('-')
            var pathToFile = filePath + fileName;
            var contents = fs.readFileSync(pathToFile,{encoding:'utf8'})
            try {
                var json = JSON.parse(contents);
                //strip out the text element...
                if (json.text && json.text.div) {
                    json.text.div = "<div xmlns='http://www.w3.org/1999/xhtml'>No Text</div>";
                }

                var id = json.id;       //always seems to be present
                if (!id) {
                    console.log(fileName + ' is missing an id');
                    errors++
                    id = 'qi-'+ fileName.substr(0,61);
                }

                var IGEntry = {description:json.name,sourceReference:{reference:json.url}};
                IG.package[0].resource.push(IGEntry);

                if (ar.length == 3) {
                    //a profile
                    IGEntry.acronym = 'profile'
                    addExtension(IGEntry,'profile')

                } else {
                    //an extension
                    IGEntry.acronym = 'extension'
                    addExtension(IGEntry,'extension')

                }

                json.id = id;

                //now save to FHIR server
                var url = remoteFhirServer + "StructureDefinition/"+id;

                var success = uploadOneFile(url,json)
                if (! success) {
                    errors++
                }

            } catch (ex) {
                console.log('error processing '+ fileName + " "+ ex)
            }
        }





    })
    return errors;
}

function uploadCodeSystem(serverRoot,filePath,arFiles) {
    var errors = 0;
    arFiles.forEach(function (fileName) {

        if (fileName.substr(0,10) == 'CodeSystem') {

            var ar = fileName.split('-')
            var pathToFile = filePath + fileName;
            var contents = fs.readFileSync(pathToFile, {encoding: 'utf8'})
            try {
                var json = JSON.parse(contents);
                var id = json.id;
                if (!id) {
                    console.log(fileName + ' is missing an id');
                    errors++
                    id = 'qi-'+ fileName.substr(0,61);
                }

                var IGEntry = {acronym: 'terminology', description: json.name, sourceReference: {reference: json.url}};
                addExtension(IGEntry, 'codesystem')
                IG.package[0].resource.push(IGEntry);

                json.id = id;

                //now save to FHIR server
                var url = remoteFhirServer + "CodeSystem/" + id;

                var success = uploadOneFile(url, json)
                if (!success) {
                    errors++
                }

            } catch (ex) {
                console.log('error processing ' + fileName + " " + ex)
            }
        }

    });

    return errors;
}

function uploadValueSets(serverRoot,filePath,arFiles) {
    var errors = 0;
    arFiles.forEach(function (fileName) {
        //console.log(fileName);
        if (fileName.substr(0,5) == 'Value') {
            var ar = fileName.split('-')
            var pathToFile = filePath + fileName;
            var contents = fs.readFileSync(pathToFile, {encoding: 'utf8'})
            try {
                var json = JSON.parse(contents);
                var id = json.id;
                if (!id) {
                    console.log(fileName + ' is missing an id');
                    errors++
                    id = 'qi-'+ fileName.substr(0,61);
                }

                var IGEntry = {acronym: 'terminology', description: json.name, sourceReference: {reference: json.url}};
                addExtension(IGEntry, 'terminology')
                IG.package[0].resource.push(IGEntry);

                json.id = id;

                //now save to FHIR server
                var url = remoteFhirServer + "ValueSet/" + id;

                var success = uploadOneFile(url, json)
                if (!success) {
                    errors++
                }

            } catch (ex) {
                console.log('error processing ' + fileName + " " + ex)
            }
        }

    })
    return errors;
}

function addExtension(entry,term) {
    entry.extension = [];
    var extension = {url:'http://clinfhir.com/StructureDefinition/igEntryType'}
    extension.valueCode = term;
}

function uploadOneFile(url,json) {
    //now save to FHIR server


    var options = {}
    options.body = JSON.stringify(json);
    options.headers = {"content-type": "application/json+fhir"}
    options.timeout = 20000;        //20 seconds

    var response = syncRequest('PUT', url, options);

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

//send all the xml files in the filepath to the indicated server (serverRoot)
//for now, only use json files to avoid duplication
function uploadFilesDEP(serverRoot,filePath,arFiles,resourceType) {

    var errors = 0, count = 0;

    arFiles.forEach(function (fileName) {



        if (fileName.indexOf('.json')> -1) {     //only json for now

            var pathToFile = filePath+'/'+fileName;


            //console.log(pathToFile)
            var contents = fs.readFileSync(pathToFile,{encoding:'utf8'})

            try {
                var json = JSON.parse(contents);
                if (json.resourceType == resourceType) {
                    //make sure it is of the correct type
                    var err = validateResource(fileName,json)
                    if (err !== "") {
                        console.log(err);
                        errors++;
                    } else {

                        var ar = fileName.split('.');
                        var id = 'cf-' + ar[0];       //construct an id to use to store the file. This needs review!

                        id = id.substr(0,64);   //max length of a FHIR Id...

                        json.id = id;


                        //set the name property from the path if not an extension to make the logical model neater

                        var url = serverRoot + resourceType + "/" + id;
                        console.log('url=' + url)

                        var options = {};
                        //not we can't just use the contents loaded form the file as we may have altered it...
                        options.body = JSON.stringify(json);
                        options.headers = {"content-type": "application/json+fhir"}
                        options.timeout = 20000;        //20 seconds

                        /* temp

                         // console.log(options)
                         var response = syncRequest('PUT', url, options);
                         //console.log(response)
                         console.log(response.statusCode)
                         if (response.statusCode !== 200 && response.statusCode !== 201) {
                         errors++
                         console.log(response.body.toString())
                         } else {

                         count ++
                         }

                         */

                        //update the list ?keep this
                        //  var entry={item: {reference:resourceType + "/" + id,display:id}}
                        // List.entry.push(entry)

                        //update the IG
                        var purpose,description;
                        description = json.description;
                        switch (resourceType) {
                            case 'ValueSet' :
                                purpose = 'terminology';
                                break;
                            case 'StructureDefinition':

                                //need to look at the resource contents to decide...

                                if (json.constrainedType == 'Extension') {
                                //if (fileName.indexOf('Extension') > -1) {
                                    purpose = 'extension'
                                } else {
                                    purpose = 'profile'
                                }
                        }

                        varIGEntry = {purpose:purpose,description:description,sourceReference:{reference:json.url}}
                        IG.package[0].resource.push(varIGEntry);
                        var response = syncRequest('PUT', url, options);
                        console.log('-->' + response.statusCode)
                        if (response.statusCode !== 200 && response.statusCode !== 201) {
                            errors++;
                            console.log(response.body.toString())
                        } else {
                            count ++
                        }

                    }



                }



            } catch(ex) {
                console.log('error: '+ ex + " (quite likely the file is not correct json)")
            }

        }







    })

    if (count > 0) {
        console.log('There were '+count + " files uploaded.")
    }

    if (errors > 0) {
        console.log("WARNING: there were "+errors + " errors...")
    }

    return;

}


function validateResourceDEP(fileName, json) {
    err = ""
    if (! json.url) {
        err += fileName + 'has no url'
    }
    return err;
}


function getFilesInFolder(path) {
    var ar = []
    fs.readdirSync(path).forEach(function(file) {
        ar.push(file)
    })
    return ar;
}
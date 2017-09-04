//Upload SDC IG to an R3 FHIR server

var fs = require('fs');
var syncRequest = require('sync-request');


var referenceRoot = "http://hl7.org/fhir/us/sdc/";  //so we can convert relative to absolute references


//var remoteFhirServer = "http://fhirtest.uhn.ca/baseDstu2/";
//var remoteFhirServer = "http://snapp.clinfhir.com:8080/baseDstu2/";
var remoteFhirServer = "http://localhost:8080/baseDstu3/";
//var localFileRoot = __dirname;
var localFileRoot = "/Users/davidha/Dropbox/orion/SDC/full-ig/site/";
var igFile = localFileRoot + "ImplementationGuide-sdc.json";

var ig = getOneFile(igFile);
if (!ig) {
    console.log("can't find "+igFile)
    return;

}

var IG = JSON.parse(ig);
IG.extension = [{url: "http://clinfhir.com/fhir/StructureDefinition/cfAuthor",valueBoolean:true}]


//upload the referenced artifacts
var inx = 0;
IG.package.forEach(function (package) {

    package.resource.forEach(function (resource) {
        //console.log(resource);
        inx++;
        if (resource.sourceReference) {
            //console.log(inx + ' ref:' + resource.sourceReference.reference + " "+ resource.example);
            var ar = resource.sourceReference.reference.split('/');
            var type = ar[0];
            var newId = ar[1];
            var fileName = localFileRoot + type + '-' + ar[1] + '.json';



           // var newId = ar[1] + '-' + type ;
           // newId = newId.substr(0,64);   //max length of a FHIR Id...

            //console.log(fileName);
            var contents = getOneFile(fileName);
            if (! contents) {
                console.log(fileName + " not found");
            } else {
                //we were able to load the reference
                var json = JSON.parse(contents);        //the referenced resource
                json.id = newId;                        //the id on the server

                //convert relative to absolute references...
                if (resource.sourceReference.reference.substr(0,4 !== 'http')) {
                    resource.sourceReference.reference = referenceRoot+resource.sourceReference.reference;
                }





                var url = remoteFhirServer  + json.resourceType + '/'+ newId;
                console.log(url)

                switch (json.resourceType) {
                    case 'StructureDefinition' :
                        resource.acronym = 'profile';
                        break;
                    case 'ValueSet' :
                        resource.acronym = 'terminology';
                        break;
                    default :
                        resource.acronym = 'other';
                        resource.description += "( "+ json.resourceType + ")";
                        break;

                }


                uploadFile(json,url,fileName)
            }
        }



    })
});



var url = remoteFhirServer + 'ImplementationGuide/'+ IG.id;
console.log(url)

uploadFile(IG,url,"Implementation Guide")


//console.log(IG);


function uploadFile(json,url,fileName) {
    var options = {};
    options.body = JSON.stringify(json);
    options.headers = {"content-type": "application/json+fhir"};
    options.timeout = 20000;        //20 seconds
    var response = syncRequest('PUT', url, options);


    console.log(response.statusCode)
    if (response.statusCode !== 200 && response.statusCode !== 201) {
        console.log("Error saving:"+ fileName + response.body.toString())
    } else {

        //console.log("Uploaded ImplementationGuide.")
    }
}

return;












/*
var List = {resourceType:'List',status:'current',mode:'snapshot',entry:[]};
List.title = "CareConnect profiles";
List.code = {coding:[{system:"http:clinfhir.com/fhir/CodingSystem/cfList",code:'confList'}],text:'clinFHIR conformance list'}
List.id = 'cf-artifacts-cc'

*/

//Create an implementation guide to hold the artifacts
var IG = {resourceType:'ImplementationGuide',status:'draft',package:[{name:'complete',resource:[]}]};
IG.id = 'cf-artifacts-cc';
IG.description = "Care Connect";




console.log('------ Uploading ValueSets -------')
var filePath = localFileRoot + "/CareConnectAPI/ValueSets";

console.log(filePath);
var fileNames = getFilesInFolder(filePath);
uploadFiles(remoteFhirServer,filePath,fileNames,'ValueSet')

console.log('-------- Uploading StructureDefinitions --------')
var filePath = localFileRoot + "/CareConnectAPI/StructureDefinitions";
console.log(filePath);
var fileNames = getFilesInFolder(filePath);
uploadFiles(remoteFhirServer,filePath,fileNames,'StructureDefinition')

//console.log(List)

//temp addPages(fileRoot)



console.log('-------- Uploading ImplementationGuide --------');
//now save the List resource...
//var url = remoteFhirServer  + "List/" + List.id;
var url = remoteFhirServer  + "ImplementationGuide/" + IG.id;
var options = {};
//options.body = JSON.stringify(List);
options.body = JSON.stringify(IG);
//options.body =  body.replace(/(\r\n|\n|\r)/gm,"");
options.headers = {"content-type": "application/json+fhir"};
options.timeout = 20000;        //20 seconds
var response = syncRequest('PUT', url, options);
//console.log(response)

console.log(response.statusCode)
if (response.statusCode !== 200 && response.statusCode !== 201) {
    console.log("Error saving ImplementationGuide:" + response.body.toString())
} else {

    console.log("Uploaded ImplementationGuide.")
}


//--------- functions

function addPages(fileRoot) {
    var arFileNames = getFilesInFolder(filePath);
    // assume that this is a 'top level' list of folders - ie that


}



//send all the xml files in the filepath to the indicated server (serverRoot)
//for now, only use json files to avoid duplication
function uploadFiles(serverRoot,filePath,arFiles,resourceType) {

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

                                if (fileName.indexOf('Extension') > -1) {
                                    purpose = 'extension'
                                } else {
                                    purpose = 'profile'
                                }
                        }

                        varIGEntry = {purpose:purpose,description:description,sourceReference:{reference:json.url}}
                        IG.package[0].resource.push(varIGEntry);
                        var response = syncRequest('PUT', url, options);
                        console.log(response.statusCode)
                        if (response.statusCode !== 200 && response.statusCode !== 201) {
                            errors++
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


function validateResource(fileName, json) {
    err = ""
    if (! json.url) {
        err += fileName + 'has no url'
    }
    return err;
}

function getOneFile(fileName) {
    var contents = fs.readFileSync(fileName);
    if (contents) {
        return contents.toString();
    }

}

function getFilesInFolder(path) {
    var ar = []
    fs.readdirSync(path).forEach(function(file) {
        ar.push(file)
        //console.log(file);
    })
    return ar;
}
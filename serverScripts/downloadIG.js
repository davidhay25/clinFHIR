#!/usr/bin/env node


/**
 * Created by davidha on 1/8/17.
 *
 * make sure the function getTypeFromUrl() has all the types in the IG
 * assumes that the url of a resource is FHIR standard - ie has the resource type in it...
 */


var fs = require('fs');
var syncRequest = require('sync-request');  //found at https://www.npmjs.com/package/sync-request
var log = [];       //log to display at the end

//where the IG is located (and all the resources it references)
var remoteFhirServer = "http://fhir.hl7.org.nz/baseDstu2/";

//where to save the downloaded resources. This path will be the root of the download folder
//make sure the root exists, and that the nodejs user has write permission to that folder (it will create subfolders as well)
//defaults to a folder off the server path...

var localRoot = __dirname + "/Downloads/ig"

console.log(localRoot);
//return;

var IGUrl = remoteFhirServer + "ImplementationGuide/orion";
var IG = loadIG(IGUrl);


var ctr = 0;
IG.package.forEach(function (package) {
    package.resource.forEach(function (entry) {
        var url = entry.sourceReference.reference;
        var purpose =  getPurpose(entry);// entry.purpose || entry.acronym
        console.log(ctr++ + '  ' + url);
        var type = getTypeFromUrl(url);     //assume that the url contains the FHIR resource type in it...
        //console.log(type)
        if (type) {
            var qry = remoteFhirServer + type + '?url='+url;
            var bundle = findByUrl(qry)
            //console.log(qry)
            if (bundle && bundle.entry && bundle.entry.length > 0) {
                if (bundle.entry.length = 1) {
                    var resource = bundle.entry[0].resource;

                    var fileName =url.replace(/\//g,'+')
                    fileName =fileName.replace(/\:/g,'%')

                    var fullFileName = localRoot + purpose + '/' +fileName + ".json";
                    //console.log(fullFileName);


                    //write out the file
                    fs.writeFileSync(fullFileName,JSON.stringify(resource));

                } else {
                    log.push('There are '+ bundle.entry.length + ' resources with the Url: '+url)
                }


            } else {
                log.push("can't find any resources with the Url: "+url)
            }


        } else {
            log.push('Unable to determine the type from the Url: '+url)
        }

    })

    console.log(log)
});


function findByUrl(url){
    var options = {};
    options.headers = {"accept": "application/json+fhir"}
    options.timeout = 20000;        //20 seconds
    var response = syncRequest('GET', url, options);
    //console.log(response.getBody().toString())
    return JSON.parse(response.getBody().toString());



}

//determine the resource type based on the url. Assume a syntax that has the url embedded...
function getTypeFromUrl(url) {
    var type;
    if (url.indexOf('tructureDefinit') > -1) {
        return 'StructureDefinition'
    } else if (url.indexOf('alueSet') > -1) {
        return 'ValueSet'
    }  else if (url.indexOf('odeSystem') > -1) {
        return 'CodeSystem'
    } else if (url.indexOf('amingSystem') > -1) {
        return 'NamingSystem'
    } else if (url.indexOf('apabilityStatement') > -1) {
        return 'CapabilityStatement'
    }
}

//get the purpose of the artifact from the clinFHIR extension or the content
function getPurpose(igResource) {
    var url = 'http://clinfhir.com/StructureDefinition/igEntryType';    //defined in appConfigSvc
    var purpose;
    if (igResource && igResource.extension) {

        igResource.extension.forEach(function(ext){
            if (ext.url == url) {
                purpose = ext.valueCode
            }
        });
    }

    if (purpose) {
        return purpose;
    }

    if (igResource.purpose) {
        return igResource.purpose;
    }

    return 'unknown'


}

function loadIG(IGUrl){
    console.log(IGUrl)
    var options = {};
    options.headers = {"accept": "application/json+fhir"}
    options.timeout = 20000;        //20 seconds
    var response = syncRequest('GET', IGUrl, options);
    //console.log(response.getBody().toString())
    return JSON.parse(response.getBody().toString());
}
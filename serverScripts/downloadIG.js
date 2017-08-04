/**
 * Created by davidha on 1/8/17.
 */


var fs = require('fs');
var syncRequest = require('sync-request');
var log = [];       //log to display at the end
//where the IG is located (and all the resources it references)
var remoteFhirServer = "http://fhir.hl7.org.nz/baseDstu2/";

var IGUrl = remoteFhirServer + "ImplementationGuide/orion";
var IG = loadIG(IGUrl);
var ctr = 0;
IG.package.forEach(function (package) {
    package.resource.forEach(function (entry) {
        var url = entry.sourceReference.reference;
        var purpose = entry.purpose || entry.acronym
        console.log(ctr++ + '  ' + url);
        var type = getTypeFromUrl(url);
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

                    var fullFileName = __dirname + "/downloads/"+ purpose + '/' +fileName + ".json";
                    //console.log(fullFileName);
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
    }



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
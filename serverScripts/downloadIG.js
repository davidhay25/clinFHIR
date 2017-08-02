/**
 * Created by davidha on 1/8/17.
 */


var fs = require('fs');
var syncRequest = require('sync-request');

//where the IG is located (and all the resources it references)
var remoteFhirServer = "http://fhir.hl7.org.nz/baseDstu2/";

var IGUrl = remoteFhirServer + "ImplementationGuide/orion";
var IG = JSON.parse(loadIG(IGUrl));

IG.package.forEach(function (package) {
    package.resource.forEach(function (resource) {
        console.log(resource);
    })
});





function loadIG(IGUrl){
    console.log(IGUrl)
    var options = {};
    options.headers = {"accept": "application/json+fhir"}
    options.timeout = 20000;        //20 seconds
    var response = syncRequest('GET', IGUrl, options);
    //console.log(response.getBody().toString())
    return response.getBody().toString();
}
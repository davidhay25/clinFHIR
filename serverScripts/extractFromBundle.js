//extract the files from a bundle into discrete files


var fs = require('fs');

var sourceFile = "/Users/davidha/Downloads/Orion Health FHIR API's.json";

//This folder must exist with subfolders for each resourceType in the bundle - eg StructureDefinition, ValueSet, ImplementationGuide
var targetFolder = "/Users/davidha/Downloads/profile/";

var contents = fs.readFileSync(sourceFile,{encoding:'utf8'});

//console.log(contents);

var bundle = JSON.parse(contents);

bundle.entry.forEach(function (entry) {
    var resource = entry.resource;

    var resourceType = resource.resourceType;

    var fileName =resource.url.replace(/\//g,'+')       //replace '\' with '+'
    fileName =fileName.replace(/\:/g,'%')               //replace ':' with '%'


    var targetFile = targetFolder + resourceType + "/"+fileName;
    fs.writeFileSync(targetFile,JSON.stringify(resource));


    console.log(resourceType + " " + resource.url + " " + targetFile);


});
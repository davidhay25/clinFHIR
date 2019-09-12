#!/usr/bin/env node

//generate valueet and codesystem from csv
//assume csv is code,display


let fs = require('fs');

//change for different codesystems

let name = "nziwi";       //used for both CS and VS - id and name
let infile = "/Users/davidhay/Dropbox/contracting/MOH/source/iwi.csv";
let title = "New Zealand IWI";
let description = "New Zealand IWI";
/*
let name = "annotationtype";       //used for both CS and VS - id and name
let infile = "/Users/davidhay/Dropbox/contracting/MOH/source/annotationtype";
let title = "Annotation Type";
let description = "Annotation Type";
*/
/*

*/
/*
let name = "nzdomcode";       //used for both CS and VS - id and name
let infile = "/Users/davidhay/Dropbox/contracting/MOH/source/domicileCode.csv";
let title = "New Zealand Domicile code";
let description = "New Zealand Domicile code";
*/
/*
let name = "nzmaoridescent";       //used for both CS and VS - id and name
let infile = "/Users/davidhay/Dropbox/contracting/MOH/source/maoriDescent.csv";
let title = "New Zealand Maori Descent";
let description = "Does the person have maori descent";



let name = "addressnotvalidated";       //used for both CS and VS - id and name
let infile = "/Users/davidhay/Dropbox/contracting/MOH/source/addressNotValidated.csv";
let title = "Address not validated";
let description = "The address was not validated";

let name = "dodinfosource";       //used for both CS and VS - id and name and url
let infile = "/Users/davidhay/Dropbox/contracting/MOH/source/dodInfosource.csv";
let title = "Source of information for date of death";
let description = "Source of information for date of death";
*/

//should be the same for different cs
let canonicalRoot = "http://standards.digital.health.nz/fhir/";
let outFolder = "/Users/davidhay/Dropbox/contracting/MOH/ResourcesForIG/Terminology/";
let csCanonical = canonicalRoot + "CodeSystem/"+name;
let csFileName = outFolder+"cs-"+name + ".json";

let vsCanonical = canonicalRoot + "ValueSet/"+name;
let vsFileName = outFolder+"vs-"+name+ ".json";


let csv = fs.readFileSync(infile).toString();
//console.log(csv)



//make CodeSystem
let cs = {resourceType:"CodeSystem",id:name,status:"draft",name:name,title:title,description:description,content:'complete'}
cs.url = csCanonical;
cs.concept=[];

let ar = csv.split('\n')
ar.forEach(function (line) {
    console.log(line)
    line = line.replace('\r','')
    let ar1 = line.split(',')
    let display = ar1[1].trim();
    let concept = {code:ar1[0],display:display}
    cs.concept.push(concept)

})

fs.writeFileSync(csFileName,JSON.stringify(cs))

let vs = {resourceType:"ValueSet",id:name,status:"draft",name:name,title:title,description:description};
vs.url = vsCanonical;
vs.compose = {include:[{system:csCanonical}]}

fs.writeFileSync(vsFileName,JSON.stringify(vs))

console.log(cs)



#!/usr/bin/env node

//download all the binary documentation files from the Binary endpoint and save as a file...

const fs = require('fs');
const syncRequest = require('sync-request');


//where to save the files...
let outFolder = "/Users/davidhay/Dropbox/contracting/MOH/ResourcesForIG/docs/";


let serverRoot = "http://home.clinfhir.com:8054/baseR4/";
let IGUrl = serverRoot + "ImplementationGuide/nzRegistry";

var options = {};
options.headers = {"content-type": "application/json+fhir"}
options.timeout = 20000;        //20 seconds
//options.url = IGUrl;

var response = syncRequest('GET', IGUrl, options);
console.log(response.statusCode)
if (response.statusCode !== 200) {
    console.log('error downloading IG')
}

let IG = JSON.parse(response.body.toString())

let pageRoot = IG.definition.page;

let arPages = []
getPages(arPages,pageRoot);

console.log(arPages.length)

arPages.forEach(function (item) {
    let url = serverRoot + item.url;
    let ar = item.url.split('/')
    let fileName = outFolder + ar[1]

    var response = syncRequest('GET', url, options)
    if (response.statusCode !== 200) {
        console.log('error downloading '+ url)
    } else {

        let resource = JSON.parse(response.getBody());
        let data = resource.data;
        console.log(resource.data)

        let buff = new Buffer(data, 'base64');
        let contents = buff.toString();

        console.log(contents)

        fs.writeFileSync(fileName,contents)
        //console.log(item.url)
        //console.log(contents)
    }





})



function getPages(ar,node) {
    if (node.nameUrl) {
        let entry = {'url':node.nameUrl,title:node.title};
        ar.push(entry)
    }

    if (node.page) {
        node.page.forEach(function (child) {
            getPages(ar,child)

        })
    }
}




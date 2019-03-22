#!/usr/bin/env node

let fs = require('fs');
let syncRequest = require('sync-request');
let remoteFhirServer = "http://home.clinfhir.com:8040/baseDstu3/";
let bundle = {resourceType: 'Bundle',entry:[]};
let url = remoteFhirServer + "Task/";
let fileName = __dirname+'/tasksBundle.json';

getPage(bundle,url);

fs.writeFileSync(fileName,JSON.stringify(bundle));
console.log('Written ' + bundle.entry.length + " tasks to " + fileName)


function getPage(bundle,url) {
    let options = {};

    options.headers = {"accept": "application/json+fhir"}
    options.timeout = 20000;        //20 seconds
    let response = syncRequest('GET', url, options);
    let b = JSON.parse(response.body.toString())

    if (b.entry) {
        b.entry.forEach(function (ent) {
            bundle.entry.push(ent)
        });

        console.log(bundle.entry.length)

        //is there a next link
        if (b.link) {
            var moreToGet = false;
            for (var i = 0; i < b.link.length; i++) {
                var lnk = b.link[i];

                //if there is a 'next' link and we're not at the limit then get the next page
                if (lnk.relation == 'next') {
                    moreToGet = true;
                    var url = lnk.url;
                    getPage(bundle, url);
                    break;
                }
            }
            if (!moreToGet) {
                return;
            }
        } else {
            return;
        }
    }


}


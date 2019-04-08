#!/usr/bin/env node

// upload files in an IG buolder ig to a server
const fs = require('fs');
const syncRequest = require('sync-request');
const confServerRoot = "http://snapp.clinfhir.com:8081/baseDstu3/"
const termServerRoot = "https://ontoserver.csiro.au/stu3-latest/"

let igRoot = '/Users/davidhay/nhiIG/';

let fileName = igRoot + 'resources/ig.json';

var ig = JSON.parse( fs.readFileSync(fileName,{encoding:'utf8'}));

ig.package.forEach(function (package) {
    package.resource.forEach(function (resource) {
        if (! resource.example) {
            let ref = resource.sourceReference.reference;
            console.log(ref)
            let ar = ref.split('/');
            let type = ar[0].toLowerCase();
            let id = ar[1]; //.toLowerCase();
            let result = loadResource(type,id)
            if (result) {
                console.log('found: '+ type + " : " + result.file)
                var url;
                switch (type) {
                    case 'structuredefinition' :
                        url = confServerRoot + 'StructureDefinition/'+id
                        break;
                    case 'valueset' :
                        url = termServerRoot + 'ValueSet/'+id
                        break;
                    case 'codesystem' :
                        url = termServerRoot + 'CodeSystem/'+id
                        break;
                }

                console.log(url)

                var options = {}
                options.timeout = 20000;        //20 seconds
                if (result.content.indexOf('xmlns') == -1) {
                    options.body = result.content;
                    options.headers = {"content-type": "application/fhir+json"}
                } else {
                    options.body = result.content;
                    options.headers = {"content-type": "application/fhir+xml"}
                }


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




            } else {
                console.log()
            }


        }
    })
});


function loadResource(type,id) {
    let ar = []
    let t = type.toLowerCase();

    if (t == 'structuredefinition') {
        //grab the SD that the ig builder created as it will have the snapshot
        let fileName = igRoot + 'output/StructureDefinition-'+id + '.xml'
        try {
            let contents = fs.readFileSync(fileName,{encoding:'utf8'});
            return {content: contents,file: fileName};
        } catch (ex) {

        }

    } else {
        //not an SD....
        ar.push(igRoot + 'resources/'+t + '-'+id + '.xml');
        ar.push(igRoot + 'resources/'+t + '-'+id + '.json');
        ar.push(igRoot + 'resources/'+id + '.'+t + '.xml');
        ar.push(igRoot + 'resources/'+id + '.'+t + '.json');


        for (var i=0; i < ar.length; i++) {
            try {
                let contents = fs.readFileSync(ar[i],{encoding:'utf8'});
                return {content: contents,file: ar[i]};
            } catch (ex) {
                console.log(ar[i] + ' not found')
            }

        }

    }






}

function loadFile(fileName) {
    let contents = fs.readFileSync(fileName,{encoding:'utf8'});

}


//var json = JSON.parse(contents);
//console.log(json);

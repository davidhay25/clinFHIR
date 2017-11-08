#!/usr/bin/env node
//download the complex datatypes...

var syncRequest = require('sync-request');

var upload = false;
var errors = 0;

var exclude = ['id','extension']

var listOfDT = []
listOfDT.push({"name":"Dosage",url:"http://localhost:8080/baseDstu3/StructureDefinition/Dosage"});
listOfDT.push({"name":"CodeableConcept",url:"http://localhost:8080/baseDstu3/StructureDefinition/CodeableConcept"});
listOfDT.push({"name":"Identifier",url:"http://localhost:8080/baseDstu3/StructureDefinition/Identifier"});

var file = {};
listOfDT.forEach(function(item){
    file[item.name] = getOneDT(item.url)
})

var v = JSON.stringify(file);

//console.log(JSON.parse(v));
console.log(v);



function getOneDT(url) {


    var options = {}
    options.headers = {"accept": "application/json+fhir"}
    options.timeout = 20000;        //20 seconds

    var response = syncRequest('GET', url, options);
    var json = JSON.parse(response.body.toString());
    var lst = []
    for (var i = 0; i < json.snapshot.element.length; i++) {

        var ed = json.snapshot.element[i];
        var path = ed.path
        var ar = path.split('.')
        ar.splice(0, 1);
        console.log(path)
        if (ar.length > 0 && exclude.indexOf(ar[1]) == -1) {
            if (path.indexOf('[x]') > -1 && ed.type) {
                var pathRoot = ar.join('.'); //path.substr(0,path.length-3);
                pathRoot = pathRoot.replace('[x]', '')
                ed.type.forEach(function (typ) {
                    if (typ.code) {
                        var cd = typ.code[0].toUpperCase() + typ.code.substr([1]);
                        var newPath = pathRoot + cd;
                        lst.push({name: newPath, type: cd})
                        // hash[newPath] = ed;
                    }
                })

            } else {
                var name = ar.join('.')
                if ( exclude.indexOf(name) == -1) {
                    lst.push({name: name, type: ed.type[0].code})
                    // hash[path] = ed;
                }


            }
        }

    }

    return lst;
   // return JSON.stringify(lst);
}

//console.log(JSON.stringify(lst))


//console.log(response.body.toString())
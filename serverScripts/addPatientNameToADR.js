#!/usr/bin/env node

var urlRoot = "http://conman.fhir.org:8080/baseDstu3/";

var syncRequest = require('sync-request');

String.prototype.toProperCase = function () {
    return this.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
};

var cnt = 500

for (var i=1; i < cnt; i++) {
    var url = urlRoot + "/Patient/p"+i

    var options = {}
    options.headers = {"accept": "application/json","content-type": "application/json"}
    options.timeout = 20000;        //20 seconds
    var result = syncRequest('GET', url, options).getBody()
    if (result) {
        var patient = JSON.parse(result.toString())


        var data = syncRequest('GET','https://randomuser.me/api/?format=json&nat=nz').getBody()
        if (data) {
            var info = JSON.parse(data.toString())


            var name = info.results[0].name;

            patient.name[0].given  = [name.first.toProperCase()];
            patient.name[0].family = name.last.toProperCase();
            patient.name[0].text = name.first.toProperCase() + " " + name.last.toProperCase();
            patient.gender = info.results[0].gender;
            options.body = JSON.stringify(patient);
            var response = syncRequest('PUT', url, options);

            console.log(patient.id, response.statusCode)

        }

    }
}
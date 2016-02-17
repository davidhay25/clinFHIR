/*
A service that will return the configuration object for the application. Currently this defines the servers to use...
*/


angular.module("sampleApp")
    //this returns config options. When it's all working we'll allow multiple servers...


    .service('appConfigSvc', function() {

        var DataServer;     //the currently selected data server server

        return {
            config : function() {
                //todo - convert to a file and make async...
                var config = {servers : {}}
                config.servers.terminology = "http://fhir2.healthintersections.com.au/open/";
                config.servers.data = "http://localhost:8080/baseDstu2/";
                config.servers.conformance = "http://fhir2.healthintersections.com.au/open/";
                config.allKnownServers = [];
                config.allKnownServers.push({name:"Grahames server",url:"http://fhir2.healthintersections.com.au/open/"});
                config.allKnownServers.push({name:"Local server",url:"http://localhost:8080/baseDstu2/"});
                config.allKnownServers.push({name:"HAPI server",url:"http://fhirtest.uhn.ca/baseDstu2/"});
                config.allKnownServers.push({name:"Spark Server",url:"http://spark-dstu2.furore.com/fhir/"});
                config.allKnownServers.push({name:"HealthConnex (2.0",url:"http://sqlonfhir-dstu2.azurewebsites.net/fhir/"});

                return config
            },
            setCurrentDataServer : function(sb) {
                //set the current data server...
                DataServer = sb;
            },
            getCurrentDataServerBase : function(sb) {
                //return the base of the currently selected data server
                return DataServer.url;
            }
        }
    })

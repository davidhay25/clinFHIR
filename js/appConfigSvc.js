/*
A service that will return the configuration object for the application. Currently this defines the servers to use...
*/


angular.module("sampleApp")
    //this returns config options. At the moment it is for servers...
//also holds the current patient and all their resources...
    //note that the current profile is maintained by resourceCreatorSvc

    .service('appConfigSvc', function($localStorage) {

        var dataServer;     //the currently selected data server server
        var currentPatient;    //the currently selected patint
        var allResources;       //all resources for the current patient

        var config = {servers : {}};
        config.servers.terminology = "http://fhir2.healthintersections.com.au/open/";
        config.servers.data = "";   //set from the first element of the allKnownServers array
        //config.servers.conformance = "http://fhir2.healthintersections.com.au/open/";
        config.servers.conformance = "http://sqlonfhir-dstu2.azurewebsites.net/fhir/";
        config.allKnownServers = [];


        //config.allKnownServers.push({name:"Grahame STU-3",url:"http://fhir3.healthintersections.com.au/open/"});
        config.allKnownServers.push({name:"Grahames server",url:"http://fhir2.healthintersections.com.au/open/",everythingOperation:true});
        config.allKnownServers.push({name:"HealthConnex (2.0)",url:"http://sqlonfhir-dstu2.azurewebsites.net/fhir/"});

        config.allKnownServers.push({name:"HAPI server",url:"http://fhirtest.uhn.ca/baseDstu2/"});
        config.allKnownServers.push({name:"Local server",url:"http://localhost:8080/baseDstu2/"});

        //config.allKnownServers.push({name:"Spark Server",url:"http://spark-dstu2.furore.com/fhir/"});


        return {
            config : function() {
                //todo - convert to a file and make async...
                //note that the initial server selected will be the first in the allKnownServers array...
                return config
            },
            getAllServers : function() {
                //console.log(config.allKnownServers)
              return config.allKnownServers;
            },
            setCurrentDataServer : function(sb) {
                //set the current data server...
                dataServer = sb;
            },
            getCurrentDataServerBase : function(sb) {
                //return the base of the currently selected data server
                return dataServer.url;
            },
            getCurrentDataServer : function(sb) {
                //return the currently selected data server
                return dataServer;
            },
            setCurrentPatient : function(patient) {
                currentPatient = patient;
            },
            getCurrentPatient : function() {
                return currentPatient;
            },
            setAllResources : function(ar) {
                //toto refactor to perform the query. Right now that's done by 'supportSvc' which has this serice as a dependency,

                allResources = ar;
            },
            getAllResources : function() {
                return allResources;
            },
            addToRecent : function(profile) {
                $localStorage.recent = $localStorage.recent || [];
                var alreadyThere = false;
                var url = profile.url;
                for (var i=0; i < $localStorage.recent.length; i++) {
                    if ($localStorage.recent[i].url == url) {
                        alreadyThere = true;
                        break;
                    }
                }

                if (! alreadyThere) {
                    $localStorage.recent.push(profile);
                }


            },
            getRecent : function(){
                return $localStorage.recent || [];
            }
        }
    })

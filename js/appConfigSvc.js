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

        //the default config for a new browser...
        var defaultConfig = {servers : {}};
        defaultConfig.servers.terminology = "http://fhir3.healthintersections.com.au/open/";
        defaultConfig.servers.data = "http://fhir3.healthintersections.com.au/open/";
        defaultConfig.servers.conformance = "http://fhir3.healthintersections.com.au/open/";
        defaultConfig.allKnownServers = [];


        //config.allKnownServers.push({name:"Grahame STU-3",url:"http://fhir3.healthintersections.com.au/open/"});
        defaultConfig.allKnownServers.push({name:"Grahame STU3 server",url:"http://fhir3.healthintersections.com.au/open/",version:3,everythingOperation:true});
        defaultConfig.allKnownServers.push({name:"Grahames STU2 server",url:"http://fhir2.healthintersections.com.au/open/",version:2,everythingOperation:true});
        defaultConfig.allKnownServers.push({name:"HealthConnex (2.0)",url:"http://sqlonfhir-dstu2.azurewebsites.net/fhir/",version:2});
        defaultConfig.allKnownServers.push({name:"HAPI server",url:"http://fhirtest.uhn.ca/baseDstu2/",version:2});
        defaultConfig.allKnownServers.push({name:"Local server",url:"http://localhost:8080/baseDstu2/",version:2});

        //config.allKnownServers.push({name:"Spark Server",url:"http://spark-dstu2.furore.com/fhir/"});


        return {
            config : function() {

                if (! $localStorage.config) {
                    $localStorage.config = defaultConfig;
                }

                return $localStorage.config

            },
            getAllServers : function() {
                //console.log(config.allKnownServers)
              return defaultConfig.allKnownServers;
            },
            setCurrentDataServerDEP : function(sb) {
                //set the current data server...
                dataServer = sb;
            },
            getCurrentDataServerBase : function(sb) {
                //return the base of the currently selected data server
                return $localStorage.config.servers.data;
                //return dataServer.url;
            },
            getCurrentDataServer : function(sb) {
                //return the currently selected data server

                //need to get the definition for the data server. This is not pretty...
                //note that the $localstorage will always be populated by a call to config above...
                for (var i=0; i < $localStorage.config.allKnownServers.length; i++){
                    var svr = $localStorage.config.allKnownServers[i];
                    if (svr.url == $localStorage.config.servers.data) {
                        return svr;
                    }
                }

                //return dataServer;
            },
            getCurrentConformanceServer : function() {
                for (var i=0; i < $localStorage.config.allKnownServers.length; i++){
                    var svr = $localStorage.config.allKnownServers[i];
                    if (svr.url == $localStorage.config.servers.conformance) {
                        return svr;
                    }
                }
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
            addToRecentPatient : function(patient) {
                //add to list of recent patients
                var dataServerUrl = $localStorage.config.servers.data;

                $localStorage.recentPatient = $localStorage.recentPatient || [];
                var alreadyThere = false;
                var id = patient.id;
                for (var i=0; i < $localStorage.recentPatient.length; i++) {
                    var recentP = $localStorage.recentPatient[i];
                    if (recentP.serverUrl == dataServerUrl && recentP.patient.id == patient.id) {
                        //same patient on the same server
                        alreadyThere = true;
                        break;
                    }
                }

                if (! alreadyThere) {
                    $localStorage.recentPatient.push({patient:patient,serverUrl:dataServerUrl});
                }

            },
            getRecentPatient : function(){
                var dataServerUrl = $localStorage.config.servers.data;
                var lst = [];
                if ($localStorage.recentPatient) {
                    $localStorage.recentPatient.forEach(function(recentP){
                        if (recentP.serverUrl == dataServerUrl) {
                            lst.push(recentP.patient);
                        }
                    });

                }

                return lst;
            },
            addToRecentProfile : function(profile) {
                //add to the list of recent profiles...
                var conformanceServerUrl = $localStorage.config.servers.conformance;


                $localStorage.recentProfile = $localStorage.recentProfile || [];
                var alreadyThere = false;
                var url = profile.url;
                for (var i=0; i < $localStorage.recentProfile.length; i++) {
                    var recent = $localStorage.recentProfile[i];
                    if (recent.profile.url == url && recent.profile.serverUrl == conformanceServerUrl) {
                        alreadyThere = true;
                        break;
                    }
                }

                if (! alreadyThere) {
                    $localStorage.recentProfile.push({profile:profile,serverUrl:conformanceServerUrl});
                }


            },
            getRecentProfile : function(){
                //get the list of recent profiles from the current conformance server
                var conformanceServerUrl = $localStorage.config.servers.conformance;
                var lst = [];
                if ($localStorage.recentProfile) {
                    $localStorage.recentProfile.forEach(function(recent){
                        if (recent.serverUrl == conformanceServerUrl) {
                            lst.push(recent.profile);
                        }
                    });

                }

                return lst;
            }
        }
    });

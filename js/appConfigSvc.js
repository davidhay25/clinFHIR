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
        defaultConfig.baseSpecUrl = "http://hl7.org/fhir/";     //the base for spec documentation
        defaultConfig.logLevel = 0;     //0 = no logging, 1 = log to console
        defaultConfig.enableCache = false;  //whether caching is supported
        //defaultConfig.servers.terminology = "http://fhir2.healthintersections.com.au/open/";
        defaultConfig.servers.terminology = "http://fhir.hl7.org.nz/dstu2/";
        defaultConfig.servers.data = "http://fhir2.healthintersections.com.au/open/";
        //defaultConfig.servers.conformance = "http://fhir2.healthintersections.com.au/open/";
        defaultConfig.servers.conformance = "http://fhir.hl7.org.nz/baseDstu2/";

        //default to Grahames DSTU2 server when data and conformance servers are inconsistent...
        //defaultConfig.defaultTerminologyServerUrl = "http://fhir2.healthintersections.com.au/open/";
        defaultConfig.defaultTerminologyServerUrl = "http://fhir.hl7.org.nz/dstu2/";

        defaultConfig.terminologyServers = [];
        defaultConfig.terminologyServers.push({version:2,url:"http://fhir.hl7.org.nz/dstu2/"});
        defaultConfig.terminologyServers.push({version:2,url:"http://fhir2.healthintersections.com.au/open/"});
        defaultConfig.terminologyServers.push({version:3,url:"http://fhir3.healthintersections.com.au/open/"});


        defaultConfig.allKnownServers = [];
        defaultConfig.allKnownServers.push({name:"Grahame STU3 server",url:"http://fhir3.healthintersections.com.au/open/",version:3,everythingOperation:true});
        defaultConfig.allKnownServers.push({name:"Grahames STU2 server",url:"http://fhir2.healthintersections.com.au/open/",version:2,everythingOperation:true});
        defaultConfig.allKnownServers.push({name:"HealthConnex (2.0)",url:"http://sqlonfhir-dstu2.azurewebsites.net/fhir/",version:2,everythingOperation:true});
        defaultConfig.allKnownServers.push({name:"HAPI server",url:"http://fhirtest.uhn.ca/baseDstu2/",version:2,everythingOperation:true});
        defaultConfig.allKnownServers.push({name:"HL7 New Zealand",url:"http://fhir.hl7.org.nz/dstu2/",version:2,everythingOperation:true});



        //config.allKnownServers.push({name:"Spark Server",url:"http://spark-dstu2.furore.com/fhir/"});


        return {
            checkConsistency : function() {
                //check that all the servers are on the same version
                var rtn = {consistent:true,terminologyServers:[]};       //return an object

                var tmp = [];
                //first get the descriptive objects for the servers...
                var config = $localStorage.config;
                config.allKnownServers.forEach(function(svr){
                    if (config.servers.data == svr.url) {tmp.push(svr)}
                    if (config.servers.conformance == svr.url) {tmp.push(svr)}
                });

                //now see if they are all the same version - will need a loop if more than 2!
                if (tmp.length < 2 || tmp[0].version !== tmp[1].version) {
                    //if they're not the same, then return all the servers so the user can choose
                    rtn.consistent = false;
                    rtn.terminologyServers = config.terminologyServers;

                    //select the default terminology server

                    $localStorage.config.servers.terminology = config.defaultTerminologyServerUrl;

                    return rtn;
                }

                //now make sure the terminology server is the correct version..
                //todo - need to think about how to handle where there is more than one terminology server, or Grahames is down...
                rtn.terminologyServers = [];    //this will be all terminlogy servers for this version...
                var version = tmp[0].version;       //the FHIR version
                for (var i=0; i <config.terminologyServers.length;i++) {
                    var s = config.terminologyServers[i];

                    if (s.version == version) {
                        rtn.terminologyServers.push(s)
                        $localStorage.config.servers.terminology = s.url;
                        config.log('setting  terminology server to '+s.url,'appConfig:config')
                    }
                }
                return rtn;
            },
            config : function() {

                if (! $localStorage.config) {
                    $localStorage.config = defaultConfig;
                }

                var config = $localStorage.config;

                //add a logging function...
                if (config.logLevel !== 0) {
                    config.log = function(display,location) {
                        console.log(location + ":" + display);
                    }
                } else {
                    //a disabled log;
                    config.log = function() {}
                }
                
                
                
                return config;

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
                    if (recent.profile.url == url && recent.serverUrl == conformanceServerUrl) {
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
            },
            clearProfileCache : function() {
                delete $localStorage.recentProfile;
            }
        }
    });

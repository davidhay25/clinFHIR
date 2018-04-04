/*
A service that will return the configuration object for the application. Currently this defines the servers to use...
*/


angular.module("sampleApp")
    //this returns config options. At the moment it is for servers...
//also holds the current patient and all their resources...
    //note that the current profile is maintained by resourceCreatorSvc

    .service('appConfigSvc', function($localStorage,$http,$timeout,$q) {

        var dataServer;         //the currently selected data server server
        var currentPatient;     //the currently selected patint
        var allResources;       //all resources for the current patient

        //the default config for a new browser...
        var defaultConfig = {servers : {}};
        defaultConfig.lastUpdated='2018-04-05';     //will trigger a reload when this changes

        defaultConfig.standardExtensionUrl = {};
        defaultConfig.standardSystem = {};
        defaultConfig.standardCode = {};
        
        //if a valueset has concepts entered directly but not in snomed (so terminology services won't expand)
        defaultConfig.standardExtensionUrl.vsDirectConcept = 'http://clinfhir.com/fhir/StructureDefinition/vsDirectConcept';

        defaultConfig.standardExtensionUrl.edMappingComment = 'http://clinfhir.com/fhir/StructureDefinition/edMappingComment';
        defaultConfig.standardExtensionUrl.mapToModel = 'http://clinfhir.com/fhir/StructureDefinition/mapToModel';
        defaultConfig.standardExtensionUrl.baseTypeForModel = 'http://clinfhir.com/fhir/StructureDefinition/baseTypeForModel';
        defaultConfig.standardExtensionUrl.docrefDescription = 'http://clinfhir.com/fhir/StructureDefinition/docrefDescription';
        defaultConfig.standardExtensionUrl.simpleExtensionUrl = 'http://clinfhir.com/fhir/StructureDefinition/simpleExtensionUrl';
        defaultConfig.standardExtensionUrl.clinFHIRCreated = 'http://clinfhir.com/fhir/StructureDefinition/cfAuthor';
        defaultConfig.standardExtensionUrl.userEmail = 'http://clinfhir.com/StructureDefinition/userEmail';


        defaultConfig.standardExtensionUrl.scenarioProvenance = 'http://clinfhir.com/StructureDefinition/scenarioProvenance';
        defaultConfig.standardExtensionUrl.scenarioNote = 'http://clinfhir.com/StructureDefinition/scenarioNote';
        defaultConfig.standardExtensionUrl.provenanceTargetUrl = 'http://clinfhir.com/StructureDefinition/provenanceTargetUrl';
        defaultConfig.standardExtensionUrl.discriminatorUrl = 'http://clinfhir.com/StructureDefinition/discriminatorUrl';
        defaultConfig.standardExtensionUrl.conceptMapUrl = 'http://clinfhir.com/StructureDefinition/conceptMapUrl';

        defaultConfig.standardExtensionUrl.resourceTypeUrl = 'http://clinfhir.com/StructureDefinition/resourceTypeUrl';
        defaultConfig.standardExtensionUrl.qPath = 'http://clinfhir.com/StructureDefinition/qPathUrl';
        defaultConfig.standardExtensionUrl.qMult = 'http://clinfhir.com/StructureDefinition/qMultUrl';
        defaultConfig.standardExtensionUrl.igEntryType = 'http://clinfhir.com/StructureDefinition/igEntryType';
        defaultConfig.standardExtensionUrl.qItemDescription = 'http://clinfhir.com/fhir/StructureDefinition/qItemDescription';
        defaultConfig.standardExtensionUrl.fhirPath = 'http://clinfhir.com/fhir/StructureDefinition/fhirPath';



        defaultConfig.standardSystem.identifierSystem = 'http://clinfhir.com/fhir/NamingSystem/identifier';
        defaultConfig.standardSystem.practitionerIdentifierSystem = 'http://clinfhir.com/fhir/NamingSystem/practitioner';
        defaultConfig.standardSystem.listTypes = 'http://clinfhir.com/fhir/CodeSystem/listTypes';



        defaultConfig.standardCode.lmPalette = defaultConfig.standardSystem.listTypes + '|lmPalette' 
            
        var version = {current:'2.0.0',versionHistory:[]}
        
/*
        //todo - not currently being used as thre are synchronous uses of defaultConfig
        $http.get("config.json").then(
            function(data) {
                console.log(data.data);
                defaultConfig = data.data;
            }
        );


        */

        //defaultConfig = {servers : {}};

        defaultConfig.baseSpecUrl = "http://hl7.org/fhir/";     //the base for spec documentation
        defaultConfig.logLevel = 0;     //0 = no logging, 1 = log to console
        defaultConfig.enableCache = false;  //whether caching is supported

        //these are the default servers....
        defaultConfig.servers.terminology = "https://ontoserver.csiro.au/stu3-latest/";//
        defaultConfig.servers.data = "http://fhirtest.uhn.ca/baseDstu3/";
        defaultConfig.servers.conformance = "http://fhirtest.uhn.ca/baseDstu3/";

        //defaultConfig.defaultTerminologyServerUrl = "http://fhirtest.uhn.ca/baseDstu3/";

        defaultConfig.defaultTerminologyServerUrl = "https://ontoserver.csiro.au/stu3-latest/";




        //terminology servers. Order is significant as the first one will be selected by default...
        defaultConfig.terminologyServers = [];
        defaultConfig.allKnownServers = [];

        defaultConfig.terminologyServers.push({name:'Grahames STU2 Server',version:2,url:"http://test.fhir.org/r2/"});
        defaultConfig.terminologyServers.push({name:'Grahames STU3 Server',version:3,url:"http://test.fhir.org/r3/"});

        defaultConfig.terminologyServers.push({name:'Public HAPI STU3 server',version:3,url:"http://fhirtest.uhn.ca/baseDstu3/"});

       // defaultConfig.terminologyServers.push({name:'Ontoserver',version:3,url:"http://52.63.0.196:8080/fhir/"});
        defaultConfig.terminologyServers.push({name:"Local HAPI STU3",url:"http://localhost:8080/baseDstu3/",version:3});
        defaultConfig.terminologyServers.push({name:"fhir.org",url:"http://tx.fhir.org/r3/",version:3});

        defaultConfig.terminologyServers.push({name:"Ontoserver",url:"https://ontoserver.csiro.au/stu3-latest/",version:3});



        defaultConfig.allKnownServers.push({name:"Grahames STU2 server",url:"http://test.fhir.org/r2/",version:2,everythingOperation:true,isTerminology:true});
        defaultConfig.allKnownServers.push({name:"Grahames STU3 server",url:"http://test.fhir.org/r3/",version:3,everythingOperation:true,isTerminology:true});
        

        defaultConfig.allKnownServers.push({name:"Public HAPI STU2 server",url:"http://fhirtest.uhn.ca/baseDstu2/",version:2,everythingOperation:true});


        defaultConfig.allKnownServers.push({name:"Public HAPI STU3 server",url:"http://fhirtest.uhn.ca/baseDstu3/",version:3,everythingOperation:true,isTerminology:true});

        defaultConfig.allKnownServers.push({name:"Vonk STU3 server",url:"http://vonk.fire.ly/",version:3,everythingOperation:false});



        defaultConfig.allKnownServers.push({name:"HealthConnex STU2 server",url:"http://sqlonfhir-dstu2.azurewebsites.net/fhir/",version:2,everythingOperation:true});
        defaultConfig.allKnownServers.push({name:"HealthConnex STU3 server",url:"http://sqlonfhir-stu3.azurewebsites.net/fhir/",version:3,everythingOperation:true});

        defaultConfig.allKnownServers.push({name:"Local HAPI STU2 server",url:"http://localhost:8079/baseDstu2/",version:2,everythingOperation:true});
        defaultConfig.allKnownServers.push({name:"Local HAPI STU3 server",url:"http://localhost:8080/baseDstu3/",version:3,everythingOperation:true,isTerminology:true});


        defaultConfig.allKnownServers.push({name:"HL7 New Zealand STU2 server",url:"http://fhir.hl7.org.nz/baseDstu2/",version:2});


        defaultConfig.allKnownServers.push({name:'fhir.org',version:3,url:"http://tx.fhir.org/r3/",isTerminology:true});
        //defaultConfig.allKnownServers.push({name:'Ontoserver STU3',version:3,url:"http://52.63.0.196:8080/fhir/",isTerminology:true});
        defaultConfig.allKnownServers.push({name:'MiHIN STU2',version:2,url:"http://52.72.172.54:8080/fhir/baseDstu2/"});
        defaultConfig.allKnownServers.push({name:'Simplifier R3',version:3,url:"https://stu3.simplifier.net/open/"});
        defaultConfig.allKnownServers.push({name:'Aegis WildFHIR STU3',version:3,url:" http://wildfhir.aegis.net/fhir3-0-1/"});


        defaultConfig.allKnownServers.push({name:'clinFHIR R2' ,version:2,url:"http://snapp.clinfhir.com:8080/baseDstu2/"});
        defaultConfig.allKnownServers.push({name:'clinFHIR R3',version:3,url:"http://snapp.clinfhir.com:8081/baseDstu3/"});


        defaultConfig.allKnownServers.push({name:'GoFHIR',version:3,url:"https://syntheticmass.mitre.org/fhir/",everythingOperation:true});

        defaultConfig.allKnownServers.push({name:'HSPC-14',version:3,url:"https://api3.hspconsortium.org/fhirconnect14/open/",everythingOperation:true});
        defaultConfig.allKnownServers.push({name:'HSPC Careplan',version:3,url:"https://api-stu3.hspconsortium.org/careplantest/open/",everythingOperation:true});


        defaultConfig.allKnownServers.push({name:'Patients First R3',version:3,url:"http://its.patientsfirst.org.nz/RestService.svc/Terminz/"});

        defaultConfig.allKnownServers.push({name:'HSPC Synthea',version:3,url:"https://api3.hspconsortium.org/HSPCplusSynthea/open/"});

        defaultConfig.allKnownServers.push({name:'NHS-UK STU-2',version:2,url:"https://fhir.nhs.uk/"});
        defaultConfig.allKnownServers.push({name:'HL7-UK STU-2',version:2,url:"https://fhir-test.hl7.org.uk/"});


        defaultConfig.allKnownServers.push({name:'FHIR Registry',version:3,url:"https://registry-api.fhir.org/open/",everythingOperation:true});
        defaultConfig.allKnownServers.push({name:"Ontoserver (terminology)",url:"https://ontoserver.csiro.au/stu3-latest/",version:3,everythingOperation:true,isTerminology:true});

        defaultConfig.allKnownServers.push({name:'Orion R2-Test',version:2,url:"orionProxy/",smart:true});

        //place all the servers in a hash indexed by url. THis is used for the userConfig
        var allServersHash = {};
        defaultConfig.allKnownServers.forEach(function(server){
            allServersHash[server.url] = server;
        });


       // defaultConfig.allKnownServers.push({name:'Patients First Server',version:3,url:"http://its.patientsfirst.org.nz/RestService.svc/Terminz/"});


        //Set up the local storage in config. note that a local browser can add to $localStorage.config
        if (! $localStorage.config) {
            $localStorage.config = defaultConfig;
        }

        return {
            setToDefault : function(){
                //this.setServerType('terminology',"http://fhir3.healthintersections.com.au/open/");
                this.setServerType('terminology',"https://ontoserver.csiro.au/stu3-latest/");
                this.setServerType('data',"http://fhirtest.uhn.ca/baseDstu3/");
                this.setServerType('conformance',"http://fhirtest.uhn.ca/baseDstu3/");
            },
            addServer : function(svr,isTerminology) {
                $localStorage.config.allKnownServers.push(svr)
                if (isTerminology) {
                    $localStorage.config.terminologyServers.push(svr);
                }
            },
            setServerType : function(type,url) {
                //set a default server type for this instance!

                $localStorage.config.servers[type] = url;
                //defaultConfig.servers[type] = url;
                //$localStorage.config = defaultConfig;
            },
            init : function(){
                $http.get("config.json").then(
                    function(data) {
                        console.log(data.data);
                        defaultConfig = data.data;
                        return;
                    }
                );
            },
            getServerByUrl : function(url) {
              //return the server definition  for a given url. Wouldn't need this if I was saving the object rather than the string
                
                for (var i=0; i < defaultConfig.allKnownServers.length;i++) {
                    if (defaultConfig.allKnownServers[i].url == url) {
                        return defaultConfig.allKnownServers[i];
                        break;
                    }
                }
                
            },
            checkConsistency : function() {
                var that = this;
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
                //if there's more than one terminology server for this version, use the first...
                rtn.terminologyServers = [];    //this will be all terminlogy servers for this version...
                var foundServer = false;
                var version = tmp[0].version;       //the FHIR version
                for (var i=0; i <config.terminologyServers.length;i++) {
                    var s = config.terminologyServers[i];
                    if (s.version == version) {
                        rtn.terminologyServers.push(s);
                        if (!foundServer) {
                            foundServer = true;
                            //if the currently configured terminology server is the same version, then leave it alone.
                            //otherwise, set the TS to the first in the list...
                            if (that.getCurrentTerminologyServer().version !== version) {
                                $localStorage.config.servers.terminology = s.url;
                                console.log('setting the terminology server to '+s.url,'appConfig:config')
                            }

                        }

                    }
                }
                return rtn;
            },
            config : function() {

                //note that a local browser can add to $localStorage.config
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
            checkConfigVersion : function() {
                if  (this.config().lastUpdated !== defaultConfig.lastUpdated) {
                    $localStorage.config = defaultConfig;
                    return true;
                } 

            },
            getAllServers : function(version) {
                //return all the servers. can specify a FHIR version...
                if (! $localStorage.config) {
                    $localStorage.config = defaultConfig;
                }
                if (version) {
                    var lst = []
                    $localStorage.config.allKnownServers.forEach(function(svr){
                        if (svr.version == version) {
                            lst.push(svr)
                        }
                    })
                    return lst;
                } else {
                    return $localStorage.config.allKnownServers;
                }



            },
            getAllTerminologyServers : function(){

                if (! $localStorage.config) {
                    $localStorage.config = defaultConfig;
                }



                var lst = [];
                $localStorage.config.allKnownServers.forEach(function(svr){
                    if (svr.isTerminology) {
                        lst.push(svr)
                    }
                })
                return lst;



                //return defaultConfig.terminologyServers;
            },
            setCurrentDataServerDEP : function(sb) {
                //set the current data server...
                dataServer = sb;
            },
            getCurrentDataServerBase : function(sb) {
                //return the base of the currently selected data server

                if (! $localStorage.config) {
                    $localStorage.config = defaultConfig;
                }
                return $localStorage.config.servers.data;
               

                //return dataServer.url;
            },
            getCurrentDataServer : function() {
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
            getCurrentTerminologyServer : function() {
                for (var i=0; i < $localStorage.config.allKnownServers.length; i++){
                    var svr = $localStorage.config.allKnownServers[i];
                    if (svr.url == $localStorage.config.servers.terminology) {
                        return svr;
                    }
                }
            },
            getCurrentFhirVersion : function() {
                var version = 3;       //default to v3
                var vConf,vData;

                //don't really care if the confrmance & data servers are not set...
                try {
                    vConf = this.getCurrentConformanceServer().version;
                    vData = this.getCurrentDataServer().version;
                } catch (ex) {

                }

                if (vConf == 2 && vData == 2) { version = 2}


                return version;
            },
            setCurrentPatient : function(patient) {
                currentPatient = patient;
            },
            removeCurrentPatient : function(){
                currentPatient = null;      //I 
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
            setRecentPatientForServer : function(patients,serverUrl){
                //used when selecting a project
                $localStorage.recentPatient = $localStorage.recentPatient || []

                var newList = [];
                //copy all the existing entries for another server to this one...
                $localStorage.recentPatient.forEach(function(recentP){
                    if (recentP.serverUrl != serverUrl) {
                        newList.push({serverUrl:serverUrl,patient:recentP.patient});
                    }
                });

                //now add the ones from the project...
                patients.forEach(function(patient){
                    newList.push({serverUrl:serverUrl, patient:patient});
                });

                $localStorage.recentPatient =newList;

            },
            addToRecentProfile : function(profile,overwrite) {
                //add to the list of recent profiles...
                //replace any existing one - (changes may connectathon)
                var conformanceServerUrl = $localStorage.config.servers.conformance;
                
                $localStorage.recentProfile = $localStorage.recentProfile || [];
                var alreadyThere = -1;
                var url = profile.url;
                for (var i=0; i < $localStorage.recentProfile.length; i++) {
                    var recent = $localStorage.recentProfile[i];
                    if (recent.profile.url == url && recent.serverUrl == conformanceServerUrl) {
                     // nov-8 2016  recent.profile = profile;       //<<<< here is where the replacement occurs...
                        alreadyThere = i;
                        break;
                    }
                }


                if (alreadyThere == -1) {
                    //a new profile
                    $localStorage.recentProfile.push({profile:profile,serverUrl:conformanceServerUrl});
                } else {
                    //already in the cache - can I overwrite
                    if (overwrite) {
                        //yes...
                        $localStorage.recentProfile[alreadyThere] = {profile:profile,serverUrl:conformanceServerUrl};
                    }
                }
                
            },
            removeRecentProfile : function(inx) {
                //remove the profile from the 'recents'list. If a project is active and in edit mode, then remove from the project as well
                $localStorage.recentProfile.splice(inx,1);
                //return $localStorage.recentProfile;
            },
            removeRecentPatient : function(inx) {
                //remove the profile from the 'recents'list. If a project is active and in edit mode, then remove from the project as well
                $localStorage.recentPatient.splice(inx,1);
                //return $localStorage.recentProfile;
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
            setProject : function(project) {
                var deferred = $q.defer();
                var that = this;
                //set the 'recent profiles to a specific set. Used when setting up a 'project'...
                //note that the actual profile is not inclded - just the url

                //set the servers for the project (if specified)...
                if (project.servers.conformance) {
                    this.setServerType('conformance',project.servers.conformance.url) ;
                }

                if (project.servers.data) {
                    this.setServerType('data',project.servers.data.url) ;
                }


                //set up the profiles in this project. First, set up the queries to load the profiles from the conformance server
                var recentProfile = [];
                var recentPatient = [];
                var query = [];
                var conformanceSvr = this.getCurrentConformanceServer();    //this may heve been set by the project above...
                
                if (project.profiles) {
                    project.profiles.forEach(function(profile){

                        //if the profile entry in the project has a conformance server, then use that. Otherwise use the system default
                        var url = conformanceSvr.url + "StructureDefinition/"+profile.id
                        //var url = project.servers.conformance.url + "StructureDefinition/"+profile.id
                        if (profile.conformance) {
                            url = profile.conformance + "StructureDefinition/"+profile.id
                        }

                        query.push (
                            $http.get(url).then(
                                function(data) {
                                    //add the profile to the 'recent profiles' list
                                    var profile = data.data;
                                    recentProfile.push({serverUrl:project.servers.conformance.url,profile:profile})

                                },
                                function(err){
                                    console.log('error loading profile ' +url+' from project')
                                })
                        )


                    });
                }

                if (project.patients) {
                    project.patients.forEach(function(patient){
                        var url = project.servers.data.url + "Patient/"+patient.id
                        query.push (
                            $http.get(url).then(
                                function(data) {

                                    recentPatient.push(data.data)

                                },
                                function(err){
                                    console.log('error loading patient ' +url+' from project')
                                })
                        )
                    });
                }


                //load all the profiles references in the project...
                $q.all(query).then(
                    function() {
                        //recentProfile will be the list of profiles - set by the individual GET's above...
                        console.log(recentProfile);
                        $localStorage.recentProfile = recentProfile;


                        var lst = [];
                        recentProfile.forEach(function(p){
                            lst.push(p.profile);
                        })

                        that.setRecentPatientForServer(recentPatient,project.servers.data.url);


                        deferred.resolve({profiles:lst,patients:recentPatient})     //return the list of profiles...
                    }
                );




                return deferred.promise;
            },
            addProfileToProject : function (profile,project,fireBase,adhocServer) {
                if (! project.canEdit) {return;}
                //adds the profile to the current project (if not already present)
                project.profiles = project.profiles || []
                var isInProject = false;
                project.profiles.forEach(function(p){
                    if (p.url == profile.url) {
                        isInProject = true;
                    }
                });

                if (!isInProject) {
                    var entry = {name :"profile",id : profile.id,url:profile.url,added: moment().format()};
                    if (adhocServer) {
                        //if adhocserver is present, then the profile is on a (potentially) different server to the one in the projecy
                        entry.conformance = adhocServer.url;
                    }
                    project.profiles.push(entry);
                    fireBase.$save(project)
                }

            },
            addPatientToProject : function (patient,project,fireBase) {
                if (! project.canEdit) {return;}
                //adds the patient to the current project (if not already present)
                project.patients = project.patients || [];
                var isInProject = false;
                project.patients.forEach(function(p){
                    if (p.id == patient.id) {
                        isInProject = true;
                    }
                });


                //note can't call 'onelinesummary' as get a circular dependency...
                if (!isInProject) {
                    var patientDisplay = (patient);
                    project.patients.push({"name" :patientDisplay,"id" : patient.id,added: moment().format()});
                    fireBase.$save(project)
                }

                function getHumanNameSummary(data){
                    if (!data) {
                        return "";
                    }
                    var txt = "";
                    if (data.text) {
                        return data.text;
                    } else {
                        txt += getString(data.given);
                        txt += getString(data.family);
                        return txt;
                    }

                    function getString(ar) {
                        var lne = '';
                        if (ar) {
                            ar.forEach(function(el){
                                lne += el + " ";
                            } )
                        }
                        return lne;
                    }
                }

            },
            removeProfileFromProject : function (profile,project,fireBase) {
                if (! project.canEdit) {return;}
                //adds the profile to the current project (if not already present)
                project.profiles = project.profiles || []
                var index = -1;
                project.profiles.forEach(function(p,inx){
                    if (p.url == profile.url) {
                        index = inx
                    }
                })

                if (index > -1) {
                    project.profiles.splice(index,1);
                    fireBase.$save(project)
                }



            },
            removePatientFromProject : function (patient,project,fireBase) {
                if (! project.canEdit) {return;}
                //adds the profile to the current project (if not already present)
                project.patients = project.patients || []
                var index = -1;
                project.patients.forEach(function(p,inx){
                    if (p.id == patient.id) {
                        index = inx
                    }
                })

                if (index > -1) {
                    project.patients.splice(index,1);
                    fireBase.$save(project)
                }



            },
            clearProfileCache : function() {
                delete $localStorage.recentProfile;
            },
            clearPatientCache : function() {
                delete $localStorage.recentPatient;
            },
            loadUserConfig : function() {
                //load the config for the current user. Right now, there are no users to it's all the same config
                var deferred = $q.defer();
                //load all the project. Eventually this could be user specific...
                $http.get('artifacts/config.json').then(
                    function(data) {
                        var userConfig  = data.data;

                        userConfig.projects.forEach(function(project){
                            //set the servers to the server objects based on the url. Right now, the possible servers are hard coded...
                            project.servers.conformance.server = allServersHash[project.servers.conformance.url];
                            //project.servers.terminology.server = allServersHash[project.servers.terminology.url];
                            project.servers.data.server = allServersHash[project.servers.data.url];
                        })

                        deferred.resolve(userConfig)


                    }
                )
                return deferred.promise;
                
            }
        }
    });

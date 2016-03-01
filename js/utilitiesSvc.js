//todo - is inserting rootScope into a service really a good idea?

angular.module("sampleApp").service('Utilities', function($rootScope,$http,$localStorage,$q,SaveDataToServer) {

    var cache = {};
    cache.lstResourceTypes = [];

    //generate index sorted by id...
    function makeIndex(bundle) {
        var indexedResources = {};
        bundle.entry.forEach(function(entry){
            indexedResources[entry.resource.resourceType +"/" +entry.resource.id] = entry.resource;
        });
        return indexedResources;
    }


    return {
        //set up the functions required to support different servers - like the http headers and conformance
        setDefaultSettings : function() {
            //set the settings object to the default
            this.currentSettings = {};
            this.currentSettings.dataServer = {display:"Grahames Server",server:"http://fhir2.healthintersections.com.au/open/",type:"data"};
            this.currentSettings.registryServer = {display:"Grahames Server",server:"http://fhir2.healthintersections.com.au/open/",type:"registry"};
            this.currentSettings.terminologyServer = {display:"Grahames Server",server:"http://fhir2.healthintersections.com.au/open/",type:"terminology"};
            this.currentSettings.patientServer = {display:"Grahames Server",server:"http://fhir2.healthintersections.com.au/open/",type:"patient"};
            this.currentSettings.orderServer = {display:"Grahames Server",server:"http://fhir2.healthintersections.com.au/open/",type:"order"};
            $localStorage.currentSettings = this.currentSettings;
        },
        init : function() {

            //if (this.currentSettings && )

            this.currentSettings = $localStorage.currentSettings;


            if (this.currentSettings && this.currentSettings.dataServer) {
                $http.defaults.headers.common['x-clinfhirdataserver'] = this.currentSettings.dataServer.server;
            }
            if (this.currentSettings && this.currentSettings.registryServer) {
                $http.defaults.headers.common['x-clinfhirregistryserver'] = this.currentSettings.registryServer.server;
            }

            if (this.currentSettings && this.currentSettings.terminologyServer) {
                $http.defaults.headers.common['x-clinfhirterminologyserver'] = this.currentSettings.terminologyServer.server;
            }
            if (this.currentSettings && this.currentSettings.patientServer) {
                $http.defaults.headers.common['x-clinfhirpatientserver'] = this.currentSettings.patientServer.server;
            }

            if (this.currentSettings && this.currentSettings.orderServer) {
                $http.defaults.headers.common['x-clinfhirorderserver'] = this.currentSettings.orderServer.server;
            }


            //set the default to be grahames server if not present...
            this.currentSettings = this.currentSettings || {};

            this.currentSettings.dataServer = this.currentSettings.dataServer ||
                {display:"Grahames Server",server:"http://fhir2.healthintersections.com.au/open/",type:"data"};
            this.currentSettings.registryServer = this.currentSettings.registryServer ||
                {display:"Grahames Server",server:"http://fhir2.healthintersections.com.au/open/",type:"registry"};
            this.currentSettings.terminologyServer = this.currentSettings.terminologyServer ||
                {display:"Grahames Server",server:"http://fhir2.healthintersections.com.au/open/",type:"terminology"};
            this.currentSettings.patientServer = this.currentSettings.patientServer ||
                {display:"Grahames Server",server:"http://fhir2.healthintersections.com.au/open/",type:"patient"};

            this.currentSettings.orderServer = this.currentSettings.orderServer ||
                {display:"Grahames Server",server:"http://fhir2.healthintersections.com.au/open/",type:"patient"};


            //read the conformance resource for the data server
            delete $localStorage.conformanceResource;
            this.getConformanceResource(function(){
                //don't need to do anythin...
            });

        },

        setServers : function(cb) {
            //get the list of known servers by reading from the clinFir serer
            var that = this;

            $http.get('/server/list')
                .success(function(data) {



                    that.servers = data;
                    //just for testing...
                    if (cb) {
                        cb(data)
                    }

                }).error(function() {

                    alert("Unable to retrieve the list of Servers. Will use default server.")
                });
        },

        getServers : function(){
            //return the list of servers loaded by the setServers method. Used whe changing the config.
            return this.servers;
        },
        getServerList : function(){
            //$scope.getServerList = function(){
            var settings = this.getCurrentSettings();


            var str = "<table>";
            try {
                str += "<tr><td><strong>Patient </strong></td><td>" + settings.patientServer.display + "</td></tr>";
                str += "<tr><td><strong>Data </strong></td><td>" + settings.dataServer.display + "</td></tr>";
                str += "<tr><td><strong>Conformance &nbsp;&nbsp;</strong></td><td>" + settings.registryServer.display + "</td></tr>";
                str += "<tr><td><strong>Terminology </strong></td><td>" + settings.terminologyServer.display + "</td></tr>";
                str += "<tr><td><strong>Orders </strong></td><td>" + settings.orderServer.display + "</td></tr>";
                str += "</table>"
            } catch (ex){
                //just swallow exception for now...
                str = "Invalid settings object. "
                // alert(str);
                // Utilities.setDefaultSettings();


            }

            /*

             try {
             str += "<div><strong>Patient: </strong>" + settings.patientServer.display + "</div>";
             str += "<div><strong>Data: </strong>" + settings.dataServer.display + "</div>";
             str += "<div><strong>Conformance: </strong>" + settings.registryServer.display + "</div>";
             str += "<div><strong>Terminology: </strong>" + settings.terminologyServer.display + "</div>";
             } catch (ex){
             //just swallow exception for now...
             str = "Invalid settings object. "
             // alert(str);
             // Utilities.setDefaultSettings();


             }
             */

            return str;
            //};
        },

        getCurrentSettings : function() {
            //return the curent settings object - used for the modal change settings dialog
            if (!this.currentSettings) {
                this.currentSettings = {};
            }
            return this.currentSettings;
        },
        setCurrentSettings : function(settings) {
            //save the current settings, and set the http headers...

            //because we are changing servers, we need to remove all cached items...
            delete $localStorage.vsMap;
            delete $localStorage.SD;
            delete $localStorage.valueSet;
            delete $localStorage.vs;
            delete $localStorage.favouriteSD;
            delete $localStorage.conformanceResource;
            delete $localStorage.keyedConformance;


            $localStorage.currentSettings = settings;
            this.init();    //set the default headers


        },
        getCapabilities : function(role) {
          //return a 'capabilities' object that describes what the currently defined server for this role can do...
            var server = this.currentSettings[role+"Server"];
            var cap = {};
            if (server) {
                cap.supportTransaction =true;      //
                cap.restResources = [];
                cap.restResources.push({type:'ValueSet',read:true,create:true});
                cap.operations = [];
                cap.server = server;
            } else {
                //default to grahames server...
                cap.server = {server:"http://fhir2.healthintersections.com.au/open/"}
            }



            return cap;
        },
        addServer : function(svr,cb){
            var that = this;

            //var deferred = $q.defer();
            //return deferred.promise;



            $http.post('/server', svr)
                .success(function(data) {
                    that.servers.push(svr);     //add the new server to the current list
                    cb(null,data);
                }).error(function(err) {

                    cb(err.msg);
                });


        },
        setHeadersDEP : function(config){
            //add the headers from the client config to
            if (this.currentSettings){
                if (! config) (config = {});
                if (! config.headers) (config.headers = {} );

                if (this.currentSettings.dataServer) {
                    //config.headers['x-clinfhirdataserver'] = this.currentSettings.dataServer.server;

                    $http.defaults.headers.common['x-clinfhirdataserver'] = this.currentSettings.dataServer.server;


                }
            }


        },
        makeUrl : function(str){
            //make a complete Url from a string fragment
            if (str.substr(0,7) !== 'http://') {
                str = 'http://' + str
            }

            if (str.substr(-1) !== '/') {
                str = str + '/'
            }
            return str;
        },
        addToFavouriteProfiles : function(profile) {

            if (profile) {

                if (!$localStorage.favouriteSD) {$localStorage.favouriteSD = []};

                var exists = false;
                $localStorage.favouriteSD.forEach(function(prof){
                    if (prof.name == profile.id) {exists = true}
                });

                if (!exists) {
                    $localStorage.favouriteSD.push({name:profile.id,url:profile.url});   //we know that the localstorage was initialized
                }

            }
            return $localStorage.favouriteSD;
        },
        getFavouriteProfiles : function() {
            //return the list of favourite profiles...  (SD)
            if (! $localStorage.favouriteSD) {
                $localStorage.favouriteSD = [];     //[{name:"cda-patient-role"}];
            }
            return $localStorage.favouriteSD;
        },
        getSpecificValueSetDefinition : function(vsName) {

            var vsLookup = $localStorage.valuesetNameMap || [];
            if (vsLookup.length == 0) {
                //vsLookup = [];
                vsLookup['condition-severity'] = {id:'valueset-condition-severity',minLength:1,type:'list'};
                vsLookup['condition-category'] = {id:'valueset-condition-category',type:'list'};
                vsLookup['condition-code'] = {id:'valueset-condition-code',minLength:3};
                vsLookup['manifestation-or-symptom'] = {id:'valueset-manifestation-or-symptom',minLength:3};
                vsLookup['valueset-medication-code'] = {id:'valueset-medication-code',minLength:3};

                vsLookup['valueset-route-code'] = {id:'valueset-route-code',minLength:1};
                vsLookup['valueset-administration-method-codes'] = {id:'valueset-administration-method-codes',minLength:3};

                vsLookup['condition-certainty'] = {id:'valueset-condition-certainty',minLength:1,type:'list'};
                vsLookup['list-empty-reason'] = {id:'valueset-list-empty-reason',minLength:1,type:'list'};

                vsLookup['list-item-flag'] = {id:'valueset-list-item-flag',minLength:1,type:'list'};
                vsLookup['basic-resource-type'] = {id:'valueset-basic-resource-type',minLength:1,type:'list'};


                //these 3 are from extensions - this passes in the full url - todo - does this need review??
                //I think that past DSTU-2 the urls' should all resolve directly...
                vsLookup['ReligiousAffiliation'] = {id:'v3-ReligiousAffiliation',minLength:1,type:'list'};
                vsLookup['Race'] = {id:'v3-Race',minLength:1};
                vsLookup['Ethnicity'] = {id:'v3-Ethnicity',minLength:1,type:'list'};
                vsLookup['investigation-sets'] = {id:'valueset-investigation-sets',minLength:1,type:'list'};
                vsLookup['observation-interpretation'] = {id:'valueset-observation-interpretation',minLength:1,type:'list'};
                vsLookup['marital-status'] = {id:'marital-status',minLength:1,type:'list'};

                vsLookup['ActPharmacySupplyType'] ={id:'v3-vs-ActPharmacySupplyType',minLength:1,type:'list'};

                vsLookup['Confidentiality'] = {id:'v2-0272',minLength:1,type:'list'};
                vsLookup['composition-status'] = {id:'composition-status',minLength:1,type:'list'};
                vsLookup['observation-status'] = {id:'observation-status',minLength:1,type:'list'};
                vsLookup['condition-status'] = {id:'condition-status',minLength:1,type:'list'};
                vsLookup['administrative-gender'] = {id:'administrative-gender',minLength:1,type:'list'};
                vsLookup['observation-reliability'] = {id:'observation-reliability',minLength:1,type:'list'};
                vsLookup['observation-relationshiptypes'] = {id:'observation-relationshiptypes',minLength:1,type:'list'};

                $localStorage.valuesetNameMap = vsLookup;
            }

            if (vsLookup[vsName]) {
                return vsLookup[vsName];
            } else {
                return null;
            }

        },

        stripDiv : function(text) {
            //todo - only handles string - eg timing confuses it...
            if (text && angular.isString(text)) {
                var re = /<div>/gi;
                text = text.replace(re, '');



                var re = /<\/div>/gi;
                text = text.replace(re, '');
                var re = /<div xmlns="http:\/\/www.w3.org\/1999\/xhtml">/gi;
                text = text.replace(re, '');
                var re = /<div /gi;
                text = text.replace(re, '');

            }
                return text;
        },

        validateResourceAgainstProfile : function(resource,profile) {
            var issue = [];

            //check for required items.
            profile.snapshot.element.forEach(function(element){
                if (element.min > 0) {
                    var path = element.path;
                    var ar = path.split('.');
                    if (ar.length == 2) {
                        var propertyName = ar[1];


                        if (propertyName.indexOf('[x]',-3) > -1) {
                            //a polymorphic property. We need to see if any of the possible derivations are present
                            var found = false;
                            var pnb = propertyName.substring(0,propertyName.length-3);
                            if (element.type) {
                                element.type.forEach(function(type) {

                                    if (resource[pnb+type.code]) {
                                        found = true;
                                    }
                                })
                            }

                            if (! found) {
                                issue.push({type:'Required field missing',element:propertyName});
                            }

                        } else {
                            if (! resource[propertyName]) {
                                issue.push({type:'Required field missing',element:propertyName});
                            }
                        }



                    }
                }

            });

            return issue;
        },

        getConformanceForSpecificServer : function(serverUrl,cb) {
            //get the conformance resource for a specific server (if it exists)

            var config = {headers:{}};

            config.headers['x-clinfhirdataserver'] = serverUrl;

            var url = "conformance";
            $http.get(url,config)
                .success(function(data) {
                    cb(null,data);

                }).error(function(oo, statusCode) {
                    cb("can't find conformance")
                });


        },

        getConformanceResource : function(callback) {
            //return the conformance resource  (cached the first time ) in a simple callback for the current data server
            if ($localStorage.conformanceResource) {
                callback($localStorage.conformanceResource)
            } else {
                //todo - need to rationize the config...
                var url = "http://fhirtest.uhn.ca/baseDstu2/metadata";

                $http.get(url)
                    .success(function(data) {

                            $localStorage.conformanceResource = data;



                        //generate an object keyed on resource type. Used by the resource builder to limit types for limited resurces
                        //todo use all rest object for now

                        try {
                            var keyedConformance = {};
                            data.rest.forEach(function(rest){
                                if (rest.resource) {
                                    rest.resource.forEach(function (res) {
                                        keyedConformance[res.type] = {};
                                        if (res.interaction) {
                                            res.interaction.forEach(function (int) {
                                                if (int.code == 'create') {
                                                    keyedConformance[res.type].create = true;
                                                }
                                            })
                                        }

                                    })
                                }
                            });

                            $localStorage.keyedConformance = keyedConformance;
                        } catch (ex) {
                            console.log('error creating keyedConformance',ex, keyedConformance)
                        }
                        callback(data)
                    }).error(function(oo, statusCode) {
                        callback(null)
                    });
            }



        },

        getAllDataTypes : function() {
            var lst = [];
            lst.push({name:'CodeableConcept',isCoded:true});
            lst.push({name:'string'});
            lst.push({name:'decimal'});
            lst.push({name:'Quantity'});
            lst.push({name:'date'});
            lst.push({name:'dateTime'});
            lst.push({name:'Period'});
            lst.push({name:'Range'});
            lst.push({name:'Age'});
            lst.push({name:'boolean'});
            lst.push({name:'Reference'});
            lst.push({name:'Identifier'});
            lst.push({name:'uri'});
            lst.push({name:'Ratio'});
            lst.push({name:'HumanName'});
            lst.push({name:'Address'});
            lst.push({name:'ContactPoint'});
            lst.push({name:'code',isCoded:true});
            lst.push({name:'Coding',isCoded:true});
            return lst;

        },

        getAllResourceTypes : function(callback) {
            //the list of all resource is saved on the local server as it's pretty fixed......
            if (cache.lstResourceTypes.length > 0) {
                callback(cache.lstResourceTypes)
            } else {
                //load data for cache
                var url = "artifacts/allResources.json";

                $http.get(url)
                    .success(function(data) {
                        data.sort(function(a,b){
                            return (a.name < b.name?-1:1) ;
                        });
                        cache.lstResourceTypes = data;

                        callback(cache.lstResourceTypes)
                    }).error(function(oo, statusCode) {
                        callback('Could not load list of resource types')
                    });
            }

        },
        getAllResourceTypesForCurrentDataServer : function(callback) {
            var keyed = $localStorage.keyedConformance;
            this.getAllResourceTypes(function(fullList){
                if (this.currentSettings && this.currentSettings.dataServer) {
                    var lst = [];
                    fullList.forEach(function(type){
                        //todo check against confrmance resource
                        if (keyed && keyed.type && keyed.type.create) {

                            lst.push(type);
                        }

                    });
                    callback(lst);

                } else {
                    callback(fullList);
                }
            })

        },
        getUCUMUnits :function(category) {
            //return a collection of UCUM units in various categories
            var lst = [];
            switch (category) {
                case 'money' :
                    lst.push({code:'nz','display':'NZ Dollars'});
                    lst.push({code:'us','display':'US Dollars'});
                    lst.push({code:'uk','display':'UK Pounds'});
                    lst.push({code:'eu','display':'Euro'});
                    break;
                case 'age' :
                    lst.push({code:'s','display':'seconds'});
                    lst.push({code:'min','display':'minutes'});
                    lst.push({code:'h','display':'hours'});
                    lst.push({code:'d','display':'days'});
                    lst.push({code:'wk','display':'weeks'});
                    lst.push({code:'mo','display':'months'});
                    lst.push({code:'y','display':'years'});



                    break;
            }
            return lst;

        },
        getValueSetIdFromRegistry : function(uri,waitingAlertFn,cb) {
            //return the id of the ValueSet on the registry. For now, assume at the VS is on the registry -
            //ie the registry & terminology server are the same... So the function queries the registry for
            //a ValueSet with that url, and returns the id of the valueset (actually the resource itsef)
                 //was getGrahameVSName

            //the name of the current registry - used for any alerts...
            var currentRegistry;
            if (this.currentSettings && this.currentSettings.registryServer) {
                currentRegistry= '('+this.currentSettings.registryServer.display+') ';
            }


            //todo - store this in a file
            var that = this;


            //the vsMap holds holds the id of the valueset on grahames server, the min length of lookup and whether it should be rendered as a list
            if (! $localStorage.vsMap) {$localStorage.vsMap = {}}

            //only use cache when caching is globally enabled.
            //not sure if injecting rootScope is best practice...
            if ($rootScope.canUseCache && $localStorage.vsMap[uri]) {
                console.log('service from cache')
                console.log($localStorage.vsMap[uri]);
                cb($localStorage.vsMap[uri]);

                return;
            }

            //query the registry for ID's of valuesets with that uri. we'll grab the first one only...
            var qry = 'resolveValueSetID?uri=' + encodeURIComponent(uri);

            if (waitingAlertFn) {
                waitingAlertFn(true);
            }
            $http.get(qry)
                .success(function(bundle) {
                   //returns the bundle containing the valueset with that url. There should only be 1...
                    if (waitingAlertFn) {
                        waitingAlertFn(false);
                    }
                    if (bundle && bundle.entry && bundle.entry.length > 0) {

                        if (bundle.entry.length >1) {
                            alert('The registry '+currentRegistry+' has multiple ValueSets with a URL property (in the resource) of '+uri +". I'll use the first one, but you might want to contact the registry owner and let them know.");
                        }

                        var id = bundle.entry[0].resource.id;   //the id of the velueset in the registry
                        var resp = {id: id,minLength:3}         //response object

                        //ValueSets with a small size that can be rendered in a set of radio buttons.
                        // lookup from a fixed lis of ValueSetst. has to be this way as we will subsequently (in renderProfile)
                        //get the full expansion without filtering...
                        if (that.isVSaList(uri)) {
                            resp.type='list';
                        }

                        //save in the cache for later use...
                        $localStorage.vsMap[uri] = resp;

                        //save the valueset in the cache - we're bound to need it soon...
                        if (! $localStorage.valueSet) {$localStorage.valueSet = {}; }
                        $localStorage.valueSet[uri] = bundle.entry[0].resource;

                        cb(resp);

                        //var
                    } else {

                        //if we can't find the valueset by querying the terminology server on url, then just pass back the
                        // reference as an id - and a List. This is for
                        //VS's I create and a hack as the 'real' vs domain is not yet set up...
                        //todo definately needs fixing when the domain is there

                        var ar = uri.split('/');        //assume format is ValueSet/{id}
                        var id = ar[ar.length-1];

                        var resp = {id: id,minLength:3,type:'list'}         //response object
                        cb(resp);



                        /*




                        GetDataFromServer.getResource(uri).then(
                            function(res){

                            },function(err) {

                            }
                        )

*/
                        /*
                        var msg = 'The registry '+currentRegistry+'cannot locate a ValueSet with a URL property (in the resource) of '+uri;
                        msg += '. Would you like me to copy it over from the reference registry?';


                        if (confirm(msg)) {
                            //alert('ToDo')
                            //copy the valueset from the base registry to the current registry returning the valueset
                            that.copyValueSetToRegistry(uri,function(vs){

                                if (vs) {
                                    var resp = {id: vs.id,minLength:3,vs:vs}         //response object
                                    cb(resp);
                                } else {
                                    cb(null);
                                }
                            });



                        } else {
                            cb(null);
                        }

                        */
                       //
                    }


                }).error(function(oo, statusCode) {
                    if (waitingAlertFn) {
                        waitingAlertFn(false);
                    }
                    alert('There was a system error and the registry '+currentRegistry+'cannot locate a ValueSet with the URL of '+uri);
                    cb(null);
                    //deferred.reject({msg:Utilities.getOOText(oo),statusCode:statusCode});
                });

/*
            return;


          //  app.get('resolveValueSetID',function(req,res){
            //        var uri = decodeURIComponent(req.query.uri);

            var ar = uri.split('/');
            var vsName = ar[ar.length - 1];


            //GetDataFromServer.getValueSet(valueSetReference.reference,function(vsDetails){

            var vsDefinition =this.getSpecificValueSetDefinition(vsName);

            //if there's a definition then return it, otherwise return the default
            if (vsDefinition) {
                //return vsLookup[vsName];
                cb(vsDefinition)
            } else {
                //todo - not sure about this...
                //return {id:'valueset-' + vsName,minLength:3}
                cb({id: 'valueset-' + vsName,minLength:3})
                //return {id: vsName,minLength:3}
            }



            return;
*/
        },

        getOOText : function(oo) {
            if (oo) {
                if (oo.text) {
                    return oo.text.div;
                } else if(oo.issue) {
                    var text = "";
                    oo.issue.forEach(function(issue) {
                        if (issue.details) {
                            text += issue.details.text + " ";
                        }
                    })
                    return text;
                }
            }




        },
        getAllInstancesOfResourceType : function(bundle,type) {
            //keep in a bundle format for consistency
            var rtn = {entry:[]};
            if (bundle.entry) {
                bundle.entry.forEach(function(entry){
                    if (entry.resource.resourceType == type) {
                        rtn.entry.push(entry);
                    }
                });
            }

            return rtn;
        },
        isVSaList : function(uri) {
            //Is this valueset one that should be rendered as a set of radio buttons (ie a small list)
            //todo- this is a complete uri - replace with a cached list loaded from a file...





            vsLookup = [];
            vsLookup['condition-severity'] = {id:'valueset-condition-severity',minLength:1,type:'list'};
            vsLookup['condition-category'] = {id:'valueset-condition-category',type:'list'};
            vsLookup['condition-code'] = {id:'valueset-condition-code',minLength:3};
            vsLookup['manifestation-or-symptom'] = {id:'valueset-manifestation-or-symptom',minLength:3};
            vsLookup['valueset-medication-code'] = {id:'valueset-medication-code',minLength:3};

            vsLookup['valueset-route-code'] = {id:'valueset-route-code',minLength:1};
            vsLookup['valueset-administration-method-codes'] = {id:'valueset-administration-method-codes',minLength:3};

            vsLookup['condition-certainty'] = {id:'valueset-condition-certainty',minLength:1,type:'list'};
            vsLookup['list-empty-reason'] = {id:'valueset-list-empty-reason',minLength:1,type:'list'};

            vsLookup['list-item-flag'] = {id:'valueset-list-item-flag',minLength:1,type:'list'};
            vsLookup['basic-resource-type'] = {id:'valueset-basic-resource-type',minLength:1,type:'list'};


            //these 3 are from extensions - this passes in the full url - todo - does this need review??
            //I think that past DSTU-2 the urls' should all resolve directly...
            vsLookup['ReligiousAffiliation'] = {id:'v3-ReligiousAffiliation',minLength:1,type:'list'};
            vsLookup['Race'] = {id:'v3-Race',minLength:1};
            vsLookup['Ethnicity'] = {id:'v3-Ethnicity',minLength:1,type:'list'};
            vsLookup['investigation-sets'] = {id:'valueset-investigation-sets',minLength:1,type:'list'};
            vsLookup['observation-interpretation'] = {id:'valueset-observation-interpretation',minLength:1,type:'list'};
            vsLookup['marital-status'] = {id:'marital-status',minLength:1,type:'list'};

            vsLookup['ActPharmacySupplyType'] ={id:'v3-vs-ActPharmacySupplyType',minLength:1,type:'list'};

            vsLookup['Confidentiality'] = {id:'v2-0272',minLength:1,type:'list'};
            vsLookup['composition-status'] = {id:'composition-status',minLength:1,type:'list'};
            vsLookup['observation-status'] = {id:'observation-status',minLength:1,type:'list'};
            vsLookup['condition-status'] = {id:'condition-status',minLength:1,type:'list'};
            vsLookup['administrative-gender'] = {id:'administrative-gender',minLength:1,type:'list'};


            vsLookup['reason-medication-not-given-codes'] = {type:'list'};
            vsLookup['care-plan-activity-category'] = {type:'list'};




            var ar = uri.split('/');
            var vsName = ar[ar.length - 1];


            //GetDataFromServer.getValueSet(valueSetReference.reference,function(vsDetails){

            //if there's a definition then return it, otherwise return the default



            if (vsLookup[vsName]) {
                if (vsLookup[vsName].type == 'list') {
                    return true;
                } else {
                    return false;
                }

            }
            },
        profileQualityReport :function(profile) {
            var issues = []
            var lstCoded=['code','CodeableConcept','Coding'];
            if (profile && profile.snapshot) {
                profile.snapshot.element.forEach(function (element) {
                    if (element.type) {
                        element.type.forEach(function(type){

                            if (lstCoded.indexOf(type.code) > -1){
                                //this is a coded item

                                if (element.binding && element.binding.valueSetReference &&
                                    element.binding.valueSetReference.reference) {
                                    //all is OK
                                } else {
                                    //missing a binding


                                    if (element.binding && element.binding.valueSetUri) {
                                        //for now, ignore it if there is a Uri...
                                    } else {
                                        issues.push({path:element.path, type:'missingbinding',
                                            display :'There is no ValueSet bound to this path'})
                                    }







                                }
                            }
                        })
                    }

                });
            }
            return issues;

        },
        copyValueSetToRegistry : function(ValueSetUrl,cb) {
            //copy to profile from the reference registry (Grahames server) to the currently selected registry
            var job = {command:'copyValueSet',
                urlOfResource:ValueSetUrl,
                targetServer:this.currentSettings.registryServer.server};

            $http.post('/job/submit',job)
                .success(function(data) {
                    cb(null,data);
                }).error(function(err) {
                    cb(err)
                });
        },
        copyProfileToRegistry : function(profileId,cb) {
            //copy to profile from the reference registry (Grahames server) to the currently selected registry
            var job = {command:'copyStructureDefinition',
                id:profileId,type:'StructureDefinition',
                targetServer:this.currentSettings.registryServer.server};

            $http.post('/job/submit',job)
                .success(function(data) {
                    cb(null,data);
                }).error(function(err) {
                    cb(err)
                });
        },
        getResourceTypeFromUrl : function(url) {
            //DSTU-2 - type.profile is an array
            var ar = url.split('/');
            var resourceType = ar[ar.length-1];
            return resourceType;
        },
        getVSFromRegistry :function(uri,cb) {
            //determine if there is a valueset with this uri in the terminology server...
            //used by new Id
            var qry = 'resolveValueSetID?uri=' + encodeURIComponent(uri);
            var deferred = $q.defer();

            $http.get(qry)
                .success(function(bundle) {
                    //returns the bundle containing the valueset with that url. There should only be 1...
                    deferred.resolve(bundle);

                }).error(function(oo, statusCode) {
                    deferred.reject(oo);

                });
            return deferred.promise;
        },
        getStructureDefinitionByUrl :function(url) {
            //query the registry server for SD's with the given url
            var qry = 'getStructureDefinitionByUrl?url=' + encodeURIComponent(url);
            var deferred = $q.defer();

            $http.get(qry)
                .success(function(bundle) {
                    //returns the bundle containing the valueset with that url. There should only be 1...
                    deferred.resolve(bundle);

                }).error(function(oo, statusCode) {
                    deferred.reject(oo);

                });
            return deferred.promise;
        },
        makeProfileJSTreeArray : function(profile) {
            //create an array from the profile suitable to pass to jsTree for rendering...
            //note that it does include some css classes...
            var tree = [];
            var profileElementsAsObject = {};
            if (profile && profile.snapshot) {
                profile.snapshot.element.forEach(function (element) {
                    var path = element.path;
                    profileElementsAsObject[path] = element;
                    var ar = path.split('.');
                    var root;
                    if (ar.length == 1) {
                        tree.push({id: ar[0], parent: '#', text: ar[0], state: {opened: true}});
                        root = ar[0];
                    } else {
                        if (showElement(element)) {
                            ar.pop();
                            var parent = ar.join('.');
                            var node = {id: path, parent: parent, text: path}
                            //shouldn't see max==0 in a saved profile, but will in the profile builder...
                            if (element.max == "0") {
                                //node.state = {disabled:true}
                                node.text = "<span class='strikeout'>" + node.text + "</span>"
                            } else {
                                if (element.min == 1) {
                                    node.li_attr = {class: 'elementRequired'}
                                } else {
                                    node.li_attr = {class: 'clickable'}
                                }
                            }

                            tree.push(node);
                            node.fhirElement = {dh:element}
                        }
                    }


                });

                //console.log(tree);
                return tree;

                function showElement(el) {
                    return true
                }
            }
        },
        makeProfileJSTreeArrayOriginal : function(profile) {
            //create an array from the profile suitable to pass to jsTree for rendering...
            //note that it does include some css classes...
            var tree = [];
            var profileElementsAsObject = {};
            if (profile && profile.snapshot) {
                profile.snapshot.element.forEach(function (element) {
                    var path = element.path;
                    profileElementsAsObject[path] = element;
                    var ar = path.split('.');
                    var root;
                    if (ar.length == 1) {
                        tree.push({id: ar[0], parent: '#', text: ar[0], state: {opened: true}});
                        root = ar[0];
                    } else {
                        if (showElement(element)) {
                            ar.pop();
                            var parent = ar.join('.');
                            var node = {id: path, parent: parent, text: path}
                            //shouldn't see max==0 in a saved profile, but will in the profile builder...
                            if (element.max == "0") {
                                //node.state = {disabled:true}
                                node.text = "<span class='strikeout'>" + node.text + "</span>"
                            } else {
                                if (element.min == 1) {
                                    node.li_attr = {class: 'elementRequired'}
                                } else {
                                    node.li_attr = {class: 'clickable'}
                                }
                            }

                            tree.push(node);
                        }
                    }


                });

                //console.log(tree);
                return tree;

                function showElement(el) {
                    return true
                }
            }
        },
        analyseExtensionDefinition : function(extension) {
            //var extension = angular.copy(extensionDef);
            //return a vo that contains an analysis of the extension
            var that = this;


            var vo = {dataTypes : [],multiple:false};
            vo.display = extension.display; //will use this when displaying the element
            vo.name = extension.name;       //or this one...
           // vo.definition =extension.definition;

            var discriminator;      //if this is sliced, then a discriminator will be set...
            if (extension.snapshot) {
                extension.snapshot.element.forEach(function(element) {

                    //this is the root extension
                    if (element.path.substr(0,9) === 'Extension') {
                        if (! vo.definition) {
                            vo.definition = element.definition;
                        }

                        if (!vo.short) {
                            //pick the first one...
                            vo.short = element.short;   //the short name of the extension - whether simple or complex
                        }

                        if (element.max == '*') {
                            vo.multiple = true;
                        }
                    }

                    if (element.slicing) {
                        discriminator = element.slicing.discriminator[0];
                    }


                    if (element.path.indexOf('Extension.value')>-1) {
                        //vo.element = element;
                        var dt = element.path.replace('Extension.value','').toLowerCase();
                        vo.dataTypes.push(dt);
                        if (['codeableconcept','code','coding'].indexOf(dt)> -1) {
                            vo.isCoded = true;
                        }


                        if (dt == 'reference' || dt == '[x]') {   //eg cgif-guidancerequest
                            //if this is a reference, then need the list of types
                            vo.referenceTypes = [];
                            if (element.type) {
                                element.type.forEach(function(t){
                                    var p = t.profile;
                                    if (p) {
                                        var ar = p[0].split('/');       //only the first
                                        var item = {display:ar[ar.length-1],url:p[0]};
                                        item.specification = "http://hl7.org/fhir/"+ar[ar.length-1];   //really only works if this is a core resource...
                                        //is this a core resource (or datatype)
                                        ar.pop();   //remove the last entry - it will be the type name
                                        var temp = ar.join('/');    //reconstruct the url...
                                        if (temp == "http://hl7.org/fhir/") {
                                            item.isCore = true; //this is a core resource (or datatype)
                                        }

                                        vo.referenceTypes.push(item);
                                    }
                                })
                            }
                        }



                        if (element.binding) {

                            vo.strength = element.binding.strength;
                            if (element.binding.valueSetReference) {
                                vo.valueSetReference = element.binding.valueSetReference.reference;
                            } else {
                                vo.errors = vo.errors || []
                                vo.errors.push('value element has a binding with no valueSetReference')
                            }

                        }

                    }
                })
            }

            //if a discriminator has been set, then this is a complex extension so create a summary object...
            if (discriminator) {
                //vo.complex=true;
                vo.complexExtension = that.processComplexExtension(extension,discriminator)
            }
            vo.StructureDefinition = extension;
            return vo;

        },
        processComplexExtension : function(extension,discriminator) {
            //create a summary object for the extension. for extension designer & renderProfile
            //these are comples extensions where there is a single 'parent' and multiple child elements...

            var summary = {contents:[]}
            //var contents = [];
            var ele = {}
            extension.snapshot.element.forEach(function (element) {
                if (element.path) {
                    var ar = element.path.split('.');
                    if (ar.length == 2 && ! element.slicing) {
                        //this marks the start of a new element - or contents of the 'parent'
                        if (ele.name) {
                            summary.contents.push(ele);     //save the previous one
                        }


                        ele ={};
                        switch (ar[1]) {
                            case 'id':
                                break;
                            case 'url' :
                                summary.url = element.fixedUri;
                                break;
                            default :
                                if (element.max > 0) {
                                    ele.name = element.name || 'Name not given';
                                    ele.short = element.short;
                                    ele.definition = element.definition;
                                    ele.min = element.min;
                                    ele.max = element.max;
                                }
                                break;
                        }

                    }
                    if (ar.length == 3) {
                        //this will be a 'content' element for the child element currently under review..
                        var segment2 = ar[2];
                        switch (segment2) {
                            case "id" :
                                //just ignore id's for now...
                                break;
                            case "url" :
                                ele.code = element.fixedUri;    //todo - probbaly not safe to assume this will always be the case..
                                break;
                            case "extension":


                                break;
                            default :
                                if (segment2.indexOf('value')> -1) {
                                    //this is the value extension.
                                    ele.dt = element.type;
                                    if (ele.dt) {
                                        ele.dt.forEach(function(dt){
                                            if (dt.profile) {
                                                var p = dt.profile[0];     //only take the first one...

                                                var ar = p.split('/');
                                                dt.displayType =ar[ar.length-1];
                                            }
                                        })
                                    }



            /*
                                    ele.dt = [];
                                    if (element.type) {
                                        element.type.forEach(function(typ){
                                            var dt = {code:typ.code};

                                            if (typ.profile) {
                                                var p = typ.profile[0];     //only take the first one...
                                                dt.profile = p;
                                                var ar = p.split('/');
                                                dt.type =ar[ar.length-1];
                                            }
                                            ele.dt.push(dt);
                                        })

                                    }
*/
                                    //var dtInName = segment2.replace('value','');

                                    //ele.dt =  segment2.replace('value','');//.toLowerCase();




                                    //is there a binding?
                                    if (element.binding  && element.binding.valueSetReference) {
                                        ele.boundValueSet = element.binding.valueSetReference.reference;
                                    }

                                }
                                break;
                        }
                    }


                }


            })

            if (ele.name) {
                summary.contents.push(ele);     //save the previous one
            }


            return summary;

    },
        isAuthoredByClinFhir : function(StructureDefinition) {
            var canEdit = false;
            if (StructureDefinition.identifier) {
                StructureDefinition.identifier.forEach(function(ident) {
                    if (ident.system=='http://clinfhir.com') {
                        canEdit = true;
                    }

                })
            }
            return canEdit;
        },
        validate : function(resource,cb) {

            var clone = angular.copy(resource);
            delete clone.localMeta;

            var url = "/validateResource";
            $http.post(url, clone)
                .success(function(data) {
                    cb({outcome:'Valid ExtensionDefinition'});
                }).error(function(oo) {
                cb(oo)
            });

        },
        getElementsWithPath : function(StructureDefinition,path) {
            //return all the elements from the StructureDefinition with the given path...
            var ar = [];
            if (StructureDefinition && StructureDefinition.snapshot && StructureDefinition.snapshot.element) {
                StructureDefinition.snapshot.element.forEach(function(element){
                    if (element.path == path) {
                        ar.push(element)
                    }
                })
            }
            return ar;

        },
        //generate the display collection
        makeOrderSummary : function(bundle) {
            if (bundle && bundle.entry) {
                var lst = [];

                var indexedResources = makeIndex(bundle);
                console.log(indexedResources);

                bundle.entry.forEach(function(entry){
                    var resource = entry.resource;
                    if (resource.resourceType == 'Order') {
                        var summary = {order:resource,response:[]};
                        lst.push(summary);
                        //need to get all the responses for this order. This will not scale !!!!
                        var query = "OrderResponse?request="+resource.id;
                        //console.log(query);

                        var url = "/queryfhirserver?qry="+encodeURIComponent(query);
                        //note we can't use GetDataFromServer as that would cause a circular dependency...
                        $http.get(url)
                            .success(function(bundleResponse) {
                                if (bundleResponse && bundleResponse.entry) {
                                    var lastStatus = 0;
                                    bundleResponse.entry.forEach(function(entryResponse){
                                        bundle.entry.push(entryResponse);       //add to the main bundle so the relationships work
                                        summary.response.push(entryResponse.resource);
                                        var da = moment(entryResponse.resource.date).toDate().getTime();
                                        if (da > lastStatus) {
                                            summary.mostRecentStatus = entryResponse.resource.orderStatus;
                                            lastStatus = da;
                                        }

                                    });

                                    //console.log(summary)
                                }

                            })
                            .error(function(oo, statusCode) {
                                console.log(oo);
                             }
                            );

                    }
                });
                return lst;

            }
            return null;

            //generate index sorted by id...
            function makeIndex(bundle) {
                var indexedResources = {};
                bundle.entry.forEach(function(entry){
                    indexedResources[entry.resource.resourceType +"/" +entry.resource.id] = entry.resource;
                });
                return indexedResources;
            }

        },
        placeOrder : function(order,patientResource,orderServerUrl,bundle) {
            //place the order against the currently configured order server. Need to save all the detail resources
            //first, updating the resoreuce reference in the order, then the order

            var headers;
            //if there's an identifier then we can use conditional create
            if (patientResource.identifier) {
                headers = {};
                headers['If-None-Exist'] = 'identifier=' + patientResource.identifier[0];

            }



            SaveDataToServer.saveResource(patientResource,orderServerUrl,headers).then(
                function(data){
                    console.log(data);
                    //the id of the patient created or retrieved by the order server
                    var orderPatientId = data.headers.location;  //todo check this...


                    //now that the patient has been copied to the order server, we can pss across the detail resource.

                    var orderCopy = angular.copy(order);
                    if (orderCopy.detail){
                        var indexedResources = makeIndex(bundle);
                        console.log(indexedResources);

                        var resourcesToSave = [];   //a set of insert commands...
                        orderCopy.detail.forEach(function(detailReference){

                            var detailResourceId = detailReference.reference;

                            var detailResource = indexedResources[detailResourceId];
                            if (detailResource) {
                                //make a copy of the resoruce, removing the id (as the order server will need to create a new one
                                var clone = angular.copy(detailResource);
                                delete clone.id;
                                //set the patient reference to the new id (from the order server)
                                clone.patient.reference = orderPatientId
                                resourcesToSave.push(
                                    SaveDataToServer.saveResource(clone,orderServerUrl).then(
                                        function(data){
                                            console.log(data);
                                        }, function(err) {
                                            console.log(err);
                                            alert('Error saving detail resource on Order server: '+ angular.toJson(err));
                                        }
                                    )
                                )


                            } else {
                                alert("The order references a detail resource with the id: "+detailResourceId + " that I cannot find.")
                            }

                        })
                        //here we have an array containing all the detail resources to be copied to the Order server
                        $q.all(resourcesToSave).then(
                            function() {
                                //all the

                            },function(err){
                                alert('There was an error copying across the detail resources: '+angular.toJson(err) +'/nThe Order resource was not created')
                            })



                    }








                }, function(err) {
                    console.log(err);
                    alert('Error saving patient resource on Order server: '+ angular.toJson(err));

                }
            )

            return;



            var currentSettings = this.getCurrentSettings();
            var patientId = currentSettings.patientServer.server + patientResource.id;
            console.log(patientId);


            return;

            getPatientId(patientResource,orderServerUrl,function(data){
                console.log(data);
            });

            return;




            //return the patient id
            function getPatientId(patientResource,orderServerUrl,cb) {
                //save the patient resource to the Order server.
                var clone = angular.copy(patientResource);
                delete clone.id;

                SaveDataToServer.saveResource(clone,orderServerUrl).then(
                    function(data){
                        console.log(data);
                        cb(data);
                    }, function(err) {
                        console.log(err);
                        alert('Error saving patient resource on Order server: '+ angular.toJson(err));
                        cb(null);
                    }
                )


            }


        }


}





});
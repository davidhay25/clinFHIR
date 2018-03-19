/* These are all the services called by renderProfile */

angular.module("sampleApp").

//todo this is ised by the sample creator...
    service('CommonDataSvc', function() {
        var allResources;       //all the resources for the current patient
        return {
            setAllResources :function(allResourcesIn) {
                allResources = allResourcesIn;
            },
            getAllResources : function() {
                return allResources
            }
        }
    }).
    service('SaveDataToServer', function($http,$q,appConfigSvc) {
    return {
        addOutputToTask : function(task,resource,type) {
            //save the resource, then make a reference to it from the task. Assume that the resource has an id...
            var deferred = $q.defer();
            var that =this;
            this.saveResource(resource).then(
                function(data) {
                    //resource has been saved - now add a reference in the task. Assume a relative reference
                    var ref = resource.resourceType + '/' + resource.id;
                    task.output = task.output || []
                    task.output.push({type:type,valueReference : {reference:ref}})

                    that.saveResource(task).then(
                        function(data) {
                            deferred.resolve()
                        },
                        function(err){
                            deferred.reject(err);
                        }
                    )

                },
                function(err) {
                    deferred.reject(err);
                    //alert('error saving resource: '+angular.toJson(err))
                }
            );
            return deferred.promise;

        },
        addTaskForPractitioner : function (practitioner,options) {
            //add a new task - options={basedOn: }
            var deferred = $q.defer();

            var task = {resourceType:'Task'};
            task.id = 't'+ new Date().getTime();    //so the new task can be used without reading from the server....
            
            task.focus = {reference:options.focus.resourceType + "/"+options.focus.id};
            task.status = 'accepted';
            task.owner = {reference:'Practitioner/'+practitioner.id};
            //add the email as the reference display todo - tidy this - could look for other properties later
            if (practitioner.telecom) {
                task.owner.display = practitioner.telecom[0].value;
            }

            task.intent = 'proposal';
            task.description = 'review of Logical Model'

            //var url = appConfigSvc.getCurrentDataServer().url + 'Task';
            this.saveResource(task, appConfigSvc.getCurrentConformanceServer().url).then(
                function(){
                    deferred.resolve(task)
                
            },function(err) {
                    deferred.reject(err)
                }
            
            );
            return deferred.promise;

        },
        
        saveResource : function(resource,urlBase) {
            //save a resource to the data server
            urlBase = urlBase || appConfigSvc.getCurrentDataServerBase();       //default to data server
            var deferred = $q.defer();
            //alert('saving:\n'+angular.toJson(resource));
            //var config = appConfigSvc.config();
            var qry = urlBase + resource.resourceType;
            if (resource.id) {
                //this is an update
                qry += "/"+resource.id;
                //console.log(qry)
                $http.put(qry, resource).then(
                    function(data) {
                        deferred.resolve(data);
                    },
                    function(err) {

                        deferred.reject(err.data);
                    }
                );
            } else {
                //this is new
                console.log(qry)
                $http.post(qry, resource).then(
                    function(data) {
                        deferred.resolve(data);
                    },
                    function(err) {
                        //alert("errr calling validate operation:\n"+angular.toJson(err))
                        deferred.reject(err.data);
                    }
                );
            }
            return deferred.promise;
        },
        updateStructureDefinition : function(server,resource)  {
            //update a conformance resource supplying the url and the resource...
            var deferred = $q.defer();
            var url = server.url + 'StructureDefinition/'+resource.id;
            $http.put(url, resource).then(
                function(data) {
                    deferred.resolve(data);
                },
                function(err) {

                    deferred.reject(err.data);
                }
            );
            return deferred.promise;
        },
        deleteResource : function(server,resource)  {
            //update a resource supplying the url and the resource...
            var deferred = $q.defer();
            var url = server.url + 'StructureDefinition/'+resource.id;
            $http.delete(url, resource).then(
                function(data) {
                    deferred.resolve(data);
                },
                function(err) {
                    deferred.reject(err.data);
                }
            );
            return deferred.promise;
        },
        saveValueSetToTerminologyServerById : function(id,valueSet) {
            //save a ValueSet at a given location
            var config = appConfigSvc.config();
            var qry = config.servers.terminology + "ValueSet/"+id;
            console.log(qry)
            return $http.put(qry,valueSet);


        },
        sendActivityObject : function(activity) {

        },
        submitErrorReport : function(error) {
           // var url = "errorReport"
            console.log(error)
            return $http.post("/errorReport",error);
        }
    }

}).
    service('GetDataFromServer', function($http,$q,appConfigSvc,Utilities,$localStorage,$timeout) {
    return {
        getListForPractitioner : function(practitioner,type) {
            var deferred = $q.defer();
            var listTypeSystem = appConfigSvc.config().standardSystem.listTypes;
            var url = appConfigSvc.getCurrentDataServer().url +
                "List?source:Practitioner="+practitioner.id + "&code=" + listTypeSystem + '|' + type;

            $http.get(url).then(
                function(data) {
                    var list;
                    if (data.data && data.data.entry && data.data.entry.length > 0) {
                        list = data.data.entry[0].resource;      //assume only 1 matching list...
                    }
                    deferred.resolve(list)
                }, function(err) {
                    deferred.reject(err);
                    alert('Error retrieving list '+angular.toJson(err))
                }
            );


            return deferred.promise;

        },
        getOutputsForModel : function(model,type) {
            //get all the outputs (resources like Communication)
            var that = this;
            var deferred = $q.defer();

            //first, get all the tasks associated with this model
            var url = appConfigSvc.getCurrentDataServer().url + "Task?focus=StructureDefinition/"+model.id;

            $http.get(url).then(
                function(data){
                   // console.log(data.data);

                    if (data.data && data.data.entry) {

                        var queries = []
                        var communications = [];

                        data.data.entry.forEach(function(entry){
                            var task = entry.resource;

                            queries.push(that.getOutputsForTask(task,'QuestionnaireResponse').then(
                                function(lst){
                                   // console.log(lst)
                                    if (lst.length > 0) {
                                        lst.forEach(function(item){
                                            var item = {task:task,comment:item}
                                            communications.push(item);
                                        })



                                    }

                                    //communications = communications.concat(lst)
                                },
                                function(err){
                                    alert(angular.tojson(err))
                                }
                            ))

                        });


                        $q.all(queries).then(
                            function(data) {
                                console.log(communications)
                                deferred.resolve(communications);
                            },
                            function(err){
                                alert(angular.tojson(err))
                                deferred.reject(err)
                            }
                        )
                    } else {
                        deferred.resolve([]);
                    }

                },
                function(err) {
                    console.log(err)
                    deferred.reject(err)
                }
            )




            return deferred.promise;


        },
        getOutputsForTask : function(task,type) {
            //return any communication resources created for this task. Type indicates a single resource type only (eg Communcation)


            var getResourceDEP = function(url,ar) {
                //reference
                $http.get(url).then(
                    function(data){
                        ar.push(data.data)
                    },
                    function(err) {
                        console.log(err)
                    }
                )
            }

            var deferred = $q.defer();
            var baseUrl = appConfigSvc.getCurrentDataServer().url;// + "Communication?_id="
            var arQuery = [];
            var arResources = [];
            if (task && task.output) {
                task.output.forEach(function(out){
                    if (out.valueReference && out.valueReference.reference) {
                        //this is a referrence to a resource (we assume on the data server)
                        var ref = out.valueReference.reference;     //the logical reference in the task...
                        var include = true;
                        if (type && ref.indexOf(type) == -1) {
                            include=false;
                        }

                        if (include) {
                            arQuery.push(

                                $http.get(baseUrl+ ref).then(
                                    function(data){
                                        arResources.push(data.data)
                                    },
                                    function(err) {
                                        console.log(err)
                                    }
                                )



                            )
                        }


                    }
                })

                //console.log(arQuery)

                $q.all(arQuery).then(
                    function(){
                        deferred.resolve(arResources)
                    },
                    function(err){
                        deferred.reject(err)
                    }
                )
            } else {
                //no outputs on the task...
                deferred.resolve([])
            }




            return deferred.promise;




        },
        getTasksBasedOn : function(resource) {
            //get all the tasks that are basedo on a given resource
            

        },
        getTasksForPractitioner : function (practitioner,options) {
            var deferred = $q.defer();
            options = options || {}
            options.active = options.active || true;   //default to only active tasks

            //the system used by clinFHIR for practitioners...
            //var practitionerSystem = appConfigSvc.config().standardSystem.practitionerIdentifierSystem;

            var url = appConfigSvc.getCurrentDataServer().url +
                "Task?owner:Practitioner="+practitioner.id;

            if (options.active) {
                url += "&status=requested,accepted";
            }

            //if there's a focus resource, then construct a relative reference
            var focus;
            if (options.focus) {
                focus = options.focus.resourceType + "/"+options.focus.id;
            }

            this.adHocFHIRQueryFollowingPaging(url).then(
                function(data) {
                    var lst = [];

                    if (data.data.entry) {
                        data.data.entry.forEach(function(entry){
                            if (focus) {
                                //see if the 'focus' reference matches the id of the passed in resource. Assume relative reference for now... todo
                                //ie that the task is on the same server as the practitiober (Data). Not always true...

                                if (entry.resource.focus && focus == entry.resource.focus.reference) {
                                    lst.push(entry.resource)
                                }


                            } else {
                                lst.push(entry.resource)
                            }
                        })
                    }

                   // if (options)



                    deferred.resolve(lst);    //return a bundle of the tasks (if any)
                },
                function(err) {

                }
            );

            return deferred.promise;

        },
        getPractitionerByLogin : function (user,details) {
            //return a Practitioner resource with an identifier that matches the login identifier. Create if not exists...
            //**** if the data server does not support creating a Practitioner then return null
            var deferred = $q.defer();

            var loginIdentifier = user.uid;     //user is a firebase user
            
            //the system used by clinFHIR for practitioners...
            var practitionerSystem = appConfigSvc.config().standardSystem.practitionerIdentifierSystem;

            var url = appConfigSvc.getCurrentDataServer().url +
                "Practitioner?identifier="+practitionerSystem + "|"+loginIdentifier;

            this.adHocFHIRQuery(url).then(
                function(data) {
                    //the practitioner was located (at least one)...
                    if (data.data && data.data.entry && data.data.entry.length > 0) {
                        //just take the first one. Should probably check if there is > 1...
                        var pract = data.data.entry[0].resource
                        pract.telecom = [{system:'email',value:user.email}];    //todo temp!
                        deferred.resolve(pract);      //return the practitooner
                    } else {
                        //so no practitioner was found - create one using the details given...
                        //use a PUT so we know whhat the id is - a bit lazy really...
                        var pract = {resourceType:'Practitioner'};
                        pract.identifier =[{system:practitionerSystem,value:loginIdentifier}];
                        pract.id = 'clinFhir'+loginIdentifier;
                        pract.telecom = [{system:'email',value:user.email}];        //the email is the only property we can be sure of having
                        var createUrl = appConfigSvc.getCurrentDataServer().url + "Practitioner/"+pract.id;
                        $http.put(createUrl,pract).then(
                            function(){
                                deferred.resolve(pract);
                            },
                            function (err) {
                                //If the server cannot create practitioner, just don't return one....
                                //alert('error saving practitioner ' + angular.toJson(err));
                                deferred.reject();
                            }
                        )

                    }


                },
                function(err) {
                   // alert('error getting practitioner ' + angular.toJson(err));
                    deferred.reject('error getting practitioner ' + angular.toJson(err));
                }
            )

            return deferred.promise;
        },
        getValueSet : function(ref) {
            var deferred = $q.defer();
            Utilities.getValueSetIdFromRegistry(ref,function(resp){
                if (resp) {
                    deferred.resolve(resp.resource);
                } else {
                    // removed 24 jan 2017 alert('Unable to load ValueSet: '+ ref);
                    deferred.reject('The terminology server does not have a ValueSet with the URL: '+ ref + "");
                }

            });
            return deferred.promise;
        },
        getVersionHistory : function(resource) {
            //retrieve the version history for a resource in the data server
            var qry = appConfigSvc.getCurrentDataServerBase() + resource.resourceType + "/"+resource.id + '/_history';
            return $http.get(qry);


        },
        getProfileDEP : function(profileName) {
            alert('getProfile stub not implemented yet');
        },
        queryConformanceServer : function(qry) {
            //find SD's that match a search query. used by selectProfile
            var config = appConfigSvc.config();
            var qry = config.servers.conformance + qry;
            return $http.get(qry);
        },
        getXmlResource : function (url) {
            var config = appConfigSvc.config();
            var qry = config.servers.data + url;
            //console.log(qry)
            return $http.get(qry);
        },
        localServerQuery : function(url) {
            return $http.get(url);
        },
        adHocFHIRQueryFollowingPaging : function(url) {
            //used when a caller expects a bundle



            //an ahhoc query - full url given - to avoid a controller using $http directly...
            var deferred = $q.defer();
            var bundle = Utilities.perfromQueryFollowingPaging(url).then(
                function(bundle) {
                    bundle.total = bundle.entry.length;
                    deferred.resolve({data:bundle});
                },function(err) {
                    deferred.reject(err)
                }
            );

            //return $http.get(url);

            return deferred.promise;
        },
        adHocFHIRQuery : function(url) {
            //not all callers expect a bundle!!!

            return $http.get(url);


        },
        
        generalFhirQuery : function(qry) {
            //runs an ad-hoc query against the data server
            var deferred = $q.defer();
            var config = appConfigSvc.config();

            //var qry = appConfigSvc.getCurrentDataServerBase() + qry;
            var qry = config.servers.data + qry;

            $http.get(qry).then(
                function(data){
                    deferred.resolve(data.data);
                },function(err){
                    alert('error executing query' + qry + '\n'+angular.toJson(err));
                }
            );
            return deferred.promise;
        },
        getExpandedValueSet : function(id,count) {
            //return an expanded valueset. Used by renderProfile Should only use for valuesets that aren't too large...
            //takes the Id of the valueset on the terminology server - not the url...
            var deferred = $q.defer();
            var config = appConfigSvc.config();

            var qry = config.servers.terminology + "ValueSet/"+id + "/$expand";
            if (count) {
                qry += "?count="+count
            }
            config.log(qry,'rbServices:getExpandedValueSet')

            $http.get(qry).then(
                function(data){
                    deferred.resolve(data.data);
                },function(err){
                    err.qry = qry;
                    deferred.reject(err);
                    //alert('error expanding ValueSet\n'+angular.toJson(err));
                }
            );
            return deferred.promise;
        },

        getConformanceResourceByUrl : function(url) {
            //find a StructureDefinition based on its Url. ie we assume that the url is pointing to where the SD is located...
            var config = appConfigSvc.config();
            config.log(url,'getConformanceResourceByUrl');
            var deferred = $q.defer();



            $localStorage.profileCacheUrl = $localStorage.profileCacheUrl || {};

            //caching is controlled in the config.
            if (config.enableCache && $localStorage.profileCacheUrl[url]) {
                //the profile is in the browser cache...
                deferred.resolve($localStorage.profileCacheUrl[url]);
            } else {
                $http.get(url).then(
                    function(data) {
                        //the profile was located
                        var profile = data.data;    //a StructureDefinition, of course...
                        config.log(profile)
                        //temp - disable caching foe now...$localStorage.profileCacheUrl[url] = profile;       //save in the local cache
                        deferred.resolve(profile);
                    },
                    function(err){
                        alert('Unable to find '+url);
                        deferred.reject(err);
                    }
                )
            }

            return deferred.promise;

        },
        findConformanceResourceByUri : function(url,serverUrl,typeOfConformanceResource) {
            //find a StructureDefinition based on its Uri. ie we query the registry to find the required SD
            //added serverUrl May21 so can specify the server to query in the call
            var deferred = $q.defer();
            var config = appConfigSvc.config();

            //default to a StructureDefinition
            typeOfConformanceResource = typeOfConformanceResource || 'StructureDefinition';

            //default to the conformance server...
            //serverUrl = serverUrl || config.servers.conformance;
            serverUrl = serverUrl || appConfigSvc.getCurrentConformanceServer().url;

            var qry = serverUrl  + typeOfConformanceResource + "?url=" + url;

            config.log(qry,'findConformanceResourceByUri');

            $http.get(qry).then(
                function(data){
                    var bundle = data.data;
                    if (bundle && bundle.entry && bundle.entry.length > 0) {
                        //return the first on if more than one... - updated: check the resource type! - added because of a bug, but it's not safe to assume that the response doesn't have other resources - like an OO


                        if (bundle.entry.length > 1) {
                            alert('There are '+ bundle.entry.length + ' StructureDefinitions with the url ' + url + "!")
                        }


                        var entry = _.find(bundle.entry,function(o){
                            return o.resource.resourceType==typeOfConformanceResource;
                        });

                       if (entry && entry.resource) {
                           config.log('resolvedId: '+entry.resource,'findConformanceResourceByUri');
                           deferred.resolve(entry.resource);
                       } else {

                           deferred.reject({msg:"No matching profile ("+url+") found on "+serverUrl  + typeOfConformanceResource +" (but not a server error - just not present, although others were)"})
                       }



                    } else {
                        
                        deferred.reject({msg:"No matching profile ("+url+") found on "+serverUrl  + typeOfConformanceResource +" (but not a server error - just not present)"})
                    }

                },function(err){
                    deferred.reject({msg:"Server error retrieving profile:" +url + " : " + angular.toJson(err)})
                }
            );

            return deferred.promise;

        },
        findResourceByUrlDEP : function(type,profile,cb) {
            //get a resource of a given type from the server. This is used for

            alert('findResourceByUrl stub not implemented yet');
        },
        getFilteredValueSet : function(id,filter){
            //return a filtered selection from a valueset. Uses the $expand operation on the terminology server...
            var config = appConfigSvc.config();


            var qry = appConfigSvc.getCurrentTerminologyServer().url + "ValueSet/"+id+"/$expand?filter="+filter;

            //var qry = config.servers.terminology + "ValueSet/"+name+"/$expand?filter="+filter;

            config.log(qry,'getFilteredValueSet');

            var deferred = $q.defer();
            $http.get(qry)
                .then(function(data) {
                    deferred.resolve(data.data);
                },function(err) {

                deferred.reject(err);
            });


            return deferred.promise;

        },
        registerAccess : function(module){
            //register access for the logs...

            var servers = {};
            servers.conformance = appConfigSvc.getCurrentConformanceServer().name;
            servers.terminology = appConfigSvc.getCurrentTerminologyServer().name;
            servers.data = appConfigSvc.getCurrentDataServer().name;

            $http.post('/stats/login',{module:module,servers:servers}).then(
                function(data){
                    //console.log(data);
                },
                function(err){
                    console.log('error accessing clinfhir to register access',err)
                }
            );

        },
        getAccessAudit : function(evt,min,max) {
            var that = this;

            var url = "/stats/summary";
            if (min) {
                url += "?min="+min+"&max="+max;
            }


            var deferred = $q.defer();
            var afterChange;
            $http.get(url)
                .success(function(data) {
                    //that.registerAccess();      //register access AFTER reading history to lastAcess is accurate...

                    //console.log(data)

                    //todo - create a list by country that is sorted...

                    //generate the data for the pie chart

                    var chart = {
                        options: {
                            chart: {
                                type: 'pie'
                            },
                            tooltip: {
                                style: {
                                    padding: 10,
                                    fontWeight: 'bold'
                                }
                            }
                        },
                        series: [{
                            name:'Count',
                            colorByPoint: true,
                            data: []
                        }],
                        title: {
                            text: 'Profiles'
                        },
                        //size (optional) if left out the chart will default to size of the div or something sensible.
                        size: {
                            width: 300,
                            height: 300
                        }
                    };


                    data.pieChartData = chart;


                    var chart1 = {
                        series: [
                            { name: 'Count',
                                data:[],
                                type : 'areaspline'
                            }
                        ],
                        titleX: {
                            text: 'Daily Access'
                        },
                        useHighStocks: true,
                        xAxis : {
                            events: {
                                afterSetExtremes: function () {

                                    if (afterChange) {
                                        $timeout.cancel(afterChange)
                                    }
                                    afterChange = $timeout(1000);
                                    afterChange.then(function(ok){
                                       // console.log(ok)
                                        if (evt) {
                                            evt(ctx.min,ctx.max)
                                        }
                                    },function(err){
                                        console.log(err)
                                    })
                                    var ctx = this;

                                    //console.log(Highcharts.dateFormat('%Y-%m-%d',this.min));
                                    //console.log(Highcharts.dateFormat('%Y-%m-%d',this.max));
                                }
                            }
                        },
                        

                    };

                    chart1.series[0].data = data.daySum;



                    data.accessDays = chart1;




                    deferred.resolve(data);
                }).error(function(oo, statusCode) {
                deferred.reject({msg:angular.toJson(oo),statusCode:statusCode});
            });
            return deferred.promise;






        }
    }


}).
    service('Utilities', function($http,$q,$localStorage,appConfigSvc,modalService) {
    return {
        getObjectSize : function(obj) {
            //http://www.russwurm.com/uncategorized/calculate-memory-size-of-javascript-object/

            function roughSizeOfObject( object ) {
                var objectList = [];
                var recurse = function( value ) {
                    var bytes = 0;

                    if ( typeof value === 'boolean' ) {
                        bytes = 4;
                    } else if ( typeof value === 'string' ) {
                        bytes = value.length * 2;
                    } else if ( typeof value === 'number' ) {
                        bytes = 8;
                    } else if (typeof value === 'object'
                        && objectList.indexOf( value ) === -1) {
                        objectList[ objectList.length ] = value;
                        for( i in value ) {
                            bytes+= 8; // assumed existence overhead
                            bytes+= recurse( value[i] )
                        }
                    }
                    return bytes;
                }

                return recurse( object );
            }

            return roughSizeOfObject(obj)
        },

        generateHash : function(){
            var hash = "";
            var possible = "abcdefghijklmnopqrstuvwxyz0123456789";

            for( var i=0; i < 5; i++ ) {
                hash += possible.charAt(Math.floor(Math.random() * possible.length));
            }
            return hash;
        },
        getConformanceResourceDEP : function(callback) {
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
                            }

                            if (element.binding.valueSetUri) {
                                vo.valueSetUri = element.binding.valueSetUri;
                            }

                            vo.binding = element.binding;   //Why does it need to ne more complex than this?


                        }

/*
                        if (element.binding) {

                            vo.strength = element.binding.strength;
                            if (element.binding.valueSetReference) {
                                vo.valueSetReference = element.binding.valueSetReference.reference;
                            } else {
                                vo.errors = vo.errors || []
                                vo.errors.push('value element has a binding with no valueSetReference')
                            }

                        }
                        */

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
        analyseExtensionDefinition2 : function(SD) {
            //return a vo that contains an analysis of the extension
            var that = this;

            var vo = {eds:[],dataTypes: [], multiple: false};
            vo.display = SD.display; //will use this when displaying the element
            vo.name = SD.name;       //or this one...
            // vo.definition =extension.definition;

            //vo.eds = [];     //a suppary of element definitions - so I can see them in the UI
            var discriminator;      //if this is sliced, then a discriminator will be set...
            if (SD.snapshot) {
                SD.snapshot.element.forEach(function (element) {
                    var edSummary = {path:element.path,type:element.type,name:element.name}
                    vo.eds.push(edSummary)
                    //this is the root extension
                    if (element.path.substr(0, 9) === 'Extension') {
                        if (!vo.definition) {
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
                    

                    if (element.path.indexOf('Extension.value') > -1) {
                        //this defines the value type for the extension

                        //look at the 'type' property to see the supported data types
                        if (element.type) {
                            element.type.forEach(function (typ) {
                                var code = typ.code;        //the datatype code
                                if (code) {



                                    vo.dataTypes.push(typ);
                                    //vo.dataTypes.push({code:code});
                                    //is this a codedd type?
                                    if (['CodeableConcept', 'code', 'coding'].indexOf(code) > -1) {
                                        vo.isCoded = true;
                                    }

                                    //if the datatype starts with an uppercase letter, then it's a complex one...
                                    if (/[A-Z]/.test( code)){
                                        vo.isComplex = true;
                                    }

                                    //is this a reference?
                                    if (code == 'Reference') {

                                    }
                                }


                            })
                        }

                        
                        //vo.element = element;
                        //var dt = element.path.replace('Extension.value', '');//.toLowerCase();


/*

                        if (dt == 'reference' || dt == '[x]') {   //eg cgif-guidancerequest
                            //if this is a reference, then need the list of types
                            vo.referenceTypes = [];
                            if (element.type) {
                                element.type.forEach(function (t) {
                                    var p = t.profile;
                                    if (p) {
                                        var ar = p[0].split('/');       //only the first
                                        var item = {display: ar[ar.length - 1], url: p[0]};
                                        item.specification = "http://hl7.org/fhir/" + ar[ar.length - 1];   //really only works if this is a core resource...
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

                        */

                    }
                })
            }


            return vo;
        },
        analyseExtensionDefinition3 : function(SD) {
            //return a vo that contains an analysis of the extension. Used by the profile builder only and extension directive
            // (at this point)
            var that = this;

            //if this is a complex extension (2 level only) then the property 'complex' has the analysis...
            var vo = {dataTypes: [], multiple: false};
            vo.display = SD.display; //will use this when displaying the element
            vo.name = SD.name;
            vo.isComplexExtension = false;
            vo.context = SD.context;
            vo.publisher = SD.publisher;
            vo.url = SD.url;
            vo.description = SD.description;
           // vo.sliceName = SD.sliceName;
            //console.log(vo.url)

            //vo.eds = [];     //a suppary of element definitions - so I can see them in the UI
            var discriminator;      //if this is sliced, then a discriminator will be set...
            var complex = false;    //will be true if this is a

            if (SD.snapshot) {
                //first off, set the common data about the extension that is found in the first ED
                var ed = SD.snapshot.element[0];
                vo.definition = ed.definition;
                vo.short = ed.short;   //the short name of the extension - whether simple or complex
                if (ed.max == '*') {
                    vo.multiple = true;
                }




                //next, let's figure out if this is a simple or a complex extension.
                var arElements = [];
                SD.snapshot.element.forEach(function (element,inx) {
                    if (element.path) {
                        var arPath = element.path.split('.')

                        //console.log(element.slicing)
                        /*
                        The genomics extensions have a slicing element even for a 'simple' extension
                        so, change the criteria to a path >= 3 segments
                        changed March 30, 2107
                        if (element.slicing) {
                            vo.isComplexExtension = true;
                        }
                        */
                        if (arPath.length > 2) {
                            vo.isComplexExtension = true;
                        }


                        //get rid of the id elements and the first one - just to simplify the code...
                        var include = true;
                        if (inx == 0 || arPath[arPath.length-1] == 'id' || element.slicing) {include = false}

                        //get rid of the url and value that are part of the 'parent' rather than the children...
                        if (arPath.length == 2) {
                            //updated as was not getting details for simple extensions...
                            if (arPath[1] == 'url') {include = false}

                            if (vo.isComplexExtension && arPath[1].indexOf('value')>-1){
                                include = false
                            }    //THIS is the parent...


                        }


                        if (include) {
                            arElements.push(element);
                        }
                    }

                });

                //vo.isComplexExtension = false;      //temp



                if (vo.isComplexExtension) {
                    //process as if it was a simple extension
                    processComplex(arElements,vo)
                } else {
                    //process as if it was a simple extension
                    processSimple(arElements,vo)
                }


            }

  //          console.log(vo)
//console.log('----------')
            return vo;

            //process a complex extension. Will only handle a single level hierarchy - ie a list of child extensions
            //probably not too had to make it recursive, but is it worth it? other stuff would need to change as well...
            function processComplex(arElement,vo) {
                vo.children = [];       //these will be the child extensions
                var child = {};         //this is a single child element

                arElement.forEach(function (element) {
                    if (element.path) {
                        var arPath = element.path.split('.');
                        if (arPath.length == 2) {
                            //this is defining the start of a new child. create a new object and add it to the children array
                            child = {min: element.min, max: element.max};
                            child.ed = element;     //Hopefully this is the representative ED
                            child.ed.myMeta = {};

                            vo.children.push(child);
                        } else if (arPath.length > 2) {
                            //this will be the definition of the child. we're only interested in the code and the datatype/s
                            var e = arPath[2];
                            if (e.indexOf('value') > -1) {
                                //this is the value definition - ie what types
                                child.ed.type = element.type;
                                child.ed.binding = element.binding;     //the child.ed was set by the 'parent' and won't have the binding...


                                //pull the bound ValueSet out for convenience...
                                if (element.binding) {
                                    if (element.binding.valueSetReference) {
                                        //we may need to check whether this is a relative reference...
                                        child.boundValueSet = element.binding.valueSetReference.reference;
                                    }
                                    if (element.binding.valueSetUri) {
                                        child.boundValueSet = element.binding.valueSetUri;
                                    }
                                    child.bindingStrength = element.binding.strength;

                                }


                                //see if this is a complex dataType (so we can set the icon correctly)
                                if (element.type) {
                                    element.type.forEach(function (typ) {
                                        var code = typ.code;        //the datatype code
                                        if (code) {
                                            //if (/[A-Z]/.test(code)) {  aug2017 - don't know why there is a caps check here...
                                                child.ed.myMeta.isComplex = true;
                                           // }
                                        }
                                    })
                                }

                            }

                            if (e.indexOf('url') > -1) {
                                //this is the code of the child
                                child.code = element.fixedUri
                            }

                        }
                    }


                });


            }


            //process this as if it were a simple extension
            function processSimple(arElement,vo) {
                arElement.forEach(function (element) {
                    //we're only interested in finding the 'value' element to find out the datatypes it can assume...
                    if (element.path.indexOf('Extension.value') > -1) {
                        //this defines the value type for the extension

                        //look at the 'type' property to see the supported data types
                        if (element.type) {
                            vo.type = element.type;
                            element.type.forEach(function (typ) {
                                var code = typ.code;        //the datatype code
                                if (code) {

                                    vo.dataTypes.push(typ);
                                    //vo.dataTypes.push({code:code});
                                    //is this a codedd type?
                                    if (['CodeableConcept', 'code', 'coding'].indexOf(code) > -1) {
                                        vo.isCoded = true;

                                    }

                                    /* - no it isn't!  Jun 2017...
                                    //if the datatype starts with an uppercase letter, then it's a complex one...
                                    if (/[A-Z]/.test( code)){
                                        vo.isComplex = true;    //this really should be 'isComplexDatatype'
                                    }
                                    */

                                    //is this a reference?
                                    if (code == 'Reference') {

                                    }
                                }
                            })
                        }

                        if (element.binding) {
                            vo.binding = element.binding;
                            if (element.binding.valueSetUri) {
                                vo.boundValueSet = element.binding.valueSetUri
                            } else if (element.binding.valueSetReference){
                                vo.boundValueSet = element.binding.valueSetReference.reference;
                            }

                        }

                    }

                })
            }



        },
        processComplexExtension : function(extension,discriminator) {
            //create a summary object for the extension. for extension designer & renderProfile
            //these are comples extensions where there is a single 'parent' and multiple child elements...
            var that = this;
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
                                                //var p = dt.profile[0];     //only take the first one...
                                                var p = that.getProfileFromType(dt);


                                                var ar = p.split('/');
                                                dt.displayType =ar[ar.length-1];
                                            }
                                        })
                                    }



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

console.log(summary);
            return summary;

        },
        getConformanceResourceForServerType : function(serverType){
            //return the conformance resource for the given type of server. returns a promise
            var config = appConfigSvc.config();

            var url = config.servers[serverType] + 'metadata';

            config.log(url,'Utilities:getConformanceResourceForServerType')
            
            return $http.get(url)
        },
        validate : function(resource,serverUrl,profile) {
            //call the validate operation. If serverUrl is passed in then use that one, else use the data server...
            //can also pass in a profile to validate against
            var clone = angular.copy(resource);
            delete clone.localMeta;
            clone.id = 'temp';      //hapi requires an id...
            //use the 'parameters' syntax
            var params = {'resourceType':'Parameters',parameter:[]};
            params.parameter.push({'name':'resource',resource:clone});
            
            if (profile){
                params.parameter.push({'name':'profile',valueUri:profile});
            }


            var config = appConfigSvc.config();
            serverUrl = serverUrl || config.servers.data;

            var qry = serverUrl + resource.resourceType + "/$validate";

            //var qry = appConfigSvc.getCurrentDataServerBase() + resource.resourceType + "/$validate";

            console.log(qry)
            console.log(JSON.stringify(params))


            return $http.post(qry, params);      //returns a promise...

        },
        profileQualityReport :function (profile) {
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
        getUCUMUnits : function(category) {
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
        getValueSetIdFromRegistry : function(uri,cb,noError) {
            //return the id of the ValueSet on the terminology server so we can call $expand on it. For now, assume at the VS is on the terminology.
            var config = appConfigSvc.config();
            var qry = appConfigSvc.getCurrentTerminologyServer().url + "ValueSet?url=" + uri;
            //var qry = config.servers.terminology + "ValueSet?url=" + uri;
            config.log(qry,'rbServices:getValueSetIdFromRegistry')
            var that = this;

            $http.get(qry).then(
                function(data) {
                    var resp ={};
                    var bundle = data.data;
                    if (bundle && bundle.entry && bundle.entry.length > 0) {

                        if (bundle.entry.length >1 ) {
                            var alrt = 'The terminology server ('+config.servers.terminology+') has multiple ValueSets with a URL property (in the resource) of '+uri +". I'll use the first one, but you might want to contact the registry owner and let them know.";
                            resp.error = alrt;
                            if (!noError) {
                                modalService.showModal({}, {bodyText: alrt})
                            }

                           // alert('The terminology server has multiple ValueSets with a URL property (in the resource) of '+uri +". I'll use the first one, but you might want to contact the registry owner and let them know.");
                        }

                        var id = bundle.entry[0].resource.id;   //the id of the velueset in the registry
                        config.log('resolvedId: '+id,'rbServices:getValueSetIdFromRegistry');
                       //  resp = {id: id,minLength:3}         //response object
                        resp.id = id;
                        resp.minLength = 3;         //response object
                        resp.resource = bundle.entry[0].resource;

                        //ValueSets with a small size that can be rendered in a set of radio buttons.
                        // lookup from a fixed lis of ValueSetst. has to be this way as we will subsequently (in renderProfile)
                        //get the full expansion without filtering...
                        if (that.isVSaList(uri)) {
                            resp.type='list';
                        }
                        cb(resp);
                    } else {
                        if (!noError) {

                            // removed jan 24 2017 alert('There is no ValueSet with a url of '+ uri + ' on the terminology server');
                        }
                        //alert('There is no ValueSet with a url of '+ uri + ' on the terminology server');
                        cb(null);
                    }
                },
                function(err) {
                    alert('Error contacting terminology server:\n'+angular.toJson(err));
                    cb(null);
                }
            );

        },
        validateResourceAgainstProfile : function(resource,profile) {
            //alert('validateResourceAgainstProfle stub not implemented yet');
        },
        isVSaList : function(uri) {
            //The set of valueSets that are small and can be rendered as a set of radiobuttons
            //todo - no need for the replace stuff any more - a simple boolean should suffice...
            vsLookup = [];
            vsLookup['condition-severity'] = {id:'valueset-condition-severity',minLength:1,type:'list'};
            vsLookup['condition-category'] = {id:'valueset-condition-category',type:'list'};
            vsLookup['condition-certainty'] = {id:'valueset-condition-certainty',minLength:1,type:'list'};
            vsLookup['list-empty-reason'] = {id:'valueset-list-empty-reason',minLength:1,type:'list'};
            vsLookup['list-item-flag'] = {id:'valueset-list-item-flag',minLength:1,type:'list'};
            vsLookup['basic-resource-type'] = {id:'valueset-basic-resource-type',minLength:1,type:'list'};


            //these 3 are from extensions - this passes in the full url - todo - does this need review??
            //I think that past DSTU-2 the urls' should all resolve directly...
            vsLookup['ReligiousAffiliation'] = {id:'v3-ReligiousAffiliation',minLength:1,type:'list'};
            vsLookup['Ethnicity'] = {id:'v3-Ethnicity',minLength:1,type:'list'};
            vsLookup['investigation-sets'] = {id:'valueset-investigation-sets',minLength:1,type:'list'};
            vsLookup['observation-interpretation'] = {id:'valueset-observation-interpretation',minLength:1,type:'list'};
            vsLookup['marital-status'] = {id:'marital-status',minLength:1,type:'list'};
            vsLookup['ActPharmacySupplyType'] ={id:'v3-vs-ActPharmacySupplyType',minLength:1,type:'list'};
            vsLookup['Confidentiality'] = {id:'v2-0272',minLength:1,type:'list'};
            vsLookup['composition-status'] = {id:'composition-status',minLength:1,type:'list'};
            vsLookup['observation-status'] = {id:'observation-status',minLength:1,type:'list'};
            vsLookup['observation-category'] = {id:'observation-category',minLength:1,type:'list'};

            vsLookup['condition-status'] = {id:'condition-status',minLength:1,type:'list'};
            vsLookup['administrative-gender'] = {id:'administrative-gender',minLength:1,type:'list'};
            vsLookup['reason-medication-not-given-codes'] = {type:'list'};
            vsLookup['care-plan-activity-category'] = {type:'list'};
            vsLookup['location-physical-type'] = {type:'list'};

            vsLookup['endpoint-connection-type'] = {type:'list'};

            var ar = uri.split('/');
            var vsName = ar[ar.length - 1];




            if (vsLookup[vsName]) {
                    return true;
                } else {
                    return false;
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
        getListOfDataTypes : function() {

            //['CodeableConcept', 'Identifier', 'Period', 'Quantity', 'Reference','HumanName']
            return ['CodeableConcept', 'Identifier', 'Period', 'Quantity', 'Reference','HumanName','Annotation','String'];
        },
        getProfileFromType : function(type){
            //returns the profile url from a type entry. In stu2 this is an array - in stu3 is is single
           // if (type.code == 'Reference') {
                p = type.profile;
                if (p){
                    if (angular.isArray(p)) {
                        return p[0]
                    } else {
                        return p;
                    }
                }
           // }

        },
        setAuthoredByClinFhir : function(resource) {
            //set the extension that indicates that the resource is authored by clinFhir
            if (resource) {
                var extensionUrl = appConfigSvc.config().standardExtensionUrl.clinFHIRCreated;
                this.addExtensionOnce(resource,extensionUrl,{valueBoolean:true})
            }


        },
        isAuthoredByClinFhir : function(profile) {
            // Has this artifact been authored by clinfhir - there were a number of ways of recording that.

            var isAuthoredByClinFhir = false;


            var ext = this.getSingleExtensionValue(profile, appConfigSvc.config().standardExtensionUrl.clinFHIRCreated)
            if (ext && ext.valueBoolean) {
                isAuthoredByClinFhir = ext.valueBoolean
            }


            if (!isAuthoredByClinFhir) {
                if (profile.code) {
                    profile.code.forEach(function (coding) {
                        if (coding.system == 'http://fhir.hl7.org.nz/NamingSystem/application' &&
                            coding.code == 'clinfhir') {
                            isAuthoredByClinFhir = true;
                        }
                    })
                }
            }

            if (!isAuthoredByClinFhir) {
                //used identifier in the past...
                if (profile.identifier) {

                    if (angular.isArray(profile.identifier)) {
                        profile.identifier.forEach(function(ident){
                            if (ident.system == 'http://clinfhir.com' && ident.value=='author') {
                                isAuthoredByClinFhir = true;
                            }
                        })
                    } else {
                        //conceptmap has only 1 identifier!
                        if (profile.identifier.system == 'http://clinfhir.com' && profile.identifier.value=='author') {
                            isAuthoredByClinFhir = true;
                        }
                    }


                }
            }

            //latest STU-3 changed 'code' -> 'keyword'!
            if (!isAuthoredByClinFhir) {
                if (profile.keyword) {
                    profile.keyword.forEach(function(coding){
                        if (coding.system == 'http://fhir.hl7.org.nz/NamingSystem/application' &&
                            coding.code == 'clinfhir') {
                            isAuthoredByClinFhir = true;
                        }
                    })
                }
            }


            return isAuthoredByClinFhir;
        },
        perfromQueryFollowingPaging : function(url,limit){
            //Get all the resurces specified by a query, following any paging...
            //http://stackoverflow.com/questions/28549164/how-can-i-do-pagination-with-bluebird-promises

            var returnBundle = {total:0,type:'searchset',link:[],entry:[]};
            returnBundle.link.push({relation:'self',url:url})

            //add the count parameter
            if (url.indexOf('?') > -1) {
                url += "&_count=100"
            } else {
                url += "?_count=100"
            }


            var deferred = $q.defer();

            limit = limit || 100;


           // var returnBundle = {total:0,type:'searchset',link:[],entry:[]};
            //returnBundle.link.push({relation:'self',url:url})
            getPage(url);

            //get a single page of data
            function getPage(url) {
                return $http.get(url).then(
                    function(data) {
                        var bundle = data.data;     //the response is a bundle...

                        //copy all resources into the array..
                        if (bundle && bundle.entry) {
                            bundle.entry.forEach(function(e){
                                returnBundle.entry.push(e);
                            })
                        }

                        //is there a link
                        if (bundle.link) {
                            var moreToGet = false;
                            for (var i=0; i < bundle.link.length; i++) {
                                var lnk = bundle.link[i];

                                //if there is a 'next' link and we're not at the limit then get the next page
                                if (lnk.relation == 'next'){// && returnBundle.entry.length < limit) {
                                    moreToGet = true;
                                    var url = lnk.url;

                                //todo - this is a real hack as the NZ server is not setting the paging correctly...

                                    url = url.replace('http://127.0.0.1:8080/baseDstu2','http://fhir.hl7.org.nz/baseDstu2')

                                


                                    getPage(url);
                                    break;
                                }
                            }

                            //all done, return...
                            if (! moreToGet) {
                                deferred.resolve(returnBundle);
                            }
                        } else {
                            deferred.resolve(returnBundle);
                        }
                    },
                    function(err) {
                        deferred.reject(err);
                    }
                )
            }

            return deferred.promise;

        },
        addExtensionOnceWithReplace : function(resource,url,value) {
            //add the extension with this url if it does not already exist
            if (angular.isArray(url)) {
                url = url[0];       //stus/3
            }

            var pos = -1;
            resource.extension = resource.extension || []

            resource.extension.forEach(function(ext,inx){
                if (ext.url == url) {pos=inx;}
            });

            //remove any existing...
            if (pos >  -1) {
                resource.extension.splice(pos,1)
            }

            var ext = {url:url}
            angular.extend(ext,value);
            resource.extension.push(ext)

        },
        addExtensionMultiple : function(resource,url,value) {
            //add the extension with this url regardless---

            if (angular.isArray(url)) {
                url = url[0];       //stus/3
            }

            resource.extension = resource.extension || []


            var ext = {url:url}
            angular.extend(ext,value);
            resource.extension.push(ext)

        },
        addExtensionOnce : function(resource,url,value) {
            //add the extension with this url if it does not already exist
            if (angular.isArray(url)) {
                url = url[0];       //stus/3
            }
            if (resource) {
                var found = false;
                resource.extension = resource.extension || []

                resource.extension.forEach(function(ext){
                    if (ext.url == url) {found = true;}
                });

                if (! found) {
                    var ext = {url:url}
                    angular.extend(ext,value);
                    resource.extension.push(ext)
                }
            }

        },
        getSingleExtensionValue : function(resource,url) {
            //return the value of an extension assuming there is only 1...
            var extension;
            if (resource) {
                resource.extension = resource.extension || []
                resource.extension.forEach(function(ext){
                    if (ext.url == url) {extension = ext}
                });
            }

            return extension;
        },
        getComplexExtensions : function(resource,url) {
            //get an array of complex extensions, assuming there can be multiple
            var ar = [];
            if (resource) {
                resource.extension = resource.extension || []
                resource.extension.forEach(function(ext){
                    if (ext.url == url) {
                        var extension = {children:[]}
                        //now get the children of this extension
                        ext.extension.forEach(function (child) {
                            extension.children.push(child)
                        });

                        ar.push(extension)
                    }
                });
            }
            return ar;
        }
    }
})
    .service('RenderProfileSvc', function($http,$q,Utilities,ResourceUtilsSvc) {

    function isEmpty(obj) {
        for(var key in obj) {
            if(obj.hasOwnProperty(key))
                return false;
        }
        return true;
    }

    var iterateOverNodeSet = function(insertionPoint,invalue) {
        var text = "";

        console.log(insertionPoint);

        angular.forEach(invalue,function(value,propertyName) {     //value will be an object...

            //first, populate all the non-extensions...
            if (propertyName && propertyName !== 'extension') {

                //a polymorphic property...
                var g = propertyName.indexOf('[x]');
                if (g > -1) {
                    propertyName = propertyName.substr(0, g) + value.dataType;
                }

                if (angular.isArray(value)) {
                    //this is a leaf node that has multiple values.
                    insertionPoint[propertyName] = [];
                    value.forEach(function (vo) {
                        insertionPoint[propertyName].push(vo.v);
                        text += getText(propertyName, vo.text);

                    })
                } else {
                    //this is a leaf that only has a single value...
                    if (angular.isArray(insertionPoint)) {
                        var insrt = {};
                        insrt[propertyName] = value.v;
                        text += getText(propertyName, value.text);

                        insertionPoint.push(insrt);
                        //var t = insertionPoint.push(insrt);     //??? <<< what is this

                    } else {
                        insertionPoint[propertyName] = value.v;
                        text += getText(propertyName, value.text);

                    }
                }
            }
        });

        //now iterate through the extensions.
        angular.forEach(invalue,function(value,propertyName) {     //value will be an object...

            //now to check the extensions...
            if (propertyName && propertyName == 'extension') {


                value.forEach(function(vo){

                    //the name of the element to which this extension is attached...
                    var parentPropertyName = 'extension';       //this will be the case for a root extension...
                    var ar = vo.element.path.split('.');
                    if (ar.length > 2) {
                        parentPropertyName = ar[ar.length-2];
                    }

                    //if the parentPropertyName is 'Extension', then this is a root extension. Otherwise it will be an extended property...
                    if (parentPropertyName == 'extension') {
                        insertionPoint.extension = insertionPoint.extension || []
                        insertionPoint.extension.push(vo.v)
                    } else {

                        //now need to see if there is an extension element. If this is a primitive then it is a separate element
                        //otherwise it is an 'extension' property on the element
                        if (vo.isPrimitive){
                            if (! insertionPoint['_'+parentPropertyName]) {
                                insertionPoint['_'+parentPropertyName] = {extension:[]}

                            }
                            insertionPoint['_'+parentPropertyName].extension.push(vo.v);
                        } else {
                            //this is an extension on an element...
                            if (! insertionPoint[parentPropertyName]) {
                                insertionPoint[parentPropertyName] = {};
                            }

                            if (! insertionPoint[parentPropertyName].extension){
                                insertionPoint[parentPropertyName].extension = [];
                            }
                            insertionPoint[parentPropertyName].extension.push(vo.v);
                        }
                    }
                })
            }
        });

        return text;
    };
    function getText(propertyName,text){
        if (text) {
            var txt = Utilities.stripDiv(text);     //get rid of extraneous divs...
            txt = htmlEscape(txt);

            return "<div>"+propertyName+":"+txt+"</div>";
        } else {
            return "";
        }

    }

    function htmlEscape(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    //a dictionary indexed on the resource for the standard resource types.
    var standardResourceTypes = null;


    return {
        
        getAllStandardResourceTypes : function(){
            //the basic resources in FHIR. returns an object that also indicates if it is a reference resource or not...
            var deferred = $q.defer();
            if (! standardResourceTypes) {
                $http.get('resourceBuilder/allResources.json').then(
                    function(data) {

                        data.data.sort(function(a,b){
                            if (a.name > b.name) {
                                return 1
                            } else return -1;

                        });


                        standardResourceTypes = data.data;

                        deferred.resolve(standardResourceTypes)
                    },
                    function(err) {
                        alert('Error loading allResources.json\n'+angular.toJson(err));
                        deferred.reject();
                    }
                );
            } else {
                deferred.resolve(standardResourceTypes)
            }

            return deferred.promise;
        },
        getCodeSystems : function() {
            return $http.get('resourceBuilder/codeSystems.json')
        },
        getValueSetsForProfileDEP : function(profile) {
            alert('getValueSetsForProfile stub not implemented yet');
        },
        getProfileStructure : function(profile,cb) {
            alert('getProfileStructure stub not implemented yet');
        },
        parseProfile : function (profile) {
            //this is about 'expanding' extensions into the base profile...
            var debug = false;
            var deferred = $q.defer();
            if (profile && profile.snapshot && profile.snapshot.element) {

                //first, locate all the extensions and retrieve the definitions...
                var extensionQuery = [];
                var extensionObj = {};
                profile.snapshot.element.forEach(function (element) {
                    var path = element.path;
                    var arPath = path.split('.');
                    if (arPath[arPath.length - 1] == 'extension') {
                        if (element.type[0].profile) {
                            //add a call to the 'get profile' service...



                            //var urlToExtensionDefinition = element.type[0].profile[0];
                            var urlToExtensionDefinition = Utilities.getProfileFromType(element.type[0]);
                            //only read each definition once (even if referenced multiple timee
                            //todo - could look at more efficeint caches...
                            if (!extensionObj[urlToExtensionDefinition]) {
                                extensionObj[urlToExtensionDefinition] = {};
                                extensionQuery.push(
                                    GetDataFromServer.findResourceByUrlPromise('StructureDefinition', urlToExtensionDefinition).then(
                                        function (resource) {
                                            extensionObj[urlToExtensionDefinition] = resource;
                                            if (debug) {
                                                console.log(urlToExtensionDefinition, resource)
                                            }//  console.log(resource);
                                        }
                                    )
                                )
                            }
                        }
                    }
                });

                //execute all the queries.

                $q.all(extensionQuery).then(
                    function() {

                        //return;

                        //now we have all the extensionDefinitions, we can iterate through the profile and construct a list of elements...

                        if (debug) {console.log(extensionObj)}
                        var parsedList = [];     //a list of elements that shold be displayed...

                        //only include the ones we want to include...
                        //todo - should only remove from off the root - ?what about extensions???
                        var arHide = [ 'implicitRules',  'contained', 'meta','id','modifierExtension']; //'text','xtension','language',


                        profile.snapshot.element.forEach(function (element) {
                            var ignore = false;
                            var arPath = element.path.split('.');
                            if (element.max == 0) {
                                ignore = true;
                            } else {
                                //see if this property name is in the list of properties to hide

                                for (var i = 0; i < arPath.length; i++) {
                                    for (var j=0; j<arHide.length;j++) {
                                        if (arPath[i] == arHide[j] ) {
                                            ignore = true;
                                            break;
                                        }
                                    }
                                }
                            }
                            //some specific elements on the root - that may be valid elsewher in a resource or an extension
                            if (arPath.length == 2) {
                                var arHide1 = ['language'];
                                if (arHide1.indexOf(arPath[1])>-1 ) {ignore = true;}
                            }

                            //all extensions are sliced. (ie start with an element with a discriminator, Don't show the discriminator
                            if (element.slicing) {
                                ignore = true;
                            }


                            if (!ignore) {

                                if (debug) {console.log(element.path)}
                                //is this an extension:
                                if (arPath[arPath.length - 1] == 'extension') {
                                    if (debug) {
                                        console.log('extension type',element.type)
                                    }

                                    if (element.type && element.type[0].profile) {
                                        //retrieve the definition from the cache we just creatd...

                                        
                                        
                                        var urlToExtensionDefinition = Utilities.getProfileFromType(element.type[0]);
                                        //var urlToExtensionDefinition = element.type[0].profile[0];
                                        var extensionDefinition = extensionObj[urlToExtensionDefinition];
                                        if (extensionDefinition) {
                                            if (debug) {
                                                console.log('extDef',extensionDefinition)
                                            }


                                            //is this a simple or a complex extension
                                            var analysis = Utilities.analyseExtensionDefinition(extensionDefinition);

                                            console.log(analysis);
                                            if (debug) {
                                                if (analysis.complexExtension) {
                                                    console.log('complex')
                                                } else {
                                                    console.log('simple')
                                                }
                                            }
                                            if (! analysis.complexExtension) {
                                                //this is a simple extension
                                                var newEl;
                                                var key=analysis.display || analysis.name || "No Name"

                                                //examine the definition to retrieve the name & datatype to use
                                                //use the element with the datatype as the base element...
                                                var short = extensionDefinition.name;
                                                for (var i=0;i<extensionDefinition.snapshot.element.length;i++) {
                                                    var el = extensionDefinition.snapshot.element[i];
                                                    if (el.path == 'Extension') {
                                                        /*
                                                         //the short name is on the path that is just estension
                                                         if (el.name && el.name.toLowerCase() == 'extension') {
                                                         key = el.short;
                                                         }

                                                         key = key || el.name;
                                                         */
                                                    } else if (el.path.indexOf('.value') > -1) {
                                                        //this is the element with the value...
                                                        newEl = angular.copy(el);   //becasue we're changing the path to be from the profile
                                                        break;
                                                    }
                                                }

                                                if (newEl) {        //from the value[x] element in the profile
                                                    //a simple extension is against the resource root
                                                    newEl.myMeta = {isExtension : true,extensionType:'simple'};
                                                    // The display will be the extensionText value...


                                                    var ar = element.path.split('.');  //this will be the path in the profile
                                                    if (ar.length > 1) {
                                                        //this is an extension against an element
                                                        newEl.myMeta.extendedElement = ar[ar.length-2];     //the element that is being extended
                                                        newEl.myMeta.extensionType = 'element';
                                                    }
                                                    //ar[ar.length-1] =

                                                    //extensionPath = extensionPath.replace('.extension','') + '.' + key;
                                                    newEl.path =  element.path

                                                    newEl.min = element.min;        //the minimum  in the profile...



                                                    //
                                                        newEl.extensionUrl = Utilities.getProfileFromType(element.type[0]);   //save the url...
                                                    
                                                    //newEl.extensionUrl = Utilities.getProfileFromType(element.type[0]);   //save the url...
                                                    //newEl.extensionText = newEl.short || newEl.definition || newEl.path;
                                                    //newEl.extensionUrl = element.type[0].profile[0];   //save the url...
                                                    //newEl.extensionText = newEl.short || newEl.definition || newEl.path;
                                                    newEl.myMeta.extensionText = key;
                                                    parsedList.push(newEl);
                                                    if (debug){
                                                        console.log('element',newEl)
                                                    }
                                                    //$scope.elementList.splice(pos-1,1,newEl);
                                                }
                                            } else {
                                                //this is a complex extension
                                                var key = analysis.display || analysis.name || "No Name"
                                                var extPath = arPath[0] + '.' + key;   //for display ?is this ok - what about nested complex?

                                                //add the extension 'parent' to the list.
                                                var placeHolder = angular.copy(element);
                                                parsedList.push(placeHolder);

                                                //$scope.profile.snapshot.element.push(placeHolder);

                                                placeHolder.myMeta = placeHolder.myMeta || {}
                                                placeHolder.myMeta.isExtension = true;
                                                placeHolder.myMeta.extensionType = 'complexParent';

                                                var extensionPath = element.path;

                                                //if the extension is off the root, then replace the 'extension' with a meaningful name
                                                //otherwise,
                                                extensionPath = extensionPath.replace('.extension','') + '.' + key;




                                                placeHolder.path =  extensionPath;// extPath;  <<<< make sure works with root extension as welll
                                                //placeHolder.min = element.min;
                                                //placeHolder.max = element.max;
                                                placeHolder.type = [{code:'BackboneElement'}] ;
                                                //placeHolder.value=[];
                                                placeHolder.original = element;
                                                placeHolder.definition = extensionDefinition;

                                                if (debug) {console.log('placeholder',placeHolder)}
                                                //now add elements that represent the 'children' of the complex extesnion
                                                analysis.complexExtension.contents.forEach(function(content){
                                                    //var childElement = {path:extPath + '.' + content.name};
                                                    var childElement = {path:extensionPath + '.' + content.name};

                                                    childElement.myMeta = childElement.myMeta || {}
                                                    childElement.myMeta.isExtension = true;
                                                    childElement.myMeta.extensionType = 'complexChild';
                                                    childElement.extensionUrl = content.code; //the parent name
                                                    // childElement.myMeta = {isExtension : true};

                                                    childElement.min = content.min;
                                                    childElement.max = content.max;
                                                    childElement.type = content.dt;

                                                    //there is a valueSet bound to this elemeny
                                                    if (content.boundValueSet) {
                                                        childElement.binding = {valueSetReference : {reference:content.boundValueSet}}
                                                    }
                                                    parsedList.push(childElement);



                                                });

                                            }

                                        }

                                    }


                                } else {
                                    //this is not an extension...
                                    parsedList.push(element);
                                }


                            }
                        });



                        if (debug) {
                            console.log(parsedList)
                        }


                        deferred.resolve(parsedList);
                    }
                )
            } else {
                deferred.reject()
            }


            return deferred.promise;

        },
        makeResource : function(SD,patient,resourceId) {
            //this.newMakeResource(SD,patient,resourceId);    // new algorithm
            var resource = {};
            var text = "";
            var insertionPoint = resource;
            var debug = false;

            if (SD && SD.snapshot && SD.snapshot.element) {

                var root = SD.snapshot.element[0];
                resource.resourceType = root.path;
                //resource.id = resourceId;
                resource.meta = {lastUpdated:moment().format()};         //to be at the top
                resource.extension = [];
                resource.text = {};         //to make sure it is at the top!

                //elementList.forEach(function (element) {
                SD.snapshot.element.forEach(function (element) {


                    var path = element.path;
                    var ar = path.split('.');

                    if (element.value ) {

                        //a value will always be a 'collection' of properties. If it is an object, then there will only
                        //be one 'set', even if members of that set are multiple (like identifier).

                        if (angular.isArray(element.value)) {
                            if (debug) { console.log(element.path,'array',ar.length)}

                            //this is a root that can have multiple sets - like Careplan.participant
                            //further - any node can have an element that is multiple - eg careplan.activity.detail

                            switch (ar.length) {
                                //eg careplan.activity  - the value element will have the results
                                case 2 :
                                    var propertyName = ar[1];   //the property to insert on to
                                    element.value.forEach(function(set){


                                        //for some reason some profiles (eg daf patient profile) inserts a blank obkect
                                        if (! isEmpty(set)) {
                                            /*
                                             if (! resource[propertyName]) {
                                             resource[propertyName] = [];
                                             }
                                             */
                                            var xxx = {};
                                            //this will be single set
                                            text += iterateOverNodeSet(xxx,set);

                                            if (element.myMeta && element.myMeta.isExtension) {
                                                //this is a complex extension on the root of the resource...
                                                // eg Patient.citizenship.

                                                var complexExtension = createComplexExtension(element,set)
                                                /*
                                                 var url = element.definition.url;
                                                 var complexExtension = {"url":url,extension:[]}
                                                 //need to iterate over the set rather than 'xxx' as we need the datatype
                                                 angular.forEach(set,function(value,key){
                                                 if (key.substr(0,2)!== '$$') {      //$$ prefix are angular properties...
                                                 var propertyName = 'value'+value.dataType;
                                                 var sub = {url:key};
                                                 sub[propertyName] = value.v;
                                                 complexExtension.extension.push(sub)
                                                 }

                                                 });
                                                 */
                                                resource['extension'].push(complexExtension);
                                            } else {
                                                //xxx is a set of properties suitable for inclusion in the resurce...
                                                if (! resource[propertyName]) {
                                                    resource[propertyName] = [];
                                                }

                                                resource[propertyName].push(xxx);
                                            }



                                            //this is a complex child that is 0..1 not 0..* (medPrescribe.dispense)
                                            if (element.max !== '*') {
                                                resource[propertyName] = xxx;
                                            }
                                        }

                                    });
                                    break;
                                case 3:
                                    //alert('level 3 - hurrah!')

                                    var l2name = ar[1];
                                    var l3name = ar[2];
                                    if (! resource[l2name]) {
                                        resource[l2name] = [];     //assume that all l2 expansion are multiple...
                                    }

                                    if (resource[l2name].length == 0) {
                                        var t = {};
                                        t[l3name] = {};
                                        resource[l2name].push(t)
                                    }

                                    var pageInx = -1;


                                    element.value.forEach(function(set){
                                        pageInx++;
                                        var xxxx = {}
                                        //this will be single set
                                        text += iterateOverNodeSet(xxxx,set);


                                        if (element.myMeta && element.myMeta.isExtension) {
                                            //a complex extension at level 3 MUST be against a specific element (ie it isn't against the root of the resource...
                                            var complexExtension = createComplexExtension(element,set)
                                        } else {
                                            resource[l2name][pageInx][l3name] = xxxx;
                                        }

                                    });


                                    break;
                                default:
                                    alert("Sorry! This resource has a structure I cannot process at path " + path + " , and your data will not be saved. Please contact the author.");
                                    break;

                            }


                        } else {
                            //this is for elements that are objects rather than arrays (eg Careplan.activity.detail
                            if (debug) { console.log(element.path,'object',ar.length)}
                            switch (ar.length) {
                                case 1 :
                                    //this is the main root. The insertion point is the actual resource
                                    text += iterateOverNodeSet(insertionPoint,element.value);
                                    break;
                                case 2:

                                    //example is a complex extension on patient.communication...
                                    //?? need to check for simple as well, or will that be handled diferently....
                                    // console.log(element)
                                    if (element.myMeta && element.myMeta.isExtension) {
                                        //a complex extension at level 3 MUST be against a specific element (ie it isn't against the root of the resource...
                                        var complexExtension = createComplexExtension(element,element.value);
                                        console.log(complexExtension)
                                        resource.extension = resource.extension || []
                                        resource.extension.push(complexExtension);


                                    } else {

                                    }


                                    //don't think there are any at this level right now...
                                    break;
                                case 3 :
                                    //this is like Careplan.activity.detail - which has only a single value
                                    //or a complex extesnion on a level 2 property...
                                    var node = {};
                                    var l2name = ar[1];     //eg activity
                                    var l3name = ar[2];     //eg detail
                                    if (! resource[l2name]) {
                                        resource[l2name] = [];     //assume that all l2 expansion are multiple...

                                    }



                                    if (isEmpty(resource[l2name])) {
                                        //if (resource[l2name].length == 0) {
                                        var t = {};
                                        t[l3name] = {};
                                        resource[l2name].push(t)
                                    }

                                    console.log(resource[l2name][l3name]);

                                    //http://stackoverflow.com/questions/20424226/easy-way-to-set-javascript-object-multilevel-property


                                    var xx = {};

                                    text += iterateOverNodeSet(xx,element.value);

                                    if (element.myMeta && element.myMeta.isExtension) {
                                        //a complex extension at level 3 MUST be against a specific element (ie it isn't against the root of the resource...

                                        //this assumes a complex extension...
                                        var complexExtension = createComplexExtension(element,element.value)


                                        var extensionName = '_'+l2name;
                                        // if (! )

                                        if (! resource[l2name].extension) {
                                            resource[l2name].extension = [];
                                        }
                                        //because the extension itself adds a level - so we go back 1 to the 'real' parent.
                                        resource[l2name].extension.push(complexExtension);

                                        /*
                                         console.log(complexExtension)


                                         if (! resource[l2name][l3name]) {
                                         resource[l2name][l3name] = {};
                                         }


                                         if (! resource[l2name][l3name].extension) {
                                         resource[l2name][l3name].extension = [];
                                         }

                                         resource[l2name][l3name].extension.push(complexExtension);

                                         */

                                    } else {
                                        resource[l2name][0][l3name] = xx;
                                    }





                                    break;
                                default:
                                    alert("Sorry! This resource has a structure I cannot process at path " + path + " , and your data will not be saved. Please contact the author.");
                                    break;
                            }

                        }
                    }
                });



                //set metadata

                if (SD.constrainedType) {
                    //this is a profile
                    resource.meta.profile = [SD.url]
                }

                //check for a patient reference in the resource (if a patient has been supplied

                if (patient) {
                    for (var i=0; i<SD.snapshot.element.length-1;i++) {
                        var element = SD.snapshot.element[i];
                        if (element.path) {
                            var ar = element.path.split('.');
                            if (ar[1] == 'patient' && !resource['patient']) {       //always attached to the root...
                                var reference = {reference: "Patient/" + patient.id};
                                reference.display =  ResourceUtilsSvc.getOneLineSummaryOfResource(patient);
                                resource['patient'] = reference;
                                break;
                            }

                            //todo - there willbe a more elegant way of doing this...
                            if (ar[1] == 'subject' && !resource['subject']) {       //always attached to the root...
                                var reference = {reference: "Patient/" + patient.id};
                                reference.display = ResourceUtilsSvc.getOneLineSummaryOfResource(patient);
                                resource['subject'] = reference;
                                break;
                            }


                        }

                    }
                }




                //set the text node

                var enteredText = SD.snapshot.element[0].valueNarrative;    //text entered by the user...
                if (enteredText) {
                    //mark off the user entered text
                    resource['text'] = {status:'additional',div:"<div><div id='userEntered'>"+
                    htmlEscape(enteredText)+"</div>"+  text + "</div>"}


                } else {
                    //there was no user entered text
                    if (text){
                        resource['text'] = {status:'generated',div: "<div>" + text + "</div>"}
                    } else {
                        //there is no text
                        delete resource.text;
                    }

                }

            }


            //remove the extension element if empty...
            if ( resource && resource.extension && resource.extension.length == 0) {
                delete resource.extension;
            }

            return resource;
            //create a complete, but empty skeleton

        },
        getResourceTypeDefinition : function(resourceType) {
            //this is needed so we can distinguish between 'reference' resources that don't have a patient reference from those that do...

            for (var i=0;i<standardResourceTypes.length;i++) {
                if (standardResourceTypes[i].name == resourceType) {
                    return standardResourceTypes[i];
                    break;
                }
            }



           // return standardResourceTypes[resourceType]
        },

        isUrlaBaseResource : function(profileTypeUrl) {
            //used to determine if the resource being referenced is a base one or a profiled one.
            //used in showing existing resources of a given type.
            //profileUrl will be like: http://hl7.org/fhir/StructureDefinition/Patient
            //console.log(standardResourceTypes);
            var ar = profileTypeUrl.split('/');
            var resourceType = ar[ar.length-1];       //the actual type of resource being referenced...


            //this is used when a resource can reference any other...
            if (resourceType == 'Resource' || resourceType == 'Patient') {
                return true;
            }
            //standardResourceTypes is an array of objects {name: }. A hash might be more efficient...


            var isBaseType = false;
            for (var i=0; i< standardResourceTypes.length;i++) {
                if (standardResourceTypes[i].name==resourceType) {
                    return true;
                    break;
                }
            }


            return false;

        },
        getResourcesSelectListOfType :function(allResources, resourceType, profileUrl) {
            //return an array of the patients resources of the given type - used for displaying a list of resoruces for
            // a user to select from. If a profileUrl is passed in
            //then include resources that claim confirmance to that profile...
            //allResources is a dictionary of bundles, indexed by type...

            var bundle = allResources[resourceType];
            if (!bundle || !bundle.entry) {
                return [];      //the patient has no resources of this type...
            }


            var lst = [];

            bundle.entry.forEach(function (entry) {
                var display = getDisplay(entry.resource,resourceType);
                if (profileUrl) {
                    //if (isProfile) {
                    if (entry.resource.meta && entry.resource.meta.profile) {   //if the resource has a profile declaration
                        var profiles = entry.resource.meta.profile;
                        for (var i=0; i<profiles.length;i++ ){      //iterate through each profile on the resource
                            var profile = profiles[i];          //a profile this resource claims conformance to

                            //if (profile.indexOf(resourceType) > -1) {
                            if (profile == profileUrl) {
                                var display = getDisplay(entry.resource,resourceType);
                                lst.push({
                                    resource: entry.resource,       //<<---- think I still want the actual resource type here
                                    display: display
                                });
                                break;
                            }
                        }
                    }
                } else {

                    lst.push({
                        resource: entry.resource,
                        display: display
                    });

                }

            });

            return lst;

            function getDisplay(resource,searchType) {
                var display = ResourceUtilsSvc.getOneLineSummaryOfResource(resource);
                if (searchType == 'Resource') {
                    display = resource.resourceType + ":" + display;
                }
                return display;
            }

        },
        getUniqueResources : function(allResources) {
            // generate a list of all the resource types a patient has, and the count of each
            // note that allResources is an object, keyed by type containing a bundle of the resources...
            var ar = [];
            angular.forEach(allResources,function(bundle,type){
                 if (bundle.entry) {
                     ar.push({key:type,display : type + ' (' + bundle.entry.length + ')'})
                 }

            });

/*
            var unique = {};
            if (allResources && allResources.entry) {
                allResources.entry.forEach(function (entry) {
                    var typ = entry.resource.resourceType;
                    unique[typ] = unique[typ] || 0;
                    unique[typ]++;
                });
            }
            var ar = [];
            angular.forEach(unique,function(v,k){
                ar.push({key:k,display : k + ' (' + v + ')'})
            });
*/
            return ar;

            //alert('getUniqueResources stub not implemented yet');
        },
        populateTimingList :function (){
            //common timings for medication
            var lst = [];

            lst.push({description:"Twice a day",timing :{freq:2,period:1,periodUnits:'d'}});
            lst.push({description:"Three times a day",timing :{freq:3,period:1,periodUnits:'d'}});

            lst.push({description:"Every 8 hours",timing:{freq:1,period:8,periodUnits:'h'}});
            lst.push({description:"Every 7 days",timing:{freq:1,period:7,periodUnits:'d'}});
            lst.push({description:"3-4 times a day",timing:{freq:3,freqMax:4,period:1,periodUnits:'d'}});
            lst.push({description:"Every 4-6 hours",timing:{freq:1,periodMax:6,period:1,periodUnits:'h'}});
            lst.push({description:"Every 21 days for 1 hour",timing:{duration:1,units:'h',freq:1,period:21,periodUnits:'d'}});


            return lst;
        },
        getValueSetUriFromBinding : function(element){
            //find the reference to the valueset..
            //todo - need to figure out what to do with uri
            if (element && element.binding && element.binding.valueSetUri) {
                return element.binding.valueSetUri;

            } else {
                return null;
            }


        },
        getValueSetReferenceFromBinding : function(element){
            //find the reference to the valueset..
            //todo - need to figure out what to do with uri
            if (element && element.binding && element.binding.valueSetReference) {
                return element.binding.valueSetReference;

            } else {
                return null;
            }


        }

    }
})
    .service('ResourceUtilsSvc', function(appConfigSvc) {
    function getPeriodSummary(data) {
        if (!data) {
            return "";
        }
        var txt = "";
        if (data.start) {txt += moment(data.start).format('YYYY-MM-DD') + " "}
        if (data.end) {txt += "-> " + moment(data.end).format('YYYY-MM-DD')}
        return txt;
    }

        //updated when doing the list builder
    function getCCSummary(data) {
        if (!data) {
            return "";
        }
        var txt = "";

        if (data.text) {
            return data.text;
        } else {
            if (data.coding && data.coding.length > 0) {
                //if (data.text) {txt += data.text + " ";}
                var c = data.coding[0];     //only look at the first one...
                var d = c.display || '';
                txt += d + " ["+ c.code + "]";

            }
            return txt;
        }
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
                if (angular.isArray(ar)) {      //make sure it's an array. eh humanname isn't...
                    ar.forEach(function(el){
                        lne += el + " ";
                    } )
                } else {
                    lne += ar + " ";
                }



            }
            return lne;
        }
    }

    return {
        getTextSummaryOfDataType : function(dt,value) {
            //a single line summary of a datatype (started for questionnaire
            //console.log(dt,value)

            var vo = {summary:"",detail:""}
            switch (dt) {
                case "Reference" :
                    vo.detail = value.display;
                    vo.detail += " (";
                    addIfNotEmpty(vo.detail,value.reference);
                    addIfNotEmpty(vo.detail,value.identifier);
                    vo.detail += ")";
                    break;

                case "Identifier" :
                    vo.summary = value.value
                    if (value.system) {
                        vo.summary += " ("+value.system+")"
                    }
                    vo.detail = vo.summary
                    break;
                case "CodeableConcept" :
                    if (value.text) {vo.summary = value.text; vo.detail = value.text;};
                    if (value.coding) {
                        value.coding.forEach(function (coding) {
                            vo.detail += coding.display + " (" + coding.system + "|"+coding.code +")";
                            if (!vo.summary) {
                                vo.summary = coding.display;
                            }
                        })
                        if (value.text) { vo.detail += value.text};

                    }

                    break;
                case "Quantity":
                    vo.summary =value.value;
                    var t = value.unit;
                    if (t) {vo.summary += " " + t}
                    vo.detail = vo.summary;
                    break;
                case "code" :
                case "string" :
                case "dateTime":
                case "Annotation":
                case "instant":
                    vo.summary = value;
                    vo.detail = value;
                    break;
                case "Narrative" :
                    vo.summary = value.div;
                    vo.detail = value.div;
                    break;
                default :
                    vo.summary = value;
                    vo.detail = value;
                    break
            }
            return vo;

            function addIfNotEmpty(targ,string) {
                if (string !== undefined) {
                    targ += string + " "
                }
            }
        },
        getCCSummary : function(data) {
            //being able to summarize a codeableconcept is useful. todo - refactor to use this...
            if (!data) {
                return "";
            }
            var txt = "";

            if (data.text) {
                return data.text;
            } else {
                if (data.coding && data.coding.length > 0) {
                    //if (data.text) {txt += data.text + " ";}
                    var c = data.coding[0];     //only look at the first one...
                    var d = c.display || '';
                    txt += d;// + " ["+ c.code + "]";

                }
                return txt;
            }
        },
        getOneLineSummaryOfResource : function(resource,extend) {

            var fhirVersion = appConfigSvc.getCurrentFhirVersion(); //defaults to 3 unless both data and conformance servers are on 2...

            if (resource) {
                switch (resource.resourceType) {
                    case  "MedicationRequest":
                    case  "MedicationStatement":
                    case  "MedicationOrder":
                        var txt = "";
                        if (resource.medicationCodeableConcept) {
                            txt +=  getCCSummary(resource.medicationCodeableConcept);
                        } else if (resource.medicationReference && resource.medicationReference.display) {

                            txt = resource.medicationReference.display;
                        } else {
                            txt =  resource.resourceType;
                        }




                        return txt;
                        break;
                    case  "Immunization":
                        if (resource.vaccineCode) {
                            return getCCSummary(resource.vaccineCode);
                        } else {
                            return resource.resourceType;
                        }
                        break;
                    case "StructureDefinition" :
                    case "ValueSet":
                    case "NamingSystem" :
                    case "CodeSystem" :

                        return resource.name || resource.description || resource.resourceType
                    case "MedicationStatement" :
                        var txt="";
                        if (resource.medicationCodeableConcept) {
                            txt += getCCSummary(resource.medicationCodeableConcept);

                        } else if (resource.medicationReference && resource.medicationReference.display ) {
                            txt += resource.medicationReference.display;
                        }

                        if (resource.dosage && resource.dosage.length > 0 && resource.dosage[0].text) {
                            txt += " "+ resource.dosage[0].text
                        }


                        txt = txt ||  "MedicationStatement";
                        return txt;
                        break;
                    case "FamilyMemberHistory" :
                        if (resource.relationship) {
                            return getCCSummary(resource.relationship);

                        } else {
                            return "FamilyMemberHistory Id: "+resource.id;
                        }
                        break;
                    case "List" :
                        if (resource.code) {
                            return getCCSummary(resource.code);

                        } else {
                            return "List Id: "+resource.id;
                        }
                        break;
                    case "DiagnosticOrder":
                        if (resource.reason) {
                            return getCCSummary(resource.reason[0]);
                        } else {
                            return resource.resourceType;
                        }
                        break;
                    case "AllergyIntolerance" :
                        if (fhirVersion == 3) {
                            return getCCSummary(resource.code);
                         } else {
                            return getCCSummary(resource.substance);
                        }

                        break;
                    case "Practitioner" :
                        if (resource.name) {
                            if (fhirVersion == 3) {
                                return getHumanNameSummary(resource.name[0]);
                            } else {
                                return getHumanNameSummary(resource.name);
                            }
                        } else {
                            return 'Practitioner';
                        }


                        break;
                    case "Patient" :
                        if (resource.name) {
                            var smry = getHumanNameSummary(resource.name[0])
                            smry += " "+ resource.gender;
                            smry += " "+ resource.birthDate;

                            return smry;   //only the forst name
                        } else {
                            return 'Patient';
                        }
                        break;
                    case "List" :
                        if (resource.code) {
                            return getCCSummary(resource.code);
                        } else {
                            return "List"
                        }
                        break;
                    case "Encounter" :
                        if (resource.period) {
                            return getPeriodSummary(resource.period);

                        } else {
                            return 'Encounter';
                        }
                        break;
                    case 'Observation' :
                        var summary = resource.id;
                        if (resource.code) {
                            if (resource.code.text) {
                                summary = resource.code.text;
                            } else if (resource.code.coding) {
                                summary = resource.code.coding[0].code;
                            }
                        }

                        if (resource.effectiveDateTime) {
                            summary = resource.effectiveDateTime.substr(0, 10) + " " + summary;
                        }

                        if (resource.valueString) {
                            summary += ": " + resource.valueString.substr(0, 50);
                        }

                        if (resource.valueQuantity) {
                            summary += ": " + resource.valueQuantity.value + " " +resource.valueQuantity.unit;
                        }

                        if (resource.appliesDateTime) {
                            summary = resource.appliesDateTime + " " + summary;
                        }


                        return summary;


                        break;
                    case 'Condition' :
                        if (resource.code) {
                            return getCCSummary(resource.code);

                        } else {
                            return resource.resourceType;
                        }
                        break;
                    case 'Procedure' :
                        if (resource.code) {
                            return getCCSummary(resource.code);

                        } else {
                            return resource.resourceType;
                        }
                        break;
                    case 'CarePlan' :
                        if (resource.description) {
                            return resource.description;

                        } else {
                            return resource.resourceType;
                        }
                        break;
                    default :
                        return resource.resourceType;
                        break;
                }

            }
        }
    }
});



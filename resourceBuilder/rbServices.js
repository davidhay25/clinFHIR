/* These are all the services called by renderProfile */

angular.module("sampleApp")
    //this returns config options. todo: have a user selection with storace in browser cache...
    .service('appConfigDEP', function() {
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
            }
        }
    }).
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
        saveResource : function(resource) {
            var deferred = $q.defer();
            //alert('saving:\n'+angular.toJson(resource));
            //var config = appConfigSvc.config();
            var qry = appConfigSvc.getCurrentDataServerBase() + resource.resourceType;
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


            return deferred.promise;
        },
        sendActivityObject : function(activity) {

        }
    }

}).service('GetDataFromServer', function($http,$q,appConfigSvc,Utilities) {
    return {
        getValueSet : function(ref,cb) {
            var deferred = $q.defer();
            Utilities.getValueSetIdFromRegistry(ref,function(resp){
                if (resp) {
                    deferred.resolve(resp.resource);
                } else {
                    alert('Unable to load ValueSet: '+ ref);
                    deferred.reject();
                }

            });
            return deferred.promise;
        },
        getProfile : function(profileName) {
            alert('getProfile stub not implemented yet');
        },
        getExpandedValueSet : function(id) {
            //return an expanded valueset. Used by renderProfile Should only use for valuesets that aren't too large...
            //takes the Id of the valueset on the terminology server - not the url...
            var deferred = $q.defer();
            var config = appConfigSvc.config();
            var qry = config.servers.terminology + "ValueSet/"+id + "/$expand";

            $http.get(qry).then(
                function(data){
                    deferred.resolve(data.data);
                },function(err){
                    alert('error expanding ValueSet\n'+angular.toJson(err));
                }
            );
            return deferred.promise;
        },
        findResourceByUrl : function(type,profile,cb) {
            alert('findResourceByUrl stub not implemented yet');
        },
        getFilteredValueSet : function(name,filter){
            //return a filtered selection from a valueset. Uses the $expand operation on grahames server...
            var config = appConfigSvc.config();
            var qry = config.servers.terminology + "ValueSet/"+name+"/$expand?filter="+filter;



            var deferred = $q.defer();
            $http.get(qry)
                .success(function(data) {
                    deferred.resolve(data);
                }).error(function(oo, statusCode) {

                //an error expanding the valueset - save the error...
                var myEvent = {type:'expandValueSet'};   //this is an audit event
                myEvent.error = true;
                myEvent.display = "Error expanding "+name+ " valueset";
                //this is the query that the server will have used...
                var currentSettings
                var serverQuery = Utilities.getCurrentSettings().registryServer.server + "ValueSet/"+name;
                myEvent.data = {url:serverQuery,outcome:oo};

                myEvent.error = true;
                SaveDataToServer.sendActivityObject(myEvent);


                deferred.reject({error:Utilities.getOOText(oo),statusCode:statusCode});
            });
            return deferred.promise;




        }
    }


}).service('Utilities', function($http,$q,$localStorage,appConfigSvc) {
    return {
        validate : function(resource,cb) {
            var deferred = $q.defer();

            var clone = angular.copy(resource);
            delete clone.localMeta;

            var qry = appConfigSvc.getCurrentDataServerBase() + resource.resourceType + "/$validate";
            console.log(qry)
            $http.post(qry, clone).then(
                function(data) {
                    deferred.resolve(data);
                },
                function(err) {
                    //alert("errr calling validate operation:\n"+angular.toJson(err))
                    deferred.reject(err.data);
                }
            );

            return deferred.promise;
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
        getUCUMUnits : function(unit) {
            alert('getUcumUnits stub not implemented yet');
        },
        getValueSetIdFromRegistry : function(uri,cb) {
            //return the id of the ValueSet on the terminology server. For now, assume at the VS is on the terminology.
            var config = appConfigSvc.config();
            var qry = config.servers.terminology + "ValueSet?url=" + uri;
            var that = this;

            $http.get(qry).then(
                function(data) {
                    var bundle = data.data;
                    if (bundle && bundle.entry && bundle.entry.length > 0) {

                        if (bundle.entry.length >1) {
                            alert('The terminology server has multiple ValueSets with a URL property (in the resource) of '+uri +". I'll use the first one, but you might want to contact the registry owner and let them know.");
                        }

                        var id = bundle.entry[0].resource.id;   //the id of the velueset in the registry
                        var resp = {id: id,minLength:3}         //response object
                        resp.resource = bundle.entry[0].resource;

                        //ValueSets with a small size that can be rendered in a set of radio buttons.
                        // lookup from a fixed lis of ValueSetst. has to be this way as we will subsequently (in renderProfile)
                        //get the full expansion without filtering...
                        if (that.isVSaList(uri)) {
                            resp.type='list';
                        }
                        cb(resp);
                    } else {
                        alert('There is no ValueSet with a url of '+ uri + ' on the terminology server');
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
            vsLookup['condition-status'] = {id:'condition-status',minLength:1,type:'list'};
            vsLookup['administrative-gender'] = {id:'administrative-gender',minLength:1,type:'list'};
            vsLookup['reason-medication-not-given-codes'] = {type:'list'};
            vsLookup['care-plan-activity-category'] = {type:'list'};
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
        }
    }
}).service('RenderProfileSvc', function($http,$q,Utilities,ResourceUtilsSvc) {

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
            }

            return deferred.promise;
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
                            var urlToExtensionDefinition = element.type[0].profile[0];
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
                                        var urlToExtensionDefinition = element.type[0].profile[0];
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
                                                    newEl.extensionUrl = element.type[0].profile[0];   //save the url...
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
            return standardResourceTypes[resourceType]
        },

        isUrlaBaseResource : function(profileTypeUrl) {
            //used to determine if the resource being referenced is a base one or a profiled one.
            //used in showing existing resources of a given type.
            //profileUrl will be like: http://hl7.org/fhir/StructureDefinition/Patient
            //console.log(standardResourceTypes);
            var ar = profileTypeUrl.split('/');
            var resourceType = ar[ar.length-1];       //the actual type of resource being referenced...

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
            if (!bundle) {
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
            alert('getUniqueResources stub not implemented yet');
        },
        populateTimingList :function (){
            //common timings for medication
            var lst = [];

            lst.push({description:"Twice a day",timing :{freq:2,period:1,units:'d'}});
            lst.push({description:"Three times a day",timing :{freq:3,period:1,units:'d'}});

            lst.push({description:"Every 8 hours",timing:{freq:1,period:8,units:'h'}});
            lst.push({description:"Every 7 days",timing:{freq:1,period:7,units:'d'}});
            lst.push({description:"3-4 times a day",timing:{freq:3,freqMax:4,period:1,units:'d'}});
            lst.push({description:"Every 4-6 hours",timing:{freq:1,periodMax:6,period:1,units:'h'}});
            lst.push({description:"Every 21 days for 1 hour",timing:{duration:1,units:'h',freq:1,period:21,units:'d'}});


            return lst;
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
}).service('ResourceUtilsSvc', function() {
    function getPeriodSummary(data) {
        if (!data) {
            return "";
        }
        var txt = "";
        if (data.start) {txt += moment(data.start).format('YYYY-MM-DD') + " "}
        if (data.end) {txt += "-> " + moment(data.end).format('YYYY-MM-DD')}
        return txt;
    }

    function getCCSummary(data) {
        if (!data) {
            return "";
        }
        var txt = "";
        if (data.coding && data.coding.length > 0) {
            if (data.text) {txt += data.text + " ";}
            var c = data.coding[0];
            var d = c.display || '';
            txt += d + " ["+ c.code + "]";

        } else {
            txt += data.text;
        }
        return txt;
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

    return {
        getOneLineSummaryOfResource : function(resource) {
            switch (resource.resourceType) {
                case "DiagnosticOrder":
                    if (resource.reason) {
                        return getCCSummary(resource.reason[0]);
                    } else {
                        return resource.resourceType;
                    }
                    break;
                case "AllergyIntolerance" :
                    return getCCSummary(resource.substance);
                    break;
                case "Practitioner" :
                    return getHumanNameSummary(resource.name);
                    break;
                case "Patient" :
                    return getHumanNameSummary(resource.name[0]);
                    break;
                case "List" :
                    if (resource.code) {
                        return getCCSummary(resource.code);
                    } else {return "List"}
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

                    if (resource.valueString) {
                        summary += ": " + resource.valueString.substr(0,50) ;
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
                default :
                    return resource.resourceType;
                    break;
            }
        }
    }
})



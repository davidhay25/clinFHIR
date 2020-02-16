angular.module("sampleApp")

    .service('nzigsSvc', function($q,$http,$filter,moment) {

        let serverUrl = "http://home.clinfhir.com:8054/baseR4/";
        let termServerUrl = "https://ontoserver.csiro.au/stu3-latest/";


        let extIGEntryType = "http://clinfhir.com/StructureDefinition/igEntryType";
        let extIGMoreInfo = "http://clinfhir.com/StructureDefinition/igMoreInfo";
        let extModelBaseType = "http://clinfhir.com/fhir/StructureDefinition/baseTypeForModel";
        let extProfileForLM = "http://clinfhir.com/fhir/StructureDefinition/profileForLM";
        let extExtensionUrl = "http://clinfhir.com/fhir/StructureDefinition/simpleExtensionUrl";
        let extFSHUrl = "http://clinfhir.com/fhir/StructureDefinition/fshUrl";
        let extCanUrl = "http://clinfhir.com/fhir/StructureDefinition/canonicalUrl";

        let docKey = "http://clinfhir.com/StructureDefinition/docKey";

       // var pathExtUrl = appConfigSvc.config().standardExtensionUrl.path;

        //get the value of a single extension
        function getExtension(resource, url) {
            let ar = [];        //return an array of values...
            if (resource.extension) {
                resource.extension.forEach(function (ext) {
                    if (ext.url == url) {
                        ar.push(ext)
                    }
                })
            }
            return ar;
        }


        function performQueryFollowingPaging(url, limit) {
            //Get all the resurces specified by a query, following any paging...
            //http://stackoverflow.com/questions/28549164/how-can-i-do-pagination-with-bluebird-promises

            var returnBundle = {total: 0, type: 'searchset', link: [], entry: []};
            returnBundle.link.push({relation: 'self', url: url})

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
                    function (data) {
                        var bundle = data.data;     //the response is a bundle...

                        //copy all resources into the array..
                        if (bundle && bundle.entry) {
                            bundle.entry.forEach(function (e) {
                                returnBundle.entry.push(e);
                            })
                        }

                        //is there a link
                        if (bundle.link) {
                            var moreToGet = false;
                            for (var i = 0; i < bundle.link.length; i++) {
                                var lnk = bundle.link[i];

                                //if there is a 'next' link and we're not at the limit then get the next page
                                if (lnk.relation == 'next') {// && returnBundle.entry.length < limit) {
                                    moreToGet = true;
                                    var url = lnk.url;
                                    getPage(url);
                                    break;
                                }
                            }

                            //all done, return...
                            if (!moreToGet) {
                                deferred.resolve(returnBundle);
                            }
                        } else {
                            deferred.resolve(returnBundle);
                        }
                    },
                    function (err) {
                        deferred.reject(err);
                    }
                )
            }

            return deferred.promise;

        }

        let hashResource = {}

        //get a resource based on its url (to the resource NOT the canonical url)
        function getResourceAsync(url) {
            let deferred = $q.defer();
            if (hashResource[url]) {
                deferred.resolve(hashResource[url])
            } else {
                let fullUrl = serverUrl + url;
                $http.get(fullUrl).then(
                    function (data) {
                        hashResource[url] = data.data;
                        deferred.resolve(hashResource[url])
                    },
                    function (err) {
                        deferred.reject(err.data);
                    }
                )
            }

            return deferred.promise

        }

        function getConformanceResourceByCanUrlDEP(canUrl, type) {
            //get a  conformance resource based on the type and canonical url. cached.
            //todo refactor to include getTerminologyResourceByCanUrl
            type = type || "StructureDefinition";
            let deferred = $q.defer();
            if (confCache[canUrl]) {
                deferred.resolve(confCache[canUrl])
            } else {
                let url = serverUrl + type + "?url=" + canUrl;
                $http.get(url).then(
                    function (data) {
                        if (data.data && data.data.entry && data.data.entry.length > 0) {
                            let resource = data.data.entry[0].resource;
                            confCache[canUrl] = resource;
                            deferred.resolve(confCache[canUrl])

                        } else {
                            deferred.reject({msg: "Resource not found"})
                        }
                    },
                    function (err) {
                        deferred.reject(err)
                    }
                )
            }
            return deferred.promise;

        }

        function localGetMostRecentResourceByCanUrl(url,type) {
            let deferred = $q.defer();
            cache[type] = cache[type] || {};
            let typeCache = cache[type];       //local reference to the cache for this type
            if (typeCache[url]) {
                deferred.resolve({resource:typeCache[url]})
                console.log('cache hit: '+ url);
                return deferred.promise;
            }

            $http.get(url).then(
                function (data) {
                    let vo = {}
                    let bundle = data.data;
                    if (bundle && bundle.entry) {

                        if (bundle.entry.length == 0 ) {

                            deferred.resolve({err : "There were no resources found"});

                            return;
                        }

                        if (bundle.entry.length ==1 ) {
                            typeCache[url] = bundle.entry[0].resource;
                            deferred.resolve({resource:bundle.entry[0].resource})
                            return;
                        }
                        //there must be more than one. Find the most recent...

                        let lastDiff = 0
                        bundle.entry.forEach(function (entry) {
                            let resource = entry.resource;



                            if (resource && resource.meta && resource.meta.lastUpdated) {
                                // let diff = moment().diff(resource.meta.lastUpdated,'minutes');
                                let diff = moment(resource.meta.lastUpdated).diff();
                                if (diff)

                                    console.log(resource.meta.lastUpdated,diff)
                            }
                            vo.resource = resource
                            //confCache[canUrl] = resource;
                        });


                        if (bundle.entry.length > 1) {
                            vo.err = "There were " + bundle.entry.length + " resources found. Using most recent";
                        }

                        typeCache[url] = vo.resource;
                        deferred.resolve(vo)

                    } else {
                        deferred.resolve({err: "Resource not found"})
                    }
                },
                function (err) {
                    deferred.reject(err)
                }
            )

            return deferred.promise;


        }

        //let extensionCache = {};

        let cache = {};     //cache all resources = cache[type][url]

        return {

            getCacheContents : function(type) {
                return cache[type]
            },

            getMostRecentResourceByCanUrl : function(url,type) {
                return localGetMostRecentResourceByCanUrl(url,type);

                /*
                let deferred = $q.defer();
                cache[type] = cache[type] || {};
                let typeCache = cache[type];       //local reference to the cache for this type
                if (typeCache[url]) {
                    deferred.resolve({resource:typeCache[url]})
                    console.log('cache hit: '+ url);
                    return;
                }

                $http.get(url).then(
                    function (data) {
                        let vo = {}
                        let bundle = data.data;
                        if (bundle && bundle.entry) {

                            if (bundle.entry.length == 0 ) {

                                deferred.resolve({err : "There were no resources found"});

                                return;
                            }

                            if (bundle.entry.length ==1 ) {
                                    typeCache[url] = bundle.entry[0].resource;
                                    deferred.resolve({resource:bundle.entry[0].resource})
                                return;
                            }
                            //there must be more than one. Find the most recent...

                            let lastDiff = 0
                            bundle.entry.forEach(function (entry) {
                                let resource = entry.resource;



                                if (resource && resource.meta && resource.meta.lastUpdated) {
                                   // let diff = moment().diff(resource.meta.lastUpdated,'minutes');
                                    let diff = moment(resource.meta.lastUpdated).diff();
                                    if (diff)

                                    console.log(resource.meta.lastUpdated,diff)
                                }
                                vo.resource = resource
                                //confCache[canUrl] = resource;
                            });


                            if (bundle.entry.length > 1) {
                                vo.err = "There were " + bundle.entry.length + " resources found. Using most recent";
                            }

                            typeCache[url] = vo.resource;
                            deferred.resolve(vo)

                        } else {
                            deferred.resolve({err: "Resource not found"})
                        }
                    },
                    function (err) {
                        deferred.reject(err)
                    }
                )

                return deferred.promise;
*/

            },

            getProfiles : function() {
                //to avoid having to read all the IGs, the summary document is assembled - via a separate script from those resources.
                return $http.get("content/nhip/nzigs.json");

            },

            makeProfilesGraph : function(profiles) {
                //create a graph with all the profiles and their interdependencies
                let arNodes = [], arEdges = [], hashNodes = {}, errors = [];

                //create a node for each profile
                profiles.forEach(function(profile,inx) {

                    let node = {id: inx, label: profile.name,
                        shape: 'box',profile:profile};

                    if (profile.url && profile.url.indexOf('hl7.org/fhir')> -1) {
                        node.color = '#ff6600'
                    }

                   // if (profile.node && profile.node.colour) {
                     //   node.color = profile.node.colour
                   // }

                    arNodes.push(node);

                    if (hashNodes[profile.name]) {
                        errors.push(profile.name + " is a duplicated profile name")
                    }
                    hashNodes[profile.name] = node

                });

                //now create the edges from the dependencies.
                arNodes.forEach(function (node) {
                    if (node.profile.baseProfile) {
                        let targetNode = hashNodes[node.profile.baseProfile];
                        if (targetNode) {
                            let label = ""; //'Depends On'

                            arEdges.push({id: 'e' + arEdges.length +1,from: node.id, to: targetNode.id, label: label,arrows : {to:true}})
                        } else {
                            errors.push("dependant profile: "+ node.profile.baseProfile + " not found. Referred to from "+ node.profile.name)
                        }

                    }
                });

                let vo = {};
                vo.nodes = new vis.DataSet(arNodes);
                vo.edges = new vis.DataSet(arEdges);
                return {graphData : vo, errors:errors}


            },

            //get all the IGs...
            getIGs: function () {
                let igs = [];
                igs.push({name:"Ipa",url:'Ipa',description:"The international patient access IG"})
                igs.push({name:"NzMeds",url:'NzMeds',description:"Access to medications information captures through NzEPS"})

            },
            makeLogicalModel : function(vo) {
                let that = this;
                let SD = vo.SD;
                let confServer = vo.confServer;
                let deferred = $q.defer();

                let elementsToIgnore = ['id', 'meta', 'implicitRules', 'language', 'contained'];

                let baseType = SD.snapshot.element[0].path;
                let rootName = 'myResource';
                //let vo ={rootName:rootName,baseType:baseType};
                let queries = [];       //these will be extensions to de-compose...
                let excluded = [];      //elements excluded by setting max to 0

                var newElementArray = [];
                SD.snapshot.element.forEach(function (el) {
                    let item = {};
                    item.ed = el;
                    item.path = $filter('dropFirstInPath')(el.path)
                    item.description = el.short || el.definition ;

                    let include = true;
                    let arPath = el.path.split('.');

                    if (elementsToIgnore.indexOf(arPath[arPath.length-1]) !== -1) {
                        include = false;
                    }

                    if ( el.path.indexOf('xtension') > -1) {
                        if (el.type) {
                            el.type.forEach(function (typ) {
                                if (typ.profile) {

                                    //stu2/3 difference
                                    let profile = typ.profile
                                    if (angular.isArray(typ.profile)) {
                                        profile = typ.profile[0]
                                    }
                                    item.description = profile;
                                    queries.push(checkExtensionDef(profile, item));
                                } else {
                                    //no profile, don't include
                                    include = false;
                                }

                            })
                        }
                    } else {
                        //when slicing - not for an extension
                        if (el.sliceName) {
                            item.description = el.sliceName + " " + item.description;
                        }
                    }

                    
                    if (el.slicing) {
                        //don't show the discriminator element
                        include = false;
                    }

                    //if max is 0 (or any of the parents) then don't include
                    if (el.max == '0') {
                        excluded.push(el.path)
                        include = false;
                    }

                    //check is any of the parents have
                    excluded.forEach(function(excl){
                        if (el.path.indexOf(excl)> -1) {
                            include = false;
                        }
                    })


                    if (include) {
                        newElementArray.push(item);
                    }

                });

                $q.all(queries).then(
                    function () {
                        deferred.resolve(newElementArray);
                    },
                    function (err) {
                        console.log('ERROR: ', err)
                        deferred.reject({allElements:newElementArray,err:err});
                    }
                );


                SD.snapshot.element = newElementArray;
                return deferred.promise;
                //==============================================

                //retrieve the Extension Definition to populate child nodes
                function checkExtensionDef(extUrl, item) {
                    console.log('checking '+ extUrl)
                    var deferred = $q.defer();
                    let qry = confServer + "StructureDefinition?url=" + extUrl;

                    item.children = item.children || []

                    localGetMostRecentResourceByCanUrl(qry,'extension').then(
                        function(vo) {
                            let extensionDef = vo.resource;     //should really only be one...
                            if (! extensionDef) {
                                item.err = "Extension definition not found"
                                deferred.resolve();
                                return;
                            }

                            item.description = extensionDef.description;

                            //console.log(extensionDef)
                            if (extensionDef && extensionDef.snapshot && extensionDef.snapshot.element) {
                                //item.children = item.children || []
                                let isComplex = false;  //will be complex
                                extensionDef.snapshot.element.forEach(function (ed) {
                                    //the path ending in .url has the name in fixedUri
                                    if (ed.path == 'Extension.extension' && ! ed.slicing && ed.sliceName) {
                                        item.children.push(angular.copy(ed))
                                    }

                                   // if (ed.path.substr(-4,4) == '.url') {
                                   //     item.children.push(angular.copy(ed))
                                  //  }

/*
                                    if (ed.sliceName) {
                                        console.log(ed);
                                        item.children.push(angular.copy(ed))
                                    }
                                    */
                                })
                            }

                            if (vo.err) {
                                item.err = vo.err
                                //item.children.push({err:vo.err});
                            }

                            deferred.resolve();
                        }
                    );




/*
                    $http.get(url).then(
                        function (data) {
                            var bundle = data.data;
                            if (bundle && bundle.entry) {
                                if (bundle.entry.length > 1) {
                                    item.children.push({err:'More than one of ' + extUrl + '. First one used.'})
                                   // deferred.resolve();
                                    //deferred.reject('More than one of ' + url)
                                   // return;
                                }

                                let extensionDef = bundle.entry[0].resource;     //should really only be one...


                                //console.log(extensionDef)
                                if (extensionDef && extensionDef.snapshot && extensionDef.snapshot.element) {
                                    //item.children = item.children || []
                                    extensionDef.snapshot.element.forEach(function (ed) {
                                        if (ed.sliceName) {
                                            console.log(ed)
                                            item.children.push(angular.copy(ed))
                                        }
                                    })
                                }
                            }

                            deferred.resolve();
                        },
                        function (err) {
                            console.log("Can't find "+ url)
                            //deferred.reject();
                            deferred.resolve();
                        }
                    );
                    */
                    return deferred.promise;
                };



            },
        }
    }

);
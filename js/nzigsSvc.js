angular.module("sampleApp")

    .service('nzigsSvc', function($q,$http) {

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

        function getConformanceResourceByCanUrl(canUrl, type) {
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


        let cache = {}, termCache = {}, confCache = {}

        return {

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

                    if (profile.node && profile.node.colour) {
                        node.color = profile.node.colour
                    }

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
                            let label = 'Depends On'
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




            }
        }
    }

);
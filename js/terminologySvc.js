angular.module("sampleApp").service('terminologySvc', function() {


    function getUUID () {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        })
    }

    return {
        makeTerminologySummaryDEP : function(hash) {
            //this is from patient viewer


            //make the summary object for the terminology explorer
           // console.log(hash)
            let hashBySystem = {}           //hash of coded elements by system
            let lstCodedResources = []
            let hashAllSystems = {}         //all systems from all resources

            Object.keys(hash).forEach(function (type) {

                //when called from patient viewer, the hash has a separate array called 'entry'. From bundle viewer it is direct array
                let ar = hash[type].entry || hash[type]
                if (ar) {
                    ar.forEach(function (entry) {
                        let resource = entry.resource

                        let arCodedElements = []   //all the coded elements in this resource

                       // console.log(resource)
                        //look for coded elements off the root


                        Object.keys(resource).forEach(function (key) {
                            let element = resource[key]
                            //console.log(element)
                            if (typeof element == 'object') {
                                //console.log(element,'obj')
                                if (Array.isArray(element)) {
                                    element.forEach(function (el) {
                                        if (el.coding) {
                                            el.coding.forEach(function (concept) {
                                                let clone = angular.copy(concept)
                                                clone.path = key
                                                arCodedElements.push(clone)
                                                hashAllSystems[clone.system] = true
                                            })
                                        } else {
                                            //todo - look for child elements that may be coding..
                                            //eg condition.evidence.code
                                        }
                                    })
                                } else {
                                    if (element.coding) {
                                        element.coding.forEach(function (concept) {
                                            let clone = angular.copy(concept)
                                            clone.path = key
                                            arCodedElements.push(clone)
                                            hashAllSystems[clone.system] = true
                                        })

                                    }
                                }
                            }
                        })

                        if (arCodedElements.length > 0) {
                            lstCodedResources.push({resource:resource,coded:arCodedElements})
                        }

                        //console.log(arCodedElements)
                    })
                }
            })

           // console.log(hashBySystem)
            let arAllSystems = ["All"]
            Object.keys(hashAllSystems).forEach(function (key) {
                arAllSystems.push(key)
            })
            return {codedResources:lstCodedResources,arAllSystems:arAllSystems}
            //return hashBySystem



            function saveCoded(coding,resource,path) {
                //coding will always be an array
                coding.forEach(function (singleCoding) {
                    if (singleCoding.system) {
                        hashBySystem[singleCoding.system] = hashBySystem[singleCoding.system] || []     //an array of resources


                        let ar = []
                        let value = resource[path]
                        if (Array.isArray(value)) {
                            value.forEach(function (coding) {
                                ar.push(coding)
                                
                            })
                        } else {
                            ar.push(value.coding)
                        }

                        hashBySystem[singleCoding.system].push({resource:resource,path:path,value:ar})
                    }
                })

            }
        },
        makeTerminologySummary : function(hash) {
            //this is from patient viewer


            //make the summary object for the terminology explorer
            // console.log(hash)
            //let hashBySystem = {}           //hash of coded elements by system
            let lstCodedResources = []
            let hashAllSystems = {}         //all systems from all resources

            Object.keys(hash).forEach(function (type) {

                //when called from patient viewer, the hash has a separate array called 'entry'. From bundle viewer it is direct array
                let ar = hash[type].entry || hash[type]
                if (ar) {
                    ar.forEach(function (entry) {
                        let resource = entry.resource

                        //returns an array of {path,value}
                        let codedPaths = findAllCodings(resource)
                        console.log(codedPaths)

                        let arCodedElements = []   //all the coded elements in this resource

                        for (let item of codedPaths) {
                            for (let concept of item.value) {
                                let clone = angular.copy(concept)
                                clone.path = item.path.substring(2)     //strip off the leading '$.'
                                arCodedElements.push(clone)
                                hashAllSystems[clone.system] = true
                            }


                        }






                        //let arCodedElements = []   //all the coded elements in this resource

                        // console.log(resource)
                        //look for coded elements off the root
/*

                        Object.keys(resource).forEach(function (key) {
                            let element = resource[key]
                            //console.log(element)
                            if (typeof element == 'object') {
                                //console.log(element,'obj')
                                if (Array.isArray(element)) {
                                    element.forEach(function (el) {
                                        if (el.coding) {
                                            el.coding.forEach(function (concept) {
                                                let clone = angular.copy(concept)
                                                clone.path = key
                                                arCodedElements.push(clone)
                                                hashAllSystems[clone.system] = true
                                            })
                                        } else {
                                            //todo - look for child elements that may be coding..
                                            //eg condition.evidence.code
                                        }
                                    })
                                } else {
                                    if (element.coding) {
                                        element.coding.forEach(function (concept) {
                                            let clone = angular.copy(concept)
                                            clone.path = key
                                            arCodedElements.push(clone)
                                            hashAllSystems[clone.system] = true
                                        })

                                    }
                                }
                            }
                        })

                        */

                        if (arCodedElements.length > 0) {
                            lstCodedResources.push({resource:resource,coded:arCodedElements})
                        }

                        //console.log(arCodedElements)
                    })
                }
            })

            // console.log(hashBySystem)
            let arAllSystems = ["All"]
            Object.keys(hashAllSystems).forEach(function (key) {
                arAllSystems.push(key)
            })
            return {codedResources:lstCodedResources,arAllSystems:arAllSystems}
            //return hashBySystem


            function findAllCodings(resource, path = "$") {
                const results = [];

                function walk(node, path) {
                    if (node && typeof node === "object" && !Array.isArray(node)) {
                        for (const [key, value] of Object.entries(node)) {
                            const currentPath = `${path}.${key}`;
                            if (key === "coding") {
                                results.push({ path: currentPath, value });
                            }
                            walk(value, currentPath);
                        }
                    } else if (Array.isArray(node)) {
                        node.forEach((item, i) => walk(item, `${path}[${i}]`));
                    }
                }

                walk(resource, path);
                return results;
            }
        },
        makeExtensionSummary : function (hash) {


            let lstExtensionUrls = ['All']      //All extensionUrls in all resources
            let hashAllSystems = {}         //all extensions systems from all resources
            let hashResults = {}            //results by resource id
            let bundleHasModifier = false
            let bundleHasExtensions = false

            Object.keys(hash).forEach(function (type) {

                //when called from patient viewer, the hash has a separate array called 'entry'. From bundle viewer it is direct array
                let ar = hash[type].entry || hash[type]
                if (ar) {
                    ar.forEach(function (entry) {
                        let resource = entry.resource
                        let results = findTopLevelExtensions(resource)
                        console.log(results)

                        if (results.length > 0) {
                            let hasModifier = false
                            for (const item of results) {
                                bundleHasExtensions = true
                                if (item.kind == 'modifierExtension') {
                                    hasModifier = true
                                    bundleHasModifier = true
                                    break
                                }
                            }

                            let id = resource.id || getUUID()
                            hashResults[id] = {resource:resource,extensions:results,hasModifier:hasModifier}

                        }
                    })
                }
            })


            return {hashResults:hashResults,lstExtensionUrls:lstExtensionUrls,bundleHasModifier:bundleHasModifier,
                bundleHasExtensions:bundleHasExtensions}

            function findTopLevelExtensions(resource, path = "$", includeModifier = true) {
                const results = [];
                const keysToMatch = includeModifier
                    ? new Set(["extension", "modifierExtension"])
                    : new Set(["extension"]);

                function walk(node, path) {
                    if (node && typeof node === "object" && !Array.isArray(node)) {
                        for (const [key, value] of Object.entries(node)) {
                            const currentPath = `${path}.${key}`;
                            let displayPath = currentPath.substring(2)
                            if (keysToMatch.has(key) && Array.isArray(value)) {
                                value.forEach((ext, i) => {
                                    results.push({
                                        path: `${displayPath}[${i}]`,
                                        url: ext.url,
                                        kind: key,
                                        value: ext,
                                    });

                                    //the list of all extensions in the bundle
                                    if (lstExtensionUrls.indexOf(ext.url) == -1) {
                                        lstExtensionUrls.push(ext.url)
                                    }



                                });
                                // deliberately not recursing into `value` here
                            } else {
                                walk(value, currentPath);
                            }
                        }
                    } else if (Array.isArray(node)) {
                        node.forEach((item, i) => walk(item, `${path}[${i}]`));
                    }
                }

                walk(resource, path);
                return results;
            }

        }

    }

})
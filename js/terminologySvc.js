angular.module("sampleApp").service('terminologySvc', function() {


    return {
        makeTerminologySummary : function(hash) {
            //make the summary object for the terminology explorer
            console.log(hash)
            let hashBySystem = {}           //hash of coded elements by system
            let lstCodedResources = []
            Object.keys(hash).forEach(function (type) {
                let ar = hash[type].entry
                if (ar) {
                    ar.forEach(function (entry) {
                        let resource = entry.resource

                        let arCodedElements = []

                        console.log(resource)
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
                                                concept.path = key
                                                arCodedElements.push(concept)
                                            })
                                        } else {
                                            //todo - look for child elements that may be coding..
                                            //eg condition.evidence.code
                                        }
                                    })
                                } else {
                                    if (element.coding) {
                                        element.coding.forEach(function (concept) {
                                            concept.path = key
                                            arCodedElements.push(concept)
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

            console.log(hashBySystem)
            return lstCodedResources
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
        }
    }

})
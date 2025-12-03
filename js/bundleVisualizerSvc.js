

angular.module("sampleApp")
    //this returns config options. At the moment it is for servers...
    //also holds the current patient and all their resources...
    //note that the current profile is maintained by resourceCreatorSvc

    .service('bundleVisualizerSvc', function($http,$q,$filter) {

        let deepValidateMax = 30    //maximum number of resources allowed in deep validation

        extObligation = "http://hl7.org/fhir/StructureDefinition/obligation"

            gHashResourcesByTypeAndId = {}   //a hash of nodes by {type}/{id}
            gHashResourcesByFullUrl = {}   //a hash of nodes by {id}

        return {

            makeProfileSummary : function (resource) {
                let summary = []    //summary by item
                let hashActor = {}  //summary by actor
                for (const ed of resource.snapshot?.element || []) {
                    let item = {}
                    item.path = $filter('dropFirstInPath')(ed.path)
                    item.short = ed.short
                    item.mult = `${ed.min}..${ed.max}`
                    item.type = ed.type
                    item.valueSet = ed.binding?.valueSet
                    item.obligations = []

                    for (const ext of ed.extension || []) {
                        if (ext.url == extObligation) {
                            let obligation = {json:ext}
                            for (const subExt of ext?.extension || []) {
                                switch (subExt.url) {
                                    case "code" :
                                        obligation.code = subExt.valueCode
                                        break
                                    case "actor" :
                                        let canonical = subExt.valueCanonical
                                        let ar = canonical.split('/')
                                        obligation.actor = ar[ar.length-1]
                                        break
                                }
                            }
                            item.obligations.push(obligation)
                            if (obligation.actor && obligation.code) {
                                let actor = obligation.actor
                                let path = item.path

                                hashActor[actor] = hashActor[actor] || {elements: {}}

                                hashActor[actor].elements[path] = hashActor[actor].elements[path] || []

                                let vo = {obligationCode:obligation.code}

                                hashActor[actor].elements[path].push(vo)
                               // hashActor[obligation.actor].elements.push(vo)
                            }


                        }


                    }


                    summary.push(item)

                }

               // console.log(hashActor)
                return {summary: summary,hashActor:hashActor}

            },

            getProcedures : function (bundle) {
                let lst = []
                for (const entry of bundle.entry) {
                    let resource = entry.resource
                    if (resource.resourceType == 'Procedure') {
                        let obj = {}
                        obj.resource = resource
                        obj.display = resource.code?.text || resource.code?.coding?.[0].display
                        obj.performed = $filter('date')(resource.performedDateTime)
                        if (resource.performedPeriod) {
                            obj.performed = `${$filter('date')(resource.performedPeriod.start)} - 
                             ${$filter('date')(resource.performedPeriod.end)}`
                        }
                        obj.reason = []
                        resource.reasonCode?.forEach(function (reason) {
                            obj.reason.push(reason.text || reason.code?.coding?.[0].display)
                        })
                        resource.reasonReference?.forEach(function (reason) {
                            obj.reason.push(reason.display)
                        })
                        lst.push(obj)
                    }
                }
                return lst
            },


            getConditions : function (bundle) {
                let lst = []
                for (const entry of bundle.entry) {
                    let resource = entry.resource
                    if (resource.resourceType == 'Condition') {
                        let obj = {}
                        obj.resource = resource
                        obj.display = resource.code?.text || resource.code?.coding?.[0].display
                        obj.clinicalStatus = resource.clinicalStatus?.coding?.[0].code
                        obj.verificationStatus = resource.verificationStatus?.coding?.[0].code
                        lst.push(obj)
                    }
                }
                return lst
            },

            getAllergies : function (bundle) {
                let lst = []
                for (const entry of bundle.entry) {
                    let resource = entry.resource
                    if (resource.resourceType == 'AllergyIntolerance') {
                        let obj = {}
                        obj.resource = resource
                        obj.display = resource.code?.text || resource.code?.coding?.[0].display
                        lst.push(obj)
                    }
                }
                return lst
            },

            getMedications : function (bundle) {
                //create an array of medication display objects.
                let medResources = ['MedicationStatement','MedicationRequest']
                let lst = []
                for (const entry of bundle.entry) {
                    let resource = entry.resource
                    if (medResources.indexOf(resource?.resourceType ) > -1){
                        if (resource.medicationCodeableConcept && resource.medicationCodeableConcept.coding?.length > 0) {
                            let obj = {}
                            obj.resource = resource
                            obj.display = resource.medicationCodeableConcept.text || resource.medicationCodeableConcept.coding[0].display
                            if (resource.reasonCode) {
                                obj.reason = []
                                for (const reason of resource.reasonCode) {

                                    obj.reason.push(reason?.text || reason?.coding?.[0].display)
                                }
                            }
                            obj.dose = []

                            //in medication request
                            if (resource.dosageInstruction) {
                                for (const dose of resource.dosageInstruction) {
                                    obj.dose.push(`${dose.text || ""} ${dose.patientInstruction || ""}` )
                                }
                            }

                            //in medication statement
                            if (resource.dosage) {
                                for (const dose of resource.dosage) {
                                    obj.dose.push(`${dose.text || ""} ${dose.patientInstruction || ""}` )
                                }
                            }


                            lst.push(obj)

                        }
                        if (resource.medicationReference) {
//todo
                        }
                    }

                }

                return lst

            },

            makeDocumentGraph : function (composition,bundle) {
                
            },
            initResourceLookup(bundle) {
                //initialize the hashs needed for a reference lookup - referenceLookup
                //called from processBundle
                gHashResourcesByTypeAndId = {}   //a hash of nodes by {type}/{id}
                gHashResourcesByFullUrl = {}   //a hash of nodes by {id}
                bundle.entry.forEach(function(entry,inx) {
                    let resource = entry.resource
                    if (entry.fullUrl) {
                        gHashResourcesByFullUrl[entry.fullUrl] = resource
                    }
                    gHashResourcesByTypeAndId[`${resource.resourceType}/${resource.id}`] = resource  //hash for {type}/{id} lookup

                })

            },
            referenceLookup : function (reference) {
                //find a resource from a reference, assume initResourceLookup() has been called for this bundle
                let resource = gHashResourcesByTypeAndId[reference]
                if (!resource) {
                    //try a full url - eg http://host/type/id - http://hapi.fhir.org/baseR4/Patient/IPS-examples-Patient-01
                    resource = gHashResourcesByFullUrl[reference]
                }
                return resource

            },
            makeDocument : function (bundle,$sce) {
                let hashResourcesByTypeAndId = {}   //a hash of nodes by {type}/{id}
                let hashResourcesByFullUrl = {}   //a hash of nodes by {id}


                let document = {}   //the summary document object
                let composition
                let patient
                //create the hashs for references
                bundle.entry.forEach(function(entry,inx) {
                    //create hashs for simpler identification of reference targets
                    let resource = entry.resource

                    //assume only 1 for the moment = //todo check for multiple
                    switch (entry.resource.resourceType) {
                        case 'Composition' :
                            document.composition = entry.resource
                            break
                        case 'Patient' :
                            //no - get the patient form the composition subject
                           // document.patient = entry.resource
                            break
                    }

                    if (entry.fullUrl) {
                        hashResourcesByFullUrl[entry.fullUrl] = resource
                    }
                    hashResourcesByTypeAndId[`${resource.resourceType}/${resource.id}`] = resource  //hash for {type}/{id} lookup
                })

                if (! document.composition) {
                    return {}
                }

                //get the subject
                if (document.composition.subject) {
                    document.subject = findResource(document.composition.subject.reference)
                }
/* - not using 'realResources' any more - was in bvDocument "Rendering and resources
                //now create the sections
                for (const section of document.composition.section) {
                    section.realResources = []
                    for (const entry of section.entry || []) {
                        let reference = entry.reference
                        let resource = findResource(reference)
                        if (resource) {
                            let item = {display:resource.resourceType,resource:resource}

                            const json = angular.toJson(resource, true);
                            const html = `<pre>${json}</pre>`;
                            item.trustedPopover = $sce.trustAsHtml(html);

                            section.realResources.push(item)
                        } else {
                            section.realResources.push({display:'unknown reference:'+entry.reference})
                        }
                    }
                }
*/
                return document






                function findResource(reference) {
                    let resource = hashResourcesByTypeAndId[reference]
                    if (!resource) {
                        //try a full url - eg http://host/type/id - http://hapi.fhir.org/baseR4/Patient/IPS-examples-Patient-01
                        resource = hashResourcesByFullUrl[reference]
                    }
                    return resource
                }


            },
            makeDRSummary : function(DR,hashResourcesByRef) {
                //create an object to make it easy to list DiagnosticReports
                let vo = {DR:DR,obs:[]}
                if (DR.result) {
                    DR.result.forEach(function (ref) {
                        let obs = hashResourcesByRef[ref.reference]
                        if (obs) {
                            vo.obs.push(obs)
                        }

                    })
                }

                return vo
            },
            makeCarePlanSummaryDEP : function(arCarePlans,hashResources) {
                //create hieracchy
                let hashCP = {}     //a hash of CP's that don't have a 'partOf' value

                //a hash keyed on id
                arCarePlans.forEach(function (cp){
                    hashCP['CarePlan/'+ cp.id] = {cp:cp,children:[]}
                })

                //now fill in the details
                arCarePlans.forEach(function (cp) {
                    if (cp.partOf) {
                        let parent = hashCP[cp.partOf]
                        if (parent) {
                            parent.children.push(cp)
                        } else {
                            console.log("error: parent CP not found")
                        }
                    }
                })




            },
            makeGraphDEP : function(bundle,options) {
                let dummyBase = "http://dummybase/"
                let hashByFullUrl = {}
                //create a hash indexed on fullUrl. If there is no fullUrl, then create one using a dummy base
                bundle.entry.forEach(function (entry){
                    let resource = entry.resource
                    let fullUrl = entry.fullUrl || dummyBase + resource.resourceType + "/" + resource.id
                    hashByFullUrl[fullUrl] = resource

                })

            },
            deepValidationDEP : function (bundle,serverUrl) {
                //performs a validation by copying all the bundle contents to a server, then using $validate against Bundle
                //each resource must have an id
                //returns an OO
                let deferred = $q.defer();
                let arQuery = [];
                let arResult = [];
                let OOerrors = {issue:[]}

                if (!bundle.entry ||  bundle.entry.length > deepValidateMax) {
                    OOerrors.issue.push({diagnostics:"The bundle must have a maximum number of " + deepValidateMax + " entries."})
                    deferred.reject(OOerrors)
                    return
                }

                //save each resource to the validation server, using minimal validation
                bundle.entry.forEach(function (entry,inx) {
                    if (entry.resource) {
                        let resource = entry.resource;
                        if (resource.id) {
                            arQuery.push(saveResource(serverUrl,resource))
                        } else {
                            OOerrors.issue.push({diagnostics:"The resource at entry #" + inx + " does not have an id"})
                        }

                    } else {
                        OOerrors.issue.push({diagnostics:"entry #" + inx + " has no resource"})
                    }
                });

                if (OOerrors.issue.length > 0) {
                    deferred.reject(OOerrors)
                    return
                }


                $q.all(arQuery).then(
                    function(data){
                        //all of the resources saved correctly. Now invoke the Bundle validate
                        console.log(data)
                        let validateUrl = serverUrl + "/Bundle/$validate"
                        //now we can POST the bundle
                        $http.post(validateUrl,bundle).then(
                            function(data) {
                                deferred.resolve(data.data)
                            }, function(err) {
                                deferred.reject(err.data)
                            }
                        )

                    },function(err) {
                        //some of the resources were not saved
                        console.log(err)
                        deferred.reject(err)
                    }
                );

                return deferred.promise


                function saveResource(serverUrl,resource) {
                    let deferred1 = $q.defer();
                    let url = serverUrl + resource.resourceType + "/" + resource.id
                    console.log(url)
                    $http.put(url,resource).then(
                        function(data) {
                            deferred1.resolve(data.data)
                        },
                        function(err) {
                            deferred1.reject(err.data)
                        }
                    )

                    return deferred1.promise

                }


            },
            performQueryFollowingPaging : function(url,limit,accessToken){
                //Get all the resurces specified by a query, following any paging...
                //http://stackoverflow.com/questions/28549164/how-can-i-do-pagination-with-bluebird-promises

                let config = {}
                if (accessToken) {
                    config.headers = {Authorization:"Bearer " + accessToken}
                }

                var returnBundle = {resourceType:'Bundle',total:0,type:'searchset',link:[],entry:[]};
                returnBundle.link.push({relation:'self',url:url})

                //add the count parameter
                if (url.indexOf('?') > -1) {
                    url += "&_count=100"
                } else {
                    url += "?_count=100"
                }


                var deferred = $q.defer();

                limit = limit || 100;



                getPage(url);

                //get a single page of data
                function getPage(url) {
                    return $http.get(url,config).then(
                        function(data) {
                            var bundle = data.data;     //the response is a bundle...

                            //added May 2019 - check for when the response is not a query...
                            if (bundle && bundle.resourceType !== 'Bundle') {
                                deferred.resolve(bundle);       //isn't really a bundle...
                                return;
                            }

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

            }
        }
    }
    )


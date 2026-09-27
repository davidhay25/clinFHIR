

angular.module("sampleApp")
    //this returns config options. At the moment it is for servers...
    //also holds the current patient and all their resources...
    //note that the current profile is maintained by resourceCreatorSvc

    .service('bundleVisualizerSvc', function($http,$q,$filter,v2ToFhirSvc,fhirBundleFilterSvc) {


            let timelineDatePaths = [
                // Clinical event / occurrence
                'occurrence',
                'effective',
                'performed',
                'onset',
                'abatement',
                'period',
                'event',

                // Other useful dates
                'date',
                'authoredOn',
                'created',
                'recorded',
                'issued',
                'sent',
                'received',

                // Last resort
                'meta.lastUpdated'
            ];


        //configuration instructions for rendering a document from the referenced resources in the section
        let renderConfig = []
        $http.get('artifacts/bvResourceRender.json').then(
            function (data) {
                renderConfig = data.data
        })

        //config for temporal view
        let hashTemporal = {}
        $http.get('artifacts/bvTemporal.json').then(
            function (data) {
                for (let def of data.data) {
                    hashTemporal[def.type] = def
                }

            })


        extObligation = "http://hl7.org/fhir/StructureDefinition/obligation"

        gHashResourcesByTypeAndId = {}   //a hash of nodes by {type}/{id}
        gHashResourcesByFullUrl = {}   //a hash of nodes by {id}

        return {

            makeQRAnswerSummary : function (QR) {
                if ( !QR || ! QR.resourceType == 'QuestionnaireResponse') {
                    return
                }


                const rows = [];

                function walk(items, depth) {
                    if (!items) return;
                    for (const item of items) {
                        rows.push({
                            linkId: item.linkId,
                            depth,
                            text: item.text || '',
                            answer: item.answer,
                        });
                        if (item.item) {
                            walk(item.item, depth + 1);
                        }
                        // Repeating group items nest their children inside each answer instead
                        if (item.answer) {
                            for (const a of item.answer) {
                                if (a.item) walk(a.item, depth + 1);
                            }
                        }
                    }
                }

                walk(QR.item, 0);
                console.log(">>>>>>>. QR rows")
                return rows;



            },

            makeQTree : function (Q) {
                // make a tree version of a Q - used in the 'bundlefromQ function when selecting a Q in the 'make form form' option
                //todo - create list of pre-pop expressions

                let that = this

                let hashItem = {}
                let treeData = []



                function addItemToTree(parent,item,level,sectionItem) {
                    let idForThisItem =  item.linkId
                    hashItem[item.linkId] = item

                    let thisItem = angular.copy(item)
                    delete thisItem.item

                    let text = item.text || "Unknown text"

                    if (text.length > 50) {
                        text = text.slice(0,47) + "..."
                    }

                    let node = {id:idForThisItem,text:text,parent:parent,data:{section:sectionItem,item:item}}


                    //If SDC view, then
                    let iconFile = "icons/icon-q-" + item.type + ".png"

                    node.icon = iconFile

                    //---- set style of node
                    let arStyle = []         //the style element to add to the node['a_attr']
                    if (item.enableWhen && item.enableWhen.length > 0) {
                        arStyle.push("text-decoration-line: underline")
                        arStyle.push("text-decoration-style: dotted")
                    }




                    //create tree attribute node
                    if (arStyle.length > 0) {
                        let style = ""
                        arStyle.forEach(function (s) {
                            style += s + ";"

                        })
                        node['a_attr'] = { "style": style}
                        // console.log(ed.path,style)
                    }


                    treeData.push(node)

                    //now look at any sub children
                    if (item.item) {
                        item.item.forEach(function (child) {
                            let newLevel = "item"
                            if (child.item) {
                                newLevel = 'group'
                            }
                            addItemToTree(idForThisItem,child,newLevel,sectionItem)
                        })
                    }
                }

                function addQToTree(Q) {
                    let qParentId = `#`
                    Q.item.forEach(function (item) {
                        let section = angular.copy(item)
                        delete section.item
                        addItemToTree(qParentId,item,'section',section)
                    })
                }


                addQToTree(Q)

                /*
                                //now that we have completed the tree array (and populated hashItem)
                                //we can make the conditional display a bit nicer by adding the text for the question

                                treeData.forEach(function (node) {
                                    if (node.data && node.data.item.enableWhen) {
                                        node.data.item.enableWhen.forEach(function (ew) {
                                            if (hashItem[ew.question]) {
                                                ew.questionText = hashItem[ew.question].text
                                            }

                                        })
                                    }
                                })

                                */

                return {treeData: treeData,hashItem:hashItem}


            },

            getSectionBundle : function (bundle,sectionCode) {
                //return a bundle containing only those resources referenced by a section

                const composition = bundle.entry
                    .find(x => x.resource?.resourceType === 'Composition')?.resource;
                if (! composition) {
                    return {}
                }

                const resources = composition.section
                    .filter(section => section.code?.coding?.some(c => c.code === sectionCode))
                    .flatMap(section => section.entry || [])
                    .map(entry => entry.reference);

                //console.log(resources)

                let filteredBundle = fhirBundleFilterSvc.filter(bundle, resources, { transitive: false })



                //console.log(filteredBundle)

                return filteredBundle


            },

            makeResourceTypeList : function (bundle) {
                //all the types in the bundle
                let hashTypes = {}
                for (const entry of bundle.entry) {
                    let resource = entry.resource
                    hashTypes[resource.resourceType] = hashTypes[resource.resourceType] || 0
                    hashTypes[resource.resourceType] ++
                }

                //order by key
                let hash = {}
                let ar = Object.keys(hashTypes).sort()
                for (const typ of ar) {
                    hash[typ] = hashTypes[typ]
                }

                return hash
            },

            makeTransactionBundle : function (inBundle) {
                let bundle = angular.copy(inBundle)
                bundle.type = 'transaction'
                for (let entry of bundle.entry) {
                    let resource = entry.resource
                    delete resource.id
                    delete entry.id
                    entry.request = {method:"POST",url:resource.resourceType}
                }
                console.log(bundle)
                return bundle
            },

            getResourceSummary : function (resource) {
                //get a one line summary of a resource depending on type
                let def = hashTemporal[resource.resourceType] //temporal definition from the config file
                let value

                if (def) {
                     for (let df of def.dateFields) {
                        try {
                            let ar = fhirpath.evaluate(resource, df.field, null, fhirpath_r4_model)
                            if (ar.length > 0) {
                                value = ar[0]
                                break
                            }
                        } catch (ex) {
                            value = `Error with FhirPath: ${df.field}`
                        }
                    }
                }

                return value

            },


            makeTemporalObject:function (bundle,filterType) {
                let colours = v2ToFhirSvc.definedColours()
                //let colours = {}
                let arLog = []
                let arData = []
                let hashResourceDate = {} //keyed by type+date - used to create the timeline view
                for (let entry of bundle.entry) {
                    let resource = entry.resource
                    if (filterType) {       //only show resources of this type
                        if (resource.resourceType !== filterType) {
                            continue
                        }
                    }

                    let def = hashTemporal[resource.resourceType] //temporal definition from the config file
                    if (def) {
                        //this is a reources to appear in the temporal view

                        let value

                        for (let df of def.dateFields) {
                            //value = resource[df.field]
                            try {
                                let ar = fhirpath.evaluate(resource, df.field,null,fhirpath_r4_model)
                                if (ar.length > 0) {
                                    value = ar[0]
                                    break
                                }
                            } catch(ex) {
                                value = `Error with FhirPath: ${df.field}`
                            }

                            //if (value) {break}
                        }



                        if (value) {
                            // a date value was found. it may be a period...

                            //console.log(resource,value)
                            let lne = {date:value,resource:resource}

                            lne.display = getDisplay(def,resource)
                            lne.colour = colours[resource.resourceType] || 'lightgreen'   // todo make resource type

                            let keyDate
                            if (value.start) {
                                //period
                                keyDate = value.start.substring(0,10)  //group by date not time
                            } else if (value.low) {
                                //Range & age
                                keyDate = value.low.substring(0,10)  //group by date not time
                            } else if (typeof value == 'string') {
                                //string
                                keyDate = value.substring(0,10)  //group by date not time
                            }
                            lne.dateDisplay = keyDate //for display, the .date is the original dataType


                            //console.log(value)


                            if (keyDate) {
                                let key = `${resource.resourceType}#${keyDate}`  //type-date
                                hashResourceDate[key] = hashResourceDate[key] || []
                                hashResourceDate[key].push({resource:resource,display:lne.display})

                                arData.push(lne)
                            }

                        } else {
                            //no datevalue was found
                            arLog.push({msg:`Resource ${resource.id} has no date field to use`,resource:resource,display:getDisplay(def,resource)})
                        }


                    }
                }

                //console.log(angular.copy(arData))

                arData.sort(function (a,b) {
                    if (a.date > b.date) {
                        return -1
                    } else {
                        return 1
                    }

                })

                //convert the hash to an array for the timeline
                let arTL = []
                for (const key of Object.keys(hashResourceDate)) {
                    let ar = key.split("#")
                    let type=ar[0]
                    let date = ar[1]
                    let arItem = hashResourceDate[key]
                    let tlDisplay = type
                    if (arItem.length > 1) {
                        tlDisplay += ` (${arItem.length})`
                    }
                    let tlItem = {date:date,type:type,resourceItems:[],display:tlDisplay}
                    tlItem.colour = colours[type] || 'lightgreen'   // todo make resource type

                    for (let thing of  arItem) {
                        tlItem.resourceItems.push({display: thing.display,resource:thing.resource,date:date})
                    }
                    arTL.push(tlItem)
                }


               // console.log(hashResourceDate)
               // console.log(angular.copy(arTL))

               // console.log(arLog)

                return {data: arData, log:arLog,arTL:arTL}

                function getDisplay(def,resource) {
                    let display = ""
                    for (const fp of def.fpDisplay) {
                        try {
                            let ar = fhirpath.evaluate(resource, fp, null, fhirpath_r4_model)
                            //console.log(ar)
                            ar.forEach(function (disp) {
                                display += disp + " "
                            })
                            if (ar.length > 0) {
                                break
                            }     //stop at the first matching
                        } catch (ex) {
                            display = `Error with FhirPath ${fp}`
                            break
                        }
                    }
                    return display
                }


            },

            getTemporalDefinition : function (type) {
                return hashTemporal[type]
            },

            makeRenderObject :function (bundle) {
                //create the data object used when rendering the clinical view of a document from section resources
                //object is a hash keyed on section name. contents has the rows for the table
                let that = this
                let log = []

                //get the composition resource
                let composition
                let ar = bundle.entry.filter(entry => entry.resource.resourceType == 'Composition')
                if (ar.length > 0) {
                    composition = ar[0].resource
                } else {
                    alert("No composition found")
                    return
                }

                console.log(composition)
                if (! composition) {
                    alert("No composition found")
                    return {}
                }

                //create a hash of section entries in the composition on code.
                let hashSections = {}
                for (const section of composition.section) {
                    let coding = section?.code?.coding[0]
                    if (coding) {
                        let key = `${coding.code}|${coding.system}`
                        //the hashSections entry has the section - plus all the referenced resources
                        hashSections[key] = {section:section,resources:[]}

                        for (let entry of section.entry || []) {
                            let ref = entry?.reference
                            if (ref) {
                                let resource = that.referenceLookup(ref)
                                if (resource) {
                                    hashSections[key].resources.push(resource)
                                } else {
                                    log.push({msg:"section entry reference to resource not in bundle",details:entry})
                                }
                            } else {
                                log.push({msg:"section entry has no reference",details:entry})
                            }
                        }

                    } else {
                        let msg = {'display':'Section with no code',details:section}
                    }
                    //let v =  {title:title}
                }



                console.log(hashSections)
                let vo = []


                for (let cSection of renderConfig) {

                    let docSection = hashSections[cSection.key] //the section from the composition
                    if (docSection) {
                        let section = {title:cSection.title,header:[],rows:[],resources:[],key:cSection.key}
                        //construct the headers array from the column definitions
                        for (let col of cSection.cols) {
                            section.header.push(col.header)
                        }


                        //iterate over the references in the section
                        for (let resource of docSection.resources) {
                            let resourceType = resource.resourceType //there can be different resourcetyoes in a section
                            //now iterate over the columns collection to get the content for each one
                            let row = []    //a single row with an array of columns
                            for (let col of cSection.cols) {
                                let display = ""    //the value that will be displayed
                                for (let content of col.contents) { //there can be multiple definitions for each type
                                    if (content.type == resourceType) { //this is a matching resource type

                                        let value = resource[content.element] //todo - what if nested path ?? fhirpath
                                        if (value) {
                                            //some elements are multiple
                                            if (! Array.isArray(value)) {
                                                value = [value]
                                            }

                                            for (let detail of value) {
                                                switch (content.dt) {
                                                    case "CodeableConcept":
                                                        display += detail.text || detail.coding?.[0]?.display || detail.coding?.[0]?.code
                                                        break
                                                    default:
                                                        display += detail

                                                }
                                            }

                                            //display += value    //todo need better separatot
                                        } else {
                                            //check for a data absent reason
                                            let extensionElementName = `_${content.element}`
                                            let value = resource[extensionElementName]
                                            for (let ext of value?.extension || []) {
                                                if (ext.url == "http://hl7.org/fhir/StructureDefinition/data-absent-reason") {
                                                    display += ext.valueCode
                                                }
                                            }

                                        }
                                    }
                                }
                                //now add the display to the col
                                row.push({display:display})
                            }
                            section.rows.push(row)
                            section.resources.push(resource)
                        }
                        vo.push({title:cSection.title,section:section})

                    } else {
                        log.push({msg:`Section in config file (${cSection.key}) not found in Composition section`})
                    }


                }

console.log(vo,log)

                return {vo:vo,log:log}

                function getValue() {

                }



            },

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
                //create a document object to be used in the specific document views
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


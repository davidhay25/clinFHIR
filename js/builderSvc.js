angular.module("sampleApp")
//this returns config options. At the moment it is for servers...
//also holds the current patient and all their resources...
//note that the current profile is maintained by resourceCreatorSvc

    .service('builderSvc', function($http,$q,appConfigSvc,GetDataFromServer,Utilities,$filter) {

        var gAllReferences = []
        var gSD = {};   //a has of all SD's reas this session by type
        var showLog = false;
        var gAllResourcesThisSet = {};      //hash of all resources in the current set
        var manualMarkerString = "<a name='mm'/>";     //a marker string to separate manually entered text (above the marker) from generated text below

        var objColours ={};
        objColours.Patient = '#93FF1A';
        objColours.Composition = '#E89D0C';
        objColours.List = '#ff8080';
        objColours.List = '#FFFFCC';
        objColours.Practitioner = '#FFBB99';
        objColours.MedicationStatement = '#ffb3ff';


        return {
            splitNarrative : function(narrative) {

                //get the manual part of resource text - the text above the marker string. default to manual text..
                //assume that the narrative MAY be surrounded by <div> tags...

                var raw = $filter('cleanTextDiv')(narrative);       //the raw text - with 'divs' removed if they are present


                var generated='',manual = raw;

                var g = raw.indexOf(manualMarkerString);
                if (g > -1) {
                    manual = raw.substr(0,g);
                    generated = raw.substr(g+manualMarkerString.length);
                }

                //manual = manual.substr(raw)

                return {manual:manual,generated:generated}
            },
            getManualMarker : function() {
                return manualMarkerString;
            },
            addGeneratedText:function(manualText,generatedText){
                //create a narrative text surrounded by divs. \
                //assume that 'plain text' is input - returns narrative surrounded by 'divs'
                var narrative = manualText + manualMarkerString + generatedText;


                return $filter('addTextDiv')(narrative);

                /*
                 //first, remove the </div> at the ene
                 //resourceText = resourceText.substr(0,textDiv.length - 6);

                 //if there's no marker, the add it...
                 if (resourceText.indexOf(manualMarkerString) == -1) {
                 resourceText += manualMarkerString;
                 }

                 //add the new text
                 resourceText += newText + "</div>";

                 return resourceText;
                 */


            },
            generateSectionText : function(section) {

                //construct section text from the text of all resources directly in the section.
                //for each resource in the section, if it is a List then construct the text from the text of the
                //immediate children. Otherwise just use the text of the resource.

                //generate the text for a section. todo - needs to become recursive...
                //console.log(gAllReferences)
                var html = "";
                var that = this;
                section.entry.forEach(function(entry){
                    //console.log(entry)
                    var resource = that.resourceFromReference(entry.reference);


                    if (resource) {
                        if (resource.resourceType == 'List') {
                            //get the text from all of the references resoruces...
                            var manual = that.splitNarrative(resource.text.div).manual;  //manually entered text
                            var generated = "";     //will replace the genereated text...


                            //resource.text.div = $filter('addTextDiv')(result.userText + builderSvc.getManualMarker() + vo.generated);

                            if (resource.entry) {
                                resource.entry.forEach(function(entry){
                                    //var ref = entry.item.reference;
                                    var refResource = that.resourceFromReference(entry.item.reference);
                                    if (refResource) {
                                        html += refResource.text.div;
                                        //add the text of the referenced element to the list...
                                        //var raw = $filter('cleanTextDiv')(refResource.text.div)

                                        //we only want the manually entered text...
                                        generated += that.splitNarrative(refResource.text.div).manual;  //manually entered text
                                        //generated +=  $filter('cleanTextDiv')(refResource.text.div);

                                    }

                                })
                            }

                            //var t = resource.text.div;

                            resource.text.div = that.addGeneratedText(manual,generated);



                            //resource.text.div = $filter('addTextDiv')(manual + that.getManualMarker() + generated);


                        } else {
                            html += resource.text.div
                        }


                    }




                })
                return html;


                //function getText(text,)


            },
            resourceFromReference : function(reference) {
                //get resource from a reference
                return gAllResourcesThisSet[reference]
            },
            setAllResourcesThisSet : function(allResourcesBundle) {
                //create the hash of all resources in this set;
                var that = this;
                gAllResourcesThisSet = {};
                allResourcesBundle.entry.forEach(function(entry){
                    var resource = entry.resource;
                    gAllResourcesThisSet[that.referenceFromResource(resource)] = resource;

                });
            },
            addResourceToAllResources : function(resource) {
                //add a new resource to the hash
                gAllResourcesThisSet[this.referenceFromResource(resource)] = resource;
            },
            makeDocumentText : function(composition,allResourcesBundle){
                //construct the text representation of a document
                // order is patient.text, composition.text, sections.text
                if (composition) {
                    var that = this;
                    var html = "";
                    if (composition.subject) {
                        var subject = that.resourceFromReference(composition.subject.reference);
                        //var patient = hash[composition.patient.reference]
                        //console.log(subject);
                        if (subject) {
                            html += "<h3>Subject</h3>" + "<div class='inset'>"+  subject.text.div + "</div>";
                        }
                    }

                    html += "<h3>Composition</h3>" + "<div class='inset'>"+ composition.text.div + "</div>";

                    html += "<h3>Sections</h3>";

                    composition.section.forEach(function(section){
                        //console.log(section);


                        html += "<h4>"+section.title+"</h4>";
                        html += "<div class='inset'>";

                        html += that.generateSectionText(section)
                        html += "</div>";



                    })

                    return html;
                }





            },
            referenceFromResource : function(resource) {
                //create the reference from the resource
                return resource.resourceType + "/" + resource.id;
            },
            saveToLibrary : function (bundleContainer) {
                //save the bundle to the library. Note that the 'container' of the bundle (includes the name) is passed in...
                var bundle = bundleContainer.bundle;
                var docref = {resourceType:'DocumentReference',id:bundle.id};
                docref.type = {coding:[{system:'http://clinfhir.com/docs',code:'builderDoc'}]};
                docref.status = 'current';
                docref.indexed = moment().format();
                docref.description = bundleContainer.description;
                if (bundleContainer.isPrivate) {
                    docref.meta = {security : [{code:'R',system:'http://hl7.org/fhir/v3/Confidentiality'}]}
                }
                docref.content = [{attachment:{data:btoa(angular.toJson(bundle))}}]
                var url = appConfigSvc.getCurrentDataServer().url + 'DocumentReference/'+docref.id;
                return $http.put(url,docref);

            },
            getBundleContainerFromDocRef : function(dr){
                //generate a bundleContainer (how the bundle is stored locally) from a documentreference...

                if (dr.content && dr.content[0] && dr.content[0].attachment && dr.content[0].attachment.data) {
                    var container = {};
                    container.bundle = angular.fromJson(atob(dr.content[0].attachment.data));
                    container.description = dr.description;
                    container.isDirty = false;
                    //get the security tags.
                    if (dr.meta && dr.meta.security) {
                        dr.meta.security.forEach(function(coding){
                            if (coding.system='' && coding.code == 'R') {
                                container.isPrivate = true;
                            }
                        })
                    }


                }


            },
            loadLibrary : function () {
                //download ALL the DocumentReferences that are the library references...
                var deferred = $q.defer();
                var url = appConfigSvc.getCurrentDataServer().url + 'DocumentReference?type=http://clinfhir.com/docs|builderDoc';
                $http.get(url).then(
                    function (data) {
                        //console.log(data.data)
                        deferred.resolve(data.data)

                    },function (err) {
                        console.log(err)
                        deferred.reject(err);
                    }
                )



                return deferred.promise;
            },
            getValueForPath : function(resource,inPath) {
                //return a string display for a path value. root only at this stage...
                var path = $filter('dropFirstInPath')(inPath);   //the path off the root
                var info = this.getEDInfoForPath(inPath)
                var rawValue = resource[path];
                if (info.isMultiple && resource[path]) {
                    rawValue = resource[path][0];
                }
                var display = "";
                if (rawValue) {
                    display = rawValue;
                    //figure out the display
                    if (rawValue.coding) {
                        //this is a cc
                        display = rawValue.coding[0].display;
                        //display = rawValue.coding[0].code + " ("+rawValue.coding[0].system+")";
                    } else if (rawValue.start || rawValue.end) {
                        //this is a period

                    }
                }




                return {raw:rawValue,display:display}


            },
            addStringToText : function(resource,txt) {
                //add the txt to the resource.text.div element...
                if (resource.text && resource.text.div) {
                    var raw = $filter('cleanTextDiv')(resource.text.div);
                    raw += " "+txt;
                    resource.text.div =  $filter('addTextDiv')(raw);
                }

            },
            addPropertyValue : function(resource,hashPath,dt,value) {
                //add a value to a resource property...  type of value will depend on datatype
                //var that = this;
               // console.log(resource,hashPath,dt,value)
                var info = this.getEDInfoForPath(hashPath.path)

                //var path = $filter('dropFirstInPath')(hashPath.path);   //the path off the root
                //for now, we only allow values for properties directly off the root...

                var path = hashPath.path;

                if (path.indexOf('.') > -1) {
                    //  return "Can only add to root properties";
                }


                switch (dt) {

                    case 'HumanName' :
                       // console.log(value)
                        var insrt = {text:value.HumanName.text}
                        simpleInsert(resource,info,path,insrt,dt);
                        this.addStringToText(resource.path+": "+ insrt.text)
                        break;

                    case 'Address' :
                       // console.log(value)
                        var insrt = {text:value.Address.text}
                        simpleInsert(resource,info,path,insrt,dt);
                        this.addStringToText(resource.path+": "+ insrt.text)
                        break;

                    case 'Period' :
                        var start = value.period.start;
                        var end = value.period.end;
                        var insrt = {start:start,end:end}
                        simpleInsert(resource,info,path,insrt,dt);

                        break;

                    case 'date' :
                        //value is a Date object...
                        var v = moment(value).format('YYYY-MM-DD');
                        simpleInsert(resource,info,path,v,dt);
                        this.addStringToText(resource.path+": "+ v)
                        break;
                    case 'dateTime' :
                        //value is a Date object...
                        var v = moment(value).format();
                        simpleInsert(resource,info,path,v,dt);
                        this.addStringToText(resource.path+": "+ v)
                        break;

                    case 'code' :
                        simpleInsert(resource,info,path,value.code,dt);

                        this.addStringToText(resource,path+": "+ value.code)
                        break;
                    case 'string' :
                        simpleInsert(resource,info,path,value.string,dt);

                        this.addStringToText(resource,path+": "+ value.string)
                        break;
                    case "CodeableConcept" :
                        //value is an object that can have properties code, system, display, text
                        var cc = {},text="";
                        if (value && value.cc) {

                            //when a CC is rendered as a set of radios the output is a json string...
                            if (angular.isString(value.cc)) {
                                value.cc = {coding:angular.fromJson(value.cc)}
                                delete value.cc.coding.extension;
                            }


                            if (value.cc.coding) {
                                cc.coding = [value.cc.coding]
                                if (value.cc.coding.display) {
                                    text = value.cc.coding.display
                                }
                            }
                            if (value.cc.text) {
                                cc.text = value.text;
                                text = value.cc.text;
                            }


                            simpleInsert(resource,info,path,cc,dt);

                            if (text) {
                                this.addStringToText(resource, path + ": " + text)
                            }
                        }

                        break;
                }

                function simpleInsert(resource,info,path,insrt,dt) {
                    var insertPoint = resource;


                    var segmentPath = resource.resourceType;
                    var path = $filter('dropFirstInPath')(path);


                    if (path.substr(-3) == '[x]') {
                        var elementRoot = path.substr(0,path.length-3);
                        path = elementRoot + dt.substr(0,1).toUpperCase() + dt.substr(1);

                        //delete any elements with this root
                        angular.forEach(insertPoint,function(value,key){
                            //console.log(key,value)
                            if (key.substr(0,elementRoot.length) == elementRoot) {
                                console.log(key)
                                delete insertPoint[key]
                            }

                        })

                    }

                   // console.log(path)
                    //return;


                    var segmentInfo;
                    var ar = path.split('.');
                    if (ar.length > 0) {
                        for (var i=0; i < ar.length-1; i++) {
                            //not the last one... -
                            var segment = ar[i];

                            segmentPath += '.'+segment;
                            //console.log(segmentPath)

                            segmentInfo = getInfo(segmentPath);

                            if (segmentInfo.isMultiple) {
                                insertPoint[segment] = insertPoint[segment] || []  // todo,need to allow for arrays
                                var node = {};
                                insertPoint[segment].push(node)
                                insertPoint = node
                            } else {
                                insertPoint[segment] = insertPoint[segment] || {}  // todo,need to allow for arrays
                                insertPoint = insertPoint[segment]
                            }




                        }
                        path = ar[ar.length-1];       //this will be the property on the 'last'segment
                    }

                    if (info.isMultiple) {

                        insertPoint[path] = insertPoint[path] || []
                        insertPoint[path].push(insrt)
                    } else {
                        insertPoint[path] =insrt;
                    }
                }
            },
            removeReferenceAtPath : function(resource,path,inx) {
                //find where the reference is that we want to remove

                var ar = path.split('.');
                ar.splice(0,1);

                if (ar.length > 1) {
                    ar.pop();
                }
                path = ar.join('.')


                // var path = $filter('dropFirstInPath')(path);
                //path.pop();
                //console.log(resource,path,inx);
                if (inx !== undefined) {
                    var ptr = resource[path]
                    //delete ptr[inx]
                    ptr.splice(inx,1);
                } else {
                    delete resource[path]
                }





                /*
                 var info = this.getEDInfoForPath(path);

                 var segmentPath = resource.resourceType;
                 //var rootPath = $filter('dropFirstInPath')(path);
                 var path = $filter('dropFirstInPath')(path);
                 var deletePoint = resource;
                 var ar = path.split('.');
                 if (ar.length > 0) {
                 for (var i=0; i < ar.length-1; i++) {
                 //not the last one... -
                 var segment = ar[i];

                 segmentPath += '.'+segment;
                 console.log(segmentPath)

                 var segmentInfo = this.getEDInfoForPath(segmentPath);

                 if (segmentInfo.isMultiple) {
                 deletePoint[segment] = deletePoint[segment] || []  // todo,need to allow for arrays
                 var node = {};
                 deletePoint[segment].push(node)
                 deletePoint = node
                 } else {
                 deletePoint[segment] = deletePoint[segment] || {}  // todo,need to allow for arrays
                 deletePoint = deletePoint[segment]
                 }




                 }
                 path = ar[ar.length-1];       //this will be the property on the 'last'segment
                 }



                 console.log(insertPoint)

                 */

                if (inx) {

                }

            },
            insertReferenceAtPath : function(resource,path,referencedResource) {


                //console.log(resource,path,referencedResource);
                var info = this.getEDInfoForPath(path);

                var segmentPath = resource.resourceType;

                //var rootPath = $filter('dropFirstInPath')(path);
                var path = $filter('dropFirstInPath')(path);
                var insertPoint = resource;
                var ar = path.split('.');
                if (ar.length > 0) {
                    for (var i=0; i < ar.length-1; i++) {
                        //not the last one... -
                        var segment = ar[i];


                        segmentPath += '.'+segment;
                        //console.log(segmentPath)

                        var segmentInfo = this.getEDInfoForPath(segmentPath);

                        if (segmentInfo.isMultiple) {



                            insertPoint[segment] = insertPoint[segment] || []  // todo,need to allow for arrays
                            var node = {};
                            insertPoint[segment].push(node)
                            insertPoint = node
                        } else {
                            insertPoint[segment] = insertPoint[segment] || {}  // todo,need to allow for arrays
                            insertPoint = insertPoint[segment]
                        }




                    }
                    path = ar[ar.length-1];       //this will be the property on the 'last'segment
                }




                if (info.max == 1) {
                    insertPoint[path] = {reference:referencedResource.resourceType+'/'+referencedResource.id}
                }
                if (info.max =='*') {
                    insertPoint[path] = insertPoint[path] || []

                    var reference = referencedResource.resourceType+'/'+referencedResource.id;
                    //make sure there isn't already a reference to this resource
                    var alreadyReferenced = false;
                    insertPoint[path].forEach(function(ref){
                        if (ref.reference == reference) {
                            alreadyReferenced = true;
                        }
                    })

                    if (! alreadyReferenced) {
                        insertPoint[path].push({reference:reference})
                    }

                }
/*

                return;


                var that = this;
                var info = this.getEDInfoForPath(path);
                console.log(path);

                var insertPoint = resource;
                var ar = path.split('.');
                var rootPath = ar.splice(0,1)[0];

                if (ar.length > 0) {
                    for (var i=0; i <= ar.length-1; i++) {

                        var segment = ar[i];
                        var fullPath = rootPath
                        for (var j=0; j <= i; j++) {
                            fullPath += '.' + ar[j];
                        }

                        //todo - will barf for path length > 2
                        console.log(fullPath)
                        var info = that.getEDInfoForPath(fullPath)

                        if (info.isMultiple) {

                            insertPoint[segment] = insertPoint[segment] || []

                        } else {
                            insertPoint[segment] = insertPoint[segment] || {}  // todo,need to allow for arrays
                        }



                        insertPoint = insertPoint[segment]
                    }
                    path = ar[ar.length-1];       //this will be the property on the 'last'segment
                }


                */

            },
            getSD : function(type) {
                var deferred = $q.defer();

                if (gSD[type]) {
                    deferred.resolve(gSD[type])
                } else {
                    var uri = "http://hl7.org/fhir/StructureDefinition/"+type;
                    GetDataFromServer.findConformanceResourceByUri(uri).then(
                        function(SD) {
                            gSD[type] = SD;
                            deferred.resolve(SD);
                        },function(err){
                            deferred.reject(err)
                        })
                }

                return deferred.promise;
            },
            getEDInfoForPath : function(path) {
                var ar = path.split('.');
                var type = ar[0];       //the resource type is the first segment in the path
                var SD = gSD[type];     //it must have been read at this point...
                var info = {path:path};          //this will be the info about this element...

                //find the path
                if (SD.snapshot && SD.snapshot.element) {
                    SD.snapshot.element.forEach(function (ed) {

                        if (ed.path == path) {
                            info.max = ed.max;
                            if (ed.max == '*') {
                                info.isMultiple = true
                            }


                        }
                    })

                }
                return info;

            },
            getDetailsByPathForResource : function(resource) {
                //return a hash by path for the given resource indicating multiplicty at that point. Used for creating references...
                //var type = resource.resourceType;
                var deferred = $q.defer();
                var uri = "http://hl7.org/fhir/StructureDefinition/" + resource.resourceType;
                GetDataFromServer.findConformanceResourceByUri(uri).then(
                    function (SD) {
                        //console.log(SD);
                        var hash = {}
                        if (SD && SD.snapshot && SD.snapshot.element) {
                            SD.snapshot.element.forEach(function (ed) {
                                var path = ed.path;
                                var detail = {};        //key details about this path
                                if (ed.max == '*') {
                                    detail.multiple = true;
                                }
                                hash[path]=detail;
                            })
                        }

                    },
                    function (err) {
                        console.log(err);
                        deferred.reject(err)
                    })
                return deferred.promise;
            },
            getSrcTargReferences : function(url) {
                //get all the references to & from the resource
                var vo = {src:[],targ :[]}
                gAllReferences.forEach(function(ref){
                    if (ref.src == url) {
                        vo.src.push(ref)
                    }
                    if (ref.targ == url) {
                        vo.targ.push(ref)
                    }
                })
                return vo;
            },
            getReferencesFromResourceDEP : function(resource) {
                var refs = [];
                findReferences(refs,resource,resource.resourceType)
                return refs;

                //find elements of type refernce at this level
                function findReferences(refs,node,nodePath) {
                    angular.forEach(node,function(value,key){
                        //console.log(key,value);
                        //if it's an object, does it have a child called 'reference'?
                        if (angular.isObject(value)) {
                            if (value.reference) {
                                //this is a reference!
                                //console.log('>>>>>>>>'+value.reference)
                                var lpath = nodePath + '.' + key;
                                refs.push({path:lpath,reference : value.reference})
                            } else {
                                //if it's not a reference, then does it have any children?
                                findReferences(refs,value,lpath)
                            }
                        }
                        if (angular.isArray(value)) {
                            value.forEach(function(obj){
                                //examine each element in the array

                                if (obj.reference) {
                                    //this is a reference!
                                    //console.log('>>>>>>>>'+value.reference)
                                    var lpath = nodePath + '.' + key;
                                    refs.push({path:lpath,reference : obj.reference})
                                } else {
                                    //if it's not a reference, then does it have any children?
                                }
                            })


                        }



                    })
                }

            },
            makeGraph : function(bundle) {
                //builds the model that has all the models referenced by the indicated SD, recursively...
                //console.log(SD)
                var that = this;
                var allReferences = [];
                gAllReferences.length = 0;

                var allResources = {};  //all resources hash by id

                var arNodes = [], arEdges = [];
                var objNodes = {};

                //for each entry in the bundle, find the resource that it references
                bundle.entry.forEach(function(entry){

                    var resource = entry.resource;
                    var url = resource.resourceType+'/'+resource.id;

                    //add an entry to the node list for this resource...
                    var node = {id: arNodes.length +1, label: resource.resourceType, shape: 'box',url:url,cf : {resource:resource}};
                    node.title = resource.text.div;

                    if (objColours[resource.resourceType]) {
                        node.color = objColours[resource.resourceType];
                    }

                    arNodes.push(node);
                    objNodes[node.url] = node;

                    var refs = [];
                    findReferences(refs,resource,resource.resourceType)

                    refs.forEach(function(ref){
                        allReferences.push({src:node,path:ref.path,targ:ref.reference,index:ref.index})
                        gAllReferences.push({src:url,path:ref.path,targ:ref.reference,index:ref.index});    //all relationsin the collection
                    })

                });


                //so now we have the references, build the graph model...
                allReferences.forEach(function(ref){
                    var targetNode = objNodes[ref.targ];
                    if (targetNode) {
                        var label = $filter('dropFirstInPath')(ref.path);
                        arEdges.push({from: ref.src.id, to: targetNode.id, label: label,arrows : {to:true}})
                    } else {
                        console.log('>>>>>>> error Node Id '+ref.targ + ' is not present')
                    }

                });

                var nodes = new vis.DataSet(arNodes);
                var edges = new vis.DataSet(arEdges);

                // provide the data in the vis format
                var data = {
                    nodes: nodes,
                    edges: edges
                };

                return {graphData : data,allReferences:allReferences};

                //find elements of type refernce at this level
                function findReferences(refs,node,nodePath,index) {
                    angular.forEach(node,function(value,key){

                        //if it's an object, does it have a child called 'reference'?


                        if (angular.isArray(value)) {
                            value.forEach(function(obj,inx) {
                                //examine each element in the array
                                var lpath = nodePath + '.' + key;
                                if (obj.reference) {
                                    //this is a reference!

                                    refs.push({path: lpath, reference: obj.reference})
                                } else {
                                    //if it's not a reference, then does it have any children?
                                    findReferences(refs,obj,lpath,inx)
                                }
                            })
                        } else

                        if (angular.isObject(value)) {
                            var   lpath = nodePath + '.' + key;
                            if (value.reference) {
                                //this is a reference!
                                if (showLog) {console.log('>>>>>>>>'+value.reference)}
                                refs.push({path:lpath,reference : value.reference,index:index})
                            } else {
                                //if it's not a reference, then does it have any children?
                                findReferences(refs,value,lpath)
                            }
                        }




                    })
                }


                /*

                 getModelReferences(lst,SD,SD.url);      //recursively find all the references between models...

                 console.log(lst);

                 //build the tree model...




                 lst.forEach(function(reference){

                 var srcNode = getNodeByUrl(reference.src,reference.path,objNodes,arNodes);
                 var targNode = getNodeByUrl(reference.targ,reference.path,objNodes,arNodes);

                 var ar = reference.path.split('.');
                 var label = ar.pop();
                 //ar.splice(0,1);
                 //var label = ar.join('.');
                 arEdges.push({from: srcNode.id, to: targNode.id, label: label,arrows : {to:true}})

                 })


                 var nodes = new vis.DataSet(arNodes);
                 var edges = new vis.DataSet(arEdges);

                 // provide the data in the vis format
                 var data = {
                 nodes: nodes,
                 edges: edges
                 };

                 //construct an object that is indexed by nodeId (for the model selection from the graph
                 var nodeObj = {};
                 arAllModels = []; //construct an array of all the models references by this one
                 arNodes.forEach(function(node){
                 nodeObj[node.id] = node;
                 arAllModels.push({url:node.url})
                 });






                 return {references:lst,graphData:data, nodes : nodeObj,lstNodes : arAllModels};

                 function getNodeByUrl(url,label,nodes) {
                 if (nodes[url]) {
                 return nodes[url];
                 } else {
                 var ar = url.split('/')
                 //var label =
                 var node = {id: arNodes.length +1, label: ar[ar.length-1], shape: 'box',url:url};
                 if (arNodes.length == 0) {
                 //this is the first node
                 node.color = 'green'
                 node.font = {color:'white'}
                 }


                 nodes[url] = node;
                 arNodes.push(node);
                 return node;
                 }
                 }


                 function getModelReferences(lst,SD,srcUrl) {
                 var treeData = that.createTreeArrayFromSD(SD);

                 treeData.forEach(function(item){

                 if (item.data) {
                 //console.log(item.data.referenceUri);
                 if (item.data.referenceUri) {
                 var ref = {src:srcUrl, targ:item.data.referenceUri, path: item.data.path}
                 lst.push(ref);
                 var newSD = that.getModelFromBundle(bundle,item.data.referenceUri);
                 if (newSD) {
                 getModelReferences(lst,newSD,newSD.url)
                 }

                 }
                 }
                 })

                 }

                 */

            },
            getResourcesOfType : function(type,bundle){
                //get all the resources in the bundle of the given type
                var ar = [];
                bundle.entry.forEach(function(entry){
                    var resource = entry.resource;
                    if (resource.resourceType == type || type == 'Resource') {
                        ar.push(resource);
                    }
                })
                return ar;
            },
            getReferences: function (SD) {
                //get all the references for a StructureDefinition

                var references = []
                if (SD && SD.snapshot && SD.snapshot.element) {
                    SD.snapshot.element.forEach(function(ed){
                        if (ed.type) {
                            ed.type.forEach(function(type){
                                if (type.code == 'Reference') {
                                    if (type.profile) {



                                        //note that profile can be an array or a string
                                        if (angular.isArray(type.profile)) {
                                            references.push({path:ed.path,profile:type.profile[0].profile,min:ed.min, max:ed.max})
                                        } else {
                                            references.push({path:ed.path,profile:type.profile,min:ed.min, max:ed.max})
                                        }
                                    }
                                }
                            })
                        }
                    })
                }
                return references;
            }
        }

    })
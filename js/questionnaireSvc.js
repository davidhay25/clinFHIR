angular.module("sampleApp")
    .service('questionnaireSvc', function(Utilities,appConfigSvc,$q,$http,GetDataFromServer) {

        var elementsToIgnore = ['id', 'meta', 'implicitRules', 'language', 'contained','extension','modifierExtension'];

        var qPath = appConfigSvc.config().standardExtensionUrl.qPath;   //path in the resource
        var qMult = appConfigSvc.config().standardExtensionUrl.qMult;   //if the element is multiple in the resource
        var extFhirPath = appConfigSvc.config().standardExtensionUrl.fhirPath;   //the fhirpath

        var prePopHash = {};    //the paths that can be pre-populated...

        function getLastSegment(path) {
            var ar = path.split('.');
            return ar[ar.length-1]
        }

        return {
            setUpPrePop : function(resourceHash) {
                //the paths that can be pre-populated. This is rather manual...
                prePopHash = {};    //entries are always an array...

                //todo: need to think about datatype...
                if (resourceHash.Patient && resourceHash.Patient.entry && resourceHash.Patient.entry.length > 0) {
                    var patient = resourceHash.Patient.entry[0].resource;   //only the first one...
                    if (patient.name) {
                        prePopHash['Patient.name.given'] = {value:patient.name[0].given};
                        prePopHash['Patient.name.family'] = {value:[patient.name[0].family]};    //make an array
                    }
                    prePopHash['Patient.birthDate'] = {value:[patient.birthDate],dt:'date'};    //make an array
                }






            },
            prePopNode : function(node,resourceHash){
                //pre-populate the model answers based on the fhirPath. return a summary as well as the pre-pop
                var log = [];

                if (node.item) {
                    node.item.forEach(function(child){
                        var ext = Utilities.getSingleExtensionValue(child,extFhirPath);
                        if (ext) {
                            console.log(ext)
                            var fhirPath = ext.valueString;
                            if (prePopHash[fhirPath]) {
                                //there is a value we can pre-populate...
                                child.myMeta = child.myMeta || {}
                                if (! child.myMeta.answer) {
                                    //only pre-pop if there is no answer present...
                                    child.myMeta.answer = []
                                    var prePopElement = prePopHash[fhirPath];
                                    var prePopValues = prePopElement.value;
                                    if (prePopValues) {
                                        prePopValues.forEach(function (v) {
                                            var vo = {answer:v}
                                            vo.display = v;
                                            child.myMeta.answer.push(vo);
                                            // switch ()
                                        })
                                    }
                                }
                            }

                        }
                    })
                }









            },
            makeResource : function(QR) {
                //generate a resource based on the QR - assuming the simplefied section structure...
                var resource = {resourceType:'Thing'}

                function addElements(node,item){
                    item.item.forEach(function (item) {
                        if (item.answer && item.answer.length > 0) {
                            var multExt = Utilities.getSingleExtensionValue(item,qMult);
                            var pathExt = Utilities.getSingleExtensionValue(item,qPath);
                            var segment = getLastSegment(pathExt.valueString);

                            if (multExt && multExt.valueBoolean) {
                                node[segment] = [];
                                item.answer.forEach(function (ans) {
                                    //ans is a value of form value[x]:{obj}
                                    var keys = Object.keys(ans);
                                    var key = keys[0];
                                    node[segment].push(ans[key])
                                })
                            } else {
                                var ans = item.answer[0];
                                var keys = Object.keys(ans);
                                var key = keys[0];
                                if (segment.indexOf('[x]') > -1) {
                                    //this is a choice element & the name needs to be set...
                                    var prefix = segment.substr(0,segment.length-3);        //chop off the ...'[x]'
                                    var suffix = key.substr(5);                             //chop off the 'value'...
                                    segment = prefix+suffix;
                                }
                                node[segment] = ans[key];     //only the first item array should be populated...
                            }
                        }
                    })
                }

                addElements(resource,QR.item[0]);   //these are the root elements

                //now add the BBE elements...
                for (var i=1; i< QR.item.length; i++) {
                    var item = QR.item[i];
                    processSection(item);
                }

                console.log(resource)
                return resource;

                function processSection(section){
                    var elementName = section.text;
                    var hasAnswers = false;
                    var parent = {};
                    //see if there are any answered questions in this section...
                    section.item.forEach(function (itm) {
                        if (itm.answer && itm.answer.length > 0) {
                            hasAnswers = true;
                        }
                    });

                    if (hasAnswers) {
                        if (section.repeats) {
                            resource[elementName] = resource[elementName] || [];
                            resource[elementName].push(parent);
                        } else {
                            resource[elementName] = parent;
                        }

                        addElements(parent,section);    //adds elements that are direct children





                    }
                }

            },
            makeQR : function(Q){
                //generate a QuestionnaireResponse from a Q
                var errors = []
                var QR = angular.copy(Q);
                QR.resourceType = "QuestionnaireResponse";

                //remove the elements from items that aren't allowed in QR...
                function cleanQR(node){
                    node.item.forEach(function (item) {
                        if (item.myMeta &&item.myMeta.answer) {
                            item.answer = [];
                            item.myMeta.answer.forEach(function (ans) {
                                var dt = ans.dt;
                                dt='value'+ dt.charAt(0).toUpperCase() + dt.substr(1);
                                var newAns = {};
                                newAns[dt] = ans.value;
                                item.answer.push(newAns);
                                Utilities.addExtensionOnce(item,qPath,{valueString:item.myMeta.path});
                                if (item.repeats) {
                                    Utilities.addExtensionOnce(item,qMult,{valueBoolean:true})
                                }
                            });
                            delete item.myMeta;
                            delete item.item;       //can't have child questions..
                            delete item.repeats;
                        }

                        if (item.item && item.item.length > 0) {
                            //can't have both items aan an answer...
                            if (item.answer && item.answer.length > 0) {
                                errors.push({item:item,msg:"Has both answers and child questions. Answers removed."})
                            }
                            delete item.answer;
                            cleanQR(item)
                        }
                    })
                }

                cleanQR(QR);
                var resource = this.makeResource(QR);
                var vo = {QR:QR,err:errors,resource:resource};

                console.log(vo)

                return (vo)


            },
            makeQ : function(treeData) {
                //construct a Questionnaire from the tree data - resource style...
                //note that for ease of use we include the answer in the questionnaire - these need to be pulled out to a separate resource if saving...
                var Q = {resourceType:'Questionnaire',status:'draft'}
                var clone = angular.copy(treeData)
                var childHash = {}
                var linkId=0

                var qItemDescription = appConfigSvc.config().standardExtensionUrl.qItemDescription; //description of the question


                clone.forEach(function (node) {
                    childHash[node.parent] = childHash[node.parent] || []
                    childHash[node.parent].push(node)
                });
                //console.log(childHash);

                //set the type of th equestionnaire item - and the options if coded...
                var setQType = function (item,ed) {
                    if (ed && ed.type && ed.type[0]) {
                        var dt = ed.type[0].code
                        var typ = 'string';
                        //console.log(dt)
                        switch (dt) {
                            case 'date' :
                                typ = 'date'
                                break;
                            case 'CodeableConcept' :
                                //could either be 'choice' or 'open-choice' depending on binding...
                                typ = 'choice';     //most common default...
                                if (ed.binding) {
                                    if (ed.binding.strength == 'required') {
                                        typ = 'open-choice'
                                    }
                                    if (ed.binding.valueSetUri) {
                                        //todo this should really be a reference - need to go through all of CF and correct :(
                                        item.options = {reference:ed.binding.valueSetUri}
                                    }
                                    if (ed.binding.valueSetReference && ed.binding.valueSetReference.reference) {
                                        item.options = {reference: ed.binding.valueSetReference.reference}
                                    }
                                }


                                break;
                         }
                         item.type = typ;

                    }


                }
/*
                var getQTypeFromDataTypeDEP = function(dt) {
                  //  var dt



                    var rtn = 'string';
                    console.log(dt)
                    switch (dt) {
                        case 'date' :
                            rtn = 'date'
                            break;
                        case 'CodeableConcept' :

                            break;
                        default :


                    }


                    return rtn;
                };
*/
                //add the description extensoion...
                var addDescription = function(item,ed) {
                    if (ed && ed.definition) {
                        Utilities.addExtensionOnce(item,qItemDescription,{valueString:ed.definition})

                    }
                };

                //add the FHIRPath extension...
                var addFHIRPath = function(item,ed) {

                    if (ed && ed.mapping) {

                        ed.mapping.forEach(function(map){
                            if (map.identity == 'fhir') {
                                var ar = map.map.split('|');
                                var fp = ar[0];
                                Utilities.addExtensionOnce(item,extFhirPath,{valueString:fp})
                            }
                        })
                    }
                };


                //this routine is used for bbe off the root
                var addItemsFromNode = function(node,parentPath){
                    //add all nodes with the given parentparentPath
                    //console.log(parentPath, childHash[parentPath]);

                    if (childHash[parentPath]) {
                        childHash[parentPath].forEach(function (child) {

                            var ed = child.data.ed;          //the ElementDefinition from the LM...
                            if (ed && ed.type && ed.type.length > 0) {
                                var item = {linkId: 'id' + linkId++, text: child.text};
                                //item.type = getQTypeFromDataType(ed.type[0].code)
                                setQType(item,ed)
                                addDescription(item,ed);
                                addFHIRPath(item,ed)
                                if (ed.max == '*') {
                                    item.repeats = true;
                                }




                                //item.myMeta.path = ed.path;
                                node.item.push(item);

                                if (ed.type[0].code == 'BackboneElement' || ed.type[0].code == 'Reference') {
                                    //This is a bbe with child elements, or a reference - but not a data input field...
                                    //console.log('bbe '+ ed.path)

                                    item.item = [];
                                    addItemsFromNode(item, ed.path)

                                } else {
                                    //item.type = 'string'
                                }

                            } else {
                                console.log(child.text + ': Element with no type')
                            }

                        })
                    }
                };


                //add the first question. the root children will be off that
                var rootItem = {linkId:'id'+linkId++,item:[]};
                rootItem.text = 'Root';
                Q.item = [rootItem];

                //add a text element...
                var textEd = {type:[{code:'string'}]}
                var textItem = {linkId:'id'+linkId++,text:'Text', type:'string',item:[]};
                var modelRoot = treeData[0].data.pathSegment;
               // textItem.myMeta.path = modelRoot + ".text"

                rootItem.item.push(textItem);

                var arRootChildren = childHash[clone[0].id];        //nodes that are children of the first element

                arRootChildren.forEach(function (child) {
                    //add a question for each child...

                    var ed = child.data.ed;          //the ElementDefinition from the LM...
                    if (ed && ed.type && ed.type.length > 0) {
                        if (ed.type[0].code == 'BackboneElement' || ed.type[0].code == 'Reference' ) {
                            //a set of elements...
                            var parentItem = {linkId:'id'+linkId++,text:child.text, item:[]};
                            //parentItem.type = getQTypeFromDataType(ed.type[0].code);
                            setQType(parentItem,ed)
                            addDescription(parentItem,ed);
                            addFHIRPath(parentItem,ed);
                            if (ed.max == '*') {
                                parentItem.repeats = true;
                            }
                            Q.item.push(parentItem);

                            addItemsFromNode(parentItem,child.id)
                        } else {
                            //a single element
                            var lastSegment = getLastSegment(ed.path);
                            if (elementsToIgnore.indexOf(lastSegment) == -1) {
                                var item = {linkId:'id'+linkId++,text:child.text, item:[]};
                                //item.type = getQTypeFromDataType(ed.type[0].code)
                                setQType(item,ed)
                                addDescription(item,ed);
                                addFHIRPath(item,ed);
                                if (ed.max == '*') {
                                    item.repeats = true;
                                }
                              //  item.myMeta.path = ed.path;
                                rootItem.item.push(item)
                            }
                        }
                    }
                });


                //addItemsFromNode(Q,clone[0].id)

                console.log(Q);
                return Q;



            },
            findQ : function() {
                //load all the CF authored Questionnaires
                var deferred = $q.defer();
                var url = appConfigSvc.getCurrentConformanceServer().url + "Questionnaire";



                GetDataFromServer.adHocFHIRQueryFollowingPaging(url).then(
                    function(data) {
                        if (data && data.data && data.data.entry) {
                            var bundle = {resourceType:'Bundle',entry:[]}
                            data.data.entry.forEach(function (entry) {
                                var Q = entry.resource;
                                //if this questionnaire is authored by CF than add it...
                                if (Utilities.isAuthoredByClinFhir(Q)){
                                    bundle.entry.push({resource:Q})
                                }

                            });

                            console.log(bundle)
                            deferred.resolve(bundle)
                        } else {
                            alert("No Questionnaires found")
                            deferred.reject(err);
                        }

                    },
                    function(err) {
                        alert(angular.toJson(err))
                        deferred.reject(err);
                    }
                )
                return deferred.promise;

            },
            saveQ : function(Q,name) {
                var deferred = $q.defer();
                var url = appConfigSvc.getCurrentConformanceServer().url + 'Questionnaire/'+name;
                Utilities.setAuthoredByClinFhir(Q);
                Q.url = url;
                Q.id = name;
                $http.put(url,Q).then(
                    function() {
                        deferred.resolve('Questionnaire saved with the URL: '+url)
                    },
                    function(err) {
                        deferred.reject(angular.toJson(err))
                    }
                );




                return deferred.promise;
            },
            makeLMFromProfile : function(inProfile) {
                //copied from profileDiff service - adapt to needs of Questionnaire...
                var elementsToDisable = ['id', 'meta', 'implicitRules', 'language', 'contained','DomainResource','modifierExtension'];
                var deferred = $q.defer();
                var profile = angular.copy(inProfile);
                var lstTree = [];
                var lst = [];           //this will be a list of elements in the profile to show.
                var queries = [];       //a list of queries to get the details of extensions...
                var loadErrors = [];        //any errors during loading
                var hashPath = {};      //hash of paths to id. If there's more than one with a path, only the most recent
                if (profile && profile.snapshot && profile.snapshot.element) {

                    profile.snapshot.element.forEach(function (item, inx) {
                        item.myMeta = {id:inx} ;        //create a separate index for internal linking...
                        var path = item.path;
                        var ar=path.split('.');
                        if (ar.length == 1) {
                            //this is the root
                            hashPath[path] = inx;
                            lstTree.push({id:inx,parent:'#',text:ar[0],state:{opened:true,selected:true},path:path,data: {ed : item}});
                        } else {
                            var segment = ar.splice(-1,1)[0];   //the last entry in the path...
                            var parent = ar.join('.');
                            var node = {id:inx, text:path, state: {}, data: {ed : item, myMeta:{}}};

                            //standard element names like 'text' or 'language'. Note that hidden elements are actually removed form the tree b4 returning...
                            if (elementsToDisable.indexOf(segment) > -1) {
                                node.state.hidden=true;
                            }

                            //the narrative text. The Q adds this in manually...
                            if (ar.length == 1 && segment == 'text') {
                                node.state.hidden=true;
                            }

                            /*if (ar.length == 1 && elementsToDisable.indexOf(segment) > -1) {
                                node.state.hidden=true;
                            }*/


                            //find the hash of the parent, and set the id in the node
                            var pos = hashPath[parent];
                            if (pos!== undefined) {
                                node.parent = pos;
                                lstTree.push(node);
                            } else {
                                console.log("can't find parent: ",item)
                            }

                            //now set the hash, replacing any previous one. This is important in representing sliced elements correctly
                            hashPath[path] = inx;

                            //are there any fixed values
                            angular.forEach(item,function(value,key) {
                                if (key.substr(0,5)=='fixed') {
                                    item.myMeta.fixed = {key:key,value:value}
                                }
                            });

                            //is this a discriminator entry
                            if (item.slicing) {
                                // node.a_attr = {style:'color:blue'}
                            }

                            node.text = getDisplay(node);


                            if (segment == 'extension') {

                                //set the text to a better display (not the path)
                                node.text = item.name || item.short || node.text;

                                //if the extension has a profile type then include it, otherwise not...
                                if (item.type) {
                                    item.type.forEach(function (it) {
                                        if (it.code == 'Extension') {
                                            //load the extension definition
                                            if (it.profile) {
                                                queries.push(GetDataFromServer.findConformanceResourceByUri(it.profile).then(
                                                    function (sdef) {
                                                        var analysis = Utilities.analyseExtensionDefinition3(sdef);
                                                        item.myMeta.analysis = analysis;

                                                    }, function (err) {
                                                        loadErrors.push({
                                                            type: 'missing StructureDefinition',
                                                            value: it.profile
                                                        });
                                                        item.myMeta.analysis = {}
                                                    }
                                                ));
                                            } else {
                                                //this is an extension with no profile...
                                                node.state.hidden = true;

                                            }
                                        }
                                    })
                                }
                            }
                        }
                    });



                    //resolve any extensions
                    if (queries.length) {
                        $q.all(queries).then(
                            function() {
                                //add the child nodes for any complex extensions...  item.myMeta.analysis
                                var newNodes = [];      //create a separate array to hold the new nodes...
                                lstTree.forEach(function(node){
                                    if (node.data && node.data.ed && node.data.ed.myMeta) {
                                        var analysis = node.data.ed.myMeta.analysis;
                                        if (analysis && analysis.isComplexExtension) {
                                            if (analysis.children) {
                                                //add the child nodes for the complex extension...
                                                analysis.children.forEach(function(child){
                                                    var id = 'ce'+lstTree.length+newNodes.length;
                                                    var newNode = {id:id,parent:node.id,text:child.code,state:{opened:false,selected:false},
                                                        a_attr:{title: + id}};
                                                    newNode.data = {ed : child.ed};
                                                    newNodes.push(newNode);

                                                })
                                            }
                                        }
                                    }

                                });

                                lstTree = lstTree.concat(newNodes)
                                deferred.resolve({treeData:removeHidden(lstTree),errors: loadErrors})
                            }
                        )

                    } else {
                        deferred.resolve({treeData:removeHidden(lstTree),errors: loadErrors})
                    }


                }

                return deferred.promise;


                function removeHidden(lst) {
                    var treeData =[];
                    var hash = {}
                    lst.forEach(function (item,inx) {
                        var include = true
                        if (item.state && item.state.hidden){
                            include = false
                        }
                        if (inx == 0 || (include && hash[item.parent])) {
                            treeData.push(item)
                            hash[item.id] = 'x'
                        }
                    })
                    return treeData;
                }


                //get the text display for the element
                function getDisplay(node) {
                    var ed = node.data.ed;
                    var display = ed.path;

                    var ar = ed.path.split('.');
                    display = ar[ar.length-1]
                    /*if (ar.length > 1) {

                        ar.splice(0,1)
                        display = ar.join('.')
                    }
                    */

                    if (display == 'extension') {
                        if (ed.sliceName) {
                            display=ed.sliceName
                        } else if (ed.label) {
                            display=ed.label
                        } else if (ed.name) {
                            display=ed.name;
                        } else if (ed.short) {
                            display=ed.short;
                        }
                    }

                    return display;
                }


            }

        }
    });
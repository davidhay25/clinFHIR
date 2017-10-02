angular.module("sampleApp")
//this performs marking services


    .service('questionnaireSvc', function(Utilities,appConfigSvc,$q) {

        var elementsToIgnore = ['id', 'meta', 'implicitRules', 'language', 'contained','extension','modifierExtension'];

        var qPath = appConfigSvc.config().standardExtensionUrl.qPath;
        var qMult = appConfigSvc.config().standardExtensionUrl.qMult;

        function getLastSegment(path) {
            var ar = path.split('.');
            return ar[ar.length-1]
        }

        return {
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
                clone.forEach(function (node) {
                    childHash[node.parent] = childHash[node.parent] || []
                    childHash[node.parent].push(node)
                });
                console.log(childHash);

                //this routine is used for bbe off the root
                var addItemsFromNode = function(node,parentPath){
                    //add all nodes with the given parentparentPath
                    console.log(parentPath, childHash[parentPath]);
                    //node.item = []
                    childHash[parentPath].forEach(function(child) {

                        var ed = child.data.ed;          //the ElementDefinition from the LM...
                        if (ed && ed.type && ed.type.length > 0) {
                            var item = {linkId:'id'+linkId++, text:child.text,  myMeta:{answer:[],ed:ed}};
                            if (ed.max == '*') {
                                item.repeats = true;
                            }
                            item.myMeta.path = ed.path;
                            node.item.push(item);

                            if (ed.type[0].code == 'BackboneElement') {
                                //This is a bbe with child elements - but not a data input field...
                                //item.type = 'group'
                                console.log('bbe '+ ed.path)

                                item.item = [];
                                addItemsFromNode(item,ed.path)
                                //addItemsFromNode(node,ed.path)      //<<< careplan.activity.detail




                            } else {
                                //item.type = 'string'
                            }






                        } else {
                            console.log(child.text +': Element with no type')
                        }

                    })
                };


                //add the first question. the root children will be off that
                var rootItem = {linkId:'id'+linkId++,item:[]};
                rootItem.text = 'Root';
                Q.item = [rootItem];

                //add a text element...
                var textEd = {type:[{code:'string'}]}
                var textItem = {linkId:'id'+linkId++,text:'Text', item:[],myMeta:{answer:[],ed:textEd}};
                var modelRoot = treeData[0].data.pathSegment;
                textItem.myMeta.path = modelRoot + ".text"
                rootItem.item.push(textItem);

                var arRootChildren = childHash[clone[0].id];        //nodes that are chilren of the first element
                arRootChildren.forEach(function (child) {
                    //add a question for each child...

                    var ed = child.data.ed;          //the ElementDefinition from the LM...
                    if (ed && ed.type && ed.type.length > 0) {
                        if (ed.type[0].code == 'BackboneElement' ) {

                            var parentItem = {linkId:'id'+linkId++,text:child.text, item:[]};
                            if (ed.max == '*') {
                                parentItem.repeats = true;
                            }
                            Q.item.push(parentItem);

                            addItemsFromNode(parentItem,child.id)
                        } else {
                            var lastSegment = getLastSegment(ed.path);
                            if (elementsToIgnore.indexOf(lastSegment) == -1) {
                                var item = {linkId:'id'+linkId++,text:child.text, item:[],myMeta:{answer:[],ed:ed}};

                                if (ed.max == '*') {
                                    item.repeats = true;
                                }
                                item.myMeta.path = ed.path;
                                rootItem.item.push(item)
                            }
                        }
                    }
                });


                //addItemsFromNode(Q,clone[0].id)

                console.log(Q);
                return Q;



            },
            makeLMFromProfile : function(inProfile) {
                //copied from profileDiff service - adapt to needs of Questionnaire...
                var elementsToDisable = ['id', 'meta', 'implicitRules', 'language', 'text', 'contained','DomainResource'];
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
                        var ar=path.split('.')
                        if (ar.length == 1) {
                            //this is the root
                            hashPath[path] = inx;
                            lstTree.push({id:inx,parent:'#',text:ar[0],state:{opened:true,selected:true},path:path,data: {ed : item}});
                        } else {
                            var segment = ar.splice(-1,1)[0];   //the last entry in the path...
                            var parent = ar.join('.');
                            var node = {id:inx, text:path, state: {}, data: {ed : item, myMeta:{}}};

                            //standard element names like 'text' or 'language'. Note that hidden elements are actually removed form the tree b4 returning...
                            if (ar.length == 1 && elementsToDisable.indexOf(segment) > -1) {
                                node.state.hidden=true;
                            }

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


                                //node.a_attr = {style:'color:blueviolet'}
                                //if the extension has a profile type then include it, otherwise not...
                                if (item.type) {
                                    item.type.forEach(function (it) {
                                        if (it.code == 'Extension' && it.profile) {
                                            //load the extension definition
                                            queries.push(GetDataFromServer.findConformanceResourceByUri(it.profile).then(
                                                function(sdef) {
                                                    var analysis = Utilities.analyseExtensionDefinition3(sdef);
                                                    item.myMeta.analysis = analysis;

                                                }, function(err) {
                                                    // modalService.showModal({}, {bodyText: 'makeProfileDisplayFromProfile: Error retrieving '+ it.profile + " "+ angular.toJson(err)})
                                                    loadErrors.push({type:'missing StructureDefinition',value:it.profile})
                                                    item.myMeta.analysis = {}
                                                }
                                            ));
                                        }
                                    })
                                }
                            }
                        }
                    });



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
                    if (ar.length > 1) {
                        ar.splice(0,1)
                        display = ar.join('.')
                    }

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
    })
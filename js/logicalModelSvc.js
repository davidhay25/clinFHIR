angular.module("sampleApp")
    //this returns config options. At the moment it is for servers...
    //also holds the current patient and all their resources...
    //note that the current profile is maintained by resourceCreatorSvc

    .service('logicalModelSvc', function($http,$q,appConfigSvc,GetDataFromServer,Utilities) {

        var currentUser;
        
        return {
            generateSample : function(SD) {

                return;
                
                //generate a sample message based on the Logical Model. 
                var sample = {};

                if (SD && SD.snapshot && SD.snapshot.element) {
                    var parent = {}
                    SD.snapshot.element.forEach(function(ed){
                        var path = ed.path;
                        var ar = path.split('.');
                        var leaf = ar[ar.length-1];
                        if (! parent[leaf]) {
                            parent[leaf] = leaf
                        }
                        parent = parent[leaf]

                    })
                }

                var getNodeFromPath = function(path) {
                    var ar = path.split('.');
                    ar.forEach(function(segment){
                       // if (!)
                    })
                }
                
                console.log(parent)
            },
            
            getOptionsFromValueSet : function(element) {
                //return the expanded set of options from the ValueSet
                var deferred = $q.defer();
                //console.log(element);


                if (element && element.selectedValueSet && element.selectedValueSet.vs && element.selectedValueSet.vs.url) {
                    GetDataFromServer.getValueSet(element.selectedValueSet.vs.url).then(
                        function(vs) {
                            //console.log(vs)

                            //the extension that indicates the vs (authored by CF) has direct concepts that are not snomed so can't be expanded
                            var extensionUrl = appConfigSvc.config().standardExtensionUrl.vsDirectConcept;
                            var ext = Utilities.getSingleExtensionValue(vs,extensionUrl)
                            if (ext && ext.valueBoolean) {
                                //first, create an array with all of the composed concepts...
                                var ar = [];
                                vs.compose.include.forEach(function(inc){
                                    ar = ar.concat(inc.concept)
                                });

                                //now create a filtered return array
                                var returnArray = []
                                if (ar && ar.length > 0) {
                                    ar.forEach(function(item){
                                        returnArray.push(item)
                                    });
                                }

                                deferred.resolve(returnArray);

                            } else {
                                var id = vs.id;

                                GetDataFromServer.getExpandedValueSet(id).then(
                                    function(data){
                                        if (data.expansion && data.expansion.contains) {
                                            deferred.resolve(data.expansion.contains);

                                        } else {
                                            deferred.resolve()
                                        }
                                    }, function(err){
                                        deferred.reject(err)
                                    }
                                )
                            }

                        },
                        function(err) {
                            deferred.reject(err);
                        }
                    )
                } else {
                    deferred.resolve();
                }

                return deferred.promise;


            },
            insertModel : function(element,insertModel) {

            },
            addSimpleExtension : function(sd,url,value) {
                //add a simple extension as a string;
                sd.extension = sd.extension || []
                sd.extension.push({url:url,valueString:value})
            },
            setCurrentUser : function(user) {
                currentUser = user;
            },
            getCurrentUser : function(){
                return currentUser;
            },
            getAllPathsForType : function(typeName){
                //return all the possible paths for a base type...
                var deferred = $q.defer();
                var url = "http://hl7.org/fhir/StructureDefinition/"+typeName;

                GetDataFromServer.findConformanceResourceByUri(url).then(
                    function(SD){
                        if (SD && SD.snapshot && SD.snapshot.element) {
                            var lst = []
                            SD.snapshot.element.forEach(function(ed) {
                                lst.push(ed.path)
                            })
                            deferred.resolve(lst)
                        }


                    },function(err) {
                        alert("error qith query: "+url + "\n"+angular.toJson(err));
                        deferred.reject();
                    }
                )
                return deferred.promise;



            },
            clone : function(baseSD,rootName) {
                //make a copy of the SD changing the rootName in the path...
                var newSD = angular.copy(baseSD);
                newSD.id = rootName;
                var arUrl = newSD.url.split('/');
                arUrl[arUrl.length-1] = rootName;
                newSD.url = arUrl.join('/');
                newSD.name = rootName;
                newSD.status = 'draft';
                newSD.date =  moment().format()
                


                newSD.snapshot.element.forEach(function(ed) {
                    var path = ed.path;
                    var arPath = path.split('.');
                    arPath[0] = rootName;
                    ed.path = arPath.join('.')
                })
                return newSD;

            },
            createFromBaseType : function(treeData,typeName,rootName) {
              //create a model from the base type, only bringing across stuff we want.
                //todo - very similar to the logic in createTreeArrayFromSD() - ?call out to separate function...
                var deferred = $q.defer();
                var elementsToIgnore =['id','meta','implicitRules','language','text','contained','extension','modifierExtension'];
                var url = "http://hl7.org/fhir/StructureDefinition/"+typeName;

                GetDataFromServer.findConformanceResourceByUri(url).then(
                    function(SD){
                        SD.snapshot.element.forEach(function(ed){
                            var path = ed.path;
                            var arPath = path.split('.');

                            if (arPath.length > 1) { //skip the first one

                                arPath[0] = rootName;           //use the rootname of the Logical Model
                                var idThisElement = arPath.join('.')
                                var treeText = arPath.pop();//
                                var include = true;
                                if (elementsToIgnore.indexOf(treeText) > -1) {
                                    include = false;
                                }


                                if (include) {
                                    var parentId = arPath.join('.');
                                    var item = {};

                                    item.id = idThisElement;
                                    item.text = treeText;
                                    item.data = {};
                                    item.parent = parentId;
                                    item.state = {opened:true};     //default to fully expanded

                                    item.data.path = idThisElement;     //is the same as the path...
                                    item.data.name = item.text;
                                    item.data.short = ed.short;
                                    item.data.description = ed.definition;
                                    item.data.type = ed.type;
                                    item.data.min = ed.min;
                                    item.data.max = ed.max;

                                    item.data.comments = ed.comments;

                                    //note that we don't retrieve the complete valueset...
                                    if (ed.binding) {
                                        item.data.selectedValueSet = {strength:ed.binding.strength};
                                        item.data.selectedValueSet.vs = {url:ed.binding.valueSetUri};
                                        item.data.selectedValueSet.vs.name = ed.binding.description;


                                        //this is a reference not a name - make up a uri (todo - load the reference to get the URL
                                        if (ed.binding.valueSetReference) {
                                            //todo - this is safe ONLY when loading one of the base types in the spec...
                                            item.data.selectedValueSet.vs.url = ed.binding.valueSetReference.reference;
                                        }

                                    }



                                    treeData.push(item);
                                }






                            }
                        })
                        deferred.resolve(treeData);

                    },
                    function(err) {
                        alert(angular.toJson(err))
                        deferred.reject(err)
                    }
                )

                return deferred.promise;

            },
            getModelHistory : function(id){
                var url = appConfigSvc.getCurrentConformanceServer().url + "StructureDefinition/" + id + "/_history";
                return $http.get(url);
            },
            createTreeArrayFromSD : function(sd) {
                //generate the array that the tree uses from the StructureDefinition
                var mappingCommentUrl = appConfigSvc.config().standardExtensionUrl.edMappingComment;
                var mapToModelExtensionUrl = appConfigSvc.config().standardExtensionUrl.mapToModel;
                var baseTypeForModel = appConfigSvc.config().standardExtensionUrl.baseTypeForModel;

                var arTree = [];
                if (sd && sd.snapshot && sd.snapshot.element) {

                    sd.snapshot.element.forEach(function(ed){
                        var path = ed.path;     //this is always unique in a logical model...
                        var arPath = path.split('.');
                        var item = {}
                        item.id = path;
                        item.text = arPath[arPath.length -1];   //the text will be the last entry in the path...
                        item.data = {};
                        if (arPath.length == 1) {
                            //this is the root node
                            item.parent = '#';
                            item.data.isRoot = true;
                            //now set the header data...
                            item.data.header = {};
                            item.data.header.name = sd.name;
                            
                            //the name of the next 2 elements changed after baltimore, so look in both places until the other stu3 servrs catch up...
                            item.data.header.purpose = sd.purpose || sd.requirements;
                            item.data.header.title = sd.title || sd.display;  

                            item.data.header.extension = sd.extension     //save any resource level extensions...

                            //see if this model has a base type
                            var ext1 = Utilities.getSingleExtensionValue(sd,baseTypeForModel)
                            if (ext1 && ext1.valueString) {
                                item.data.header.baseType = ext1.valueString;

                            }


                            //note that mapping node is different in the SD and the ED - but in the same place in the treeData
                            if (sd.mapping && sd.mapping.length > 0) {

                                item.data.header.mapping = sd.mapping[0].comments;
                                item.data.mapping = sd.mapping[0].comments;     //for the report & summary view...
                            }
                            if (sd.useContext) {
                                item.header = {type :sd.useContext[0].valueCodeableConcept.code};
                            }

                        } else {
                            //otherwise the parent can be inferred from the path
                            arPath.pop();//
                            item.parent = arPath.join('.');
                            if (ed.min == 1) {
                                item['li_attr'] = {class : 'elementRequired'};
                            }

                            if (ed.fixedString) {
                                item['li_attr'] = {class : 'elementFixed'};
                            }


                        }
                        item.state = {opened:true};     //default to fully expanded


                        item.data.fixedString =ed.fixedString;      //todo, this should probably be a type compatible with this element
                        item.data.path = path;
                        item.data.name = item.text;
                        item.data.short = ed.short;
                        item.data.description = ed.definition;
                        item.data.type = ed.type;
                        
                        if (ed.type && ed.type[0].profile) {
                            item.data.referenceUri = ed.type[0].profile
                        }

                        //determine if this is a coded or a reference type
                        if (ed.type) {
                            ed.type.forEach(function(typ){
                                if (['CodeableConcept','Coding','code'].indexOf(typ.code) > -1) {
                                    item.data.isCoded = true;
                                }

                                if (typ.code == 'Reference') {
                                    item.data.isReference = true;   //used to populate the 'is reference' table...
                                }

                            })
                        }


                        
                        item.data.min = ed.min;
                        item.data.max = ed.max;

                        if (ed.mapping) {           //the mapping path in the target resource...
                            var mapItem = ed.mapping[0];    //the actual map - assume only 1...
                            item.data.mappingPath = mapItem.map;      //the identity is currently hard coded
                            if (mapItem.extension) {
                                //there are extensions on this item - find the comment...
                                var ext = Utilities.getSingleExtensionValue(mapItem,mappingCommentUrl)
                                if (ext && ext.valueString) {
                                    item.data.mapping = ext.valueString;
                                }

                                var ext1 = Utilities.getSingleExtensionValue(mapItem,mapToModelExtensionUrl)
                                if (ext1 && ext1.valueUri) {
                                    item.data.mapToModelUrl = ext1.valueUri;
                                    item.data.referenceUri = ext1.valueUri;     //for the table dsplay...
                                    item.data.isReference = true;   //this element references another model
                                }


                            }
                            
                            
                        }




                        item.data.comments = ed.comments;

                        //note that we don't retrieve the complete valueset...
                        if (ed.binding) {
                            item.data.selectedValueSet = {strength:ed.binding.strength};
                            item.data.selectedValueSet.vs = {url:ed.binding.valueSetUri};
                            item.data.selectedValueSet.vs.name = ed.binding.description;
                        }
                        
                       
                        /*
                        if (data.selectedValueSet) {
                            ed.binding = {strength:data.selectedValueSet.strength};
                            ed.binding.valueSetUri = data.selectedValueSet.vs.url;
                            ed.binding.description = 'The bound valueset'

                        }
                        */


                        arTree.push(item);
                    });


                }
                return arTree;
            },
            makeSD : function(scope,treeData) {     //todo - don't pass in scope...
                //create a StructureDefinition from the treeData
                var header = treeData[0].data.header || {} ;     //the first node has the header informatiion
                //console.log(header)
                var mappingCommentUrl = appConfigSvc.config().standardExtensionUrl.edMappingComment;
                var mapToModelExtensionUrl = appConfigSvc.config().standardExtensionUrl.mapToModel;
                var baseTypeForModelUrl = appConfigSvc.config().standardExtensionUrl.baseTypeForModel;
                
                //todo - should use Utile.addExtension...
                var sd = {resourceType:'StructureDefinition'};
                if (currentUser) {
                    this.addSimpleExtension(sd,'http:www.clinfhir.com/StructureDefinition/userEmail',currentUser.email)
                }

                if (header.baseType) {
                    Utilities.addExtensionOnce(sd,baseTypeForModelUrl,{valueString:header.baseType})
                   // this.addSimpleExtension(sd,baseTypeForModel,header.baseType)
                }


                sd.id = scope.rootName;
                sd.url = appConfigSvc.getCurrentConformanceServer().url + "StructureDefinition/"+sd.id;
                sd.name = header.name;
                sd.title = header.title;
                sd.status='draft';
                sd.date = moment().format();


                //sd.

                sd.purpose = header.purpose;
                sd.description = header.description;

                sd.publisher = scope.input.publisher;
                //at the time of writing (Oct 12), the implementaton of stu3 varies wrt 'code' & 'keyword'. Remove this eventually...
                sd.identifier = [{system:"http://clinfhir.com",value:"author"}]
                sd.keyword = [{system:'http://fhir.hl7.org.nz/NamingSystem/application',code:'clinfhir'}]

                if (header.mapping) {
                    //mapping comments for the target resource as a whole...
                    sd.mapping = [{identity:'fhir',name:'Model Mapping',comments:header.mapping}]
                }

                if (header.type) {
                    var uc = {code : {code:'logicalType',system:'http:www.hl7.org.nz/NamingSystem/logicalModelContext'}};
                    uc.valueCodeableConcept = {coding:[{code:header.type,'system':'http:www.hl7.org.nz/NamingSystem/logicalModelContextType'}]}
                    sd.useContext = [uc]

                }

                sd.kind='logical';
                sd.abstract=false;
                sd.baseDefinition ="http://hl7.org/fhir/StructureDefinition/Element";
                sd.type = scope.rootName;
                sd.derivation = 'specialization';

                sd.snapshot = {element:[]};

                treeData.forEach(function(item){
                    var data = item.data;
                    // console.log(data);
                    var ed = {}
                    ed.id = data.path;
                    ed.path = data.path;
                    ed.short = data.short;
                    ed.definition = data.description || 'No description';
                    ed.min=data.min;
                    ed.max = data.max;
                    ed.comments = data.comments;
                    if (data.mappingPath) {         //the actual path in the target resource
                        ed.mapping= [{identity:'fhir',map:data.mappingPath}]
                    }

                    if (data.mapping) {
                        //comments about the mapping - added as an extension to the first mapping node mapping
                        var mappingNode = {}
                        if (ed.mapping) {
                            //just in case there is more than on emapping
                            mappingNode = ed.mapping[0]
                        } else {
                            ed.mapping = []
                        }

                        //adds an extension of this url once only to the specified node
                        Utilities.addExtensionOnce(mappingNode,mappingCommentUrl,{valueString:data.mapping})
                        //ed.mapping = ed.mapping || []
                        ed.mapping[0] = mappingNode;
                    }

                    
                    if (data.mapToModelUrl) {
                        //this element will actually be mapped to another model (eventually another profile)
                        //also added as an extension to the first mapping node mapping
                        var mapToModelNode = {}
                        if (ed.mapping) {
                            mapToModelNode = ed.mapping[0]
                        } else {
                            ed.mapping = []
                        }

                        //adds an extension of this url once only to the specified node
                        Utilities.addExtensionOnce(mapToModelNode,mapToModelExtensionUrl,{valueUri:data.mapToModelUrl})
                        ed.mapping = ed.mapping || []
                        ed.mapping[0] = mapToModelNode;




                    }


                    if (data.type) {
                        ed.type = [];
                        data.type.forEach(function(typ) {
                            //actually, there will only ever be one type at the moment...
                            ed.type.push(typ);
                        })
                    }

                    ed.base = {
                        path : ed.path, min:0,max:'1'
                    };

                    if (data.selectedValueSet) {
                        ed.binding = {strength:data.selectedValueSet.strength};
                        ed.binding.valueSetUri = data.selectedValueSet.vs.url;
                        ed.binding.description = data.selectedValueSet.vs.name;

                    }

                    ed.fixedString = data.fixedString;  //todo needs to be a compatible type

                    sd.snapshot.element.push(ed)
                });

                return sd;
            },
            reOrderTree : function(treeData) {
                //ensure the elements in the tree array are sorted by parent / child
                var arTree = [treeData[0]];

                findChildren(treeData[0].data.path,treeData[0].id,arTree);
                return arTree;


                function findChildren(parentPath,parentId,arTree) {
                    treeData.forEach(function(node){
                        if (node.parent == parentId) {
                            arTree.push(node);
                            var childPath = parentPath + '.' + node.data.name;
                            //console.log(childPath);
                           // node.data.path = childPath;
                            findChildren(childPath,node.id,arTree)
                        }
                    })

                }

            },
            generateChatDisplay : function(chatFromServer) {
               

                var ar = [];    //a list of all comments in display order

                function parseComment(ar,lvl,comment,levelKey) {
                    //lvl- display level, comment - the chat being examined

                    if (lvl == 1) {
                        levelKey = comment.id;
                    }

                    var displayComment = {level:lvl,comment:comment,levelKey:levelKey}
                    ar.push(displayComment);
                    //console.log(displayComment)
                    if (comment.children) {
                        lvl++;
                        comment.children.forEach(function(childComment){
                            parseComment(ar,lvl,childComment,levelKey)
                        })
                    }

                }
                parseComment(ar,0,chatFromServer);

                console.log(ar)

                return ar


        },
            resolveProfile : function(url) {
                //return a SD as a logical model from a profile that resolves extensions....
                var deferred = $q.defer();
                GetDataFromServer.findConformanceResourceByUri(url).then(
                    function(SD) {
                        console.log(SD)

                        if (SD && SD.snapshot && SD.snapshot.element) {
                            SD.snapshot.element.forEach(function(ed){
                                console.log(ed.path)
                            })

                        }

                    }
                )
                return deferred.promise;

            }

            }
        });
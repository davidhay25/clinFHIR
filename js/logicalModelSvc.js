angular.module("sampleApp")
    //this returns config options. At the moment it is for servers...
    //also holds the current patient and all their resources...
    //note that the current profile is maintained by resourceCreatorSvc

    .service('logicalModelSvc', function($http,$q,appConfigSvc,GetDataFromServer) {

        var currentUser;
        
        return {
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
                                    /*
                                     if (data.selectedValueSet) {
                                     ed.binding = {strength:data.selectedValueSet.strength};
                                     ed.binding.valueSetUri = data.selectedValueSet.vs.url;
                                     ed.binding.description = 'The bound valueset'

                                     }
                                     */


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

                            item.data.header.extension = sd.extension     //save any extensions...
                            if (sd.mapping && sd.mapping.length > 0) {
                                item.data.header.mapping = sd.mapping[0].comments;
                                item.data.mapping = sd.mapping[0].comments;     //for the report & summary view...
                            }
                            if (sd.useContext) {
                                item.header = {type :sd.useContext[0].valueCodeableConcept.code};
                            }


                            //var uc = {code : {code:'logicalType',system:'http:www.hl7.org.nz/NamingSystem/logicalModelContext'}};
                            //uc.useContext.valueCodeableConcept = {code:header.type,'system':'http:www.hl7.org.nz/NamingSystem/logicalModelContextType'}
                            //sd.useContext = [uc]


                        } else {
                            //otherwise the parent can be inferred from the path
                            arPath.pop();//
                            item.parent = arPath.join('.');
                        }
                        item.state = {opened:true};     //default to fully expanded

                        item.data.path = path;
                        item.data.name = item.text;
                        item.data.short = ed.short;
                        item.data.description = ed.definition;
                        item.data.type = ed.type;
                        
                        if (ed.type && ed.type[0].profile) {
                            item.data.referenceUri = ed.type[0].profile
                        }
                        
                        item.data.min = ed.min;
                        item.data.max = ed.max;

                        if (ed.mapping) {
                            item.data.mapping = ed.mapping[0].map;      //the identity is currently hard coded
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
            makeSD : function(scope,treeData) {
                //create a StructureDefinition from the treeData
                var header = treeData[0].data.header || {}      //the first node has the header informatiion

                //todo - this will replace any extensions...
                var sd = {resourceType:'StructureDefinition'};
                if (currentUser) {
                    this.addSimpleExtension(sd,'http:www.clinfhir.com/StructureDefinition/userEmail',currentUser.email)
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

                //newResource.type = type;
                //newResource.derivation = 'constraint';
                //newResource.baseDefinition = "http://hl7.org/fhir/StructureDefinition/"+type;
                //newResource.keyword = [{system:'http://fhir.hl7.org.nz/NamingSystem/application',code:'clinfhir'}]


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
                    if (data.mapping) {
                        ed.mapping= [{identity:'fhir',map:data.mapping}]
                    }


                    if (data.type) {


                        ed.type = [];
                        data.type.forEach(function(typ) {
                            //actually, there will only ever be one type...
                            //var typ1 = {code:typ.code,profile:typ.profile};

                            ed.type.push(typ);

                        //    if (data.referenceUri) {
                          //      typ1.profile = data.referenceUri;
                          //  }


                          //  ed.type.push(typ1);


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


        }

            }
        });
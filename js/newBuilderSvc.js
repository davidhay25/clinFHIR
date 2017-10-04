angular.module("sampleApp")
    .service('newBuilderSvc', function(Utilities,appConfigSvc,$q,GetDataFromServer) {

        function getLastNameInPath(path) {
            if (path) {
                var ar = path.split('.');
                return ar[ar.length-1]
            }
        }

        var elementsToDisable = ['id', 'meta', 'implicitRules', 'language', 'text', 'contained','DomainResource'];



        return {

            processExtension : function(meta,dt,value,resource) {
                var valueType = 'value' + dt.substr(0,1).toUpperCase()+dt.substr(1)     //ie the value[x]
                var element = resource;      //should be able to use this at different levels in the resource...
                console.log(meta,value)
                var ar = meta.path.split('.');

                if (meta.isExtensionChild) {
                    //retrieve any extensions with this url. For multiple, use the index within the new node added

                    var ar = Utilities.getComplexExtensions(element,meta.parentUrl);
                    console.log(ar);
                    if (ar.length ==0) {
                        //no extensions with this url were found

                        var child = {url:meta.code};
                        child[valueType] = value
                        var insrt = {extension:[child]}
                        Utilities.addExtensionOnceWithReplace(element,meta.parentUrl,insrt)

                    } else {
                        //need to find the one to alter...  Right now, we assume that there is only a single instance of each url
                        //iterate through the children to see if there is one with this code. If so delete it. todo ?can there be multiple with the same code??
                        var ext = ar[0];
                        var pos = -1;
                        ext.children.forEach(function (child,inx) {
                            if (child.url == meta.code) {
                                pos = inx
                            }
                        });
                        if (pos > -1) {
                            ext.children.splice(pos,1);     //delete any existing...
                        }
                        //add the new child...
                        var newChild = {url:meta.code};
                        newChild[valueType] = value
                        ext.children.push(newChild);
                        //now construct the updated complex extension
                        var insrt = {extension:[]}
                        ext.children.forEach(function (child) {
                            insrt.extension.push(child)
                        });
                        //and update...
                        Utilities.addExtensionOnceWithReplace(element,meta.parentUrl,insrt)

                    }



                } else {
                    //this is a single, stand alone extension
                    //  var extension = {url : meta.url};
                    //  var valueType = 'value' + dt.substr(0,1).toUpperCase()+dt.substr(1)
                    var extValue = {};
                    extValue[valueType]= value
                    if (meta.isMultiple) {
                        Utilities.addExtensionMultiple(element,meta.url,extValue)
                    } else {
                        Utilities.addExtensionOnceWithReplace(element,meta.url,extValue)
                    }

                }


            },

            checkElementName : function(name,dt) {
            //if the name ends in [x] then change it to one that has the DataType in it...
                if (name.substr(name.length-3)== '[x]') {
                    return name.substr(0,name.length-3) + dt.substr(0,1).toUpperCase()+dt.substr(1);
                } else {
                    return name;
                }

            },

            makeTree : function(inProfile) {
                var loadErrors = [];        //any errors during loading
                var deferred = $q.defer();
                var lstTree = [];

                var profile = angular.copy(inProfile);      //w emuck around a bit with the profile, so use a copy
                //console.log(profile);
                var arIsDataType = [];          //this is a list of disabled items...
                var lst = [];           //this will be a list of elements in the profile to show.

                var dataTypes = Utilities.getListOfDataTypes();

                var cntExtension = 0;
                //a hash of the id's in the tree. used to ensure we don't add an element to a non-esixtant parent.
                //this occurs when the parent has a max of 0, but child nodes don't
                var idsInTree = {};
                var hashTree = {};

                var sliceRootPath,parent,sliceGroupParent,parentForChildren;
                var queries = [];       //a list of queries to get the details of extensions...

                var nodeHash = {};      //a hash of nodes indexed by path... (used to detect expanded datatypes0
                function isParentNodeBBE(node) {
                    //return true if the parent to this node is a BBE
                    var isBBE;
                    var parentNode = nodeHash[node.parent];
                    if (parentNode && parentNode.data && parentNode.data.meta && parentNode.data.meta.type) {
                        parentNode.data.meta.type.forEach(function (typ) {
                            if (typ.code == 'BackboneElement') {isBBE = true;}
                        })
                    }
                    return isBBE;
                }

                if (profile && profile.snapshot && profile.snapshot.element) {

                    profile.snapshot.element.forEach(function (item,inx) {

                        var text = "";
                        item.myMeta = item.myMeta || {};    //item level metadata. only used in this function ATM

                        var include = true;
                        var el = {path: item.path};

                        var path = item.path;

                        if (! path) {
                            alert('empty path in Element Definition\n'+angular.toJson(item))
                            return;
                        }

                        var ar = path.split('.');



                        //process extensions first as this can set the include true or false - all the others only se false
                        //process an extension. if it has a profile, then display it with a nicer name.
                        if (ar[ar.length - 1] == 'extension') {
                            //if the extension has a profile type then include it, otherwise not...
                            include = false;

                            if (item.type) {
                                item.type.forEach(function (it) {
                                    if (it.code == 'Extension' && it.profile) {
                                        item.myMeta.profile = it.profile;
                                        include=true;
                                    }
                                })
                            }

                            if (!include) {
                                addLog('extension with no profile excluded')
                            }

                        }

                        //todo hide the modifier extension. Will need to figure out how to display 'real' extensions
                        if (ar[ar.length - 1] == 'modifierExtension') {
                            //disabled = true;
                            include = false;
                        }

                        if (ar.length == 1) {
                            //this is the root node
                            var rootNode = {id:ar[0],parent:'#',text:ar[0],state:{opened:true,selected:true},path:path,data: {ed : item}}
                            lstTree.push(rootNode);
                            rootNode.data.meta = {type:[{code:'BackboneElement'}]};  //this is for the newBuilder to determine if a node is
                            nodeHash[path]=rootNode;

                            idsInTree[ar[0]] = 'x';
                            include = false;
                        }

                        //obviously if the max is 0 then don't show  (might want an option later to show
                        if (item.max == 0) {
                            include = false;
                            addLog('excluding '+ item.path + ' as max == 0')
                        }


                        //standard element names like 'text' or 'language'
                        if (ar.length == 2 && elementsToDisable.indexOf(ar[1]) > -1) {
                            addLog('excluding '+ item.path + ' as in list of elementsToDisable');
                            include = false;
                        }

                        //don't include id elements...
                        if (ar[ar.length-1] == 'id') {
                            include = false;
                        }

                        ar.shift();     //removes the type name at the beginning of the path
                        item.myMeta.path = ar.join('. ');     //create a path that doesn't include the type (so is shorter)


                        //set various meta items based on the datatype
                        if (item.type) {
                            item.type.forEach(function (it) {

                                //a node that has child nodes
                                if (it.code == 'BackboneElement') {
                                    item.myMeta.isParent = true;
                                }

                                if (it.code == 'Extension') {
                                    item.myMeta.isExtension = true;
                                }

                                if (it.code == 'Reference') {
                                    item.myMeta.isReference = true;
                                }

                                //if the datatype starts with an uppercase letter, then it's a complex one...
                                if (/[A-Z]/.test( it.code)){
                                    item.myMeta.isComplex = true;
                                }

                                if (['code','Coding','CodeableConcept'].indexOf(it.code) > -1) {
                                    item.myMeta.isCoded = true;
                                }


                            })
                        }


                        var id = path;
                        var arTree = path.split('.');
                        if (arTree[arTree.length-1] == 'extension') {
                            text = item.name;// +inx;
                            id = id + cntExtension;
                            cntExtension++;
                        }

                        arTree.pop();
                        parent = arTree.join('.');
                        if (item.name) {
                            text = item.name
                        } else if (item.label) {
                            text = item.label
                        } else {
                            text = getLastNameInPath(item.path);
                        }

                        item.myMeta.id = id;        //for when we add a child node it

                        if (include) {

                            //there should always be a name  - but just in case there isn't, grab the profile name...
                            if (text == 'extension') {
                                if (item.sliceName) {
                                    text = item.sliceName;
                                } else if (item.short) {
                                    text = item.short;
                                } else if (item.name) {
                                    text = item.name;
                                } else if (item.type) {
                                    //this is a hack as the name element isn't in the Element Definition on the profile.
                                    var prof = item.type[0].profile;
                                    if (prof) {

                                        if (angular.isArray(prof)){
                                            var ar = prof[0].split('/');        //todo something seriously weird here...  should'nt be an array, and shouldn;t be called twice!!
                                        } else {
                                            var ar = prof.split('/');
                                        }
                                        text = ar[ar.length-1];
                                    }
                                }

                            }

                            if (!text) {
                                text = 'Unknown element'
                            }

                            var dataType = '';
                            if (item.type) {
                                item.type.forEach(function (it){
                                    dataType += " " + it.code;
                                })
                            }

                            //node is the tree node. todo - create earlier..
                            var node = {id:id,parent:parent,text:text,state:{opened:false,selected:false},
                                a_attr:{title: dataType + ' ' + id}, path:path};


                            //attributes required for newBuilder. Hopefully can rationalize some of the other cruft in this function...
                            node.data = {meta:{},ed : item};
                            nodeHash[item.path] = node;
                            node.data.meta.path = item.path;
                            node.data.meta.originalPath = item.path;
                            node.data.meta.type = item.type;
                            if (item.binding) {
                                if (item.binding.valueSetReference) {
                                    node.data.meta.vs = {url:item.binding.valueSetReference.reference};
                                    node.data.meta.vs.strength = item.binding.strength;
                                }
                            }

                            if (item.type) {
                                item.type.forEach(function (typ) {
                                    if (typ.code == 'BackboneElement') {
                                        node.data.meta.isBBE = true;
                                    }
                                })
                            }
                            if (item.max == '*') {
                                node.data.meta.isMultiple = true;
                                node.data.meta.index = 0;       //used to track multiple instances of this node
                            }

                            node.data.meta.isParentNodeBBE = isParentNodeBBE(node); //is the parentNode a BBE. If not. it's an expanded datatype (I think)

                            if (item.myMeta.isExtension){       //really, this could be set much earlier with a bit of re-org...
                                //make the path unique
                                //node.data.meta.path += "_"+inx;
                                node.data.meta.isExtension = true;

                                //download the Extension Definition and update the tree - especially with any child nodes...
                                queries.push(GetDataFromServer.findConformanceResourceByUri(item.myMeta.profile).then(
                                    function(sdef) {
                                        var analysis = Utilities.analyseExtensionDefinition3(sdef);
                                        item.myMeta.analysis = analysis;
                                        node.data.meta.path += "_"+inx;
                                        node.data.meta.url = item.myMeta.profile;
                                        //console.log(analysis)
                                    }, function(err) {
                                        modalService.showModal({}, {bodyText: 'makeProfileDisplayFromProfile: Error retrieving '+ it.profile + " "+ angular.toJson(err)})
                                        loadErrors.push({type:'missing StructureDefinition',value:it.profile})
                                        //13 sep - not adding to list?
                                        item.myMeta.analysis = {}
                                    }
                                ));


                            }

                            if (item.myMeta.isExtension || (item.builderMeta && item.builderMeta.isExtension)) {
                                //todo - a class would be better, but this doesn't seem to render in the tree...
                                node.a_attr.style='color:blueviolet'
                            }

                            //so long as the parent is in the tree, it's safe to add...
                            if (idsInTree[parent]) {
                                lstTree.push(node);
                                idsInTree[id] = 'x'
                                lst.push(item);

                            } else {
                                addLog('missing parent: '+parent + ' id:'+id + ' path:'+item.path,true)
                            }

                        }


                    });

                }

                //ie if there are any extensions...
                if (queries.length) {
                    $q.all(queries).then(
                        function() {
                            //add the child nodes for any complex extensions...  item.myMeta.analysis
                            var newNodes = [];      //create a separate array to hold the new nodes...
                            lstTree.forEach(function(node){
                                if (node.data && node.data.ed && node.data.ed.myMeta) {
                                    //the analysis node is ONLY added when the Extension definition is retrieved and analysed
                                    var analysis = node.data.ed.myMeta.analysis;

                                    if (analysis) {
                                        if (analysis.isComplexExtension) {
                                            if (analysis.children) {
                                                //add the child nodes for the complex extension...
                                                analysis.children.forEach(function(child){
                                                    var id = 'ce'+lstTree.length+newNodes.length;
                                                    var newNode = {id:id,parent:node.id,text:child.code,state:{opened:false,selected:false},
                                                        a_attr:{title: + id}};
                                                    newNode.data = {meta:{}};
                                                    newNode.data.meta = {path:node.data.meta.path + "."+child.code};
                                                    newNode.data.meta.binding = child.ed.binding;
                                                    newNode.data.meta.type = child.ed.type;
                                                    newNode.data.meta.isExtension = true;
                                                    newNode.data.meta.parentUrl = node.data.meta.url;
                                                    newNode.data.meta.isExtensionChild = true;
                                                    newNode.data.meta.code = child.code;      //the code value in the extension
                                                    if (child.ed.min == 1) {
                                                        newNode.data.meta.required = true;
                                                    }
                                                    //now update the parent node...
                                                    delete node.data.meta.type;             //we already know it's an extension parent
                                                    node.data.meta.isExtensionBBE = true;       //set the pareent so we know its a bbe
                                                    // newNode.data.meta.child = child;
                                                    newNodes.push(newNode);
                                                })
                                            }
                                        } else {
                                            //this is a simple extension...
                                            console.log(analysis)
                                            node.data.meta.type = analysis.dataTypes;   //replace the 'Extension' dataytype


                                        }

                                    }
                                }

                            });


                            lstTree = lstTree.concat(newNodes)

                            setNodeIcons(lstTree);


                            deferred.resolve({table:lst,treeData:lstTree,errors: loadErrors})
                        }
                    )

                } else {
                    setNodeIcons(lstTree);
                    deferred.resolve({table:lst,treeData:lstTree,errors: loadErrors})
                }






                return deferred.promise;

                function addLog(msg,err) {
                    //console.log(msg)
                }

                //get the test display for the element
                function getDisplay(ed) {
                    var display = ed.path;
                    if (ed.label) {
                        display=ed.label
                    } else if (ed.name) {
                        display=ed.name;
                    }
                    return display;
                }


                function setNodeIcons(treeData) {
                    //here is where we set the icons - ie after all the extension definitions have been loaded & resolved...
                    lstTree.forEach(function(node){

                        //set the 'required' colour
                        if (node.data && node.data.ed) {
                            if (node.data.ed.min == 1) {
                                //console.log('REQUIRED')
                                node['li_attr'] = {class : 'elementRequired elementRemoved'};

                            } else {
                                //have to formally add an 'optional' class else the required colour 'cascades' in the tree...
                                node['li_attr'] = {class : 'elementOptional'};
                            }

                            if (node.data.ed.max == "*") {
                                if (node.data.ed.path) {
                                    var ar = node.data.ed.path.split('.')
                                    if (ar.length > 1) {
                                        node.text += " *"
                                    }
                                }
                            }


                        }

                        //set the '[x]' suffix unless already there...
                        if (node.text && node.text.indexOf('[x]') == -1) {
                            //set the '[x]' for code elements
                            if (node.data && node.data.ed && node.data.ed.type && node.data.ed.type.length > 1) {
                                node.text += '[x]'
                            }

                            //set the '[x]' for extensions (whew!)
                            if (node.data && node.data.ed && node.data.ed.myMeta && node.data.ed.myMeta.analysis &&
                                node.data.ed.myMeta.analysis.dataTypes && node.data.ed.myMeta.analysis.dataTypes.length > 1) {
                                node.text += '[x]'
                            }
                        }


                        //set the display icon
                        if (node.data && node.data.ed && node.data.ed.myMeta){

                            var myMeta = node.data.ed.myMeta;

                            if (!myMeta.isParent) {     //leave parent node as folder...

                                var r = myMeta;
                                if (myMeta.isExtension && myMeta.analysis) {
                                    r = myMeta.analysis;
                                }
                                //var isComplex = myMeta.isComplex ||


                                if (r.isComplex) {
                                    node.icon='/icons/icon_datatype.gif';
                                } else {
                                    node.icon='/icons/icon_primitive.png';
                                }

                                if (r.isReference) {
                                    node.icon='/icons/icon_reference.png';
                                }



                            }

                        }
                    })
                }

                // return {table:lst,treeData:lstTree};

            }
        }

    });
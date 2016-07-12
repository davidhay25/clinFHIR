angular.module("sampleApp").service('profileCreatorSvc',
    function($q,$http,RenderProfileSvc,appConfigSvc,ResourceUtilsSvc,GetDataFromServer,$localStorage,Utilities,$sce) {


        function makeExtensionSD(vo) {
            //vo.ed             - the element definition that has been built
            //vo.extensionUrl   - the cannonical url for this definition
            //vo.extensionId    - the Id of the structuredefinition on the server
            //vo.valueName      - the name for the 'value' element - eg valueCodeableConcept
            //vo.fhirVersion    - the version of fhir we are targetting
            //vo.type             - the dataType of the extension

            var fhirVersion = vo.fhirVersion || 3;      //default to version 3...

            //the extensionDefinition that describes this extension...
            var extensionSD = {"resourceType": "StructureDefinition","url": vo.extensionUrl,
                "name": vo.ed.path,"kind": "complex-type",
                "snapshot" : {element:[]}
            };

            //these are STU-3 - not sure about STU-2
            if (fhirVersion == 3) {
                extensionSD.abstract = false;
                extensionSD.baseType = "Extension";
                extensionSD.baseDefinition = "http://hl7.org/fhir/StructureDefinition/Extension";
                extensionSD.derivation = 'constraint';
                extensionSD.id = vo.extensionId;
                extensionSD.status='draft';
                extensionSD.contextType = "datatype";
                extensionSD.context=["Element"];
                extensionSD.code = [{system:'http://fhir.hl7.org.nz/NamingSystem/application',code:'clinfhir'}]
            } else {
                extensionSD.constrainedType = "Extension";
                extensionSD.base = "http://hl7.org/fhir/StructureDefinition/Extension";
            }

            extensionSD.snapshot.element.push({path:'Extension',definition:'ext',min:0,max:'1',type:[{code:'Extension'}]});
            extensionSD.snapshot.element.push({path:'Extension.url',definition:'Url',min:1,max:'1',type:[{code:'uri'}]});


            //var type = ed.type;     //teh dataTypes
           // var el = {path:vo.valueName, definition:'value',min:0,max:'1',type:[{code:vo.dt}]}
            var el = {path:vo.valueName, definition:'value',min:0,max:'1',type:vo.type}
            extensionSD.snapshot.element.push(el);

            return extensionSD;

        }

        function getLastNameInPath(path) {
            if (path) {
                var ar = path.split('.');
                return ar[ar.length-1]
            }
        }
        
        return  {
            //generate the list used by the jsTree component to dsplay the tree view of the profile...
            makeProfileDisplayFromProfile : function(inProfile) {
                //var that = this;
                console.log('MAKEPROFILE')
                var deferred = $q.defer();
                var lstTree = [];

                var profile = angular.copy(inProfile);      //w emuck around a bit with the profile, so use a copy
                //console.log(profile);
                var arIsDataType = [];          //this is a list of disabled items...
                var lst = [];           //this will be a list of elements in the profile to show.
                var elementsToDisable = ['id', 'meta', 'implicitRules', 'language', 'text', 'contained'];
                var dataTypes = ['CodeableConcept', 'Identifier', 'Period', 'Quantity', 'Reference','HumanName'];

                var cntExtension = 0;
                //a hash of the id's in the tree. used to ensure we don't add an element to a non-esixtant parent.
                //this occurs when the parent has a max of 0, but child nodes don't
                var idsInTree = {};
                var hashTree = {};

                var sliceRootPath,parent,sliceGroupParent,parentForChildren;
                var queries = [];       //a list of queries to get the details of extensions...
                if (profile && profile.snapshot && profile.snapshot.element) {

                    profile.snapshot.element.forEach(function (item,inx) {
                        item.myMeta = item.myMeta || {};

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
                            // disabled = true;    //by default extensions are disabled...
                            //if the extension has a profile type then include it, otherwise not...
                            include = false;

                            if (item.type) {
                                item.type.forEach(function (it) {
                                    if (it.code == 'Extension' && it.profile) {
                                        // disabled = false;
                                        include=true;
                                        //load the extension definition
                                        queries.push(GetDataFromServer.findConformanceResourceByUri(it.profile).then(
                                            function(sdef) {
                                                var analysis = Utilities.analyseExtensionDefinition2(sdef);
                                                item.myMeta.analysis = analysis;
                                                //console.log(analysis)
                                            }, function(err) {
                                                console.log('Error retrieving '+ it.profile + " "+ angular.toJson(err))
                                            }
                                        ));

                                        //use the name rather than 'Extension'...
                                       //not sure if this is doing anything... ar[ar.length - 1] = "*"+   item.name;
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
                            //note - added data friday pm montreal
                            lstTree.push({id:ar[0],parent:'#',text:ar[0],state:{opened:true,selected:true},path:path,data: {ed : item}});
                            idsInTree[ar[0]] = 'x'
                            include = false;
                        }

                        //obviously if the max is 0 then don't show  (might waant an option later to show
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

                        //add to tree only if include is still true...
                        //this is the start of a sliced section.
                        if (item.slicing && item.slicing.discriminator) {
                            addLog('new slice:'+item.slicing.discriminator + ' not included')
                            sliceRootPath = item.path;  //the root path for BBE ?other sliced types or only BBE
                            include = false; //It is not added to the tree...
                            addLog('excluding '+ item.path + ' as it defined a discriminator')
                            //but we do need to establish the parent for instances of this slice group...
                            var arSliceGroupParent = path.split('.');
                            arSliceGroupParent.pop();
                            sliceGroupParent = arSliceGroupParent.join('.');
                        }

                        //a set of sliced elements. If the element being examined has the same path, then it will be attached
                        //to the parent. Otherwise it gets attached to the slice...
                        var id;
                        if (sliceRootPath) {
                            if (item.path == sliceRootPath) {
                                console.log('new slice instance:'+sliceRootPath)
                                //this is a new 'instance' of the sliced element.
                                parent = sliceGroupParent;  //the parent will be that for the whole slice group

                                id = item.path + '.' + inx; //to ensure unique. may need to look at the discriminator
                                parentForChildren = id;     //this will be the parent for child elements in this slice group
                                //text = getLastNameInPath(item.path);// +inx;

                                text = getDisplay(item);

                            } else {
                                //this is an 'ordinary' element (but still in the slice group) - attach it to the current slice root...
                                //set the 'parent' variable to the currently active one...
                                //if this is a child of the sliced element, then it will have the same path...
                                var p = item.path;
                                if (p.indexOf(sliceRootPath) > -1) {
                                    parent = parentForChildren
                                } else {
                                    var ar1 = path.split('.');
                                    ar1.pop();
                                    parent = ar1.join('.')
                                }

                                id = item.path;
                                text = getLastNameInPath(item.path);
                            }


                        } else {
                            //there is no slicing in action - just add. todo - what if there's more than one slice???
                            id = path;
                            var arTree = path.split('.');
                            if (arTree[arTree.length-1] == 'extension') {
                                text = item.name;// +inx;
                                id = id + cntExtension;
                                cntExtension++;
                            }

                            arTree.pop();
                            parent = arTree.join('.');
                            text = getLastNameInPath(item.path);
                        }

                        addLog(item.path + ' ' +include)

                        //the item has been marked for removal in the UI...
                        if (item.myMeta.remove) {
                            include = false;
                        }

                        item.myMeta.id = id;        //for when we add a child node it

                        if (include) {

                            //all the slicing stuff above has mucked up extension name. todo needs refinement...
                            if (text == 'extension') {
                                text = item.name;
                            }

                            var dataType = '';
                            if (item.type) {
                                item.type.forEach(function (it){
                                    dataType += " " + it.code;
                                })
                            }

                            var node = {id:id,parent:parent,text:text,state:{opened:false,selected:false},
                                a_attr:{title: dataType + ' ' + id}, path:path};

                            if (item.myMeta.isExtension) {
                                //todo - a class would be better, but this doesn't seem to render in the tree...
                                 node.a_attr.style='color:blueviolet'
                              }

                            node.data = {ed : item};


                            //so long as the parent is in the tree, it's safe to add...
                            if (idsInTree[parent]) {
                                lstTree.push(node);
                                idsInTree[id] = 'x'
                                lst.push(item);

                               // console.log(parent,id);

                            } else {
                                addLog('missing parent: '+parent + ' id:'+id + ' path:'+item.path,true)
                            }

                        }


                        //if the type is a recognized datatype, then hide all child nodes todo - won't show profiled datatyoes
                        //note that this check is after it has been added to the list...

                        if (item.type) {
                            item.type.forEach(function (type) {
                                if (dataTypes.indexOf(type.code) > -1) {
                                    arIsDataType.push(path)
                                }
                            });
                        }

                    });

                }


                if (queries.length) {
                    $q.all(queries).then(
                        function() {
                            setNodeIcons(lstTree)

/*
                            //here is where we set the icons - ie after all the extension definitions have been loaded & resolved...
                            lstTree.forEach(function(node){
                                console.log(node);

                                //set the '[x]' for code elements
                                if (node.data && node.data.ed && node.data.ed.type && node.data.ed.type.length > 1) {
                                       node.text += '[x]'
                                }

                                //set the '[x]' for extensions (whew!)
                                if (node.data && node.data.ed && node.data.ed.myMeta && node.data.ed.myMeta.analysis &&
                                    node.data.ed.myMeta.analysis.dataTypes && node.data.ed.myMeta.analysis.dataTypes.length > 1) {
                                    node.text += '[x]'
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

*/

                            deferred.resolve({table:lst,treeData:lstTree})
                        }
                    )

                } else {
                    setNodeIcons(lstTree);
                    deferred.resolve({table:lst,treeData:lstTree})
                }






                return deferred.promise;

                function addLog(msg,err) {
                    console.log(msg)
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
                                node['li_attr'] = {class : 'elementRequired'};
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


                                /* if (elementDef.min !== 0) {
                                 elementDef.myData.displayClass += 'elementRequired ';
                                 }*/


                            }

                        }
                    })
                }

                // return {table:lst,treeData:lstTree};

            },
            saveNewProfile : function(profileName,model,baseProfile,isEdit) {
                //save the newly created profile. The structure is different for STU 2 & 3. sigh.
                //baseProfile is the profile that is being constrained
                //isEdit is when a profiled resource is being updated (it's not a new one, but an update to the current one
                if (!profileName) {
                    alert('The profile name is required');
                    return;
                }
                var deferred = $q.defer();
                var config = appConfigSvc.config();
                //model is the array of tree nodes...
                //iterate through the model to build the profile;

                var fhirVersion = 2;
                var svr = appConfigSvc.getServerByUrl(config.servers.conformance);
                if (svr)  {
                    fhirVersion = svr.version;
                }

                var sd;         //this is the StructureDefinition for the Profile



                //create the StructureDefinition - tha same whether a new one. or editing a previous one...
                //as it's a PUT, updates will simply replace the previous...
                var profileUrl;
                if (fhirVersion == 3) {

                    sd = {resourceType:'StructureDefinition',name : profileName, kind:'resource',
                        status:'draft',experimental : true};

                    sd.abstract = false;
                    sd.baseType = baseProfile.name;         //assume that constariing a base resource
                    sd.baseDefinition = baseProfile.url;    //assume that constariing a base resource
                    sd.derivation = 'constraint';
                    sd.id = profileName;
                    sd.code = [{system:'http://fhir.hl7.org.nz/NamingSystem/application',code:'clinfhir'}]


                    var profileId = profileName;       //todo - ensure not yet used (or this is an update)
                    profileUrl = config.servers.conformance + "StructureDefinition/" +profileId;

                    sd.url = profileUrl;

                    //populate the Profile SD 'header' elements from the base profile (this header info can be changed in the UI)
                    //sd.name = baseProfile.name;
                    sd.description = baseProfile.description;
                    sd.requirements = baseProfile.requirements;
                    sd.copyright = baseProfile.copyright;
                    sd.snapshot = {element:[]};

                    //the value of the 'type' property - ie what the base Resource is - changed between stu2 & 3...
                    var typeName = 'baseType';
                } else {
                    sd = {resourceType:'StructureDefinition',name : profileName, kind:'resource',
                        status:'draft',experimental : true, snapshot : {element:[]}};
                    var profileId = profileName;       //todo - ensure not yet used (or this is an update)
                    profileUrl = config.servers.conformance + "StructureDefinition/" +profileId;
                    sd.url = profileUrl;

                    //the value of the 'type' property - ie what the base Resource is - changed between stu2 & 3...
                    var typeName = 'base';
                }

                var log = [];

                var SDsToSave = [];     //this will be an array of extension SD's plus a single profile SD



                //here is where we iterate through the tree model, pulling out the ElementDefinitions and adding them to the profile...

                model.forEach(function(item,index) {
                    if (item.data && item.data.ed) {
                        var ed = item.data.ed;

                        //the first entry is always the root, which in this case will have the base type being extended...
                        if (! sd[typeName]) {
                            sd[typeName] = ed.path;
                            //now add the meta element
                        }

                        var inProfile = true;       //true if this ed is to be included in the profile
                        if (ed.myMeta) {
                            if (ed.myMeta.remove) {
                                //flagged for removal therefore don't incldude in  teh new SD...
                                inProfile = false;
                            } else if (ed.myMeta.isNew || (ed.myMeta.isExtension && ed.myMeta.isDirty)) {
                                //this is a new extension. we'll create a new extension definition for now - later will allow the user to select an existing one
                                //the extension will only have a single datatype (for now)
                                var extensionId = profileName +  ed.path.replace(/\./,'-');     //the  Id for
                                var extensionUrl = config.servers.conformance + "StructureDefinition/" +extensionId;
                                var dt = ed.type[0].code;   //only a single dt per entry (right now)

                                //now change the datatype in the profile to be an extension, with a profile pointing to the ED
                                //removed friday...

                                var typeForExtension = angular.copy(ed.type);       //we're using the ed to store this stuff

                                console.log(typeForExtension)

                                ed.type[0].code = "Extension";      // 'cause that's what it is...
                                ed.type[0].profile = [extensionUrl];      //and where to find it.


                                //and change the path to be 'Extension'
                                var ar = ed.path.split('.');
                                var extensionDefId = ar[ar.length-1];
                                ar[ar.length-1] = 'extension';
                                ed.path = ar.join('.');
                                var valueName = "Extension.value" + dt.capitalize();    //the value name in the extension definition
                                //console.log(ed);

                                var vo = {};
                                vo.ed = ed;                         //  the element definition that has been built
                                vo.extensionUrl = extensionUrl;     //  the cannonical url for this definition
                                vo.extensionId = extensionId;       //  the Id of the structuredefinition on the server
                                vo.valueName = valueName;           //  the name for the 'value' element - eg valueCodeableConcept
                                vo.type = ed.myMeta.analysis.dataTypes;     //the type for extensios
                                //vo.dt = dt;


                                var extensionSD = makeExtensionSD(vo);


/*

                                //the extensionDefinition that describes this extension...
                                var extensionSD = {"resourceType": "StructureDefinition","url": extensionUrl,
                                    "name": ed.path,"kind": "datatype",
                                    "snapshot" : {element:[]}
                                };

                                //these are STU-3 - not sure about STU-2
                                if (fhirVersion == 3) {
                                    extensionSD.abstract = false;
                                    extensionSD.baseType = "Extension";
                                    extensionSD.baseDefinition = "http://hl7.org/fhir/StructureDefinition/Extension";
                                    extensionSD.derivation = 'constraint';
                                    extensionSD.id = extensionId;
                                    extensionSD.status='draft';
                                    extensionSD.contextType = "datatype";
                                    extensionSD.context=["Element"];
                                } else {
                                    extensionSD.constrainedType = "Extension";
                                    extensionSD.base = "http://hl7.org/fhir/StructureDefinition/Extension";
                                }


                                extensionSD.snapshot.element.push({path:'Extension',definition:'ext',min:0,max:'1',type:[{code:'Extension'}]});
                                extensionSD.snapshot.element.push({path:'Extension.url',definition:'Url',min:1,max:'1',type:[{code:'uri'}]});
                                extensionSD.snapshot.element.push({path:valueName,definition:'value',min:0,max:'1',type:[{code:dt}]});

*/

                                SDsToSave.push(saveStructureDefinition(extensionId,extensionSD).then(
                                    function() {
                                        log.push('Saved '+extensionSD.url);
                                    },function(err){
                                        alert('Error saving '+extensionSD.url+ ' ' + angular.toJson(err))
                                        log.push('Error saving '+extensionSD.url+ ' ' + angular.toJson(err));
                                    }
                                ));
                            } else if (ed.myMeta.isDirty) {
                                //this is an ED that has been modified






  /*
                                SDsToSave.push(saveStructureDefinition(extensionId,extensionSD).then(
                                    function() {
                                        log.push('Saved '+extensionSD.url);
                                    },function(err){
                                        log.push('Error saving '+extensionSD.url+ ' ' + angular.toJson(err));
                                    }
                                ));
*/
                            }
                        }

                        //if this element is tobe included in the profile, we can add it now...
                        if (inProfile) {
                            delete ed.myMeta;
                            sd.snapshot.element.push(ed)
                        }

                        if (index == 0) {
                            //this is the first element - ie the one with the type name. we can add the meta element now...
                            //this is to the StructureDefinition resource - nothing to do with any extensions
                            var resourceType = baseProfile.snapshot.element[0].path;
                            var idElement = {definition:'Id',min:0,max:'1',type:[{code:'id'}]};
                            idElement.base = {path:"Resource.id",min:0,max:'1'};
                            idElement.path = resourceType+'.id';

                            sd.snapshot.element.push(idElement)

                            var metaElement = {}
                            metaElement.path = resourceType +'.meta';    //the resource type is always the first emelent
                            metaElement.definition = 'The meta element';
                            metaElement.min=0;
                            metaElement.max='1';
                            metaElement.base = {path:"Resource.meta",min:0,max:'1'}
                            metaElement.type=[{code:'Meta'}];

                            sd.snapshot.element.push(metaElement);

                            var textElement = {definition:'Narrative',min:0,max:'1',type:[{code:'Narrative'}]};
                            textElement.base = {path:"DomainResource.text",min:0,max:'*'};
                            textElement.path = resourceType+'.text';

                            sd.snapshot.element.push(textElement)


                        }



                    }

                });

                console.log(sd)
                //now add the profile to the list of SD's to save
                SDsToSave.push(saveStructureDefinition(profileId,sd).then(
                    function() {
                        log.push('Saved '+sd.url);
                    },function(err){
                        //log.push('Error saving '+sd.url+ ' ' + angular.toJson(err));
                        log.push(err.data);
                    }));

                console.log(SDsToSave);

                $q.all(SDsToSave).then(
                    function(){
                        deferred.resolve({log:log,profile:sd});
                    },function(err) {
                        alert('Error saving profile and/or extension definitions '+ angular.toJson(err))
                        deferred.reject(err);
                    }
                );


                return deferred.promise;


                function saveStructureDefinition(extensionId,extensionDefinition) {
                    console.log(extensionId,extensionDefinition);
                    return $http.put(extensionDefinition.url,extensionDefinition)



                }
            },
            isSimpleString : function(str) {
                //function to check for a simple string...
                if (str.indexOf(' ')> -1 ||  str.indexOf('"')> -1 || str.indexOf("'")> -1 ) {
                    return false
                } else {
                    return true;
                }




            }
        }
    }
);
angular.module("sampleApp").service('profileCreatorSvc',
    function($q,$http,RenderProfileSvc,appConfigSvc,ResourceUtilsSvc,GetDataFromServer,
             $localStorage,Utilities,$sce,modalService,SaveDataToServer) {


        function makeExtensionSD(vo) {
            console.log(vo)
            //vo.ed             - the element definition that has been built
            //vo.extensionUrl   - the cannonical url for this definition
            //vo.extensionId    - the Id of the structuredefinition on the server
            //vo.valueName      - the name for the 'value' element - eg valueCodeableConcept
            //vo.fhirVersion    - the version of fhir we are targetting
            //vo.type             - the dataType of the extension
            //vo.name           - the name of the profile

            var fhirVersion = vo.fhirVersion || 3;      //default to version 3...

            //the extensionDefinition that describes this extension...
            var extensionSD = {"resourceType": "StructureDefinition","url": vo.extensionUrl,
                "name": vo.ed.path,
                "snapshot" : {element:[]}
            };

            /*
             //extensionDefinition.code = [{system:'http://fhir.hl7.org.nz/NamingSystem/application',code:'clinfhir'}]
             extensionDefinition.name = name;
             //extensionDefinition.status = 'draft';
            // extensionDefinition.abstract= false;
             extensionDefinition.publisher = $scope.input.publisher;
             extensionDefinition.contextType = "resource";

             * */

            extensionSD.status = 'draft';
            extensionSD.abstract= false;

            extensionSD.contextType = "resource";
            extensionSD.context=["*"];
            extensionSD.id = vo.extensionId;
            extensionSD.publisher = 'clinFHIR';

            //at the time of writing (Oct 12), the implementaton of stu3 varies wrt 'code' & 'keyword'. Remove this eventually...
            extensionSD.identifier = [{system:"http://clinfhir.com",value:"author"}]

            //these are STU-3 - not sure about STU-2
            if (fhirVersion == 3) {


                extensionSD.keyword = [{system:'http://fhir.hl7.org.nz/NamingSystem/application',code:'clinfhir'}]
                extensionSD.kind =  "complex-type";
                extensionSD.type = 'Extension';
               // extensionSD.constrainedType =  "Extension"
           //     extensionSD.base= "http://hl7.org/fhir/StructureDefinition/Extension"


                //extensionSD.abstract = false;
               // extensionSD.baseType = "Extension";
                extensionSD.baseDefinition = "http://hl7.org/fhir/StructureDefinition/Extension";
                extensionSD.derivation = 'constraint';
                //extensionSD.id = vo.extensionId;
                //extensionSD.status='draft';
                //extensionSD.contextType = "datatype";
                //extensionSD.context=["*"];

               // extensionSD.code = [{system:'http://fhir.hl7.org.nz/NamingSystem/application',code:'clinfhir'}]

                var firstElementV3 = {path:'Extension',id:'Extension',definition:'ext',min:0,max:'1'};
                firstElementV3.base = {"path": "Extension","min": 0,"max": "*"}
                // - no typon the first element in v3 . firstElement.type = [{code:'Extension'}]

                extensionSD.snapshot.element.push(firstElementV3);

            } else {

                extensionSD.kind='datatype';
                extensionSD.code = [{system:'http://fhir.hl7.org.nz/NamingSystem/application',code:'clinfhir'}]

                extensionSD.constrainedType = "Extension";
                extensionSD.base = "http://hl7.org/fhir/StructureDefinition/Extension";

                var firstElementV2 = {path:'Extension',id:'Extension',definition:'ext',min:0,max:'1'};
                firstElementV2.base = {"path": "Extension","min": 0,"max": "*"}
                firstElementV2.type = [{code:'Extension'}]

                extensionSD.snapshot.element.push(firstElementV2);
            }





            extensionSD.snapshot.element.push({path:'Extension.url',id:'Extension.url',definition:'Url',min:1,max:'1',type:[{code:'uri'}]});


            //var el = {path:vo.valueName, definition:'value',min:0,max:'1',type:vo.type}
            var el = {path:vo.valueName,id:'Extension'+vo.valueName, definition:'value',min:0,max:'1',type:vo.type}
            extensionSD.snapshot.element.push(el);


            //make sure that each element in the extension reference has a name property...
            extensionSD.snapshot.element.forEach(function(ed){
                ed.name = vo.name;
            })


            console.log(extensionSD)

            return extensionSD;

        }

        function getLastNameInPath(path) {
            if (path) {
                var ar = path.split('.');
                return ar[ar.length-1]
            }
        }

        var elementsToDisable = ['id', 'meta', 'implicitRules', 'language', 'text', 'contained','DomainResource'];
        
        return  {
            //generate the list used by the jsTree component to dsplay the tree view of the profile...
            makeProfileDisplayFromProfile : function(inProfile) {
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
                if (profile && profile.snapshot && profile.snapshot.element) {

                    profile.snapshot.element.forEach(function (item,inx) {

                        var text = "";

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
                            //if the extension has a profile type then include it, otherwise not...
                            include = false;

                            if (item.type) {
                                item.type.forEach(function (it) {
                                    if (it.code == 'Extension' && it.profile) {
                                        include=true;
                                        //load the extension definition
                                        queries.push(GetDataFromServer.findConformanceResourceByUri(it.profile).then(
                                            function(sdef) {
                                                var analysis = Utilities.analyseExtensionDefinition3(sdef);
                                                item.myMeta.analysis = analysis;



                                                //console.log(analysis)
                                            }, function(err) {
                                                modalService.showModal({}, {bodyText: 'makeProfileDisplayFromProfile: Error retrieving '+ it.profile + " "+ angular.toJson(err)})
                                                //console.log('Error retrieving '+ it.profile + " "+ angular.toJson(err))
                                                loadErrors.push({type:'missing StructureDefinition',value:it.profile})
                                                //13 sep - not adding to list?
                                                item.myMeta.analysis = {}
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
                                //console.log('new slice instance:'+sliceRootPath)
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
                                if (item.name) {
                                    text = item.name}
                                else if (item.label) {
                                    text = item.label
                                } else {
                                    text = getLastNameInPath(item.path);
                                }


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
                            if (item.name) {
                                text = item.name
                            } else if (item.label) {
                                text = item.label
                            } else {
                                text = getLastNameInPath(item.path);
                            }


                        }

                        addLog(item.path + ' ' +include)

                        //the item has been marked for removal in the UI...
                        if (item.myMeta.remove) {
                            include = false;
                        }

                        item.myMeta.id = id;        //for when we add a child node it


                        //this is an element inserted by resourceCreatorSvc.insertComplexExtensionED so it can be displayed in the resource creator...
                        if (item.cfIsComplexExtension) {
                            include = false;
                        }


                        //var show_removed = true; - just while working on diff from
                        if (include) {

                            //all the slicing stuff above has mucked up extension name. todo needs refinement...


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

                            var node = {id:id,parent:parent,text:text,state:{opened:false,selected:false},
                                a_attr:{title: dataType + ' ' + id}, path:path};



                            //node['a_attr'].style = 'text-decoration:line-through';


                            if (item.myMeta.isExtension || (item.builderMeta && item.builderMeta.isExtension)) {
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

                //ie if there are any extensions...
                if (queries.length) {
                    $q.all(queries).then(
                        function() {
                            //add the child nodes for any complex extensions...  item.myMeta.analysis
                            var newNodes = [];      //create a separate array to hold the new nodes...
                            lstTree.forEach(function(node){
                                if (node.data && node.data.ed && node.data.ed.myMeta) {
                                    var analysis = node.data.ed.myMeta.analysis;

                                    //experimental!!
                                    //node.data.ed.type = [{code:'BackboneElement'}]

                                    if (analysis && analysis.isComplexExtension) {
                                        //console.log(node)
                                        //console.log(analysis.children)
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

                console.log(fhirVersion);

                var sd;         //this is the StructureDefinition for the Profile



                //create the StructureDefinition - tha same whether a new one. or editing a previous one...
                //as it's a PUT, updates will simply replace the previous...
                var profileUrl;
                if (fhirVersion == 3) {

                    sd = {resourceType:'StructureDefinition',name : profileName, kind:'resource',
                        status:'draft',experimental : true};

                    sd.abstract = false;
                    sd.type = baseProfile.type;  // type is unchanged

                    //assume that constraining a base resource
                    sd.baseDefinition = baseProfile.baseDefinition;    //assume that constraining a base resource
                    sd.derivation = 'constraint';
                    sd.id = profileName;
                    //sd.code = [{system:'http://fhir.hl7.org.nz/NamingSystem/application',code:'clinfhir'}]

                    sd.keyword = [{system:'http://fhir.hl7.org.nz/NamingSystem/application',code:'clinfhir'}]
                    sd.kind="resource";
                    //sd.constrainedType = 

                    var profileId = profileName;       //todo - ensure not yet used (or this is an update)
                    profileUrl = config.servers.conformance + "StructureDefinition/" +profileId;

                    sd.url = profileUrl;

                    //populate the Profile SD 'header' elements from the base profile (this header info can be changed in the UI)

                    sd.description = baseProfile.description;
                    sd.requirements = baseProfile.requirements;
                    sd.copyright = baseProfile.copyright;
                    sd.publisher = baseProfile.publisher;
                    sd.snapshot = {element:[]};

                    //if baseProfile.base is populated then this is a profile being edited...
                    if (baseProfile.baseType && baseProfile.baseType =="http://hl7.org/fhir/StructureDefinition/DomainResource") {
                        //this is a base resource type being edited
                        sd.baseType = "http://hl7.org/fhir/StructureDefinition/" + baseProfile.name
                    } else {
                        //this is editing a profile
                        sd.baseType = baseProfile.baseType
                    }


                } else {
                    //stu-2
                    sd = {resourceType:'StructureDefinition',name : profileName, kind:'resource',
                        status:'draft',experimental : true, snapshot : {element:[]}};
                    var profileId = profileName;       //todo - ensure not yet used (or this is an update)
                    profileUrl = config.servers.conformance + "StructureDefinition/" +profileId;
                    sd.url = profileUrl;

                    //elements in the StructureDefinition that are common to all...
                    sd.abstract=false;
                    sd.id = profileId;
                    sd.publisher = baseProfile.publisher;
                    sd.code = [{system:'http://fhir.hl7.org.nz/NamingSystem/application',code:'clinfhir'}]

                    //the value of the 'type' property - ie what the base Resource is - changed between stu2 & 3...
                    //var typeName = 'base';

                    //if baseProfile.base is populated then this is a profile being edited...
                    if (baseProfile.base && baseProfile.base =="http://hl7.org/fhir/StructureDefinition/DomainResource") {
                        //this is a base resource type being edited
                        sd.base = "http://hl7.org/fhir/StructureDefinition/" + baseProfile.name
                        sd.constrainedType = baseProfile.name;
                    } else {
                        //this is editing a profile
                        sd.base = baseProfile.base
                        sd.constrainedType = baseProfile.constrainedType;
                    }

                }

                //at the time of writing (Oct 12), the implementaton of stu3 varies wrt 'code' & 'keyword'. Remove this eventually...
                sd.identifier = [{system:"http://clinfhir.com",value:"author"}]




                var log = [];

                var SDsToSave = [];     //this will be an array of extension SD's plus a single profile SD

                //here is where we iterate through the tree model, pulling out the ElementDefinitions and adding them to the profile...
                model.forEach(function(item,index) {
                    if (item.data && item.data.ed) {
                        var ed = item.data.ed;

                        //the first entry is always the root, which in this case will have the base type being extended...

                        var inProfile = true;       //true if this ed is to be included in the profile
                        if (ed.myMeta) {
                            if (ed.myMeta.remove) {
                                //flagged for removal therefore don't incldude in teh new SD...
                                //actually, I don't think this will ever be the case as removed elements are not in the model
                                inProfile = false;
                            } else if (ed.myMeta.isNew || (ed.myMeta.isExtension && ed.myMeta.isDirty)) {
                                //this is a new extension. we'll create a new extension definition for now - later will allow the user to select an existing one
                                //the extension will only have a single datatype (for now)
                                var extensionId = profileName +  ed.path.replace(/\./,'-');     //the  Id for
                                var extensionUrl = config.servers.conformance + "StructureDefinition/" +extensionId;
                                var dt = ed.type[0].code;   //only a single dt per entry (right now)

                                var typeForExtension = angular.copy(ed.type);       //we're using the ed to store this stuff


                                ed.type[0].code = "Extension";      // 'cause that's what it is...

                                //and where to find it. Note STU-2 is an array and STU-3 is not...
                                if (fhirVersion == 2) {
                                    ed.type[0].profile = [extensionUrl];
                                } else {
                                    ed.type[0].profile = extensionUrl;
                                }

                                //and change the path to be 'Extension'
                                var ar = ed.path.split('.');
                                var extensionDefId = ar[ar.length-1];
                                ar[ar.length-1] = 'extension';
                                ed.path = ar.join('.');
                                var valueName = "Extension.value" + dt.capitalize();    //the value name in the extension definition
                                //console.log(ed);

                                var vo = {};

                                vo.fhirVersion = fhirVersion;
                                vo.ed = ed;                         //  the element definition that has been built
                                delete vo.ed.myData;                //need to remove the 'myData' property
                                vo.extensionUrl = extensionUrl;     //  the cannonical url for this definition
                                vo.extensionId = extensionId;       //  the Id of the structuredefinition on the server
                                vo.valueName = valueName;           //  the name for the 'value' element - eg valueCodeableConcept
                                vo.type = ed.myMeta.analysis.dataTypes;     //the type for extensios
                                //vo.dt = dt;
                                vo.name = profileName
                                
                                var extensionSD = makeExtensionSD(vo);

                                if (1==1) {

                                    SDsToSave.push(saveStructureDefinition(extensionId, extensionSD).then(
                                        function () {
                                            log.push('Saved ' + extensionSD.url);
                                        }, function (err) {
                                            alert('Error saving ' + extensionSD.url + ' ' + angular.toJson(err))
                                            log.push('Error saving ' + extensionSD.url + ' ' + angular.toJson(err));


                                            var errorLog = {};
                                            errorLog.resource = extensionSD;

                                            errorLog.oo = err.data;
                                            errorLog.server = appConfigSvc.getCurrentDataServer();
                                            try {
                                                if ($scope.firebase.auth().currentUser) {
                                                    //    errorLog.userId = $scope.firebase.auth().currentUser.uid;
                                                }
                                            } catch (ex) {

                                            }


                                            errorLog.action = 'saveSD';
                                            SaveDataToServer.submitErrorReport(errorLog);

                                        }
                                    ));

                                }
                            } else if (ed.myMeta.isDirty) {
                                //this is an ED that has been modified

                            }
                        }

                        //if this element is tobe included in the profile, we can add it now...
                        if (inProfile) {
                            delete ed.myMeta;   //not sure if this is actually in there...
                            delete ed.myData;
                            ed.id = ed.path;        //in STU-3 all elements need an id that i sthe same as the path..
                            sd.snapshot.element.push(ed)
                        }

                        if (index == 0) {
                            //this is the first element - ie the one with the type name. we can add the meta element now...
                            //this is to the StructureDefinition resource - nothing to do with any extensions
                            var resourceType = baseProfile.snapshot.element[0].path;
                            var idElement = {definition:'Id',min:0,max:'1',type:[{code:'id'}]};
                            idElement.base = {path:"Resource.id",min:0,max:'1'};
                            idElement.path = resourceType+'.id';
                            idElement.id = resourceType+'.id';//in STU-3 all elements need an id that i sthe same as the path..

                            sd.snapshot.element.push(idElement)

                            var metaElement = {}
                            metaElement.path = resourceType +'.meta';    //the resource type is always the first element
                            metaElement.id = resourceType +'.meta';
                            metaElement.definition = 'The meta element';
                            metaElement.min=0;
                            metaElement.max='1';
                            metaElement.base = {path:"Resource.meta",min:0,max:'1'}
                            metaElement.type=[{code:'Meta'}];

                            sd.snapshot.element.push(metaElement);

                            var textElement = {definition:'Narrative',min:0,max:'1',type:[{code:'Narrative'}]};
                            textElement.base = {path:"DomainResource.text",min:0,max:'*'};
                            textElement.path = resourceType+'.text';
                            textElement.id = resourceType+'.text';

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
                        var errorLog = {};
                        errorLog.resource = sd;

                        errorLog.oo = err.data;
                        errorLog.server = appConfigSvc.getCurrentDataServer();
                        try {
                            if ($scope.firebase.auth().currentUser) {
                                //    errorLog.userId = $scope.firebase.auth().currentUser.uid;
                            }
                        } catch (ex) {

                        }


                        errorLog.action= 'saveSD';
                        SaveDataToServer.submitErrorReport(errorLog);
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




            },
            diffFromBase : function(profile,appConfigSvc) {
                //generate a differential from the base resource
                var deferred = $q.defer();
                //console.log(profile)
                var profileHash = {};
                var differences = [];    //an array of extensions

                //different in stu2 & 3
                var baseDefinition = profile.baseDefinition || profile.base;

                if (baseDefinition && profile.snapshot && profile.snapshot.element) {
                    //first create a hash for all elements

                    profile.snapshot.element.forEach(function(ed){

                        if (ed && ed.path && ed.max !=="0") {
                            if (ed.path.indexOf('xtension') == -1) {
                                profileHash[ed.path] = 'x'
                            } else {
                                //this is an extension. if there's a profile associated with it, then add it to the list of differences
                                if (ed.type && ed.type[0].profile && ed.type[0].profile.length > 0) {
                                    differences.push({type:'extension', ed:ed})
                                }
                            }
                        }




                    });

                    //now load the base resource and see what elements have been removed...
                    GetDataFromServer.findConformanceResourceByUri(baseDefinition).then(
                        function(baseSD){
                            //console.log(baseSD);
                            if (baseSD.snapshot && baseSD.snapshot.element) {
                                baseSD.snapshot.element.forEach(function(ed,inx){
                                    var path = ed.path;
                                    if (path && path.indexOf('xtension') == -1) {   //so not an extension...
                                        if (! profileHash[path]) {
                                            var ar = path.split('.');
                                            //there are some elements (like id & contained) that we aren't showing
                                            if (elementsToDisable.indexOf(ar[ar.length-1]) == -1) {
                                                if (ed.max !== '0') {
                                                    //sems to be in the snapshot of the careconnect profile...
                                                    differences.push({type:'removed',ed:ed})
                                                }


                                            }
                                        }
                                    }
                                })
                            }

                            deferred.resolve({differences:differences,baseDefinition:baseDefinition});

                        },function(err){
                            console.log(err);
                            deferred.reject(err);
                        }
                    )


                } else {
                    deferred.reject({err:"can't resolve the baseDefinition or some other profile issue",profile:profile})

                }

                return deferred.promise;
            },


            performDiff : function(profile1,profile2) {



            },

            createISAValueSet : function(vo,terminologyServerRoot){
                //create a valueset that is a 'is-a' of a given code. Used by the valueset creator to create the root valuesets
                //vo = {display: name: concept: url:}
                var snomedSystem = "http://snomed.info/sct";
                //there's a slight risk that someone else has used this id - in which case it will be obliviated!
                var id = "clinFHIR-" + vo.name;
                var urlOnTerminologyServer = terminologyServerRoot+ "ValueSet/"+id;//  $scope.valueSetRoot+id;

                var vs = {resourceType : "ValueSet",id:id, status:'draft', name: vo.name,compose:{include:[]}};

                vs.name = vo.name;        //so the search will work on id
                vs.description = 'Root name ValueSet' + vo.name + 'automatically created by clinFHIR';
                vs.url = vo.url;    //this is the url that references the clinfhir domain..
                vs.compose.include.push({system:snomedSystem,
                    filter:[{property:'concept',op:'is-a',value:vo.concept}]})

                vs.contact = [{name : 'clinfhir'}]

                console.log(vs)


                return $http.put(urlOnTerminologyServer,vs)


            }

        }
    }
);
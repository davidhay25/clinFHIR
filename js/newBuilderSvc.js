angular.module("sampleApp")
    .service('newBuilderSvc', function(Utilities,appConfigSvc,$q,GetDataFromServer,ResourceUtilsSvc) {

        function getLastNameInPath(path) {
            if (path) {
                var ar = path.split('.');
                return ar[ar.length-1]
            }
        }

        var elementsToDisable = ['id', 'meta', 'implicitRules', 'language',  'contained','DomainResource']; //'text',

        String.prototype.startsWithDEP = function(s){
            if (this.substr(0,s.length === s )) {
                return true;
            }
        }

        return {

            getObjectSize : function(obj) {
                //http://www.russwurm.com/uncategorized/calculate-memory-size-of-javascript-object/

                function roughSizeOfObject( object ) {
                    var objectList = [];
                    var recurse = function( value ) {
                        var bytes = 0;

                        if ( typeof value === 'boolean' ) {
                            bytes = 4;
                        } else if ( typeof value === 'string' ) {
                            bytes = value.length * 2;
                        } else if ( typeof value === 'number' ) {
                            bytes = 8;
                        } else if (typeof value === 'object'
                            && objectList.indexOf( value ) === -1) {
                            objectList[ objectList.length ] = value;
                            for( i in value ) {
                                bytes+= 8; // assumed existence overhead
                                bytes+= recurse( value[i] )
                            }
                        }
                        return bytes;
                    }

                    return recurse( object );
                }

                return roughSizeOfObject(obj)
            },

            //populate the meta.value element of the treeData array (treeData is a parsed SD - by this.makeTree()...
            parseResource : function(treeData,resource) {
                //strategy similar to builder builder (in rever


                function processRootNodes(basePath,pathObj,arNewNodes) {
                    //based on path - not an object hierarchy
                    //pathObj is the object at this point in the eval. starts with the full resource, but will be a branch for a BBE
                    //iterate through the array and find children of this base path
                    var ar = basePath.split('.')
                    var cnt = ar.length
                    treeData.forEach(function (item) {
                        var meta = item.data.meta;
                        if (meta && meta.path) {
                            var path = meta.path;
                            var ar1 = path.split('.');
                            if ((ar1.length == cnt+1) && (ar1[cnt-1] == ar[cnt-1]) ) {
                                //this is a direct child
                                //console.log(item)

                                //is this a BBE? (If so, then we need to check the child nodes as welll
                                if (meta.isBBE) {
                                    //yep. recurse into the children
                                    //is there any data in the resource at this point?
                                    var segmentName = ar1[cnt];
                                    console.log(segmentName);
                                    if (pathObj[segmentName]) {
                                        //yes, there is data...
                                        processChildBranch(meta.path,pathObj[segmentName],arNewNodes)
                                    }


                                } else {
                                    //nope. see if the resource has any values for this child off the passed in root...
                                    var segmentName = ar1[cnt];
                                    //console.log(segmentName);
                                    //pathObj might be an array (eg a BBE that is multiple)


                                    //if (Object.keys(pathObj).indexOf(segmentName) > -1){
                                    if (pathObj[segmentName]) {
                                        //yes! there is data here...  todo: need to 'mark' par


                                        var obj = pathObj[segmentName];


                                        if (angular.isArray(obj)) {
                                            meta.value = obj[0];        //set the first element...
                                            meta.index = 1;
                                            if (obj.length > 1) {
                                                //if there is more than 1 element in the array, we need to add extra elements to the tree...
                                                for (var i=1; i < obj.length;i++) {

                                                    var newNode = {data:{}};
                                                    newNode.text = item.text;
                                                    var newMeta =  angular.copy(item.data.meta);
                                                    newMeta.index = i;
                                                    newMeta.value = obj[i];
                                                    newNode.data.meta =newMeta
                                                    newNode.icon = item.icon;          //same icon...
                                                    newNode.parent = item.parent;      //has the same parent as is a peer...
                                                    newNode.id = 'id'+item.id + '-'+i ;

                                                    newNode.data.meta.index = -1; //ie no data yet newIndex;
                                                    arNewNodes.push(newNode);

                                                }
                                            }
                                        } else {
                                            meta.value = obj;
                                        }

                                    }

                                }

                            }

                        }


                    })

                }



                var arNewNodes = []
                processRootNodes('Condition',resource,arNewNodes)

                arNewNodes.forEach(function (newNode) {
                    treeData.push(newNode)
                });


                //this is a child branch - eg Condition.evidence
                function processChildBranch(basePath,pathObj,arNewNodes){
                    console.log(basePath,pathObj,arNewNodes)

                    if (angular.isArray(pathObj)) {
                        //most are arrays



                        pathObj.forEach(function (item,ctr) {




                        })


                    } else {

                    }
                }



            },
            renderResource : function(treeData){
                var display = [];       //the display array

                treeData.forEach(function (item) {
                    var meta = item.data.meta;

                    //console.log(meta)
                    if (meta && meta.path) {
                        var ar = meta.path.split('.')
                        if (ar.length == 2 || meta.isBBE) {
                            var hadValue = false;
                            if (meta.value) {
                                hadValue = true;
                                //this is a top level node
                                var path1 = ar[1];
                                var disp = ResourceUtilsSvc.getTextSummaryOfDataType(meta.value.dt,meta.value.value);
                                display.push({path1:path1,value:meta.value,display:disp})
                            }
                            getChildValues(item,hadValue,ar[1])
                        }
                    }

                });


                console.log(display)
                return display;

                function getChildValues(item,hadValue,path1) {

                    var parents = {}
                    parents[item.id] = 'x';

                    treeData.forEach(function (node) {

                        if (parents[node.parent]) {
                            //this node is a child
                            var meta = node.data.meta;
                            if (meta.value) {
                                if (!hadValue) {
                                    //there was no value for the parent (eg it was a BBE) - push a 'title' line...
                                    display.push({path1:path1,display:""})
                                    hadValue = true;
                                }

                                var ar = meta.path.split('.')
                                var path2 = ar[ar.length - 1];
                                var disp = ResourceUtilsSvc.getTextSummaryOfDataType(meta.value.dt,meta.value.value);
                                display.push({path2:path2,value:meta.value,display:disp})
                            }

                            if (node.data.meta.isBBE) {
                                parents[node.id] = 'x'
                            }

                        }

                    });


                }

                /*
                treeData.forEach(function (item) {
                    var meta = item.data.meta;
                    if (meta.value) {
                        var ar = meta.path.split('.');
                        ar.splice(0,1);
                        var displayPath =ar.join('.')
                        var path1 = ar[0];

                        var disp = ResourceUtilsSvc.getTextSummaryOfDataType(meta.value.dt,meta.value.value);
                        display.push({displayPath:displayPath,path1:path1,path2:ar[1],value:meta.value,display:disp})
                    }
                })
                console.log(display)
                return display;

                */
            },

            cleanProfile : function(SD) {
                //check that we have everything needed in the SD - basically convert to R3 (the bits we need)...

                if (SD.base) {
                    SD.baseDefinition = SD.base;
                }

                if (SD.snapshot && SD.snapshot.element) {
                    SD.snapshot.element.forEach(function(ed){
                        if (ed.name) {
                            ed.sliceName = name;
                        }
                        if (ed.contentReference) {
                            //this is a reference to another path (preceeded by a #). all of the children with that path need to be inserted...
                            //Observation.component.referenceRange (and makes it a l3 :( )
                        }
                    })
                }

                return SD;
            },

            processExtension : function(meta,dt,value,resource) {
                var deferred = $q.defer();
                var valueType = 'value' + dt.substr(0,1).toUpperCase()+dt.substr(1)     //ie the value[x]
                var element = resource;      //should be able to use this at different levels in the resource...
               // console.log(meta,value)
                var ar = meta.path.split('.');

                if (meta.isExtensionChild) {
                    //retrieve any extensions with this url. For multiple, use the index within the new node added

                    var ar = Utilities.getComplexExtensions(element,meta.parentUrl);
                    //console.log(ar);
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
                    deferred.resolve();


                } else {
                    //this is a single, stand alone extension
                    var extValue = {};
                    extValue[valueType]= value;
                    if (meta.isMultiple) {
                        Utilities.addExtensionMultiple(element,meta.url,extValue)
                    } else {
                        Utilities.addExtensionOnceWithReplace(element,meta.url,extValue)
                    }
                    deferred.resolve();
                }

                return deferred.promise;


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
                //this.cleanProfile(profile);     //especially STU2 -> R3
                //console.log(profile);
                var arIsDataType = [];          //this is a list of disabled items...
                var lst = [];           //this will be a list of elements in the profile to show.

                var dataTypes = Utilities.getListOfDataTypes();

                var cntExtension = 0;
                //a hash of the id's in the tree. used to ensure we don't add an element to a non-esixtant parent.
                //this occurs when the parent has a max of 0, but child nodes don't
                var idsInTree = {};
                var hashTree = {};

                var slicePath,sliceIndex=0;      //the root path of slicing...

                var sliceRootPath,parent,sliceGroupParent,parentForChildren;
                var queries = [];       //a list of queries to get the details of extensions...

                var pathHash = {}; //a hash of path vs id. We need unique id's in the tree, but the path is not unique when hashed..
                var nodeHash = {};      //a hash of nodes indexed by path... (used to detect expanded datatypes0

                function isParentNodeBBE(node) {
                    //return true if the parent to this node is a BBE
                    var isBBE = false;
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
                        //var el = {path: item.path};
                        var path = item.path;
                        if (! path) {
                            alert('empty path in Element Definition\n'+angular.toJson(item));
                            deferred.reject();
                            return;
                        }

                        var id = path + inx;        //<<< to guarantee a unique path - can't just use the path...
                        //if this is a discriminator, then set the slicePath
                        var updatedHash = false;
                        if (item.slicing && item.slicing.discriminator && path.indexOf('extension') == -1) {
                            slicePath = path;
                            sliceIndex = 0;
                        } else {
                            //if it's not a discriminator, the are we still in the set of elements that are part of this slice group?
                            if (slicePath) {    //obviously not if slicePath is not set..
                                if (path.substr(0,slicePath.length) !== slicePath ) {
                                    //no we arent,
                                    slicePath = null;
                                } else {
                                    //OK, we're still slicing - have we come into the next group?
                                    if (path == slicePath) {
                                        sliceIndex++;      //yes we are. incerement the index into pathHash
                                        updatedHash = true;
                                        pathHash[path].push({id:id});       //this should be at index position sliceIndex...
                                        //console.log('next group: '+sliceIndex,slicePath,pathHash[path])
                                    }
                                }
                            }
                        }
                        if (!updatedHash) {
                            pathHash[path] = pathHash[path] || []
                            pathHash[path].push({id:id});
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

                            var rootNode = {id:id,parent:'#',text:ar[0],state:{opened:true,selected:true},path:path,data: {}}

                            // Don't think this is needed.. rootNode.data.ed  = item;

                            lstTree.push(rootNode);
                            rootNode.data.meta = {type:[{code:'BackboneElement'}]};  //this is for the newBuilder to determine if a node is
                            nodeHash[path]=rootNode;


                            idsInTree[id] = 'x';
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


                        if (item.sliceName) {
                            text = item.sliceName
                        } else if (item.name) {
                            text = item.name
                        } else if (item.label) {
                            text = item.label
                        } else {
                            text = getLastNameInPath(item.path);
                        }

                        item.myMeta.id = id;        //for when we add a child node it


                        var arTree = path.split('.');
                        if (arTree[arTree.length-1] == 'extension') {

                            //text = item.name;// +inx;

                            id = id + cntExtension;
                            cntExtension++;
                        }

                        if (include) {
                            //work out the parent...
                            arTree.pop();
                            var parentPath = arTree.join('.');  //remember, when slicing this isn't unique...
                            if (slicePath) {
                                //if we're slicing, then we need the index of the slice we're working on. this is how we will find the parent...

                                //if this is the actual slicePath (not a parent) then we calculate the parent from the path
                                if (path == slicePath) {
                                    var t = pathHash[parentPath]
                                    var tt = t[0]       //it will laways be the first..
                                    var parentId = tt.id;
                                } else {
                                    // otherwise look it up in the hash based on teh index...
                                    var t = pathHash[parentPath]
                                   // console.log(slicePath,sliceIndex,parentPath,t)
                                    var tt = t[sliceIndex]
                                    var parentId = tt.id;
                                }

                            } else {
                                //if we're not slicing, then the parent can be calculated directly from the path...
                                var t = pathHash[parentPath]
                                if (!t) {
                                    alert('There was an error - the path '+parentPath + ' was not found');
                                    deferred.reject();
                                }

                                var parentId = t[0].id;   //right now we assume that it's always the first element with this path...

                            }


                            //parent = arTree.join('.');

                            /* I don't think that text will ever have this value (and if it does, then these won't help...
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
                            */

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
                            var node = {id:id,parent:parentId,text:text,state:{opened:false,selected:false},
                                a_attr:{title: dataType + ' ' + id}, path:path};


                            //attributes required for newBuilder. Hopefully can rationalize some of the other cruft in this function...
                            node.data = {meta:{}};

                            //I don't think I'm using the ed anywhere - and would like to keep the tree as small as feasible...
                            node.data.ed = item;

                            nodeHash[item.path] = node;
                            node.data.meta.path = item.path;
                            node.data.meta.originalPath = item.path;
                            node.data.meta.type = item.type;
                            node.data.meta.definition = item.definition;
                            node.data.meta.comment = item.comment;
                            node.data.meta.index = -1;//sliceIndex; //0;   //used for multiple instances...

                            node.data.meta.canCopy = true;  //allow this node to be copied (if a BBE and multiple - todo ?maybe check???)
                            if (item.binding) {
                                if (item.binding.valueSetReference) {
                                    node.data.meta.vs = {url:item.binding.valueSetReference.reference};
                                    node.data.meta.vs.strength = item.binding.strength;
                                }

                                //todo this is not strictly correct, but clinFHIR incorrecty used uri, so we'll allow for that...
                                if (item.binding.valueSetUri) {
                                    node.data.meta.vs = {url:item.binding.valueSetUri};
                                    node.data.meta.vs.strength = item.binding.strength;
                                }

                            }

                            if (item.type) {
                                item.type.forEach(function (typ) {
                                    var cd = typ.code;
                                    if (cd) {
                                        if (cd == 'BackboneElement') {
                                            node.data.meta.isBBE = true;
                                        }

                                        if (cd.substr(0,1) === cd.substr(0,1).toUpperCase()) {
                                            node.data.meta.isComplex = true;
                                        }

                                        if (cd == 'Reference') {
                                            node.data.meta.isReference = true;
                                        }
                                    } else {
                                        alert('type without a code at '+ node.path)
                                    }


                                })
                            }

                            if (item.min !== 0) {
                                node.data.meta.isRequired = true;
                            }

                            //if this is a max or X OR a slice element, then must be multiple... (only multiples can be sliced)
                            if (item.max == '*' || slicePath) {
                                node.data.meta.isMultiple = true;
                               // node.data.meta.index = 0;       //used to track multiple instances of this node
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
                            if (idsInTree[parentId]) {
                                lstTree.push(node);
                                idsInTree[id] = 'x'
                                lst.push(item);

                            } else {
                                addLog('missing parent: '+parentId + ' id:'+id + ' path:'+item.path,true)
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
//console.log(analysis)
                                    if (analysis) {
                                        if (analysis.isComplexExtension) {
                                            node.data.meta.definition = analysis.definition;
                                            if (analysis.children) {
                                                //add the child nodes for the complex extension...
                                                analysis.children.forEach(function(child){
                                                    var id = 'ce'+lstTree.length+newNodes.length;
                                                    var newNode = {id:id,parent:node.id,text:child.code,state:{opened:false,selected:false},
                                                        a_attr:{title: + id}};
                                                    newNode.data = {meta:{}};
                                                    newNode.data.meta = {path:node.data.meta.path + "."+child.code};
                                                    newNode.data.meta.definition = child.ed.definition;

                                                    if (child.ed.binding) {
                                                        newNode.data.meta.binding = child.ed.binding;

                                                        if (child.ed.binding.valueSetReference) {
                                                            newNode.data.meta.vs = {url:child.ed.binding.valueSetReference.reference};
                                                            newNode.data.meta.vs.strength = child.ed.binding.strength;
                                                        }

                                                    }

                                                    if (child.ed.min !== 0) {
                                                        newNode.data.meta.isRequired = true;
                                                    }

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
                                            //console.log(analysis)
                                            node.data.meta.type = analysis.dataTypes;   //replace the 'Extension' dataytype

                                            if (analysis.binding) {
                                                node.data.meta.binding = analysis.binding;
                                                node.data.meta.definition = analysis.definition;
                                                if (analysis.binding.valueSetReference) {
                                                    node.data.meta.vs = {url:analysis.binding.valueSetReference.reference};
                                                    node.data.meta.vs.strength = analysis.binding.strength;
                                                }

                                            }


                                        }

                                    }
                                }

                            });


                            lstTree = lstTree.concat(newNodes)

                            setNodeIcons(lstTree);

                            //remove all the ed's to save space....
                            lstTree.forEach(function(node){
                                delete node.ed;
                            })



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

                        var meta = node.data.meta;

                        if (meta.isRequired) {
                            node['li_attr'] = {class : 'elementRequired elementRemoved'};
                        } else {
                            //have to formally add an 'optional' class else the required colour 'cascades' in the tree...
                            node['li_attr'] = {class : 'elementOptional'};
                        }

                        if (meta.isComplex) {
                            node.icon='/icons/icon_datatype.gif';
                        } else {
                            node.icon='/icons/icon_primitive.png';
                        }


                        if (meta.isReference) {
                            node.icon='/icons/icon_reference.png';
                        }

/*

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

                        //set the '[x]' if there is more than one datatype
                        if (node.text && node.text.indexOf('[x]') == -1) {
                            var refDt = {};
                            if (node.data && node.data.ed && node.data.ed.type) {
                                for (var i = 0; i < node.data.ed.type.length; i++) {
                                    var dt = node.data.ed.type[i].code;
                                    refDt[dt] = 'x'
                                }
                                if (Object.keys(refDt).length > 1) {
                                    node.text += '[x]'
                                }
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

                        */
                    })
                }

                // return {table:lst,treeData:lstTree};

            }
        }

    });
angular.module("sampleApp").service('profileDiffSvc',
    function($q,$http,GetDataFromServer,Utilities,appConfigSvc,$filter,resourceSvc,profileCreatorSvc,
             $localStorage,$firebaseObject,$firebaseArray) {

        $localStorage.extensionDefinitionCache = $localStorage.extensionDefinitionCache || {}

        var objColours ={};

        objColours.profile = '#ff8080';
        objColours.extension = '#ffb3ff';
        objColours.extensionEdge = '#9900cc';
        objColours.terminology = '#FFFFCC';
        objColours.terminologyEdge = '#cccc00';

        //_loaded are profiles not in the IG...
        objColours.profile_loaded = '#00c6ff'
        objColours.extension_loaded = '#ffb3ff';
        objColours.terminology_loaded = '#FFFFCC';
        objColours.Patient = '#93FF1A';

        objColours.List = '#ff8080';
        objColours.Observation = '#FFFFCC';
        objColours.Practitioner = '#FFBB99';
        objColours.MedicationStatement = '#ffb3ff';
        objColours.CarePlan = '#FF9900';
        objColours.Sequence = '#FF9900';
        objColours.CareTeam = '#FFFFCC';
        objColours.Condition = '#cc9900';


        objColours.Organization = '#FF9900';
        objColours.ProviderRole = '#FFFFCC';
        objColours.Location = '#cc9900';
        objColours.HealthcareService = '#FFFFCC';

        objColours.Medication = '#FF9900';

        var igEntryType = appConfigSvc.config().standardExtensionUrl.igEntryType;

        var commentsThisProfileHash = {};       //comments against thos profile, hashed by element

        //remove the contents of an SD that we're not using to reduce the cache requirements
        function minimizeSD(SD) {
            var startSize = Utilities.getObjectSize(SD);
            delete SD.text;
            delete SD.differential;
            if (SD.snapshot && SD.snapshot.element) {
                SD.snapshot.element.forEach(function (ed) {
                    delete ed.constraint;
                 //NO!!!!!!    delete ed.mapping;

                })
            }
            var endSize = Utilities.getObjectSize(SD);
            var url = SD.url || 'Unknown url'


            $localStorage.totalSavings = $localStorage.totalSavings || 0;
            $localStorage.totalSavings += (startSize-endSize);

            return SD;
        }

        function makeCommentEntry(obs) {
            var comment = {comment: obs.valueString,replies:[]};
            comment.id = obs.id;
            var element = obs.subject.display;
            comment.issued = obs.issued;
            if (obs.performer) {
                comment.email = obs.performer[0].display;
            }
            return comment;
        }

    return {

       findShortCutForModel : function(id) {
            var deferred = $q.defer();
            var scCollection = $firebaseArray(firebase.database().ref().child("shortCut"));
            scCollection.$ref().orderByChild("modelId").equalTo(id).once("value", function(dataSnapshot){
                var series = dataSnapshot.val();
                if(series){
                    //so there's at least 1 shortcut for a model with this id, now check the server

                    angular.forEach(series,function(v,k){

                        if (v.config.conformanceServer.url == appConfigSvc.getCurrentConformanceServer().url) {
                            deferred.resolve(v)
                        }
                    })
                    deferred.reject()

                } else {
                    deferred.reject()
                }

            })
            return deferred.promise;

        },

        saveNewComment : function(comment,profileUrl,ED,userEmail,relatedToId) {
            var deferred = $q.defer();
            var obs = {resourceType:'Observation',status:'final'}
            obs.category = {coding:[{system:'clinfhir.com/observationCategory',code:'profile-comment'}]}
            obs.code = {coding:[{system:'clinfhir.com/observationCommentProfile',code:profileUrl}]}
            obs.valueString = comment;
            obs.issued = new moment().format();
            if (userEmail) {
                obs.performer = [{display:userEmail}]
            }

            //the actual element being commented on (sliceName if an extension, path otherwise...
            var element = ED.sliceName || ED.path;      //path is always present...
            if (! element) {
                deferred.reject({msg:"Can't find path"})
                return;
            }
            obs.subject = {display:element}

            if (relatedToId) {
                //not null if this is a reply to a previous comment
                obs.related = [{type:'sequel-to',target:{reference:'Observation/'+relatedToId}}]
            }
            var url = appConfigSvc.getCurrentConformanceServer().url+"Observation";

            $http.post(url,obs).then(
                function(){
                    var displayObj = makeCommentEntry(obs)
                    commentsThisProfileHash[element] = commentsThisProfileHash[element] || []
                    commentsThisProfileHash[element].push(displayObj)
                    deferred.resolve(displayObj)
                },function(err) {
                    deferred.reject(err)
                }
            );

            return deferred.promise
        },
        getCommentsForProfile : function (profileUrl) {
            commentsThisProfileHash = {};       //hash by element

            var deferred = $q.defer();
            var url =  appConfigSvc.getCurrentConformanceServer().url+"Observation";
            url += "?category=clinfhir.com/observationCategory|profile-comment";
            url += "&code=clinfhir.com/observationCommentProfile|"+profileUrl + "," + new Date().getTime(); //date is a hack to stop caching

            GetDataFromServer.adHocFHIRQueryFollowingPaging(url).then(


           // $http.get(url).then(
                function(data) {
                    var bundle = data.data;
                    var replies = [];   //save all replies until all obs read...
                    var commentHash = {}
                    var cnt = 0;
                    if (bundle.entry) {
                        bundle.entry.forEach(function(entry){
                            var obs = entry.resource;


                            if (obs.subject) {
                                var comment = makeCommentEntry(obs);
                                if (obs.related) {
                                    //this is a reply to. Save until we've processed them all...
                                    if (obs.related[0].target && obs.related[0].target.reference) {
                                        var ar = obs.related[0].target.reference.split('/')
                                        var parentId = ar[1];       //the id of the obs that this one is related to
                                        comment.parentId = parentId
                                        replies.push(comment)
                                    }



                                } else {
                                    var element = obs.subject.display;
                                    commentsThisProfileHash[element] = commentsThisProfileHash[element] || []
                                    commentsThisProfileHash[element].push(comment)
                                    cnt++;
                                    commentHash[comment.id]=comment;
                                }




                            }

                        });

                        if (replies.length > 0) {
                            //if there are any replies, then add them to the original comment
                            replies.forEach(function(reply){

                                var parent = commentHash[reply.parentId]
                                if (parent) {
                                    parent.replies.push(reply)
                                    console.log(parent)
                                }


                            })
                        }


                    }
                    deferred.resolve({hash:commentsThisProfileHash,count:cnt})
                },function(err) {
                    console.log(err)
                    deferred.reject(err)
                }
            );


            return deferred.promise;
        },
        getCommentsForElement : function(ED){
            var element = ED.sliceName || ED.path;

            var ar = commentsThisProfileHash[element] || []

            return ar


        },
        setPurpose : function(igResource,purpose) {
            //use a consistent purpose extension for contents in an IG
            Utilities.addExtensionOnceWithReplace(igResource,igEntryType,purpose)
        },
        getPurpose: function(igResource) {
            //get the purpose from the IG.package.resource node.
            var ext = Utilities.getSingleExtensionValue(igResource,igEntryType)
            if (ext && ext.valueCode) {
                return ext.valueCode;
            } else if (igResource.purpose) {
                return igResource.purpose
            } else if (igResource.acronym) {
                return igResource.acronym
            }

        },

        makeCapStmt : function(cs) {

            var extProfileLink = "http://hl7.org/fhir/us/core/StructureDefinition/us-core-profile-link";
            var extCapExpect="http://hl7.org/fhir/StructureDefinition/capabilitystatement-expectation";
            var extCapCombo = "http://hl7.org/fhir/StructureDefinition/capabilitystatement-search-parameter-combination"

            //create a 'displayable' capability statement from the CapStmt in the core profiles (eg US-Code). Uses lots of extensions...
            var capStmt = {profile:[],rest:[]}
            cs.profile.forEach(function (prof) {
                var profItem = {reference:prof.reference,display:prof.display}
                var ext = Utilities.getSingleExtensionValue(prof,extProfileLink);
                profItem.code = ext.valueCode;
                capStmt.profile.push(profItem)
            });

            var endpoint = cs.rest[0];  //assume a single endpoint only...
            endpoint.resource.forEach(function (res) {
                //this is a single resource (like 'Patient')
                var resItem = {type:res.type,interaction:[],search:[]};
                if (res.interaction) {
                    res.interaction.forEach(function (int) {
                        var intItem = {code:int.code,documentation:int.documentation}
                        var ext = Utilities.getSingleExtensionValue(int,extCapExpect);
                        intItem.expectation = ext.valueCode;
                        resItem.interaction.push(intItem)

                    });
                }


                if (res.searchParam) {
                    res.searchParam.forEach(function (srch) {
                        var srchItem = {type:'single',name:srch.name,definition:srch.definition,type:srch.type}
                        var ext = Utilities.getSingleExtensionValue(srch,extCapExpect);
                        srchItem.expectation = ext.valueCode;
                        resItem.search.push(srchItem)
                    });

                }

                if (res.extension) {
                    //combination searches
                    var ar = Utilities.getComplexExtensions(res,extCapCombo)
                    if (ar.length > 0) {
                        resItem.comboSearch = ar;
                    }


                }





                capStmt.rest.push(resItem)
            });



            return capStmt;
        },

        findItem : function(url,IG) {
            //find an item from the IG package/resource based on the url. We assume the url is unique
            var inx = -1;
            for (var i=0; i< IG.package.length; i++) {
                var package = IG.package[i];
                for (var j=0; j < package.resource.length; j++) {
                    var resource = package.resource[j]
                    if (resource.sourceReference && resource.sourceReference.reference == url) {
                        return resource;
                        i = IG.package.length;      //to break the outer loop as well (may not be necesary)
                        break;
                    }
                }
            }


        },

        deleteItem : function(url,IG) {
            //remove an item from the IG package/resource based on the url. We assume the url is unique
            var inx = -1;
            for (var i=0; i< IG.package.length; i++) {
                var package = IG.package[i];
                for (var j=0; j < package.resource.length; j++) {
                    var resource = package.resource[j]
                    if (resource.sourceReference && resource.sourceReference.reference == url) {
                        if (package.resource.length == 1) {
                            //remove the whole package
                            IG.package.splice(i,1);
                            i = IG.package.length;      //to break the outer loop as well
                            break;
                        } else {
                            //just remove this one
                            package.resource.splice(j,1)
                            i = IG.package.length;      //to break the outer loop as well
                            break;
                        }
                    }
                }
            }


        },


        generateV2MapFromSD : function(SD) {
            if (!SD || !SD.snapshot) {return;}

            var v2Hash = {}
            SD.snapshot.element.forEach(function (ed) {
                if (ed.mapping) {

                    ed.mapping.forEach(function (map) {
                        if (map.identity == 'hl7V2') {
                            var ar = map.map.split('|')
                            var v2Field = ar[0]
                            v2Hash[v2Field] = v2Hash[v2Field] ||[]
                            v2Hash[v2Field].push({path:ed.path,comment:ar[1]})
                        }
                    })
                }

            })

            var arV2 = []
            angular.forEach(v2Hash,function (v,k) {
                arV2.push({hl7:k,fhir:v})
            })

            arV2.sort(function (a,b) {
                if (a.hl7 > b.hl7) {
                    return 1
                } else {
                    return -1
                }

            });
            return arV2;

        },

        generatePageTree : function(IG,artifacts,typeDescription){
            var treeData = [];

            if (IG.page) {
                addPage(treeData,IG.page,{id:'#'});
            } else {
                //create a front page...
                var frontPage = {source:"about:blank",kind:'page',page:[]};
                setTitle(frontPage,"Documentation");
                addPage(treeData,frontPage,{id:'#'});
            }

            //at this point, we've added the pages to the tree. Now add the artifacts...
            console.log(artifacts);

            var id = 't' + new Date().getTime() + Math.random()*1000
            var artifactsRoot = {id:id,parent:'#',text:"FHIR artifacts",state: {opened: true}};
            artifactsRoot.data = {nodeType:'artifactRoot'};


            treeData.push(artifactsRoot);

            angular.forEach(artifacts,function(value,key) {


                var id = 't' + new Date().getTime() + Math.random()*1000
                var artifactTypeRoot = {id:id,parent:artifactsRoot.id,text:typeDescription[key]+'s',state: {opened: false}};
                artifactTypeRoot.data = {nodeType:'artifactType',artifactType:key};
                treeData.push(artifactTypeRoot);

                value.forEach(function (art) {
                    art.purpose=key;

                    var id = 't' + new Date().getTime() + Math.random()*1000;

                    var text = art.name;// || "No name"

                    if (! text) {
                        text = $filter('getLogicalID')(art.url)
                    }
                    var artifactNode = {id:id,parent:artifactTypeRoot.id,text:text,state: {opened: true}};
                    artifactNode.data = {nodeType : 'artifact',art:art};
                    treeData.push(artifactNode);
                })

            });

            return treeData;



            function addPage(treeData,page,parentNode) {

                var id = 't' + new Date().getTime() + Math.random()*1000
                var title = page.title || page.name;    //R3/STU2
                var node = {id:id,parent:parentNode.id,text:title,state: {opened: true}}
                var pageInTree = angular.copy(page);
                delete pageInTree.page;

                node.data = pageInTree;
                if (parentNode.id !== '#') {
                    node.data.nodeType = 'page';
                } else {
                    node.data.nodeType = 'pageRoot';
                }


                treeData.push(node);


                if (page.page && page.page.length > 0) {
                    for (var i=0; i< page.page.length; i++) {
                        var page1 = page.page[i];
                        addPage(treeData,page1,node);
                    }
                }
            }

            function setTitle(page,text) {
                var fhirVersion = appConfigSvc.getCurrentConformanceServer().version;
                if (fhirVersion == 2) {
                    page.name = text
                } else {
                    page.title = text;
                }
            }


        },


        updateExtensionsAndVSInProfile : function(IG,SD,pkg) {
            //add any referenced extensions and valuesets to the IMPLEMENTATIONGUIDE!!!...
            var updated = false;
            var that = this;
            if (! pkg) {
                pkg = IG.package[0];
            }

            SD.snapshot.element.forEach(function (ed) {
                if (ed.type) {
                    ed.type.forEach(function (typ) {
                        if (typ.code == 'Extension' && typ.profile) {
                            var profileUrl = typ.profile;
                            if (angular.isArray(profileUrl)) {
                                profileUrl = typ.profile[0]
                            }

                            //is it already in the IG?
                            var res = that.findResourceInIGPackage(IG,profileUrl);

                            if (!res) {

                                var res = {sourceReference:{reference:profileUrl}};

                                //todo - should likely move to an extension for R3

                                if (appConfigSvc.getCurrentConformanceServer().version ==2) {
                                    res.purpose = 'extension'
                                } else {
                                    res.acronym = 'extension'
                                }
                                pkg.resource.push(res);
                                updated = true;
                            }
                        }

                    })
                }
                if (ed.binding) {

                    //in amsterdam. Only look for bindings that are a reference (not a Uri) - as a uri won't resolve...

                    var vsUrl;
                    if (ed.binding.valueSetReference && ed.binding.valueSetReference.reference) {
                        vsUrl = ed.binding.valueSetReference.reference;



                  //  }



                    /*
                    //prefer the valueSetReference...
                    var vsUrl = ed.binding.valueSetUri;
                    if (ed.binding.valueSetReference) {
                        vsUrl = ed.binding.valueSetReference.reference;
                    }

                    */


                  //  if (vsUrl) {
                        var res = that.findResourceInIGPackage(IG,vsUrl);

                        if (!res) {
                            var res = {sourceReference:{reference:vsUrl}};
                            //todo - should likely move to an extension for R3
                            if (appConfigSvc.getCurrentConformanceServer().version ==2) {
                                res.purpose = 'terminology'
                            } else {
                                res.acronym = 'terminology'
                            }


                            pkg.resource.push(res);
                            updated = true;
                        }
                    }
                }
            })
            return  updated;
        },
        makeLMFromProfile : function(inProfile) {

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

                        //standard element names like 'text' or 'language'. Note that hidden elements are actually removed from the tree b4 returning...
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




                        node.text = getDisplay(node);

                        if (segment == 'extension') {

                            //set the text to a better display (not the path)
                            //node.text = item.name || item.short || node.text;
                            node.text = item.name|| item.sliceName || item.short || node.text;

                            node.a_attr = {style:'color:blueviolet'}
                            //if the extension has a profile type then include it, otherwise not...
                            node.state.hidden=true;     //default is to hide...
                            if (item.type) {
                                item.type.forEach(function (it) {
                                    if (it.code == 'Extension' && it.profile) {
                                        //load the extension definition
                                        node.state.hidden=false;    //if there is a profile, then show it...
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

                        //hide discriminator entry
                        if (item.slicing) {
                            node.state.hidden=true;
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

                            setNodeIcons(lstTree);


                            deferred.resolve({table:lst,treeData:removeHidden(lstTree),errors: loadErrors})
                        }
                    )

                } else {
                    setNodeIcons(lstTree);
                    deferred.resolve({table:lst,treeData:removeHidden(lstTree),errors: loadErrors})
                }


            }

            return deferred.promise;


            //also set the max length of the text in the tree...
            function removeHidden(lst) {
                var treeData =[];
                var hash = {}
                lst.forEach(function (item,inx) {
                    var include = true
                    if (item.state && item.state.hidden){
                        include = false
                    }
                    //include if first (root) node, is not hidden =, and has a parent
                    if (inx == 0 || (include && hash[item.parent])) {
                        treeData.push(item);
                        hash[item.id] = 'x';    //for the parent check

                        if (item.text && item.text.length > 40) {
                            item.text = item.text.substr(0,37) + '...';
                        }




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
                    } else
                    if (ed.label) {
                        display=ed.label
                    } else if (ed.name) {
                        display=ed.name;
                    } else if (ed.short) {
                        display=ed.short;
                    }
                }




                if (ed.slicing) {
                    display += " D"
                }

                if (ed.myMeta.fixed) {
                    display += " F"
                }

                return display;
            }


            function getLastNameInPathDEP(path) {
                if (path) {
                    var ar = path.split('.');
                    return ar[ar.length-1]
                }
            }

            function setNodeIcons(treeData) {
                //here is where we set the icons - ie after all the extension definitions have been loaded & resolved...
                lstTree.forEach(function(node){

                    if (node.data && node.data.ed) {
                        //look for hidden nodes
                        var path = node.data.ed.path;
                        var ar = node.data.ed.path.split('.');
                        if (elementsToDisable.indexOf(ar[ar.length-1])>-1) {
                            node.state.hidden=true;
                        }

                        //set the 'required' colour
                        if (node.data.ed.min == 1) {
                            node['li_attr'] = {class : 'elementRequired elementRemoved'};
                        } else {
                            //have to formally add an 'optional' class else the required colour 'cascades' in the tree...
                            node['li_attr'] = {class : 'elementOptional'};
                        }

                        //set multiplicity
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


                    //set icon
                    node.icon='/icons/icon_primitive.png';
                    if (node.data && node.data.ed) {
                        if (node.data.ed.type) {
                            node.data.ed.type.forEach(function(typ){

                                if (typ.code) {
                                    if (typ.code.substr(0,1) == typ.code.substr(0,1).toUpperCase()){
                                        node.icon='/icons/icon_datatype.gif';
                                    }

                                    if (typ.code == 'Reference') {
                                        node.icon='/icons/icon_reference.png';
                                    }
                                }




                            })
                        }
                    }

                    //set the display icon
                    if (1 == 2 && node.data && node.data.ed && node.data.ed.myMeta){

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



        },


        objectColours : function () {
            return objColours;
        },

        findResourceInIGPackage : function(IG,profileUrl) {
            var res;
            IG.package.forEach(function (pkg) {
                pkg.resource.forEach(function (r) {
                    if (r.sourceReference) {
                        if (r.sourceReference.reference == profileUrl) {
                            res = r;
                        }
                    }

                })
            });
            return res;
        },

        createDownloadBundle : function(IG){
            //only include profiles and extensions for now. Could add the others...
            var deferred = $q.defer();
            var that = this;
            var bundle = {resourceType:'Bundle',type:'collection',entry:[]}
            var arQuery = [];
            bundle.entry.push({resource:IG});
            IG.package.forEach(function (package) {
                package.resource.forEach(function (resource) {
                    var purpose = resource.purpose || resource.acronym;     //<<< todo - 'purpose' was removed in R3...
                    if (purpose == 'profile' || purpose == 'extension') {
                        arQuery.push(addResource(that,resource.sourceReference.reference,bundle));
                    }

                })
            });

            $q.all(arQuery).then(
                function() {
                    deferred.resolve(bundle)
                }, function() {
                    //any failure to read will cause a rejection...
                    deferred.reject(bundle)
                }
            );

            return deferred.promise;

            function addResource(that,url,bundle) {
                var deferred1 = $q.defer();




                that.getSD(url).then(
                    function (SD) {
                        bundle.entry.push({resource:SD});
                        deferred1.resolve()
                    }, function(err) {
                        deferred1.reject()
                    }
                )
                return deferred1.promise;
            }


        },
        //generate a chart showing the interrelationships of artifacts in the IG...
        createGraphOfIG: function (inIG,options) {

            var IG = angular.copy(inIG);    //as teh IG gets mutated by this function....
            options = options || {profiles:[]};

            var deferred = $q.defer();

            var that = this;

            var arNodes = [], arEdges = [];

            //create a hash indexed on the url and a node of all the artifacts...
            var hash = {};
            var allNodeHashById = {};
            var IdToUse = 0;
            IG.package.forEach(function (package) {
                package.resource.forEach(function (item,inx) {
                    IdToUse++;


                    //because I'm using acronym in R3. Dumb really - should replace with an extension..
                    var purpose = item.purpose || item.acronym;

                    var include = true;
                    switch (purpose) {
                        case 'extension' :
                            if (! options.includeExtensions) {
                                include = false;
                            }
                            break;
                        case 'terminology' :
                            if (! options.includeTerminology) {
                                include = false;
                            }
                            break;

                    }

                    if (include && item.sourceReference) {
                        var url = item.sourceReference.reference;   //the url of the node
                        if (url) {


                            //var label = path = $filter('referenceType')(url);  this can't be right???
                            var label = $filter('referenceType')(url);
                            var node = {id: IdToUse, label: label, shape: 'box',color:objColours[purpose]};


                            node.data = item;
                            node.data.url = url;
                            //node.hidden = true;
                            hash[url]={acronym:item.acronym,purpose:item.purpose,description:item.description,nodeId:IdToUse,usedBy:[],node:node};  //usedBy is for extensions - what uses them...

                            allNodeHashById[node.id] = node;
                            arNodes.push(node);
                        } else {
                            console.log("---> ",item,'No url')
                        }

                    }

                })
            });


            //now load all the profiles, and figure out the references to extensions and other types. Do need to create all the nodes first...
            var arQuery = []
            angular.forEach(hash,function(item,key){


                var parentId = item.nodeId;

                if (item.purpose == 'profile' || item.purpose == 'extension' ||item.acronym == 'profile' || item.acronym == 'extension') {
                    var url = key;//item.sourceReference.reference;
                    arQuery.push(getEdges(that, url,hash,parentId,arEdges,options,item.node));
                }
            });




            $q.all(arQuery).then(
                function(){

                    //now - after all the edges have been created, if there is a specificed set of nodes to display then hide those without a reference
                    hashRelationships = {};   //this will be a hash of relationships we know about...
                    if (options.profiles.length > 0) {

                        //first hide all the nodes
                        arNodes.forEach(function (node) {
                            node.hidden = true;
                        });

                        //and the edges...
                        arEdges.forEach(function (node) {
                            node.hidden = true;
                            node.paths = [];    //this will have all the paths between 2 resources (we aggregate them below against the first one
                        });



                        var hashInclude = {};       //a hash of the nodes to include
                        //create the initial hash from the urls passed in...
                        options.profiles.forEach(function (url) {
                            arNodes.forEach(function (node) {
                                if (node.data.url == url) {
                                    hashInclude[node.id] = node;
                                    node.hidden=false;
                                }
                            })
                        });

                        //now move through all the nodes showing the ones  with a relation to that one.
                        //iterate until no more changes...

                        var moreToCheck = true;

                        while (moreToCheck) {
                            moreToCheck = false;
                            arNodesToAdd = [];  //array of new nodes to add after this iteration. Adding it in the iteration mucks of forEach..

                            angular.forEach(hashInclude,function (node,key) {
                                arEdges.forEach(function (edge) {
                                    if (edge.from == node.id){
                                        //this is a relationship from this node.

                                        var hash = node.id+"-"+edge.to;
                                        //is the 'to' node in the hash of nodes (It can get added during iterations...)?
                                        if (! hashInclude[edge.to]) {
                                            //have to add it after the iteration
                                            var nn = allNodeHashById[edge.to]
                                            if (nn) {
                                                //nn.hidden = false;
                                                arNodesToAdd.push(nn);
                                            }
                                            moreToCheck = true;     //we'll need to go around again..
                                        }

                                        if (! hashRelationships[hash]) { //do we already know about this relationship?
                                            //no we don't, is the target already in the list of nodes to include
                                            if (! hashInclude[edge.to]) {
                                                //no it isn't - add it to the hash...
                                                hashInclude[edge.to] = edge;
                                                //and set the hidden for the 'to' node to false...
                                                for (var i=0; i< arNodes.length; i++)  {
                                                    if (arNodes[i].id == edge.to) {

                                                        if (options.includePatient) {
                                                            arNodes[i].hidden = false;
                                                        } else {
                                                            if (node.data.url.indexOf('atient') == -1) {
                                                                arNodes[i].hidden = false;
                                                            }
                                                        }
                                                        break;
                                                    }
                                                }
                                                moreToCheck = true; // ...and set the flag for another round
                                                edge.hidden = false;
                                                //edge.paths.push(edge.data.path)

                                            }
                                            var pathHash = {};
                                            pathHash[edge.data.path]= edge.data.ed;
                                            hashRelationships[hash] = {pathHash : pathHash}; //mark that we know about this relationship...
                                            hashRelationships[hash].from = hashInclude[edge.from]
                                            hashRelationships[hash].to = hashInclude[edge.to]
                                        } else {

                                            hashRelationships[hash].pathHash[edge.data.path]= edge.data.ed;

                                        }
                                    }
                                })

                            });

                            //add the new nodes found in this iteration to the main hash of nodes
                            arNodesToAdd.forEach(function (node) {
                                hashInclude[node.id] = node;
                            });

                            //are we following the full chain?
                            if (options.immediateChildren) {
                                moreToCheck = false;
                            }
                        }
                    }

                    //actually remove all the hidden nodes & edge
                    var newArNodes = [], newArEdges=[];
                    arNodes.forEach(function (node) {
                        if (! node.hidden) {
                            newArNodes.push(node);
                        }
                    });

                    arEdges.forEach(function (edge) {
                        if (! edge.hidden) {
                            newArEdges.push(edge);
                        }
                    });

                    var nodes = new vis.DataSet(newArNodes);
                    var edges = new vis.DataSet(newArEdges);

                    // provide the data in the vis format
                    var data = {
                        nodes: nodes,
                        edges: edges,
                        hash:hash,
                        hashRelationships : hashRelationships
                    };

                    deferred.resolve(data)
                },
                function(err){
                    deferred.reject(err)
                }
            );


            return deferred.promise;
            //----------

            function addNode(url,purpose) {
                //return;
                if (url && ! hash[url]) {
                    //adds a new node (generally a core node)
                    var label = path = $filter('referenceType')(url);


                    var id = new Date().getTime() + "-" + Math.random();
                    var node = {id: id, label: label, shape: 'box',color:objColours[purpose+'_loaded']};
                    //var node = {id: id, label: label, shape: 'box',color:'#f7eaea'};

                    node.data ={purpose:purpose, sourceReference: {reference:url}};
                    node.data.url = url;
                    node.hidden = true;
                    //these objects are all defined outside of the function...
                    arNodes.push(node);

                    hash[url]={purpose:purpose,description:"",nodeId:node.id,usedBy:[]}  //usedBy is for extensions - what uses them...
                    allNodeHashById[node.id] = node;
                    return id;
                }


            }

            //get all the outward edges from this resource...
            function getEdges(that, url,hash,parentId,arEdges,options,node) {
                var deferred1 = $q.defer();
                that.getSD(url).then(
                    function (SD) {
                        node.data.SD = SD;


                        SD.snapshot.element.forEach(function (ed) {
                            //a reference to an extension

                            if (ed.max !== '0') {

                                if (options.includeExtensions) {
                                    if (ed.path.indexOf('xtension') > -1) {
                                        if (ed.type) {
                                            var profile = ed.type[0].profile;
                                            var ref = hash[profile];
                                            if (ref) {
                                                //hurrah! we have a target resource
                                                var extConfig = {from: parentId, to: ref.nodeId, data:{path:ed.path,ed:ed}}

                                                extConfig.arrows = {to:{enabled:false}};
                                                extConfig.dashes = true;

                                                extConfig.color = objColours['extensionEdge']


                                                arEdges.push(extConfig)
                                                ref.usedBy.push(SD.url)
                                            }
                                        }
                                    }
                                }




                                //is there a binding to a ValueSet?
                                if (ed.binding) {
                                    var url = ed.binding.valueSetUri;
                                    if (ed.binding.valueSetReference) {
                                        url = ed.binding.valueSetReference.reference
                                    }

                                    if (url) {
                                        var ref = hash[url];
                                        if (ref) {
                                            //hurrah! we have a target ValueSet

                                            var vsConfig={from: parentId, to: ref.nodeId, data:{path:ed.path,ed:ed}}
                                            vsConfig.arrows = {to:{enabled:false}};
                                            vsConfig.dashes = true;
                                            vsConfig.color = objColours['terminologyEdge']

                                            arEdges.push(vsConfig)
                                            ref.usedBy.push(url)
                                        } else {
                                            //this is a reference to a resource not in the IG

                                            if (options.includeCore && options.includeTerminology) {
                                                var newNodeId = addNode(url,'terminology')

                                                var vsConfig={from: parentId, to: newNodeId, data:{path:ed.path,ed:ed}}
                                                vsConfig.arrows = {to:{enabled:false}};
                                                vsConfig.dashes = true;
                                                vsConfig.color = objColours['terminologyEdge']

                                                arEdges.push(vsConfig)
                                            }

                                        }

                                    }
                                }

                                //a reference to another resource type
                                if (ed.type) {
                                    ed.type.forEach(function (typ) {

                                        if (typ.code == 'Reference') {
                                            var targetProfile = typ.targetProfile;
                                            if (typ.profile) {
                                                //stu 2 - get the first one only...
                                                targetProfile = typ.profile[0]
                                            }
                                            var ref = hash[targetProfile];
                                            if (ref) {
                                                //hurrah! we have a target resource
                                                arEdges.push({from: parentId, to: ref.nodeId, data:{path:ed.path,ed:ed}})

                                            } else {
                                                //this is a reference to a resource not in the IG

                                                if (options.includeCore) {
                                                    var newNodeId = addNode(targetProfile,'profile')
                                                    arEdges.push({from: parentId, to: newNodeId, data:{path:ed.path,ed:ed}})
                                                }
                                            }
                                        }


                                    })
                                }

                            }

                        });
                        deferred1.resolve();


                    },function(){
                        //even if we can't find the resource, resolve the promise so that $q.all will work correctly...
                        deferred1.resolve();
                    }
                );

                return deferred1.promise;

            }


        },

        clearCache : function(){
            delete $localStorage.extensionDefinitionCache;
            delete $localStorage.totalSavings;
            $localStorage.extensionDefinitionCache = {};
            alert('Done! (Be warned that the app will be a bit sluggish until the caches are re-filled)')
        },

        findProfiles : function(svr,type) {
            //var svr =  appConfigSvc.getCurrentConformanceServer();
            var searchString = appConfigSvc.getCurrentConformanceServer().url + "StructureDefinition?";

            if (svr.version == 3) {
                searchString += "kind=resource&base=http://hl7.org/fhir/StructureDefinition/"+$scope.results.profileType.name
            } else {
                //var base = "http://hl7.org/fhir/StructureDefinition/DomainResource";
                searchString += "kind=resource&type="+baseType.name;
            }


            $scope.waiting = true;

            $http.get(searchString).then(       //first get the base type...
                function(data) {
                    $scope.profilesOnBaseType = data.data;

                    var url1 =  appConfigSvc.getCurrentConformanceServer().url + "StructureDefinition/"+baseType.name;
                    $http.get(url1).then(       //and then the profiles on that server
                        function (data) {
                            if (data.data) {

                                $scope.profilesOnBaseType.entry = $scope.profilesOnBaseType.entry || []
                                $scope.profilesOnBaseType.entry.push({resource:data.data});

                            }

                        },
                        function () {
                            //just ignore if we don't fine the base..
                        }
                    ).finally(function () {

                    })

                },
                function(err){
                    console.log(err)
                }
            ).finally(function () {
                $scope.waiting = false;
            });

        },


        makeLogicalModelFromTreeData : function(SD,inTreeData) {
            //so this receives the treeData array that was created by profileCreatorSvc.makeProfileDisplayFromProfile()
            //and we need to convert it into the format used by the logicalmodel builder as they ar enot the same! TODO At some point cold be worth looking at whether they can be made the same...


            var deferred = $q.defer();

            var elementsToIgnore = ['id', 'meta', 'implicitRules', 'language', 'contained'];

            var baseType = SD.snapshot.element[0].path;
            var rootName = 'myResource';
            var vo ={rootName:rootName,baseType:baseType};
            var queries = []

            setHeaderInfo(SD,vo);       //set the herader info

            //adjust the elementDefinitions
            var newElementArray = [];
            SD.snapshot.element.forEach(function (el) {
                var include = true;
                var arPath = el.path.split('.');
                arPath[0] = rootName;
                el.path = arPath.join('.')
                delete el.constraint;       // these are usually just copied from the base resource
                delete el.mapping;          //ditto todo: ?? add the fhir path
                delete el.alias;
                delete el.condition;

                if (elementsToIgnore.indexOf(arPath[arPath.length-1]) !== -1) {
                    include = false;
                }

                if (arPath[arPath.length-1] == 'extension') {

                    include = false;
                    if (el.type) {
                        el.type.forEach(function (typ) {
                            if (typ.profile) {

                                //stu2/3 difference
                                var profile = typ.profile
                                if (angular.isArray(typ.profile)) {
                                    profile = typ.profile[0]
                                }

                                //if there's profile, then we'll pull in the profile definition to update the model.
                                include = true;
                                arPath[arPath.length-1] = el.name;      //todo check exists
                                el.path = arPath.join('.')
                                queries.push(checkExtensionDef(profile, el));
                            }
                        })
                    }
                }

                if (include) {
                    newElementArray.push(el);
                }

            });

            $q.all(queries).then(
                function () {

                    deferred.resolve(SD);
                },
                function (err) {
                    console.log('ERROR: ', err)
                    deferred.reject(SD);
                }
            );


            SD.snapshot.element = newElementArray;



            return deferred.promise;

            function checkExtensionDef(extUrl, el) {
                var deferred = $q.defer();
                var url = appConfigSvc.getCurrentConformanceServer().url + "StructureDefinition?url=" + extUrl;
                GetDataFromServer.adHocFHIRQuery(url).then(
                    function (data) {
                        var bundle = data.data;
                        if (bundle && bundle.entry) {
                            var extensionDef = bundle.entry[0].resource;     //should really only be one...
                            var analysis = Utilities.analyseExtensionDefinition3(extensionDef);

                            if (analysis.name) {
                                var ar = el.path.split('.');
                                ar[ar.length-1] = analysis.name;
                                el.path = ar.join('.')

                            }
                            el.analysis = analysis;
                        }

                        deferred.resolve();
                    },
                    function (err) {
                        deferred.reject();
                    }
                );
                return deferred.promise;
            };



            function setHeaderInfo(sd,vo) {
                //vo {currentuser: rootName: baseType: name:
                //set the header information that makes this a Logical Model rather than a Profile...
                var mappingCommentUrl = appConfigSvc.config().standardExtensionUrl.edMappingComment;
                var mapToModelExtensionUrl = appConfigSvc.config().standardExtensionUrl.mapToModel;
                var baseTypeForModelUrl = appConfigSvc.config().standardExtensionUrl.baseTypeForModel;
                var simpleExtensionUrl = appConfigSvc.config().standardExtensionUrl.simpleExtensionUrl;
                var discriminatorUrl = appConfigSvc.config().standardExtensionUrl.discriminatorUrl;
                var conceptMapUrl = appConfigSvc.config().standardExtensionUrl.conceptMapUrl;

                if (vo.currentUser) {
                    this.addSimpleExtension(sd, appConfigSvc.config().standardExtensionUrl.userEmail, vo.currentUser.email)
                }



                Utilities.addExtensionOnce(sd, baseTypeForModelUrl, {valueString: vo.baseType})



                sd.id = vo.rootName;
                sd.url = appConfigSvc.getCurrentConformanceServer().url + "StructureDefinition/" + sd.id;

                sd.date = moment().format();


                //at the time of writing (Oct 12), the implementaton of stu3 varies wrt 'code' & 'keyword'. Remove this eventually...
                sd.identifier = [{system: "http://clinfhir.com", value: "author"}]
                sd.keyword = [{system: 'http://fhir.hl7.org.nz/NamingSystem/application', code: 'clinfhir'}]

                sd.kind = 'logical';
                sd.abstract = false;
                sd.baseDefinition = "http://hl7.org/fhir/StructureDefinition/Element";
                sd.type = vo.rootName;
                sd.derivation = 'specialization';

            }


        },
        findProfilesOnBase : function(baseType){
            var conformanceServer = appConfigSvc.getCurrentConformanceServer();
            var url = conformanceServer.url;
            if (conformanceServer.version == 2) {
                url += "StructureDefinition?kind=resource&type="+baseType;
            }


           return GetDataFromServer.adHocFHIRQueryFollowingPaging(url);     //this is a promise

        },
        reportOneProfile : function(SD,IG) {
            var result = {required:[],valueSet:{},reference:{}}

            //create a hash of all urls in the IG...
            hashUrl = {}
            IG.package.forEach(function (pkg) {
                pkg.resource.forEach(function (r) {
                    if (r.sourceReference) {
                        hashUrl[r.sourceReference.reference] = r;
                    }
                })
            });



            if (SD.snapshot && SD.snapshot.element) {
                SD.snapshot.element.forEach(function (el) {
                    //look for required elements
                    if (el.min > 0 && el.max !== '0') {
                        result.required.push(el);
                    }

                    //look for ValueSets & references
                    if (el.type) {
                        el.type.forEach(function(typ) {
                            //this is a coded element, add the bound valueset
                            if (['code', 'Coding', 'CodeableConcept'].indexOf(typ.code) > -1){
                                    if (el.binding) {
                                        var item = {strength:el.binding.strength, path:el.path, min:el.min, max:el.max};
                                        var url;
                                        if ( el.binding.valueSetReference) {
                                            item.type='reference';
                                            url = el.binding.valueSetReference.reference;
                                        } else if (el.binding.valueSetUri){
                                            item.type = 'uri'
                                            url = el.binding.valueSetUri;
                                        }
                                        if (url) {
                                           // var included = false;
                                            if (hashUrl[url]) {
                                                    item.included = true;
                                            }

                                            result.valueSet[url] = result.valueSet[url] || []
                                            result.valueSet[url].push(item)



                                        }
                                    }
                                }


                            if (typ.code == 'Reference' && (typ.profile || typ.targetProfile)) {

                                var profile = typ.profile;      //todo - might want to change from Array to string
                                if (typ.targetProfile){
                                    profile = [typ.targetProfile];
                                }

                                var item = {url:profile,path:el.path, min:el.min, max:el.max}
                                result.reference[profile] = result.reference[profile] || []



                                result.reference[profile].push(item);
                            }
                        })
                    }


                })

                //create an array of valueset usages and sort it..
                result.valueSetArray = []
                angular.forEach(result.valueSet,function (v,k) {
                    var item = {url:k,paths:v,included:v.included}

                    v.forEach(function (k) {
                        if (k.included) {
                            item.included = true
                        }
                    })

                    result.valueSetArray.push(item)
                })

                result.valueSetArray.sort(function (a,b) {
                    if (a.url > b.url) {
                        return 1
                    } else {
                        return -1;
                    }
                })




                //do the same with references
                result.referenceArray = []
                angular.forEach(result.reference,function (v,k) {
                    var item = {url:k,paths:v}




                    result.referenceArray.push(item)
                })

                result.referenceArray.sort(function (a,b) {
                    if (a.url > b.url) {
                        return 1
                    } else {
                        return -1;
                    }
                })

            }

            return result;



        },
        makeCanonicalObj : function(SD,svr) {
            //svr is the current server (may not be the same as the one in appConfig - eg for the comparison view...
            var deferred = $q.defer();
            var queries = [];   //retrieve extension definitions
            //var quest = {resourceType:'Questionnaire',status:'draft',item:[]}   //questionnaire for form

            if (SD && SD.snapshot && SD.snapshot.element) {
                var hashPath = {}
                var newSD = {snapshot: {element:[]}}        //a new SD that removes the excluded elements (max=0)
                var canonical = {item:[]}      //the canonical object...
                var excludeRoots = []           //roots which have been excluded...

                var topLineLevel = 1;           //the point at which a top level line should be drawn
                var topLineRoot = "";

                SD.snapshot.element.forEach(function(ed){
                    var include = true;
                    var path = ed.path;

                    if (path.indexOf(topLineRoot) == -1) {
                        topLineLevel = 1;
                    }


                    var arPath = path.split('.');

                    if (arPath.length > 1) {
                        arPath = arPath.splice(1)
                    }

                    if (['id','meta','language','text','implicitRules','contained'].indexOf(arPath[0]) > -1) {
                        include = false;
                    }
                    if (arPath.length > 1 && arPath[arPath.length - 1] == 'id') {
                        include = false;
                    }


                    var item = {path:arPath.join('.')};


                    //set a top line in the display
                    if (arPath.length == topLineLevel) {
                        item.groupParent = true;
                    }


                    item.originalPath = path;
                    item.ed = ed;
                    item.min = ed.min;
                    item.max = ed.max;
                    item.multiplicity = ed.min + ".."+ed.max;
                    item.type = ed.type;
                    item.difference = {};       //a # of differences - set during the analysis phase...
                    item.isModifier = ed.isModifier;

                    //work out the help display...
                    item.display = ed.definition || ed.short;       //definition in preference to short...
                    if (ed.comments && ed.comments.indexOf('stigma') == -1 && ed.comments.indexOf('/[type]/[id]') == -1) {
                        //don't include 'standard' comments
                        item.display += ed.comments;
                    }

                    if (ed.slicing) {
                        item.slicing = ed.slicing;
                    }

                    //look for any fixed items
                    angular.forEach(ed,function (v,k) {
                        if (k.substr(0,5) == 'fixed') {
                            item.fixed = item.fixed || []
                            item.fixed.push({v:v,k:k})

                        }
                    })




                    //if multiplicity is 0, then add to the exclude roots
                    if (item.max == 0) {
                        include = false;
                        excludeRoots.push(path)
                    }

                    //if this path starts with any of the exclude roots, then don't include...
                    excludeRoots.forEach(function(root){
                        if (path.substr(0,root.length) == root) {
                            include = false;
                        }
                    });

                    //special processing for coded elements
                    if (item.type) {
                        item.type.forEach(function(typ) {

                            //set a top line in the display
                            if (typ.code == 'BackboneElement') {
                                item.groupParent = true;
                                topLineLevel = 2;       //todo - this might need to be reactive
                                topLineRoot = path;
                            }

                            //this is a coded element, add the bound valueset
                            if (['code', 'Coding', 'CodeableConcept'].indexOf(typ.code) > -1){
                                if (ed.binding) {
                                    item.coded = {strength:ed.binding.strength}
                                    if ( ed.binding.valueSetReference) {
                                        item.coded.valueSetReference = ed.binding.valueSetReference.reference;
                                    }
                                    item.coded.valueSetUri = ed.binding.valueSetUri;
                                }
                            }
                        }
                    )}

                    //special processing for extensions...
                    if (arPath[arPath.length-1].indexOf('extension') > -1 || arPath[arPath.length-1] == 'modifierExtension') {
                        include = false;
                        //item.extension = {name:ed.name}
                        item.extension = {}
                        if (item.type) {
                            item.type.forEach(function(typ) {
                                if (typ.profile) {
                                    include = true;
                                    if (angular.isArray(typ.profile)) {
                                        item.extension.url = typ.profile[0]
                                    } else {
                                        item.extension.url = typ.profile
                                    }
                                    item.originalPath += '_'+item.extension.url;    //to make it unique
                                    queries.push(resolveExtensionDefinition(item,svr))
                                }
                            })
                        }

                        //see if we can make a nicer display...
                        var display = ed.name;
                        if (! display) {
                            var display =  $filter('referenceType')(item.extension.url);
                        }
                        if (display) {
                            item.path = display;// + " (ext)";    //to make a nicer display...
                        }

                    }
                    if (include) {
                        canonical.item.push(item)

                        //check for a duplicate path
                        var p = ed.path;
                        if (hashPath[p]) {
                            hashPath[p] ++;
                            ed.path = ed.path + '_'+hashPath[p];

                        } else {
                            hashPath[p] = 1;
                        }
                        newSD.snapshot.element.push(ed);
                    }
                });

                if (queries.length) {
                    $q.all(queries).then(
                        function () {
                            //process all extension analyses. Do this after all the extensions have loaded as we'll be inserting entries for complex extensions
                            var extensions = []
                            for (var i=0; i < canonical.item.length; i++) {
                                var item = canonical.item[i];
                                if (item.extension && item.extension.analysis) {

                                    var analysis = item.extension.analysis;
                                    if (analysis.isComplexExtension) {

                                    } else {
                                        //
                                        item.type = angular.copy(analysis.dataTypes);
                                    }
                                    var extension = angular.copy(item)
                                    var ar = extension.originalPath.split('_')
                                    extension.extensionPath = ar[0];
                                    delete extension.groupParent;

                                    extensions.push(extension);

                                }
                            }

                            deferred.resolve({canonical:canonical, SD : newSD,extensions:extensions});
                        },
                        function (err) {

                            alert("error getting SD's for children " + angular.toJson(err))
                            // return with what we have...
                            deferred.resolve({canonical:canonical, SD : newSD});

                        }
                    )
                } else {
                    deferred.resolve({canonical:canonical, SD : newSD});
                }


            } else {
                deferred.reject()
            }

            return deferred.promise

            function resolveExtensionDefinition(item,svr) {

                var deferred = $q.defer();
                var url = item.extension.url;

                if ($localStorage.extensionDefinitionCache[url]) {
                    //note that this is an async call - some duplicate calls are inevitible
                    item.extension.analysis = angular.copy(Utilities.analyseExtensionDefinition3($localStorage.extensionDefinitionCache[url]));
                    deferred.resolve()
                } else {

                    //if a server was passed in then use that, otherwise use the default one...
                    var serverUrl = appConfigSvc.getCurrentConformanceServer().url;
                    if (svr) {
                        serverUrl = svr.url;
                    }
                    GetDataFromServer.findConformanceResourceByUri(url,serverUrl).then(
                        function (sdef) {

                            //delete sdef.text;       //large text

                            $localStorage.extensionDefinitionCache[url] = minimizeSD(sdef)



                            item.extension.analysis = angular.copy(Utilities.analyseExtensionDefinition3(sdef));

                            deferred.resolve()
                        },function (err) {
                            console.log(err)
                            deferred.resolve()
                        }
                    )
                }
                return deferred.promise;
            }
        },
        getTerminologyResource : function(url,resourceType) {
            //todo - there's an overlap with 'getSD' - maybe. To be investigated - especially getting 'standard' resources..
            var deferred = $q.defer();
            if ($localStorage.extensionDefinitionCache[url]) {
                //note that this is an async call - some duplicate calls are inevitable

                deferred.resolve($localStorage.extensionDefinitionCache[url]);
            } else {
                // This assumes that the terminology resources are all on the terminology service...
                var serverUrl = appConfigSvc.getCurrentTerminologyServer().url;
                GetDataFromServer.findConformanceResourceByUri(url,serverUrl,resourceType).then(
                    function (sdef) {

                        $localStorage.extensionDefinitionCache[url] = minimizeSD(sdef)
                        deferred.resolve($localStorage.extensionDefinitionCache[url]);
                    },function (err) {
                        console.log(err)
                        deferred.reject();
                    }
                )
            }
            return deferred.promise;
        },
        clearSDProfile : function(url) {
            delete $localStorage.extensionDefinitionCache[url];
        },
        getSD : function(url) {



            var deferred = $q.defer();
            if ($localStorage.extensionDefinitionCache[url]) {
                //note that this is an async call - some duplicate calls are inevitible
                deferred.resolve($localStorage.extensionDefinitionCache[url]);
            } else {

                //is this a 'core' extension?
                if (url.indexOf('http://hl7.org/fhir/StructureDefinition') > -1) {
                    //yep. can get it directly. THis seems to be the naming algorithm...
                    var url1 = url.replace('StructureDefinition/','extension-');

                    $http.get(url1  +'.json').then(
                        function(data) {
                            var sdef = data.data;
                            delete sdef.text;   //text can be v large in some profiles

                            $localStorage.extensionDefinitionCache[url] = minimizeSD(sdef);

                            deferred.resolve($localStorage.extensionDefinitionCache[url]);
                        },
                        function (err) {
                            deferred.reject(err);
                        }
                    )


                } else {
                    //is this an absolute reference?
                    if (url.indexOf('http') == -1) {
                        //no - it's relative - we assume to the conformance server
                        url = appConfigSvc.getCurrentConformanceServer().url+url;
                    }
                    GetDataFromServer.findConformanceResourceByUri(url).then(
                        function (sdef) {
                            console.log(url)
console.log(sdef)
                            delete sdef.text;   //text can be v large in some profiles

                            $localStorage.extensionDefinitionCache[url] = minimizeSD(sdef)

                            deferred.resolve($localStorage.extensionDefinitionCache[url]);
                        },function (err) {
                            console.log(err.msg)
                            deferred.reject(err);
                        }
                    )
                }





            }
            return deferred.promise;
        },
        analyseDiff : function(primary,secondary) {
            //pass in the canonical model (NOT the SD or ED)
            //var analysis = {};
            if (!primary || !secondary) {
                return;
            }

            secondary.report = {fixed:[],missing:[],valueSet:[]};

            var primaryHash = {};
            primary.item.forEach(function(item){
                var path = item.originalPath;   //extensions will be made unique
                primaryHash[path]= item
            });


            secondary.item.forEach(function (item) {



                //may want to check the primary...
                if (item.fixed) {


                    secondary.report.fixed.push({item:item,fixed:item.fixed})

                    item.difference.fixed = item.fixed;
                }

                if (!primaryHash[item.originalPath] ) {
                    //this is a new path in the secondary. Either an extension, or is core, but not in the primary...
                    //analysis.notInPrimary.push(item)
                    var reportItem = {path:item.path,min:item.min}
                    if (item.extension) {
                        reportItem.extension = item.extension.url
                    }


                    if (item.min !== 0) {
                        item.difference.brk = true;         //breaking change
                       // reportItem.
                    } else {
                        item.difference.nip = true;         //not in primary
                    }
                    secondary.report.missing.push(reportItem);

                } else {
                    var primaryItem = primaryHash[item.originalPath];
                    //the path is in both, has it changed? First the multiplicity
                    if (primaryItem.multiplicity !== item.multiplicity ){
                        item.difference.mc = true;         //multiplicity changed
                    }

                    if (item.coded) {
                        //the secondary is coded
                        if (! primaryItem.coded) {

                            item.difference.vsd = true;     //the primary is not!
                        } else {
                            var vsItem = {}
                            if (item.coded.valueSetReference) {
                                if (primaryItem.coded.valueSetReference !== item.coded.valueSetReference) {
                                    item.difference.vsd = true;
                                    vsItem = {path:item.path,different:true,vsReference:item.coded.valueSetReference}
                                } else {
                                    vsItem = {path:item.path,different:false,vsReference:item.coded.valueSetReference}
                                }
                            }

                            if (item.coded.valueSetUri) {
                                if (item.coded.valueSetUri !== primaryItem.coded.valueSetUri) {
                                    item.difference.vsd = true;
                                    vsItem = {path:item.path,different:true,vsUri:item.coded.valueSetUri}
                                } else {
                                    vsItem = {path:item.path,different:false,vsUri:item.coded.valueSetUri}
                                }
                            }

                            secondary.report.valueSet.push(vsItem);

                        }

                    }

                }

                })




        }
    }

    });
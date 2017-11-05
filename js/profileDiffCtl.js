
angular.module("sampleApp")
    .controller('profileDiffCtrl',
        function ($scope,$q,$http,profileDiffSvc,$uibModal,logicalModelSvc,appConfigSvc,RenderProfileSvc,builderSvc,
                  Utilities,GetDataFromServer,profileCreatorSvc,$filter,$firebaseObject,$location,$window,modalService,
                    $timeout,SaveDataToServer,$sce) {

            $scope.input = {center:true,includeCore:true,immediateChildren:true,includeExtensions:true,includePatient:true};
            $scope.appConfigSvc = appConfigSvc;
            $scope.itemColours = profileDiffSvc.objectColours();

            var fhirVersion = appConfigSvc.getCurrentConformanceServer().version;

            $scope.history = [];        //
            $scope.input.tabShowing='single';
            $scope.input.categories = ['profile','extension','terminology'];

            GetDataFromServer.registerAccess('igView');

            $scope.saveIG = function(){

                SaveDataToServer.saveResource($scope.currentIG).then(
                    function (data) {
                        alert('IG updated');
                        delete $scope.input.IGSummaryDirty;
                    },function(err){
                        alert('Error updating IG '+ angular.toJson(err,true))
                    }
                )
            };

            $scope.editResourceItem = function(item) {




                var igResource = profileDiffSvc.findItem(item.url,$scope.currentIG)



                $uibModal.open({
                    templateUrl: 'modalTemplates/editIGResource.html',

                    backdrop: 'static',
                    controller: function($scope,igResource){
                        $scope.description = igResource.description;
                        $scope.save = function(){
                            var vo = {description: $scope.description}
                            $scope.$close(vo);
                        }
                    },
                    resolve : {
                        igResource : function () {
                            return igResource;
                        }
                    }

                }).result.then(function(vo){
                    igResource.description = vo.description;    //the underlying item
                    item.description = vo.description;      //the display item
                    $scope.saveIG()
                    $scope.selectItem(item,'example')
                });



            };

            $scope.deleteResourceItem = function(item) {
                var modalOptions = {
                    closeButtonText: "No, I've changed my mind",
                    actionButtonText: 'Yes, please remove it',
                    headerText: 'Remove Item',
                    bodyText: 'Are you sure you wish to remove this item'
                };


                modalService.showModal({}, modalOptions).then(
                    function(){
                        profileDiffSvc.deleteItem(item.url,$scope.currentIG)
                        $scope.saveIG()
                        $scope.selectIG($scope.currentIG);
                    }
                )



            };

            $scope.uploadExample = function(item) {


                $uibModal.open({
                    templateUrl: 'modalTemplates/upLoad.html',
                    size:'lg',
                    backdrop: 'static',
                    controller: 'uploadCtrl',
                    resolve : {
                        resource : function () {
                            return '';
                        }
                    }

                }).result.then(function(vo){
                    var url = vo.url;       //the resource where the resource was saved

                    //now create an entry for this example in the IG...


                    //get a reference to the first package...
                    var pkg = $scope.currentIG.package[0];  //just stuff everything into the first package for the moment...
                    pkg.resource = pkg.resource || []
                    //add the profile to the IG - then find any extensions and add them as well. todo - should we check whether they exist first?

                    var res = {sourceReference:{reference:url}};
                    res.description = vo.description;

                    var resourceTypeUrl = appConfigSvc.config().standardExtensionUrl.resourceTypeUrl;
                    Utilities.addExtensionOnce(res,resourceTypeUrl,{valueString:vo.type});

                    if (fhirVersion ==2) {
                        res.purpose = 'example'
                    } else {
                        res.example=true;
                    }
                    pkg.resource.push(res);

                    $scope.saveIG()
                    $scope.selectIG($scope.currentIG);

                });


            };

            //download a single item (profile or extension)
            $scope.downLoadItem = function(ev,item,notes) {
                ev.stopPropagation();

                profileDiffSvc.getSD(item.url).then(
                    function (SD) {
                        displayDownLoadDlg(SD)
                    },function(err){
                        alert('Error getting SD: '+angular.toJson(err))
                    });

            };

            function displayDownLoadDlg(resource,notes,fileName) {

                $uibModal.open({
                    templateUrl: 'modalTemplates/downLoad.html',
                    size:'lg',
                    controller: function($scope,resource,notes,fileName) {
                        $scope.notes = notes;
                        $scope.resource = resource;
                        $scope.downloadLinkJsonContent = window.URL.createObjectURL(new Blob([angular.toJson(resource, true)],
                            {type: "text/text"}));
                        $scope.downloadLinkJsonName = fileName;
                        $scope.downloadLinkJsonName = $scope.downloadLinkJsonName || resource.url;

                        $scope.downloadClicked = function(){
                            $scope.$close();
                        }

                    },
                    resolve : {
                        resource : function () {
                            return resource;
                        },
                        notes : function () {
                            return notes;
                        },
                        fileName : function () {
                            return fileName;
                        }
                    }

                })
            }

            // ===================  page links ===============
            $scope.page = {}
            $scope.pageDirty = false;       //true if changes have been made...
            function drawPageTree() {
                $('#pagesTreeView').jstree('destroy');
                $('#pagesTreeView').jstree(
                    {'core': {'multiple': false, 'data': $scope.pageTreeData, 'themes': {name: 'proton', responsive: true}}}
                ).on('changed.jstree', function (e, data) {

                    if (data.node) {
                        $scope.selectedPageNode = data.node;


                        var url = $scope.selectedPageNode.data.source
                        $scope.page.src = $sce.trustAsResourceUrl('about:blank');
                        $scope.page.src = $sce.trustAsResourceUrl(url);

                    }


                    $scope.$digest();       //as the event occurred outside of angular...

                }).on('redraw.jstree',function(e,data){

                })
            }


            //update the IG on the server..
            $scope.savePages = function(){

                var pageRoot = {page:[]}
                var tree = $('#pagesTreeView').jstree().get_json('#');
                var topNode = tree[0];

                getChildren(pageRoot,topNode);



                $scope.currentIG.page = pageRoot.page[0];// pageRoot.page;

                //return;

                SaveDataToServer.saveResource($scope.currentIG).then(
                    function (data) {

                        $scope.pageDirty = false;
                        alert("Implementation Guide has been updated.")
                    }, function (err) {
                        alert('Error updating IG '+angular.toJson(err))
                    }
                );

                function getChildren(parentPage,node) {
                    var page = node.data;     //this is a child page off the parent

                    if (page) {
                        parentPage.page = parentPage.page || []
                        parentPage.page.push(page)
                    }

                    if (node.children && node.children.length > 0) {
                        for (var i = 0; i < node.children.length; i++) {
                            var node1 = node.children[i];
                             getChildren(page,node1)
                        }
                    }

                }
            };


            //function to set the title or name properties depending on fhir version
            function setTitle(page,text) {
                if (fhirVersion == 2) {
                    page.name = text
                } else {
                    page.title = text;
                }
            }

            $scope.move = function(node,dirn) {
                var id = node.id;       //node to move
                var parentId = node.parent;
                //find all the nodes with the same parent
                var ar = [];
                var posOfNode = -1
                $scope.pageTreeData.forEach(function (node,inx) {
                    if (node.parent == parentId) {
                        ar.push({inx:inx,id:node.id})        //a sibling
                    }
                    if (node.id == id) {posOfNode = inx}

                })

                var posInArray = -1
                if (ar.length < 2  ) {return;}
                ar.forEach(function (el,inx) {
                    if (el.id == id) {posInArray = inx}
                })


                if (dirn == 'dn') {
                    if (posInArray == -1) {return;}
                    var item = $scope.pageTreeData[posOfNode];
                    $scope.pageTreeData.splice(posOfNode,1);
                    var insertPoint = ar[posInArray+1].inx
                    $scope.pageTreeData.splice(insertPoint,0,item)
                } else {
                    if (posInArray == ar.length) {return;}
                    var item = $scope.pageTreeData[posOfNode];
                    $scope.pageTreeData.splice(posOfNode,1);
                    var insertPoint = ar[posInArray-1].inx
                    $scope.pageTreeData.splice(insertPoint,0,item)
                }

                drawPageTree()
                $scope.pageDirty = true;

            }

            $scope.deletePage = function(node) {
                var id = node.id;

                var inx = -1;
                var hasChildren = false;
                for (var i=0; i<$scope.pageTreeData.length;i++) {
                    var item = $scope.pageTreeData[i];
                    if (item.id == id) {
                        inx = i;
                    } else if (item.parent == id) {
                        hasChildren = true;
                    }
                }

                if (hasChildren) {
                    alert("Cannot remove nodes with children")
                } else if (inx > -1) {
                    $scope.pageTreeData.splice(inx,1);
                    drawPageTree()
                    $scope.pageDirty = true;
                }
            };

            $scope.addPage = function(node){

                $uibModal.open({
                    templateUrl: 'modalTemplates/addPage.html',
                    controller: function($scope,inputNode) {
                        $scope.input = {}

                        if (inputNode) {
                            //this is edit
                            $scope.edit = true;
                            $scope.input.link = inputNode.data.source;
                            $scope.input.title = inputNode.data.title || inputNode.data.name;

                        }

                        $scope.add = function(){
                            var vo = {link:$scope.input.link,title:$scope.input.title};
                            vo.inputNode = inputNode;
                            $scope.$close(vo)
                        }
                    },
                    resolve : {
                        inputNode: function () {          //the default config
                            return node;
                        }
                    }

                }).result.then(
                    function(vo) {
                        $scope.pageDirty = true;
                        if (vo.inputNode) {
                            //edit...

                            //create a new node...
                            var page = vo.inputNode.data;
                            page.source = vo.link;
                            setTitle(page,vo.title);
                            var id = 't' + new Date().getTime();
                            var newNode = {id:id,parent:$scope.selectedPageNode.parent,text:vo.title,state: {opened: true}}
                            newNode.data = page;
                            //$scope.pageTreeData.push(node)

                            //delete the previous...


                            var inx = -1;
                            for (var i=0; i<$scope.pageTreeData.length;i++) {
                                var item = $scope.pageTreeData[i];

                                if (item.id == vo.inputNode.id) {
                                    inx = i;
                                } else if (item.parent == vo.inputNode.id) {
                                    item.parent = id;
                                }
                            }

                            if (inx > -1) {
                                $scope.pageTreeData.splice(inx,1,newNode);

                            } else {
                                $scope.pageTreeData.push(newNode)
                            }

                        } else {
                            //add...
                            var page = {source:vo.link,kind:'page'};
                            setTitle(page,vo.title);
                            page.page = [];
                            var id = 't' + new Date().getTime();// + Math.random()*1000
                            var title = page.title || page.name;    //R3/STU2

                            var parentId = '#'
                            if ($scope.selectedPageNode) {
                                parentId = $scope.selectedPageNode.id;
                            }

                            var node = {id:id,parent:parentId,text:title,state: {opened: true}}
                            node.data = page;
                            $scope.pageTreeData.push(node)
                        }
                        drawPageTree()

                })

            };

            //see if this page was loaded from a shortcut
            var hash = $location.hash();
            if (hash) {
                var sc = $firebaseObject(firebase.database().ref().child("shortCut").child(hash));
                sc.$loaded().then(
                    function(){


                        $scope.loadedFromBookmark = true;

                        //set the conformance server to the one in the bookmark
                        var conformanceServer =  sc.config.conformanceServer;
                        appConfigSvc.setServerType('conformance',conformanceServer.url);
                        appConfigSvc.setServerType('terminology',sc.config.terminologyServer.url);

                        var id = sc.config.IG.id;    //the id of the model on this server
                        //get the model from the server...
                        var url = conformanceServer.url + 'ImplementationGuide/'+id;
                        $scope.showWaiting = true;
                        GetDataFromServer.adHocFHIRQuery(url).then(
                            function(data){
                                var IG = data.data;

                                $scope.selectIG(IG);
                            },
                            function(){
                                modalService.showModal({}, {bodyText: "The IG with the id '"+id + "' is not on the "+conformanceServer.name + " server"})
                            }
                        ).finally(function(){
                            $scope.showWaiting = false;
                        })

                    }
                )
            }

            $scope.clearCache = function(){
                profileDiffSvc.clearCache();
            };

            $scope.createDownload = function(){
                var fileName = $scope.currentIG.name;
                profileDiffSvc.createDownloadBundle($scope.currentIG).then(
                    function(bundle) {


                        displayDownLoadDlg(bundle,['Only Profiles and Extension Definitions included'],fileName)

                    },function(bundle) {

                        displayDownLoadDlg(bundle,['Only Profiles and Extension Definitions included'],fileName)


                    }
                );
            };

            function setDownloadLinkDEP(bundle,downLoadName) {
                $scope.downloadLinkJsonContent = window.URL.createObjectURL(new Blob([angular.toJson(bundle, true)], {type: "text/text"}));
                $scope.downloadLinkJsonName = downLoadName;
            }

            $scope.importItem = function(itemType){



                var url = $window.prompt('Enter the Url of the '+itemType.display);
                if (url) {
                    profileDiffSvc.getSD(url).then(
                        function (SD) {


                            //get a reference to the package...
                            var pkg = $scope.currentIG.package[0];  //just stuff everything into the first package for the moment...
                            pkg.resource = pkg.resource || []

                            var res = profileDiffSvc.findResourceInIGPackage($scope.currentIG,SD.url);
                            if (res) {
                                profileDiffSvc.clearSDProfile(SD.url);
                                modalService.showModal({}, {
                                    bodyText: "There is already an entry for this profile in the Guide. I've cleared it from the cache but you need to re-load the app for the new profile to be displayed."})
                               // return
                            } else {
                                //add the profile to the IG - then find any extensions and add them as well. todo - should we check whether they exist first?

                                var res = {sourceReference:{reference:url}};
                                //todo - should likely move to an extension for R3
                                if (appConfigSvc.getCurrentConformanceServer().version ==2) {
                                    res.purpose = itemType.type
                                } else {
                                    res.acronym = itemType.type
                                }
                                pkg.resource.push(res);
                            }



                            //now look for any extensions or ValueSets if the object being imported is a profile....
                            if (itemType.type == "profile" && SD.snapshot && SD.snapshot.element) {

                                profileDiffSvc.updateExtensionsAndVSInProfile($scope.currentIG,SD,pkg);


                            }


                            $scope.dirty = true;


                            //var IGUrl = appConfigSvc.getCurrentConformanceServer().url + "/ImplementationGuide/"+$scope.currentIG.id;

                            SaveDataToServer.saveResource($scope.currentIG).then(
                                function (data) {

                                }, function (err) {
                                   alert('Error updating IG '+angular.toJson(err))
                                }
                            );

                            $scope.selectIG($scope.currentIG);

                        },function (err) {
                            alert("Sorry, can't find a "+itemType.display+" with that Url...")
                        }
                    )


                    //alert(url)
                }

            };

            $scope.generateShortCut = function() {
                var hash = Utilities.generateHash();
                var shortCut = $window.location.href+"#"+hash;

                var sc = $firebaseObject(firebase.database().ref().child("shortCut").child(hash));
                sc.modelId = $scope.currentIG.id;     //this should make it possible to query below...
                sc.config = {conformanceServer:appConfigSvc.getCurrentConformanceServer()};
                sc.config.terminologyServer = appConfigSvc.getCurrentTerminologyServer();
                sc.config.IG = {id:$scope.currentIG.id};
                sc.shortCut = shortCut;     //the full shortcut
                sc.$save().then(
                    function(){
                        modalService.showModal({}, {bodyText: "The shortcut  " +  shortCut + "  has been generated for this IG"})
                    }
                )
            };

            //select an extension from within a profile...
            $scope.selectExtensionFromProfile = function (itemExtension) {
                profileDiffSvc.getSD(itemExtension.url).then(
                    function (SD) {
                        $scope.showExtension(SD);
                    }
                )
            };

            $scope.showExtensionFromUrl = function(url){
                profileDiffSvc.getSD(url).then(
                    function(SD){
                        $scope.showExtension(SD)
                    },
                    function(err) {
                        alert(err.msg)
                    }
                )
            };

            $scope.showExtension = function(SD){
                $uibModal.open({
                    templateUrl: 'modalTemplates/showExtension.html',
                    size: 'lg',
                    controller: function($scope,ext,Utilities) {
                        $scope.extensionAnalysis = Utilities.analyseExtensionDefinition3(ext)
                    },
                    resolve : {
                        ext: function () {          //the default config
                            return SD;
                        }
                    }

                })

            };

            //load a profile into the given side ('left','right')
            $scope.loadCompProfiles = function(side) {
                var svr = $scope.input['compareServer'+side];
                var type = $scope.input.compareResourceType;

                if (svr && type) {
                    //load the matching profiles...

                    var searchString = svr.url + "StructureDefinition?";

                    if (svr.version == 3) {
                        searchString += "kind=resource&base=http://hl7.org/fhir/StructureDefinition/"+type.name
                    } else {
                        //var base = "http://hl7.org/fhir/StructureDefinition/DomainResource";
                        searchString += "kind=resource&type="+type.name;
                    }


                    $scope.waiting = true;

                    $http.get(searchString).then(       //first the profiles on that server ...
                        function(data) {
                            $scope.input['matchingProfiles'+side] = data.data;  //a bundle



                            //get the base type (if it exists)...
                            var url1 =  svr.url + "StructureDefinition/"+type.name;
                            $http.get(url1).then(       //and then get the base type
                                function (data) {
                                    if (data.data) {
                                        if (data.data) {
                                            $scope.input['matchingProfiles'+side].entry = $scope.input['matchingProfiles'+side].entry || []
                                            $scope.input['matchingProfiles'+side].entry.push({resource:data.data})
                                        }


                                    }

                                },
                                function () {
                                    //just ignore if we don't fine the base..
                                }
                            )




                        },
                    function (err) {
                        console.log(err)
                    }).finally(function () {
                        $scope.waiting = false;
                    });
                }


            };

            //select a single profile to display as a table...
            $scope.selectCompProfile = function(entry,side) {

                var canonicalName = 'canonical'+side;
                var profilesBdl = $scope.input['matchingProfiles'+side];
                if (profilesBdl && profilesBdl.entry) {
                    profilesBdl.entry.forEach(function (p) {
                        if (p.resource.url == entry.resource.url) {

                            setCanonical(p.resource,canonicalName)

                            profileDiffSvc.analyseDiff($scope.canonicalLeft,$scope.canonicalRight)

                        }

                    })
                }


                function setCanonical(SD,canonicalName) {
                    profileDiffSvc.makeCanonicalObj(SD).then(
                        function (vo) {

                            $scope[canonicalName] = vo.canonical;

                        },function (err) {
                            console.log(err)
                        }
                    )
                }
            };


            function addToHistory(type,resource) {
                $scope.history.push({type:type,resource:resource})

            }

            function popHistoryDEP() {
                if (history.length > 0) {
                    var hx = history.pop();
                    switch (hx.type) {
                        case 'profile' :

                            break;
                    }
                }
            }

            function clearRightPane(){
                //delete $scope.currentIG;
                delete $scope.selectedElementInLM;
                delete $scope.selectedItemType ;
                delete $scope.selectedItem;
                delete $scope.profileReport;
                delete $scope.allExtensions;
                delete $scope.selectedNode;
                delete $scope.input.IGSummaryDirty;
            }

            //used when selecting a single profile...
            RenderProfileSvc.getAllStandardResourceTypes().then(
                function(lst) {
                    $scope.allResourceTypes = lst
                }
            );
            
            $scope.findAdHocProfile = function (baseType) {
                var svr =  appConfigSvc.getCurrentConformanceServer();
                var searchString = appConfigSvc.getCurrentConformanceServer().url + "StructureDefinition?";



                if (svr.version == 3) {
                    searchString += "kind=resource&base=http://hl7.org/fhir/StructureDefinition/"+baseType.name
                } else {
                    //var base = "http://hl7.org/fhir/StructureDefinition/DomainResource";
                    searchString += "kind=resource&type="+baseType.name;
                }


                $scope.waiting = true;

                $http.get(searchString).then(       //first the profiles on that server ...
                    function(data) {
                        $scope.profilesOnBaseType = data.data;

                        var url1 =  appConfigSvc.getCurrentConformanceServer().url + "StructureDefinition/"+baseType.name;
                        $http.get(url1).then(       //and then get the base type
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

            }

            $scope.selectAdHocProfile = function(SD) {


                setupProfile(SD)
                $scope.selectedItemType = 'profile';
                $scope.currentIG = {};      //to show the tabset
            };
            
            //load the IG's that describe 'collections' of conformance artifacts - like CareConnect & Argonaut

            var url = appConfigSvc.getCurrentConformanceServer().url + "ImplementationGuide";
            GetDataFromServer.adHocFHIRQueryFollowingPaging(url).then(
                function(data) {
                    $scope.listOfIG = []
                    if (data.data && data.data.entry) {
                        data.data.entry.forEach(function (entry) {
                            var ig = entry.resource;


                            if (Utilities.isAuthoredByClinFhir(ig)) {
                                ig.name = ig.name || ig.description;
                                $scope.listOfIG.push(ig)
                            }
                        })
                    }
                    $scope.input.selIG = $scope.listOfIG[0]
                },
                function(err){
                    console.log(err)
                }
            );


            //note that we're using an IG to hold all the resources in this collection
            $scope.selectIG = function(IG){
                var extDef = appConfigSvc.config().standardExtensionUrl.resourceTypeUrl;
                clearRightPane();
                $scope.currentIG=IG;     //the List the holds this collection

                //now pull out the various artifacts into an easy to use object
                $scope.artifacts = {}
                $scope.currentIG.package.forEach(function (package) {
                    package.resource.forEach(function (resource) {
                        var purpose = resource.purpose || resource.acronym;     //<<< todo - 'purpose' was removed in R3...
                        var type;
                        if (resource.example || resource.purpose == 'example') {         //another R2/3 difference...
                            purpose = 'example'
                            var t = Utilities.getSingleExtensionValue(resource,extDef);
                            if (t) {
                                type = t.valueString;
                            }
                        }

                        $scope.artifacts[purpose] = $scope.artifacts[purpose] || []

                        var item2 = {description:resource.description,type:type}

                        if (resource.sourceReference) {
                            item2.url = resource.sourceReference.reference;
                        }

                        if (resource.sourceUri) {
                            item2.url = resource.sourceUri;
                            item2.uri = resource.sourceUri;     //for OID type references...
                        }

                        $scope.artifacts[purpose].push(item2)
                    })
                });

                //sort 'em all...
                ['extension','profile','terminology','logical','other','example'].forEach(function (purpose) {
                    if ($scope.artifacts[purpose]) {
                        $scope.artifacts[purpose].sort(function(item1,item2) {
                            var typ1 =  $filter('getLogicalID')(item1.url);
                            var typ2 =  $filter('getLogicalID')(item2.url);
                            if (typ1 > typ2) {
                                return 1
                            } else {
                                return -1
                            }
                        })
                    }

                })

                $scope.pageTreeData = profileDiffSvc.generatePageTree($scope.currentIG);
                drawPageTree();

            };

            //-------- functions and properties to enable the valueset viewer
            $scope.showVSBrowserDialog = {};
            $scope.showVSBrowser = function(vs) {
                $scope.showVSBrowserDialog.open(vs);        //the open method defined in the directive...
            };

            $scope.showValueSet = function(uri,type) {


                //treat the reference as lookup in the repo...
                GetDataFromServer.getValueSet(uri).then(
                    function(vs) {

                        $scope.showVSBrowserDialog.open(vs);

                    }, function(err) {
                        alert(err)
                    }
                ).finally (function(){
                    $scope.showWaiting = false;
                });
            };



            //when an item is selected in the accordian for display in the right pane...
            $scope.selectItem = function(item,type){

                clearRightPane()

                $scope.selectedItemType = type;
                $scope.selectedItem = item;

                delete $scope.exampleResource
                delete $scope.exampleResourceXml



                centerNodeInGraph(item.url)

                //right now we assume that examples are on the data server...
                if (type == 'example') {
                    $scope.getExample(item)
                }

                if (type == 'logical') {
                    delete $scope.LMSD
                    profileDiffSvc.getSD(item.url).then(
                        function (SD) {
                            $scope.LMtreeData = logicalModelSvc.createTreeArrayFromSD(angular.copy(SD));



                            $scope.LMSD = SD;
                            logicalModelSvc.resetTreeState($scope.LMtreeData);

                            //expand all backbone nodes
                            $scope.LMtreeData.forEach(function (item) {

                                if (item.data && item.data.ed && item.data.ed.type) {
                                    item.data.ed.type.forEach(function (typ) {
                                        if (typ.code == 'BackboneElement') {
                                            item.state.opened = true;

                                        }
                                    })
                                }
                            })



                            $scope.LMtreeData[0].state.opened = true;

                            $('#lmTreeView').jstree('destroy');
                            $('#lmTreeView').jstree(
                                {'core': {'multiple': false, 'data': $scope.LMtreeData, 'themes': {name: 'proton', responsive: true}}}
                            ).on('changed.jstree', function (e, data) {
                                //seems to be the node selection event...

                                if (data.node) {
                                    $scope.selectedNode = data.node;

                                }

                                $scope.$digest();       //as the event occurred outside of angular...

                            })



                        }
                    )




                }

                if (type == 'terminology') {
                    delete $scope.valueSetOptions;
                   //really only works for ValueSet and CodeSystemat this point...
                    var tType = 'ValueSet';
                    if (item.url.indexOf('/CodeSystem/') > -1) {
                        tType = 'CodeSystem';
                    }

                    var urlToGet = item.url;
                    if (item.uri) {
                        urlToGet = item.uri;
                        tType = 'CodeSystem';   //todo hack for UScore
                    }





                   profileDiffSvc.getTerminologyResource(urlToGet,tType).then(
                       function (vs) {
                           $scope.selectedTerminology = vs;



                           if (tType == 'ValueSet') {
                               var vo = {selectedValueSet : {vs: {url: vs.url}}}

                               logicalModelSvc.getOptionsFromValueSet(vo).then(
                                   function(lst) {



                                       if (lst) {
                                           lst.sort(function(a,b){
                                               if (a.display > b.display) {
                                                   return 1
                                               } else {
                                                   return -1;
                                               }
                                           })
                                           $scope.valueSetOptions = lst;
                                       }




                                   },
                                   function(err){
                                       //$scope.valueSetOptions = [{code:'notExpanded',display:'Unable to get list, may be too long'}]
                                       $scope.valueSetOptions = [{code:'notExpanded',display:err}]
                                   }
                               )
                           }




                       }, function (err) {
                           console.log(err)
                       }
                   )
               }

                if (type=='extension') {
                    profileDiffSvc.getSD(item.url).then(
                        function (SD) {
                            $scope.selectedExtension = SD;

                            $scope.selectedExtensionAnalysis = Utilities.analyseExtensionDefinition3(SD)
                        },function(err) {
                            //can't find the references extension
                            $scope.selectedExtension = {resourceType:'StructureDefinition',url:item.url}
                        }
                    )
               }

                if (type=='profile') {
                   //this is a profiled resource - - an SD

                   var url;
                   if (item && item.url) {
                       //called from the sidebar
                       url = item.url
                   } else {
                       //called by clicking a link in the table display (will be an array or string or a string)...
                       if (angular.isArray(item)) {
                           url = item[0]
                       } else {
                           url = item;
                       }
                   }

                   $scope.waiting = true;

                   profileDiffSvc.getSD(url).then(
                       function(SD){



                           $scope.constrainedType = SD.constrainedType;     //todo different for R3...

                           //always check if there are any extension definitions or valuesets references by this profile (in case they have been externally changed)
                           if (profileDiffSvc.updateExtensionsAndVSInProfile($scope.currentIG,SD)) {


                               SaveDataToServer.saveResource($scope.currentIG).then(
                                   function (data) {

                                       $scope.selectIG($scope.currentIG);       //re-draw the lists
                                       //need to reset these as they are cleared in the select routine...


                                       $scope.selectedItemType = type;
                                       $scope.selectedItem = item;
                                       //$scope.selectItem(item,type);    //todo. hmmm this is calling itself!
                                       setupProfile(SD)



                                   }, function (err) {
                                       alert('Error updating IG '+angular.toJson(err))
                                   }
                               );




                           } else {
                               setupProfile(SD)
                           }




                           addToHistory('profile',SD)

                       }, function (err) {
                           console.log(err.msg)
                       }
                   ).finally(function () {
                       $scope.waiting = false;
                   })

               }

                if (type=='other') {
                    delete $scope.otherResource
                    //assume url is in the format http://hl7.org/fhir/us/core/CapabilityStatement/server
                    var url = item.url;
                    var ar = url.split('/');
                    var type = ar[ar.length-2];

                    GetDataFromServer.findConformanceResourceByUri(url,appConfigSvc.getCurrentConformanceServer().url,type).then(
                        function(data) {
                            $scope.input.selectedRest = {}
                            $scope.otherResource = data;
                            if (data.resourceType == 'CapabilityStatement') {
                                $scope.analyseCapStmt = profileDiffSvc.makeCapStmt(data);

                            }




                        },function(err){
                            console.log(err)
                        }
                    )


                    $scope.selectedOther =""


                }


            };

            //called directly and from the getItem()
            $scope.getExample = function(item) {
                var url = appConfigSvc.getCurrentDataServer().url + item.url;
                //this is the Json verson...
                GetDataFromServer.adHocFHIRQuery(url).then (
                    function(data) {
                        $scope.exampleResource = data.data
                    },
                    function (err) {
                        alert("Can't find an example at the url: "+ url )
                    }
                )

                //
                url += "?_format=xml&_pretty=true";
                GetDataFromServer.adHocFHIRQuery(url).then (
                    function(data) {
                        $scope.exampleResourceXml = data.data

                    },
                    function (err) {
                        alert("Can't find an example at the url: "+ url)
                    }
                )




            };


            function setupProfile(SD) {
                $scope.selectedSD = SD;
                $scope.arV2 = profileDiffSvc.generateV2MapFromSD(SD);





/*
                //------- other profiles on this base type...
                var baseType;

                if (fhirVersion == 2) {
                    //baseType = SD.base;
                    if (SD.base) {
                        baseType = $filter('getLogicalID')(SD.base);
                    }
                }
*/






                delete $scope.errorsInLM;
                //-------- logical model
                profileDiffSvc.makeLMFromProfile(angular.copy(SD)).then(
                    function(vo) {

                        //display any errors...
                        if (vo.errors.length) {
                            $scope.errorsInLM = vo.errors;


                        }


                        $('#logicalTree').jstree('destroy');
                        $('#logicalTree').jstree(
                            {
                                'core': {
                                    'multiple': false,
                                    'data': vo.treeData,
                                    'themes': {name: 'proton', responsive: true}
                                }
                            }
                        ).on('select_node.jstree', function (e, data) {
                            if (data.node && data.node.data) {


                                $scope.selectedElementInLM = data.node.data.ed;

                                $scope.selectedED1 = data.node.data.ed;
                                $scope.$digest();       //as the event occurred outside of angular...

                            }
                        })
                    }
                );




                //------- raw model
                var treeData = logicalModelSvc.createTreeArrayFromSD(angular.copy(SD))



                $('#profileTree').jstree('destroy');
                $('#profileTree').jstree(
                    {'core': {'multiple': false, 'data': treeData, 'themes': {name: 'proton', responsive: true}}}
                ).on('changed.jstree', function (e, data) {
                    //seems to be the node selection event...
                    delete $scope.selectedED;

                    if (data.node) {

                        $scope.selectedED = data.node.data.ed;
                        $scope.$digest();       //as the event occurred outside of angular...

                    }
                })


                //------ canonical model
                //var vo = profileDiffSvc.makeCanonicalObj(SD);

                profileDiffSvc.makeCanonicalObj(angular.copy(SD)).then(
                    function (vo) {

                        $scope.canonical = vo.canonical;
                        $scope.allExtensions = vo.extensions;
                    },function (err) {
                        console.log(err)
                    }
                );

                //------ report - if this profile is part of an IG... (not a profile selected directly)
                if ($scope.currentIG) {
                    $scope.profileReport = profileDiffSvc.reportOneProfile(angular.copy(SD),$scope.currentIG);
                }


            }

            $scope.drawGraph = function(){
                createGraphOfIG($scope.currentIG);

            };

            $scope.centeredNode = function(centeredOnly){
                if (!centeredOnly) {
                    createGraphOfIG($scope.currentIG);
                }
            }

            var makeOptions = function(){
                var options = {profiles:[]}
                if ($scope.input.includeExtensions) {
                    options.includeExtensions = true;
                }

                if ($scope.input.includeTerminology) {
                    options.includeTerminology = true;
                }
                if ($scope.input.includePatient) {
                    options.includePatient = true;
                }
                if ($scope.centredNodeUrl && $scope.input.center){
                    options.profiles.push($scope.centredNodeUrl)
                }
                if ($scope.input.includeCore) {
                    options.includeCore = true;
                }
                if ($scope.input.immediateChildren) {
                    options.immediateChildren = true;
                }

                return options;
            }

            var createGraphOfIG = function(IG,graphOptions) {
                if (! IG) {
                    return;
                }
                delete $scope.igGraphHash;
                delete $scope.graphReferences;
                delete $scope.selectedNodeFromGraph;

                var graphOptions = graphOptions || makeOptions();

                profileDiffSvc.createGraphOfIG(IG,graphOptions).then(
                    function(graphData) {

                        var hashRelationships = graphData.hashRelationships;  //details of relationships (like path) = hash is <from>-<to>

                        $scope.igGraphHash = graphData.hash;    //the hash generated during the IG analysis. Contains useful stuff like extension usedBy

                        var container = document.getElementById('igModel');

                        var options = {
                            layout: {randomSeed:8},
                            physics: {
                                enabled : true,
                                timestep : .35,
                                stabilization : {
                                    fit:true
                                },
                                barnesHut: {
                                    gravitationalConstant:-7500
                                }
                            },
                            edges : {
                                arrows: {
                                    to:true
                                }
                            }
                        };

                        $scope.profileNetwork = new vis.Network(container, graphData, options);

                        $scope.profileNetwork.on("click", function (obj) {
                            if (obj.edges.length > 0) {
                                delete $scope.selectedNodeFromGraph

                                var edge = graphData.edges.get(obj.edges[0]);
                                //var relationship = hashRelationships[edge.from+'-'+edge.to];
                                $scope.graphReferences = hashRelationships[edge.from+'-'+edge.to];


                            }

                            if (obj.nodes.length > 0) {
                                var nodeId = obj.nodes[0];  //get the first node
                                delete $scope.graphReferences;

                                $scope.selectedNodeFromGraph = graphData.nodes.get(nodeId);

                                //hack for the r2/3 issue...
                                $scope.selectedNodeFromGraph.data.purpose =
                                    $scope.selectedNodeFromGraph.data.purpose || $scope.selectedNodeFromGraph.data.acronym


                                //retrieve the valueset properties if a valueset
                                if ($scope.selectedNodeFromGraph.data.purpose == 'terminology') {
                                    delete $scope.valueSetOptions;


                                    var vo = {selectedValueSet : {vs: {url: $scope.selectedNodeFromGraph.data.url}}}

                                    logicalModelSvc.getOptionsFromValueSet(vo).then(
                                        function(lst) {

                                            $scope.valueSetOptions = lst;

                                            if (lst) {
                                                lst.sort(function(a,b){
                                                    if (a.display > b.display) {
                                                        return 1
                                                    } else {
                                                        return -1;
                                                    }
                                                })
                                            }




                                        },
                                        function(err){
                                            //$scope.valueSetOptions = [{code:'notExpanded',display:'Unable to get list, may be too long'}]
                                            $scope.valueSetOptions = [{code:'notExpanded',display:err}]
                                        }
                                    )
                                }




/* disable for now...
                                if ($scope.selectedNodeFromGraph && $scope.selectedNodeFromGraph.data && $scope.selectedNodeFromGraph.data.url) {
                                    $scope.selectItem({url:$scope.selectedNodeFromGraph.data.url, description:""},'profile')

                                    if ($scope.input.center && $scope.selectedNodeFromGraph) {
                                        var url = $scope.selectedNodeFromGraph.data.url;
                                        centerNodeInGraph(url)
                                    }
                                }

                                */
                            }


                            $scope.$digest();

                        }).on('oncontext',function(obj){
                            //trying for a right click - and failing to stop context menualert('context')

                            obj.event.cancelBubble = true;
                            obj.event.stopPropagation();

                            $scope.$digest();
                        });
                    }
                );
            };

            $scope.selectNodeFromGraph = function(){

                //find the item in the artifacts list
                var item = {}
                $scope.artifacts['profile'].forEach(function (art) {
                    if (art.url == $scope.selectedNodeFromGraph.data.url) {
                        item = art;
                    }
                });


                if (item.url) {
                    $scope.selectItem(item,'profile')
                }


                if ($scope.input.center && $scope.selectedNodeFromGraph) {
                    var url = $scope.selectedNodeFromGraph.data.url;
                    centerNodeInGraph(url)
                }
            };

            $scope.fitGraph = function() {
                if ($scope.profileNetwork) {

                    $timeout(function(){
                        $scope.profileNetwork.fit();
                        
                    },1000)
                }

            };

            function centerNodeInGraph(url) {
                $scope.centredNodeUrl = url;
                var options = makeOptions();
                options.profiles.push(url);
                createGraphOfIG($scope.currentIG,options);
                //$scope.$digest();

                $timeout(function(){
                    if ($scope.profileNetwork) {
                        $scope.profileNetwork.fit();

                    }

                },2000)
            }
    });

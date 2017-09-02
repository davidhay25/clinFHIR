
angular.module("sampleApp")
    .controller('profileDiffCtrl',
        function ($scope,$q,$http,profileDiffSvc,$uibModal,logicalModelSvc,appConfigSvc,RenderProfileSvc,builderSvc,
                  Utilities,GetDataFromServer,profileCreatorSvc,$filter,$firebaseObject,$location,$window,modalService,
                    $timeout,SaveDataToServer,$sce) {

            $scope.input = {center:true,includeCore:true,immediateChildren:true,includeExtensions:true,includePatient:true};
            $scope.appConfigSvc = appConfigSvc;
            $scope.itemColours = profileDiffSvc.objectColours();
            //console.log($scope.itemColours)

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


                console.log(item)

                var igResource = profileDiffSvc.findItem(item.url,$scope.currentIG)

                console.log(igResource);

                $uibModal.open({
                    templateUrl: 'modalTemplates/editIGResource.html',
                    //size:'lg',
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

                //



               // $scope.selectIG($scope.currentIG);

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

                console.log(item)

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
                    console.log(url)
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

                console.log(item)
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

                    //console.log()
                    $scope.$digest();       //as the event occurred outside of angular...

                }).on('redraw.jstree',function(e,data){
                    console.log(data)
                })
            }


            //update the IG on the server..
            $scope.savePages = function(){

                var pageRoot = {page:[]}
                var tree = $('#pagesTreeView').jstree().get_json('#');
                var topNode = tree[0];

                getChildren(pageRoot,topNode);
/*
                if (topNode.children) {
                    getChildren(pageRoot,topNode.children[0]);

                    for (var j = 0; j < top.children.length;j++) {
                        getChildren(pageRoot,top.children[j]);
                    }

                }
*/
                //now copy to IG
                /*

                var frontPage = {source:"about:blank",kind:'page'};
                setTitle(frontPage,"Front Page");
                frontPage.page = pageRoot.page;
                */

                console.log(pageRoot)

                $scope.currentIG.page = pageRoot.page[0];// pageRoot.page;

                //return;

                SaveDataToServer.saveResource($scope.currentIG).then(
                    function (data) {
                        console.log(data)
                        $scope.pageDirty = false;
                        alert("Implementation Guide has been updated.")
                    }, function (err) {
                        alert('Error updating IG '+angular.toJson(err))
                    }
                );

                function getChildren(parentPage,node) {
                    var page = node.data;     //this is a child page off the parent
                    console.log(parentPage,page);
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
                                console.log(IG);
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
                        //console.log(bundle);

                        displayDownLoadDlg(bundle,['Only Profiles and Extension Definitions included'],fileName)

                    },function(bundle) {
                        //console.log(bundle);
                        displayDownLoadDlg(bundle,['Only Profiles and Extension Definitions included'],fileName)

                        //setDownloadLink(bundle,'IG')
                    }
                );
            };

            function setDownloadLinkDEP(bundle,downLoadName) {
                $scope.downloadLinkJsonContent = window.URL.createObjectURL(new Blob([angular.toJson(bundle, true)], {type: "text/text"}));
                $scope.downloadLinkJsonName = downLoadName;
            }

            $scope.importItem = function(itemType){

                console.log(itemType)

                var url = $window.prompt('Enter the Url of the '+itemType.display);
                if (url) {
                    profileDiffSvc.getSD(url).then(
                        function (SD) {
                            console.log(SD);

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

                                /*
                                SD.snapshot.element.forEach(function (ed) {
                                    if (ed.type) {
                                        ed.type.forEach(function (typ) {
                                            if (typ.code == 'Extension' && typ.profile) {
                                                var profileUrl = typ.profile;
                                                if (angular.isArray(profileUrl)) {
                                                    profileUrl = typ.profile[0]
                                                }
                                                console.log(profileUrl);

                                                //make sure this is not already in the list
                                                //var found = false;
                                                var res = profileDiffSvc.findResourceInIGPackage($scope.currentIG,profileUrl);

                                                if (!res) {
                                                    var res = {sourceReference:{reference:profileUrl}};
                                                    //todo - should likely move to an extension for R3
                                                    if (appConfigSvc.getCurrentConformanceServer().version ==2) {
                                                        res.purpose = 'extension'
                                                    } else {
                                                        res.acronym = 'extension'
                                                    }
                                                    pkg.resource.push(res);
                                                }



                                            }

                                        })
                                    }
                                    if (ed.binding) {
                                        var vsUrl = ed.binding.valueSetReference || ed.binding.valueSetUri;
                                        if (vsUrl) {
                                            var res = profileDiffSvc.findResourceInIGPackage($scope.currentIG,vsUrl);

                                            if (!res) {
                                                var res = {sourceReference:{reference:vsUrl}};
                                                //todo - should likely move to an extension for R3
                                                if (appConfigSvc.getCurrentConformanceServer().version ==2) {
                                                    res.purpose = 'terminology'
                                                } else {
                                                    res.acronym = 'terminology'
                                                }
                                                pkg.resource.push(res);
                                            }
                                        }
                                    }
                                })
                                */
                            }


                            $scope.dirty = true;


                            //var IGUrl = appConfigSvc.getCurrentConformanceServer().url + "/ImplementationGuide/"+$scope.currentIG.id;

                            SaveDataToServer.saveResource($scope.currentIG).then(
                                function (data) {
                                    console.log(data)
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

                    console.log(searchString)
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



                            console.log(data.data)
                        },
                    function (err) {
                        console.log(err)
                    }).finally(function () {
                        $scope.waiting = false;
                    });
                }

                console.log(side,svr,type)
            };

            //select a single profile to display as a table...
            $scope.selectCompProfile = function(entry,side) {
              //  console.log(entry)
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
                            //console.log(vo)
                            $scope[canonicalName] = vo.canonical;

                        },function (err) {
                            console.log(err)
                        }
                    )
                }
            };


            function addToHistory(type,resource) {
                $scope.history.push({type:type,resource:resource})
                //console.log($scope.history);
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
            
            $scope.findAdhHocProfile = function (baseType) {
                var svr =  appConfigSvc.getCurrentConformanceServer();
                var searchString = appConfigSvc.getCurrentConformanceServer().url + "StructureDefinition?";



                if (svr.version == 3) {
                    searchString += "kind=resource&base=http://hl7.org/fhir/StructureDefinition/"+$scope.results.profileType.name
                } else {
                    //var base = "http://hl7.org/fhir/StructureDefinition/DomainResource";
                    searchString += "kind=resource&type="+baseType.name;
                }

                //console.log(searchString)
                $scope.waiting = true;

                $http.get(searchString).then(       //first the profiles on that server ...
                    function(data) {
                        $scope.profilesOnBaseType = data.data;

                        var url1 =  appConfigSvc.getCurrentConformanceServer().url + "StructureDefinition/"+baseType.name;
                        $http.get(url1).then(       //and then get the base type
                            function (data) {
                                if (data.data) {
                                    //console.log(data.data)
                                    $scope.profilesOnBaseType.entry = $scope.profilesOnBaseType.entry || []
                                    $scope.profilesOnBaseType.entry.push({resource:data.data});

                                }

                            },
                            function () {
                                //just ignore if we don't fine the base..
                            }
                        ).finally(function () {
                            //console.log($scope.profilesOnBaseType)
                        })

                    },
                    function(err){
                        console.log(err)
                    }
                ).finally(function () {
                    $scope.waiting = false;
                });

            }

            $scope.selectAdhHocProfile = function(SD) {
                $scope.selectedItemType = 'profile';
                setupProfile(SD)
            };
            
            //load the IG's that describe 'collections' of conformance artifacts - like CareConnect & Argonaut
            var url = appConfigSvc.getCurrentConformanceServer().url + "ImplementationGuide";
            $http.get(url).then(
                function(data) {
                    $scope.listOfIG = []
                    if (data.data && data.data.entry) {
                        data.data.entry.forEach(function (entry) {
                            //make sure there is a name field for display...
                            var ig = entry.resource;
                            ig.name = ig.name || ig.description;


                            $scope.listOfIG.push(ig)
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
                        $scope.artifacts[purpose].push(
                            {url:resource.sourceReference.reference, description:resource.description,type:type}
                        )
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


               //console.log(item)
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

                            console.log( $scope.LMtreeData )

                            $scope.LMSD = SD;
                            logicalModelSvc.resetTreeState($scope.LMtreeData);

                            //expand all backbone nodes
                            $scope.LMtreeData.forEach(function (item) {

                                if (item.data && item.data.ed && item.data.ed.type) {
                                    item.data.ed.type.forEach(function (typ) {
                                        if (typ.code == 'BackboneElement') {
                                            item.state.opened = true;
                                            console.log(item)
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
                   //really only works for ValueSet at this point...
                   profileDiffSvc.getTerminologyResource(item.url,'ValueSet').then(
                       function (vs) {
                           $scope.selectedValueSet = vs;
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
                   // $scope.extensionSelected = true;



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
                   //console.log($scope.selectedItem.url)

                   //?? !!!!!!!!!!! temp
                  // url = "http://hl7.org/fhir/us/sdc/"+url


                   profileDiffSvc.getSD(url).then(
                       function(SD){
                           //console.log(SD);


                           $scope.constrainedType = SD.constrainedType;     //todo different for R3...

                           //always check if there are any extension definitions or valuesets references by this profile (in case they have been externally changed)
                           if (profileDiffSvc.updateExtensionsAndVSInProfile($scope.currentIG,SD)) {
                               console.log('updating IG',$scope.currentIG);



                               SaveDataToServer.saveResource($scope.currentIG).then(
                                   function (data) {
                                       console.log(data)
                                       $scope.selectIG($scope.currentIG);       //re-draw the lists
                                       //need to reset these as they are cleared in the select routine...
                                       $scope.selectedItemType = type;
                                       $scope.selectedItem = item;
                                   }, function (err) {
                                       alert('Error updating IG '+angular.toJson(err))
                                   }
                               );




                           }



                           setupProfile(SD)
                           addToHistory('profile',SD)

                       }, function (err) {
                           console.log(err.msg)
                       }
                   ).finally(function () {
                       $scope.waiting = false;
                   })

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
                       // console.log($scope.exampleResourceXml)
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
               /* Not sure why I was doing this. Comment out for the moment...
                if (baseType) {
                    profileDiffSvc.findProfilesOnBase(baseType).then(
                        function (bundle) {
                            console.log(bundle)
                            $scope.profilesOnTypeBdl = bundle

                        },
                        function (err) {
                            console.log("Error getting profiles on "+baseType,err);
                        }
                    )
                }
                */



             //  var clone = angular.copy(SD);

                delete $scope.errorsInLM;
                //-------- logical model
                profileDiffSvc.makeLMFromProfile(angular.copy(SD)).then(
                    function(vo) {

                        //display any errors...
                        if (vo.errors.length) {
                            $scope.errorsInLM = vo.errors;
                            /*
                            var display = "";
                            vo.errors.forEach(function (err) {
                                display += err.type + err.value;
                            });

                            modalService.showModal({}, {bodyText: display})
                            */

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
                               // console.log(data.node && data.node.data);

                                $scope.selectedElementInLM = data.node.data.ed;

                                $scope.selectedED1 = data.node.data.ed;
                                $scope.$digest();       //as the event occurred outside of angular...

                            }
                        })
                    }
                );




                //------- raw model
                var treeData = logicalModelSvc.createTreeArrayFromSD(angular.copy(SD))

                //console.log(treeData)

                $('#profileTree').jstree('destroy');
                $('#profileTree').jstree(
                    {'core': {'multiple': false, 'data': treeData, 'themes': {name: 'proton', responsive: true}}}
                ).on('changed.jstree', function (e, data) {
                    //seems to be the node selection event...
                    delete $scope.selectedED;
                    //console.log(data)
                    if (data.node) {
                        //console.log(data.node && data.node.data);
                        $scope.selectedED = data.node.data.ed;
                        $scope.$digest();       //as the event occurred outside of angular...

                    }
                })


                //------ canonical model
                //var vo = profileDiffSvc.makeCanonicalObj(SD);

                profileDiffSvc.makeCanonicalObj(angular.copy(SD)).then(
                    function (vo) {
                        //console.log(vo)
                        $scope.canonical = vo.canonical;
                        $scope.allExtensions = vo.extensions;
                    },function (err) {
                        console.log(err)
                    }
                );

                //------ report
                $scope.profileReport = profileDiffSvc.reportOneProfile(angular.copy(SD),$scope.currentIG);

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
                        //$scope.graphData = graphData;
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
                                console.log(obj.edges)
                                var edge = graphData.edges.get(obj.edges[0]);
                                //var relationship = hashRelationships[edge.from+'-'+edge.to];
                                $scope.graphReferences = hashRelationships[edge.from+'-'+edge.to];

                                console.log(hashRelationships[edge.from+'-'+edge.to])
                            }

                            if (obj.nodes.length > 0) {
                                var nodeId = obj.nodes[0];  //get the first node
                                delete $scope.graphReferences;

                                $scope.selectedNodeFromGraph = graphData.nodes.get(nodeId);




                                //retrieve the valueset properties if a valueset
                                if ($scope.selectedNodeFromGraph.data.purpose == 'terminology') {
                                    delete $scope.valueSetOptions;
                                    console.log($scope.selectedNodeFromGraph.data)
                                    //var vsUrl =
                                    //selectedValueSet.vs.url
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
                            console.log(obj.event)
                            $scope.$digest();
                        });
                    }
                );
            };

            $scope.selectNodeFromGraph = function(){

                //find the idem in the artifacts list
                var item = {}
                $scope.artifacts['profile'].forEach(function (art) {
                    if (art.url == $scope.selectedNodeFromGraph.data.url) {
                        item = art;
                    }
                });


                if (item) {
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
                        console.log('fit')
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

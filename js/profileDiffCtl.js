
angular.module("sampleApp")
    .controller('profileDiffCtrl',
        function ($scope,$q,$http,profileDiffSvc,$uibModal,logicalModelSvc,appConfigSvc,RenderProfileSvc,builderSvc,
                  Utilities,GetDataFromServer,profileCreatorSvc,$filter,$firebaseObject,$firebaseArray,$location,
                  $window,modalService,$localStorage,$timeout,SaveDataToServer,$sce,resourceCreatorSvc) {

            $scope.input = {center:true,includeCore:true,immediateChildren:true,includeExtensions:true,includePatient:true};
            $scope.input.commentReply = {};
            $scope.input.displayMode = true;        //show all the tabs for the profile view

            $scope.canEdit = false;

            $scope.appConfigSvc = appConfigSvc;
            $scope.itemColours = profileDiffSvc.objectColours();

            var fhirVersion = appConfigSvc.getCurrentConformanceServer().version;




            //retrieve the current user from the browser cache if present. Note that this includes the authHeader...
            if ($localStorage.currentUser) {
                $scope.currentUser = $localStorage.currentUser;
                // todo - may enable editing through the UI... $scope.canEdit = true;
            }

            $scope.history = [];        //
            $scope.input.tabShowing='single';
            $scope.input.categories = ['profile','extension','terminology'];

            GetDataFromServer.registerAccess('igView');

            $scope.singleStateZoom = false;
            $scope.singleLeftPaneClass = "col-sm-3 col-md-3";
            $scope.singleRightPaneClass = "col-sm-9 col-md-9";

            //the desctiption of each artifact type in the tree...
            $scope.typeDescription = {};
            $scope.typeDescription.extension = 'Extension Definition';
            $scope.typeDescription.profile = 'Profile';
            $scope.typeDescription.codesystem = 'CodeSystem';
            $scope.typeDescription.valueset = 'ValueSet';
            //$scope.typeDescription.terminology = 'Other Terminology';
            $scope.typeDescription.logical = 'Logical model';
            $scope.typeDescription.example = 'Example';
            $scope.typeDescription.other = 'Other artifact';


            $scope.createFullDoc = function(){
                $scope.loadingFullDoc = true;
                console.log($scope.pageTreeData)
                let cnt = 0;
                let arQuery=[]
                let docRootId =$scope.pageTreeData[0].id;      //the root of the document tree
                for (var i=1; i< $scope.pageTreeData.length; i++) {
                    let item = $scope.pageTreeData[i];
                    if (item.parent == '#' && cnt > 1) {
                        //break when we get to the second node off the root
                        break;
                    } else {cnt++}
                   // console.log(item)
                    if (item.data && item.data.nameUrl && ! item.data.md) {
                        console.log(item.data.nameUrl)
                        arQuery.push(getPage(item.data.nameUrl,item,docRootId))
                    }
                }

                if (arQuery.length > 0) {
                    $q.all(arQuery).then(
                        function() {
                            console.log($scope.pageTreeData)
                            assembleFullDoc();
                            delete $scope.loadingFullDoc;

                        }, function() {
                            console.log('error')
                        }
                    );
                }

                function assembleFullDoc() {
                    $scope.fullDoc = "";
                    for (var i=1; i< $scope.pageTreeData.length; i++) {
                        let item = $scope.pageTreeData[i];
                        if (item.data.md) {
                            $scope.fullDoc += item.data.md
                        }
                    }
                }



                function getPage(nameUrl,item,docRootId) {
                    var deferred = $q.defer();
                    let url = appConfigSvc.getCurrentDataServer().url + nameUrl;
                    $http.get(url).then(
                        function(data) {
                            let md = atob(data.data.content)

                            if (item.parent == docRootId) {
                                md = "<div class='banner'>"+ item.text + "</div>" + md
                            }

                            item.data.md = md + "\n\n"
                            deferred.resolve();
                        },
                        function(err) {
                            //resolve anyway
                            deferred.resolve();
                        }
                    );
                    return deferred.promise;
                }

            };

            $scope.saveBinary = function(item,content) {
                let url = item.nameUrl;
                item.md = content;      //for use when displaying the full page...
                console.log(url,content)

                if (url && content) {
                    let ar = url.split('/')
                    let bin = {resourceType:'Binary', 'contentType':'application/json'}
                    bin.id = ar[ar.length-1]
                    bin.content = btoa(content);
                    let binUrl = appConfigSvc.getCurrentConformanceServer().url + url
                    $http.put(binUrl,bin).then(
                        function() {
                            showDisplay("Documentation saved")
                        },
                        function(err){
                            alert('Error saving docs:'+angular.toJson(err.data))
                        }

                    )
                }

            };

            function showDisplay(msg) {
                $scope.displayMessage = msg;
                $timeout(function(){
                    delete $scope.displayMessage
                },3000)
            }

            $scope.checkAllVSinIG = function() {
                //check that all the VS mentioned in all the profiles are in the IG

                profileDiffSvc.checkAllVSinIG($scope.currentIG).then(
                    function (hashVS) {
                        console.log(hashVS)
                        $scope.hashVS = hashVS;
                    }
                )
            };


            $scope.validateArtifactsOnServer = function(type) {
                //check that the artifacts of the given type are on the server
                delete $scope.artifactChecks;
                var vs = $scope.artifacts[$scope.selectedArtifactType];
                console.log(type,vs)
                profileDiffSvc.validateArtifactsOnServer(type,vs).then(
                    function(arResult) {
                        console.log(arResult)
                        $scope.artifactChecks = arResult;
                    }
                )
            };

            $scope.showDT = function(dt) {
                var msg = "";
                switch (dt) {
                    case 'Identifier' :
                        msg = "System,Value";
                        break;

                    case 'HumanName' :
                        msg = "First name, Last Name, Prefix, Suffix";
                        break;
                    case 'Address' :
                        msg = 'Text, address lines, suburb, state, country';
                        break;
                    case 'CodeableConcept' :
                        msg = 'Text, multiple coded values (system, code)';
                        break;
                    case 'ContactPoint' :
                        msg = 'Type, value';
                        break;


                }

                return msg
            };

            $scope.toggleSingleState = function(){
                $scope.singleStateZoom = ! $scope.singleStateZoom
                if ($scope.singleStateZoom) {
                    $scope.singleLeftPaneClass = "hidden";
                    $scope.singleRightPaneClass = "col-sm-12 col-md-12";
                } else {
                    $scope.singleLeftPaneClass = "col-sm-3 col-md-3";
                    $scope.singleRightPaneClass = "col-sm-9 col-md-9";
                }
            };



            //-----------  login stuff....

            //called whenever the auth state changes - eg login/out, initial load, create user etc.
            //todo - not using this ATM
            firebase.auth().onAuthStateChanged(function(user) {

                if (user) {
                    $scope.user = user;

                    $scope.currentUser = user;

                    $scope.userProfile = $firebaseObject(firebase.database().ref().child("users").child(user.uid));
                   //todo may enable write later  $scope.canEdit = true;
                    console.log(user)
                }
            });


            $scope.login=function(){
                //note that after login, the authstatechanged event fires...
                $uibModal.open({
                    backdrop: 'static',      //means can't close by clicking on the backdrop.
                    keyboard: false,       //same as above.
                    templateUrl: 'modalTemplates/login.html',
                    controller: 'loginCtrl'
                })
            };

            $scope.logout=function(){
                firebase.auth().signOut().then(function() {

                    modalService.showModal({}, {bodyText: 'You have been logged out of clinFHIR'})
                    $scope.canEdit = false;

                }, function(error) {
                    modalService.showModal({}, {bodyText: 'Sorry, there was an error logging out - please try again'})
                });

            };

            //using the smile login store.
            //Not using this at the moment - need to think this through a bit more...
            $scope.loginSmileDEP = function(){
                $uibModal.open({
                    templateUrl: 'modalTemplates/loginSmile.html',

                    backdrop: 'static',
                    controller: 'loginSmileCtrl'

                }).result.then(
                    function (user) {
                        $scope.currentUser = user;
                        $localStorage.currentUser = user;
                        $scope.canEdit = true;
                    }
                )
            };

            $scope.logoutSmileDEP = function(){
                delete $scope.currentUser;
                delete $localStorage.currentUser;
                $scope.canEdit = false;
            };

            //--------  comment functions
            $scope.$on("LMElementSelected",function(ev,data){
                //console.log(data);
                $scope.selectedEDInLM = data;

                $scope.commentsForElement = profileDiffSvc.getCommentsForElement($scope.selectedEDInLM);
            });

            //create a new IG
            $scope.addIG = function() {

                var name = $window.prompt('The IG name (must be a single word - it will become the Id and Url)')
                if (name) {

                    if (! /^[A-Za-z0-9\-\.]{1,64}$/.test(name)) {
                        var msg = "The name can only contain upper and lowercase letters, numbers, '-' and '.'"
                        modalService.showModal({},{bodyText:msg})
                        return;
                    }

                    var url = appConfigSvc.getCurrentConformanceServer().url + "ImplementationGuide/"+name;
                    $http.get(url).then(
                        function(data){
                            modalService.showModal({},{bodyText:"There is already an IG with that id"})
                        },function(err){

                            var IG = {resourceType:'ImplementationGuide',status:'draft',package:[{name:'complete',resource:[]}]};
                            IG.id = name;
                            IG.url = url;
                            //IG.description = "QI Core";
                            IG.name = name;
                            IG.extension = [{url: "http://clinfhir.com/fhir/StructureDefinition/cfAuthor",valueBoolean:true}];
                            IG.page = {source:'',title:'Root of Pages',kind:'page',page:[]};
                            console.log(IG)
                            msg = "The IG has been created and saved. You should go to the IG summary page ";
                            msg += "to set the description and other IG level information.";
                            modalService.showModal({},{bodyText:msg})
                            $scope.input.IGSummaryDirty=true;
                            //$scope.currentIG = IG;

                            //the list selector to the left
                            $scope.listOfIG.push(IG);
                            $scope.input.selIG = IG;

                            $scope.selectIG(IG)
                            $scope.saveIG();

                        }
                    );



                    //IG.page = {source:'http://hl7.org/fhir/us/qicore/2018Jan/index.html',title:'Specification',kind:'page',page:[]};

                }



            };

            $scope.saveNewCommentDEPDontDelete = function (comment,relatedToId,inx) {
                profileDiffSvc.saveNewComment(comment,$scope.selectedSD.url,$scope.selectedEDInLM,$scope.user.email,relatedToId).then(
                    function(displayObj) {
                        alert('Comment has been saved')
                        delete $scope.input.newComment;
                        getCommentsForProfile($scope.selectedSD.url,function(){
                            $scope.commentsForElement = profileDiffSvc.getCommentsForElement($scope.selectedEDInLM);
                            $scope.commentsThisProfileCount++;
                            if (inx !== null) {
                                delete $scope.input.commentReply[inx]
                            }
                        })
                    },
                    function(err) {
                        alert('not saved')
                        console.log(err)
                    }
                )
            };

            var getCommentsForProfileDEPDontDelete = function(url,cb) {
                delete $scope.commentsThisProfileHash;
                delete $scope.commentsThisProfileCount;
                profileDiffSvc.getCommentsForProfile(url).then(
                    function(data){
                        console.log(data)
                        $scope.commentsThisProfileHash = data.hash;
                        $scope.commentsThisProfileCount = data.count;
                        if (cb) {
                            cb()
                        }

                    },
                    function(err) {
                        console.log(err)
                        if (cb) {
                            cb()
                        }
                    }
                )
            };


            //-------------------

            //switch between a 'simplified' and a complete view of the profile...
            $scope.changeMode = function(mode) {
                mode = !mode
            };

            //load all the IG's on this server

            //get the version of the conformance server...
            let FHIRVersion = appConfigSvc.getCurrentConformanceServer().version;
            console.log(FHIRVersion);


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
                            } else {
                                console.log("IG '"+ig.id + "' is not authored by clinFHIR")
                            }
                        });
                        $scope.listOfIG.sort(function(a,b){
                            if (a.name > b.name) {
                                return 1
                            } else {
                                return -1
                            }
                        })
                    }

                    $scope.input.selIG = $scope.listOfIG[0]
                    //$scope.input.selIG = $scope.listOfIG[1];  //<<<<<<<<<<<< while develooping
                },
                function(err){
                    console.log(err)
                }
            );

            $scope.saveIG = function(hideAlert){

                SaveDataToServer.saveResource($scope.currentIG,null,$scope.currentUser).then(
                    function (data) {
                        if (! hideAlert) {
                            alert('IG updated');
                        }

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
                        $scope.name = igResource.name;

                        $scope.save = function(){
                            var vo = {description: $scope.description,name:$scope.name}
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

                    igResource.name = vo.name;
                    item.name = vo.name;
                    $scope.saveIG()

                    makeArtifact();

                    //$scope.selectItem(item,'example')
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

            function clearPageTree (){
                $('#pagesTreeView').jstree('destroy');
            }
            function drawPageTree(cb) {
                $('#pagesTreeView').jstree('destroy');
                $('#pagesTreeView').jstree(
                    {'core': {'multiple': false, 'data': $scope.pageTreeData, 'themes': {name: 'proton', responsive: true}}}
                ).on('changed.jstree', function (e, data) {

                    delete $scope.artifactChecks;

                    if (data.node) {
                        $scope.selectedPageNode = data.node;

                        if ($scope.selectedPageNode.data) {

                            delete $scope.selectedItem;     //actually, specifically an artifact item...
                            delete $scope.selectedPageIsExternalUrl;    //true when the selected page is an external url and can't be edited...
                            delete $scope.input.selectedPageContents; //the MD contents if this page is editable in the UI

                            $scope.selectedItemType = $scope.selectedPageNode.data.nodeType;

                            //console.log($scope.selectedPageNode.data.nodeType);

                            //this node represents a documentation page...
                            if ($scope.selectedPageNode.data.nodeType == 'page') {
                                $scope.page.src = $sce.trustAsResourceUrl('about:blank');   //clear the iframe




                                //R3 stores url in 'source' = R4 is 'nameUrl'
                                if (fhirVersion == 3 ) {
                                    let url = $scope.selectedPageNode.data.source;
                                    $scope.selectedPageIsExternalUrl = true;
                                    $scope.page.src = $sce.trustAsResourceUrl(url);
                                } else {
                                    //R4
                                    let url = $scope.selectedPageNode.data.nameUrl;   //assume relative
                                    let docUrl = appConfigSvc.getCurrentConformanceServer().url + url;

                                    $scope.waiting = true;
                                    $http.get(docUrl).then(
                                        function(data) {
                                            $scope.input.selectedPageContents = atob(data.data.content);



                                        },
                                        function(){
                                            console.log('not found')
                                            //ignore not found...
                                        }
                                    ).finally(function(){
                                        $scope.waiting = false;
                                    })
                                }


                            }

                            //this is an artifact type (like 'extension' or 'logical') - ie a grouping of artifacts
                            if ($scope.selectedPageNode.data.nodeType == 'artifactType') {
                                var aType = $scope.selectedPageNode.data.artifactType;
                                $scope.selectedArtifactType = $scope.selectedPageNode.data.artifactType;
                            }

                            //this node represents an actual artifact - like a logical mode or a profile...
                            if ($scope.selectedPageNode.data.nodeType == 'artifact') {
                                var item = $scope.selectedPageNode.data.art;

                                $scope.selectItem(item,item.purpose);       //sets selectedItemType
                            }

                            //console.log($scope.selectedItemType)
                        }
                        $scope.$digest();       //as the event occurred outside of angular...

                    }



                }).on('redraw.jstree',function(e,data){

                }).bind('ready.jstree', function(e, data) {
                    console.log('loaded')
                    if (cb) { cb()}
                })
            }


            //update the IG on the server..
            $scope.savePages = function(cb){

                //generate a representation of the document tree to save in the IG.page element (ie the user documentation)
                var pageRoot = {page:[]}
                var tree = $('#pagesTreeView').jstree().get_json('#');
                var topNode = tree[0];

                getChildren(pageRoot,topNode);


                if (fhirVersion == 3) {
                    $scope.currentIG.page = pageRoot.page[0];// pageRoot.page;
                } else {
                    $scope.currentIG.definition = $scope.currentIG.definition || {}
                    $scope.currentIG.definition.page = pageRoot.page[0];// pageRoot.page;
                }



                //return;

                console.log($scope.currentIG);

                //pass in the current user, as the credentials may be required...
                SaveDataToServer.saveResource($scope.currentIG,null,$scope.currentUser).then(
                    function (data) {
                        $scope.pageDirty = false;
                        showDisplay("Implementation Guide has been updated.")
                        if (cb) {
                            cb();
                        }


                    }, function (err) {
                        alert('Error updating IG '+angular.toJson(err))
                    }
                );


                function getChildren(parentPage,node) {
                    var page = angular.copy(node.data);     //this is a child page off the parent
                    delete page.nodeType;       //Added to support the tree display

                    //STU changes. Could be re-factored when the IG version changes...

                    page.title = page.title || page.name;
                    delete page.name;

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


                drawPageTree(function(){
                    $timeout(function(){
                        $scope.savePages();     //savePages actually uses the tree...
                    },1000)

                })


                //drawPageTree()
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

                    drawPageTree(function(){
                        $timeout(function(){
                            $scope.savePages();     //savePages actually uses the tree...
                        },1000)

                    })



                   // drawPageTree()
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

                            let link = $scope.input.link;
                            if (!link) {
                                let id = $scope.input.title.split(" ").join("-") +  new Date().getTime();


                                link = "Binary/cf-"+ id;
                            }

                            var vo = {link:link,title:$scope.input.title};
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
/*
don't change link on edit...
                            if (fhirVersion ==3 ) {
                                page.source = vo.link;
                            } else {
                               // page.nameUrl = vo.link;
                            }
*/

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

                            var page = {nodeType:'page'};

                            if (fhirVersion ==3 ) {
                                page.source = vo.link;
                                page.kind = 'page';
                            } else {
                                page.nameUrl = vo.link;
                            }


                            setTitle(page,vo.title);
                            page.page = [];         //as pages can be nested...
                            var id = 't' + new Date().getTime();
                            var title = page.title || page.name;    //R3/STU2

                            var parentId = '#';
                            if ($scope.selectedPageNode) {
                                parentId = $scope.selectedPageNode.id;
                            }

                            var node = {id:id,parent:parentId,text:title,state: {opened: true}};
                            node.data = page;
                            $scope.pageTreeData.push(node);

                            console.log(node)

                        }

                        drawPageTree(function(){
                            $timeout(function(){
                                $scope.savePages();     //savePages actually uses the tree...
                            },1000)

                        })


                      //  $scope.savePages(function() {

                     //   });     //auto update
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


                var url = $window.prompt('Enter the canonical url of the '+itemType.display + " \n(It must be on the Conformance server)");
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

                            } else {
                                //add the profile to the IG - then find any extensions and add them as well. todo - should we check whether they exist first?

                                var res = {sourceReference:{reference:url},acronym:itemType.type};

                                res.extension = [];
                                var extension = {url:'http://clinfhir.com/StructureDefinition/igEntryType'}
                                extension.valueCode = itemType.type;
                                res.extension.push(extension);

                                //todo - should likely move to an extension for R3
                                if (appConfigSvc.getCurrentConformanceServer().version ==2) {
                                    res.purpose = itemType.type
                                } else {
                                    res.acronym = itemType.type
                                }
                                pkg.resource.push(res);
                            }

                            //now look for any extensions or ValueSets if the object being imported is a profile or a logical model....
                            if (itemType.type == "profile" || itemType.type == "logical") {
                                if (SD.snapshot && SD.snapshot.element) {
                                    profileDiffSvc.updateExtensionsAndVSInProfile($scope.currentIG,SD,pkg);
                                }
                            }

                            $scope.dirty = true;

                            SaveDataToServer.saveResource($scope.currentIG,null,$scope.currentUser).then(
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

                }

            };

            $scope.removeItem = function(item) {
                console.log(item)
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
                    controller: function($scope,ext,Utilities,fnShowVS) {
                        $scope.extensionAnalysis = Utilities.analyseExtensionDefinition3(ext)

                        $scope.mShowVS = function(url) {
                           // console.log(url)
                            fnShowVS(url)

                        }
                    },
                    resolve : {
                        ext: function () {          //the default config
                            return SD;
                        },
                        fnShowVS : function() {
                           return $scope.showValueSet
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
                delete $scope.selectedElementInLMDisplay
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

            //find all the profiles on a given type
            $scope.findAdHocProfileDEP = function (baseType) {
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

            };



            //note that we're using an IG to hold all the resources in this collection
            $scope.selectIG = function(IG){
                var extDef = appConfigSvc.config().standardExtensionUrl.resourceTypeUrl;
                clearRightPane();
                clearPageTree();

                $scope.currentIG=IG;     //the List the holds this collection

                //now pull out the various artifacts into an easy to use object
                makeArtifact();

                $scope.pageTreeData = profileDiffSvc.generatePageTree($scope.currentIG,$scope.artifacts,$scope.typeDescription,fhirVersion);

                drawPageTree();
                $scope.selectedItemType = 'pageRoot';   //shows the root page for the documentaion
                console.log($scope.artifacts)

            };

            function makeArtifact() {
                $scope.artifacts = {};
                //create an entry for every 'purpose' so they can be added in the UI
                let ar = ['logical','profile','extension','codesystem','valueset','other','example'];

                ar.forEach(function (purpose) {
                    $scope.artifacts[purpose] = []
                });



                let cfpubIgRoot = "";
                var cfpubIgRootExt = Utilities.getSingleExtensionValue($scope.currentIG, appConfigSvc.config().standardExtensionUrl.cfpubIgRoot);
                if (cfpubIgRootExt) {
                    cfpubIgRoot = cfpubIgRootExt.valueUri;
                }


                if (FHIRVersion ==4) {
                    let igTypeUrl = appConfigSvc.config().standardExtensionUrl.igEntryType;

                    let extUrl = appConfigSvc.config().standardExtensionUrl.canonicalUrl;

                    $scope.currentIG.definition.resource.forEach(function (item) {

                        let type = Utilities.getSingleExtensionValue(item,igTypeUrl);
                        if (type) {
                            console.log(type.valueCode)
                            switch (type.valueCode) {
                                case 'logical' :
                                case 'extension' :
                                case 'profile' :
                                case 'codesystem':
                                case 'valueset':
                                    if (item.reference) {
                                        let ar = item.reference.reference.split('/');
                                        let id = ar[ar.length-1];
                                        //in R4 the url is not a direct reference - not the canonical url...

                                        //if there's not extension in the IG with the canonocal url, assume that it is the conformance server plus reference

                                        let url = item.reference.reference;
                                        var t = Utilities.getSingleExtensionValue(item, extUrl);
                                        if (t) {
                                            url = t.valueUrl;
                                        }

                                        //note that entry.url is a canonical url (as this was the case in STU3)...
                                        let entry = {name:item.name,description:item.description,url:url};
                                        entry.type = type.valueCode;

                                        $scope.artifacts[entry.type].push(entry)
                                    } else {
                                        alert('Logical model in IG without reference..')
                                    }
                                    break;
                                case 'example' :

                                    break;
                                default :


                                    break;
                            }

                        } else {

                            if (item.exampleCanonical || item.exampleBoolean) {
                                let entry = {type:'example',name:item.name,description:item.description,url:item.reference.reference};
                                $scope.artifacts['example'].push(entry)
                            }


                        }
                    });

                } else {
                    //this is R3
                    $scope.currentIG.package.forEach(function (package) {
                        if (package && package.resource) {

                            package.resource.forEach(function (resource) {
                                var purpose = profileDiffSvc.getPurpose(resource)

                                var type;

                                var extDef = appConfigSvc.config().standardExtensionUrl.resourceTypeUrl;
                                if (resource.example || resource.purpose == 'example') {         //another R2/3 difference...
                                    purpose = 'example'
                                    var t = Utilities.getSingleExtensionValue(resource, extDef);
                                    if (t) {
                                        type = t.valueString;
                                    }
                                }

                                //$scope.artifacts[purpose] = $scope.artifacts[purpose] || []

                                var item2 = {description: resource.description, type: type, name:resource.name};
                                let igDocExtUrl = appConfigSvc.config().standardExtensionUrl.igDocumentation;
                                var t = Utilities.getSingleExtensionValue(resource, igDocExtUrl);
                                if (t) {
                                    item2.documentationUri = cfpubIgRoot +t.valueUri;
                                }

                                if (resource.sourceReference) {
                                    item2.url = resource.sourceReference.reference;
                                }

                                if (resource.sourceUri) {
                                    item2.url = resource.sourceUri;
                                    item2.uri = resource.sourceUri;     //for OID type references...
                                }

                                $scope.artifacts[purpose].push(item2)
                            })



                        }
                    });

                    //sort 'em all...
                    ['extension','profile','logical','other','example','codesystem'].forEach(function (purpose) {
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
                }



                //now sort the examples by the base resource type. Assume a relative reference. todo - may need to change this...
                $scope.artifacts.example.sort(function (a,b) {
                    if (a.url && b.url) {
                        var arA = a.url.split('/');
                        var arB = b.url.split('/');

                        if (arA[0] > arB[0]) {
                            return 1
                        } else {
                            return -1
                        }
                    } else {
                        return 0
                    }
                })
            }

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

            //when an item is selected in the tree for display in the right pane...
            $scope.selectItem = function(item,type){

                clearRightPane()

                $scope.selectedItemType = type;
                $scope.selectedItem = item;

                delete $scope.exampleResource
                delete $scope.exampleResourceXml


                //temp - causing re-read of ig ???  centerNodeInGraph(item.url)

                //right now we assume that examples are on the data server...
                if (type == 'example') {
                    $scope.getExample(item)
                }

                if (type == 'logical') {
                    delete $scope.LMSD;
                    delete $scope.lmShortCut;
                    profileDiffSvc.getSD(item.url).then(
                        function (SD) {

                            $scope.$broadcast("loadResource",SD);   //so can load the documentation...


                            $scope.LMtreeData = logicalModelSvc.createTreeArrayFromSD(angular.copy(SD));
console.log(SD)






                            buildMM(SD);        //construct the mind map
                            //console.log($scope.LMtreeData);

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

                            profileDiffSvc.findShortCutForModel($scope.LMSD.id).then(
                                function(data){
                                    $scope.lmShortCut = data;
                                    console.log(data)
                                }
                            )


                        },
                        function(err) {
                            alert(err.msg)
                        }
                    )

                }

                if (type == 'codesystem') {

                    delete $scope.selectedCodeSystem;

                   profileDiffSvc.getTerminologyResource(item.url,'CodeSystem').then(
                       function (cs) {
                           $scope.selectedCodeSystem = cs;

                       }, function (err) {
                           console.log(err)
                       }
                   )
               }


                if (type == 'valueset') {
                    delete $scope.valueSetOptions;
                    delete $scope.valueSetExpandError;

                    profileDiffSvc.getTerminologyResource(item.url,'ValueSet').then(
                        function (vs) {
                            $scope.selectedValueset = vs;


                            //call the $expand operation on the terminology server.
                            let url = appConfigSvc.getCurrentTerminologyServer().url+"ValueSet/$expand";
                            url += '?url=' + item.url;

                            $http.get(url).then(
                                function(data) {
                                    console.log(data.data)
                                    $scope.valueSetOptions = data.data.expansion.contains;
                                },
                                function(err){
                                    console.log(err)
                                }
                            )

/*
                            //if (tType == 'ValueSet') {
                            var vo = {selectedValueSet : {vs: {url: vs.url}}}




                            logicalModelSvc.getOptionsFromValueSet(vo).then(
                                function(lst) {



                                    if (lst) {

                                        $scope.valueSetOptions = lst;
                                    }




                                },
                                function(err){
                                    //$scope.valueSetOptions = [{code:'notExpanded',display:'Unable to get list, may be too long'}]
                                    $scope.valueSetExpandError = err.data
                                }
                            )
                            */

                        }, function (err) {
                            console.log(err)
                        }
                    )
                }

               /*
                //todo - not really using terminology in latest version ? should delete
                if (type == 'terminology') {
                    delete $scope.valueSetOptions;
                    delete $scope.valueSetExpandError;

                    profileDiffSvc.getTerminologyResource(item.url,'ValueSet').then(
                        function (vs) {
                            $scope.selectedTerminology = vs;



                            //if (tType == 'ValueSet') {
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
                                    $scope.valueSetExpandError = err.data
                                }
                            )
                            //}




                        }, function (err) {
                            console.log(err)
                        }
                    )
                }

                */

                if (type=='extension') {

                    //if this is R3, the url is a canonical url. If R4 then it's a literal (relative) url

                    delete $scope.extDefNotFound;
                    profileDiffSvc.getSD(item.url,fhirVersion).then(
                        function (SD) {
                            $scope.selectedExtension = SD;

                            $scope.selectedExtensionAnalysis = Utilities.analyseExtensionDefinition3(SD)
                        },function(err) {
                            //can't find the references extension
                            $scope.extDefNotFound = err
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

                   console.log('item',item)
                    $scope.iframeUrl = item.documentationUri

                   $scope.waiting = true;

                   profileDiffSvc.getSD(url).then(
                       function(SD){



                          //Don't delete just yet... getCommentsForProfile(url);

                           $scope.constrainedType = SD.constrainedType;     //todo different for R3...

                           /*   DON'T DELETE !!!

                           Disable the content check for the moment. May want to make it optional,
                           //always check if there are any extension definitions or valuesets references by this profile (in case they have been externally changed)
                           if (profileDiffSvc.updateExtensionsAndVSInProfile($scope.currentIG,SD)) {


                               SaveDataToServer.saveResource($scope.currentIG,null,$scope.currentUser).then(
                                   function (data) {

                                       $scope.selectIG($scope.currentIG);       //re-draw the lists
                                       //need to reset these as they are cleared in the select routine...
                                       $scope.selectedItemType = type;
                                       $scope.selectedItem = item;
                                       setupProfile(SD)
                                   }, function (err) {
                                       alert('Error updating IG '+angular.toJson(err))

                                       //even if there was an error updating the the IG, we still want to select this profile...
                                       $scope.selectIG($scope.currentIG);       //re-draw the lists
                                       //need to reset these as they are cleared in the select routine...
                                       $scope.selectedItemType = type;
                                       $scope.selectedItem = item;
                                       setupProfile(SD)

                                   }
                               );

                           } else {
                               setupProfile(SD)
                           }

                           */
                           setupProfile(SD)
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

                    GetDataFromServer.findConformanceResourceByUri(url,appConfigSvc.getCurrentConformanceServer().url,type,true).then(
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
                //this is the Json verson (assume that it is the default)...
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

                                //create a display version of the element, removing the stuff I added...
                                $scope.selectedElementInLMDisplay = angular.copy(data.node.data.ed);
                                delete $scope.selectedElementInLMDisplay.myMeta;
                                $scope.selectedED1 = data.node.data.ed;

                                $scope.$broadcast("LMElementSelected",data.node.data.ed);


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


            function buildMM(SD) {
                var options = {};
                resourceCreatorSvc.createGraphOfProfile(SD,options).then(
                    function(graphData) {
                        $scope.graphData = graphData;

                        var container = document.getElementById('mmLogicalModel');
                        var optionsMM = {

                            edges: {

                                smooth: {
                                    type: 'cubicBezier',
                                    forceDirection: 'horizontal',
                                    roundness: 0.4
                                }
                            },
                            layout: {
                                hierarchical: {
                                    direction: 'LR',
                                    nodeSpacing: 60,
                                    sortMethod: 'directed',
                                    parentCentralization: false
                                }
                            },
                            physics: false
                        };

                        var options = {
                            physics: {
                                enabled: true,
                                barnesHut: {
                                    gravitationalConstant: -1100,
                                }
                            }
                        };

                        $scope.graphLM = new vis.Network(container, graphData, options);

                        $scope.graphLM.on("click", function (obj) {
                            var nodeId = obj.nodes[0];  //get the first node
                            var node = graphData.nodes.get(nodeId);
                            $scope.selectedNodeInLMGraph = angular.copy(node);
                            console.log(node);
                        })


                    }
                )

                //--------------------
            }

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
    })
    .controller('docCtrl',
        function ($scope,$rootScope,appConfigSvc,$http){
            $scope.doc = {};
            $scope.doc.resourceDocType = 'intro';


            $scope.sections = [];
            $scope.sections.push({code:'intro',display:'Introduction'});
            $scope.sections.push({code:'summary',display:'Summary'});
            $scope.sections.push({code:'search',display:'Search'});

            $scope.$on("loadResource",function(ev,resource){
                loadDoc(resource)
            })


            $scope.isDirty = false;


            //save the document reference that has content for the uri. Pass in the SD for the model
            $scope.saveDoc = function(SD) {
                let bin = {resourceType:'Binary',contentType:'application/json'};

                bin.id = SD.id + '-doc';
                bin.data = btoa(angular.toJson($scope.doc.resourceDoc));


                /*
                $scope.sections.forEach(function(sect){
                    let notes = $scope.doc.resourceDoc[sect.code];
                    if (notes) {
                        let att = {title:sect.code};
                        att.data = btoa(notes);
                        dr.content.push({attachment:att})
                    }
                });
*/
                let url = appConfigSvc.getCurrentConformanceServer().url + "Binary/"+bin.id;


                $http.put(url,bin).then(
                    function() {
                        console.log('saved');
                        $scope.isDirty = false;
                    },
                    function(err) {
                        alert('error saving notes' + angular.toJson(err))
                    }
                )


            };

            //load the Binary that has content for the uri
            let loadDoc = function(SD) {
                delete $scope.fullResourceDoc;
                $scope.doc.resourceDoc = {};    //all the document snippets for the model...

                let url = appConfigSvc.getCurrentConformanceServer().url + "Binary/"+SD.id+ '-doc';
                $rootScope.waiting = true;
                $http.get(url).then(
                    function(data){

                        let bin  = data.data;

                        if (bin.data) {
                            $scope.doc.resourceDoc = angular.fromJson(atob(bin.data));
                            $scope.makeDoc();
                        }
                    },
                    function(err) {
                        console.log('error retrieving notes' + angular.toJson(err))
                    }
                ).finally(
                    function(){
                        $rootScope.waiting = false;
                    }
                )

            };

            $scope.makeDoc = function() {
                $scope.fullResourceDoc = "";

                $scope.sections.forEach(function(sect){
                    $scope.fullResourceDoc += "# "+sect.display +"\n" + ($scope.doc.resourceDoc[sect.code] || "") + "\n";
                })



              //  $scope.fullResourceDoc += "# Introduction\n" + ($scope.doc.resourceDoc['intro'] || "") + "\n";
                //$scope.fullResourceDoc += "# Summary\n" + ($scope.doc.resourceDoc['summary']|| "") + "\n";
              //  $scope.fullResourceDoc += "# Search\n" + ($scope.doc.resourceDoc['search']|| "") + "\n";

            }
        });

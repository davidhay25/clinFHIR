/*has been deprectde - don't call make function - expensive! */

angular.module("sampleApp")
    .controller('logicalModellerCtrl',
        function ($scope,$rootScope,$uibModal,$http,resourceCreatorSvc,modalService,appConfigSvc,logicalModelSvc,$timeout,
                  GetDataFromServer,$firebaseObject,$firebaseArray,$location,igSvc,SaveDataToServer,$window,RenderProfileSvc,
                  $q,Utilities, securitySvc) {
            $scope.input = {};

            $scope.code = {};
            $scope.code.lmPalette = 'lmPalette';        //the list code for the paletteof models...
            $scope.treeData = [];           //populates the resource tree

            $scope.mdOptions = {
                controls: ["bold", "italic", "separator", "bullets","separator", "heading","separator", "preview"]
            };

            $scope.appConfigSvc = appConfigSvc
            $scope.conformanceServer = appConfigSvc.getCurrentConformanceServer();

            GetDataFromServer.registerAccess('logical');

            //for selecting a profile to import
           // $scope.showFindProfileDialog = {};
            //all the base types for the selection...
            RenderProfileSvc.getAllStandardResourceTypes().then(
                function(data){
                    $scope.allResourceTypes = data;
                });

            $scope.findProfileDEP = function() {
                //$scope.showFindProfileDialog.open();
            };


            $scope.rootForDataType="http://hl7.org/fhir/datatypes.html#";

            $scope.input.newCommentboxInxDEP = -1;


            $scope.resetLayout = function(){
                logicalModelSvc.resetTreeState($scope.treeData);
                $scope.treeData.forEach(function (item) {
                    console.log(item)
                    if (item.data && item.data.ed && item.data.ed.type) {
                        item.data.ed.type.forEach(function (typ) {
                            if (typ.code == 'BackboneElement') {
                                item.state.opened = true;
                                console.log('---> open')
                            }
                        })
                    }
                })
                drawTree();

            };
            $scope.collapseLayout = function(){
                logicalModelSvc.resetTreeState($scope.treeData);

                drawTree();

            };

            //collapseLayout

            //set the current node as the discriminator for all nodes with the sam path..
            $scope.setAsDiscriminator = function (treeNode) {
                logicalModelSvc.setAsDiscriminator(treeNode,$scope.treeData)
                drawTree()
                $scope.isDirty=true;
                makeSD();

            };

            $scope.showConceptMap = function(url) {

                logicalModelSvc.getConceptMapMappings(url).then(
                    function (vo) {
                        console.log(vo)

                        $uibModal.open({
                            templateUrl: 'modalTemplates/showCM.html',
                            size: 'lg',
                            controller: function($scope,cm) {
                                $scope.cm = cm

                            },
                            resolve : {
                                cm : function(){
                                    return vo
                                }
                            }
                        })

                    }, function (err) {
                        alert('Unable to locate or process the conceptmap: '+url)
                    }
                )
            }

            $scope.cloneNode = function(node){



                var newName = 'clone'

                //locate all the child nodes that will need to be added...
                var lst = []
                findChildNodes(lst,node.id)
                console.log(lst)

                //create the parent node for the copy...
                var parentNode = {
                    "id": 't' + new Date().getTime(),
                    "parent": node.parent,
                    "text": newName,
                    state: {opened: true}
                };
                parentNode.data = angular.copy(node.data);
                var ar = parentNode.data.path.split('.');
                ar[1] = newName
                parentNode.data.path = ar.join('.')
                var parentId = parentNode.id;
                var segmentLength = ar.length+1;      //

                //locate the insert point for the parent
                var insertPoint;
                $scope.treeData.forEach(function (node0,inx) {
                    if (node0.id == node.id) {
                        insertPoint = inx+1;    //insert after the node being cloned
                    }
                })


                //$scope.treeData.push(parentNode);
                $scope.treeData.splice(insertPoint,0,parentNode);


                var lastNode;
                //$scope.treeData.push(newNode)
                lst.forEach(function (node1,inx) {
                    var ar = node1.data.path.split('.');
                    ar[1] = newName
                    if (ar.length > segmentLength) {
                        //this is another step down the hierarchy. set the parent to the last node added...
                        segmentLength ++;
                        parentId = lastNode.id;
                    }



                    node1.parent = parentId;
                    node1.data.path = ar.join('.')
                    node1.id = node1.id+'-'+inx

                    lastNode = node1;
                    $scope.treeData.push(node1)


                })

                drawTree();

                function findChildNodes(lst,parentId) {
                    $scope.treeData.forEach(function(node){
                        if (node.parent == parentId) {
                            lst.push(angular.copy(node));
                            findChildNodes(lst,node.id)
                        }
                    })

                }
            };

            //generate a real FHIR profile from the Logical model
            $scope.generateFHIRProfile = function(){

                $uibModal.open({
                    templateUrl: 'modalTemplates/generateProfile.html',
                    size: 'lg',
                    controller: function($scope,logicalModelSvc,SaveDataToServer,modalService,logicalModel) {

                        $scope.canSave = false;
                        $scope.input = {}

                        logicalModelSvc.generateFHIRProfile(logicalModel).then(
                            function(profile) {
                                $scope.realProfile = profile;
                                $scope.canSave = true;
                                $scope.message = "Profile generated. Click 'Save' to save to the server"

                            },function(vo) {
                                $scope.message = "Unable to create profile.";
                                $scope.errors = vo.err

                            }
                        );


                        $scope.saveProfile = function() {
                            SaveDataToServer.saveResource($scope.realProfile,appConfigSvc.getCurrentConformanceServer().url).then(
                                function(data) {
                                    $scope.message = "Save successful."
                                    $scope.oo = data.data;
                                    delete $scope.oo.text;
                                },function (err) {
                                    $scope.message = "Save failed."
                                    $scope.oo = data.data;
                                    delete $scope.oo.text;
                                }
                            ).finally(function () {
                                $scope.canSave = false;  //hide the save button - it's confusing to have it here...
                            })
                        };

                        //$scope.generateProfile();

                    },  resolve : {
                        logicalModel : function(){


                            return $scope.SD
                        }}

                })


            };

            //view and change servers
            $scope.setServers = function(){
                $uibModal.open({
                    templateUrl: 'modalTemplates/setServers.html',
                    //size: 'lg',
                    controller: 'setServersCtrl'
                }).result.then(function () {


                    if (appConfigSvc.getCurrentConformanceServer().url !== appConfigSvc.getCurrentDataServer().url) {
                        modalService.showModal({}, {bodyText: "The Conformance and Data servers should really be the same. Odd things will occur otherwise."});
                    }


                    getPalette($scope.Practitioner);       //get the palette of logical models
                    $scope.conformanceServer = appConfigSvc.getCurrentConformanceServer();
                    loadAllModels();

                })
            }

            //merge the referenced model into this one at this point
            $scope.mergeModel = function(url){
                $scope.canSaveModel = false;        //to prevent the base model from being replaced... 
                var modelToMerge = logicalModelSvc.getModelFromBundle($scope.bundleModels,url);

                if (modelToMerge) {


                    if (! logicalModelSvc.mergeModel($scope.SD,$scope.selectedNode.id,modelToMerge)) {
                        modalService.showModal({}, {bodyText: "Sorry, can't merge this model. Please save, reload and try again"});
                    }


                    $scope.treeData = logicalModelSvc.createTreeArrayFromSD($scope.SD);  //create a new tree
                    drawTree();     //... and draw
                    createGraphOfProfile();     //and generate the mind map...


                }



            }

            //generate a sample document from this SD
            $scope.generateSample = function(){


                var treeObject = $('#lmTreeView').jstree().get_json();    //creates a hierarchical view of the resource

                
                $scope.sample = logicalModelSvc.generateSample(treeObject);
            };

            $scope.showCommentEntryDEP = function(comment,index) {


                return ((comment.levelKey == $scope.currentLevelKey) || comment.level==1);
            }

            $scope.showConversationDEP = function(levelKey) {
                $scope.currentLevelKey = levelKey;

            }

            $scope.saveComment = function() {
                //save the comment. For now, a single comment only...
                var QuestionnaireResponse;
                if ($scope.taskOutputs.length == 0) {
                    //create a new QuestionnaireResponse and add it to the task...
                    var type = {text: 'QuestionnaireResponse'}
                    QuestionnaireResponse = {resourceType: 'QuestionnaireResponse', item: [],status:'completed'};
                    QuestionnaireResponse.item.push({linkId:'general', answer:[{valueString: $scope.input.mdComment}]}   );
                    QuestionnaireResponse.id = 't' + new Date().getTime();
                    QuestionnaireResponse.authored = moment().format();

                    $scope.showWaiting = true;
                    SaveDataToServer.addOutputToTask($scope.commentTask,QuestionnaireResponse,type).then(
                        function(){
                            modalService.showModal({}, {bodyText: "Comment saved"});
                            getAllComments();
                           // alert('Comment saved')
                        },function(err){
                            alert('error adding QuestionnaireResponse: '+angular.toJson(err))
                        }
                    ).finally(function(){
                        $scope.showWaiting = false;
                    })


                } else {
                    //update an existing one...
                    QuestionnaireResponse = $scope.taskOutputs[0];      //these are only QuestionnaireResponse resources right now...
                    QuestionnaireResponse.item = QuestionnaireResponse.item || [];    //should be unnessecary...
                    QuestionnaireResponse.authored = moment().format();
                    QuestionnaireResponse.item[0] = {linkId:'general', answer:[{valueString: $scope.input.mdComment}]};
                    $scope.showWaiting = true;
                    SaveDataToServer.saveResource(QuestionnaireResponse).then(
                        function(){
                            modalService.showModal({}, {bodyText: "Comment updated"});
                            getAllComments();
                        },
                        function(err) {
                            alert('error updating QuestionnaireResponse: '+angular.toJson(err))
                        }
                    ).finally(function(){
                        $scope.showWaiting = false;
                    })
                }






                
            };

            $scope.saveCommentDEP = function() {
                //save the comment. For now, a single comment only...
                var Communication;
                if ($scope.taskOutputs.length == 0) {
                    //create a new communication and add it to the task...
                    var type = {text: 'Communication'}
                    Communication = {resourceType: 'Communication', payload: []};
                    Communication.payload.push({contentString: $scope.input.mdComment});
                    Communication.id = 't' + new Date().getTime();
                    Communication.sent = moment().format();

                    $scope.showWaiting = true;
                    SaveDataToServer.addOutputToTask($scope.commentTask,Communication,type).then(
                        function(){
                            modalService.showModal({}, {bodyText: "Comment saved"});
                            getAllComments();
                            // alert('Comment saved')
                        },function(err){
                            alert('error adding Communication: '+angular.toJson(err))
                        }
                    ).finally(function(){
                        $scope.showWaiting = false;
                    })


                } else {
                    //update an existing one...
                    Communication = $scope.taskOutputs[0];      //these are only Communication resources right now...
                    Communication.payload = Communication.payload || [];    //should be unnessecary...
                    Communication.payload[0] = ({contentString: $scope.input.mdComment});
                    $scope.showWaiting = true;
                    SaveDataToServer.saveResource(Communication).then(
                        function(){
                            modalService.showModal({}, {bodyText: "Comment updated"});
                            getAllComments();
                        },
                        function(err) {
                            alert('error updating Communication: '+angular.toJson(err))
                        }
                    ).finally(function(){
                        $scope.showWaiting = false;
                    })
                }







            };

            $scope.updateDoc = function(){
                logicalModelSvc.generateDoc($scope.treeData).then(
                    function(doc) {
                        $scope.mdDoc = doc;
                    }
                )

            };

            $scope.explodeReference = function(node){
                //expand a resource rather than a datatype. The node passed in is the 'reference' child, we need the 'parent'
                var path = node.data.path.split('.');
                path.pop();
                var parent = findNodeWithPath(path.join('.')); //note this is the node for the tree view, not the graph

                if (parent && parent.data && parent.data.type) {
                    //now find the resource type that is being expanded. For now, use the first one only..
                   // var resourceType;
                    for (var i=0; i< parent.data.type.length; i++) {
                        var typ = parent.data.type[i];
                        if (typ.targetProfile) {


                            //set the resource type as a mapping. need to update both node and treeData (a scoping issue no doubt)..
                            node.data.mappingFromED = [{identity:'fhir',map: typ.targetProfile}]
                            $scope.treeData.forEach(function(item){
                                if (item.data.path == node.data.path) {
                                    item.data.mappingFromED = [{identity:'fhir',map: typ.targetProfile}]
                                }
                            })


                            var ar = typ.targetProfile.split('/');
                            parent.text += " ("+ ar[ar.length-1] + ")"
                            logicalModelSvc.explodeResource($scope.treeData,$scope.selectedNode,typ.targetProfile).then(
                                function() {
                                    drawTree();
                                    $scope.isDirty = true;
                                    makeSD();
                                },
                                function(err){
                                    alert(angular.toJson(err))
                                }

                            );
                            break;
                        }
                    }

                }


                //console.log(parent);
            }

            $scope.explodeDT = function(dt) {


                logicalModelSvc.explodeDataType($scope.treeData,$scope.selectedNode,dt).then(
                    function() {
                        drawTree();
                        $scope.isDirty = true;
                        makeSD();
                    },
                    function(err){
                        alert(angular.toJson(err))
                    }


                )

            }
            
            //if the selected node changes, look to see if we can expand any binding...
            $scope.$watch(
                function() {return $scope.selectedNode},
                function() {
                    if ($scope.selectedNode) {

                        $scope.discriminatorReq = logicalModelSvc.isDiscriminatorRequired($scope.selectedNode,$scope.treeData)


                        delete $scope.valueSetOptions;

                        logicalModelSvc.getOptionsFromValueSet($scope.selectedNode.data).then(
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

                });


            //copy the files referenced by the current model to another server
            $scope.copyFilesDEP = function() {
                $uibModal.open({
                    backdrop: 'static',      //means can't close by clicking on the backdrop.
                    keyboard: false,       //same as above.
                    templateUrl: 'modalTemplates/fileCopy.html',
                    controller: 'fileCopyCtrl',
                    resolve : {
                        
                        fileList : function(){
                            //var lst = [];
                            var vo = {files : []}
                            vo.server = appConfigSvc.getCurrentConformanceServer().url;

                            $scope.uniqueModelsList.forEach(function(item) {
                                vo.files.push({url:item.url})
                            })
                        
                            return vo
                        }}
                })
            }


            //load the indicated model...
            $scope.loadReferencedModel = function(url){
                //find the indicated model (based on the url

                $scope.history = $scope.history || []
                $scope.history.push({resource:$scope.currentType})    //save the current model

                for (var i=0; i<$scope.bundleModels.entry.length; i++) {
                    var resource = $scope.bundleModels.entry[i].resource;
                    if (resource.url == url) {
                        selectEntry({resource:resource});



                        break;
                    }
                }
            };

            //re-load the previous mmodel
            $scope.goBack = function() {
                var entry = $scope.history.pop();
                if (entry) {
                    selectEntry(entry);
                }
            }

            
            $scope.showLMSelector = function(){
                $scope.leftPaneClass = "col-sm-2 col-md-2"
                $scope.midPaneClass = "col-md-5 col-sm-5"
                $scope.rightPaneClass = "col-md-5 col-sm-5";
                $scope.LMSelectorVisible = true;
            }

            
            $scope.hideLMSelector = function(){
                $scope.leftPaneClass = "hidden"
                $scope.midPaneClass = "col-md-7 col-sm-7"
                $scope.rightPaneClass = "col-md-5 col-sm-5";
                $scope.LMSelectorVisible = false;
            }


            //$scope.hideDetail - function

            $scope.showLMSelector()


            //check for commands in the url - specifically a valueset url to edit or view...
            var params = $location.search();
            if (params) {
                $scope.startupParams = params;
                if (params.vs) {
                    $scope.initialLM = params.vs;   //the param is names vs - as the same routine in the IG calls valuesets (&others)
                    //delete $scope.state;        //the defualt value is 'find' whicg displays the find dialog...

                    //don't show the list of models if one was passed in...
                    $scope.hideLMSelector();

                  

                }
                if (params.ts) {
                    $scope.initialTerminologyServer = params.ts;
                }
                if (params.ig) {
                    //if an implementation guide is passed to the app (which it will if called from the IG app)
                    //then save the url and load the IG into the service...
                    $scope.implementationGuide = params.ig;
                    igSvc.loadIg($scope.implementationGuide);
                }
            }


            //-----------  login stuff....
            
            //called whenever the auth state changes - eg login/out, initial load, create user etc.
            firebase.auth().onAuthStateChanged(function(user) {
                delete $scope.input.mdComment;

                if (user) {
                    $rootScope.userProfile = $firebaseObject(firebase.database().ref().child("users").child(user.uid));
                    logicalModelSvc.setCurrentUser(user);
                    securitySvc.setCurrentUser(user);


                    //return the practitioner resource that corresponds to the current user (the service will create if absent)
                    GetDataFromServer.getPractitionerByLogin(user).then(
                        function(practitioner){

                            $scope.Practitioner = practitioner;

                            checkForComments($scope.currentType);     //get comments for this user against this model...
                            getPalette(practitioner);       //get the palette of logical models


                        },function (err) {
                            //swallow errorsalert(err)
                        }
                    );

                    delete $scope.showNotLoggedIn;


                } else {
                    console.log('no user')
                    logicalModelSvc.setCurrentUser(null);
                    $scope.showNotLoggedIn = true;
                    delete $scope.Practitioner;
                    delete $scope.taskOutputs;
                    delete $scope.commentTask;
                    // No user is signed in.
                }
            });

            //retrieve the list of models on the users current palette...
            function getPalette(practitioner)  {
                delete $scope.palette;
                GetDataFromServer.getListForPractitioner(practitioner,$scope.code.lmPalette).then(
                    function(list) {

                        if (list) {

                            $scope.lmPalette = list;

                            checkInPalette();   //if the user logs in while a model is selected...

                        }
                    }, function(err) {

                    }
                )
            }
            
            //remove the current model from the palette
            $scope.removeFromPalette = function() {
                if ($scope.lmPalette) {
                    var pos = -1;
                    $scope.lmPalette.entry.forEach(function(entry,inx){
                        if (entry.item && entry.item.reference == 'StructureDefinition/'+$scope.currentType.id) {
                            pos = inx;
                        }
                    })
                    
                    if (pos > -1) {
                        $scope.lmPalette.entry.splice(pos,1)
                        //... and save...
                        SaveDataToServer.saveResource($scope.lmPalette).then(
                            function(){
                                $scope.isInPalette = false;
                            },
                            function(err){
                                alert("error updating List " + angular.toJson(err))
                            }

                        )
                    }
                }
            };

            $scope.selectFromPalette = function(item) {



                if ($scope.isDirty) {
                    var modalOptions = {
                        closeButtonText: "No, don't lose changes",
                        actionButtonText: 'Yes, select this model, abandoning changes to the old',
                        headerText: 'Load model',
                        bodyText: 'You have updated this model. Selecting another one will lose those changes.'
                    };

                    modalService.showModal({}, modalOptions).then(
                        function (result) {
                            selectFromPalette(item)
                        }
                    );
                } else {
                    selectFromPalette(item)
                }


                function selectFromPalette(item) {
                    var url = appConfigSvc.getCurrentConformanceServer().url+item.reference;
                    $scope.showWaiting = true;
                    GetDataFromServer.adHocFHIRQuery(url).then(
                        function(data){

                            selectEntry({resource:data.data})
                        }, function(err) {
                            alert('error getting model '+angular.toJson(err));
                        }
                    ).finally(
                        function(){
                            $scope.showWaiting = false;
                        }
                    );

                }

            };

            //add the current model to the current users palette of models
            $scope.addToPalette = function() {
                if ($scope.Practitioner) {
                    //create the palette if it doesn't exist
                    if (!$scope.lmPalette) {
                        $scope.lmPalette = {resourceType:'List',status:'current',mode:'working',entry:[]}

                        $scope.lmPalette.code =
                        {coding:[{system:appConfigSvc.config().standardSystem.listTypes,code:$scope.code.lmPalette}]}

                        $scope.lmPalette.source = {reference:'Practitioner/'+$scope.Practitioner.id};

                    }

                    //add the current model to it
                    var entry = {item : {reference: 'StructureDefinition/'+$scope.currentType.id,display:$scope.currentType.id}}
                    $scope.lmPalette.entry.push(entry);

                    //... and save...
                    SaveDataToServer.saveResource($scope.lmPalette).then(
                        function(){
                            $scope.isInPalette = true;
                        },
                        function(err){
                            alert("error saving List " + angular.toJson(err))
                        }

                    )

                }




            }



            //if a shortcut has been used there will be a hash so load that
            var hash = $location.hash();
            if (hash) {
                var sc = $firebaseObject(firebase.database().ref().child("shortCut").child(hash));
                sc.$loaded().then(
                    function(){


                        $scope.loadedFromBookmark = true;

                        //set the conformance server to the one in the bookmark
                        var conformanceServer =  sc.config.conformanceServer;
                        appConfigSvc.setServerType('conformance',conformanceServer.url);
                        appConfigSvc.setServerType('data',conformanceServer.url);       //set the data server to the same as the conformance for the comments

                        var id = sc.config.model.id;    //the id of the model on this server
                        //get the model from the server...
                        var url = conformanceServer.url + 'StructureDefinition/'+id;
                        $scope.showWaiting = true;
                        GetDataFromServer.adHocFHIRQuery(url).then(
                            function(data){
                                var model = data.data;
                                $scope.hideLMSelector();            //only want to see this model...
                                selectEntry({resource:model});       //select the model
                            },
                            function(){
                                modalService.showModal({}, {bodyText: "The model with the id '"+id + "' is not on the "+conformanceServer.name + " server"})
                            }
                        ).finally(function(){
                            $scope.showWaiting = false;
                        })
                        
                    }
                )
            } else {
                if ($scope.conformanceServer.url !== appConfigSvc.getCurrentDataServer().url) {
                    var msg = 'The Conformance and Data servers must be the same for the Comments to work correctly.\n';
                    msg += 'Please reset them and re-load the page if you want comments.'
                    modalService.showModal({}, {bodyText: msg})

                }
            }


            $scope.createTask = function(){
                //create a new task for this practitioner against this model.
                SaveDataToServer.addTaskForPractitioner($scope.Practitioner,{focus:$scope.currentType}).then(
                    function(task){
                        $scope.commentTask = task
                        $scope.taskOutputs = [];

                    },
                    function(err) {
                        alert(angular.toJson(err))
                    }
                )
            };



            $scope.generateShortCut = function() {
                var hash = Utilities.generateHash();
                var shortCut = $window.location.href+"#"+hash

                var sc = $firebaseObject(firebase.database().ref().child("shortCut").child(hash));
                sc.modelId = $scope.currentType.id;     //this should make it possible to query below...
                sc.config = {conformanceServer:appConfigSvc.getCurrentConformanceServer()};
                sc.config.model = {id:$scope.currentType.id}
                sc.shortCut = shortCut;     //the full shortcut
                sc.$save().then(
                    function(){
                        $scope.treeData.shortCut = sc;
                        modalService.showModal({}, {bodyText: "The shortcut  " +  shortCut + "  has been generated for this model"})

                    }
                )
            };




            //find a shortcut for a model. Note there may be more that one (as could have the same id on different servers
            function findShortCutForModel(id) {
                var deferred = $q.defer();
                //var seriesRef = new Firebase(fbUrl+'/series');
                var scCollection = $firebaseArray(firebase.database().ref().child("shortCut"));

                //seriesCollection.$ref().orderByChild("config.model.id").equalTo('ADR').once("value", function(dataSnapshot){
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

                        $scope.series = series;
                    } else {
                        deferred.reject()
                    }

                })
                return deferred.promise;

            }

            findShortCutForModel('OhEncounter');


            $scope.login=function(){
                $uibModal.open({
                    backdrop: 'static',      //means can't close by clicking on the backdrop.
                    keyboard: false,       //same as above.
                    templateUrl: 'modalTemplates/login.html',
                    controller: 'loginCtrl'
                })
            };

            $scope.logout=function(){
                firebase.auth().signOut().then(function() {
                    delete $rootScope.userProfile;
                    modalService.showModal({}, {bodyText: 'You have been logged out of clinFHIR'})

                }, function(error) {
                    modalService.showModal({}, {bodyText: 'Sorry, there was an error lgging out - please try again'})
                });

            };

            $scope.firebase = firebase;

            //------------------------------------------

            $scope.viewReferencedModel = function(modelUrl) {
                $uibModal.open({
                    templateUrl: 'modalTemplates/viewLogicalModel.html',
                    size: 'lg',
                    controller: function ($scope,allModels,modelUrl) {

                        
                        //locate the specific model from the list of models. This won't scale of course...
                        for (var i=0; i < allModels.entry.length ; i++) {
                            if (allModels.entry[i].resource.url == modelUrl) {
                                $scope.model = allModels.entry[i].resource;
                            }
                        }
                        
                        
                    },
                    resolve : {
                        allModels: function () {          //the default config
                            return $scope.bundleModels;
                        },
                        modelUrl : function(){
                            return modelUrl
                        }
                }})
            };


            //load all the logical models created by clinFHIR
            loadAllModels = function() {

                var url=$scope.conformanceServer.url + "StructureDefinition?kind=logical&identifier=http://clinfhir.com|author";

                //var url="http://fhir3.healthintersections.com.au/open/StructureDefinition?kind=logical&identifier=http://clinfhir.com|author";
                GetDataFromServer.adHocFHIRQueryFollowingPaging(url).then(
                    function(data) {
                        $scope.bundleModels = data.data
                        $scope.bundleModels.entry = $scope.bundleModels.entry || [];    //in case there are no models

                        $scope.bundleModels.entry.sort(function(ent1,ent2){
                            if (ent1.resource.id > ent2.resource.id) {
                                return 1
                            } else {
                                return -1
                            }
                        })

                        //save all the models for the search facility
                        $scope.originalAllModels = angular.copy($scope.bundleModels);

                    },
                    function(err){
                        alert('Error loading models: ' + angular.toJson(err));
                    }
                )
            };

            //used to provide the filtering capability...
            $scope.filterModelList = function(filter) {
                filter = filter.toLowerCase();
                $scope.bundleModels = {entry:[]};   //a mnimal bundle
                $scope.originalAllModels.entry.forEach(function(entry){
                    if (entry.resource.id.toLowerCase().indexOf(filter) > -1) {
                        $scope.bundleModels.entry.push(entry);
                    }
                })
            };


            if (!$scope.initialLM) {
               // $scope.hideLMSelector();
                loadAllModels();
            } else {
                GetDataFromServer.findConformanceResourceByUri($scope.initialLM).then(
                    function(resource){
                        $scope.selectModel({resource:resource})
                    },
                    function(err) {
                        alert("error loading "+$scope.initialLM + angular.toJson(err))
                    }
                )
            }



            //functions and prperties to enable the valueset viewer
            $scope.showVSBrowserDialog = {};
            $scope.showVSBrowser = function(vs) {
                $scope.showVSBrowserDialog.open(vs);        //the open method defined in the directive...
            };
            $scope.viewVS = function(uri) {
                //var url = appConfigSvc

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

            
            //re-draw the graph setting the indicated path as the parent...
            $scope.setParentInGraph = function(selectedNode) {

                var path = selectedNode.data.path;
                createGraphOfProfile({parentPath:path})
            };

            //reset the graph to have the parent as the root
            $scope.resetGraph = function(){
                createGraphOfProfile();
            }
            
            //called when the graph tab is selected or de-selected
            $scope.graphTabSelected = function(selected) {

                $scope.input.graphTabIsSelected = selected;
            }

            var createGraphOfProfile = function(options) {
                delete $scope.graphData;
                var graphProfile = angular.copy($scope.SD )

                resourceCreatorSvc.createGraphOfProfile(graphProfile,options).then(
                    function(graphData) {
                        $scope.graphData = graphData;

                        var container = document.getElementById('mmLogicalModel');
                        var options = {

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
                                    nodeSpacing : 35,
                                    sortMethod:'directed',
                                    parentCentralization : false
                                }
                            },
                            physics:false
                        };

                        $scope.profileNetwork = new vis.Network(container, graphData, options);

                        $scope.profileNetwork.on("click", function (obj) {
                            var nodeId = obj.nodes[0];  //get the first node
                            var node = graphData.nodes.get(nodeId);
                            var pathOfSelectedNode = node.ed.path; //node.ed.base.path not working with merged...
                            $scope.selectedNode = findNodeWithPath(pathOfSelectedNode); //note this is the node for the tree view, not the graph

                            $scope.$digest();

                        });
                    }
                );
            };


            //generate the graph. allows tge graph to be manipulated (eg nodes hidden) after creation...
            var drawGraphFromGraphDataDEP = function(graphData,options) {

                var container = document.getElementById('mmLogicalModel');
                var options = {

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
                            nodeSpacing : 35,
                            sortMethod:'directed'
                        }
                    },
                    physics:false
                };

                $scope.profileNetwork = new vis.Network(container, graphData, options);

                $scope.profileNetwork.on("click", function (obj) {


                    var nodeId = obj.nodes[0];  //get the first node


                    var node = graphData.nodes.get(nodeId);


                    var pathOfSelectedNode = node.ed.path; //node.ed.base.path not working with merged...

                    //var pathOfSelectedNode = node.ed.base.path;
                    $scope.selectedNode = findNodeWithPath(pathOfSelectedNode); //note this is the node for the tree view, not the graph

                    $scope.$digest();


                });


            }

            //this is the event when the profileGraph tab is chosen. Should really move this to a separate controller...
            $scope.redrawProfileGraph = function() {


                $scope.input.graphTabIsSelected = true;

                $timeout(function(){
                    $scope.profileNetwork.fit();

                },1000            )


            };

            $scope.selectNodeFromTable = function(path) {

                //to allow the details of a selected node in the table to be displayed...
                $scope.selectedNode = findNodeWithPath(path);

            };

            //revert to a previous version
            $scope.revert = function() {
                var modalOptions = {
                    closeButtonText: "No, don't change",
                    actionButtonText: 'Yes, please go back to this one',
                    headerText: 'Revert to previous version',
                    bodyText: 'Are you sure you wish to make this version the current one'
                };

                modalService.showModal({}, modalOptions).then(
                    function (result) {
                        $scope.save();

                    }
                );
            };

            $scope.editModel = function(){
                editModel($scope.SD);
            };

            $scope.newModel = function(){
                
                editModel();
            };

            //edit the model description. Create a new one if 'header' is null...
            var editModel = function(SD){
                $scope.canSaveModel = true;     //allow edits to the model to be saved
                $uibModal.open({
                    templateUrl: 'modalTemplates/newLogicalModel.html',
                        size: 'lg',
                        controller: function($scope,appConfigSvc,Utilities,GetDataFromServer,
                                             modalService,RenderProfileSvc,SD,allModels) {
                            $scope.input = {};
                            $scope.isNew = true;
                            $scope.allModels = allModels;


                            //the list of all the base resource types in the spec...
                            RenderProfileSvc.getAllStandardResourceTypes().then(
                                function(data){
                                    $scope.allResourceTypes = data;
                            });



                            //note that a StructureDefinition is passed in when editing...
                            if (SD) {
                                $scope.SD = SD;
                                $scope.input.name = SD.name;
                                $scope.input.purpose = SD.purpose;

                                //get the baseType (if any)
                                var ext = Utilities.getSingleExtensionValue(SD, appConfigSvc.config().standardExtensionUrl.baseTypeForModel)
                                if (ext && ext.valueString) {
                                    $scope.baseType = ext.valueString
                                }
                               
                                $scope.input.title = SD.title || SD.display;    //stu2 vvs stu3
                                $scope.input.publisher = SD.publisher;
                                $scope.canSave = true;
                                $scope.isNew = false;

                                if (SD.mapping) {
                                    $scope.input.mapping = SD.mapping[0].comments;
                                }

                                if (SD.useContext) {
                                    var ucCode = SD.useContext[0].valueCodeableConcept.code;
                                    $scope.modelTypes.forEach(function(item){
                                        if (item.code == ucCode) {
                                            input.type = item;
                                        }
                                    });
                                    //
                                }
                            } else {
                                $scope.input.modelType = 'multiple'
                                
                            }

                            $scope.selectBaseType = function() {
                                $scope.input.createElementsFromBase = true;     //default to copy elements across
                            }

                            $scope.checkName = function() {
                                if ($scope.input.name) {
                                    var name = $scope.input.name;
                                    if (name.indexOf(' ') != -1) {
                                        modalService.showModal({},{bodyText:"The name cannot contain spaces"})
                                        $scope.canSave = false;
                                        return;
                                    }
                                    $scope.input.name = name.charAt(0).toUpperCase()+name.substr(1);
                                }

                            };

                            $scope.conformanceServer = appConfigSvc.getCurrentConformanceServer();
                            
                            $scope.checkModelExists = function(name) {
                                if (name && name.indexOf(' ')>-1) {
                                    modalService.showModal({},{bodyText:"The name cannot contain spaces"})
                                    return;
                                }

                                var url = $scope.conformanceServer.url + "StructureDefinition/"+name;
                                $scope.showWaiting = true;
                                $scope.canSave = false;
                                GetDataFromServer.adHocFHIRQuery(url).then(
                                    function(data){

                                        if (Utilities.isAuthoredByClinFhir(data.data)) {
                                            modalService.showModal({},{bodyText:"There's already a model with this name. Please select another name."})
                                        } else {
                                            modalService.showModal({},{bodyText:"Sorry, there's already a model with this name"})
                                        }

                                    },function(err){

                                        //as long as the status is 404 or 410, it's save to create a new one...
                                        if (err.status == 404 || err.status == 410) {
                                            $scope.canSave = true;

                                        } else {
                                            var config = {bodyText:'Sorry, there was an unknown error: '+angular.toJson(err,true)};
                                            modalService.showModal({}, config)

                                        }
                                    }).finally(function(){
                                    $scope.showWaiting = false;
                                })
                            };

                            $scope.save = function(){
                                var vo = {};
                                vo.modelType = $scope.input.modelType;
                                vo.name = $scope.input.name;
                                vo.title = $scope.input.title;
                                vo.publisher = $scope.input.publisher;
                                vo.purpose = $scope.input.purpose || $scope.input.name ;
                                vo.SD = $scope.SD;

                                if ($scope.input.baseTypeSelected) {
                                    vo.baseType = $scope.input.baseTypeSelected.name;       //if a base type was selected
                                } else if ($scope.baseType){
                                    //set when editing
                                    vo.baseType = $scope.baseType;
                                }

                                vo.mapping = $scope.input.mapping;
                                vo.createElementsFromBase = $scope.input.createElementsFromBase;
                                //vo.useV2ForCreateElementsFromBase = $scope.input.useV2ForCreateElementsFromBase;


                                
                                
                                if ($scope.input.clone) {
                                    //creating another copy


                                    vo.clone = $scope.input.clone.resource;
                                }

                                $scope.$close(vo);
                            }
                        },
                        resolve : {
                            SD: function () {          //the default config
                                return SD;
                            },
                            allModels : function(){
                                return $scope.bundleModels;
                            }
                        }

                    }).result.then(
                        function(result) {
                            $scope.isDirty=true;

                            if (result.SD) {
                                //this is an edit
                                delete result.SD;
                                $scope.treeData[0].data.header = result;
                                makeSD();

                            } else {
                                //this is a new model

                                $scope.rootName = result.name;      //this is the 'type' of the logical model - like 'Condition'

                                var rootNode = { "id" : $scope.rootName, "parent" : "#", "text" : result.name,state:{opened:true},
                                    data : {name:"root", path:$scope.rootName,isRoot:true,min:1,max:'1',baseType:result.baseType} };

                                rootNode.data.header = result;      //header based data. keep it in the first node...
                                $scope.treeData =  [rootNode]
                                $scope.isDirty = true;      //as this has not been saved;
                                $scope.isInPalette = false;



                                if (result.clone) {
                                    //if the user specified to copy from another model

                                    delete $scope.modelHistory;
                                    delete $scope.selectedNode;

                                    $scope.currentType = logicalModelSvc.clone(result.clone,result.name);


                                    $scope.isDirty = true;  //as the model has noy been saved...
                                    $scope.treeData = logicalModelSvc.createTreeArrayFromSD($scope.currentType)

                                    $scope.rootName = $scope.treeData[0].id;        //the id of the first element is the 'type' of the logical model
                                    drawTree();
                                    makeSD();

                                } else if (result.baseType && result.createElementsFromBase) {
                                    //if the user specified a base type, then pre-populate a model from that base




                                    logicalModelSvc.createFromBaseType($scope.treeData,result.baseType,
                                        $scope.rootName).then(
                                        function(){
                                            drawTree();
                                            makeSD();
                                            //add it to the list so we can see it
                                            $scope.bundleModels.entry.push({resource:$scope.SD})
                                            $scope.currentType = angular.copy($scope.SD);     //keep a copy so that we can return to it from the history..
                                        },
                                        function(err) {
                                            alert(angular.toJson(err))
                                        }
                                    )
                                } else {
                                    drawTree();
                                    makeSD();
                                    //add it to the list so we can see it
                                    $scope.bundleModels.entry.push({resource:$scope.SD})
                                    $scope.currentType = angular.copy($scope.SD);     //keep a copy so that we can return to it from the history..
                                }
                                makeSD();
                            }

                        })
                
            };

            $scope.dataTypes = resourceCreatorSvc.getDataTypesForProfileCreator();
            $scope.dataTypes.push({code: 'BackboneElement',description: 'BackboneElement'});
            //$scope.dataTypes.push({code: 'Extension',description: 'Extension'});

/* hide for the moment...
            //add the v2 datatypes here. todo - perhaps there's a 'model source' property that selects from different data types?
            $scope.dataTypes.push({code: 'CE',description: 'v2 CE Coded Entity'});
            $scope.dataTypes.push({code: 'CM',description: 'v2 CM Composite'});
            $scope.dataTypes.push({code: 'CWE',description: 'v2 CWE Coded With Exceptions'});
            $scope.dataTypes.push({code: 'CX',description: 'v2 CX Extended CompositeId'});
            $scope.dataTypes.push({code: 'EI',description: 'v2 EI Entity Identifier'});
            $scope.dataTypes.push({code: 'HD',description: 'v2 HD Hierarchic Descriptor'});
            $scope.dataTypes.push({code: 'IS',description: 'v2 ID Coded, HL7 Defined'});
            $scope.dataTypes.push({code: 'IS',description: 'v2 IS Coded, User Defined'});
            $scope.dataTypes.push({code: 'PL',description: 'v2 PL Person Location'});
            $scope.dataTypes.push({code: 'SI',description: 'v2 SI Sequence Id'});
            $scope.dataTypes.push({code: 'ST',description: 'v2 ST String'});
            $scope.dataTypes.push({code: 'TS',description: 'v2 TS Timestamp'});
            $scope.dataTypes.push({code: 'XAD',description: 'v2 XAD Extended Address'});
            $scope.dataTypes.push({code: 'XCN',description: 'v2 XCN Extended name + ID for Persons'});
            $scope.dataTypes.push({code: 'XPN',description: 'v2 XPN Extended Person Name'});
            $scope.dataTypes.push({code: 'XTN',description: 'v2 XTN Extended Telecommunications Number'});


*/


            $scope.saveModel = function() {
                
                var url = $scope.conformanceServer.url + "StructureDefinition/" + $scope.SD.id;
                $scope.showWaiting = true;
                
                var SDToSave = angular.copy($scope.SD);


                SDToSave.snapshot.element.forEach(function (element) {
                    //remove invalid property
                    if (element.type){
                        element.type.forEach(function (typ) {
                            delete typ.isComplexDT;
                        })

                    }

                });



                
                //this is a hack as only grahames server is on the latest (post baltimore) version of stu3.
                //it can be removed when the others (ie hapi) are confrmant also...
               /* if (url.indexOf('tersections') == -1) {
                    SDToSave.requirements = SDToSave.purpose;
                    SDToSave.display = SDToSave.title;
                    delete SDToSave.purpose;
                    delete SDToSave.title

                }

                */
                
                $http.put(url,SDToSave).then(
                    function(data) {

                        if (!$scope.initialLM) {
                            //if there wasn't a model passed in, re-load the list
                            loadAllModels();
                        }

                        var res = data.data;
                        var oo;
                        if (res.resourceType == 'OperationOutcome') {
                            oo = res;
                            delete oo.text;
                        }

                        $scope.isDirty = false;
                        loadHistory($scope.SD.id);      //that way we get the metadata added by the server...
                        modalService.showModal({},{bodyText:"The model has been updated. You may continue editing."})
                    },
                    function(err) {

                        $scope.error = err;
                        modalService.showModal({},{bodyText:"Sorry, there was an error saving the model. View the 'Error' tab above for details."})
                    }
                ).finally(function(){
                    $scope.showWaiting = false;
                })
            };

            //select a model from the list of models
            $scope.selectModel = function(entry,index) {
                if ($scope.isDirty) {
                    var modalOptions = {
                        closeButtonText: "No, don't lose changes",
                        actionButtonText: 'Yes, select this model, abandoning changes to the old',
                        headerText: 'Load model',
                        bodyText: 'You have updated this model. Selecting another one will lose those changes.'
                    };

                    modalService.showModal({}, modalOptions).then(
                        function (result) {
                            selectEntry(entry)
                        }
                    );



                } else {
                    selectEntry(entry)
                }



            };

            //select a model - whether from the 'all' list or the palette
            function selectEntry(entry) {
                delete $scope.modelHistory;
                delete $scope.selectedNode;
                delete $scope.commentTask;      //the task to comment on this model...
                delete $scope.input.mdComment;  //the comment
                delete $scope.taskOutputs;      //the outputs of the task (Communication resource currently)
                $scope.canSaveModel = true;     //allow edits to the model to be saved

                $scope.isDirty = false;
                $scope.treeData = logicalModelSvc.createTreeArrayFromSD(entry.resource)
                $scope.relativeMappings = logicalModelSvc.getRelativeMappings($scope.treeData); //items with both v2 & fhir mappings


                logicalModelSvc.openTopLevelOnly($scope.treeData);



                var baseType = $scope.treeData[0].data.header.baseType

                //find all the mapping identities that have been used..
                setAllMappings();

                /*
                $scope.allMappingIdentities = [];
                $scope.allMappings = [];        //all of the mappings
                $scope.treeData.forEach(function (item) {
                    if (item.data.mappingFromED && item.data.mappingFromED.length > 0) {
                        item.data.mappingFromED.forEach(function (map) {

                            //$scope.allMappings.push({identity:map.identity,map:map.map, name:item.data.name})
                            var ar = item.data.path.split('.');
                            ar.splice(0,1)  //strip off the f
                            $scope.allMappings.push({identity:map.identity,map:map.map, path:item.data.path, name:ar.join('.')})

                            if ($scope.allMappingIdentities.indexOf(map.identity)==-1){
                                $scope.allMappingIdentities.push(map.identity)
                            }
                        })
                    }
                });

                $scope.allMappings.sort(function(a,b){

                    if (a.map > b.map) {
                        return 1
                    } else {
                        return -1
                    }
                })

                */



                findShortCutForModel(entry.resource.id).then(
                    function(vo) {
                        $scope.treeData.shortCut = vo;  //safe to put here as it will be ignored...
                    }
                )

               // checkDifferences(entry.resource)

                /* WARNING todo - this calls teh 'makeTree' function in the service and mucks things up.. (particularly the momments)
                //var vo = logicalModelSvc.makeReferencedMapsModel(entry.resource,$scope.bundleModels);   //todo - may not be the right place...

                //so that we can draw a table with the references in it...
                $scope.modelReferences = vo.references;
                $scope.uniqueModelsList = vo.lstNodes;
                
                

                var allNodesObj = vo.nodes;

                var container = document.getElementById('refLogicalModel');

                var options = {
                    physics: {
                        enabled: true,
                        barnesHut: {
                            gravitationalConstant: -10000,
                        }
                    }
                };

                $scope.refNetwork = new vis.Network(container, vo.graphData, options);
                $scope.refNetwork.on("click", function (obj) {
                    
                    //this is selecting a model

                    if ($scope.isDirty) {
                        modalService.showModal({},{bodyText:"There are unsaved changes to the current model."})
                    } else {
                        var nodeId = obj.nodes[0];  //get the first node

                        var node = allNodesObj[nodeId];

                        $scope.history = $scope.history || []
                        $scope.history.push({resource:$scope.currentType})    //save the current model


                        var model = logicalModelSvc.getModelFromBundle($scope.bundleModels,node.url); //the model referenceed by this node
                        //temp - todo - do I really wantto do this?  selectEntry({resource:model});


                        $scope.$digest();
                    }


                    //selectedNetworkElement

                });


                 */
                $scope.rootName = $scope.treeData[0].id;        //the id of the first element is the 'type' of the logical model
                drawTree();


                makeSD();
                $scope.currentType = angular.copy($scope.SD);     //keep a copy so that we can return to it from the history..
                loadHistory($scope.rootName);
                /*
                DON'T DELETE. - for now, don't try to find models...
                checkForComments(entry.resource);
                getAllComments();
                */


                checkInPalette();



            }


            function setAllMappings() {
                //find all the mapping identities that have been used..
                $scope.allMappingIdentities = [];
                $scope.allMappings = [];        //all of the mappings
                $scope.treeData.forEach(function (item) {
                    if (item.data.mappingFromED && item.data.mappingFromED.length > 0) {
                        item.data.mappingFromED.forEach(function (map) {

                            //$scope.allMappings.push({identity:map.identity,map:map.map, name:item.data.name})
                            var ar = item.data.path.split('.');
                            ar.splice(0,1)  //strip off the f
                            $scope.allMappings.push({identity:map.identity,map:map.map, path:item.data.path, name:ar.join('.')})

                            if ($scope.allMappingIdentities.indexOf(map.identity)==-1){
                                $scope.allMappingIdentities.push(map.identity)
                            }
                        })
                    }
                });

                $scope.allMappings.sort(function(a,b){

                    if (a.map > b.map) {
                        return 1
                    } else {
                        return -1
                    }
                })
            }

            //If based on a single FHIR resource, check for differences from that base
            function checkDifferences(resource) {
                delete $scope.differenceFromBase
                logicalModelSvc.differenceFromBase(resource).then(
                    function (analysis) {
                        $scope.differenceFromBase = analysis;
                    },
                    function(err) {

                    }
                )
            }
            //called when the graph tab is selected
            $scope.redrawReferencesChart = function () {
                //alert('redraw')

                $timeout(function(){
                    if ($scope.refNetwork) {
                        $scope.refNetwork.fit();
                    }


                },1000            )

            }

            //check if the current model is in the current users palette
            function checkInPalette() {
                delete $scope.isInPalette;      //true if the model is in the

                if ($scope.currentType && $scope.lmPalette) {
                    $scope.lmPalette.entry.forEach(function(entry){
                        if (entry.item.reference == 'StructureDefinition/'+$scope.currentType.id) {
                            $scope.isInPalette = true;
                        }
                    })
                }


            }


            function getAllComments(){
                GetDataFromServer.getOutputsForModel($scope.currentType).then(
                    function(lst) {

                        $scope.allComments = lst;
                    }, function (err) {

                    }
                )
            }

            function checkForComments(resource) {
                //if there's a practitioner (ie a logged in user) then see if there is an active task to comment on this model
                if (resource && $scope.Practitioner) {
                    var options = {active:true,focus:resource}
                    GetDataFromServer.getTasksForPractitioner($scope.Practitioner,options).then(
                        function(listTasks) {

                            if (listTasks.length > 0) {
                                $scope.commentTask = listTasks[0];  //should only be 1 active task for this practitioner for this model

                                //now get any 'output' resources that exist for this task. Will only be QuestionnaireResponses...
                                GetDataFromServer.getOutputsForTask($scope.commentTask,'QuestionnaireResponse').then(
                                    function(lst){
                                        $scope.taskOutputs = lst;


                                        if (lst.length > 0 && lst[0].item) {
                                            //if there is at least 1 QuestionnaireResponse - set the text...
                                            //todo - this only supports a single comment per practitioner per model....
                                            try {
                                                $scope.input.mdComment = lst[0].item[0].answer[0].valueString;
                                            } catch (err){
                                                alert('There was an error getting the comment')
                                            }

                                        }



                                    },
                                    function(err) {
                                        alert('Error getting task outputs: '+angular.toJson(err))
                                    }
                                )

                            }
                        }

                    )
                }
            }
            
            function loadHistory(id) {
                logicalModelSvc.getModelHistory(id).then(
                    function(data){

                        $scope.modelHistory =data.data;
                    },
                    function(err) {
                        alert(angular.toJson(err))
                    }
                )
            }

            //select one of the versions to display. We keep the current verson in currentSD (set in makeSD() )
            $scope.selectModelVersion = function(entry){
                $scope.SD = entry.resource;
                $scope.isHistory = true;
                $scope.treeData = logicalModelSvc.createTreeArrayFromSD($scope.SD);
                drawTree();
            };


            $scope.editExtension = function () {
                var extensionUrl = $scope.selectedNode.data.fhirMappingExtensionUrl;

                GetDataFromServer.findConformanceResourceByUri(extensionUrl).then(
                    function(resource) {
                        $uibModal.open({
                            templateUrl: 'modalTemplates/newExtension.html',
                            size: 'lg',
                            controller: "extensionDefCtrl",
                            resolve : {
                                currentExt: function () {          //the default extension
                                    return resource;
                                }
                            }
                        }).result.then(
                            function(result) {

                            })
                    },
                    function(err) {
                        alert(angular.toJson(err))
                    }
                )




            };



            $scope.addNode = function() {
                var parentPath = $scope.selectedNode.data.path;
                editNode(null,parentPath);         //will actually create a new node

            };

            $scope.editNode = function() {


                var parentPath = $scope.selectedNode.data.path;

                editNode($scope.selectedNode,parentPath);         //will edit the node

            };

            //edit or add a new element to the model
            var editNode = function(nodeToEdit,parentPath) {

                logicalModelSvc.saveTreeState($scope.treeData);

                $uibModal.open({
                    templateUrl: 'modalTemplates/editLogicalItem.html',
                    size: 'lg',
                    controller: 'editLogicalNodeCtrl',

                    resolve : {
                        allDataTypes: function () {          //the default config
                            return $scope.dataTypes;
                        }, editNode : function() {
                            return nodeToEdit
                        },
                        parentPath : function(){
                            return parentPath;
                        },
                        findNodeWithPath : function() {
                            return findNodeWithPath
                        },
                        rootForDataType : function() {
                            return $scope.rootForDataType;
                        },
                        igSvc : function() {
                            //the Implementation Guide service has the known valueSets (and other goodies)
                            return igSvc
                        },
                        references : function(){
                            return $scope.bundleModels;
                        },
                        baseType : function() {
                            var baseType = null
                            if ($scope.treeData && $scope.treeData[0] && $scope.treeData[0].data &&  $scope.treeData[0].data.header)  {
                                baseType = $scope.treeData[0].data.header.baseType;
                            }
                            return baseType;
                        },
                        allResourceTypes : function() {
                            return  $scope.allResourceTypes;
                        },
                        treeData : function () {
                            return $scope.treeData
                        }
                    }
                }).result.then(
                    function(result) {


                        if (result.editNode) {
                            //editing an existing node - replace the data property in the node with the results......
                            $scope.treeData.forEach(function (item, index) {
                                if (item.id == result.editNode.id) {
                                    var clone = angular.copy(result)
                                    delete clone.editNode;
                                    item.data = clone;
                                    item.text = clone.name;
                                    $scope.selectedNode = item;
                                }
                            })

                        } else {
                            //this is a new node
                            var parentId = $scope.selectedNode.id;
                            var newId = 't' + new Date().getTime();
                            var newNode = {
                                "id": newId,
                                "parent": parentId,
                                "text": result.name,
                                state: {opened: true}
                            };
                            newNode.data = angular.copy(result);

                            $scope.treeData.push(newNode);


                            if (result.extensionAnalyse && result.extensionAnalyse.isComplexExtension && result.extensionAnalyse.children) {
                                //this is a complex extension, so need to add the children...

                                var parentId = newNode.id;
                                result.extensionAnalyse.children.forEach(function (child) {

                                  //  var parentId = newId;       //from the node entered above...
                                    var newId = 't' + new Date().getTime() + Math.random(1000);
                                    var newNode = {
                                        "id": newId,
                                        "parent": parentId,
                                        "text": child.code,
                                        state: {opened: true}
                                    };
                                    newNode.data = {ed:child.ed}    //not sure about this...
                                    newNode.data.name = child.code;
                                    newNode.data.short = child.code;
                                    newNode.data.description = child.ed.definition;
                                    newNode.data.type = child.ed.type;
                                    //complex types start with uppercase...
                                    if (child.ed.type && child.ed.type[0].code) {
                                        if (child.ed.type[0].code.substr(0,1) === child.ed.type[0].code.substr(0,1).toUpperCase()) {
                                            child.ed.type[0].isComplexDT = true;
                                        }
                                    }




                                    newNode.data.min = child.min;
                                    newNode.data.max = child.max;

                                    if (child.boundValueSet) {
                                        newNode.data.selectedValueSet = {strength: child.bindingStrength};
                                        newNode.data.selectedValueSet.vs = {url: child.boundValueSet};
                                    }


                                    /* if (ed.binding) {
                                     item.data.selectedValueSet = {strength: ed.binding.strength};
                                     item.data.selectedValueSet.vs = {url: ed.binding.valueSetUri};
                                     item.data.selectedValueSet.vs.name = ed.binding.description;
                                     }*/

                                    $scope.treeData.push(newNode);



                                })
                                
                            }



                            //the currently selected parent node type should now be set to 'BackBone element'
                            var node = findNodeWithPath(parentPath);
                            if (node){
                           //     node.data.type = [{code:'BackboneElement'}]
                            }

                        }

                        //set all the element paths...
                        var rootNodeId = $scope.treeData[0].data.path;
                        setPath(rootNodeId, rootNodeId)

                        //ensure that the tree has the selected node highlighted...
                        if ($scope.selectedNode) {
                            $scope.treeIdToSelect = $scope.selectedNode.id;
                        }



                        drawTree();
                        $scope.isDirty = true;
                        makeSD();       //create the StructureDefinition resource...

                        setAllMappings();   //update any mappings

                        //set the path of the element based on the name - and the parent names up the hierarchy..
                        function setPath(parentPath,parentId) {
                            $scope.treeData.forEach(function(node){
                                if (node.parent == parentId) {

                                    //can't rely on the name as this gets changed during the expand function...
                                    var segment = node.data.pathSegment || node.data.name;

                                   // var childPath = parentPath + '.' + node.data.name;
                                    var childPath = parentPath + '.' + segment;
                                    node.data.path = childPath;
                                    setPath(childPath,node.id)
                                }
                            })

                        }


                    })
                };


            $scope.copyNode = function() {
                //make a copy of the current node (with a new id)



                //var newNode = angular.copy($scope.selectedNode);

                var newNode = {

                    "parent": $scope.selectedNode.parent,
                    "text": $scope.selectedNode.text,
                    state: {opened: true},
                    data : angular.copy($scope.selectedNode.data)
                };


                var path = newNode.data.path;
                var ar = path.split('_');
                var realPath = ar[0];   // in case this has already been copied...
                var ctr,pos = 0;

                $scope.treeData.forEach(function (node,inx) {
                    if (node.data.path ==realPath) {
                        pos = inx;      //the index in the tree array where the node we are copying is located
                    }

                });
                if (ar[1]) {
                    newNode.data.path = realPath + '_'+ ar[1]++      //there was already a copy
                } else {
                    newNode.data.path = realPath + '_1';             //this is the first copy
                }

                newNode.id = newNode.data.path;         //must have a unique id...

                newNode.state.selected = false;
                newNode.text += "_copy";
                newNode.data.name = newNode.text;
                $scope.treeData.splice(pos+1,0,newNode);

                drawTree();
                makeSD();


            };

            //insert an external model into the
            $scope.insertModel = function () {

                //delete $scope.selectedNode;

                logicalModelSvc.insertModel($scope.selectedNode,$scope.treeData )
            }

            $scope.deleteNode = function() {

                if ($scope.selectedNode.data.min > 0) {
                    var modalOptions = {
                        closeButtonText: "No, don't remove it",
                        actionButtonText: 'Yes, remove it',
                        headerText: 'Confirm remove required element',
                        bodyText: 'This element is required - are you sure you wish to remove it? (It might make creating a profile more difficult later on)'
                    };

                    modalService.showModal({}, modalOptions).then(
                        function (result) {
                            removeNode();
                        }

                    );
                } else {
                    removeNode();
                }



                function removeNode() {
                    logicalModelSvc.saveTreeState($scope.treeData);
                    //first assemble list of nodes to remove
                    var idToDelete = $scope.selectedNode.id;
                    var lst = [idToDelete];

                    findChildNodes(lst,idToDelete);     //all the child nodes (including their children) of the element to be removed


                    //now create a new list - excluding the ones to be deleted
                    var newList = [];
                    $scope.treeData.forEach(function(node){
                        if (lst.indexOf(node.id) == -1) {
                            newList.push(node);
                        } //else {}
                      //  node.state.opened=true;     //the whole tree is expanded
                    });


                    $scope.treeData = newList;
                   // logicalModelSvc.resetTreeState($scope.treeData)
                    delete $scope.selectedNode;
                    drawTree();
                    makeSD();

                    $scope.isDirty = true;
                    $scope.currentType = angular.copy($scope.SD);     //keep a copy so that we can return to it from the history..

                }


                //create a list with the paths of all the nodes
                function findChildNodes(lst,parentId) {
                    $scope.treeData.forEach(function(node){
                        if (node.parent == parentId) {
                            lst.push(node.id);
                            findChildNodes(lst,node.id)
                        }
                    })
                    
                }

                
                
            };


            //locate a node based on the path. Used to detect duplicates...
            function findNodeWithPath(path) {
                var foundNode;
                $scope.treeData.forEach(function(node){
                    if (node.data.path == path) {
                        foundNode= node;
                    }
                });
                return foundNode;
            }

            function findPositionInTree(path){
                var inx = -1;
                for (var i=0; i < $scope.treeData.length; i++) {
                    if ( $scope.treeData[i].data.path == path) {
                        return i;
                        break;
                    }
                }
                return -1;
            }


            //have this as a single function so we can extract scope properties rather than passing the whole scope across...
            makeSD = function() {

                //return;

                //sorts the tree array in parent/child order
                var ar = logicalModelSvc.reOrderTree($scope.treeData);

                $scope.SD = logicalModelSvc.makeSD($scope,ar);

                createGraphOfProfile();     //update the graph display...
                checkDifferences($scope.SD)

            };

            //exit from the history review
            $scope.exitHistory = function(){
                $scope.SD = $scope.currentType;
                $scope.isHistory = false;

                //restore the current (working) version...
                $scope.treeData = logicalModelSvc.createTreeArrayFromSD($scope.SD)

                $scope.rootName = $scope.treeData[0].id;        //the id of the first element is the 'type' of the logical model
                drawTree();
                makeSD();

            };

            $scope.moveUp = function(){
                logicalModelSvc.saveTreeState($scope.treeData);
                var path = $scope.selectedNode.data.path;
                var pos = findPositionInTree(path);     //the location of the element we wish to move in the array

                if (pos > 0) {
                    var lst = getListOfPeers(path);
                    if (lst[0].data.path !== path) {
                        //so we're not the first... - need to find the one to shift above...
                        for (var i=0; i < lst.length; i++) {
                            if (lst[i].data.path == path) {
                                //yes! we've got the one to move above, now where is it in the tree?
                                var pos1 = findPositionInTree(lst[i-1].data.path);    //this marks where to do the insert
                                var removedBranch = pruneBranch(path);
                                insertBranch(removedBranch,pos1);
                                $scope.isDirty = true;
                                $scope.treeIdToSelect = findNodeWithPath(path).id;
                                drawTree();
                                makeSD();


                                break;
                            }
                        }
                    }
                }
            };

            $scope.moveDn = function(){
                logicalModelSvc.saveTreeState($scope.treeData);
                var path = $scope.selectedNode.data.path;
                //var originalPos = findPositionInTree(path);     //need to save where the list is now in case we need to re-insert...
                var lst = getListOfPeers(path);
                //find the position of this node in the peers. If we're already at the bottom, then don't shift
                //if we're second to bottom, then insert point will be right at the bottom.
                //otherwise insert point is above the one 2 down in the list (because of all the child nodes to consider...
                var lengthOfPeers = lst.length;
                var placeInList = -1;
                   for (var i=0; i < lst.length; i++) {    //find where this node is in the list of peers...
                       if (lst[i].data.path == path) {
                           placeInList = i;
                           break;
                       }
                   }
                if (placeInList == lengthOfPeers-1) {
                    //we're at the end of the list - re-insert at original
                } else if (placeInList == lengthOfPeers-2) {
                    //we're second to bottom - do nothing
                    var removedBranch = pruneBranch(path);      //prune the list
                    var insertPos = $scope.treeData.length; //the bottom
                    insertBranch(removedBranch,insertPos);
                    $scope.isDirty = true;
                    $scope.treeIdToSelect = findNodeWithPath(path).id;
                    drawTree();
                    makeSD();

                } else {
                    //insert above the secone one down...
                    var pathToInsertAbove = lst[placeInList+2].data.path;   //the node we'll insert above
                    var removedBranch = pruneBranch(path);      //prune the list
                    var insertPos= findPositionInTree(pathToInsertAbove);   //insert point (after the list was pruned)
                    insertBranch(removedBranch,insertPos);
                    $scope.isDirty = true;
                    $scope.treeIdToSelect = findNodeWithPath(path).id;
                    drawTree();
                    makeSD();
                }
            };

            //remove a nde and all of its children
            pruneBranch = function(path) {
                var arChildren = getChildren(path);

                //remove all the children from the array
                var pos = findPositionInTree(path);
                return $scope.treeData.splice(pos,arChildren.length+1)
            };

            insertBranch = function(branch,pos){
                for (var j=branch.length-1; j > -1; j--) {
                    var nodeToInsert= branch[j];
                    $scope.treeData.splice(pos,0,nodeToInsert)
                }
            };


            //return a list of all peers to this one (used by the move functionality)
            getListOfPeers = function(path) {
                var ar = path.split('.')
                var numberOfSteps = ar.length;      //
                ar.pop();
                var parentPath = ar.join('.');
                var parentPathLength = parentPath.length;
                var ar = [];
                $scope.treeData.forEach(function(node){
                    var ar1 = node.data.path.split('.');
                    if ((node.data.path.substr(0,parentPathLength) == parentPath) && (ar1.length == numberOfSteps)) {
                        ar.push(node);
                    }
                });
                return ar;

            };

            //get all the children of this path
            getChildren = function(path) {
                var ar = [];
                $scope.treeData.forEach(function(node){
                    if (node.data.path.lastIndexOf(path,0)=== 0 && node.data.path !==path) {
                        ar.push(node);
                    }
                });
                return ar;

            };


            function drawTree() {

                //not sure about this...  logicalModelSvc.resetTreeState($scope.treeData);    //reset the opened/closed status to the most recent saved...

                $('#lmTreeView').jstree('destroy');
                $('#lmTreeView').jstree(
                    {'core': {'multiple': false, 'data': $scope.treeData, 'themes': {name: 'proton', responsive: true}}}
                ).on('changed.jstree', function (e, data) {
                    //seems to be the node selection event...

                    if (data.node) {
                        $scope.selectedNode = data.node;
                        $scope.selectedED = logicalModelSvc.getEDForPath($scope.SD,data.node)
                    }

                    $scope.$digest();       //as the event occurred outside of angular...

                }).on('redraw.jstree', function (e, data) {

                    if ($scope.treeIdToSelect) {
                        $("#lmTreeView").jstree("select_node", "#"+$scope.treeIdToSelect);
                        delete $scope.treeIdToSelect
                    }
/*

                    if ($scope.treeData.length > 0) {
                        $scope.$broadcast('treebuilt');
                        $scope.$digest();       //as the event occurred outside of angular...
                    }
                    */

                }).on('open_node.jstree',function(e,data){

                    //set the opened status of the scope propert to the same as the tree node so we can remember the state...
                    $scope.treeData.forEach(function(node){
                        if (node.id == data.node.id){
                            node.state.opened = data.node.state.opened;
                        }
                    })
                    $scope.$digest();
                }).on('close_node.jstree',function(e,data){

                    //set the opened status of the scope propert to the same as the tree node so we can remember the state...
                    $scope.treeData.forEach(function(node){
                        if (node.id == data.node.id){
                            node.state.opened = data.node.state.opened;
                        }
                    })
                    $scope.$digest();
                });


            }

            //drawTree()
    });
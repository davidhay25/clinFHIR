/*has been deprectde - don't call make function - expensive! */

angular.module("sampleApp")
    .controller('logicalModellerCtrl',
        function ($scope,$rootScope,$uibModal,$http,resourceCreatorSvc,modalService,appConfigSvc,logicalModelSvc,$timeout,
                  GetDataFromServer,$firebaseObject,$firebaseArray,$location,igSvc,SaveDataToServer,$window,RenderProfileSvc,
                  $q,Utilities, securitySvc,$filter,builderSvc,questionnaireSvc) {
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


            //generate the mapping download file
            function makeMappingDownload(SD) {

                var download = logicalModelSvc.makeMappingDownload(SD);
                //console.log(download)

                $scope.downloadLinkJsonContent = window.URL.createObjectURL(new Blob([download],
                    {type: "text/text"}));

                $scope.downloadLinkJsonName = "downloaded"
            }
            //makeMappingDownload()


            //for selecting a profile to import
           // $scope.showFindProfileDialog = {};
            //all the base types for the selection...
            RenderProfileSvc.getAllStandardResourceTypes().then(
                function(data){
                    $scope.allResourceTypes = data;
                });

            $scope.makeScenarioDEP = function() {



                //$scope.showFindProfileDialog.open();
            };

            //when an item is selected in the form (populator)
            $scope.selectItemFromForm = function(child) {
                console.log(child)
                $scope.selectedNode = findNodeWithPath(child.id);
                console.log($scope.selectedNode);

            };

            $scope.generateIG = function() {
                alert('Not yet enabled, sorry...')

                logicalModelSvc.makeIG($scope.treeData).then(
                    function(IG) {
                        console.log(IG)
                    },
                    function(err) {
                        console.log(err)
                    }
                )
            }



            //generate and save a questionnaire
            $scope.generateQ = function(){

                var Qname = $scope.SD.id;   //the questionairre name (and id, url) is based on the LM model id
                var Q = questionnaireSvc.makeQ($scope.treeData);  //update the Questionnaire
                questionnaireSvc.saveQ(Q,Qname).then(
                    function(ok) {
                        modalService.showModal({}, {bodyText: ok});


                        questionnaireSvc.findQ();       //just as a test...
                    },
                    function(err) {
                        modalService.showModal({}, {bodyText: err});
                    }

                )



            };

            $scope.rootForDataType="http://hl7.org/fhir/datatypes.html#";

            $scope.input.newCommentboxInxDEP = -1;

            //this is the new builder model
            $scope.showForm = function(){

                $uibModal.open({
                    templateUrl: 'modalTemplates/newBuilderModal.html',
                    windowClass: 'nb-modal-window',
                    controller : function($scope,startProfile,startResource,bundle,title,container){
                        $scope.startProfile = startProfile;
                        $scope.startResource = startResource;
                        $scope.bundle = bundle;
                        $scope.title = title;
                        $scope.container = container;

                        $scope.closeModal = function() {
                            $scope.$close()
                        }

                    }, resolve : {
                        startProfile : function(){
                            return $scope.SD;
                        },
                        startResource : function() {
                            //note that the $scope.currentResource will be directly updated by new builder...
                            return {};
                        },
                        bundle : function(){
                            //used for the references...
                            return {resourceType:'Bundle',entry:[]};
                        },
                        title : function(){
                            return "Form ";
                        },
                        container : function(){
                            //used for the references...
                            return {};
                        }

                    }
                })


            };

            $scope.redrawChart = function(){
                //$scope.chart.fit();
                $timeout(function(){
                    if ($scope.instanceGraph) {
                        $scope.instanceGraph.fit();

                    }

                },1000)

            };

            $scope.showQuest = function(){
                //$scope.showForm();      //actually the new data entry form...


                //return


                $uibModal.open({
                    templateUrl: 'modalTemplates/questionnaire.html',
                    size: 'xl',
                    controller: function($scope,Q){
                        console.log(Q)
                        $scope.Q = Q;
                    },
                    resolve : {
                        Q: function () {          //the default extension
                            console.log($scope.Q)
                            return  $scope.Q;
                        }
                    }
                }).result.then(
                    function(result) {

                    })
            };

            $scope.editLMDocDEP = function(){
                $uibModal.open({
                    templateUrl: 'modalTemplates/editLMDoc.html',
                    size: 'lg',
                    controller: "editLMDocCtrl",
                    resolve : {
                        doc: function () {          //the default extension
                            return  $scope.docBundle;
                        }
                    }
                }).result.then(
                    function(result) {

                    })
            };

            $scope.expandAll = function() {
                $scope.treeData.forEach(function (item) {

                    item.state.opened = true;
                })
                drawTree();
            }

            $scope.resetLayout = function(){
                logicalModelSvc.resetTreeState($scope.treeData);
                $scope.treeData.forEach(function (item) {

                    if (item.data && item.data.ed && item.data.ed.type) {
                        item.data.ed.type.forEach(function (typ) {
                            if (typ.code == 'BackboneElement') {
                                item.state.opened = true;

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
            $scope.generateSampleDEP = function(){
                var treeObject = $('#lmTreeView').jstree().get_json();    //creates a hierarchical view of the resource
                $scope.sample = logicalModelSvc.generateSample(treeObject);
            };

            $scope.showCommentEntryDEP = function(comment,index) {


                return ((comment.levelKey == $scope.currentLevelKey) || comment.level==1);
            }

            $scope.showConversationDEP = function(levelKey) {
                $scope.currentLevelKey = levelKey;

            }

            $scope.saveCommentDEP = function() {
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

            //re-load the previous model
            $scope.goBack = function() {
                var entry = $scope.history.pop();
                if (entry) {
                    selectEntry(entry);
                }
            }

            //todo - this could be tidied...
            $scope.LMDetailVisible = true;
            $scope.rightPaneClass = "col-md-5 col-sm-5";
            $scope.showLMSelector = function(){
                $scope.leftPaneClass = "col-sm-2 col-md-2"
                if ($scope.LMDetailVisible) {
                    $scope.midPaneClass = "col-md-5 col-sm-5"

                } else {
                    $scope.midPaneClass = "col-md-10 col-sm-10"
                }
                $scope.LMSelectorVisible = true;
            };

            
            $scope.hideLMSelector = function(){
                $scope.leftPaneClass = "hidden"
                if ($scope.LMDetailVisible) {

                    $scope.midPaneClass = "col-md-7 col-sm-7"
                } else {
                    $scope.midPaneClass = "col-md-12 col-sm-12"
                }
                $scope.LMSelectorVisible = false;
            };

            $scope.showLMSelector()

            $scope.hideDetailSelector = function() {
                $scope.rightPaneClass = "hidden";
                if ($scope.LMSelectorVisible) {
                    $scope.midPaneClass = "col-md-10 col-sm-10"

                } else {
                    $scope.midPaneClass = "col-md-12 col-sm-12"
                }
                $scope.LMDetailVisible = false
            };

            $scope.showDetailSelector = function() {
                $scope.rightPaneClass = "col-md-5 col-sm-5";
                if ($scope.LMSelectorVisible) {
                    $scope.midPaneClass = "col-md-5 col-sm-5"

                } else {
                    $scope.midPaneClass = "col-md-7 col-sm-7"
                }
                $scope.LMDetailVisible = true
            };



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
                    var entry = {item : {reference: 'StructureDefinition/'+$scope.currentType.id,display:$scope.currentType.id}};
                    $scope.lmPalette.entry = $scope.lmPalette.entry || []
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
            };


            //if a shortcut has been used there will be a hash so load that
            var hash = $location.hash();
            if (hash) {

                //console.log(ha)


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
                                    nodeSpacing : 60,
                                    sortMethod:'directed',
                                    parentCentralization : false
                                }
                            },
                            physics:false
                        };


                        var options = {
                            physics: {
                                enabled: true,
                                barnesHut: {
                                    gravitationalConstant: -1100,
                                }
                            }
                        };

                        $scope.profileNetwork = new vis.Network(container, graphData, options);

                        $scope.profileNetwork.on("click", function (obj) {
                            var nodeId = obj.nodes[0];  //get the first node
                            var node = graphData.nodes.get(nodeId);
                            if (node.ed) {
                                var pathOfSelectedNode = node.ed.path; //node.ed.base.path not working with merged...
                                $scope.selectedNode = findNodeWithPath(pathOfSelectedNode); //note this is the node for the tree view, not the graph

                                $scope.$digest();
                            }


                        });
                    }
                );
            };



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
                            $scope.input.createElementsFromBase = false;    //by default, don't copy the existing elements across.
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
                                //$scope.input.modelType = 'multiple'
                                $scope.input.modelType = 'single'
                                
                            }

                            $scope.selectBaseType = function() {
                                //$scope.input.createElementsFromBase = true;     //default to copy elements across
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


                                if (! /^[A-Za-z0-9\-\.]{1,64}$/.test(name)) {
                                    var msg = "The name can only contain upper and lowercase letters, numbers, '-' and '.'"
                                    modalService.showModal({},{bodyText:msg})
                                    return


                                }
                                /*
                                console.log(/^[A-Za-z0-9\-\.]{1,64}$/.test(name))


                               // console.log(name.match(/[A-Za-z0-9\-\.]/))

                                var re = new RegExp("^[A-Za-z0-9\\-\\.]{1,64}$");
                                if (re.test(name)) {
                                    console.log(name + " Valid");
                                } else {
                                    console.log(name + " Invalid");
                                }



                                if (name && name.indexOf(' ')>-1) {
                                    modalService.showModal({},{bodyText:"The name cannot contain spaces"})
                                    return;
                                }
*/
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
            $scope.dataTypes.push({code: 'Dosage',description: 'Dosage',definition:'http://hl7.org/fhir/dosage.html#Dosage'});




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
                delete $scope.Q;                //the Questionnaire
                $scope.canSaveModel = true;     //allow edits to the model to be saved

                $scope.isDirty = false;
                $scope.treeData = logicalModelSvc.createTreeArrayFromSD(entry.resource);
                $scope.Q = questionnaireSvc.makeQ($scope.treeData);
                $scope.relativeMappings = logicalModelSvc.getRelativeMappings($scope.treeData); //items with both v2 & fhir mappings


                $window.document.title = 'LM: ' + entry.resource.id;


                logicalModelSvc.openTopLevelOnly($scope.treeData);

                //temp little routine to generate a mapping file -
                var map = []
                $scope.relativeMappings.forEach(function(m) {

                    map.push({description: m.branch.data.path,v2:m.sourceMap,fhir:m.targetMap})
                })



                var baseType = $scope.treeData[0].data.header.baseType


                setAllMappings();       //find all the mapping identities that have been used..
                makeMappingDownload(entry.resource);  //create a download for the mappings defined in the model


                findShortCutForModel(entry.resource.id).then(
                    function(vo) {
                        $scope.treeData.shortCut = vo;  //safe to put here as it will be ignored...
                    }
                )


                var vo = logicalModelSvc.makeReferencedMapsModel(entry.resource,$scope.bundleModels);   //todo - may not be the right place...


                //so that we can draw a table with the references in it...
                $scope.modelReferences = vo.references;
                $scope.uniqueModelsList = vo.lstNodes;


                var b = logicalModelSvc.makeDocBundleWithComposition(entry.resource)
                console.log(b)
                $scope.docBundle = b;

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
                    return;     //disable for now...

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




                });


                //-----  2017-09-17  whole section above was commented out


                $scope.rootName = $scope.treeData[0].id;        //the id of the first element is the 'type' of the logical model
                drawTree();

                makeSD();
                $scope.currentType = angular.copy($scope.SD);     //keep a copy so that we can return to it from the history..
                loadHistory($scope.rootName);
                /*
                DON'T DELETE. - for now, don't try to find comments...
                checkForComments(entry.resource);
                getAllComments();
                */


                checkInPalette();
                updateInstanceGraph();
                $scope.hidePatientFlag = false;

            }

            //make a bundle that has a resource instance for all the referenced resource types in the model
            function updateInstanceGraph() {
                console.log('update instance graph')
                $scope.hidePatientFlag = false;

                logicalModelSvc.makeScenario($scope.treeData).then(
                    function(bundle){

//console.log(bundle)
                        $scope.scenarioBundle = bundle;
                        logicalModelSvc.saveScenario(bundle,'fromLM');      //write out the scenario for the Scenario Builder




                       //build the sampleDocumentTree - but only if there is a Composition resource in the bundle...
                        //console.log(bundle)

                        var treeData = builderSvc.makeDocumentTree(bundle,true);    //don't display any error message
                        $('#docTreeView').jstree('destroy');

                        if (treeData) {


                            $('#docTreeView').jstree(
                                {'core': {'multiple': false, 'data': treeData, 'themes': {name: 'proton', responsive: true}}}
                            ).on('select_node.jstree', function (e, data) {
                                console.log(data && data.node.data)
                                //delete $scope.currentResource;      //todo - there's a setResource() in the service too...
                                //delete $scope.currentPath;
                                delete $scope.selectedNode;
                                if (data.node) {
                                    var resource = data.node.data.resource;

                                    console.log(resource);
                                    var path = resource.path;
                                    //find the node in the



                                    //$scope.selectedNode = data.node;



                                    $scope.selectedED = logicalModelSvc.getEDForPath($scope.SD,{data: {path:path}})
                                    $scope.$digest()
                                }

                            })


                        }




                            /*.on('select_node.jstree', function (e, data) {
                            console.log(data)
                            delete $scope.currentResource;      //todo - there's a setResource() in the service too...
                            delete $scope.currentPath;
                            if (data.node.data){
                                $scope.selectResource({resource:data.node.data.resource});
                                $scope.currentPath = data.node.data.path;

                            }
                            $scope.$digest()
                        })

*/




                        generateInstanceGraph(bundle)
                    }
                );      //make a scenario.

            }

            //
            function generateInstanceGraph(bundle,resource,hideMe){




                console.log('generate graph',bundle)

                var vo = builderSvc.makeGraph(bundle,resource,hideMe,true);

                var container = document.getElementById('resourceGraph');
                var options = {
                    physics: {
                        enabled: true,
                        barnesHut: {
                            gravitationalConstant: -10000,
                        }
                    }
                };

                $scope.instanceGraph = new vis.Network(container, vo.graphData, options);
                $scope.instanceGraph.on("click", function (obj) {
                    var nodeId = obj.nodes[0];  //get the first node
                    var node = vo.graphData.nodes.get(nodeId);
                    if (node.cf && node.cf.resource) {
                        var pathOfSelectedNode = node.cf.resource.id; //node.ed.base.path not working with merged...
                        $scope.selectedNode = findNodeWithPath(pathOfSelectedNode); //note this is the node for the tree view, not the graph
                        $scope.selectedED = logicalModelSvc.getEDForPath($scope.SD,$scope.selectedNode)
                        //
                        $scope.$digest();
                    }


                });

                $scope.instanceGraph.fit();

            }

            $scope.hidePatient = function(){
                $scope.hidePatientFlag = true;
                if ($scope.scenarioBundle) {
                    for (var i = 0; i < $scope.scenarioBundle.entry.length; i++){
                        var resource = $scope.scenarioBundle.entry[i].resource;
                        if (resource.resourceType == 'Patient') {
                            generateInstanceGraph($scope.scenarioBundle,resource,true)
                            break;

                        }
                    }
                }
            }
            $scope.showAllInGraph = function(){
                $scope.hidePatientFlag = false;
                if ($scope.scenarioBundle) {
                    generateInstanceGraph($scope.scenarioBundle)
                }
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
                        msg = "There was an error loading the history of changes for this model.";
                        msg += angular.toJson(err)
                        alert(msg);
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


            $scope.showExtensionFromMap = function(ed) {
                var url = appConfigSvc.config().standardExtensionUrl.simpleExtensionUrl;
                var ext = Utilities.getSingleExtensionValue(ed,url)
                if (ext) {
                    $scope.editExtension(ext.valueString);
                }
            }

            $scope.editExtension = function (extensionUrl) {
                //var extensionUrl = $scope.selectedNode.data.fhirMappingExtensionUrl;
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
                var ar = parentPath.split('.');
                ar.pop()
                parentPath = ar.join('.')


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
                            //is there a base type set for this whole model?
                            //changed so a parent reference will set the baseType


                            //if ($scope.treeData && $scope.treeData[0] && $scope.treeData[0].data &&  $scope.treeData[0].data.header)  {
                             //   baseType = $scope.treeData[0].data.header.baseType;
                          //  }

                            //if not, then is the parent a reference to a resource?
                           // if (!baseType) {

                                //look
                                var checkPath = parentPath;
                                var checkMore = true, cnt = 0;
                                while (checkPath != '#' && checkMore && cnt < 10) {
                                    cnt++;      //a safety device to avoid an endless loop...
                                    var node = findNodeWithPath(checkPath)

                                    if (node && node.data && node.data.type) {
                                        //if (node && node.data && node.data.ed && node.data.ed.type) {
                                        node.data.type.forEach(function (typ) {
                                            if (typ.code == 'Reference') {
                                                //r2/r3 difference
                                                var profile = typ.targetProfile
                                                if (!profile && typ.profile) {
                                                    profile = typ.profile[0]
                                                }
                                                if (profile) {
                                                    baseType  = $filter('referenceType')(profile);
                                                    checkMore = false;  //found the parent!
                                                }

                                            }
                                        })
                                        //if checkMore is still true, then we didn't find a reference with a profile.
                                        checkPath = node.parent;    //move up the hierarchy. Will eventually stop at the root (parent = '#')

                                        console.log(checkPath)

                                    }  else {
                                        checkMore = false;      //stop if there is a node without a type
                                    }
                                }
                                /*
                                var node = findNodeWithPath(parentPath)

                                if (node && node.data && node.data.type) {
                                //if (node && node.data && node.data.ed && node.data.ed.type) {
                                    node.data.type.forEach(function (typ) {
                                        if (typ.code == 'Reference') {
                                            //r2/r3 difference
                                            var profile = typ.targetProfile
                                            if (!profile && typ.profile) {
                                                profile = typ.profile[0]
                                            }
                                            if (profile) {
                                                baseType  = $filter('referenceType')(profile);
                                            }

                                        }
                                    })
                                }
                                */

                           // }
                            // if no reference in the hierarchy, see if the model was created with a base resource
                            if (!baseType) {
                                if ($scope.treeData && $scope.treeData[0] && $scope.treeData[0].data && $scope.treeData[0].data.header) {
                                    baseType = $scope.treeData[0].data.header.baseType;
                                }
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

                                    item.data.pathSegment = clone.name;     //this will re-write the path in setPath() below....

                                    $scope.selectedNode = item;
                                }
                            })
                            //updateInstanceGraph();

                        } else {
                            //this is a new node
                            var parentId = $scope.selectedNode.id;


                            //var newId = 't' + new Date().getTime();
                            //nov29 2017 - set the id to the path so the graph will work...
                            var newId = $scope.selectedNode.data.path + '.'+ result.name;


                            var newNode = {
                                "id": newId,
                                "parent": parentId,
                                "text": result.name,
                                state: {opened: true}
                            };
                            newNode.data = angular.copy(result);
                            newNode.data.ed = {mapping:result.mappingFromED};   //nov29 - also for the graph...


                            $scope.treeData.push(newNode);


                            //so the table is sorted correctly (otherwise the new node is at the bottom)...
                            $scope.treeData = logicalModelSvc.reOrderTree($scope.treeData);



                            if (result.extensionAnalyse && result.extensionAnalyse.isComplexExtension
                                && result.extensionAnalyse.children) {
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
                        /*
                        logicalModelSvc.makeScenario($scope.treeData).then(
                            function(bundle){
                                //do something...
                            }
                        );      //make a scenario...
*/
                        setAllMappings();   //update any mappings
                        updateInstanceGraph()
                        //$scope.Q = logicalModelSvc.makeQ($scope.treeData);  //update the Questionnaire
                        //console.log( $scope.Q)

                        //set the path of the element based on the name - and the parent names up the hierarchy..
                        //>>>>>>>> This is an important function! Note the use of pathSegment...
                        function setPath(parentPath,parentId) {
                            $scope.treeData.forEach(function(node){
                                if (node.parent == parentId) {

                                    //can't rely on the name as this gets changed during the expand function...
                                    var segment = node.data.pathSegment || node.data.name;
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

                var newName = $window.prompt('Enter Name');

                //the path of the new element is as a sibling of the current path
                var ar = $scope.selectedNode.data.path.split('.')
                ar.pop();

                var newPath = ar.join('.') + '.'+newName;      //todo check for unique


                $scope.isDirty = true;

                var newNode = {
                    "parent": $scope.selectedNode.parent,
                    "text": $scope.selectedNode.text,
                    state: {opened: true}
                };
                newNode.data = angular.copy($scope.selectedNode.data)
               // var path = newNode.data.path;

               // var ar = path.split('_');
               // var realPath = ar[0];   // in case this has already been copied...


                var pos = 0;

                $scope.treeData.forEach(function (node,inx) {
                    if (node.data.path ==$scope.selectedNode.data.path) {   //was realPath
                        pos = inx;      //the index in the tree array where the node we are copying is located
                    }
                });

/*
                var cnt = 1;
                if (ar[1]) {
                    newNode.data.path = realPath + '_'+ ar[1]++      //there was already a copy
                    cnt= ar[1]
                } else {
                    newNode.data.path = realPath + '_1';             //this is the first copy
                }
*/

                newNode.data.path = newPath;    //a sibling to the current element...




                newNode.id = newPath; //newNode.data.path;         //must have a unique id...
              //  newNode.data.ed.id = newNode.data.path;
              //  newNode.data.ed.path = newNode.data.path;
               // var parentNodeId = newNode.data.path;

                newNode.state.selected = false;
                //newNode.text += newName; //"_copy";
                newNode.text = newName; //"_copy";

                //newNode.data.name =  newNode.text;
                newNode.data.name =  newName; //newNode.text; //$scope.selectedNode.text+'_'+cnt;      //needed for the setPath() function
                //newNode.data.pathSegment = $scope.selectedNode.text+'_'+cnt;

                newNode.data.pathSegment = newName; //needed for the setPath() function

                $scope.treeData.splice(pos+1,0,newNode);
                
                
                //copy any direct children - todo should be recursive...
                var children = [];
                $scope.treeData.forEach(function (item) {
                    if (item.parent == $scope.selectedNode.id) {
                        //this is a child
                        var path=item.data.path;
                        var ar1 = path.split('.');
                        var segment = ar1[ar1,ar1.length-1];    //the last part of the path



                        var childNode = {
                                "parent": newNode.id,
                            "text": item.text,
                            state: {opened: true,selected:false}
                        };
                        childNode.data = angular.copy(item.data)
                        //the path for the child is the parent (which will have the _n) plus the same
                        //var childPath = newNode.data.path + '.' + segment;
                        var childPath = newPath + '.' + segment;
                        childNode.id = childPath;
                        childNode.data.path = childPath;
                        childNode.data.pathSegment = segment;

                      //  childNode.data.ed.id = childPath;
                      //  childNode.data.ed.path = childPath;

                        childNode.data.name = segment;
                        children.push(childNode);

                    }
                    
                });



                children.forEach(function (child) {
                    $scope.treeData.splice(pos+2,0,child);
                    pos++
                });



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
                    updateInstanceGraph();
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

                    //ensure the selected node remains so after a redraw...
                    if ($scope.treeIdToSelect) {
                        $("#lmTreeView").jstree("select_node", "#"+$scope.treeIdToSelect);
                        delete $scope.treeIdToSelect
                    }

                }).on('open_node.jstree',function(e,data){

                    //set the opened status of the scope property to the same as the tree node so we can remember the state...
                    $scope.treeData.forEach(function(node){
                        if (node.id == data.node.id){
                            node.state.opened = data.node.state.opened;
                        }
                    });
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


    });
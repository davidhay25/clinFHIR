/*has been deprectde - don't call make function - expensive! */

angular.module("sampleApp")
    .controller('logicalModellerCtrl',
        function ($scope,$rootScope,$uibModal,$http,resourceCreatorSvc,modalService,appConfigSvc,logicalModelSvc,$timeout,
                  GetDataFromServer,$firebaseObject,$location,igSvc) {
            $scope.input = {};
            $scope.treeData = [];           //populates the resource tree

            $scope.conformanceServer = appConfigSvc.getCurrentConformanceServer();

            $scope.rootForDataType="http://hl7.org/fhir/datatypes.html#";




          //  $scope.input.modelChat = logicalModelSvc.generateChatDisplay(conv);
            $scope.input.newCommentboxInx = -1;


            $scope.showCommentEntry = function(comment,index) {
                //console.log(comment,levelKey)



                return ((comment.levelKey == $scope.currentLevelKey) || comment.level==1);
            }

            $scope.showConversation = function(levelKey) {
                $scope.currentLevelKey = levelKey;

            }
            //save a new comment from the chat
            $scope.saveComment = function(parent) {
                console.log(parent)
                var user = logicalModelSvc.getCurrentUser();

                var newComment = {display:$scope.input.newComment, date : moment().format(),
                    user: {email:user.email,uid:user.uid},children:[]}
                newComment.id = new Date().getTime();

                delete $scope.input.newComment;


                console.log($scope.selectedNode)

                //$scope.input.modelChatData

                parent.comment.children = parent.comment.children || []
                parent.comment.children.push(newComment);
                $scope.input.newCommentboxInx = -1;
                $scope.input.modelChat = logicalModelSvc.generateChatDisplay( $scope.input.modelChatData);


                var key = $scope.rootName;      //the key for this particular models chat in the database

                //now update the database...
                var update = {};
                update[key] = $scope.input.modelChatData;

                console.log(update)
                console.log(angular.copy(update))

                firebase.database().ref().child("chat").update(angular.copy(update))    //angular.copy() to remove $$hash



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

            $scope.showLMSelector()


            //check for commands in the url - specifically a valueset url to edit or view...
            var params = $location.search();
            if (params) {
                $scope.startupParams = params;
                if (params.vs) {
                    $scope.initialLM = params.vs;   //the param is names vs - as the same routine in the IG calls valuesets (&others)
                    //delete $scope.state;        //the defualt value is 'find' whicg displays the find dialog...

                    //don't show the list of models if one was passed in...
                    hideLMSelector();

                   // $scope.leftPaneClass = "hidden"
                   // $scope.midPaneClass = "col-md-7 col-sm-7"

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
                if (user) {
                    $rootScope.userProfile = $firebaseObject(firebase.database().ref().child("users").child(user.uid));
                    logicalModelSvc.setCurrentUser(user);
                    console.log(user,$rootScope.userProfile);
                    delete $scope.showNotLoggedIn;
                } else {
                    console.log('no user')
                    logicalModelSvc.setCurrentUser(null);
                    $scope.showNotLoggedIn = true;
                    // No user is signed in.
                }
            });

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

            //$scope.isThisTheCurrentVersion



            //load all the logical models created by clinFHIR

            loadAllModels = function() {
               var url="http://fhir3.healthintersections.com.au/open/StructureDefinition?kind=logical&identifier=http://clinfhir.com|author";
                $http.get(url).then(
                    function(data) {
                        $scope.bundleModels = data.data
                    },
                    function(err){

                    }
                )
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

            /*

            if (appConfigSvc.getCurrentConformanceServer().name !== 'Grahame STU3 server') {
                var modalOptions = {
                    closeButtonText: "No, don't change",
                    actionButtonText: 'Yes, change toGrahames server',
                    headerText: 'Change conformance server',
                    bodyText: 'At the moment, the modellerwill only work against Grahames STU-3 server. Shall I change to that one (will effect all of clinFHIR)'
                };

                modalService.showModal({}, modalOptions).then(
                    function (result) {
                        alert('sorry - you have to do this yourself in clinFHIR at the moment....');

                    }
                );
            }


            */
            $scope.rootNameDEP = 'dhRoot';


            //functions and prperties to enable the valueset viewer
            $scope.showVSBrowserDialog = {};
            $scope.showVSBrowser = function(vs) {
                $scope.showVSBrowserDialog.open(vs);        //the open method defined in the directive...
            };
            $scope.viewVS = function(uri) {
                //var url = appConfigSvc

                GetDataFromServer.getValueSet(uri).then(
                    function(vs) {
                        console.log(vs)
                        $scope.showVSBrowserDialog.open(vs);

                    }
                ).finally (function(){
                    $scope.showWaiting = false;
                });
            };

            var createGraphOfProfile = function() {
                var graphProfile = angular.copy($scope.SD )

                resourceCreatorSvc.createGraphOfProfile(graphProfile).then(
                    function(graphData) {

                        //console.log(graphData)
                        var container = document.getElementById('mmLogicalModel');
                        $scope.profileNetwork = new vis.Network(container, graphData, {});

                        $scope.profileNetwork.on("click", function (obj) {
                            //console.log(obj)

                            var nodeId = obj.nodes[0];  //get the first node
                            //console.log(nodeId,graphData)

                            var node = graphData.nodes.get(nodeId);
                            //console.log(node)

                            var pathOfSelectedNode = node.ed.base.path;
                            $scope.selectedNode = findNodeWithPath(pathOfSelectedNode); //note this is the node for the tree view, not the graph

                            $scope.$digest();
                            //selectedNetworkElement

                        });
                    }
                );
            };

            //this is the event when the profileGraph tab is chosen. Should really move this to a separate controller...
            $scope.redrawProfileGraph = function() {
                console.log('click')

                $timeout(function(){
                    $scope.profileNetwork.fit();
                    console.log('fitting...')
                },500            )


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
                $uibModal.open({
                    templateUrl: 'modalTemplates/newLogicalModel.html',
                        size: 'lg',
                        controller: function($scope,appConfigSvc,Utilities,GetDataFromServer,modalService,RenderProfileSvc,SD) {
                            $scope.input = {};

                            $scope.isNew = true;

                            $scope.modelTypes = [];
                            $scope.modelTypes.push({code:'mds',display:'Minimum Data Set',help:'A common set of data for exchange either by a Document or a Message'})
                            $scope.modelTypes.push({code:'resource',display:'Single Resource',help:'Will map to a single FHIR resource'})
                            $scope.input.type = $scope.modelTypes[0];
                            $scope.input.typeDescription = $scope.input.type.help;

                            RenderProfileSvc.getAllStandardResourceTypes().then(
                                function(data){
                                    $scope.allResourceTypes = data;
                            });

                            
                           // console.log(SD)
                            //note that a StructureDefinition is passed in when editing...
                            if (SD) {
                                $scope.SD = SD;
                                $scope.input.name = SD.name;
                                $scope.input.purpose = SD.purpose;
                                $scope.input.title = SD.title;
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
                                    })
                                    //
                                }
                            } else {
                                //$scope.input.name = 'myModel';
                                //$scope.input.short='A new model';
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


                            }

                            $scope.conformanceServer = appConfigSvc.getCurrentConformanceServer();
                            
                            $scope.checkModelExists = function(name) {
                                if (name.indexOf(' ')>-1) {
                                    modalService.showModal({},{bodyText:"The name cannot contain spaces"})
                                    return;
                                }

                                var url = $scope.conformanceServer.url + "StructureDefinition/"+name;
                                $scope.showWaiting = true;
                                $scope.canSave = false;
                                GetDataFromServer.adHocFHIRQuery(url).then(
                                    function(data){

                                        if (Utilities.isAuthoredByClinFhir(data.data)) {
                                            modalService.showModal({},{bodyText:"There's already a profile with this name. If you carry on. it will be replaced."})
                                        } else {
                                            modalService.showModal({},{bodyText:"Sorry, there's already a profile with this name"})
                                        }

                                    },function(err){
                                        console.log(err);
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
                                vo.name = $scope.input.name;
                                vo.title = $scope.input.title;
                                vo.purpose = $scope.input.purpose || 'purpose';
                                vo.SD = $scope.SD;
                                vo.baseType = $scope.input.baseType;       //if a base type was selected
                                vo.mapping = $scope.input.mapping;
                                vo.type = $scope.input.type.code;

                                $scope.$close(vo);
                            }
                        },resolve : {
                            SD: function () {          //the default config
                                return SD;
                        }}

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

                                console.log(result);
                               

                                //this is new
                                $scope.rootName = result.name;      //this is the 'type' of the logical model - like 'Condition'

                                var rootNode = { "id" : $scope.rootName, "parent" : "#", "text" : result.name,state:{opened:true},
                                    data : {name:"root",path:$scope.rootName,isRoot:true,min:1,max:'1'} };

                                rootNode.data.header = result;      //header based data. keep it in the first node...
                                $scope.treeData =  [rootNode]
                                $scope.isDirty = true;      //as this has not beed saved;

                                //if the user specified a base type, then pre-populate a model from that base
                                if (result.baseType) {
                                    logicalModelSvc.createFromBaseType($scope.treeData,result.baseType.name,$scope.rootName).then(
                                        function(){
                                            drawTree();
                                            makeSD();
                                            //add it to the list so we can see it
                                            $scope.bundleModels.entry.push({resource:$scope.SD})
                                            $scope.currentSD = angular.copy($scope.SD);     //keep a copy so that we can return to it from the history..
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
                                    $scope.currentSD = angular.copy($scope.SD);     //keep a copy so that we can return to it from the history..
                                }
                                makeSD();
                            }

                        })
                
            };

            $scope.dataTypes = resourceCreatorSvc.getDataTypesForProfileCreator();

            $scope.save = function() {
                
                var url = $scope.conformanceServer.url + "StructureDefinition/" + $scope.SD.id;
                $scope.showWaiting = true;
                $http.put(url,$scope.SD).then(
                    function(data) {
                        //console.log(data)
                        if (!$scope.initialLM) {
                            //if there wasn't a model passed in, re-load the list
                            loadAllModels();
                        }

                        $scope.isDirty = false;
                        loadHistory($scope.SD.id);      //that way we get the metadata added by the server...
                        modalService.showModal({},{bodyText:"The model has been updated. You may continue editing."})
                    },
                    function(err) {
                        //console.log(err)
                        $scope.error = err;
                        modalService.showModal({},{bodyText:"Sorry, there was an error saving the profile. View the 'Error' tab above for details."})
                    }
                ).finally(function(){
                    $scope.showWaiting = false;
                })
            };

            $scope.selectModel = function(entry,index) {
                if ($scope.isDirty) {
                    var modalOptions = {
                        closeButtonText: "No, don't lose changes",
                        actionButtonText: 'Yes, select this model, abandoning changes',
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

                function selectEntry(entry) {
                    delete $scope.modelHistory;
                    $scope.isDirty = false;
                    $scope.treeData = logicalModelSvc.createTreeArrayFromSD(entry.resource)
                    //console.log($scope.treeData)
                    $scope.rootName = $scope.treeData[0].id;        //the id of the first element is the 'type' of the logical model
                    drawTree();
                    makeSD();
                    $scope.currentSD = angular.copy($scope.SD);     //keep a copy so that we can return to it from the history..
                    loadHistory($scope.rootName);

                    var refChat = firebase.database().ref().child("chat").child($scope.rootName);
                    refChat.on('value', function(snapshot) {
                        console.log(snapshot.val());
                        var data = snapshot.val();
                        if (! data) {
                            //this will be the first chat for this model. Create the base..
                            var key = $scope.rootName;      //the key for this particular models chat in the database
                            var conv = {path : key,user: {email:'a@b'},children:[]}
                            var update = {};
                            update[key] = conv;

                            firebase.database().ref().child("chat").update(update)

                            $scope.input.newCommentboxInx = -1;
                            $scope.input.modelChatData = conv;      //the format for storage
                            $scope.input.modelChat = logicalModelSvc.generateChatDisplay(conv); //the format for display

                        } else {
                            $scope.input.newCommentboxInx = -1;
                            $scope.input.modelChatData = data;
                            $scope.input.modelChat = logicalModelSvc.generateChatDisplay(data);
                        }

                    });

                    console.log(refChat);

                    /*
                    logicalModelSvc.getModelHistory($scope.rootName).then(
                        function(data){
                            console.log(data.data)
                            $scope.modelHistory = data.data;
                        },
                        function(err) {
                            alert(angular.toJson(err))
                        }
                    )
                    */


                }



            };
            
            function loadHistory(id) {
                logicalModelSvc.getModelHistory(id).then(
                    function(data){
                        //console.log(data.data)
                        $scope.modelHistory = data.data;
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

            $scope.addNode = function() {
                var parentPath = $scope.selectedNode.data.path;
                editNode(null,parentPath);         //will actually create a new node

            };

            $scope.editNode = function() {
                var parentPath = $scope.selectedNode.data.path;
                editNode($scope.selectedNode,parentPath);         //will edit the node
                //$scope.isDirty = true;
            };

            //edit or add a new element to the model
            var editNode = function(nodeToEdit,parentPath) {
                $uibModal.open({
                    templateUrl: 'modalTemplates/editLogicalItem.html',
                    size: 'lg',
                    controller: function($scope,allDataTypes,editNode,parentPath,findNodeWithPath,rootForDataType,igSvc,references){
                        $scope.references = references;
                        console.log(references);
                        $scope.rootForDataType = rootForDataType;
                        $scope.canSave = true;
                        $scope.allDataTypes = allDataTypes;
                        $scope.parentPath = parentPath;
                        $scope.vsInGuide = igSvc.getResourcesInGuide('valueSet');       //so we can show the list of ValueSets in the IG
                        $scope.input = {};
                        //$scope.input.name = 'NewElement';
                        //$scope.input.short='This is a new element';
                        //$scope.input.description = 'detailed notes about the element'
                        $scope.input.dataType = $scope.allDataTypes[0];
                        $scope.input.multiplicity = 'opt';

                        if (editNode) {
                            //editing an existing node
                            var data = editNode.data;
                            $scope.input.name = data.name;
                            $scope.input.short= data.short;
                            $scope.input.description = data.description;
                            $scope.input.comments = data.comments;
                            $scope.input.mapping = data.mapping;
                            if (data.min == 0) {
                                $scope.input.multiplicity = 'opt';
                                if (data.max == '*') {$scope.input.multiplicity = 'mult'}
                            }
                            if (data.min == 1){
                                $scope.input.multiplicity = 'req';
                                if (data.max == '*') {$scope.input.multiplicity = 'multreq'}
                            }

                            var dt = data.type[0].code;     //only the first datatype (we only support 1 right now)
                            $scope.allDataTypes.forEach(function(dt1){
                                if (dt1.code == dt) {
                                    $scope.input.dataType = dt1;
                                }
                            });

                            //set the dropdown if this is a valueset from the IG...
                            if (data.selectedValueSet && data.selectedValueSet.vs){
                                $scope.isCoded = true;
                                $scope.vsInGuide.forEach(function(vs){
                                    if (vs.sourceUri ==data.selectedValueSet.vs.url) {
                                        $scope.input.vsFromIg = vs
                                    }
                                })
                            }


                            $scope.selectedValueSet = data.selectedValueSet;



                        }

                        $scope.checkName = function(){
                            $scope.canSave = true;
                            if (! $scope.input.name || $scope.input.name.indexOf('0') > -1) {
                                $scope.canSave = false;
                                modalService.showModal({},{bodyText:"The name cannot have spaces in it. Try again."})
                            }

                            var pathForThisElement = parentPath + '.'+$scope.input.name;
                            var duplicateNode = findNodeWithPath(pathForThisElement)
                            if (duplicateNode) {
                                $scope.canSave = false;
                                   modalService.showModal({},{bodyText:"This name is a duplicate of another and cannot be used. Try again."})
                                } //else {
                                   // $scope.canSave = true;
                               // }
                            //console.log(duplicateNode)
                        };

                        $scope.save = function() {
                            var vo = {};
                            vo.name = $scope.input.name;
                            vo.short = $scope.input.short;
                            vo.description = $scope.input.description || 'definition';
                            vo.comments = $scope.input.comments;
                            vo.mapping = $scope.input.mapping;
                            vo.type = [{code:$scope.input.dataType.code}];
                            vo.editNode = editNode;
                            vo.parentPath = parentPath;
                            //coded elements...
                            if ($scope.isCoded) {
                                vo.selectedValueSet = $scope.selectedValueSet;
                            }

                            //for a reference type...
                            if ($scope.input.dataType.code == 'Reference') {
                                vo.referenceUri = $scope.input.referenceFromIg.resource.url;
                                console.log($scope.input.referenceFromIg)
                            }

                            switch ($scope.input.multiplicity) {
                                case 'mult' :
                                    vo.min =0; vo.max='*';
                                    break;
                                case 'opt' :
                                    vo.min =0; vo.max='1';
                                    break;
                                case 'req' :
                                    vo.min =1; vo.max='1';
                                    break;
                                case 'multreq' :
                                    vo.min =1; vo.max='*';
                                    break;
                            }

                            //input.referenceFromIg
                            
                            $scope.$close(vo);
                        };
                        
                        $scope.setDataType = function(dt) {
                            $scope.dt = dt;
                            console.log(dt);
                            $scope.isCoded = false;
                            if (dt.isCoded) {
                                $scope.isCoded = true;
                            }
                            
                            
                        }
                        
                        $scope.selectVsFromServer = function(){
                            $uibModal.open({
                                backdrop: 'static',      //means can't close by clicking on the backdrop.
                                keyboard: false,       //same as above.
                                templateUrl: 'modalTemplates/vsFinder.html',
                                size: 'lg',
                                controller: function ($scope, appConfigSvc, GetDataFromServer) {
                                    //this code is all from vsFinderCtrl controller - for some reason I can't reference it from here...
                                    //and newExtensionDefinition
                                    $scope.input = {};

                                    var config = appConfigSvc.config();
                                    $scope.termServer = config.servers.terminology;

                                    $scope.input.arStrength = ['required', 'extensible', 'preferred', 'example'];
                                    $scope.input.strength = 'preferred'; //currentBinding.strength;


                                    $scope.select = function () {

                                        $scope.$close({
                                            vs: $scope.input.vspreview,
                                            strength: $scope.input.strength
                                        });
                                    };

                                    //find matching ValueSets based on name
                                    $scope.search = function (filter) {
                                        $scope.showWaiting = true;
                                        delete $scope.message;
                                        delete $scope.searchResultBundle;

                                        var url = $scope.termServer + "ValueSet?name=" + filter;
                                        $scope.showWaiting = true;
                                        GetDataFromServer.adHocFHIRQuery(url).then(
                                            function (data) {
                                                $scope.searchResultBundle = data.data;
                                                if (!data.data || !data.data.entry || data.data.entry.length == 0) {
                                                    $scope.message = 'No matching ValueSets found'
                                                }
                                            },
                                            function (err) {
                                                alert(angular.toJson(err))
                                            }
                                        ).finally(function () {
                                            $scope.showWaiting = false;
                                        })
                                    };
                                }
                            }).result.then(
                                function (vo) {
                                    //vo is {vs,strength}
                                    console.log(vo)
                                    $scope.selectedValueSet = vo;
                                    dt.vs = vo;         //save the valueset against the datatype
                                }
                            )
                        };

                        $scope.selectVsFromIg = function(){
                            var vs = $scope.input.vsFromIg;
                            var vo={vs:{url:vs.sourceUri,name:vs.name},strength:'preferred'}
                            $scope.selectedValueSet = vo;
                            dt.vs = vo;

                            console.log(vo)

                        }



                    },
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
                        }
                    }
                }).result.then(
                    function(result) {

                        console.log(result)

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

                            
                            //delete $scope.selectedNode;
                            $scope.selectedNode = newNode;

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
                        

                        //set the path of the element based on the name - and the parent names up th ehierarchy..
                        function setPath(parentPath,parentId) {
                            $scope.treeData.forEach(function(node){
                                if (node.parent == parentId) {
                                    var childPath = parentPath + '.' + node.data.name;
                                    //console.log(childPath);
                                    node.data.path = childPath;
                                    setPath(childPath,node.id)
                                }
                            })

                        }


                    })
                };

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
                    //first assemble list of nodes to remove
                    var idToDelete = $scope.selectedNode.id;
                    var lst = [idToDelete];

                    findChildNodes(lst,idToDelete);     //all the child nodes (including their children) of the element to be removed
                    //console.log(lst);

                    //now create a new list - excluding the ones to be deleted
                    var newList = [];
                    $scope.treeData.forEach(function(node){
                        if (lst.indexOf(node.id) == -1) {
                            newList.push(node);
                        }
                    });

                    $scope.treeData = newList;
                    delete $scope.selectedNode;
                    drawTree();
                    makeSD();

                    $scope.isDirty = true;
                    $scope.currentSD = angular.copy($scope.SD);     //keep a copy so that we can return to it from the history..

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

                //console.log($scope.treeData);

                var ar = logicalModelSvc.reOrderTree($scope.treeData);

                //$scope.SD = logicalModelSvc.makeSD($scope,$scope.treeData);
                $scope.SD = logicalModelSvc.makeSD($scope,ar);
                
                createGraphOfProfile();     //update the graph display...

            };


            //exit from the history review
            $scope.exitHistory = function(){
                $scope.SD = $scope.currentSD;
                $scope.isHistory = false;

                //restore the current (working) version...
                $scope.treeData = logicalModelSvc.createTreeArrayFromSD($scope.SD)
                console.log($scope.treeData)
                $scope.rootName = $scope.treeData[0].id;        //the id of the first element is the 'type' of the logical model
                drawTree();
                makeSD();

            };

            $scope.moveUp = function(){
                var path = $scope.selectedNode.data.path;
                var pos = findPositionInTree(path);     //the location of the element we wish to move in the array
                console.log(pos);
                if (pos > 0) {
                    var lst = getListOfPeers(path);
                    if (lst[0].data.path !== path) {
                        //so we're not the first... - need to find the one to shift above...
                        for (var i=0; i < lst.length; i++) {
                            if (lst[i].data.path == path) {
                                //yes! we've got the one to move above, now where is it in the tree?
                                var pos1 = findPositionInTree(lst[i-1].data.path);    //this marks where to do the insert
                                removedBranch = pruneBranch(path);
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
                    removedBranch = pruneBranch(path);      //prune the list
                    var insertPos = $scope.treeData.length; //the bottom
                    insertBranch(removedBranch,insertPos);
                    $scope.isDirty = true;
                    $scope.treeIdToSelect = findNodeWithPath(path).id;
                    drawTree();
                    makeSD();

                } else {
                    //insert above the secone one down...
                    var pathToInsertAbove = lst[placeInList+2].data.path;   //the node we'll insert above
                    removedBranch = pruneBranch(path);      //prune the list
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
                console.log(arChildren)
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

            //are the 2 paths siblings (ie under the same parent)
            areSiblingsDEP = function(path1,path2){
                var ar1 = path1.split('.')
                var ar2 = path2.split('.')
                if (ar1.length !== ar2.length) {return false;}
                ar1.pop();
                ar2.pop();
                if (ar1.join('.') !== ar2.join('.')) {return false;}
                return true;

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
                

                $('#lmTreeView').jstree('destroy');
                $('#lmTreeView').jstree(
                    {'core': {'multiple': false, 'data': $scope.treeData, 'themes': {name: 'proton', responsive: true}}}
                ).on('changed.jstree', function (e, data) {
                    //seems to be the node selection event...

                    //console.log(data)
                    if (data.node) {
                        $scope.selectedNode = data.node;
                    }



                                //used in the html template...

                    $scope.$digest();       //as the event occurred outside of angular...



                }).on('redraw.jstree', function (e, data) {


                    //console.log('redraw')

                    if ($scope.treeIdToSelect) {
                        $("#lmTreeView").jstree("select_node", "#"+$scope.treeIdToSelect);

                       // $scope.selectedNode = findNodeWithPath(path)
                        delete $scope.treeIdToSelect
                    }


                    if ($scope.treeData.length > 0) {
                        $scope.$broadcast('treebuilt');
                        $scope.$digest();       //as the event occurred outside of angular...
                    }

                });


            }

            //drawTree()
    });
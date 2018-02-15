
angular.module("sampleApp")
    .controller('builderCtrl',
        function ($scope,$http,appConfigSvc,$q,GetDataFromServer,resourceCreatorSvc,RenderProfileSvc,builderSvc,
                  $timeout,$localStorage,$filter,profileCreatorSvc,modalService,Utilities,$uibModal,$rootScope,
                  $firebaseObject,logicalModelSvc,ResourceUtilsSvc,markerSvc,sbHistorySvc) {

            $scope.input = {};
            $scope.input.dt = {};   //data entered as part of populating a datatype
            $scope.appConfigSvc = appConfigSvc;
            $scope.ResourceUtilsSvc = ResourceUtilsSvc;     //for the 1 line summary..
            $scope.thingToDisplay = 'scenario';
            $scope.builderSvc = builderSvc;

            GetDataFromServer.registerAccess('scnBld');


            //a useful function to determine the browser storage being used -
            var localStorageSpace = function(){
                var allStrings = '';
                for(var key in window.localStorage){
                    if(window.localStorage.hasOwnProperty(key)){
                        allStrings += window.localStorage[key];
                    }
                }
                return allStrings ? 3 + ((allStrings.length*16)/(8*1024)) + ' KB' : 'Empty (0 KB)';
            };

            console.log(localStorageSpace());


            //allow the resource to be directly edited
            $scope.setupDirectEdit = function(){
                $scope.input.directEdit = angular.toJson($scope.currentResource,true)
            };

            $scope.cancelDirectEdit = function() {
                delete $scope.input.directEdit;
            }

            $scope.saveDirectEdit = function(contents){
                try {
                    var newResource = angular.fromJson(contents);
                } catch (ex) {
                    alert('This is not valid Json. Resource is not updated.')
                    return;
                }

                //find the entry in the contriner.bundle that has this resource (based on the id) and replace it..
                var replaced = false;
                for (var i=0; i < $scope.selectedContainer.bundle.entry.length; i++) {
                    var res = $scope.selectedContainer.bundle.entry[i].resource;
                    if (res.id == newResource.id) {
                        $scope.selectedContainer.bundle.entry[i].resource = newResource;
                        $scope.selectResource($scope.selectedContainer.bundle.entry[i]);    //set all the required varr
                        replaced = true;
                        break;
                    }
                }

                if (! replaced) {
                    alert("The Json was valid, but the id didn't match any of the resources in this scenario")
                }

                delete $scope.input.directEdit;
            };


            $scope.refreshScenarioFromServer = function(){
                $uibModal.open({
                    templateUrl: 'modalTemplates/refreshScenario.html',
                    size: 'lg',
                    controller: 'refreshScenarioCtrl',
                    resolve : {
                        container: function () {          //the default config
                            return $scope.selectedContainer;
                        }
                    }
                }).result.then(function(vo){
                    console.log(vo)
                })
            };

            $scope.showQuest = function(){
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
                            return $scope.currentSD
                        },
                        startResource : function() {
                            //note that the $scope.currentResource will be directly updated by new builder...
                            return $scope.currentResource;
                        },
                        bundle : function(){
                            //used for the references...
                            return $scope.selectedContainer.bundle;
                        },
                        title : function(){
                            return "Editing "+$scope.currentResource.resourceType;
                        },
                        container : function(){
                            //used for the references...
                            return $scope.selectedContainer;
                        }

                    }
                }) .result.then(
                    function(vo) {
                        drawResourceTree($scope.currentResource)    //as this is a reference, it gets updated automatically...

                    }
                );

                return;


                $uibModal.open({
                    templateUrl: 'modalTemplates/questionnaire.html',
                    size: 'lg',
                    controller: function($scope,Q,SD,bundle,title,resource){
                        console.log(Q)
                        $scope.Q = Q;
                        $scope.sd = SD;
                        $scope.bundle = bundle;
                        $scope.title = title;
                        $scope.resource = resource;
                    },
                    resolve : {
                        Q: function () {          //the default extension
                            return  $scope.Q;
                        },
                        SD : function(){
                            console.log($scope.currentSD)
                            return $scope.currentSD;
                        },
                        bundle : function(){
                            return $scope.selectedContainer.bundle
                        },
                        title : function() {
                            return 'Editing '+builderSvc.getCurrentResource().resourceType;
                        },
                        resource : function(){
                            return builderSvc.getCurrentResource()
                        }
                    }
                }).result.then(
                    function(result) {

                    })
            }

            //create a version of the bundle to display to the user and download...
            $scope.getBundleDisplay = function(bundle) {
                return builderSvc.makeDisplayBundle(bundle);
            };

            $scope.generateDocTree = function(){
                var treeData = builderSvc.makeDocumentTree($scope.selectedContainer.bundle)
                $('#docTreeView').jstree('destroy');
                $('#docTreeView').jstree(
                    {'core': {'multiple': false, 'data': treeData, 'themes': {name: 'proton', responsive: true}}}
                ).on('select_node.jstree', function (e, data) {
                    console.log(data)
                    delete $scope.currentResource;      //todo - there's a setResource() in the service too...

                    if (data.node.data && data.node.data.resource){
                        $scope.selectResource({resource:data.node.data.resource});

                    }
                    $scope.$digest()
                })
            }

            $scope.scoreBundle = function(ref) {
                $scope.markResult = markerSvc.mark($scope.selectedContainer,ref) ; //compare to first bundle - testing!
                //$scope.markResult = markerSvc.mark($scope.selectedContainer,$scope.builderBundles[0]) ; //compare to first bundle - testing!
            };

            $scope.makeElementsPopulatedReport = function(){
                var report = builderSvc.makeElementsPopulatedReport($scope.selectedContainer.bundle);
                $scope.populatedReport = report;
                console.log(report);
            };

            $scope.generateDocumentDEP = function(){
                var doc = builderSvc.generateDocument($scope.selectedContainer.bundle).doc
                $scope.generatedDocument = doc;
                var binary = {resourceType:'Binary'};
                //console.log(JSON.stringify(doc))
            };

            var idPrefix = 'cf-';   //prefix for the id. todo should probably be related to the userid in some way...
            //load the library. todo THis will become slow with large numbers of sets...
            function refreshLibrary() {
                builderSvc.loadLibrary($localStorage.builderBundles).then(
                    function(arContainer){
                        $scope.libraryContainer = arContainer;

                        $scope.referenceContainers = []; //reference bundles can be scored against
                        arContainer.forEach(function (container) {
                            if (container.category && container.category.code == 'reference') {
                                $scope.referenceContainers.push(container)
                            }
                        })
                    }
                );
            }

            refreshLibrary();       //initial load...

            //recording
            $scope.recording = false;

            $scope.tracker = [];    //tracker items for the currently selected resource...
            //when the resource changes, set the tracker array for that resource
            $scope.$watch(function(scope) { return scope.currentResource },
                function(newValue, oldValue) {
                    refreshTrackerDisplay(newValue)
                }
            );

            function refreshTrackerDisplay(resource) {
                if (resource && $scope.selectedContainer && $scope.selectedContainer.tracker) {
                    var trackId = resource.resourceType + "/" + resource.id;
                    $scope.tracker.length = 0;
                    $scope.selectedContainer.tracker.forEach(function (item) {
                        var resourceType = item.details.resourceType;
                        var id = resourceType + "/" + item.id;
                        if (id == trackId && (item.type == 'dt'|| item.type == 'link' )) {
                            $scope.tracker.push(item)
                        }
                    });
                }

                //console.log($scope.tracker)
            }

            $scope.showTrackerValueDEP = function(item){
                var ret = "<pre>" + angular.toJson(item.details.value,2) + "</pre>";
                return ret
            }


            //------------ scenario versioning

            $scope.toggleVersion = function(){
                $scope.selectedContainer.showVersion = ! $scope.selectedContainer.showVersion;
                console.log($scope.selectedContainer.showVersion)
            };

            //set the current bundle as a version...
            $scope.setNewScenarioVersion = function(){

                var modalOptions = {
                    closeButtonText: "No, I changed my mind",
                    actionButtonText: 'Yes, please create a version',
                    headerText: 'Save as a version',
                    bodyText: 'This will save the current scenario as a version. You can continue to change the scenario. '
                };

                modalService.showModal({}, modalOptions).then(
                    function (){
                        var currentBundle = angular.copy($scope.selectedContainer.bundle);
                        $scope.selectedContainer.history = $scope.selectedContainer.history || []
                        $scope.selectedContainer.history.push({bundle:currentBundle})
                        $scope.selectedContainer.index = $scope.selectedContainer.history.length -1;
                    }
                )
            };

            //select a particular version to display...
            $scope.selectScenarioVersion = function(inx) {

                console.log(inx);

                //the .bundle property is always the bundle version being displayed.
                //.index is where it is in the history. if it is the same as history.length-1 then it is editable...
                //when selecting a container we'll set the index to the last version (the editable one)

                if ($scope.selectedContainer.history) {
                    $scope.selectedContainer.index = inx;
                    $scope.selectedContainer.bundle = angular.copy($scope.selectedContainer.history[inx].bundle)

                    //if the current resource is in the selected container, then set it as the new current version (tracks the display nicely)
                    if ($scope.currentResource && $scope.selectedContainer.bundle.entry) {
                        var resourceId = $scope.currentResource.id;
                        delete $scope.currentResource;
                        var bundle = $scope.selectedContainer.bundle;

                        for (var i=0; i< bundle.entry.length; i++) {
                            var r = bundle.entry[i].resource;
                            if (r.id == resourceId) {
                                $scope.currentResource = r;
                                drawResourceTree(r)
                                break;
                            }
                        }
                    }

                }
                //

               // $scope.selectedContainer.bundle = hx.bundle;   //todo - need to save current bundle + prevent updates!!!
                makeGraph();
            };

            $scope.renameScenario = function(name){

                if (name) {
                    $scope.selectedContainer.name = name;
                    var user = logicalModelSvc.getCurrentUser();
                    if (user) {
                        $scope.selectedContainer.author = [user];
                    }
                    delete $scope.input.renameScenario;
                }

            };

            $scope.displayServers = "Conformance: " + appConfigSvc.getCurrentConformanceServer().name
                + "<div>Data: " + appConfigSvc.getCurrentDataServer().name + "</div>"
                + "<div>Term: " + appConfigSvc.getCurrentTerminologyServer().name + "</div>";
            $scope.showSelector = true;


            $scope.toggleGraphZoom = function(){
                if ($scope.graphZoom) {
                    $scope.leftPaneClass = "col-sm-2 col-md-2"
                    $scope.midPaneClass = "col-md-5 col-sm-5"
                    $scope.rightPaneClass = "col-md-5 col-sm-5";
                } else {
                    $scope.leftPaneClass = "hidden"
                    $scope.midPaneClass = "col-md-12 col-sm-12"
                    $scope.rightPaneClass = "hidden";
                }
                $scope.graphZoom = !$scope.graphZoom
            }

            $scope.toggleSelector = function(){
                if ($scope.showSelector) {
                    $scope.leftPaneClass = "col-sm-2 col-md-2"
                    $scope.midPaneClass = "col-md-5 col-sm-5"
                    $scope.rightPaneClass = "col-md-5 col-sm-5";
                } else {
                    $scope.leftPaneClass = "hidden"
                    $scope.midPaneClass = "col-md-7 col-sm-7"
                    $scope.rightPaneClass = "col-md-5 col-sm-5";
                }
                $scope.showSelector = !$scope.showSelector
            }
            $scope.toggleSelector()


            //inputMode hides the selector, reduces the mid panel and shows the current resource as well as the input

            $scope.inputTreeClass ="col-sm-5 col-md-5";
            $scope.inputDTSelectClass = "col-sm-7 col-md-7";
            $scope.inputResourceClass = "hidden";
            $scope.toggleInputMode = function(){
                if ($scope.inputMode) {
                    //turning inputmode off
                    $scope.leftPaneClass = "col-sm-2 col-md-2"
                    $scope.midPaneClass = "col-md-5 col-sm-5"
                    $scope.rightPaneClass = "col-md-5 col-sm-5";

                    $scope.inputTreeClass ="col-sm-5 col-md-5";
                    $scope.inputDTSelectClass = "col-sm-7 col-md-7"
                    $scope.inputResourceClass = "hidden";
                    $scope.showSelector = true;
                } else {
                    $scope.leftPaneClass = "hidden"
                    $scope.midPaneClass = "col-md-4 col-sm-4"
                    $scope.rightPaneClass = "col-md-8 col-sm-8";

                    $scope.inputTreeClass ="col-sm-3 col-md-3";
                    $scope.inputDTSelectClass = "col-sm-4 col-md-4";
                    $scope.inputResourceClass = "col-sm-5 col-md-5";
                }
                $scope.inputMode = ! $scope.inputMode;
            }


            //---------- login stuff
            //called whenever the auth state changes - eg login/out, initial load, create user etc.
            firebase.auth().onAuthStateChanged(function(user) {


                if (user) {
                    $rootScope.userProfile = $firebaseObject(firebase.database().ref().child("users").child(user.uid));
                    logicalModelSvc.setCurrentUser(user);


                    //return the practitioner resource that corresponds to the current user (the service will create if absent)
                    GetDataFromServer.getPractitionerByLogin(user).then(
                        function(practitioner){
                            //console.log(practitioner)
                            $scope.Practitioner = practitioner;


                        },function (err) {
                            //just swallow errors... alert(err)
                        }
                    );

                    delete $scope.showNotLoggedIn;


                } else {
                    //console.log('no user')
                    logicalModelSvc.setCurrentUser(null);
                    $scope.showNotLoggedIn = true;
                    delete $scope.Practitioner;

                }
            });

            $scope.firebase = firebase;

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

                    modalService.showModal({}, {bodyText: 'You have been logged out of clinFHIR'})

                }, function(error) {
                    modalService.showModal({}, {bodyText: 'Sorry, there was an error logging out - please try again'})
                });

            };

            //retrieve the categories for a sceanrio (will be the value of the DocumentReference.class
            builderSvc.getLibraryCategories().then(
               function(cs){
                   $scope.libraryCategories = cs
                   //problem with setting a default is that there are 2 dependany async operations...
                   //$scope.input.selectedLibraryCategory = cs.concept[0];    //to set the default in the library
                   //$scope.makeLibraryDisplayList($scope.input.selectedLibraryCategory);
                      // console.log(cs);
               },function(){
                    $scope.libraryCategories = {concept:[]}
                    $scope.libraryCategories.concept.push({code:'default',display:'Default'});
                }
            );

            $scope.changeSelectedScenarioConcept = function(category){
                $scope.selectedContainer.category = category;
            }

            $scope.makeLibraryDisplayList = function(category){
                delete $scope.selectedLibraryContainer;
                var code = category.code
                $scope.selectedLibraryList = [];
                if ($scope.libraryContainer) {
                    $scope.libraryContainer.forEach(function(container){
                        if (container.category && container.category.code) {
                            if (container.category.code == code) {
                                $scope.selectedLibraryList.push(container)
                            }
                        }
                    })
                }
            };

            $scope.togglePatientDisplay = function(){
                if ($scope.thingToDisplay == 'patient') {
                    $scope.thingToDisplay = 'scenario'
                } else {
                    $scope.thingToDisplay = 'patient'
                }
            };

            $scope.addExtensionDirectly = function() {
                //console.log($scope.hashPath)
                $uibModal.open({
                    templateUrl: 'modalTemplates/addExtension.html',
                   // size: 'lg',
                    controller: 'addExtensionCtrl',
                    resolve : {
                        resource: function () {          //the default config
                            return $scope.currentResource;
                        }
                    }
                }).result.then(function(vo){

                    console.log(vo);
                    var hp = angular.copy($scope.hashPath);
                    if (vo.isModifier) {
                        hp.path += '.modifierExtension';
                    } else {
                        hp.path += '.extension';
                    }


                    var insertPoint = $scope.currentResource;

                    builderSvc.addPropertyValue(insertPoint,
                        hp,
                        'extension',
                        {extValue:vo.extValue})

                    drawResourceTree($scope.currentResource)

                })

            }

            $scope.importResource = function() {
                $uibModal.open({
                    templateUrl: 'modalTemplates/importResource.html',
                    //size: 'lg',
                    controller: function($scope,modalService,resources,supportSvc,appConfigSvc) {
                        $scope.input = {};


                        $scope.import = function() {
                            var raw = $scope.input.raw;

                            var g = raw.indexOf('xmlns="http://hl7.org/fhir"') || raw.indexOf("xmlns='http://hl7.org/fhir'");
                            if (g > -1) {
                                //this is Xml (I think!) Use the Bundle endpoint
                                $scope.waiting = true;
                                var url = appConfigSvc.getCurrentConformanceServer().url+"Bundle";

                                var config = {headers:{'content-type':'application/fhir+xml'}}
                                $http.post(url,raw,config).then(
                                    function(data) {
                                        //the bundle was saved - now read it back form the server in Json format...
                                        var id = supportSvc.getResourceIdFromHeaders(data.headers)
                                        console.log(id)
                                        if (id) {
                                            url += "/"+id;
                                            config = {headers:{'accept':'application/fhir+json'}};
                                            $http.get(url).then(
                                                function(data){
                                                    //now we can import the bundle
                                                    importFromJson(data.data);
                                                }, function (err) {
                                                    var msg = "The bundle was saved Ok, but couldn't be retrieved from the server";
                                                    modalService.showModal({}, {bodyText:msg});
                                                    //$scope.$cancel()
                                                }
                                            ).finally(function(){
                                                $scope.waiting = false;
                                            });

                                        } else {
                                            var msg = "The bundle was saved Ok, but I couldn't determine which Id was assigned to it, so cannot impoty it. Sorry about that."
                                            modalService.showModal({}, {bodyText:msg});
                                        }
                                    },
                                    function(err) {

                                        var msg = "The server couldn't process the Xml. Is it valid FHIR and a valid bundle?";
                                        var config = {bodyText:msg}
                                        try {
                                            var oo = angular.fromJson(err.data);
                                            console.log(oo);
                                            config.oo = oo;
                                        } catch (ex){
                                            msg += angular.toJson(err);
                                        }

                                        modalService.showModal({}, config);
                                        $scope.waiting = false;
                                    }
                                )
                            } else {
                                importFromJson($scope.input.raw,$scope.input.stripText);
                            }

                        };

                        importFromJson = function(json,stripText) {
                            if ($scope.input.LM) {
                                //this is a logical model
                                try {
                                    var lm = angular.fromJson(json);

                                    $scope.$close({type:'lm',resource:lm});
                                } catch (ex) {
                                    alert("I don't think this is value JSON...")
                                }
                                return;

                            }


                            try {
                                var res = angular.fromJson(json)
                                if (stripText) {
                                    if (res && res.text && res.text.div) {
                                        res.text.div = "<div/>";
                                    }
                                }
                            } catch (ex) {
                                modalService.showModal({}, {bodyText:'This is not valid JSON'});
                                return;
                            }

                            delete res.id;      //we'll create our own
                            if (! res.resourceType) {
                                modalService.showModal({}, {bodyText:"The element 'resourceType' must exist."});
                                return;
                            }

                            var isValidResourceType;
                            resources.forEach(function(type){
                                if (res.resourceType == type.name) {
                                    isValidResourceType = true
                                }
                            });

                            if (! isValidResourceType) {
                                modalService.showModal({}, {bodyText:"The element 'resourceType' must be a valid resource type."});
                                return;
                            }

                            $scope.$close({resource:res});     //close the dialog, passing across the resource

                        }

                    },
                    resolve : {
                        resources: function () {          //the default config
                            return $scope.resources;
                        }
                    }
                }).result.then(function (vo) {
                    //the importer will return a resource that is the one to be selected...  (might have been a bundle)

                    if (vo.type == 'lm') {
                        //this is a logical model (not yet validated)
                        console.log(vo.resource)
                        selectLogicalModal(vo.resource)
                    } else {
                        var res = builderSvc.importResource(vo.resource,$scope,idPrefix);
                        $scope.displayMode = 'view';
                        if (res) {
                            $scope.selectResource(res,function(){
                                makeGraph();
                                drawResourceTree(res);
                                isaDocument();      //determine if this bundle is a document (has a Composition resource)
                                $scope.currentPatient = builderSvc.getPatientResource();
                                $rootScope.$emit('addResource',res);
                            });       //select the resource, indicating that it is a new resource...
                        }

                    }




                    //temp $scope.addNewResource(res.resourceType,res);

                })

            }

            //---------- related to document builder -------
            $rootScope.$on('docUpdated',function(event,composition){
                //console.log(composition)
                makeGraph();
            });

            function isaDocument() {
                $scope.isaDocument = false;
                delete $scope.compositionResource;

                $scope.selectedContainer.bundle.entry.forEach(function(entry){

                    if (entry.resource.resourceType =='Composition') {
                        entry.resource.section = entry.resource.section || [];
                        $scope.compositionResource = entry.resource;
                        $scope.isaDocument= true;

                        $scope.generatedHtml = builderSvc.makeDocumentText($scope.compositionResource,$scope.selectedContainer.bundle);


                    }
                })
            }

            //add a resource that was already on the server
            function addExistingResource(resource) {
                if (builderSvc.isVersionMostRecent($scope.selectedContainer)) {
                    builderSvc.addResourceToAllResources(resource)
                    $scope.selectedContainer.bundle.entry.push({resource:resource});
                    $scope.selectedContainer.bundle.entry.sort(function(a,b){
                        //$scope.resourcesBundle.entry.sort(function(a,b){
                        if (a.resource.resourceType > b.resource.resourceType) {
                            return 1
                        } else {
                            return -1
                        }
                    })
                    makeGraph();
                } else {
                    alert('not the current version')
                }

            }

            //view and change servers
            $scope.setServers = function(){
                $uibModal.open({
                    templateUrl: 'modalTemplates/setServers.html',
                    //size: 'lg',
                    controller: 'setServersCtrl'
                    }).result.then(function () {

                        refreshLibrary();   //as the data server may have changed
                })
            }


            $scope.findPatient = function(){
                delete $scope.resourcesFromServer;
                $uibModal.open({
                    backdrop: 'static',      //means can't close by clicking on the backdrop. stuffs up the original settings...
                    keyboard: false,       //same as above.
                    templateUrl: 'modalTemplates/searchForPatient.html',
                    size:'lg',
                    controller: 'findPatientCtrl'
                }).result.then(
                        function(resource){
                            //console.log(resource)
                            if (resource) {
                                setSelectedPatientFromServer(resource);
                                    /*
                                    $scope.currentPatient = resource;
                                    addExistingResource(resource)
                                    $scope.displayMode = 'view';
                                    //load any existing resources for this patient...
                                    getExistingData(resource)
                                    $scope.selectResource(resource,function(){
                                        $scope.waiting = false;
                                        makeGraph();
                                        drawResourceTree(resource);
                                        isaDocument();      //determine if this bundle is a document (has a Composition resource)

                                        $rootScope.$emit('addResource',resource);

                                    });       //select the resource, indicating that it is a new resource...
                                */
                            }

                        }
                )
            }

            function setSelectedPatientFromServer(resource) {
                if (resource) {
                    $scope.currentPatient = resource;
                    addExistingResource(resource)
                    $scope.displayMode = 'view';
                    //load any existing resources for this patient...
                    getExistingData(resource)
                    $scope.selectResource(resource,function(){
                        $scope.waiting = false;
                        makeGraph();
                        drawResourceTree(resource);
                        isaDocument();      //determine if this bundle is a document (has a Composition resource)

                        $rootScope.$emit('addResource',resource);

                    });       //select the resource, indicating that it is a new resource...
                }

            }

            $scope.downloadBundle = function(){


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
                            return $scope.getBundleDisplay($scope.selectedContainer.bundle);
                        },
                        notes : function () {
                            return "";
                        },
                        fileName : function () {
                            return "SB";
                        }
                    }

                })



                //$scope.downloadLinkJsonContent = window.URL.createObjectURL(new Blob([angular.toJson(container.bundle, true)], {type: "text/text"}));
                //$scope.downloadLinkJsonName = 'Scenario'; //container.name;
            }

            //note that the way we are recording validation is a non-compliant bundle...
            $scope.resetValidation = function(){
                //when a resource is altered, re-set the validation
                $scope.selectedContainer.bundle.entry.forEach(function(entry){
                    if (entry.resource.id == $scope.currentResource.id) {
                        delete entry.valid;
                    }
                })

            };

            $scope.validateAll = function(){
                var bundle = $localStorage.builderBundles[$scope.currentBundleIndex].bundle;
               // console.log(bundle);
                $scope.waiting = true;
                builderSvc.validateAll(bundle).then(
                    function(data){
                        //console.log(data.data)



                    },function(err){
                        console.log(err)

                    }
                ).finally(function(){
                    $scope.waiting = false;
                })



            }

            $scope.saveToFHIRServer = function() {

                var container = $localStorage.builderBundles[$scope.currentBundleIndex]
                var bundle = $localStorage.builderBundles[$scope.currentBundleIndex].bundle;

                var note = window.prompt("Enter a note about this update (This will be saved in a Provenance resource)");

                //builderSvc.addProvenance(container,note);    //add a provenance resource to the bundle

                if (container.server && container.server.data) {
                    //we recorded the data server that this bundle was created with
                    if (container.server.data.name !== appConfigSvc.getCurrentDataServer().name) {


                        var modalOptions = {
                            closeButtonText: "No, I changed my mind",
                            actionButtonText: 'Yes, please save it',
                            headerText: 'Different Data server',
                            bodyText: 'This bundle was created when a different data server was selected. Are you sure you wish to save to a different server? '
                        };

                        modalService.showModal({}, modalOptions).then(
                            function (){
                                saveX(bundle)
                            })

                    } else {
                        saveX(bundle)
                    }

                } else {
                    saveX(bundle)
                }


                function saveX(bundle) {

                    console.log(bundle);
                    $scope.waiting = true;
                    builderSvc.sendToFHIRServer(container,note).then(
                        function(data){
                            //console.log(data.data)




                            bundle.entry.forEach(function(entry){
                                entry.valid='saved'
                            })

                            //re-load the resources list if there's a patient...
                            if ($scope.currentPatient) {
                                getExistingData($scope.currentPatient)
                            }



                            modalService.showModal({}, {bodyText:'All the resources have been updated on the server.'});
                        },
                        function(err) {
                            modalService.showModal({}, {bodyText:'There was an error:'+angular.toJson(err)});
                            //console.log(err)
                        }
                    ).finally(function(){
                        $scope.waiting = false;
                    })

                }



            };

            $scope.validate = function(entry) {
                //console.log(entry);
                $scope.selectResource(entry)


                $scope.showWaiting = true;
                Utilities.validate(entry.resource).then(
                    function(data){
                        var oo = data.data;

                        entry.valid='yes'
                        delete entry.response;  //don't need the response if it passed validation...
                        //entry.response = {outcome:oo};


                    },
                    function(data) {
                        var oo = data.data;
                        entry.response = {outcome:oo};
                       // console.log(oo)
                        entry.valid='no'



                    }
                ).finally(function(){
                    $scope.waiting = false;
                })

            }

            //------------------------------------------------


            //called whenever the auth state changes - eg login/out, initial load, create user etc.
            firebase.auth().onAuthStateChanged(function(user) {
                //delete $scope.input.mdComment;
//console.log(user)
                if (user) {
                    //console.log(user)
                    $scope.user = {};
                    $scope.user.user = user;
                    $scope.user.profile = $firebaseObject(firebase.database().ref().child("users").child(user.uid));


                    //$rootScope.userProfile = $firebaseObject(firebase.database().ref().child("users").child(user.uid));

                    //logicalModelSvc.setCurrentUser(user);


                    //return the practitioner resource that corresponds to the current user (the service will create if absent)
                    GetDataFromServer.getPractitionerByLogin(user).then(
                        function(practitioner){
                            //console.log(practitioner)
                            $scope.user.practitioner = practitioner;

                        },function (err) {

                            // just swallow errors...alert(err)
                        }
                    );

                    delete $scope.showNotLoggedIn;


                } else {
                    //console.log('no user')
                    logicalModelSvc.setCurrentUser(null);
                    $scope.showNotLoggedIn = true;
                    delete $scope.Practitioner;
                    delete $scope.taskOutputs;
                    delete $scope.commentTask;
                    // No user is signed in.
                }
            });

            //datatypes for which there is an entry form
            $scope.supportedDt = ['decimal','integer','Coding','uri','ContactPoint','Identifier','CodeableConcept',
                'Quantity', 'string','code','date','Period','dateTime','Address','HumanName','Annotation','boolean',
                'instant','Attachment'];
            $scope.supportedDt.push('Dosage','positiveInt','unsignedInt');

            function getExistingData(patient) {
                delete $scope.resourcesFromServer;
                if (patient) {
                    //load any existing resources for this patient. Remove any resources currently in the scenario..
                    builderSvc.getExistingDataFromServer(patient).then(
                        //returns an object hash - type as hash, contents as bundle - eg allResources.Condition = {bundle}
                        function(data){
                            $scope.resourcesFromServer = data;


                            $scope.$broadcast('patientSelected',data);   //so the patient display controller (resourceViewerCtl) knows
                        },
                        function(err){
                            console.log(err)
                        })
                }
            }

            $scope.currentBundleIndex = 0;     //the index of the bundle currently being used


            //select the initial container
            if (! $localStorage.builderBundles) {
                $localStorage.builderBundles = [];
                $scope.currentBundleIndex = -1;

            } else {
                if ($localStorage.builderBundles.length > 0) {
                    $scope.selectedContainer = $localStorage.builderBundles[$scope.currentBundleIndex];

                    //set the .bundle property to the most recent version
                    builderSvc.setMostRecentVersionActive($scope.selectedContainer);

                    //create a hash (based on url) of all the resources in the
                    builderSvc.setAllResourcesThisSet($localStorage.builderBundles[$scope.currentBundleIndex].bundle);
                    $scope.currentPatient = builderSvc.getPatientResource();
                    getExistingData( $scope.currentPatient)
                    isaDocument();
                    //$rootScope.$emit('newSet',$scope.selectedContainer.bundle);     //eg for the tracker view
                }

            }

            $scope.resourceFromServerSelected = function(bundle, inx) {
                addExistingResource(bundle.entry[inx].resource);
                bundle.entry.splice(inx,1)
                bundle.total --;
            };

            $scope.builderBundles = $localStorage.builderBundles;   //all the bundles cached locally...

            //set the base path for linking to the spec
            switch (appConfigSvc.getCurrentConformanceServer().version) {
                case 2:
                    $scope.fhirBasePath="http://hl7.org/fhir/";
                    break;
                case 3:
                    $scope.fhirBasePath="http://build.fhir.org/";
                    break;
            }

            $scope.setDirty = function(){
                $scope.selectedContainer.isDirty = true;
            };

            $scope.newBundle = function() {


                $uibModal.open({
                    templateUrl: 'modalTemplates/newSet.html',
                    controller: 'addScenarioCtrl',
                    controllerDEP: function ($scope,GetDataFromServer,appConfigSvc,categories) {

                        $scope.canSave = true;
                        $scope.input = {};
                        $scope.categories = categories;     //categories in a ValueSet...
                        if (categories && categories.concept) {
                            $scope.input.category = categories.concept[0];
                        } else {
                            $scope.input.category = {code:'default',display:'Default',definition:'Default'}

                        }

                        $scope.findPatient = function(){
                            $uibModal.open({
                                backdrop: 'static',      //means can't close by clicking on the backdrop. stuffs up the original settings...
                                keyboard: false,       //same as above.
                                templateUrl: 'modalTemplates/searchForPatient.html',
                                size:'lg',
                                controller: 'findPatientCtrl'
                            }).result.then(
                            );
                        }



                        $scope.server = appConfigSvc.getCurrentDataServer();
                        $scope.checkName = function(){
                            if ($scope.name) {
                                //alert($scope.name)
                                $scope.canSave = true;
                            }

                        };

                        $scope.save = function(){
                            //represent the category as a Coding. $scope.category is a concept

                            var cat = {code:$scope.input.category.code,display:$scope.input.category.display}
                            cat.system = 'http://clinfhir.com/fhir/CodeSystem/LibraryCategories';   //todo get from appConfig
                            $scope.$close({name:$scope.input.name,description:$scope.input.description,category:cat})
                        }

                    },
                    resolve : {
                        categories: function () {          //the default config
                            return $scope.libraryCategories;
                        }
                    }

                }).result.then(function(vo){
                    //console.log(vo)
                    if (vo.name) {
                        delete $scope.isaDocument
                        var newBundle = {resourceType:'Bundle',type:'collection', entry:[]};
                        newBundle.id = idPrefix+new Date().getTime();

                        var newBundleContainer = {name:vo.name,bundle:newBundle};
                        newBundleContainer.description = vo.description;
                        //newBundleContainer.bundle.id = idPrefix+new Date().getTime();
                        newBundleContainer.isDirty = true;
                        newBundleContainer.isPrivate = true;
                        newBundleContainer.category = vo.category;
                        newBundleContainer.tracker = [];
                        newBundleContainer.history = [{bundle:newBundle}];
                        newBundleContainer.index = 0;
                        newBundleContainer.server = {data:appConfigSvc.getCurrentDataServer()};     //save the data server in use
                        $localStorage.builderBundles.push(newBundleContainer);
                        $scope.selectedContainer = newBundleContainer;
                        $scope.currentBundleIndex= $localStorage.builderBundles.length -1;


                        //for some reason, the first bundle is not displayed in the list...  There's probably a more elegant fix...
                        if ($scope.builderBundles.length == 0) {
                            $scope.builderBundles = $localStorage.builderBundles
                        }

                        //this will add the patient to the bundle (if there is one)
                        setSelectedPatientFromServer(vo.patient);


                        makeGraph();
                        delete $scope.currentResource;
                        delete $scope.currentPatient;
                        delete $scope.existingElements;
                        $rootScope.$emit('newSet',newBundleContainer);
                    }
                });



            };

            //called when a library entry is selected to view. may be redundant...
            $scope.selectLibraryContainer = function(container,inx){

                delete $scope.canDeleteLibraryEntry;

                $scope.currentLibraryIndex = inx;
                $scope.selectedLibraryContainer = container;


                    var vo = builderSvc.makeGraph(container.bundle) ;  //todo - may not be the right place...

                   // $scope.allReferences = vo.allReferences;                //all references in the entire set.

                    var graphDiv = document.getElementById('libraryGraph');
                    var options = {
                        physics: {
                            enabled: true,
                            barnesHut: {
                                gravitationalConstant: -10000,
                            }
                        }
                    };


                    $scope.libraryGraph = new vis.Network(graphDiv, vo.graphData, options);







                //

                var user = logicalModelSvc.getCurrentUser();
                if (user) {
                    //as don't have to log in to see scenarios

                    //todo - just for now. Eventually need some kind of security infrastructure...
                    if (user.email == 'david.hay25@gmail.com') {
                        $scope.canDeleteLibraryEntry = true;
                        return;
                    }

                    //if the author of the scenario is the same as the user then can delete
                    if (container.author && container.author.length > 0) {
                        if (container.author[0].display == user.email) {
                            $scope.canDeleteLibraryEntry = true;
                        }
                    }
                }


            };

            $scope.deleteScenario = function(container){

                var modalOptions = {
                    closeButtonText: "No, I changed my mind",
                    actionButtonText: 'Yes, please remove it',
                    headerText: 'Remove Library entry',
                    bodyText: 'Are you sure you wish to remove this scenario from the Library? Retrieving it is possible, but messy. '
                };

                modalService.showModal({}, modalOptions).then(
                    function (){

                        builderSvc.deleteLibraryEntry(container).then(
                            function(data){
                                var msg = "The library entry has been deleted. It's still there in the history of the entry, but you'll need to recover it using REST. Contact David Hay for details."
                                modalService.showModal({}, {bodyText:msg});
                                delete $scope.canDeleteLibraryEntry;
                                refreshLibrary();
                            },
                            function(err) {
                                var msg = "Sorry, there was a error deleting the entry. Details:" + angular.toJson(err)
                                modalService.showModal({}, {bodyText:msg});
                            }
                        )
                    }
                )




            }


            $scope.downloadFromLibrary = function(inContainer){
                //note that the entry is a DocumentReference with a bundle as an attachment...
                if (inContainer) {

                    var container = angular.copy(inContainer);
/*
                    //always set the .bundle to the most recent history..
                    if (container.history) {
                        container.index = container.history.length -1;
                        container.bundle = container.history[container.index].bundle;
                    }

                    */

                    var id = container.bundle.id;

                    //see if this set (based on the id) already exists.
                    var alreadyLocal = false;
                    $localStorage.builderBundles.forEach(function (item,inx) {
                        if (item.bundle.id == id) {
                            alreadyLocal = true;
                            modalService.showModal({}, {bodyText:'There is already a copy of this set downloaded. Selecting it now.'});
                            // $scope.resourcesBundle = item.bundle;
                            $scope.selectedContainer = item;
                            $scope.currentBundleIndex= inx;

                            $scope.thingToDisplay='scenario'
                        }
                    });

                    if (! alreadyLocal) {


                        //remove all the 'valid' propertis on entry...
                        container.bundle.entry.forEach(function (entry) {
                            delete entry.valid;
                        });



                        $localStorage.builderBundles.push(container);
                        //$localStorage.builderBundles.push(newBundle);
                        // $scope.resourcesBundle = newBundle.bundle;

                        $scope.selectedContainer = container;//newBundle;
                        $scope.currentBundleIndex= $localStorage.builderBundles.length -1;

                        builderSvc.setAllResourcesThisSet($localStorage.builderBundles[$scope.currentBundleIndex].bundle);  //needed for the 'resource from reference' functionity
                        makeGraph();
                        delete $scope.currentResource;      //so the previous resource details aren't being shown...
                        //$scope.libraryVisible = false;      //hide the library
                        $scope.thingToDisplay='scenario'
                        isaDocument();      //see if this set is a document (has a Composition resource)
                        modalService.showModal({}, {bodyText:'The set has been downloaded from the Library. You can now edit it locally.'});

                        refreshLibrary();       //so the download link is disabled...


                    } 
                } else {
                    alert('There was a problem retrieving the set (id='+ dr.id + ") from the library");
                }
                
              


            };

            //save the current scenario to the library
            $scope.saveToLibrary = function(){

                var user = logicalModelSvc.getCurrentUser();

                if (! user) {
                    modalService.showModal({}, {bodyText:'You must be logged in to save to the Library.'});
                    return;
                }

                var container = $localStorage.builderBundles[$scope.currentBundleIndex];

                if (container.author && container.author.length > 0) {
                    //There's an auther so make sure this author is one of them. Allow..
                    if (user.email !== container.author[0].display) {
                        modalService.showModal({}, {bodyText:'Only the author of the scenario can update it to the Library.'});
                        return;
                    }

                }



                builderSvc.saveToLibrary($localStorage.builderBundles[$scope.currentBundleIndex],$scope.user).then(
                    function (data) {

                        $scope.selectedContainer.isDirty = false;
                        modalService.showModal({}, {bodyText:'The set has been updated in the Library. You can continue editing.'});
                        refreshLibrary();

                    },function (err) {
                        modalService.showModal({}, {bodyText:'Sorry, there was an error updating the library:' + angular.toJson(err)})
                        console.log(err)
                    }
                );

            };

            //---------

            //select a bundle from the local list
            $scope.selectBundle = function(inx){
                delete $scope.hidePatientFlag;          //flag to hide the patient resource...
                delete $scope.resourcesFromServer;
                delete $scope.markResult;
                delete $scope.input.renameScenario;
                delete $scope.generatedHtml;

                $scope.currentBundleIndex = inx;

                //get the container from the local store... 'builderBundles' would be better named 'builderContainers'
                $scope.selectedContainer = $localStorage.builderBundles[$scope.currentBundleIndex];

                builderSvc.setMostRecentVersionActive( $scope.selectedContainer);

                //createDownLoad($scope.selectedContainer)

                builderSvc.setAllResourcesThisSet($localStorage.builderBundles[$scope.currentBundleIndex].bundle);
                $scope.currentPatient = builderSvc.getPatientResource();

                getExistingData($scope.currentPatient)



                makeGraph();
                delete $scope.currentResource;
                isaDocument();      //determine if this bundle is a document (has a Composition resource)
                $rootScope.$emit('newSet',$scope.selectedContainer.bundle);
            }

            $scope.displayMode = 'view';    //options 'new', 'view'
            $scope.setDisplayMode = function(mode) {
                $scope.displayMode = mode;
            }

            //displays the data entry screen for adding a datatype value
            $scope.addValueForDt = function(hashPath,dt,currentValue) {


                console.log(currentValue)
                //if this is not adding to the root, check that there is a branch selected...
                var ar = hashPath.path.split('.');
                if (ar.length > 2 &&  $scope.existingElements.list.length == 0) {

                    if (ar.length ==3 && hashPath.elementInfo.isExtension) {
                        //this is a hack to allow extensions to be added to properties immediately off the root...
                    } else {

                        //if the parent is not multiple, then it can go through (Encounter.hospitilization)
                        var parentPath = ar;
                        var parentName = parentPath.pop();
                        var parentInfo = builderSvc.getEDInfoForPath(parentPath.join('.'));
                        if (parentInfo.isMultiple) {
                            //we need to create a branch to add this to...

                            //todo this assumes that is off the root - FIX !!!
                            var vo = builderSvc.makeInsertPoint($scope.currentResource,hashPath.path);//,insertPoint);
                            //vo.insertPoint[parentPath[parentPath.length-1]] = {};
                            /* TODO DON'T REMOVE YET!!
                            var msg = 'Please create a reference to a resource on this branch. ' +
                                'After that, you can add other datatypes and create new branches as desired';
                            modalService.showModal({}, {bodyText:msg});
                            return;
                            */
                        }
                    }
                }

                //set the insert point based on the path selected (if any)
                var insertPoint = $scope.currentResource;

                //if the immediate predecessor is a BBE with a multiplecity of 1, then adjust the insert point (careplan.activity.detail)
                var ar = hashPath.path.split('.');

                //if we're not inserting onto the root, then we need to set the insert point based on the path & selected index
                if (ar.length > 2) {

                    if ($scope.input.selectedExistingElement > -1) {
                        insertPoint = $scope.existingElements.list[$scope.input.selectedExistingElement];
                    }

                    //this tests for an insert point not on the root, where the immediate predecessor is a BBE with a multiplecity of 1 (careplan.activity.detail)
                    ar.pop();       //pop off the segment we are inserting at
                    var testPath = ar.join('.');
                    var info = builderSvc.getEDInfoForPath(testPath);   //this is the parent

                    var segmentName = ar[ar.length-1];
/*
                    //this is a trial for nutritionrequest
                    if (ar.length == 3) {
                        var pSegName = ar[1];
                        insertPoint = insertPoint[pSegName]
                    }
*/

                    if (info.isBBE) {

                        if (! info.isMultiple) {
                            //var segmentName = ar[ar.length-1];
                            if (insertPoint[segmentName]) {
                                insertPoint = insertPoint[segmentName]
                            } else {
                                insertPoint[segmentName] = {};
                                insertPoint = insertPoint[segmentName]
                            }
                        } else {
                            //eg Organization.contact

                            if (insertPoint[segmentName]) {
                                insertPoint = insertPoint[segmentName][0]
                            }
                        }
                    }

                    //if this is an extension, then the insertPoint moves down one...
                    //todo - not that happy with this...
                    if (hashPath.elementInfo.isExtension) {

                        if (angular.isObject(insertPoint)) {
                            if (insertPoint[segmentName]) {
                                insertPoint = insertPoint[segmentName]
                            } else {
                                insertPoint[segmentName] = {};
                                insertPoint = insertPoint[segmentName]
                            }
                        } else {

                        }
                    }
                }

                if ($scope.supportedDt.indexOf(dt) > -1) {
                    $scope.selectedContainer.isDirty = true;
                    delete $scope.input.dt;
                    $scope.resetValidation();

                    $uibModal.open({
                        templateUrl: 'modalTemplates/addPropertyInBuilder.html',
                        size: 'lg',
                        controller: 'addPropertyInBuilderCtrl',
                        resolve : {
                            dataType: function () {          //the default config
                                return dt;
                            },
                            hashPath: function () {          //the default config
                                return hashPath;
                            },
                            insertPoint: function () {          //the point where the insert is to occur ...
                                return insertPoint
                                //return $scope.currentResource;
                            },
                            vsDetails: function () {          //the default config
                                return $scope.vsDetails;
                            },
                            expandedValueSet: function () {          //the default config
                                return $scope.expandedValueSet;
                            },
                            currentValue : function(){
                                return currentValue;
                            },
                            currentStringValue : function() {
                                return ""
                            },
                            container : function() {
                                return $scope.selectedContainer;
                            }, resource : function(){
                                return $scope.currentResource;
                            }
                        }
                    }).result.then(function () {
                        drawResourceTree($scope.currentResource);   //don't need to update the graph...
                        builderSvc.updateMostRecentVersion( $scope.selectedContainer,$scope.selectedContainer.bundle)
                        refreshTrackerDisplay($scope.currentResource);
                    })

                }


            };
            //adds a new value to a property

            $scope.selectConceptFromVSBrowser = function(concept) {
                console.log(concept)
            }

            //edit the resource text
            $scope.editResource = function(resource){
                $scope.selectedContainer.isDirty = true;

                var vo = {manual:''}
                if (resource.text && resource.text.div) {
                    vo = builderSvc.splitNarrative(resource.text.div)  //return manual & generated text
                }


                var modalOptions = {
                    closeButtonText: "Cancel",
                    actionButtonText: 'Save',
                    headerText: 'Edit resource text',
                    bodyText: 'Current text:',
                    userText :   vo.manual          //pass in the manual text only...
                };



                modalService.showModal({}, modalOptions).then(
                    function (result) {

                        if (result.userText) {
                            //create the text and add the manual marker (to separate this from generated text)
                            var narrative = builderSvc.addGeneratedText(result.userText,vo.generated);

                            resource.text.div = narrative; //$filter('addTextDiv')(narrative);

                            //resource.text.div = $filter('addTextDiv')(result.userText + builderSvc.getManualMarker() + vo.generated);
                            $rootScope.$emit('resourceEdited',resource);
                            makeGraph();
                        }


                    }
                );



            };

            //remove a bundle set...
            $scope.deleteBundle = function(inx) {



                var modalOptions = {
                    closeButtonText: "No, I changed my mind",
                    actionButtonText: 'Yes, please remove',
                    headerText: 'Remove resource set',
                    bodyText: 'Are you sure you wish to remove this scenario from the local cache?'
                };

                if ($scope.selectedContainer.isDirty) {
                    modalOptions.bodyText += " (There are unsaved changes you know...)"
                }


                modalService.showModal({}, modalOptions).then(
                    function () {
                        $rootScope.$emit('newSet');     //clears the current section...

                        delete $scope.currentResource;
                        $localStorage.builderBundles.splice(inx,1)   //delete the bundle from local storage
                        $scope.currentBundleIndex = 0; //set the current bundle to the first (default) one
                        if ($localStorage.builderBundles.length == 0) {
                            //no bundles left
                            $localStorage.builderBundles = []
                           // delete $scope.resourcesBundle;
                            delete $scope.selectedContainer;
                        } else {
                            //$scope.resourcesBundle = $localStorage.builderBundles[$scope.currentBundleIndex].bundle;
                            $scope.selectedContainer = $localStorage.builderBundles[$scope.currentBundleIndex];
                            makeGraph();
                        }


                        refreshLibrary();       //so the download link is disabled...


                    }
                );





                //$localStorage.builderBundle = {resourceType:'Bundle',entry:[]}//
                //$scope.resourcesBundle = $localStorage.builderBundle


            }

            $scope.removeResource = function(resource) {
                //remove this resource from the bundle
                $scope.selectedContainer.isDirty = true;

                var modalOptions = {
                    closeButtonText: "No, don't remove",
                    actionButtonText: 'Yes, please remove',
                    headerText: 'Remove resource',
                    bodyText: 'Are you sure you want to remove this resource (Any references to it will NOT be removed)'
                };

                modalService.showModal({}, modalOptions).then(
                    function (result) {
                        var inx = -1;
                        for (var i=0; i < $scope.selectedContainer.bundle.entry.length; i++) {
                            var r = $scope.selectedContainer.bundle.entry[i].resource;
                            if (r.resourceType == resource.resourceType && r.id == resource.id) {
                                inx = i;
                                break;
                            }
                        }
                        if (inx > -1) {
                            $scope.selectedContainer.bundle.entry.splice(inx,1);
                            builderSvc.updateMostRecentVersion( $scope.selectedContainer,$scope.selectedContainer.bundle)
                            makeGraph();
                            delete $scope.currentResource;
                            isaDocument();      //may not still be a document...
                        }

                    }
                );


            };

            //hide resources that aren't attached to the current resource
            $scope.hideOthers = function() {
                delete $scope.hidePatientFlag;
                makeGraph($scope.currentResource)
            };

            //show all resources
            $scope.showAllInGraph = function(){
                delete $scope.hidePatientFlag;
                makeGraph()
            };

            //hide the patient
            $scope.hidePatient = function() {
                $scope.hidePatientFlag = true;
                makeGraph($scope.currentPatient,true)

            };

            //generate the graph of resources and references between them
            makeGraph = function(centralResource,hideMe) {

                //save the previous state of hideMe. Not the most elegant, I must admit...
                hideMe = $scope.hidePatientFlag;
                if (hideMe) {
                    centralResource = $scope.currentPatient;
                }

                var showText = true;

                $scope.filteredGraphView = false;
                if (centralResource) {
                    $scope.filteredGraphView = true;
                }

                if ($scope.selectedContainer && $scope.selectedContainer.bundle) {
                    var vo = builderSvc.makeGraph($scope.selectedContainer.bundle,centralResource,hideMe,showText) ;  //todo - may not be the right place...

                    $scope.allReferences = vo.allReferences;                //all references in the entire set.

                    var container = document.getElementById('resourceGraph');
                    var options = {
                        physics: {
                            enabled: true,
                            barnesHut: {
                                gravitationalConstant: -10000,
                            }
                        }
                    };

                    var optionsDEP = {
                        physics: {
                            enabled: true,
                            barnesHut: {
                                gravitationalConstant: -10000,
                            },
                            stabilization : {
                                enabled : false
                            }
                        }
                    };

                    $scope.chart = new vis.Network(container, vo.graphData, options);
                    $scope.chart.on("click", function (obj) {



                        var nodeId = obj.nodes[0];  //get the first node


                            var node = vo.graphData.nodes.get(nodeId);

                            if (node.cf) {
                                $scope.selectResource(node.cf.resource)
                            } else {
                                var edgeId = obj.edges[0];
                                var edge = vo.graphData.edges.get(edgeId);

                                $scope.selectReference(edge,vo.nodes)
                            }





                        $scope.$digest();


                    });
                }



            };

            $timeout(function(){
                makeGraph()
            }, 1000);

            $scope.removeReferenceDEP = function(ref) {


                alert("Sorry, there's a bug removing references - working on it...")
                return;


                $scope.selectedContainer.isDirty = true;
                var path = ref.path;
                var target = ref.targ;
                builderSvc.removeReferenceAtPath($scope.currentResource,path,ref.index)
                makeGraph();    //this will update the list of all paths in this model...
                var url = $scope.currentResource.resourceType+'/'+$scope.currentResource.id;
                $scope.currentResourceRefs = builderSvc.getSrcTargReferences(url)
                $scope.generatedHtml = builderSvc.makeDocumentText($scope.compositionResource,$scope.selectedContainer.bundle); //update the generated document


            }

            $scope.redrawChart = function(){
                //$scope.chart.fit();
                $timeout(function(){
                    if ($scope.chart) {
                        $scope.chart.fit();

                    }

                },1000)

            }

            $scope.viewVS = function(binding) {

                var uri;
                if (binding.valueSetReference && binding.valueSetReference.reference) {
                    uri = binding.valueSetReference.reference
                } else if (binding.valueSetUri) {
                    uri = binding.valueSetUri
                }


                if (uri) {
                    GetDataFromServer.getValueSet(uri).then(
                        function(vs) {

                            $scope.showVSBrowserDialog.open(vs);

                        },
                        function(err) {
                            modalService.showModal({}, {bodyText:err});

                        }
                    ).finally (function(){
                        $scope.showWaiting = false;
                    });
                } else {
                    alert('Unable to locate ValueSet')
                }




            };


            $scope.selectReference = function(edge,nodes) {
                $scope.currentReference = {edge:edge};
                var fromNode = findNode(nodes,edge.from);

                $scope.currentReference.from = fromNode;// builderSvc.resourceFromReference();//  fromNode;
                $scope.currentReference.fromPath = edge.label; //fromNode.cf.resource.resourceType + '.' + edge.label; //todo needs better validtion
                $scope.currentReference.to = findNode(nodes,edge.to);
                delete $scope.currentResource;

                function findNode(nodes,id) {
                    for (var i=0; i< nodes.length; i++) {
                        var node = nodes[i]
                        if (node.id == id) {
                            return node;
                            break;
                        }
                    }
                }

            };

            //if there is a cb (callback property) then execute it after retrieving the SD (as it is generally used for a new resource to add the patient reference)
            $scope.selectResource = function(entry,cb) {
                //right now, the 'entry' can be an entry or a resource (todo which I must fix!)
                var resource = entry
                if (entry.resource) {
                    resource = entry.resource;
                }

                builderSvc.setCurrentResource(resource);    //set the current resource in the service

                $scope.displayMode = 'view';

                delete $scope.hashPath;
                delete $scope.existingElements;
                delete $scope.expandedValueSet;
                delete $scope.currentElementValue;
                delete $scope.currentReference;

                delete $scope.currentSD;
                delete $scope.currentResource;
                $('#SDtreeView').jstree('destroy');     //remove the current profile tree



                $scope.currentResource = resource;      //in theory we could use currentEntry...
                $scope.currentEntry = entry;            //needed for validation

                drawResourceTree(resource)

                $scope.waiting = true;
                builderSvc.getSD(resource).then(

                    function(SD) {

                        $scope.currentSD = SD //added for Q testing...

console.log($scope.currentSD)
                        processSD(SD,resource);

                        if (cb) {
                            cb();
                        }


                    },
                    function (err) {
                        modalService.showModal({}, {bodyText:angular.toJson(err)});


                    }
                ).finally(function(){
                    $scope.waiting = false;
                })

            };

            //----------------
            //process a StructureDefinition file -
            function processSD(SD,resource){

                //don't *think* we eant to do that here...
               // builderSvc.setPatient(resource,SD);     //set the patient reference (if there is a patient or subject property)


                //set up the references after setting the patient...
                var url = resource.resourceType+'/'+resource.id;
                $scope.currentResourceRefs = builderSvc.getSrcTargReferences(url)

                profileCreatorSvc.makeProfileDisplayFromProfile(SD).then(
                    function(vo) {
                        $('#SDtreeView').jstree('destroy');
                        $('#SDtreeView').jstree(
                            {'core': {'multiple': false, 'data': vo.treeData, 'themes': {name: 'proton', responsive: true}}}
                        ).on('select_node.jstree', function (e, data) {

                            $scope.hashReferences = {}      //a hash of type vs possible resources for that type
                            delete $scope.hashPath;
                            delete $scope.expandedValueSet;
                            delete $scope.currentElementValue;

                            $scope.input.showCodeValues = false;

                            if (data.node && data.node.data && data.node.data.ed) {

                                var path = data.node.data.ed.path;

                                $scope.possibleReferences = [];
                                var ed = data.node.data.ed;

                                $scope.currentElementValue = builderSvc.getValueForPath($scope.currentResource,path);

                                //existing branches that could allow an element on this path...
                                $scope.existingElements = builderSvc.analyseInstanceForPath($scope.currentResource, path)


                                if (!ed.type) {
                                    //R3 seems to have no type for the root element in the resource. I need it for the extension adding...
                                    if (ed.path && ed.path.indexOf('.')== -1) {
                                        ed.type = [{code:'DomainResource'}]
                                    }
                                }

                                if (ed.type) {
                                    $scope.hashPath = {path: ed.path};
                                    $scope.hashPath.ed = ed;
                                    //$scope.hashPath.max = ed.max;
                                    $scope.hashPath.definition = ed.definition;
                                    $scope.hashPath.comments = ed.comments;
                                    $scope.hashPath.elementInfo = builderSvc.getEDInfoForPath(ed.path);


                                    //get the ValueSet if there is one bound...
                                    var urlToValueSet;
                                    if ($scope.hashPath.ed.binding && $scope.hashPath.ed.binding) {
                                        //there is a binding - is it a reference or a uri? (The core types use reference - but it seems tobe a uri)
                                        if ($scope.hashPath.ed.binding && $scope.hashPath.ed.binding.valueSetReference &&
                                            $scope.hashPath.ed.binding.valueSetReference.reference) {
                                            urlToValueSet = $scope.hashPath.ed.binding.valueSetReference.reference;
                                        }
                                        if ($scope.hashPath.ed.binding && $scope.hashPath.ed.binding.valueSetUri) {
                                            urlToValueSet = $scope.hashPath.ed.binding && $scope.hashPath.ed.binding.valueSetUri;
                                        }
                                    }

                                    //if there's a ValueSet then get the details, and display the contents if small (ie is a list)
                                    if (urlToValueSet) {

                                        Utilities.getValueSetIdFromRegistry(urlToValueSet,function(vsDetails) {
                                            $scope.vsDetails = vsDetails;  //vsDetails = {id: type: resource: }

                                            if ($scope.vsDetails) {
                                                if ($scope.vsDetails.type == 'list' || ed.type[0].code == 'code') {
                                                    //this has been recognized as a VS that has only a small number of options...
                                                    GetDataFromServer.getExpandedValueSet($scope.vsDetails.id).then(
                                                        function (vs) {
                                                            $scope.expandedValueSet = vs;

                                                        }, function (err) {
                                                            alert(err + ' expanding ValueSet')
                                                        }
                                                    )
                                                }
                                            }

                                        })
                                    }

                                    ed.type.forEach(function(typ){

                                        //is this a resource reference?
                                        var targetProfile = typ.profile || typ.targetProfile;       //different in STU2 & 3



                                        if (typ.code == 'Reference' && targetProfile) {
                                            //get all the resources of this type  (that are not already referenced by this element
                                            $scope.hashPath.isReference = true;

                                           // var type = $filter('getLogicalID')(targetProfile);


                                            //want to allow for references to profiled resources being able to link to the core type, so is async...
                                            builderSvc.getBaseTypeForProfile(targetProfile).then(
                                                function(type) {
                                                    var ar = builderSvc.getResourcesOfType(type,$scope.selectedContainer.bundle,targetProfile);

                                                    if (ar.length > 0) {
                                                        ar.forEach(function(resource){
                                                            var reference = builderSvc.referenceFromResource(resource); //get the reference (type/id)

                                                            //search all the references for ones from this path. Don't include them in the list
                                                            //$scope.allReferences created when the graph is built...
                                                            var alreadyReferenced = false;

                                                            $scope.currentResourceRefs.src.forEach(function(item){
                                                                if (item.path == path && item.targ == reference) {
                                                                    alreadyReferenced = true;
                                                                }
                                                            });

                                                            //todo - trouble is that the search is by resource type not instance... if (! alreadyReferenced) {
                                                            type = resource.resourceType;   //allows for Reference
                                                            $scope.hashReferences[type] = $scope.hashReferences[type] || []
                                                            $scope.hashReferences[type].push(resource);
                                                            //}

                                                        })
                                                    }
                                                },
                                                function(err) {

                                                }
                                            )

                                            //var ar = builderSvc.getResourcesOfType(type,$scope.selectedContainer.bundle,targetProfile);

                                            /*
                                            if (ar.length > 0) {
                                                ar.forEach(function(resource){
                                                    var reference = builderSvc.referenceFromResource(resource); //get the reference (type/id)

                                                    //search all the references for ones from this path. Don't include them in the list
                                                    //$scope.allReferences created when the graph is built...
                                                    var alreadyReferenced = false;

                                                    $scope.currentResourceRefs.src.forEach(function(item){
                                                        if (item.path == path && item.targ == reference) {
                                                            alreadyReferenced = true;
                                                        }
                                                    });

                                                   //todo - trouble is that the search is by resource type not instance... if (! alreadyReferenced) {
                                                        type = resource.resourceType;   //allows for Reference
                                                        $scope.hashReferences[type] = $scope.hashReferences[type] || []
                                                        $scope.hashReferences[type].push(resource);
                                                    //}

                                                })
                                            }
                                            */

                                        } else {
                                            //if not a refernece, then peform the analysis of the instance - potentially rejecting the addition...

                                            //analyse the path. if it has an ancestor of type backbone element that is multiple, then show the current entries in the instance
                                            //returns {list: modelPoint:}
                                            //$scope.existingElements = builderSvc.analyseInstanceForPath($scope.currentResource, path)

                                            if ($scope.existingElements.list.length > 0) {
                                                //leave the selectedExistingElement alone unless it is greater than the length.

                                                if ($scope.existingElements.list.length == 1) {
                                                    $scope.input.selectedExistingElement = 0;   //select it
                                                } else if ($scope.input.selectedExistingElement >= $scope.existingElements.list.length) {
                                                    $scope.input.selectedExistingElement = 0;   //select the first
                                                }

                                            } else {
                                                //for the moment, use the resourcing linking functionity to set up the child nodes. todo fix
                                                // var msg = 'Please create a reference to a resource on this branch. After that, you can add other datatypes and create new branches as desired';
                                                //modalService.showModal({}, {bodyText:msg});
                                                //return;
                                            }


                                        }

                                    })


                                }


                            }

                            $scope.$digest();

                        })

                    }
                )

                var objReferences = {}      //a hash of path vs possible resources for that path

                var references = builderSvc.getReferences(SD); //a list of all possible references by path

                $scope.bbNodes = [];        //backbone nodes to add
                $scope.l2Nodes = {};        //a hash of nodes off the root that can have refernces. todo: genaralize for more levels

                references.forEach(function(ref){
                    var path = ref.path
                    //now to determine if there is an object (or array) at the 'parent' of each node. If there
                    //is, then add it to the list of potential resources to link to. If not, then create
                    //an option that allows the user to add that parent
                    var ar = path.split('.');

                    if (ar.length == 2 ) {   //|| resource[parentPath]
                        //so this is a reference off the root
                        objReferences[path] = objReferences[path] || {resource:[],ref:ref}
                        //now find all existing resources with this type
                        var type = $filter('getLogicalID')(ref.profile);

                        var ar = builderSvc.getResourcesOfType(type,$scope.selectedContainer.bundle);
                        if (ar.length > 0) {
                            ar.forEach(function(resource){
                                objReferences[path].resource.push(resource);
                            })
                        }
                    } else {
                        if (ar.length == 3) {
                            //a node off the root...
                            var segmentName = ar[1];    //eg 'entry' in list
                            $scope.l2Nodes[segmentName] = $scope.l2Nodes[segmentName] || [];
                            var el = {path:path,name:ar[2]};    //the element that can be a reference

                            //we need to find out if the parent node for a reference at this path can repeat...
                            var parentPath = ar[0]+'.'+ar[1];       //I don;t really like this...

                            var info = builderSvc.getEDInfoForPath(parentPath);
                            el.info = info

                            $scope.l2Nodes[segmentName].push(el)

                            $scope.bbNodes.push({level:2,path:path});
                        }
                        //so this is a reference to an insert point where the parent does not yet exist

                    }





                })


                $scope.objReferences = objReferences;
               // if (cb) {
                  //  cb();
               // }


            }
            //---------------------

            $scope.addBBE = function(){
                //add a new BackBone element for the selected node

                //the parent must have already been created...
                if ($scope.existingElements.modelPoint && angular.isArray($scope.existingElements.modelPoint)) {
                    //this is the 'parent' root for the currently selected element...
                    $scope.existingElements.modelPoint.push({});        //add a new element to the resource instance...
                    $scope.existingElements.list = $scope.existingElements.modelPoint;      //so the list is still pointing to the instance
                    $scope.input.selectedExistingElement = $scope.existingElements.list.length -1;

                } else {
                    alert('cannot add new branch - select another resource, then come back and try again.');
                }

            };

            $scope.linkToResource = function(pth,resource,ref){

                if (pth == 'Composition.section.entry') {
                    modalService.showModal({}, {bodyText:'Use the special Document controls (middle panel, Document tab) to add sections to the composition'});
                    return;
                }

                $scope.selectedContainer.isDirty = true;

                var insertPoint;        //if we want to set the insert point...

                //set the insert point based on the path selected (if any)

                if ($scope.input.selectedExistingElement > -1) {
                    insertPoint = $scope.existingElements.list[$scope.input.selectedExistingElement];
                 }

                builderSvc.insertReferenceAtPath($scope.currentResource,pth,resource,insertPoint)


                //temp!!!
               // makeGraph();
               // return;



                //update the tracker...
                var details = {path:pth,resourceType: $scope.currentResource.resourceType,
                    to:{resourceType:resource.resourceType,id:resource.id},ip:insertPoint};
                sbHistorySvc.addItem('link',$scope.currentResource.id,true,details,$scope.selectedContainer);

                makeGraph();    //this will update the list of all paths in this model...
                drawResourceTree($scope.currentResource);
                $scope.generatedHtml = builderSvc.makeDocumentText($scope.compositionResource,$scope.selectedContainer.bundle); //update the generated document
                var url = $scope.currentResource.resourceType+'/'+$scope.currentResource.id;
                $scope.currentResourceRefs = builderSvc.getSrcTargReferences(url)

                //need to update the history as well...
                builderSvc.updateMostRecentVersion( $scope.selectedContainer,$scope.selectedContainer.bundle)


                //now remove the reference from the list of possibilities...
                var type = resource.resourceType;   //allows for Reference
                var pos = -1;
                $scope.hashReferences[type].forEach(function(res,inx){
                    if (res.id == resource.id) {
                        pos = inx;
                    }
                })

                if (pos > -1) {
                    $scope.hashReferences[type].splice(pos,1);
                }


                refreshTrackerDisplay($scope.currentResource);

            }

            $scope.addNewResource = function(type,importedResource) {
                //if the property resource is passed in, then this is a resource imported manually...

                if (type == 'Composition') {
                    if ($scope.isaDocument) {
                        modalService.showModal({}, {bodyText:'There is already a Composition in this set - and there can only be one.'});
                        $scope.displayMode = 'view';
                        return;
                    }
                    //make sure there isn't a messageHeader

                    var mh = _.find($scope.selectedContainer.bundle.entry,function(o){
                        return o.resource.resourceType=='MessageHeader';
                    });

                    if (mh) {
                        modalService.showModal({}, {bodyText:'There is already a MessageHeader in this set - Composition is not allowed.'});
                        $scope.displayMode = 'view';
                        return;
                    }

                } else  if (type == 'MessageHeader') {
                    var mh = _.find($scope.selectedContainer.bundle.entry,function(o){
                        return o.resource.resourceType=='Composition';
                    });

                    if (mh) {
                        modalService.showModal({}, {bodyText:'There is already a Composition  in this set - MessageHeader is not allowed.'});
                        $scope.displayMode = 'view';
                        return;
                    }

                }


                $scope.waiting = true;
                $scope.selectedContainer.isDirty = true;


                var resource = {resourceType : type};
                if (importedResource) {
                    resource = importedResource;
                    var manualText = resource.text.div;
                    resource.text = {status:'generated',div:  $filter('addTextDiv')(manualText + builderSvc.getManualMarker())};

                } else {
                    //only the type has been selected...
                    $scope.input.text = $scope.input.text || "";
                    resource.text = {status:'generated',div:  $filter('addTextDiv')($scope.input.text + builderSvc.getManualMarker())};
                }

                resource.id = idPrefix+new Date().getTime();        //always assign a new id..
                builderSvc.addResourceToAllResources(resource)
                $scope.selectedContainer.bundle.entry.push({resource:resource});

                $scope.selectedContainer.bundle.entry.sort(function(a,b){
                //$scope.resourcesBundle.entry.sort(function(a,b){
                    if (a.resource.resourceType > b.resource.resourceType) {
                        return 1
                    } else {
                        return -1
                    }
                })

                //get the SD, thenset any references to the Patient (if it exists)
                builderSvc.getSD(resource).then(
                    function(SD) {
                        builderSvc.setPatient(resource,SD);     //set the patient reference (if there is a patient or subject property)

                        //update the copy of this bundle in the container history
                        builderSvc.updateMostRecentVersion( $scope.selectedContainer,$scope.selectedContainer.bundle)
                    },
                    function(err) {
                        alert(angular.toJson(err))
                    }
                );


                sbHistorySvc.addItem('addCore',resource.id,true,resource,$scope.selectedContainer);      //track changes

                $scope.displayMode = 'view';

                $scope.selectResource(resource,function(){
                    $scope.waiting = false;
                    makeGraph();
                    drawResourceTree(resource);

                    isaDocument();      //determine if this bundle is a document (has a Composition resource)

                    $rootScope.$emit('addResource',resource);

                });       //select the resource, indicating that it is a new resource...

                $scope.currentPatient = builderSvc.getPatientResource();

            };

            $scope.newTypeSelected = function(item) {
                $scope.waiting = true;
                delete $scope.input.text;
                var type = item.name;
                var uri = "http://hl7.org/fhir/StructureDefinition/"+type;
                GetDataFromServer.findConformanceResourceByUri(uri).then(
                    function(data) {

                        $scope.currentType = data;
                        $scope.references = builderSvc.getReferences($scope.currentType)

                    },
                    function(err) {
                        modalService.showModal({}, {bodyText:"Sorry, I couldn't find the profile for the '"+type+"' resource on the Conformance Server ("+appConfigSvc.getCurrentConformanceServer().name+")"});
                        $scope.setDisplayMode('view')
                    }
                ).finally(function(){
                    $scope.waiting = false;
                })

            }


            function drawResourceTree(resource) {

                //make a copy to hide all the $$ properties that angular adds...
                var r = angular.copy(resource);
                var newResource =  angular.fromJson(angular.toJson(r));


                var treeData = resourceCreatorSvc.buildResourceTree(newResource);



                //show the tree structure of this resource version
                $('#builderResourceTree').jstree('destroy');
                $('#builderResourceTree').jstree(
                    {'core': {'multiple': false, 'data': treeData, 'themes': {name: 'proton', responsive: true}}}
                ).on('select_node.jstree', function (e, data) {
                    //console.log(data.node.data);

                    delete $scope.displayResourceTreeDeletePath;
                    if (data.node.data && data.node.data.level == 1) {
                        //a top level node that can be deleted
                        $scope.displayResourceTreeDeletePath = data.node.data.key;
                    }

                    $scope.$digest();
                })

            }

            //returns true if the selected path in the tree view of the current resource can be deleted...
            $scope.canDeletePath = function() {
                if (!$scope.displayResourceTreeDeletePath) {
                    return false;
                }

                if (['id','resourceType','text'].indexOf($scope.displayResourceTreeDeletePath) == -1) {
                    return true;
                }
                return false;
            };

            $scope.removeResourceNode = function(path){
                //can remove top level nodes only...  (for now)
                console.log(path)

                var modalOptions = {
                    closeButtonText: "No, I changed my mind",
                    actionButtonText: 'Yes, please remove it',
                    headerText: 'Remove element',
                    bodyText: 'Are you sure you wish to delete this element. '
                };

                modalService.showModal({}, modalOptions).then(
                    function (){
                        delete $scope.currentResource[path]
                        drawResourceTree($scope.currentResource)
                        makeGraph();    //in case it was a reference that was removed...

                    }
                );

            };

            RenderProfileSvc.getAllStandardResourceTypes().then(
                function(lst) {
                    $scope.resources = lst



                }
            );

            $scope.showVSBrowserDialog = {};

            //------- select a profile --------
            $scope.showFindProfileDialog = {};
            $scope.findProfile = function(cheat) {
                delete $scope.input.selectedProfile;
                $scope.showFindProfileDialog.open();        //show the profile select modal...
            };


            //called when a profile has been selected
            $scope.selectedProfileFromDialog = function (profile) {
                $scope.input.selectedProfile = profile;

            };




            //actually add the resource instance based on this profile...
            $scope.addSelectedProfile = function (profile) {
                builderSvc.makeLogicalModelFromSD(profile).then(
                    function (lm) {
                        selectLogicalModal(lm,profile.url)
                    },
                    function(vo) {
                        //if cannot locate an extension. returns the error and the incomplete LM
                        selectLogicalModal(vo.lm,profile.url)
                    }
                )
            };



            //----- Logical model support

            function selectLogicalModal(lm,profileUrl) {

                if (lm && lm.snapshot && lm.snapshot.element) {


                    var type = lm.snapshot.element[0].path;
                    $scope.selectedContainer.isDirty = true;
                    var resource = {resourceType: type};
                    resource.id = idPrefix + new Date().getTime();
                    $scope.input.text = $scope.input.text || "";
                    resource.text = {
                        status: 'generated',
                        div: $filter('addTextDiv')($scope.input.text + builderSvc.getManualMarker())
                    };
                    resource.meta = {profile: [lm.url]};
                    resource.implicitRules = lm.implicitRules;


                    //is this a lm based on a core resource? If so, add an extension to the resource so it can be a reference target...
                    var baseTypeForModel = appConfigSvc.config().standardExtensionUrl.baseTypeForModel;
                    var extensionValue = Utilities.getSingleExtensionValue(lm, baseTypeForModel);
                    if (extensionValue && extensionValue.valueString) {
                        resource.extension = [extensionValue]
                        // Utilities.addExtensionOnceWithReplace(resource,baseTypeForModel,extensionValue)
                    }


                    builderSvc.addResourceToAllResources(resource)
                    builderSvc.addSDtoCache(lm)

                    var item = {resource: resource};
                    if (profileUrl) {
                        item.isProfile = true
                        item.profile = profileUrl;
                    } else {
                        item.isLogical = true
                    }
                    $scope.selectedContainer.bundle.entry.push(item);
                    $scope.selectedContainer.bundle.entry.sort(function (a, b) {
                        //$scope.resourcesBundle.entry.sort(function(a,b){
                        if (a.resource.resourceType > b.resource.resourceType) {
                            return 1
                        } else {
                            return -1
                        }
                    })
                    $scope.displayMode = 'view';
                    $scope.selectResource(resource, function () {
                        $scope.waiting = false;
                        makeGraph();
                        drawResourceTree(resource);

                        isaDocument();      //determine if this bundle is a document (has a Composition resource)

                        $rootScope.$emit('addResource', resource);

                    });
                } else {
                    alert ('There is no snapshot with elements...')
                }
            }

            //load all the logical models. This won't scale...
            logicalModelSvc.loadAllModels(appConfigSvc.getCurrentConformanceServer().url).then(
                function (bundle) {
                    $scope.allLogicalModelsBundle = bundle
                    $scope.bundleLogicalModels = angular.copy($scope.allLogicalModelsBundle)

                }, function (err) {
                    alert(err)
                }
            );


            //used to provide the filtering capability...
            $scope.filterModelList = function(filter) {
                filter = filter.toLowerCase();
                $scope.bundleLogicalModels = {entry:[]};   //a mnimal bundle
                $scope.allLogicalModelsBundle.entry.forEach(function(entry){
                    if (entry.resource.id.toLowerCase().indexOf(filter) > -1) {
                        $scope.bundleLogicalModels.entry.push(entry);
                    }
                })
            };


            $scope.selectLogicalModelFromList = function(entry,index){
                var lm = entry.resource;
                lm.implicitRules = 'isLogicalModel'





                selectLogicalModal(lm)
            }


        });
/* Controller for the resource builder
* Note that this uses jsTree to convert the internal resource model from a flat list to a hierarchy.
* todo - should replace that with a specific function...
* todo - this controller has ben=come far too big - should be re-factored...
* */

//https://coderwall.com/p/rqdrwq/nginx-conf-query-string-processing

//{{results.profileUrl}}
//{{resourceCreatorSvc.getCurrentProfile().url}}


angular.module("sampleApp")
    .controller('resourceCreatorCtrl',
        function ($scope,resourceCreatorSvc,GetDataFromServer,SaveDataToServer,$rootScope,modalService,$translate,
                  $localStorage,RenderProfileSvc,appConfigSvc,supportSvc,$uibModal,ResourceUtilsSvc,Utilities,
                  $location,resourceSvc,$window,$timeout,$firebaseArray,$filter,$firebaseObject,$cookies,$q) {


            if (window.location.href.indexOf('localhost') > -1) {
                $scope.runningLocally = true;
            }

            //allow other controllers (like frontController) to turn the waiting icon on or off
            $rootScope.$on('setWaitingFlag',function(event,showFlag){
                $scope.waiting = showFlag;

            })


    var enabled = false;    //just to disable cookies for now...

    $scope.baseUrl = "http://hl7.org/fhir/2016Sep/";    //root for displaying details of resource


    if (appConfigSvc.checkConfigVersion()) {
        var txt = 'The default configuration has been updated (including the patient data and conformance server). Please re-load the page for it to take effect.';
        txt += " (Note that you will need to re-enter any direct servers you have added via the 'gear' icon)"
        modalService.showModal({}, {bodyText: txt})

    }

    $scope.cookies = $cookies.getAll();
    if ($scope.cookies && enabled) {        //disablefor now

        var profileUrl = $scope.cookies.myProfile;
        //alert(profileUrl);

        if (profileUrl) {

            $rootScope.$broadcast('setWaitingFlag',true);

            //assume that the caller is simplifier and that the profile is a resource Id that we can retrieve directly
            GetDataFromServer.adHocFHIRQuery(profileUrl).then(
                function(profileData) {

                    //todo - set the patient, conformance & terminology servers...

                    //set the patient - this will only work if the server is HAPI1 with that patient!!!
                    var url = appConfigSvc.getCurrentDataServer().url+ 'Patient/69649';
                    GetDataFromServer.adHocFHIRQuery(url).then(
                        function(data) {
                            appConfigSvc.setCurrentPatient(data.data);
                            loadPatientDetails(function(patient){
                                //so we have the patient, now set the profile...
                                $scope.$emit('profileSelected',angular.copy(profileData.data));

                                $timeout(function(){
                                    $scope.displayMode = 'new';
                                },2000)




                            })
                        }
                    )


                },
                function(err) {
                    alert(angular.toJson(err))
                }
            ).finally(function(){
                $rootScope.$broadcast('setWaitingFlag',false);
            });


        }

     //   console.log(profile)


    }


    //called whenever the auth state changes - eg login/out, initial load, create user etc.
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            $rootScope.userProfile = $firebaseObject(firebase.database().ref().child("users").child(user.uid));



            var updateProfile = false;      //this is just a cheat so I can update my config...
                //if it's me, then set me as adminstrator and other stuff...
            if (user.uid == "C6955l18fegSZTbdPeU8NJupQS63") {

                if (updateProfile || !$rootScope.userProfile || !$rootScope.userProfile.roles) {
                    $rootScope.userProfile.roles = [{administrator : true}];
                    $rootScope.userProfile.$save();
                }
                if (updateProfile || !$rootScope.userProfile || !$rootScope.userProfile.extDef) {
                    $rootScope.userProfile.extDef = {permissions : {canCreate : true, canActivate : true, canEdit:true, canRetire: true, canDelete : true}}
                    $rootScope.userProfile.extDef.defaultPublisher = 'Orion';
                    $rootScope.userProfile.$save();
                }

            } else {

            }

            $rootScope.$broadcast('userLoggedIn')

        } else {
            // No user is signed in.
        }
    });



    //get the firebase projects link
    var refProjects = firebase.database().ref().child("projects");
    $rootScope.fbProjects = $firebaseArray(refProjects);


    //place on scope so can adjust dispaly
    $scope.firebase = firebase;

    $scope.logout=function(){
        firebase.auth().signOut().then(function() {
            delete $rootScope.userProfile;
            $rootScope.$broadcast('userLoggedOut')
            modalService.showModal({}, {bodyText: 'You have been logged out of clinFHIR'})

        }, function(error) {
            modalService.showModal({}, {bodyText: 'Sorry, there was an error lgging out - please try again'})
        });

    };

    $scope.login=function(){
        $uibModal.open({
            backdrop: 'static',      //means can't close by clicking on the backdrop.
            keyboard: false,       //same as above.
            templateUrl: 'modalTemplates/login.html',
            controller: 'loginCtrl'

        })

    };

            
    var profile;                    //the profile being used as the base
    var type;                       //base type
    $scope.treeData = [];           //populates the resource tree
    $scope.results = {};
    $scope.input = {};            //the variable for resource property values...

    //need to place network graphs on the scope so that they can be 'fitted()' when the display container is shown (as in a tab)
    $scope.graph = {};

    $scope.buildState;              //the current build state of the resource. 'new' = just created, 'dirty' = updated, 'saved' = has been saved

    $scope.outcome = {};

    $scope.displayMode = 'front';    //'new' = resource builder, ''patient = patient
    $scope.selectedPatientResourceType = [];

    $scope.hasDetailedView = ['Observation','Encounter','Condition']

    //todo just for the moment...
    $scope.showLogicalModeller = function () {
        if (appConfigSvc.getCurrentConformanceServer().version == 3) {
            //if (appConfigSvc.getCurrentConformanceServer().name == 'Grahame STU3 server') {
            return true;
        }
    }

   

    $scope.config = appConfigSvc.config();  //the configuraton object - especially the data,terminology & conformance servers...

    //show the server query page
    $scope.showQuery = function(conformanceUrl){
        $scope.displayMode="query";
        $rootScope.startup = {conformanceUrl:conformanceUrl};     //the query controller will automatically download and display this resource
    };


    $scope.showUserDetails = function() {
        $scope.displayMode="userDetails";
    };

    //check for commands in the url
    var params = $location.search();
    if (params) {
        $scope.startupParams = params;


        if (params.conformance) {
            //the app is to display a conformance resource
            $scope.showQuery(params.conformance);
        }

        if (params.url) {
            //a specific profile is selected. Assume that this has the complete url to the profile so we'll
            //need to think about setting the config.server.conformanceto the base...
            $scope.results.profileUrl = params.url;
        }
    }

    //expose the config service on the scope. Used for showing the Patint details...
    $scope.appConfigSvc = appConfigSvc;
    $scope.ResourceUtilsSvc = ResourceUtilsSvc;
    $scope.resourceCreatorSvc = resourceCreatorSvc;     //used to get the parked resources
    $scope.translate = $translate;          //so the main page can display a 'use english' opt1on

    //config - in particular the servers defined. The samples will be going to the data server...

    $scope.recent = {};
    $scope.recent.patient = appConfigSvc.getRecentPatient();
    $scope.recent.profile = appConfigSvc.getRecentProfile();

    //---- the array of standard timimg elements
    $scope.timingArray = RenderProfileSvc.populateTimingList();

    $scope.findResourceOtherPatient = function(type) {

        $uibModal.open({
            backdrop: 'static',      //means can't close by clicking on the backdrop.
            keyboard: false,       //same as above.
            templateUrl: 'modalTemplates/findResourceOtherPatient.html',
            size: 'lg',
            controller: 'fopCtrl', 
            resolve : {
                resourceType: function () {          //the default config
                    return type;

                }
            }
        }).result.then(
            function(vo){


                    var v = {reference: vo.resource.resourceType + "/" + vo.resource.id};


                    v.display = ResourceUtilsSvc.getOneLineSummaryOfResource(vo.resource) +
                        ' for ' + ResourceUtilsSvc.getOneLineSummaryOfResource(vo.patient);
                    
                    $scope.saveNewDataType({value:v,text:v.display});

            }
        )

    }

    //data for the chart
    GetDataFromServer.getAccessAudit().then(
        function(log){
            $scope.accessAudit = log;
            //console.log(log)


        },
        function(err) {

        }
    );

    //--------------- related to local activity
    $scope.showLocalActivity = function(){
        delete $scope.laItem;
        delete $scope.laAllowEdit;
        $scope.localActivity = resourceCreatorSvc.getResourcesCreated();
        $scope.displayMode = 'localActivity';
    }

    $scope.clearLAlist = function() {
        $scope.localActivity = resourceCreatorSvc.clearResourcesCreatedList()
    }

    $scope.laShowResource = function(item){
        var url = item.resourceUrl;   //has the full path to the server
        delete $scope.laAllowEdit;
        $rootScope.$broadcast('setWaitingFlag',true);
        GetDataFromServer.adHocFHIRQuery(url).then(
            function(data) {
                $scope.laItem = {resource: data.data,item:item};
                if (item.server == appConfigSvc.getCurrentDataServer().url) {
                    $scope.laAllowEdit = true;
                }
            }).finally(function(){
            $rootScope.$broadcast('setWaitingFlag',false);
        })

    };

    $scope.laEditResource = function(item) {

        $rootScope.$broadcast('setWaitingFlag',true);
        var url = appConfigSvc.getCurrentDataServer().url+ 'Patient/'+item.item.patientId;
        GetDataFromServer.adHocFHIRQuery(url).then(
            function(data) {
                appConfigSvc.setCurrentPatient(data.data);
                loadPatientDetails(function(patient){
                    $scope.editExistingResource(item.resource);
                })
            }
        ).finally(function(){
            $rootScope.$broadcast('setWaitingFlag',false);
        });
    };

    $scope.showExtensionsDEP = function() {
        $scope.displayMode = 'extensions';
        $rootScope.$broadcast('setDisplayMode',{newMode:'extensions'});
    }


    $rootScope.$on('setDisplayMode',function(event,mode){
        $scope.displayMode = mode.newMode;
        //console.log('setting displayMode to ' + mode.newMode)
        $rootScope.lastModeActivity = mode;         //so a component (like the profile builder) can re-load a previous mode (from mode.currentMode)
    });

    $scope.changeDisplayMode = function(mode) {
        //$scope.displayMode = mode;
        $rootScope.$broadcast('setDisplayMode',{newMode:mode});
    }


    $scope.showChart = function() {
        if ($scope.displayMode == 'access') {
            $scope.displayMode = 'front'
        } else {
            $scope.displayMode = 'access';
            //otherwise the chart is not full screen
            $timeout(function(){
               // $scope.accessAudit.tmp='s';
                $('#hcAccessAudit').highcharts().reflow();
            }, 0);


        }
    }

    //--- code for timing

    $scope.updateTimingDetails = function(item) {

        if (item && item.timing) {
            $scope.results.timing.duration = item.timing.duration;
            $scope.results.timing.units = item.timing.units;
            $scope.results.timing.freq = item.timing.freq;
            $scope.results.timing.freq_max = item.timing.freqMax;
            $scope.results.timing.period = item.timing.period;
            $scope.results.timing.period_max = item.timing.periodMax;
            $scope.results.timing.period_units = item.timing.periodUnits;
            $scope.results.timing.when = item.timing.when;
        }



    };

    //when the user clicks the 'New Resource' button. They will have selected a patient and profile
    $scope.createNewResource = function() {
        delete $scope.isEditingResource;        //todo ?is this the correct place to delete this

        //setUpForNewProfile(resourceCreatorSvc.getCurrentProfile());
        $scope.displayMode = 'new';     //display the 'enter new resouce' screen..
    };

    //when the user selects 'edit resource' from the resource display
    $scope.editExistingResource = function(resource) {
        //console.log(resource)
        $scope.isEditingResource = resource;        //so we know to PUT an update when saving...

        $rootScope.$broadcast('setWaitingFlag',true);
        resourceCreatorSvc.loadResource(resource).then(
            function(vo) {
                $scope.$emit('profileSelected',vo.profile);  //the resourcebuilder needs the profile...
                var treeData = vo.treeData;
/*
                var load = {url:vo.profile.url,tree:vo.treeData,conf:appConfigSvc.getCurrentConformanceServer().url}
                $scope.fbLoadResource.$add(load).then(function(ref){
                    console.log('added to server')
                },function(err){
                    alert('There was an error:'  + err)
                });
*/

                //console.log(treeData)
                $scope.treeData = treeData;
                $scope.displayMode = 'new';     //display the 'enter new resouce' screen..
                $scope.input.userText = vo.resourceText;
                drawTree();


            },
            function(err){
                console.log(err);
            }
        ).finally(function(){
            $rootScope.$broadcast('setWaitingFlag',false);
        })
    };


    //add new server
     $scope.addServer = function(){
                $uibModal.open({
                    backdrop: 'static',      //means can't close by clicking on the backdrop.
                    keyboard: false,       //same as above.
                    templateUrl: 'modalTemplates/addServer.html',
                    size:'lg',
                    controller: function($scope,appConfigSvc,modalService){
                        $scope.input={version:"2"}
                        $scope.input.valid = false;

                        $scope.add = function() {
                            var svr = {name:$scope.input.name,url:$scope.input.url,
                                version:parseInt($scope.input.version,10),everythingOperation:$scope.input.everything}

                            
                            
                            //console.log(svr);
                            appConfigSvc.addServer(svr,$scope.input.terminology);
                            $scope.$close();

                        }

                        $scope.test = function() {
                            var qry = $scope.input.url + "metadata";
                            $scope.waiting=true;
                            GetDataFromServer.adHocFHIRQuery(qry).then(
                                function(data){
                                    modalService.showModal({}, {bodyText: 'Conformance resource returned. Server can be added'})
                                    $scope.input.valid = true;

                                    //get the fhir version from the conformance resource
                                    $scope.fhirVersion = data.data.fhirVersion;
                                   

                                },
                                function(err){
                                    modalService.showModal({}, {bodyText: 'There is no valid FHIR server at this URL:'+qry})

                                }
                            ).finally(function(){
                                $scope.waiting=false;
                            })

                        }

                    }

                })
            }

    //============== event handlers ===================

    //the config (ie server) has been update. We need to abandon the resource being built...
    $rootScope.$on('configUpdated',function(event,data){
        //console.log('new config');
        //when the config (servers) change,then the most recent patient & profiles will do so as well...
        $scope.recent.patient = appConfigSvc.getRecentPatient();
        $scope.recent.profile = appConfigSvc.getRecentProfile();


        if (data && data.serverType == 'data') {
            //if the data server changes, we need to remove the current patient..
            appConfigSvc.removeCurrentPatient();
        }

        setUpForNewProfile();       //if there's no profile in the call, then everything will be re-set


    });

    //when a new profile is selected from the front page...
    $rootScope.$on('profileSelected',function(event,profile){
       // console.log(profile)
        $scope.dirty=false;     //a new form is loaded
        $scope.parkedHx = false;
        setUpForNewProfile(profile);
    });


    //when a patient is selected from the front page... Want to load the patient details and create a new starter resource for the current profile
    $rootScope.$on('patientSelected',function(event,patient){
        delete $scope.resourceVersions;         //remove any versions. todo - should centralize all this clearing stuff...
        appConfigSvc.addToRecentPatient(patient);

        //if there's a project active, then update it. todo need tothink about security for this...
        if ($rootScope.currentProject) {
           appConfigSvc.addPatientToProject(patient,$rootScope.currentProject,$rootScope.fbProjects)

        }

        $scope.recent.patient = appConfigSvc.getRecentPatient();

        loadPatientDetails(function(patient){
            setUpForNewProfile(resourceCreatorSvc.getCurrentProfile());
        });

    });

    //when a new resource has been created. Don't reset the new resource as this allows incremental versions of the resource to be saved...
    $rootScope.$on('reloadPatient',function(event){
        loadPatientDetails(function(){
            //console.log('reload')
        });
    });

    //from the project menu, show the editor
    $scope.showProjectEditor = function(){
        $scope.displayMode = 'project';
    }

    //called when the user moves out of the 'narrative' text box...
    $scope.updateText = function() {
        buildResource();
    };



    //clears the current resource being built and re-displays the front screen
    $scope.cancelNewResource = function(state){

        //if the resource has been edited, then confirm the cancel...
        if (state== 'dirty') {
            var modalOptions = {
                closeButtonText: 'No, stay here',
                actionButtonText: 'Yes, select another',
                headerText: 'Abandon resource',
                bodyText: 'Are you sure you want to abandon this resource?'
            };

            modalService.showModal({}, modalOptions).then(function (result) {
                //this is the 'yes'
                clear();
                $scope.displayMode = 'front';
            })

        } else {
            clear();
            $scope.displayMode = 'front';
        }


        function clear() {
            delete $scope.localSelectedProfile ;
            //resourceCreatorSvc.setCurrentProfile(null);     //remove the current profile
            $rootScope.$emit('profileSelected',null);      //will clear the builder...

        }


    };

    //change the server & other config stuff
    $scope.showConfig = function() {
        $scope.configIsReadOnly = false;

        $uibModal.open({
            backdrop: 'static',      //means can't close by clicking on the backdrop. stuffs up the original settings...
            keyboard: false,       //same as above.
            templateUrl: 'modalTemplates/clientConfig.html',
            size:'lg',
            controller: 'configCtrl',
            resolve : {
                configDefault: function () {          //the default config
                    return appConfigSvc.config();

                }
            }
        })
    };


    //change the language
    $scope.changeLanguage = function() {
        var modalInstance = $uibModal.open({
            templateUrl: "/modalTemplates/selectLanguage.html",
            size: 'sm',
            controller: function ($scope,$translate,$localStorage) {
                $scope.selectLanguage = function(code) {
                    $localStorage.preferredLanguage = code;     //save default language
                   // var url = 'translate/'+code+'.json';
                   // $translateProvider.useUrlLoader(url);

                    $translate.use(code)
                }
            }
        })
    };

    $scope.resetLanguageToEnglish = function() {
        $localStorage.preferredLanguage = 'en';     //save default language
        $translate.use('en')
    };



    //load existing data for the current patient
    function loadPatientDetails(cb) {
        $scope.hasVitals = false;
        delete $scope.vitalsTable;
        delete $scope.outcome.selectedResource;
        $rootScope.$broadcast('setWaitingFlag',true);
        supportSvc.getAllData(appConfigSvc.getCurrentPatient().id).then(
            //returns an object hash - type as hash, contents as bundle - eg allResources.Condition = {bundle}
            function (allResources) {
                //the order is significant - allResources must be set first...
                appConfigSvc.setAllResources(allResources);
                $rootScope.$broadcast('resourcesLoadedForPatient')

               // console.log(allResources);
                $scope.allResources = allResources;
                //all conditions is used by the timeline display to
                //var allConditions = allResources['Condition'];
                //todo - all this stuff should be in a service somewhere...
                $scope.outcome.resourceTypes = [];
                angular.forEach(allResources, function (bundle, type) {

                    if (bundle && bundle.total > 0) {
                        $scope.outcome.resourceTypes.push({type: type, bundle: bundle});
                        if (type == 'Observation') {
                            //if there are Obervations, then may be able to build a Vitals table...
                            $scope.hasVitals = true;
                        }
                    }

                });

                $scope.outcome.resourceTypes.sort(function (a, b) {
                    if (a.type > b.type) {
                        return 1
                    } else {
                        return -1
                    }
                });


                //for the reference navigator we need a plain list of resources...
                $scope.allResourcesAsList = [];
                $scope.allResourcesAsDict = {};
                angular.forEach(allResources, function (bundle, type) {

                    if (bundle.entry) {
                        bundle.entry.forEach(function (entry) {


                            //not here as there are duplaications (resources referenced by others)
                            //$scope.allResourcesAsList.push(entry.resource);


                            var hash = entry.resource.resourceType + "/" + entry.resource.id;
                            $scope.allResourcesAsDict[hash] = entry.resource;

                        })
                    }

                    //also need to add the reference resources to the dictionary (so thay can be found in outgoing references)
                    supportSvc.getReferenceResources().forEach(function (resource) {
                        var hash = resource.resourceType + "/" + resource.id;
                        $scope.allResourcesAsDict[hash] = resource;
                    });

                    //and finally the patient!
                    var patient = appConfigSvc.getCurrentPatient();
                    var hash = "Patient/" + patient.id;
                    $scope.allResourcesAsDict[hash] = patient;


                });

                //need to do this after the hash has been created to avoid duplications...
                angular.forEach($scope.allResourcesAsDict,function(res){
                    $scope.allResourcesAsList.push(res);
                });

                
                //create and draw the graph representation...
                var graphData = resourceCreatorSvc.createGraphOfInstances($scope.allResourcesAsList);
                var container = document.getElementById('mynetwork');
                var network = new vis.Network(container, graphData, {});
                $scope.graph['mynetwork'] = network;
                network.on("click", function (obj) {
                   // console.log(obj)
                    var nodeId = obj.nodes[0];  //get the first node
                    var node = graphData.nodes.get(nodeId);
                    //console.log(node);
                    $scope.selectedGraphNode = graphData.nodes.get(nodeId);
                    //console.log($scope.selectedGraphNode)
                    $scope.$digest();
                });

                $rootScope.$broadcast('patientObservations',allResources['Observation']);//used to draw the observation charts...
                
             

                //create and draw the timeline. The service will display the number of encounters for each condition
                var timelineData =resourceCreatorSvc.createTimeLine($scope.allResourcesAsList,allResources['Condition']);

                //console.log(timelineData)
                $('#timeline').empty();     //otherwise the new timeline is added below the first...
                var tlContainer = document.getElementById('timeline');

                var timeline = new vis.Timeline(tlContainer);
                timeline.setOptions({});
                timeline.setGroups(timelineData.groups);
                timeline.setItems(timelineData.items);

                timeline.on('select', function(properties){
                    timeLineItemSelected(properties,timelineData.items)
                });

                $scope.conditions = timelineData.conditions;

            }
            )
            .finally(function () {
                $rootScope.$broadcast('setWaitingFlag',false);
                if (cb) {
                    cb()
                }
            });
    }

    $scope.filterTimeLineByConditionDEP = function(reference) {
        delete $scope.outcome.selectedResource;
        //console.log(reference);
        //create and draw the timeline. The service will display the number of encounters for each condition
        //todo - this code is (mostly) a copy from the function above - refactor..
        var timelineData =resourceCreatorSvc.createTimeLine($scope.allResourcesAsList,$scope.allResources['Condition'],reference);

       // console.log(timelineData)
        $('#timeline').empty();     //otherwise the new timeline is added below the first...
        var tlContainer = document.getElementById('timeline');

        var timeline = new vis.Timeline(tlContainer);
        timeline.setOptions({});
        timeline.setGroups(timelineData.groups);
        timeline.setItems(timelineData.items);

        timeline.on('select', function(properties){
            timeLineItemSelected(properties,timelineData.items)
        });

    };


    //when a single timeline entry is selected
    var timeLineItemSelectedDEP = function(properties,items){
        //console.log(properties);
       // console.log(items)
        var node = items.get(properties.items[0]);
       // console.log(node)
        $scope.outcome.selectedResource = node.resource;
        createGraphOneResource(node.resource,'resourcenetworkgraphtl')
        $scope.$digest();
    }

    //generate the table of vitals
    $scope.getVitals = function(){
        //return the list of vitals observations so that a table can be generated
        delete $scope.outcome.selectedResource;
        delete $scope.outcome.selectedType;
        delete $scope.outcome.allResourcesOfOneType;

        supportSvc.getVitals({patientId:appConfigSvc.getCurrentPatient().id}).then(
            function(vo){
                var codes = vo.vitalsCodes;     //an array of codes - todo: add display
                var grid = vo.grid;             //obects where each property is a date (to become a colum
                //get a list of dates
                var dates = [];
                angular.forEach(grid,function(item,date){
                    dates.push(date);
                });
                dates.sort(function(a,b){
                    if (b > a) {
                        return 1
                    } else {
                        return -1
                    }
                });

                //convert the data grid into one suitable for display - ie the dates (properties) as columns
                $scope.vitalsTable = {rows:[],dates:[]};

                var firstRow = true;
                codes.forEach(function(code){
                    var row = {code:code.code,unit:code.unit,display:code.display,cols:[]};
                    //now, add a column for each date...
                    dates.forEach(function(date){
                        item = grid[date];
                        var v = '';
                        if (item[code.code]) {      //is there a value for this code on this date
                            v = item[code.code].valueQuantity.value;
                        }
                        row.cols.push({value:v});
                        //add the date to the list of dates on the first row only
                        if (firstRow) {
                            $scope.vitalsTable.dates.push(date);
                        }

                    });
                    firstRow = false
                    $scope.vitalsTable.rows.push(row);
                });


            }
        )
    };


    $scope.loadVersions = function(resource) {
        resourceCreatorSvc.loadVersions(resource).then(
            function(data) {
                $scope.resourceVersions = data.data;    //a bundle of all the versions for this resource...
            }
        )
    };

    $scope.selectVersion = function(resource) {
        $scope.outcome.selectedResource = resource;     //todo - any side effects of a version rather than the latest?

        drawResourceTree(resource)

        $scope.resourceSelected({resource:resource});


    };

    function drawResourceTree(resource) {
        var treeData = resourceCreatorSvc.buildResourceTree(resource);

        //show the tree of this version
        $('#resourceTree').jstree('destroy');
        $('#resourceTree').jstree(
            {'core': {'multiple': false, 'data': treeData, 'themes': {name: 'proton', responsive: true}}}
        )

    }

    //get all the standard resource types - the one defined in the fhir spec. Used for the select profile modal...
    RenderProfileSvc.getAllStandardResourceTypes().then(
        function(standardResourceTypes) {
            $scope.standardResourceTypes = standardResourceTypes ;

        }
    );

    //get the codeSystems used as defaults when entering a terminology code manually
    RenderProfileSvc.getCodeSystems().then(
        function (data) {
            $scope.codeSystems = data.data

        }
    );


    //initialize everything for a newly loaded profile...
    function setUpForNewProfile(profile,treeViewData) {
        $scope.selectedProfileForDisplay = profile;   //used for the profileDisplay component

        delete $scope.conformProfiles;      //profiles that this resource claims conformance to. Not for baseresources
        delete $scope.selectedChild;        //a child element off the current path (eg Condition.identifier
        delete $scope.children;             //all the direct children for the current path
        delete $scope.dataType ;            //the datatype selected for data entry
        delete $scope.validateResults;      //the results of a validation
        delete $scope.results.profileUrl;
        delete $scope.input.userText;       //the text entered by a user
        $scope.buildState = "new";

        delete $scope.resource;
        resourceCreatorSvc.setCurrentProfile(profile);  //save the profile in the service (rather than in the controller) - even if null..
        //if there's no profile, the clear everything. This is called when the server is changed...
        if (!profile) {
            drawTree();
            return;
        }

        //resourceCreatorSvc.setCurrentProfile(profile);  //save the profile in the service (rather than in the controller)
        $scope.results.profileUrl = profile.url;

        //now set the base type. If a Core profile then it will be the profile name. Otherwise, it is the constarinedType
        //changed in STU-3 !
        var baseType;

        try {
            $scope.typeDefinitionInSpec = $scope.baseUrl+ profile.snapshot.element[0].path;
        } catch (ex) {
            alert('profile has no snapshot or element!')
        }

        if (profile.constrainedType) {
            //this is an STU-2 profile
            baseType = profile.constrainedType;
            $scope.conformProfiles = [profile.url]       //the profile/s that this resource claims conformance to
        } else {

            if (profile.type) {
                //baltimore version
                //STU-3 base resource
                //if (profile.baseDefinition) {

                //getLogicalID
                baseType = profile.type;//$filter('getLogicalID')(profile.baseDefinition);
                //baseType = profile.name;
                $scope.conformProfiles = [profile.url]       //the profile/s that this resource claims conformance to


            } else if (profile.baseDefinition) {
                //montreal version
                baseType = $filter('getLogicalID')(profile.baseDefinition);
                $scope.conformProfiles = [profile.url]
            } else {
                //STU-2 base resource
                baseType = profile.name;
            }
        }
/*

        if (profile.constrainedType) {
            //this is an STU-2 profile
            baseType = profile.constrainedType;
            $scope.conformProfiles = [profile.url]       //the profile/s that this resource claims conformance to
        } else {
            if (profile.baseType == 'DomainResource') {
                //STU-3 base resource
                baseType = profile.name;
            } else if (profile.baseType) {
                //STU-3 profile
                baseType = profile.baseType;
                $scope.conformProfiles = [profile.url]       //the profile/s that this resource claims conformance to
            } else {
                //STU-2 base resource
                baseType = profile.name;
            }
        }

        */

        type = baseType;
        //when restore from parked, the treeViewData will already be restored. Otherwise craete a blank one
        if (! treeViewData) {
            $scope.treeData.length = 0;         //removes all the treedata from the array
            //create the root node.
            var rootEd = resourceCreatorSvc.getRootED(type);
            $scope.treeData.push({id:'root',parent:'#',text:type,state:{opened:true,selected:true},path:type,
                ed:rootEd});

            //add the current patient
            var ed = resourceCreatorSvc.getPatientOrSubjectReferenceED();
            if (ed) {
                resourceCreatorSvc.addPatientToTree(ed.path,appConfigSvc.getCurrentPatient(),$scope.treeData);
            }
        }





        if (! treeViewData) {
            navigatorNodeSelected('root', rootEd);   //this will display the child nodes of the root




            //used for the initial display
            $scope.selectedNode = getNodeFromId('root');
        }




        drawTree();
    }

    //when validating  the resource under construction
    $scope.validate = function(){
        delete $scope.validateResults;
        $scope.waiting = true;
        var cleanedData = resourceCreatorSvc.cleanResource($scope.treeData);
        $scope.treeData = cleanedData;
        $scope.validatingResource = true;

        drawTree(); //when the tree load is complete, the 'treebuild' event is raised. the handler looks at 'savingResource' and calls save...


    };

    $scope.saveToServer = function(){

        //remove bbe that are not referenced...
        var cleanedData = resourceCreatorSvc.cleanResource($scope.treeData);
        $scope.treeData = cleanedData;
        $scope.savingResource = true;

        drawTree(); //when the tree load is complete, the 'treebuilt' event is raised. the handler looks at 'savingResource' and calls save...

    };

    //build the resource. Note that this depends on the model created by jsTree so can only be called
    //after that has been rendered...
    var buildResource = function(){
        //make sure there's a profile before building from it...
        if (resourceCreatorSvc.getCurrentProfile()) {
            var treeObject = $('#treeView').jstree().get_json();    //creates a hierarchical view of the resource

            var config = {};
            config.profile = $scope.conformProfiles;    //profiles that this resource claims conformance to...
            config.userText = $scope.input.userText;

            var resourceType = resourceCreatorSvc.getResourceTypeForCurrentProfile();


            //builds the resource. Parameters base type, hierarchical tree view, raw tree data, other config stuff
            //todo note that it should be possible to generate the hierarchical view without depending on tree view which will tidy things up a bit
            $scope.resource = resourceCreatorSvc.buildResource(resourceType,treeObject[0],$scope.treeData,config)
            //$scope.resource = resourceCreatorSvc.buildResource(type,treeObject[0],$scope.treeData,config)


            //the properties to enable the download of the resource
            $scope.downloadResourceJsonContent = window.URL.createObjectURL(new Blob([angular.toJson($scope.resource, true)], {type: "text/text"}));
            $scope.downloadResourceJsonName = $scope.resource.resourceType + "-" + new Date().getTime();
        }


        
    };

    $scope.$on('treebuilt',function(){

        //called after the tree has been built. Mainly to support the saving and validating
        if ($scope.savingResource) {
            delete $scope.savingResource;
            saveResourceToServer()
        }

        if ($scope.validatingResource) {
            delete $scope.validatingResource;
            Utilities.validate($scope.resource).then(
                function(data){
                    $scope.validateResults = {outcome:'The resource is valid!'};
                },
                function(data) {
                    var oo = data.data;

                    if (oo && oo.issue) {
                        delete oo.text;
                    }
                    $scope.validateResults = oo;


                    var errorLog = {};
                    errorLog.resource = $scope.resource;
                    errorLog.original = $scope.isEditingResource;
                    errorLog.oo = oo;
                    errorLog.server = appConfigSvc.getCurrentDataServer();
                    try {
                        if ($scope.firebase.auth().currentUser) {
                            errorLog.user = {id:$scope.firebase.auth().currentUser.uid,email:$scope.firebase.auth().currentUser.email};
                            console.log($scope.firebase.auth().currentUser)
                        }
                    } catch (ex) {

                    }


                    errorLog.action= 'validate';
                    SaveDataToServer.submitErrorReport(errorLog);


                }
            ).finally(function(){
                $scope.waiting = false;
            })
        }

    });

    //hide the outcome of the validate operation...
    $scope.closeValidationOutcome = function(){
        delete $scope.validateResults;
    };

    //draws the tree showing the current resource
    function drawTree() {


        //if there's a problem with the treeData array, then it will crash...
        if (! resourceCreatorSvc.checkTreeConsistency( $scope.treeData)) {
            //alert('The tree is not consistent!')
            var modalOptions = {
                closeButtonText: "No, I'll start again",
                actionButtonText: 'Yes, please revert',
                headerText: 'Resource Inconsistency Error',
                bodyText: "I'm sorry, there's an internal problem with the resource structure - do you want to revert to the previous version?"
            };

            modalService.showModal({}, modalOptions).then(function (result) {
                    //this is the 'yes'

                    $scope.treeData =  $scope.lastTreeData;

                },
                function(){
                    //user didn't want to revert...
                    return;
            });


        }

        $('#treeView').jstree('destroy');
        $('#treeView').jstree(
            {'core': {'multiple': false, 'data': $scope.treeData, 'themes': {name: 'proton', responsive: true}}}
        ).on('changed.jstree', function (e, data) {
            //seems to be the node selection event...

            //the node is the treedata[] array element that defines the node.
            // {id, parent, ed, text, path, isBe, dataType, state, fragment, display }
            if (data.node) {
                var node = getNodeFromId(data.node.id);

                $scope.selectedNode = node;         //used in the html template...

                if (node && node.ed) {
                    navigatorNodeSelected(data.node.id, node.ed)
                }

                $scope.$digest();       //as the event occurred outside of angular...
            }


        }).on('redraw.jstree', function (e, data) {

            if ($scope.treeData.length > 0) {
                buildResource();
                $scope.$broadcast('treebuilt');
                $scope.$digest();       //as the event occurred outside of angular...
            }

        });


    }

    //when the user has selected a node in the navigator tree (or called externally). Display the value of the node or possible child nodes
    var navigatorNodeSelected = function(nodeId,ed,cb){
      //  $scope.selectedNode = node;
        delete $scope.children;     //the node may not have children (only BackboneElement datatypes do...
        $scope.selectedNodeId = nodeId;   //the currently selected element. This is the one we'll add the new data to...
        delete $scope.dataType;     //to hide the display...
        resourceCreatorSvc.getPossibleChildNodes(ed,$scope.treeData).then(
            function(data){
                $scope.children = data;    //the child nodes...

            },
            function(err){

            }
        );
    } ;


    //when one of the datatypes of the child nodes of the currently selected element in the tree is selected...
    $scope.childSelected = function(ed,inx) {

        delete $scope.dtSelectError;    //shows an error when there are multiple ValusSets with teh same URL
        

        $scope.selectedChild = ed;

        //the datatype of the selected element. This will display the data entry form.
        $scope.dataType = ed.type[inx].code;

        if ($scope.dataType == 'Reference') {
            //this is a reference to another resource. We need to get the exact type that was selected...
            //this is used in the next code segment to retrieve the matching existing resources
            var type = ed.type[inx];
            if (type.profile)  {
                //var ar = type.profile[0].split('/');
                var ar = Utilities.getProfileFromType(type).split('/');



                $scope.resourceType = ar[ar.length-1];         //the type name (eg 'Practitioner')
                //$scope.resourceProfile = type.profile[0];       //the profilefor this type. todo - could really lose $scope.resourceType...
                $scope.resourceProfile = Utilities.getProfileFromType(type);       //the profilefor this type. todo - could really lose $scope.resourceType...



            } else {
                //if there's no profile, then the reference can be to any profile...
                $scope.resourceType = 'Resource';
                $scope.resourceProfile = 'Resource';
            }


        }

        if ($scope.dataType == 'BackboneElement') {
            //if this is a BackboneElement, then add it to the tree and select it todo - may want to ask first
            //when selected in true - allbbe of that type are selected...
            var treeNode = {id : 't' + new Date().getTime(),state:{opened:true,selected:false}};       //the new node is selected and opened...
            treeNode.parent =  $scope.selectedNodeId;
            treeNode.ed =   $scope.selectedChild;     //the ElementDefinition that we are adding
            treeNode.text = $scope.selectedChild.myData.display;    //the property name
            treeNode.path = $scope.selectedChild.path;
            //treeNode.type = 'bbe';      //so we know it's a backboneelement, so should have elements referencing it...
            treeNode.isBbe = true;      //so we know it's a backboneelement, so should have elements referencing it...

            if ($scope.selectedChild.cfIsComplexExtension) {
                treeNode.isComplexExtension = true;
                treeNode.path='extension'

            }

            //add the new node to the tree...
            $scope.lastTreeData = angular.copy($scope.treeData);        //to support limited undo...
            $scope.treeData.push(treeNode);    //todo - may need to insert at the right place...


            //remove the 'selected' from the currently selected node. (We'll change the selectedNode to the newly added bbe below)
            if ($scope.selectedNode) {
                var n = getNodeFromId($scope.selectedNode.id);
                if (n && n.state) {
                    n.state.selected = false;
                } else {
                    console.log('issue: nodeid ' + $scope.selectedNode.id + ' not found in saveNewDataType')
                }

            }



            $scope.selectedNodeId = treeNode.id;   //the currently selected element in the tree (now). This is the one we'll add the new data to...
            var node = getNodeFromId(treeNode.id);  //todo can't I just use treeNode directly??
            $scope.selectedNode = node;     //amongst other things, is the display in the middle of the screen...

            $scope.waiting = true;
            resourceCreatorSvc.getPossibleChildNodes(node.ed,$scope.treeData).then(
                function(data){
                    $scope.children = data;    //the child nodes...
                },
                function(err){

                }
            ).finally(function(){
                $scope.waiting = false;
            });


            drawTree() ;        //and redraw...

        } else {
            //this is a normal element - get set up to enter data specific to the datatype...

            //todo this is all carryover stuff - should go thru and check if needed...
            $scope.index = inx;         //save the position of this element in the list for reference slect
            delete $scope.externalReferenceSpecPage;
            delete $scope.elementDefinition;
            delete $scope.vsExpansion;
            delete $scope.UCUMAge;

            delete $scope.resourceReferenceText;
            delete $scope.profileUrlInReference;
            delete $scope.resourceList;


            $scope.results = {};                //clear any existing data...
            $scope.results.boolean = false;
            $scope.results.timing = {};         //needed for timing values...

            $scope.externalReferenceSpecPage = "http://hl7.org/datatypes.html#" + $scope.dataType;

            //sets up the results variable ready for the data entry form
            //todo - also modifies some of the scope variables - this requries a good check...
            resourceCreatorSvc.dataTypeSelected($scope.dataType,$scope.resourceProfile,
                $scope.results,ed,$scope,appConfigSvc.getAllResources());

            //now see of there were any errors. This is modifying a scope variable - todo should tidy this...
            if ($scope.dtSelectError) {
                alert($scope.dtSelectError)
            }

        }
    };

    //called when selecting from all resources, and a particular type has been selected. Note that an object
            //is passed - not just the type as a string...
    $scope.resourceTypeSelected = function(typeDef){
        $scope.resourceList = RenderProfileSvc.getResourcesSelectListOfType(
            appConfigSvc.getAllResources(),typeDef.key);

    };

    //select a single resource from a list of resources
    $scope.selectFromResourceList = function(lst) {
        $uibModal.open({
            templateUrl: "/modalTemplates/selectResource.html",
            size: 'lg',
            controller: function($scope,lst) {
                $scope.lst = lst;

                $scope.showJson = function(item){
                    $scope.selectedResource = item;
                };

                $scope.selectResource = function(item) {
                    $scope.$close(item);

                }
            },resolve: {
                lst : function() {
                    return lst
                }
            }
        }).result.then(
            function(item){
                //console.log(item)
                $scope.results.resourceItem = item;
            }
        )


    };

    //when a new element has been populated. The 'find reference resource' function creates the fragment - the others don't
    $scope.saveNewDataType = function(fragment) {
        fragment = fragment || resourceCreatorSvc.getJsonFragmentForDataType($scope.dataType,$scope.results);

        //now add the new property to the tree...
        if (fragment) {
/*
            //processing of complex extensions is special. Probably need to work on this...
            if ($scope.complexExtensionRoot) {

                //save the tree node in the Element definition so we can always return to it...
                var complexExtensionParentNode = $scope.complexExtensionRoot.myData.treeNode;
                if (! complexExtensionParentNode) {

                    var complexExtensionParentNode =  {
                        id: 't'+new Date().getTime(),
                        state: {opened: true},
                        //fragment: fragment.value, - don't think the parent has a fragment...
                        //display: 'complexExtension', //fragment.text,
                        text : 'complexExtension',
                        parent : $scope.selectedNodeId,
                        isComplexExtension : true,
                        path : $scope.selectedChild.path,
                        ed : angular.copy($scope.selectedChild),
                        childValues : {}
                    };

                    $scope.complexExtensionRoot.myData.treeNode = complexExtensionParentNode;
                    $scope.treeData.push(complexExtensionParentNode);    //todo - may need to insert at the right place...

                }

                //so at this point we have the parent tree node. Need to add the child node to represent the child value just entered...
                var childName = $scope.complexExtensionChild.name;      //the name (url) of the extesion child...
                if (! complexExtensionParentNode.childValues[childName]) {
                    //there isn't already a value...
                    complexExtensionParentNode.childValues[childName] = fragment //todo - is this enough?
                    //now add a tree node to represent the new value...
                    var childTreeNode = {
                        id: 't'+new Date().getTime(),
                        state: {opened: true},
                        fragment: fragment.value,
                        display: fragment.text,
                        path:'Extension',
                        text : childName
                    };
                    childTreeNode.parent = complexExtensionParentNode.id;   //the reference to the parent...
                    childTreeNode.ed = {myData : {},path:'Path'};     //hmmm we don;t have an ed for the child...
                    $scope.treeData.push(childTreeNode)

                }

                //sorting is critical for the resourc ebuilder to work - as well as aligning the resource element order with the definition. Don't remove!
                    $scope.treeData.sort(function(a,b){

                        if (a.ed.myData.sortOrder > b.ed.myData.sortOrder ){
                            return 1;
                        } else {
                            return -1;
                        }
                    });





                console.log(fragment,$scope.complexExtensionRoot.myData.treeNode);
                delete  $scope.dataType;        //to clear the data entry screen...

                drawTree();        //and redraw...
                return;
            }
            */

            var treeNode = {
                id: 't'+new Date().getTime(),
                state: {opened: true},
                fragment: fragment.value,
                display: fragment.text
            };
            treeNode.parent = $scope.selectedNodeId;   //the reference to the parent...
            treeNode.ed = $scope.selectedChild;     //the ElementDefinition that we are adding

            var display = $scope.selectedChild.myData.display;  //from the ED...
            if (display.indexOf('[x]') > -1) {
                //this is a polymorphic field...
                display = display.slice(0, -3) + $scope.dataType.toProperCase();

            }
            treeNode.text = display;    //the property name
            treeNode.path = $scope.selectedChild.path;
            treeNode.dataType = {code: $scope.dataType};

            //add the new node to the tree...
            $scope.lastTreeData = angular.copy($scope.treeData);
            $scope.treeData.push(treeNode);    //todo - may need to insert at the right place...

            //sorting is critical for the resourc ebuilder to work - as well as aligning the resource element order with the definition. Don't remove!
            $scope.treeData.sort(function(a,b){

                if (a.ed.myData.sortOrder > b.ed.myData.sortOrder ){
                    return 1;
                } else {
                    return -1;
                }
            });


            //NOTE: uncommenting this line will select the node after data is entered. Gives a wierd result...

             //$scope.selectedNode = treeNode;     //todo !!!!! may not be correct - may need to use getNodeFromId(treeNode.id);

            if ($scope.selectedNode) {
                var n = getNodeFromId($scope.selectedNode.id);
                if (n && n.state) {
                    n.state.selected = true;
                } else {
                    console.log('issue: nodeid ' + $scope.selectedNode.id + ' not found in saveNewDataType')
                }
            }

            $scope.buildState = 'dirty';        //to indicate that the resource has been updated



            //re-draw the child list as this might be a single value only...
            resourceCreatorSvc.getPossibleChildNodes($scope.selectedNode.ed,$scope.treeData).then(
                function(data){
                    $scope.children = data;    //the child nodes...
//console.log(data)
                    //delete the datatype - this will hide the input form...
                },
                function(err){

                }

            );


            drawTree();        //and redraw...
            delete  $scope.dataType;
        } else {
            alert('There was an error creating this element. Sorry, I cannot continue.')
            delete  $scope.dataType;        //to clear the data entry screen...
        }

    };
            

    //when entering a new element, if the user selects cancel...
    $scope.cancel = function() {
        delete $scope.dataType;
    };

    $scope.removeNode = function() {

        var id = $scope.selectedNode.id;        //the node to delete

        //create list of nodes to delete
        var arDelete = [];
        arDelete.push(id);

        //so go through  the data. if an item has any entry in arDelete as a parent, then add it to the list
        //not sure if there's an issue with ordering...

        var foundElementToDelete = true

        while (foundElementToDelete) {
           // console.log('pass')
            foundElementToDelete = false;
            for (var i=0; i<$scope.treeData.length;i++) {
                var element = $scope.treeData[i];
                if (arDelete.indexOf(element.parent) > -1) {     //if the parent is to be deleted, then it has to be as well...

                    if (arDelete.indexOf(element.id)== -1) {
                        //if it's not already in the array then add it
                        arDelete.push(element.id);
                        foundElementToDelete = true;
                    }

                }
            }
        }



        //console.log(arDelete)

        //now create a new array with all the non-deleted elements...
        var newTreeArray = [];
        for (var i=0; i<$scope.treeData.length;i++) {
            var element = $scope.treeData[i];
            if (arDelete.indexOf(element.id) ==- 1) {
                newTreeArray.push(element);
            }
        }
        //console.log(newTreeArray)

        $scope.treeData = newTreeArray
        delete $scope.selectedNode;
        drawTree();



        return;

        //-----------


        var id = $scope.selectedNode.id;
        var inx = -1;
        for (var i=0; i<$scope.treeData.length;i++) {
            if ($scope.treeData[i].id == id) {
                inx = i;
            }
        }

        if (inx > -1) {
            //remove the element with this id...
            $scope.treeData.splice(inx,1);

            //need to remove any childnodes as well... Note that if it leaves an empty parent, then that will be removed as well

            var newTreeArray = resourceCreatorSvc.cleanResource($scope.treeData);
            //var newTreeArray = resourceCreatorSvc.cleanResource(newTreeArray);



            $scope.treeData = newTreeArray;


                try {
                    drawTree();
                } catch (e) {
                    alert('de')
                }

        }

    };

    var getNodeFromId = function(id) {
        for (var i=0; i<$scope.treeData.length;i++) {
            if ($scope.treeData[i].id == id) {
                return $scope.treeData[i]
            }
        }
        return null;
    };

    //--------- code for CodeableConcept lookup
    $scope.vsLookup = function(text,vs) {
        if (vs) {

            //the extension that indicates the vs (authored by CF) has direct concepts that are not snomed so can't be expanded
            var extensionUrl = appConfigSvc.config().standardExtensionUrl.vsDirectConcept;
            var ext = Utilities.getSingleExtensionValue(vs.resource,extensionUrl)
            if (ext && ext.valueBoolean) {

            //if the ValueSet has compose.include element/s, then chances are that the expansion won't work. We have to do it ourselves...
            //if (vs.resource && vs.resource.compose && vs.resource.compose.include  && 1==2) {
                //first, create an array with all of the composed concepts...
                var ar = [];
                vs.resource.compose.include.forEach(function(inc){
                    ar = ar.concat(inc.concept)
                });

                //now create a filtered return array
                text = text.toLowerCase();
                var returnArray = []
                if (ar && ar.length > 0) {
                    ar.forEach(function(item){
                        if (item.display && item.display.toLowerCase().indexOf(text)> -1) {
                            returnArray.push(item)
                        }
                    });
                }




                return returnArray;

                //return vs.resource.compose.include[0].concept;

            } else {
                var id = vs.id;
                $scope.waiting = true;
                return GetDataFromServer.getFilteredValueSet(id,text).then(
                    function(data,statusCode){

                        if (data.expansion && data.expansion.contains) {

                            var lst = data.expansion.contains;
                            return lst;
                        } else {
                            return [
                                {'display': 'No expansion'}
                            ];
                        }
                    }, function(vo){
                        var statusCode = vo.statusCode;
                        var oo = vo.data;



                        alert(angular.toJson(oo));

                        return [
                            {'display': ""}
                        ];
                    }
                ).finally(function(){
                    $scope.waiting = false;
                });
            }




        } else {
            return [{'display':'Select the ValueSet to query against'}];
        }
    };



    //variables for the vs browser dialog.
    //  <vs-browser trigger="showVSBrowserDialog"></vs-browser> is defined in renderProfile.html
    $scope.showVSBrowserDialog = {};
    $scope.showVSBrowser = function(vs) {
        $scope.showVSBrowserDialog.open(vs);        //the open method defined in the directive...
    };

    //----this is called when a user clicked on the 'explore valueset' button
    $scope.showVSBrowserDlg = function() {

        $scope.showWaiting = true;

        GetDataFromServer.getValueSet($scope.vsReference).then(
            function(vs) {

                $scope.showVSBrowserDialog.open(vs);

            }
        ).finally (function(){
            $scope.showWaiting = false;
        });

    };


    //when the user has selected an entry from the autocomplete...
    $scope.selectCCfromList = function(item,model,label,event){
        //get the full lookup for this code - parents, children etc.

        if (item.system) {
            $scope.results.ccDirectSystem = item.system;
            $scope.results.ccDirectCode = item.code;
            //console.log($scope.results.cc)
            $scope.results.ccDirectDisplay = $scope.results.cc.display;


            resourceCreatorSvc.getLookupForCode(item.system,item.code).then(
                function(data) {
                   //console.log(data);
                    resourceCreatorSvc.parseCodeLookupResponse(data.data).then(
                        function(d) {
                            $scope.terminologyLookup = d;
                        }
                    )

                    //console.log($scope.terminologyLookup);
                },
                function(err) {
                    //this will generally occur when using stu-2 - so ignore...
                    //alert(angular.toJson(err));
                }
            );
        } else {
            alert('null system value')
        }


//console.log(item,model,label)
    };

    function setTerminologyLookup(system,code) {
        resourceCreatorSvc.getLookupForCode(system,code).then(
            function(data) {
                //console.log(data);
                resourceCreatorSvc.parseCodeLookupResponse(data.data).then(
                    function(d) {
                        $scope.terminologyLookup = d;
                    }
                )

                //console.log($scope.terminologyLookup);





            },
            function(err) {
                alert(angular.toJson(err));
            }
        );
    }

    $scope.selectChildTerm = function(code,description){
        $scope.results.ccDirectDisplay = description;
        $scope.results.ccDirectCode = code;

        //amsterdam
        $scope.results.cc = {code:code,system:$scope.results.ccDirectSystem,display:description};
        $scope.results.ccText = description;


        setTerminologyLookup($scope.results.ccDirectSystem,code)
    }

    //the user selects the parent...
    $scope.selectParentCC = function(parent) {
        $scope.results.ccDirectDisplay = parent.description;
        $scope.results.ccDirectCode = parent.value;

        //amsterdam
        $scope.results.cc = {code:parent.value,system:$scope.results.ccDirectSystem,display:parent.description};
        $scope.results.ccText = parent.description;

        //look up the relations to this one...
        setTerminologyLookup($scope.results.ccDirectSystem,$scope.results.ccDirectCode)


        //$scope.results.cc = $scope.terminologyLookup.parent;
        //console.log('s')
    };

    //use the terminology operation CodeSystem/$lookup to get details of the code / system when manually entered
    $scope.lookupCode = function(system,code) {


        resourceCreatorSvc.getLookupForCode(system,code).then(
            function(data) {
               // console.log(data);
                resourceCreatorSvc.parseCodeLookupResponse(data.data).then(
                    function(d) {
                        $scope.terminologyLookup = d
                            $scope.results.ccDirectDisplay = $scope.terminologyLookup.display;

                    }
                )

                //console.log($scope.terminologyLookup);

            },
            function(err) {
                alert(angular.toJson(err));
            }
        )
    };

    //------- when the user wants to find a reference type resource - ie one that doesn't reference a patient...
    $scope.searchResource = function() {

        var modalInstance = $uibModal.open({
            templateUrl: "/modalTemplates/searchForResource.html",
            size : 'lg',
            controller: 'searchForResourceCtrl',
            resolve: {
                vo : function() {
                    return {

                        resourceType: $scope.resourceType
                    }
                },
                profileUrl : function() {
                    //if this is a profiled reference...
                    return $scope.profileUrlInReference;
                }
            }
        });

        //a promise to be resolved when modal exits.
        modalInstance.result.then(function (selectedResource) {
            //user clicked OK
            if (selectedResource) {


                var v = {reference: selectedResource.resourceType + "/" + selectedResource.id};
                v.display = ResourceUtilsSvc.getOneLineSummaryOfResource(selectedResource);

                $scope.saveNewDataType({value:v,text:v.display});

            }

        }, function () {
            //no resource selected...
        });
    };


    //save the current resource and build another based on the profile in the currently selected child element...
    $scope.park = function() {
        var modalOptions = {
            closeButtonText: "Don't park",
            actionButtonText: 'Ok',
            headerText: 'Park resource',
            bodyText: 'The resource instance has been parked and can be retrieved later'
        };
        modalService.showModal({}, modalOptions).then(function (result) {
            var profile = resourceCreatorSvc.getCurrentProfile();
            var patient = appConfigSvc.getCurrentPatient();
            resourceCreatorSvc.parkResource({treeData:angular.copy($scope.treeData),
                profile:profile,display:profile.name, patient:patient});

            $scope.displayMode = 'front';
        });
    };

    $scope.restoreFromParked = function(park,inx) {
        delete $scope.treeData;
        $scope.treeData = park.treeData;
        appConfigSvc.setCurrentPatient(park.patient);
        setUpForNewProfile(park.profile,$scope.treeData)

        //$scope.selectedNode

        var modalOptions = {
            closeButtonText: "Don't remove",
            actionButtonText: 'Ok',
            headerText: 'UnPark resource',
            bodyText: 'Do you want to remove the resource from the parked list'
        };

        modalService.showModal({}, modalOptions).then(function (result) {
            resourceCreatorSvc.removeParkedResource(inx)
        });

        $scope.displayMode = 'new';     //will cause the editing page to be displayed


        //display the children of the root...
        try {
            var rootEd = park.profile.snapshot.element[0];

            //set the selected node to the root node...
            $scope.selectedNode = getNodeFromId($scope.treeData[0].id);     //amsterdam

            navigatorNodeSelected('root', rootEd);   //this will display the child nodes of the root

        } catch (ex) {
            alert("There was an error selecting the root in the navigator. That's OK - just do it yourself");
        }




    };

    $scope.parkAndBuildDEP = function() {

        var ed = $scope.selectedChild;  //the ED describing the current element
        if (ed && ed.type && ed.type[0].profile) {

            var profileName =Utilities.getProfileFromType(ed.type[0]);
            //var profileName =ed.type[0].profile[0];
            alert(profileUrl)
        }
    };

    //perform the actual save operation
    var saveResourceToServer = function() {
        var modalInstance = $uibModal.open({
            templateUrl: 'modalTemplates/confirmNewResource.html',
            size:'lg',
            controller: function($scope,resource,showWaiting,existingResource,appConfigSvc) {
                $scope.showWaiting = showWaiting;
                $scope.resource = resource;
                $scope.outcome="";       //not saved yet...
                $scope.saveState="before";
                $scope.input ={};

                $scope.showWaiting = true;
                if (existingResource) {
                    $scope.resource.id = existingResource.id;
                }


                $scope.saveResource = function() {
                    $scope.saving = true;
                    SaveDataToServer.saveResource($scope.resource).then(
                        function(data) {
                            //save successful...

                            $scope.saveState='success';
                            $scope.saving = false;
                            $scope.outcome = "Resource saved at: ";

                            //determine the id of the resource assigned by the server
                            var serverUrl;
                            serverUrl = data.headers('Content-Location');
                            if (! serverUrl) {
                                serverUrl = data.headers('Location');
                            }

                            $scope.outcome += serverUrl;

                            //get the actual ID from the location. This could be a service call
                            var ar = serverUrl.split('/');
                            var resourceType = $scope.resource.resourceType;
                            var inx = -1;
                            ar.forEach(function(el,pos){
                                if (el == resourceType) {
                                    inx = pos;
                                }
                            });

                            //the id will be the value after the type...
                            if (inx > -1) {
                                $scope.resource.id = ar[inx+1];
                              //  console.log($scope.resource)
                            }


                            var user = {}
                            if ($scope.firebase && $scope.firebase.auth()) {
                                user = $scope.firebase.auth().currentUser;
                            }

                            resourceCreatorSvc.registerSuccessfulResourceCreated(serverUrl,$scope.resource,
                                appConfigSvc.getCurrentPatient(),user);

                        },
                        function(oo) {

                            var errorLog = {};
                            errorLog.resource = resource;
                            errorLog.original = existingResource;
                            errorLog.oo = oo;
                            errorLog.server = appConfigSvc.getCurrentDataServer();
                            errorLog.action= 'save';
                            try {
                                if ($scope.firebase.auth().currentUser) {
                                    errorLog.user = {id:$scope.firebase.auth().currentUser.uid,email:$scope.firebase.auth().currentUser.email};
                                }
                            } catch (ex) {

                            }

                            SaveDataToServer.submitErrorReport(errorLog);


                            $scope.saveState='fail';
                            $scope.saving = false;
                            $scope.outcome = "There was an error saving the resource: " ;
                            $scope.oo = oo;


                        }
                    ).finally(function(){
                        $scope.showWaiting = false;
                    })
                }

                $scope.close = function(){
                    $scope.$close($scope.resource);
                };

                $scope.cancel = function(){
                    $scope.$dismiss();
                }

            },
            resolve : {
                resource : function() {
                    return $scope.resource;
                },
                showWaiting : function(){
                    return $scope.waiting;
                },
                existingResource : function(){
                    return $scope.isEditingResource;    //if we are editing an existing resource..
                }
            }
        }).result.then(function(resource){
            $scope.buildState = 'saved';    //todo should really check for save erors
                $scope.isEditingResource = resource;
                //console.log(resource)

                $rootScope.$emit("reloadPatient");      //will trigger a re-load of the resources for this patient...
            });
        };


    //=========== selecting a new profile ============

    $scope.showFindProfileDialog = {};


    //when a profile is selected...  This is configured in the directive...  Now called from the front page
    $scope.selectedProfileFromDialog = function(profile) {


        resourceCreatorSvc.insertComplexExtensionED(profile).then(
            function(profile) {
                var adhocServer;
                if (profile.adhocServer) {
                    //if profile.adhocServer is set, then this is an adhoc selection...

                    adhocServer = profile.adhocServer;
                    delete profile.adhocServer;

                }



                resourceCreatorSvc.setCurrentProfile(profile);

                //if there's a project active, then update it. todo need tothink about security for this...
                if ($rootScope.currentProject) {
                    appConfigSvc.addProfileToProject(profile,$rootScope.currentProject,$rootScope.fbProjects,adhocServer)

                }


                $scope.dirty=false;     //a new form is loaded
                $scope.parkedHx = false;
                //create aclone to store in the history, as we'll hack the profile as part of the builder (ehgwhen finding child nodes)
                var clone = angular.copy(profile);
                appConfigSvc.addToRecentProfile(clone);

                $scope.recent.profile = appConfigSvc.getRecentProfile();    //re-establish the recent profile list
                setUpForNewProfile(profile);
            },
            function(profile) {
                alert('error inserting complex extension ED')
            }
        );



    };


    $scope.selectPatientResourceType = function(bundle) {

        $scope.selectedPatientResourcesOfType = bundle;
    };



    //=========== these functions support the 'view resources' display. todo - ?move to a separate controller???
    $scope.typeSelected = function(vo) {
        //vo created to better support the display - has the type and the bundle containing all resources of that type
        delete $scope.outcome.selectedResource;
        delete $scope.vitalsTable;

        $scope.outcome.selectedType = vo.type;
        $scope.outcome.allResourcesOfOneType = vo.bundle;
    };



     function createGraphOneResource(resource,containerId) {

        //todo this is likely inefficient as may have already been done..
         var resourceReferences = resourceSvc.getReference(resource, $scope.allResourcesAsList, $scope.allResourcesAsDict);

         var graphData = resourceCreatorSvc.createGraphAroundSingleResourceInstance(resource,resourceReferences)
         var container = document.getElementById(containerId);

         var network = new vis.Network(container, graphData, {});
         $scope.graph[containerId] = network;

         network.on("click", function (obj) {


             var modalOptions = {
                 closeButtonText: 'No, I made a mistake',
                 actionButtonText: 'Yes, load it',
                 headerText: 'Change resource',
                 bodyText: 'Do you wish to make this resource the focus?'
             };

             modalService.showModal({}, modalOptions).then(function (result) {
                 var nodeId = obj.nodes[0];  //get the first node
                 var node = graphData.nodes.get(nodeId);
                 $scope.resourceSelected({resource:node.resource});
                 $scope.$digest();
             })





         });
     }

    $scope.fitGraphInContainer = function(containerId) {


        if ($scope.graph[containerId]) {

            //this event is commonly called by tab.select() which I think is fired before the tab contents are shown.
            //for the fit() to work, we wait a bit to be sure that the contents are displayed...
            $timeout(function(){
                $scope.graph[containerId].fit()
                console.log('fitting...')
            },500            )

        }
    };

    //when an individual resource has been selected... isVersion is true whendisplaying a version
    $scope.resourceSelected = function(entry,isVersion) {
        delete $scope.outcome.selectedResource;
        delete $scope.resourceReferences;
        delete $scope.downloadLinkJsonContent;
        delete $scope.downloadLinkJsonName;
        delete $scope.xmlResource;
        delete $scope.downloadLinkXmlContent;
        delete $scope.downloadLinkXmlName;
        delete $scope.resourceVersions;

        if (entry && entry.resource) {
            $rootScope.$broadcast('setWaitingFlag',true);
            var resource = entry.resource;
            drawResourceTree(resource);         //display the resource tree
            $scope.outcome.selectedResource = resource;     //for the json display
            $scope.resourceReferences = resourceSvc.getReference(resource, $scope.allResourcesAsList, $scope.allResourcesAsDict);

            if (! isVersion) {
                //don't load versions again!
                $scope.loadVersions(resource);  //load all the versions for this resource...
            }


            //create and draw the graph representation for this single resource...

            createGraphOneResource(resource,'resourcenetwork')
            
            $scope.downloadLinkJsonContent = window.URL.createObjectURL(new Blob([angular.toJson(resource, true)], {type: "text/text"}));
            $scope.downloadLinkJsonName = resource.resourceType + "-" + resource.id;

            GetDataFromServer.getXmlResource(resource.resourceType + "/" + resource.id + "?_format=xml&_pretty=true").then(
                function (data) {
                    $scope.xmlResource = data.data;
                    $scope.downloadLinkXmlContent = window.URL.createObjectURL(new Blob([data.data], {type: "text/xml"}));
                    $scope.downloadLinkXmlName = resource.resourceType + "-" + resource.id + ".xml";

                },
                function (err) {
                    $scope.xmlResource = "<error>Sorry, Unable to load Xml version</error>";
                   // alert(angular.toJson(err, true))
                }
            ).finally(function(){
                $rootScope.$broadcast('setWaitingFlag',false);
            })

        }

    };


    $scope.selectNewResource = function(reference) {
        $scope.resourceSelected({resource:reference.resource})

    };
    //--------------------------------

    //---------options for date popup
    $scope.dateOptions = {
        formatYear: 'yy',
        startingDay: 1
    };
    $scope.format = 'dd-MMMM-yyyy';
    $scope.cal = {};
    $scope.dateOpen1 = function($event,opened) {
        $event.preventDefault();
        $event.stopPropagation();
        $scope.cal[opened] = ! $scope.cal[opened];
    };


    $scope.showValidateInstance = function(){


        $uibModal.open({
            //backdrop: 'static',      //means can't close by clicking on the backdrop. stuffs up the original settings...
            //keyboard: false,       //same as above.
            templateUrl: 'modalTemplates/validateInstance.html',
            size:'lg',




            controller: function($scope,appConfigSvc,resourceCreatorSvc){
                $scope.config = appConfigSvc.config();

                $scope.input = {show:'raw',extValue:{},copyFile:{}};      //options = raw, results, parsed

                var url= $scope.config.servers.conformance;
                for (var i=0; i < $scope.config.allKnownServers.length;i++){
                    if ($scope.config.allKnownServers[i].url == url){
                        $scope.input.server = $scope.config.allKnownServers[i];
                        break;
                    }
                }
                //

                //called when a user selects a Validation Server
                $scope.selectValidationServer = function(url) {
                    //if there is a parsed resource, then download all profiles from that server on that type...
                    if ($scope.resource ){
                        getProfilesForResourceType($scope.resource.resourceType)
                    }
                };

                //when a user selects a profile - create the array of valuesets referenced by this profile
                $scope.selectValidationProfile = function(profile){

                    $scope.valueSets = [];

                    if (profile && profile.snapshot && profile.snapshot.element) {
                        profile.snapshot.element.forEach(function(el){

                            if (el.binding) {

                                $scope.valueSets.push(el)
                            }

                        })
                    }

                }

                //copy the profile from one server to another
                $scope.copyProfile = function(targetServer, profile) {


                    var sourceServer = $scope.input.server;

                    resourceCreatorSvc.copyConformanceResource(profile.url,sourceServer.url,targetServer.url).then(
                        function(msg){
                            $scope.copyOutcome = msg

                        },
                        function (err) {
                            $scope.copyOutcome = err
                            console.log(err)
                        }
                    )



                };


                $scope.checkServerHasDefs = function(){
                    //check that all of the ExtensionDefintions in the resource are on the server performing validation...
                    $scope.waiting = true;
                    resourceCreatorSvc.checkExtensionDefinitionsAreOnServer($scope.input.server.url,$scope.extensions).then(
                        function(updatedExt) {

                        },function(err){
                            console.log(err)
                        }
                    ).finally(function(){
                        $scope.waiting = false;
                    })
                };

                $scope.checkServerHasValueSets = function(){
                    //check that all of the ExtensionDefintions in the resource are on the server performing validation...
                    $scope.waiting = true;
                    resourceCreatorSvc.checkValueSetsAreOnServer($scope.input.copyServer.url,$scope.valueSets).then(
                        function(updatedExt) {

                        },function(err){
                            console.log(err)
                        }
                    ).finally(function(){
                        $scope.waiting = false;
                    })
                };



                $scope.load = function() {
                    //load a resource from a server...
                    var url = "http://fhir.hl7.org.nz/dstu2/AllergyIntolerance/84651";
                    GetDataFromServer.adHocFHIRQuery(url).then(
                        function(data) {
                            $scope.instance = angular.toJson(data.data,true);
                            parse($scope.instance);
                        }
                    )
                };

                //when the user selets the parse button...
                $scope.parse = function () {
                    parse($scope.instance);
                    $scope.input.show='parse';
                };

                //parse the content to extract extension data
                var parse = function(json) {
                    try {
                        $scope.resource = angular.fromJson(json);
                    } catch (ex){
                        alert('This is not valid Json!');
                        return;
                    }


                    $scope.extensions = [];        //this will contain the extensions in this resource...

                    function processExtensionArray(ar,path) {
                        //process array. If they are extensions then add them to the list and return true.
                        //if they are not, then return false and the caller will parse each element...
                        //var isExtensionArray = false;
                        ar.forEach(function(el){
                            //console.log('ext==>',el)
                            var vo = {};
                            vo.path = path;
                            //the extension will have 2 properties: 'url' and one starting with 'value'
                            angular.forEach(el,function(v,k) {
                                if (k == 'url') {
                                    vo.url = v
                                } else {
                                    vo.value = v
                                }
                            })

                           // console.log(vo);
                            $scope.extensions.push(vo);
                        });
                        //return isExtensionArray;
                    }

                    function parseBranch(branch,path) {
                        angular.forEach(branch,function(v,k){


                            if (angular.isArray(v)){
                                //an array could either be a set of extensions, or a 'multiple' element
                                if (k == 'extension' || k.substr(0,1) == '_') {
                                    processExtensionArray(v,path);
                                } else {
                                    //this is not an extension array - parse each element...
                                    v.forEach(function(el){
                                        parseBranch(el,path + '.' + k)
                                    })
                                }




                            } else if (angular.isObject(v)){
                                //if it's an object, then check the children as well. This could be a complex datattype or a backbone element
                                //console.log('obj')
                                parseBranch(v,path + '.' + k)
                            } else {
                                //console.log('strng')
                            }
                        })
                    }

                    parseBranch($scope.resource,$scope.resource.resourceType);       //kick off the parsing of the resource...

                    //now get all the known profiles for this resource type from the currently selected server...
                    //todo - chang
                    getProfilesForResourceType($scope.resource.resourceType)

                };


                //retrieve all the profiles based on this resource type on the server
                function getProfilesForResourceType(resourceType) {
                    $scope.profilesThisType = [];
                    //todo - add the standard profile for this type..
                    var url = $scope.input.server.url + "StructureDefinition?kind=resource&type="+resourceType;
                    GetDataFromServer.adHocFHIRQuery(url).then(
                        function(data) {

                            if (data.data && data.data.entry) {
                                //this is a bundle
                                data.data.entry.forEach(function(ent){
                                    var url = ent.resource.url;     //the 'canonical' url for this profile...
                                    $scope.profilesThisType.push(ent.resource);
                                })
                            }




                        },
                        function(err){
                            console.log(err)
                        }
                    )
                }

                $scope.profile = resourceCreatorSvc.getCurrentProfile();

                $scope.validate = function(){
                    delete $scope.validateResults;
                    delete $scope.error;

                    try {
                        var resource = angular.fromJson($scope.instance);
                    } catch (ex){
                        alert('This is not valid Json!');
                        return;
                    }

                    //if there is a profile selected, then add that to the resource

                    if ($scope.input.profile) {
                        resource.meta = resource.meta || {}
                        resource.meta.profile = [$scope.input.profile.url] ;
                        $scope.instance = angular.toJson(resource,true);
                    }


                    //"http://fhir.hl7.org.nz/dstu2/StructureDefinition/ohAllergyIntolerance"

                    $scope.waiting = true;
                    var oo;
                    $scope.url = $scope.input.server.url;       //just so we can display the url

                    Utilities.validate(resource,$scope.url,$scope.input.profile.url).then(
                        function(data){

                            oo = data.data;
                            if (oo.issue) {
                                delete oo.text;
                                $scope.validateResults = oo;
                            } else {
                                $scope.validateResults = {outcome:'The resource is valid!'};
                            }

                        },
                        function(data) {
                            console.log(data)


                            if (angular.isString(data.data)){
                                $scope.error = data.data;
                                console.log(data)
                                oo = {issue:['shoeme']}
                            } else {
                                 oo = data.data;

                                if (oo.issue) {
                                    delete oo.text;
                                }
                            }


                            $scope.validateResults = oo;
                        }
                    ).finally(function(){
                       // $scope.input.show='results';
                        $scope.waiting = false;
                    });

                }

                $scope.close = function () {
                    $scope.$close();
                }

            }

        })



    }


    //load the new extension page
    $scope.newExtension = function() {
        $uibModal.open({
            templateUrl: 'modalTemplates/newExtension.html',
            size: 'lg',
            controller: "extensionDefCtrl"
        }).result.then(
            function(result) {

            })
    };



})

    .controller('configCtrl',function($scope,$rootScope,configDefault,$localStorage){

        //if there's no config in the browser local storage then use the default
        var config = $localStorage.config;
        if (! config) {
            config = configDefault;
        }


        $scope.config = config;

        $scope.input = {};


        config.allKnownServers.forEach(function(svr){
            if (config.servers.data == svr.url) {$scope.input.dataServer = svr}
            if (config.servers.conformance == svr.url) {$scope.input.conformanceServer = svr}
            if (config.servers.terminology == svr.url) {$scope.input.terminologyServer = svr}
        });

        $scope.save = function () {
            config.servers.data = $scope.input.dataServer.url;
            config.servers.conformance = $scope.input.conformanceServer.url;
            config.servers.terminology = $scope.input.terminologyServer.url;
            $localStorage.config = config;
            $rootScope.$emit('configUpdated')
            $scope.$close();
        };

        $scope.cancel = function () {
            $scope.$close();
        }
        
    })
    .controller('frontCtrl',function($scope,$rootScope,$uibModal,$localStorage,appConfigSvc,resourceCreatorSvc,
                                     $translate,$interval,GetDataFromServer,$firebaseArray){



        //display the profile editor page (as also called from the profiles explorer)


        $scope.showHelp = true;
        if ($localStorage.dontNeedHelp) {
            $scope.showHelp = false;
        }

        $scope.closeHelp = function(){
            $scope.showHelp = false;
            $localStorage.dontNeedHelp = true;
        };

        $scope.input = {};
        $scope.input.showingLocalProfile = false;   //true when the currently selected profile is viewed...
        //when a new resource has been uploaded. Add to the list and select...
        $scope.resourceUploaded = function(url) {

            GetDataFromServer.getConformanceResourceByUrl(url).then(
                function(profile){
                    appConfigSvc.addToRecentProfile(profile);
                    $scope.recent.profile = appConfigSvc.getRecentProfile();    //re-establish the recent profile list
                },
                function(err) {
                    alert("error retrieving resource\n"+angular.toJSON(err))
                }
            )

        };
        
        var config;
        setup();        //will set config value - todo: this seems a bit clumsy...

        $scope.input.selectedTS = config.servers.terminology;
        $scope.consistencyCheck = appConfigSvc.checkConsistency();  //perform the consistelyc check for fhir versions




        //called when the config is reset...
        $rootScope.$on('resetConfigObject',function(event) {
            setup();
        });

        //when the cache of profiles for this browser is reset
        $rootScope.$on('clearProfileCache',function(event){
            $scope.recent.profile = appConfigSvc.getRecentProfile();
            delete $rootScope.currentProject;
        });

        //when the cache of patients for this browser is reset
        $rootScope.$on('clearPatientCache',function(event){
            $scope.recent.patient = appConfigSvc.getRecentPatient();
            delete $rootScope.currentProject;
        });




        //called when the user selects a project from the project menu
        $rootScope.loadProject = function(inx){
            $rootScope.$broadcast('setWaitingFlag',true);

            $rootScope.currentProject = $rootScope.fbProjects[inx];
            delete $rootScope.currentProject.canEdit;       //start out not editing





            appConfigSvc.setProject($rootScope.currentProject).then(
                function(vo) {
                    var profiles = vo.profiles;


                    //set the current servers on the scope - will update the displays as well...
                    $scope.input.conformanceServer = appConfigSvc.getCurrentConformanceServer();
                    $scope.input.dataServer = appConfigSvc.getCurrentDataServer();
                    $scope.recent.profile = profiles;  //set the profiles display


                    $scope.recent.patient = vo.patients;

                    $scope.consistencyCheck = appConfigSvc.checkConsistency();
                    //appConfigSvc.checkConsistency();    //will set the terminology server...

                    $scope.config = $localStorage.config;   //because the terminology server may have changed...
                    $scope.input.selectedTS = $scope.config.servers.terminology;
                    if (! $scope.consistencyCheck.consistent) {
                        $scope.error = 'Warning! These servers are on a different FHIR version. Weird things will happen...';
                    }

                    $rootScope.$broadcast('setWaitingFlag',false);

                }
            )   //set uo for a specific project

            //alert('yes!')
        }

        //close the current project.
        $rootScope.closeProject = function(){
            delete $rootScope.currentProject;
        }

        //when the 'eye' icon is clicked in the list. we want to view the profile in the tree - and potentially edit it
        //the actual profile has been loaded, and is passed into the function
        $scope.showLocalProfile = function(event,profile) {
            //event.cancelBubble();
            event.stopPropagation();        //otherwise the event to select the profile (for the builder) is fired...
            
            //$scope.waiting=true;    //will be disabled by the ontreeredraw from the profile component
            //$scope.showProfileEditPage = true;      //displays the editor page (and hides the front page)

           // $scope.frontPageProfile = null;
           // $scope.frontPageProfile = profile;      //set the profile in the component
            //broadcast an event so that the profile edit controller (logicalModelCtrl) can determine if this is a core profile and can't be edited...


            //$rootScope.$broadcast('showProfileEditor',profile);     //to display the editor

            //$scope.$emit('profileSelected',{profile:profile});
            $rootScope.$broadcast('profileSelected',profile);

            $rootScope.$broadcast('setDisplayMode',{newMode:'profileEditor'});  //display the profie editor page




            $scope.frontPageProfile = profile;


        };





        //removing a profile from the list
        $scope.removeSavedProfile = function(event,inx){
            event.stopPropagation();        //prevent trying to select the profile..
            var profile = $scope.recent.profile[inx]
            appConfigSvc.removeRecentProfile(inx);
            $scope.recent.profile = appConfigSvc.getRecentProfile();
             if ($rootScope.currentProject) {
                appConfigSvc.removeProfileFromProject(profile,$rootScope.currentProject,$rootScope.fbProjects)

             }
        };

        //removing a patient from the list
        $scope.removeSavedPatient = function(event,inx){
            event.stopPropagation();        //prevent trying to select the profile..
            var patient = $scope.recent.patient[inx]
            appConfigSvc.removeRecentPatient(inx);
            $scope.recent.patient = appConfigSvc.getRecentPatient();
            if ($rootScope.currentProject) {
                appConfigSvc.removePatientFromProject(patient,$rootScope.currentProject,$rootScope.fbProjects)

            }
        };
/*
        //when the page is closed in the profile editor. Needs to inform the parent page to close the editor...
        $rootScope.$on('closeProfileEditPage',function(){
            $scope.showProfileEditPage = false;
        });

        */


        function setup() {
            config = $localStorage.config;

            config.allKnownServers.forEach(function(svr){

                if (config.servers.data == svr.url) {
                    $scope.input.dataServer = svr;}
                if (config.servers.conformance == svr.url) {$scope.input.conformanceServer = svr}

            });
            $scope.config = config;

        }




        //tests that the server is available by retrieving the conformance resource
        $scope.testServer = function(server,type) {
            //console.log(server,type);
            $scope.message = 'Reading the conformance resource from '+ server.url + ' Please wait...';


            //Display a countdown timer so the user knows something is happenning
            var stop;
            $scope.elapsed= 15;     //this timeout is set in the resourceCreatorSvc.getConformanceResource as well...
            timer = function() {

                if ( angular.isDefined(stop) ) return;      //only have 1 at a time...

                stop = $interval(function() {
                    $scope.elapsed --;
                    //$scope.$apply();
                    //console.log($scope.elapsed);
                    if ($scope.elapsed < 0) {
                        //stopTimer();
                        $interval.cancel(stop);
                    }
                }, 1000);
            };

            timer();        //Start the timer...


            $scope.input['test'+type] = {loading : true};
            
            resourceCreatorSvc.getConformanceResource(server.url).then(
                function(data) {
                    $scope.input['test'+type] = {ok:true}
                },
                function(err) {
                    $scope.input['test'+type] = {fail:true}
                }
            ).then(function(){
                delete $scope.message;
                $interval.cancel(stop);
            });

        };
        
        //when the user selects a different server...
        $scope.selectServer = function(serverType,server) {
            delete $scope.error;
            delete $scope.input.testconformance;        //the test conformance state
            delete $scope.input.testdata;



            config.servers[serverType] = server.url;    //set the config to the new server...
            $localStorage.config = config;
            
            $rootScope.$emit('configUpdated',{serverType:serverType});  //tell the world which server...
            $scope.recent.patient = appConfigSvc.getRecentPatient();
            $scope.recent.profile = appConfigSvc.getRecentProfile();

            //see if profile and data servers are the same version. If so, also return a list of terminology servers... (but the call will set the default
            $scope.consistencyCheck = appConfigSvc.checkConsistency();
            $scope.config = $localStorage.config;   //because the terminology server may have changed...
            $scope.input.selectedTS = $scope.config.servers.terminology;
            if (! $scope.consistencyCheck.consistent) {
                $scope.error = 'Warning! These servers are on a different FHIR version. Weird things will happen...';
            }
        };

        //when the user selects a different terminology server...
        $scope.changeTerminologyServer = function(server) {
            $scope.config.servers.terminology = server.url;
            appConfigSvc.setServerType('terminology',server.url);   //change the terminology server in the local storage...
        };

        //displays the 'select profile' dialog...
        //<select-profile on the resourceCreator page...
        $scope.findProfile = function() {
            $scope.showFindProfileDialog.open();    //note that this is defined in the parent controller...
            //note that the function $scope.selectedProfile in the parent (resourceCreator) controller is invoked on successful selection...
        };

        //when a patient is selected in the list...
        $scope.selectPatient = function(patient) {
            appConfigSvc.setCurrentPatient(patient);
            $rootScope.$emit('patientSelected',patient);
        };

        //when a profile is selected from the 'myProfiles' list (not the dialog) to build a resource from. It returns the profile (StructureDefinition resource)
        $scope.selectProfile = function(profile) {


            var clone = angular.copy(profile);
            $scope.localSelectedProfile = profile;

            resourceCreatorSvc.setCurrentProfile(clone);
            $rootScope.$emit('profileSelected',clone);      //will cause the builder to be set up for the seelcted profile...
            
        };

        //when the user wants to locate an existing patient in the data server
        $scope.findPatient = function(){
            $uibModal.open({
                backdrop: 'static',      //means can't close by clicking on the backdrop. stuffs up the original settings...
                keyboard: false,       //same as above.
                templateUrl: 'modalTemplates/searchForPatient.html',
                //size:'lg',
                controller: function($scope,ResourceUtilsSvc,supportSvc,$q,modalService,appConfigSvc){
                    
                    $scope.input={mode:'find',gender:'male'};   //will be replaced by name randomizer
                    $scope.input.dob = new Date(1982,9,31);     //will be replaced by name randomizer
                    $scope.outcome = {log:[]};

                    $scope.input.createSamples = true;
                    //when the 'Add new patient' is selected...
                    $scope.seletNewPatientOption = function(){
                        $scope.input.mode='new'
                        $scope.waiting = true;
                        supportSvc.getRandomName().then(
                            function(data) {
                                try {


                                    var user = data.data.results[0];
                                    $scope.input.dob = moment(user.dob).format();
                                    $scope.input.fname  = user.name.first.toProperCase();
                                    $scope.input.lname = user.name.last.toProperCase();
                                    $scope.input.gender = user.gender;
                                } catch (ex) {
                                    //in the case of an error - simply use the defaults
                                    console.log('error getting sample name: ',ex)
                                }

                            }
                        ).finally(function(){
                            $scope.waiting = false;
                        });
                    }

                    var addLog = function(display) {
                        $scope.outcome.log.push(display);
                    };

                    $scope.ResourceUtilsSvc = ResourceUtilsSvc;


                    //supportSvc.checkReferenceResources

                    //add - and select - a new patient..
                    //note that Grahames server can't handle multiple concurrent requests - whucg is why theres
                    //a rather ineligant 'pyramid of doom' sync calls....
                    $scope.addNewPatient = function() {
                        $scope.showLog = true;
                        $scope.allowClose = false;
                        $scope.waiting = true;
                        var nameText = $scope.input.fname + " " + $scope.input.lname;
                        addLog('Adding '+nameText);

                        supportSvc.createPatient($scope.input).then(
                            function(patient){
                                var patientId = patient.id;

                                addLog('Added patient with the id : '+ patientId)
                                appConfigSvc.setCurrentPatient(patient);
                                $rootScope.$emit('patientSelected',patient);

                                if ($scope.input.createSamples) {
                                    addLog('Checking that the required reference resources exist');
                                    supportSvc.checkReferenceResources().then (
                                        function() {
                                            addLog('adding Encounters...');
                                            supportSvc.buildConditionList(patientId,{logFn:addLog}).then(
                                                function(bundleConditions) {
                                                    supportSvc.createEncounters(patientId,{},bundleConditions).then(
                                                        function(msg){
                                                            addLog(msg);
                                                               var query = [];




                                                            supportSvc.createObservations(patientId,{logFn:addLog}).then(
                                                                function() {
                                                                    supportSvc.buildMedicationList(patientId,{logFn:addLog}).then(
                                                                        function() {
                                                                            supportSvc.createAppointments(patientId,{logFn:addLog}).then(
                                                                                function() {
                                                                                    supportSvc.buildAllergiesList(patientId,{logFn:addLog}).then(
                                                                                        function () {
                                                                                            $scope.saving = false;
                                                                                            supportSvc.resetResourceReferences();   //remove all the newly created resources from the reference resource list...
                                                                                            // not yet.. $scope.$close();
                                                                                            appConfigSvc.setCurrentPatient(patient);
                                                                                            $rootScope.$emit('patientSelected',patient);
                                                                                            $scope.loading = false;
                                                                                            $scope.allowClose = true;
                                                                                            $scope.allDone = true;
                                                                                        },
                                                                                        function (err) {
                                                                                            //error for allergies...
                                                                                            modalService.showModal({}, {bodyText: "Error saving allergies:"+angular.toJson(err)})
                                                                                            $scope.allowClose = true;

                                                                                        }
                                                                                    )

                                                                                },
                                                                                function(err) {
                                                                                    //error for appointments
                                                                                    modalService.showModal({}, {bodyText: "Error saving appointments:"+angular.toJson(err)})
                                                                                    $scope.allowClose = true;
                                                                                }
                                                                            )

                                                                        },
                                                                        function(err) {
                                                                            //error for meds
                                                                            modalService.showModal({}, {bodyText: "Error saving meds:"+angular.toJson(err)})
                                                                            $scope.allowClose = true;
                                                                        }



                                                                    )


                                                                },function(err) {
                                                                    //error for obs
                                                                    modalService.showModal({}, {bodyText: "Error saving obs:"+angular.toJson(err)})
                                                                    $scope.allowClose = true;

                                                                }
                                                            );



/* - this is an async create - works for hapi,but not Grahame. Maybe a server option?
                                                                addLog('adding Observations...');
                                                                query.push(supportSvc.createObservations(patientId,{logFn:addLog}));


                                                                addLog('adding Appointments...');
                                                                query.push(supportSvc.createAppointments(patientId,{logFn:addLog}));
                                                                addLog('adding Medication List...');
                                                                query.push(supportSvc.buildMedicationList(patientId,{logFn:addLog}));
                                                                addLog('adding Allergy List...');
                                                                query.push(supportSvc.buildAllergiesList(patientId,{logFn:addLog}));

                                                     $q.all(query).then(
                                                     //regardless of success or failure, turn off the saving flag
                                                     function() {
                                                     $scope.saving = false;
                                                     supportSvc.resetResourceReferences();   //remove all the newly created resources from the reference resource list...
                                                     // not yet.. $scope.$close();
                                                     appConfigSvc.setCurrentPatient(patient);
                                                     $rootScope.$emit('patientSelected',patient);
                                                     $scope.loading = false;
                                                     $scope.allowClose = true;
                                                     $scope.allDone = true;


                                                     },
                                                     function(err) {
                                                     alert('error creating sample resources\n'+angular.toJson(err))
                                                     $scope.allowClose = true;
                                                     $scope.loading = false;
                                                     }
                                                     )


*/

        
                                                            },
                                                        function(err){
                                                            alert('error creating Encounters '+ angular.toJson(err));
                                                            $scope.allowClose = true;
                                                        }
                                                    )




                                                },
                                                function(err) {
                                                    alert('error building the condition list ' + angular.toJson(err))
                                                    $scope.allowClose = true;
                                                }
                                            )},
                                        function(err){
                                            //service will display error
                                            alert('error checking reference resources')
                                            $scope.allowClose = true;
                                        }
                                    ).finally(function(){
                                        $scope.waiting = false;
                                    })



                                } else {
                                    //$scope.$close();
                                   // appConfigSvc.setCurrentPatient(patient);
                                    //$rootScope.$emit('patientSelected',patient);
                                    $scope.waiting = false;
                                    $scope.allowClose = true;
                                }

                                
                            },
                            function(err) {
                                var msg = "Unable to create the Patient. This can be caused by a CORS error on the server you're talking to. ";
                                msg += "Here's the error I got: "+angular.toJson(err);
                                modalService.showModal({}, {bodyText: msg})


                                $scope.waiting = false;
                                $scope.allowClose = true;
                            }
                        );


                    };


                    
                    //directly load a patient based on their id
                    $scope.loadPatient = function(id) {
                        var url = appConfigSvc.getCurrentDataServer().url + "Patient/"+id;
                        GetDataFromServer.adHocFHIRQuery(url).then(
                            function(data){
                                var patient = data.data;
                                appConfigSvc.setCurrentPatient(patient);
                                $rootScope.$emit('patientSelected',patient);
                                $scope.$close();
                            },
                            function(err){
                                modalService.showModal({}, {bodyText: 'No patient with that Id found.'})

                            }
                        )
                        
                    };

                    $scope.searchForPatient = function(name) {
                        $scope.nomatch=false;   //if there were no matching patients
                        delete $scope.matchingPatientsList;
                        if (! name) {
                            alert('Please enter a name');
                            return true;
                        }
                        $scope.waiting = true;
                        resourceCreatorSvc.findPatientsByName(name).then(
                            function(data){

                                $scope.matchingPatientsList = data;
                                if (! data || data.length == 0) {
                                    $scope.nomatch=true;
                                }
                            },
                            function(err) {
                                modalService.showModal({}, {bodyText: 'Error finding patient - have you selected the correct Data Server?'})

                            }
                        ).finally(function(){
                            $scope.waiting = false;
                        })
                    };

                    $scope.searchForIdentifier = function(identifier) {
                        $scope.nomatch=false;   //if there were no matching patients
                        delete $scope.matchingPatientsList;
                        if (! identifier) {
                            alert('Please enter an identifier');
                            return true;
                        }
                        $scope.waiting = true;
                        
                        resourceCreatorSvc.findPatientsByIdentifier(identifier).then(
                            function(data){

                                $scope.matchingPatientsList = data;
                                if (! data || data.length == 0) {
                                    $scope.nomatch=true;
                                }
                            },
                            function(err) {
                                modalService.showModal({}, {bodyText: 'Error finding patient - have you selected the correct Data Server?'})

                            }
                        ).finally(function(){
                            $scope.waiting = false;
                        })
                    };

                    $scope.selectNewPatient = function(patient) {
                        appConfigSvc.setCurrentPatient(patient);
                        //$scope.recent.patient = appConfigSvc.getRecentPatient();
                        $rootScope.$emit('patientSelected',patient);
                        $scope.$close();
                    };

                    $scope.cancel = function () {
                        $scope.$close();
                    };

                    $scope.checkIdentifier = function (identifier) {
                        delete $scope.input.identifierError;
                        if (identifier) {
                            var url = appConfigSvc.getCurrentDataServer().url + "Patient?identifier=" +
                                appConfigSvc.config().standardSystem.identifierSystem + "|"+identifier


                            GetDataFromServer.adHocFHIRQuery(url).then(
                                function(data) {

                                    if (data && data.data && data.data.entry && data.data.entry.length > 0) {

                                        $scope.input.identifierError = 'There is already a patient with this identifier'

                                    }
                                }
                            )
                        }




                    }

                },
                resolve : {
                    configDefault: function () {          //the default config
                        return "";

                    }
                }
            })
        }


})
    .controller('queryCtrlDEP',function($scope,$rootScope,$uibModal,$localStorage,appConfigSvc,resourceCreatorSvc,
                                     profileCreatorSvc,GetDataFromServer){

        $scope.config = $localStorage.config;
        $scope.operationsUrl = $scope.config.baseSpecUrl + "operations.html";
        $scope.input = {serverType:'known'};  //serverType allows select from known servers or enter ad-hoc
        $scope.result = {selectedEntry:{}}

        $scope.queryHistory = $localStorage.queryHistory;
        $scope.makeUrl = function(type) {
            return  $scope.config.baseSpecUrl + type;
        }
        
        setDefaultInput();


        $localStorage.queryHistory = $localStorage.queryHistory || [];


        $scope.treeNodeSelected = function(item) {

            delete $scope.edFromTreeNode;
            if (item.node && item.node.data && item.node.data.ed) {
                $scope.edFromTreeNode = item.node.data.ed;
                $scope.$digest();       //the event originated outside of angular...
            }

        };



        //the profile is uri - ie it doesn't point directly to the resource

        $scope.showProfileByUrl = function(uri) {


            delete $scope.selectedProfile;
            //first get the profile from the conformance server

            GetDataFromServer.findConformanceResourceByUri(uri).then(
                function(profile) {
                    //now get the profile
                    $scope.selectedProfile = profile;
                    


                }
            )


        }

        //note that the parameter is a URL - not a URI
        $scope.showProfile = function(url) {

            delete $scope.selectedProfile;
            if (url.substr(0,4) !== 'http') {
                //this is a relative reference. Assume that the profile is on the current conformance server
                url = $scope.config.servers.conformance + url;

            }


            //generate a display of the profile based on it's URL. (points directly to the SD)
            resourceCreatorSvc.getProfileDisplay(url).then(
                function(vo) {
                    $scope.filteredProfile = vo.lst;
                    $scope.selectedProfile = vo.profile;
                },
                function(err){

                }
            );
        };



        //select a server. If 'server' is populated then we've selected a known server. If url is populated then an ad-hoc url has been entered
        $scope.selectServer = function(server,url) {

            if (url) {
                server = {name:'Ad Hoc server',url:url}
            }



            $scope.input.parameters = "";
            delete $scope.filteredProfile;
            delete $scope.response;
            delete $scope.err;
            delete $scope.conformance;
            delete $scope.input.selectedType;

            $scope.server =server;

            $scope.waiting = true;
            resourceCreatorSvc.getConformanceResource($scope.server.url).then(
                function (data) {
                    $scope.conformanceForQuery = data.data;
                    console.log($scope.conformanceForQuery);
                    //analyseConformance(data.data);      //figure out the server capabi

                },function (err) {
                    alert('Error loading conformance resource:'+angular.toJson(err));
                }
            ).finally(function(){
                $scope.waiting = false;
            })



            $scope.buildQuery();        //builds the query from the params on screen

        };

        $scope.typeSelected = function(type) {

            var ar = $scope.conformanceForQuery.rest[0].resource;

            for (var i = 0; i < ar.length ; i++) {
                if (ar[i].type == type) {
                    //this is the definition of the type...
                    var t = ar[i];
                    $scope.queryParam = t.searchParam;
                    console.log($scope.queryParam);




                    break;
                }
            }

            $scope.buildQuery();
        }

        $scope.addParamToQuery = function(param,value) {
            if ($scope.input.parameters) {
                $scope.input.parameters = $scope.input.parameters + '&'
            }
            $scope.input.parameters += param.name + '=' + value;
        }

        $scope.buildQuery = function() {
            delete $scope.anonQuery;
            delete $scope.query;
            var qry = '';//$scope.server.url;

            if ($scope.input.selectedType){
                qry += $scope.input.selectedType;
            }

            if ($scope.input.id) {
                qry += "/"+$scope.input.id;
            }

            if ($scope.input.parameters) {
                qry += "?"+$scope.input.parameters;
            }


            $scope.anonQuery = qry;     //the query, irrespective of the server...
            $scope.query = $scope.server.url + qry;     //the query againts the current server...

        };

        function setDefaultInput() {
            var type = angular.copy($scope.input.selectedType);
           // var server = angular.copy($scope.input.server);
            $scope.input = {serverType:'known'};
            $scope.input.localMode = 'serverquery'
            $scope.input.verb = 'GET';
            $scope.input.category="parameters";
            if (type) {
                $scope.input.selectedType = type;       //remember the type
            }
          //  $scope.input.server =server;
        }
        
        $scope.selectFromHistory = function(hx){
            if ($scope.server) {

                delete $scope.conformance;
                $scope.input.selectedType = hx.type;
                $scope.input.parameters = hx.parameters;
                $scope.input.verb = hx.verb;
                $scope.buildQuery();
            }

        };

        $scope.showConformance = function(){
            delete $scope.filteredProfile;
            if ($scope.server) {
                $scope.waiting = true;
                resourceCreatorSvc.getConformanceResource($scope.server.url).then(
                    function (data) {

                        $scope.conformance = data.data      //setting the conformance variable shows the de
                    },function (err) {
                        alert('Error loading conformance resource:'+angular.toJson(err));
                    }
                ).finally(function(){
                    $scope.waiting = false;
                })
            }
        };

        $scope.removeConformance = function(){
            delete  $scope.conformance;
        };
        
        
        //todo - allow the conformance to be selected - maybe a separate function...
        $scope.loadConformance = function(url) {
            $scope.waiting = true;
            delete $scope.filteredProfile;
            delete $scope.selectedType;
            url = url || "http://fhir.hl7.org.nz/baseDstu2/Conformance/ohConformance";


            resourceCreatorSvc.getConformanceResourceFromUrl(url).then(
                function (data) {

                    $scope.conformance = data.data
                },function (err) {
                    alert('Error loading conformance resource:'+angular.toJson(err));
                }
            ).finally(function(){
                $scope.waiting = false;
            })
        };
        
        $scope.createConformanceQualityReport = function() {
            $scope.waiting = true;
            resourceCreatorSvc.createConformanceQualityReport($scope.conformance).then(
                function(report) {
                    $scope.qualityReport = report;

                    $scope.waiting = false;
                }
            );

        };

        //the handler for when a valueset is selected from within the <show-profile component on conformanceDisplay.html
        $scope.showValueSetForProfile = function(url){
            //url is actually a URI


            GetDataFromServer.getValueSet(url).then(
                function(vs) {

                    $scope.showVSBrowserDialog.open(vs);

                }
            ).finally (function(){
                $scope.showWaiting = false;
            });
        };

        //when the user selects a reference to a profiled resource....
        $scope.showReferencedProfileDEP = function(uri) {


            //retrieve the profile based on its URI and re-set the selected profile

            GetDataFromServer.findConformanceResourceByUri(uri).then(
                function(profile) {

                    $scope.selectedProfile = profile;
                },
                function(err) {
                    console.log(err)
                }
            )

        };

        //when a resource type is selected in the list
        $scope.showType = function(type){
            delete $scope.selectedProfile;
            $scope.selectedType = type;
            
            delete $scope.filteredProfile;

            //note that the reference is a URL - ie a direct reference to the SD - not a URI...
            if (type.profile && type.profile.reference) {
                //there is an issue that the url for the 'base' resources is not resolving - eg
                //http://hl7.org/fhir/profiles/Account *should* be a direft reference to the SD for Account - but it doesn't
                //for the moment we'll do a 'search by url' for these ones...
                var reference = type.profile.reference;
                if (reference.indexOf('http://hl7.org/fhir/')> -1) {
                    //this is needs to be treated as a URI, and we have to change it a bit...
                    reference=reference.replace('profiles','StructureDefinition')       //this seems wrong...
                    reference=reference.replace('Profile','StructureDefinition')

                    localFindProfileByUri(reference)

                } else {
                    //this is a 'real' reference - ie it is a resolvable URL...
                    $scope.showProfile(reference);
                }
            } else {
                //there is no profile - only a 'type' element.
                var type = type.type;       //this is the base resource type
                var uri = 'http://hl7.org/fhir/StructureDefinition/'+type;
                localFindProfileByUri(uri);     //contained function
            }

            function localFindProfileByUri(uri){
                $scope.waiting = true;
                GetDataFromServer.findConformanceResourceByUri(uri).then(
                    function(profile){
                        $scope.selectedProfile = profile;
                        $scope.filteredProfile = profileCreatorSvc.makeProfileDisplayFromProfile(profile)
                    },
                    function(err) {
                        alert(angular.toJson(err))
                    }
                ).finally(function(){
                    $scope.waiting = false;
                })
            }

        };

        $scope.doit = function() {
            $scope.buildQuery();        //always make sure the query is correct;
            delete $scope.response;
            delete $scope.err;
            $scope.waiting = true;
            resourceCreatorSvc.executeQuery('GET',$scope.query).then(
                function(data){

                    $scope.response = data;


                    var hx = {
                        anonQuery:$scope.anonQuery,
                        type:$scope.input.selectedType,
                        parameters:$scope.input.parameters,
                        server : $scope.server,
                        id:$scope.input.id,
                        verb:$scope.input.verb};
                   
                    
                    $scope.queryHistory = resourceCreatorSvc.addToQueryHistory(hx)
                    delete $scope.input.id;
                    delete $scope.input.parameters;
                    
                },
                function(err) {
                    $scope.err = err;

                }
            ).finally(function(){
                $scope.waiting = false;
                setDefaultInput();
            })
        }

        //when the page was invoked, a conformance url was specified so display that...
        //assume the conformance url is on the NZ server...
        $scope.startup = $rootScope.startup;        //put it on the scope so the html page can access i..
        if ($rootScope.startup && $rootScope.startup.conformanceUrl) {
            $scope.input.localMode = 'showconformance';
            $scope.config.servers.conformance = "http://fhir.hl7.org.nz/dstu2/";
            var url = "http://fhir.hl7.org.nz/dstu2/Conformance/" + $rootScope.startup.conformanceUrl;
            $scope.loadConformance(url);
        }


    })
   
    .controller('validateInstanceCtrl', function($scope,appConfigSvc,resourceCreatorSvc){
        $scope.config = appConfigSvc.config();

        $scope.input = {show:'raw',extValue:{}};      //options = raw, results, parsed

        //set the default server in the drop down to the current conformance server
        var url= $scope.config.servers.conformance;
        for (var i=0; i < $scope.config.allKnownServers.length;i++){
            if ($scope.config.allKnownServers[i].url == url){
                $scope.input.server = $scope.config.allKnownServers[i];
                break;
            }
        }
        //

        $scope.checkServerHasDefs = function(){
            //check that all of the ExtensionDefintions in the resource are on the server performing validation...
            $scope.waiting = true;
            resourceCreatorSvc.checkExtensionDefinitionsAreOnServer($scope.input.server.url,$scope.extensions).then(
                function(updatedExt) {

                },function(err){
                    console.log(err)
                }
            ).finally(function(){
                $scope.waiting = false;
            })
        };

        $scope.load = function() {
            //load a resource from a server...
            var url = "http://fhir.hl7.org.nz/dstu2/AllergyIntolerance/84651";
            GetDataFromServer.adHocFHIRQuery(url).then(
                function(data) {
                    $scope.instance = angular.toJson(data.data,true);
                    parse($scope.instance);
                }
            )
        };

        $scope.parse = function () {
            parse($scope.instance);
            $scope.input.show='parse';
        };

        //parse the content to extract extension data
        var parse = function(json) {
            try {
                $scope.resource = angular.fromJson(json);
            } catch (ex){
                alert('This is not valid Json!');
                return;
            }


            $scope.extensions = [];        //this will contain the extensions in this resource...

            function processExtensionArray(ar,path) {
                //process array. If they are extensions then add them to the list and return true.
                //if they are not, then return false and the caller will parse each element...
                //var isExtensionArray = false;
                ar.forEach(function(el){

                    var vo = {};
                    vo.path = path;
                    //the extension will have 2 properties: 'url' and one starting with 'value'
                    angular.forEach(el,function(v,k) {
                        if (k == 'url') {
                            vo.url = v
                        } else {
                            vo.value = v
                        }
                    })


                    $scope.extensions.push(vo);
                });
                //return isExtensionArray;
            }

            function parseBranch(branch,path) {
                angular.forEach(branch,function(v,k){


                    if (angular.isArray(v)){
                        //an array could either be a set of extensions, or a 'multiple' element
                        if (k == 'extension' || k.substr(0,1) == '_') {
                            processExtensionArray(v,path);
                        } else {
                            //this is not an extension array - parse each element...
                            v.forEach(function(el){
                                parseBranch(el,path + '.' + k)
                            })
                        }





                    } else if (angular.isObject(v)){
                        //if it's an object, then check the children as well. This could be a complex datattype or a backbone element

                        parseBranch(v,path + '.' + k)
                    } else {

                    }
                })
            }

            parseBranch($scope.resource,$scope.resource.resourceType);       //kick off the parsing of the resource...

            //now get all the known profiles for this resource type from the currently selected server...
            //todo - chang
            getProfilesForResourceType($scope.resource.resourceType)



        };


        //retrieve all the profiles based on this resource type on the server
        function getProfilesForResourceType(resourceType) {
            $scope.profilesThisType = [];
            var url = $scope.input.server.url + "StructureDefinition?kind=resource&type="+resourceType;
            GetDataFromServer.adHocFHIRQuery(url).then(
                function(data) {

                    if (data.data && data.data.entry) {
                        //this is a bundle
                        data.data.entry.forEach(function(ent){
                            var url = ent.resource.url;     //the 'canonical' url for this profile...
                            $scope.profilesThisType.push(url);
                        })
                    }




                },
                function(err){
                    console.log(err)
                }
            )
        }

        $scope.profile = resourceCreatorSvc.getCurrentProfile();

        $scope.validate = function(){
            delete $scope.validateResults;
            delete $scope.error;

            try {
                var resource = angular.fromJson($scope.instance);
            } catch (ex){
                alert('This is not valid Json!');
                return;
            }

            //if there is a profile selected, then add that to the resource

            if ($scope.input.profile) {
                resource.meta = resource.meta || {}
                resource.meta.profile = [$scope.input.profile] ;
                $scope.instance = angular.toJson(resource,true);
            }

            //"http://fhir.hl7.org.nz/dstu2/StructureDefinition/ohAllergyIntolerance"

            $scope.waiting = true;
            var oo;
            $scope.url = $scope.input.server.url;       //just so we can display the url

            Utilities.validate(resource,$scope.url,$scope.input.profile).then(
                function(data){

                    oo = data.data;
                    if (oo.issue) {
                        delete oo.text;
                        $scope.validateResults = oo;
                    } else {
                        $scope.validateResults = {outcome:'The resource is valid!'};
                    }


                },
                function(data) {



                    if (angular.isString(data.data)){
                        $scope.error = data.data;

                        oo = {issue:['shoeme']}
                    } else {
                        oo = data.data;

                        if (oo.issue) {
                            delete oo.text;
                        }
                    }





                    $scope.validateResults = oo;
                }
            ).finally(function(){
                $scope.input.show='results';
                $scope.waiting = false;
            });

        }

        $scope.close = function () {
            $scope.$close();
        }

})




.filter('shortUrl',function(){
        return function(input) {

            if (input) {
                var ar = input.split('/');
                if (ar.length > 2) {
                    return ar[ar.length-2]+'/'+ar[ar.length-1]
                } else {
                    return input
                }
            } else {
                return input
            }

        }
}
    ).filter('showUrlId',function(){
        //show the id component of a url
        return function(input) {

            if (input) {
                var ar = input.split('/');
                if (ar.length > 2) {
                    return ar[ar.length-1]
                } else {
                    return input
                }
            } else {
                return input
            }

        }
    }
).config([ '$compileProvider',
    //used for the download functionity - http://stackoverflow.com/questions/16342659/directive-to-create-adownload-button for download (bottom of page)
    function($compileProvider) {
        $compileProvider.aHrefSanitizationWhitelist(/^s*(https?|ftp|blob|mailto|chrome-extension):/);
        // pre-Angularv1.2 use urlSanizationWhitelist()
    }])

;
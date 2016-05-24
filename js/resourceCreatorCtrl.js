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
        function ($scope,resourceCreatorSvc,GetDataFromServer,SaveDataToServer,$rootScope,modalService,$translate,$localStorage,
              RenderProfileSvc,appConfigSvc,supportSvc,$uibModal,ResourceUtilsSvc,Utilities,$location,resourceSvc,$window) {

    $scope.doDefault=false;         //whether to have default patient & profile <<<<< for debug only!




    //register that the application has been started... (for reporting)
    resourceCreatorSvc.registerAccess();


    var profile;                    //the profile being used as the base
    var type;                       //base type
    $scope.treeData = [];           //populates the resource tree
    $scope.results = {};            //the variable for resource property values...

    $scope.buildState;              //the current build state of the resource. 'new' = just created, 'dirty' = updated, 'saved' = has been saved

    $scope.outcome = {};

    $scope.displayMode = 'front';    //'new' = resource builder, ''patient = patient
    $scope.selectedPatientResourceType = [];

    $scope.config = appConfigSvc.config();  //the configuraton object - especially the data,terminology & conformance servers...

    //show the server query page
    $scope.showQuery = function(conformanceUrl){
        $scope.displayMode="query";
        $rootScope.startup = {conformanceUrl:conformanceUrl};     //the query controller will automatically download and display this resource
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

            //when the user clicks the 'New Resource' button. They may not have selected a new patient or profile
    $scope.createNewResource = function() {


        //setUpForNewProfile(resourceCreatorSvc.getCurrentProfile());
        $scope.displayMode = 'new';     //display the 'enter new resouce' screen..
    };


    




    //============== event handlers ===================

    //the config (ie server) has been update. We need to abandon the resource being built...
    $rootScope.$on('configUpdated',function(event,data){
        //console.log('new config');
        //when the config (servers) change,then the most recent patient & profiles will do so as well...
        $scope.recent.patient = appConfigSvc.getRecentPatient();
        $scope.recent.profile = appConfigSvc.getRecentProfile();

        console.log(data);
        if (data && data.serverType == 'data') {
            //if the data server changes, we need to remove the current patient..
            appConfigSvc.removeCurrentPatient();
        }

        setUpForNewProfile();       //if there's no profile in the call, then everything will be re-set


    });

    //when a new profile is selected from the front page...
    $rootScope.$on('profileSelected',function(event,profile){
        $scope.dirty=false;     //a new form is loaded
        $scope.parkedHx = false;
        setUpForNewProfile(profile);
    });


    //when a patient is selected from the front page... Want to load the patient details and create a new starter resource for the current profile
    $rootScope.$on('patientSelected',function(event,patient){

        appConfigSvc.addToRecentPatient(patient);
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




    //clears the current resource being buils and re-displays the front screen 
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
                $scope.displayMode = 'front';
            })

        } else {
            $scope.displayMode = 'front';
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
        // var url = 'translate/'+code+'.json';
        // $translateProvider.useUrlLoader(url);
        $translate.use('en')
    }

    //load existing data for the current patient
    function loadPatientDetails(cb) {
        $scope.hasVitals = false;
        delete $scope.vitalsTable;
        supportSvc.getAllData(appConfigSvc.getCurrentPatient().id).then(
            //returns an object hash - type as hash, contents as bundle - eg allResources.Condition = {bundle}
            function (allResources) {
                //the order is significant - allResources must be set first...
                appConfigSvc.setAllResources(allResources);

                //console.log(allResources)

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
                            $scope.allResourcesAsList.push(entry.resource);
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


                })


            }
            )
            .finally(function () {
                $scope.loadingPatient = false;
                if (cb) {
                    cb()
                }
            });
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
        $scope.buildState = "new";

        delete $scope.resource;
        //if there's no profile, the clear everything. This is called when the server is changed...
        if (!profile) {
            drawTree();
            return;
        }

        resourceCreatorSvc.setCurrentProfile(profile);  //save the profile in the service (rather than in the controller)
        $scope.results.profileUrl = profile.url;

        //now set the base type. If a Core profile then it will be the profile name. Otherwise, it is the constarinedType
        //changed in STU-3 !
        var baseType;
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




        /*
                //create the root node.
                var rootEd = resourceCreatorSvc.getRootED(type);
                $scope.treeData.push({id:'root',parent:'#',text:type,state:{opened:true,selected:true},path:type,
                    ed:rootEd});
        */
        if (! treeViewData) {
            navigatorNodeSelected('root', rootEd);   //this will display the child nodes of the root

            //used for the initial display
            $scope.selectedNode = getNodeFromId('root');
        }

/*
        //add the current patient
        var ed = resourceCreatorSvc.getPatientOrSubjectReferenceED();
        if (ed) {
            resourceCreatorSvc.addPatientToTree(ed.path,appConfigSvc.getCurrentPatient(),$scope.treeData);
        }
*/


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
        var treeObject = $('#treeView').jstree().get_json();    //creates a hierarchical view of the resource

        var config = {};
        config.profile = $scope.conformProfiles;

        //builds the resource. Parameters base type, hierarchical tree view, raw tree data, other config stuff
        //todo note that it should be possible to generate the hierarchical view without depending on tree view which will tidy things up a bit
        $scope.resource = resourceCreatorSvc.buildResource(type,treeObject[0],$scope.treeData,config)
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

                    if (oo.issue) {
                        delete oo.text;
                    }
                    $scope.validateResults = oo;
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
    var navigatorNodeSelected = function(nodeId,ed){
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

        $scope.selectedChild = ed;



        //the datatype of the selected element. This will display the data entry form.
        $scope.dataType = ed.type[inx].code;
        
        if ($scope.dataType == 'Reference') {
            //this is a reference to another resource. We need to get the exact type that was selected...
            //this is used in the next code segment to retrieve the matching existing resources
            var type = ed.type[inx];
            if (type.profile)  {
                var ar = type.profile[0].split('/');
                $scope.resourceType = ar[ar.length-1];         //the type name (eg 'Practitioner')
                $scope.resourceProfile = type.profile[0];       //the profilefor this type. todo - could really lose $scope.resourceType...
            } else {
                //if there's no profile, then the reference can be to any profile...
                $scope.resourceType = 'Resource';
                $scope.resourceProfile = 'Resource';
            }

            //console.log($scope.resourceType);

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
                console.log(item)
                $scope.results.resourceItem = item;
            }
        )


    };

    //when a new element has been populated. The 'find reference resource' function creates the fragment - the others don't
    $scope.saveNewDataType = function(fragment) {
        fragment = fragment || resourceCreatorSvc.getJsonFragmentForDataType($scope.dataType,$scope.results);
       
        //now add the new property to the tree...

        if (fragment) {
            
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


            // $scope.selectedNode = treeNode;     //todo !!!!! may not be correct - may need to use getNodeFromId(treeNode.id);

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

        //so go through  the data. if an item has any antry in arDelete as a parent, then add it to the list
        //not sure if there's an issue with ordering...

        var foundElementToDelete = true

        while (foundElementToDelete) {
            console.log('pass')
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



        console.log(arDelete)

        //now create a new array with all the non-deleted elements...
        var newTreeArray = [];
        for (var i=0; i<$scope.treeData.length;i++) {
            var element = $scope.treeData[i];
            if (arDelete.indexOf(element.id) ==- 1) {
                newTreeArray.push(element);
            }
        }
        console.log(newTreeArray)

        $scope.treeData = newTreeArray;
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
            $scope.waiting = true;
            return GetDataFromServer.getFilteredValueSet(vs,text).then(
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
                    var msg = vo.error;


                    alert(msg);

                    return [
                        {'display': ""}
                    ];
                }
            ).finally(function(){
                $scope.waiting = false;
            });

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

        $scope.results.ccDirectSystem = item.system;
        $scope.results.ccDirectCode = item.code;
        //console.log($scope.results.cc)
        $scope.results.ccDirectDisplay = $scope.results.cc.display;
        

        resourceCreatorSvc.getLookupForCode(item.system,item.code).then(
            function(data) {
                console.log(data);
                $scope.terminologyLookup = resourceCreatorSvc.parseCodeLookupResponse(data.data)
                console.log($scope.terminologyLookup);
            },
            function(err) {
                //this will generally occur when using stu-2 - so ignore...
                //alert(angular.toJson(err));
            }
        );

//console.log(item,model,label)
    };

    function setTerminologyLookup(system,code) {
        resourceCreatorSvc.getLookupForCode(system,code).then(
            function(data) {
                console.log(data);
                $scope.terminologyLookup = resourceCreatorSvc.parseCodeLookupResponse(data.data)
                console.log($scope.terminologyLookup);
            },
            function(err) {
                alert(angular.toJson(err));
            }
        );
    }

    $scope.selectChildTerm = function(code,description){
        $scope.results.ccDirectDisplay = description;
        $scope.results.ccDirectCode = code;
        setTerminologyLookup($scope.results.ccDirectSystem,code)
    }

    //the user selects the parent...
    $scope.selectParentCC = function() {
        $scope.results.ccDirectDisplay = $scope.terminologyLookup.parent.description;
        $scope.results.ccDirectCode = $scope.terminologyLookup.parent.value;
        //look up the relations to this one...
        setTerminologyLookup($scope.results.ccDirectSystem,$scope.results.ccDirectCode)


        //$scope.results.cc = $scope.terminologyLookup.parent;
        //console.log('s')
    };

    //use the terminology operation CodeSystem/$lookup to get details of the code / system when manually entered
    $scope.lookupCode = function(system,code) {


        resourceCreatorSvc.getLookupForCode(system,code).then(
            function(data) {
                //console.log(data);

                $scope.terminologyLookup = resourceCreatorSvc.parseCodeLookupResponse(data.data)
                $scope.results.ccDirectDisplay = $scope.terminologyLookup.display;

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

        //resourceCreatorSvc.setCurrentProfile(park.profile);


        var modalOptions = {
            closeButtonText: "Don't remove",
            actionButtonText: 'Ok',
            headerText: 'UnPark resource',
            bodyText: 'Do you want to remove the resource from the parked list'
        };

        modalService.showModal({}, modalOptions).then(function (result) {
            resourceCreatorSvc.removeParkedResource(inx)
        });



        //drawTree();
        $scope.displayMode = 'new';     //will cause the editing page to be displayed

    };

    $scope.parkAndBuildDEP = function() {

        var ed = $scope.selectedChild;  //the ED describing the current element
        if (ed && ed.type && ed.type[0].profile) {
            var profileName =ed.type[0].profile[0];
            alert(profileUrl)
        }
    };

    //perform the actual save operation
    var saveResourceToServer = function() {
        var modalInstance = $uibModal.open({
            templateUrl: 'modalTemplates/confirmNewResource.html',
            size:'lg',
            controller: function($scope,resource,showWaiting) {
                $scope.showWaiting = showWaiting;
                $scope.resource = resource;
                $scope.outcome="";       //not saved yet...
                $scope.saveState="before";
                $scope.input ={};

                $scope.showWaiting = true;
                $scope.saveResource = function() {
                    $scope.saving = true;
                    SaveDataToServer.saveResource($scope.resource).then(
                        function(data) {
                            //save successful...

                            $scope.saveState='success';
                            $scope.saving = false;
                            $scope.outcome = "Resource saved with the ID:";


                            //determine the id of the resource assigned by the server
                            var serverId;
                            serverId = data.headers('Content-Location');
                            if (! serverId) {
                                serverId = data.headers('Location');
                            }

                            $scope.outcome += serverId;

                        },
                        function(oo) {


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
                    $scope.$close();
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
                }
            }
        }).result.then(function(){
            $scope.buildState = 'saved';    //todo should really check for save erors
                $rootScope.$emit("reloadPatient")
            });
        };


    //=========== selecting a new profile ============

    $scope.showFindProfileDialog = {};


    //when a profile is selected...  This is configured in the directive...  Now called from the front page
    $scope.selectedProfileFromDialog = function(profile) {


        //console.log(clone)

        resourceCreatorSvc.setCurrentProfile(profile);

        $scope.dirty=false;     //a new form is loaded
        $scope.parkedHx = false;
        //create aclone to store in the history, as we'll hack the profile as part of the builder (ehgwhen finding child nodes)
        var clone = angular.copy(profile);
        appConfigSvc.addToRecentProfile(clone);

        $scope.recent.profile = appConfigSvc.getRecentProfile();    //re-establish the recent profile list
        setUpForNewProfile(profile);

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


    //when an individual resource has been selected...
    $scope.resourceSelected = function(entry) {
        var resource = entry.resource;
        $scope.outcome.selectedResource = resource;     //for the json display
        $scope.resourceReferences = resourceSvc.getReference(resource,$scope.allResourcesAsList,$scope.allResourcesAsDict);
        
        $scope.downloadLinkJsonContent = window.URL.createObjectURL(new Blob([angular.toJson(resource,true)], {type: "text/text"}));
        $scope.downloadLinkJsonName = resource.resourceType+"-"+resource.id;

        GetDataFromServer.getXmlResource(resource.resourceType+"/"+resource.id+"?_format=xml").then(
            function(data){
                $scope.xmlResource = data.data;
                $scope.downloadLinkXmlContent = window.URL.createObjectURL(new Blob([data.data], {type: "text/xml"}));
                $scope.downloadLinkXmlName = resource.resourceType+"-"+resource.id+".xml";

            },
            function(err) {
                alert(angular.toJson(err,true))
            }
        )



    };
/*
    //when the user selects the 'view XML' option
    $scope.xmlSelected = function(type,id) {
        console.log(type,id)

        GetDataFromServer.getXmlResource(type+"/"+id+"?_format=xml").then(
            function(data){
                $scope.xmlResource = data.data;
                $scope.downloadLinkXmlContent = window.URL.createObjectURL(new Blob([data.data], {type: "text/xml"}));
                $scope.downloadLinkXmlName = type+"-"+id+".xml";
            },
            function(err) {
                alert(angular.toJson(err,true))
            }
        )
    };
            */

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


            constrollerDEP: 'validateInstanceCtrl',

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
                    console.log(profile);
                    $scope.valueSets = [];

                    if (profile && profile.snapshot && profile.snapshot.element) {
                        profile.snapshot.element.forEach(function(el){
                           // console.log(el)
                            if (el.binding) {
                               console.log(el)
                                $scope.valueSets.push(el)
                            }

                        })
                    }

                }

                //copy the profile from one server to another
                $scope.copyProfile = function(targetServer, profile) {

                    console.log(targetServer, profile.url)
                    var sourceServer = $scope.input.server;

                    resourceCreatorSvc.copyConformanceResource(profile.url,sourceServer.url,targetServer.url).then(
                        function(msg){
                            $scope.copyOutcome = msg
                            console.log(msg)
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
                            console.log(updatedExt)
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
                            console.log(updatedExt)
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
                    GetDataFromServer.ahHocFHIRQuery(url).then(
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
                    console.log($scope.resource);

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
                            //console.log(k,v);

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
                    GetDataFromServer.ahHocFHIRQuery(url).then(
                        function(data) {
                            console.log(data)
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
                    //console.log($scope.input.server);
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
                        /*
                    var url = $scope.config.servers.conformance+ "AllergyIntolerance/$validate?profile="+$scope.profile.url;
                    console.log(url);
                    //console.log($scope.instance)
                    var config = {};



                    config.headers = {'Content-type':'application/json+fhir'}
                    $http.post(url,$scope.instance,config).then(
                        function(data) {
                            console.log(data);
                        },
                        function(err){
                            console.log(err)
                        }
                    )

*/
                }

                $scope.close = function () {
                    $scope.$close();
                }

            }

        })



    }
            

})

    .controller('configCtrl',function($scope,$rootScope,configDefault,$localStorage){

        //if there's no config in the browser local storage then use the default
        var config = $localStorage.config;
        if (! config) {
            config = configDefault;
        }


        $scope.config = config;
        //console.log(config);
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
                                     $translate,$interval,GetDataFromServer){


        $scope.showHelp = true;
        if ($localStorage.dontNeedHelp) {
            $scope.showHelp = false;
        }


        $scope.closeHelp = function(){
            $scope.showHelp = false;
            $localStorage.dontNeedHelp = true;
            
        }

        $scope.input = {};
        $scope.input.showingLocalProfile = false;   //true when the currently selected profile is viewed...
        //when a new resource has been uploaded. Add to the list and select...
        $scope.resourceUploaded = function(url) {
            //alert(url);

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
        });

        //when the cache of patients for this browser is reset
        $rootScope.$on('clearPatientCache',function(event){
            $scope.recent.patient = appConfigSvc.getRecentPatient();
        });

        //when we want to view the profile in the tree - and potentially edit it
        $scope.showLocalProfile = function(event,profile) {

            $scope.showProfileEditPage = true;      //displays the editor page (and hides the front page)

            $scope.frontPageProfile = null;
            $scope.frontPageProfile = profile;      //set the profile in the component
            //broadcast an event so that the profile edit controller can determine if this is a core profile and can't be edited...
            $scope.$broadcast('profileSelected',{profile:profile});

            //perform the setup for the new profile...
            $rootScope.$broadcast('newProfileChosen');


        };


        //when the page is closed in the profile editor. Needs to inform the parent page to close the editor...
        $rootScope.$on('closeProfileEditPage',function(){
            $scope.showProfileEditPage = false;
        });



        function setup() {
            config = $localStorage.config;

            config.allKnownServers.forEach(function(svr){
                //console.log(svr)
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
            $scope.elapsed= 10;     //this timeout is set in the resourceCreatorSvc.getConformanceResource as well...
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

            console.log(server);

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
        };

        //displays the 'select profile' dialog...
        //<select-profile on the resourceCreator page...
        $scope.findProfile = function() {
            $scope.showFindProfileDialog.open();    //note that this is defined in the parent controller...
            //note that the function $scope.selectedProfile in the parnt controller is invoked on successful selection...
        };

        //when a profile is selected in the list...
        $scope.selectPatient = function(patient) {
            appConfigSvc.setCurrentPatient(patient);
            $rootScope.$emit('patientSelected',patient);
        };

        //when a profile is selected in the list to build a resource from. It returns the profile (StructureDefinition resource)
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
                size:'lg',
                controllerX : 'patientCtrl',
                controller: function($scope,ResourceUtilsSvc,supportSvc,$q){
                    
                    $scope.input={mode:'find',gender:'male'};   //will be replaced by name randomizer
                    $scope.input.dob = new Date(1982,9,31);     //will be replaced by name randomizer
                    $scope.outcome = {log:[]};

                    $scope.input.createSamples = true;
                    //when the 'Add new patient' is selected...
                    $scope.seletNewPatientOption = function(){
                        $scope.input.mode='new'
                        supportSvc.getRandomName().then(
                            function(data) {
                                try {
                                    console.log(data)

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
                        );
                    }

                    var addLog = function(display) {
                        $scope.outcome.log.push(display);
                    };

                    $scope.ResourceUtilsSvc = ResourceUtilsSvc;


                    //supportSvc.checkReferenceResources

                    //add - and select - a new patient..
                    $scope.addNewPatient = function() {
                        $scope.showLog = true;
                        $scope.allowClose = false;
                        $scope.waiting = true;
                        var nameText = $scope.input.fname + " " + $scope.input.lname;
                        addLog('Adding '+nameText);
                        supportSvc.createPatient($scope.input).then(
                            function(patient){
                                var patientId = patient.id;
                                console.log(patient)
                                addLog('Added patient with the id : '+ patientId)
                                appConfigSvc.setCurrentPatient(patient);
                                $rootScope.$emit('patientSelected',patient);

                                if ($scope.input.createSamples) {
                                    addLog('Checking that the required reference resources exist');
                                    supportSvc.checkReferenceResources().then(
                                        function() {
                                            addLog('adding Encounters...');
                                            supportSvc.createEncounters(patientId).then(
                                                function(msg) {
                                                    addLog(msg);
                                                   var query = [];
                                                    addLog('adding Conditions...');
                                                    query.push(supportSvc.createConditions(patientId,{logFn:addLog}));
                                                    addLog('adding Observations...');
                                                    query.push(supportSvc.createObservations(patientId,{logFn:addLog}));
                                                    addLog('adding Appointments...');
                                                    query.push(supportSvc.createAppointments(patientId,{logFn:addLog}));

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
                                                        },
                                                        function(err) {
                                                            alert('error creating sample resources\n'+angular.toJson(err))
                                                            $scope.allowClose = true;
                                                            $scope.loading = false;
                                                        }

                                                    )
                                                },
                                                function(err) {
                                                    alert(angular.toJson(err))
                                                    $scope.allowClose = true;
                                                }
                                            )},
                                        function(err){
                                            //service will display error
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
                                alert('error saving patient\n'+angular.toJson(err))
                                $scope.waiting = false;
                                $scope.allowClose = true;
                            }
                        );


                    }

                    $scope.searchForPatient = function(name) {
                        $scope.nomatch=false;   //if there were no matching patients
                        delete $scope.matchingPatientsBundle;
                        if (! name) {
                            alert('Please enter a name');
                            return true;
                        }
                        $scope.waiting = true;
                        resourceCreatorSvc.findPatientsByName(name).then(
                            function(data){
                                // ResourceUtilsSvc.getOneLineSummaryOfResource(patient);
                                $scope.matchingPatientsBundle = data.data;
                                if (! data.data.entry || data.data.entry.length == 0) {
                                    $scope.nomatch=true;
                                }


                            },
                            function(err) {
                                alert('Error finding patient: '+angular.toJson(err))
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
    .controller('queryCtrl',function($scope,$rootScope,$uibModal,$localStorage,appConfigSvc,resourceCreatorSvc,
                                     profileCreatorSvc,GetDataFromServer){
        
        $scope.config = $localStorage.config;
        $scope.operationsUrl = $scope.config.baseSpecUrl + "operations.html";
        $scope.input = {};

        $scope.queryHistory = $localStorage.queryHistory;
        $scope.makeUrl = function(type) {
            return  $scope.config.baseSpecUrl + type;
        }
        
        setDefaultInput();
       // $scope.input.server = config.allKnownServers[0]


        $localStorage.queryHistory = $localStorage.queryHistory || [];


        $scope.treeNodeSelected = function(item) {
            //console.log(item);
            delete $scope.edFromTreeNode;
            if (item.node && item.node.data && item.node.data.ed) {
                $scope.edFromTreeNode = item.node.data.ed;
                $scope.$digest();       //the event originated outside of angular...
            }

        };

        //replaced by showValueSetForProfile below...
        $scope.showValueSetDEP = function (vsUrl) {
            

            GetDataFromServer.getValueSet(vsUrl).then(
                function(vs) {

                    $scope.showVSBrowserDialog.open(vs);

                }
            ).finally (function(){
                $scope.showWaiting = false;
            });


        };



        //the profile is uri - ie it doesn't point directly to the resource

        $scope.showProfileByUrl = function(uri) {

            //console.log($scope.config)
            delete $scope.selectedProfile;
            //first get the profile from the conformance server

            GetDataFromServer.findConformanceResourceByUri(uri).then(
                function(profile) {
                    //now get the profile
                    $scope.selectedProfile = profile;

                    //var vo = resourceCreatorSvc.makeProfileDisplayFromProfile(profile);

                           // $scope.filteredProfile = vo.tab;
                            //$scope.selectedProfile = vo.profile;


                }
            )


        }

        //note that the parameter is a URL - not a URI
        $scope.showProfile = function(url) {
            //console.log($scope.config)
            delete $scope.selectedProfile;
            if (url.substr(0,4) !== 'http') {
                //this is a relative reference. Assume that the profile is on the current conformance server
                url = $scope.config.servers.conformance + url;

            }

console.log(url);
            //generate a display of the profile based on it's URL. (points directly to the SD)
            resourceCreatorSvc.getProfileDisplay(url).then(
                function(vo) {
                    $scope.filteredProfile = vo.lst;
                    $scope.selectedProfile = vo.profile;
                },
                function(err){

                }
            );
            
            /*


            //todo some profiles seem to have a url like http://hl7.org/fhir/profiles/MedicationDispense
            uri = uri.replace('/profiles/','/StructureDefinition/');

            console.log(uri)

            var url = GetDataFromServer.findConformanceResourceByUri(uri).then(
                function(profile) {
                    console.log(profile);
                    var arDisabled = [];          //this is a list of disabled items...
                    var lst = [];           //this will be a list of elements in the profile to show.
                    var elementsToDisable= ['id','meta','implicitRules','language','text','contained'];
                    var dataTypes = ['CodeableConcept','Identifier','Period','Quantity','Reference'];
                    profile.snapshot.element.forEach(function (item) {
                        item.myMeta = {};

                        var el = {path:item.path};
                        var path = item.path;

                        //if max is 0, this path - and all children - are disabled in this profile...
                        if (item.max == 0) {arDisabled.push(path)};



                        //now see if this path has been disabled. There will be more elegant ways of doing this
                        var disabled = false;
                        for (var i=0; i< arDisabled.length; i++) {
                            var d = arDisabled[i];
                            if (path.substr(0,d.length) == d) {
                                disabled = true;
                                break;
                            }
                        }

                        var ar = path.split('.');
                        if (ar.length == 1) { disabled = true;}      //don't include the domain resource

                        //standard element names like 'text' or 'language'
                        if (ar.length == 2 && elementsToDisable.indexOf(ar[1]) > -1) { disabled = true;}



                        //hide the extension. Will need to figure out how to display 'real' extensions
                        if (ar[ar.length-1]=='modifierExtension'){ disabled = true;}
                        if (!disabled && ar[ar.length-1]=='extension'){
                            disabled = true;    //by default extensions are disabled...
                            //if the extension has a profile type then include it, otherwise not...
                            if (item.type) {
                                item.type.forEach(function(it) {
                                    if (it.code == 'Extension' && it.profile) {
                                        disabled=false;
                                        //load the extension definition to



                                    }
                                })
                            }


                        }

                        ar.shift();     //removes the type name

                        item.myMeta.path = ar.join('. ');     //create a path that doesn't include the type (so is shorter)


                        //make references look nicer. todo - what about references to profiles?
                        if (item.type) {
                            item.type.forEach(function(it){
                                if (it.code == 'Reference') {
                                    if (it.profile) {
                                        var p = it.profile[0];      //todo  <<<<<<<<<<<<<<<<<<
                                        var ar = p.split('/');
                                        it.code = '->'+ar[ar.length-1];
                                    }
                                }
                            })

                        }


                        if (! disabled) {
                            lst.push(item);
                        }


                        //if the type is a recognized datatype, then hide all child nodes todo - won't show profiled datatyoes
                        //note that this check is after it has been added to the list...
                        if (item.type) {
                            item.type.forEach(function(type){
                                if (dataTypes.indexOf(type.code) > -1){
                                    arDisabled.push(path)
                                }
                            });
                        }



                    });
                    
                    

                    
                    //console.log(arDisabled)
                    $scope.filteredProfile = lst;
                    $scope.selectedProfile = profile;
                },
                function (err) {
                    alert(angular.toJson(err));
                }
            );      //the url of the profile (SD) on the conformance server

*/
        };

        $scope.selectServer = function(server) {
            $scope.input.parameters = "";
            delete $scope.filteredProfile
            delete $scope.response;
            delete $scope.err;
            delete $scope.conformance;

            
            delete $scope.input.selectedType;

            $scope.server =server;
            $scope.buildQuery();
                //console.log(server);
        };

        $scope.buildQuery = function() {

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
            var server = angular.copy($scope.input.server);
            $scope.input = {};
            $scope.input.localMode = 'serverquery'
            //$scope.input.localMode = 'showconformance'
            $scope.input.verb = 'GET';
            $scope.input.category="parameters";
            //$scope.input.loadConformanceId= "ohConformance";
            if (type) {
                $scope.input.selectedType = type;       //remember the type
            }
            $scope.input.server =server;
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
                        //console.log(data.data)
                        $scope.conformance = data.data
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
                    //console.log(data.data)
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
                    //console.log(report)
                    $scope.waiting = false;
                }
            );

        };

        //the handler for when a valueset is selected from within the <show-profile component on conformanceDisplay.html
        $scope.showValueSetForProfile = function(url){
            //url is actually a URI
            //console.log(url);

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
        //    console.log(uri);
            GetDataFromServer.findConformanceResourceByUri(uri).then(
                function(profile) {
                    //console.log(profile)
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
            //console.log(type)
            //note that the reference is a URL - ie a direct reference to the SD - not a URI...
            if (type.profile && type.profile.reference) {
                //there is an issue that the url for the 'base' resources is not resolving - eg
                //http://hl7.org/fhir/profiles/Account *should* be a direft reference to the SD for Account - but it doesn't
                //for the moment we'll do a 'search by url' for these ones...
                var reference = type.profile.reference;
                if (reference.indexOf('http://hl7.org/fhir/')> -1) {
                    //this is needs to be treated as a URI, and we have to change it a bit...
                    reference=reference.replace('profiles','StructureDefinition')

//console.log(reference);
                    localFindProfileByUri(reference)
                    /*
                    GetDataFromServer.findConformanceResourceByUri(reference).then(
                        function(profile){
                            $scope.selectedProfile = profile;
                            $scope.filteredProfile = resourceCreatorSvc.makeProfileDisplayFromProfile(profile)
                        },
                        function(err) {
                            alert(angular.toJson(err))
                        }
                    )
                    */
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
            delete $scope.response;
            delete $scope.err;
            $scope.waiting = true;
            resourceCreatorSvc.executeQuery('GET',$scope.query).then(
                function(data){
                   // console.log(data);
                    $scope.response = data;


                    var hx = {
                        anonQuery:$scope.anonQuery,
                        type:$scope.input.selectedType,
                        parameters:$scope.input.parameters,
                        server : $scope.server,
                        id:$scope.input.id,
                        verb:$scope.input.verb};
                   
                    
                    $scope.queryHistory = resourceCreatorSvc.addToQueryHistory(hx)

                    
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
    .controller('logicalModelCtrl',function($scope,$rootScope,profileCreatorSvc,resourceCreatorSvc,GetDataFromServer,appConfigSvc,modalService){


        $scope.dataTypes = resourceCreatorSvc.getDataTypesForProfileCreator();      //all the known data types


        //when a new name is entered into the name box. 
        $scope.checkExistingProfile = function(name) {

            resourceCreatorSvc.getProfileFromConformanceServerById(name).then(
                function(data) {
                    //oops, the file exists
                    alert('The profile already exists and will be replaced if the name is not chosen.')
                    $scope.mode='new';      //as this is effectvely a new profile
                },
                function(err){
                    //the resource does not exist - all ok. todo - should check for 404 really
                }
            )
        };

        //when a new profile is chosen from the for viewing and/or editing
        function setUpDisplayNewProfile() {
            $scope.logOfChanges = [];
            $scope.input = {dirty:false};
            $scope.mode = 'view';       //can view or edit profiles
            $scope.input.newDatatype = $scope.dataTypes[0];
            $scope.input.multiplicity = 'opt';
            if ($scope.model){
                $scope.selectedNode = model[0];
            }
            $scope.currentNodeIsParent = true;
            //

            console.log('setup')
        }
        setUpDisplayNewProfile();

        $rootScope.$on('newProfileChosen',function() {
            setUpDisplayNewProfile()

        })

        //$scope.editText = 'Edit';       //will change the text when a core profile...
        //when there is a non-core profile - allow it to be edited...
        $scope.startEdit = function() {
            $scope.mode = 'edit';           //edit (current), new, view
            $scope.input.profileName = $scope.frontPageProfile.name  //maintained by frontCtrl
        };

        //allows the user to view the contents of a valueSet. Note that the '$scope.showVSBrowserDialog.open' call is
        //actually implemented in the 'resourceCreatorCtrl' controller - it's the parent of this one...
        $scope.showValueSetForProfile = function(url) {

            $scope.showWaiting = true;
            GetDataFromServer.getValueSet(url).then(
                function(vs) {

                    $scope.showVSBrowserDialog.open(vs);

                }
            ).finally (function(){
                $scope.showWaiting = false;
            });
        };

        //when a profile is selected, check if it is a core type
        $scope.$on('profileSelected',function(event,data){
            $scope.logOfChanges = [];
            $scope.allowEdit = true;    //the profile being viewed can be altered
            var selectedProfile = data.profile;
            //is this a core profile? If it is, it cannot be edited.
            console.log(selectedProfile);
            var base = selectedProfile.base || selectedProfile.baseType;        //different in stu 2 & 3
            if (base && base.indexOf('Resource') > -1) {    //was 'DomainResource
                //yes, this is a base resource.
                $scope.allowEdit = false;
                
            }
        });

        //set all the values for a new node to default...
        function resetInput() {
            $scope.input.multiplicity = 'opt';
            delete $scope.input.newElementPath;
            delete $scope.input.definition;
            delete $scope.input.newNode
            $scope.input.newDatatype =$scope.dataTypes[0];
        }
        resetInput();       //initial setting...

        //when the editor is closed. todo mightwant to check for dirty...
        $scope.close = function(){

            //if the resource has been edited, then confirm the cancel...
            if ($scope.logOfChanges.length > 0) {
                var modalOptions = {
                    closeButtonText: 'No, stay here',
                    actionButtonText: 'Yes, Abandon changes',
                    headerText: 'Abandon profile',
                    bodyText: 'Are you sure you want to abandon the changes you are making to this Profile?'
                };

                modalService.showModal({}, modalOptions).then(function (result) {
                    //delete $scope.showProfileEditPage;
                    closeTheProfileEditor();

                  /*  delete $scope.model;
                    delete $scope.selectedNode;
                    delete $scope.edFromTreeNode;
                    $rootScope.$emit('closeProfileEditPage');*/
                })

            } else {
                //delete $scope.showProfileEditPage;
                closeTheProfileEditor();
                /*delete $scope.model;
                delete $scope.selectedNode;
                delete $scope.edFromTreeNode;
                $rootScope.$emit('closeProfileEditPage');*/
            }
        };

        //function to clear all the variables relating to the current profile and close the page
        function closeTheProfileEditor() {
            delete $scope.model;
            delete $scope.selectedNode;
            delete $scope.edFromTreeNode;
            $rootScope.$emit('closeProfileEditPage');
        }

        //when the tree is re-drawn. model is the array of tree nodes.
        $scope.onTreeDraw = function(item) {
            //console.log(item);
            $scope.model = item;
        };


        //remove the current node (and all child nodes)
        $scope.removeNode = function(){
            if ($scope.selectedNode.parent == '#' ) {
                alert("You can't delete the root node!")
                return;
            }
            var ed = $scope.selectedNode.data.ed; //the ExtensionDefinition we want to remove
            var path = ed.path;     //the path of the element to be removed...


           // $scope.deleteAtPath(path);     //is a component property - will cause the element and all children to be removed...
            $scope.deleteAtPath = path;     //is a component property - will cause the element and all children to be removed...


            //now move through the model, marking the ED's that start with this path to be removed
            //ed.myMeta.remove = true;

            $scope.logOfChanges.push({type:'D',display:'Removed '+ path,path:path,ed:ed})


            delete $scope.input.newNode;    //indicates whether a child or a sibling - will hide the new entry

            delete $scope.edFromTreeNode;
            delete $scope.selectedNode;

        };

        //$scope.editProfile = function
       
        //restore a deleted element
        $scope.restore = function(ed,inx){
            $scope.restoreRemoved = ed;     //this is a property on the component...
            $scope.logOfChanges.splice(inx,1)
            
        };

        //remove a new node that was added...
        $scope.removeNewNode = function(ed,inx) {
            $scope.deleteAtPath = ed;            //this is a property on the component...
            $scope.logOfChanges.splice(inx,1)
        };

        //save the new resource
        $scope.save = function() {
            var name = $scope.input.profileName;

            //var name='ct-1';

            if (! name) {
                alert('Please enter a name')
                return;
            }
            
            //pass in the name of the profile, the model (with all the data), the profile that is being altered
            //and whether this is a new profile, or updating an existing
            var isEdit = false;
            if ($scope.mode == 'edit') {isEdit = true;}
            resourceCreatorSvc.saveNewProfile(name,$scope.model,$scope.frontPageProfile,isEdit).then(
                function(vo) {
                    alert(angular.toJson(vo.log))
                    //now add to the list of profiles...
                    console.log(vo)
                    var clone = angular.copy(vo.profile);
                    appConfigSvc.addToRecentProfile(clone);
                    //resourceCreatorSvc.setCurrentProfile(clone);
                    $scope.recent.profile = appConfigSvc.getRecentProfile();    //re-establish the recent profile list
                    closeTheProfileEditor();    //close the editor and re-display the front page

                },
                function(log) {
                    alert(angular.toJson(log))
                }
            );
        };

        $scope.addNewNode = function(type) {
            //add a new child node to the current one
            console.log(type);
            var newPath,parentId,ed;
            var edParent = $scope.selectedNode.data.ed;       //the elementDefinition of the parent
            if (type == 'child') {
                newPath = edParent.path + '.' + $scope.input.newElementPath;     //the full path of the new child node
                parentId = edParent.path;
            } else {
                parentId = $scope.selectedNode.parent;
                if (parentId == '#') {
                    alert("Can't add a sibling to the parent");
                    return;
                }
                newPath = parentId + '.' + $scope.input.newElementPath;
            }

            //create a basic Extension definition with the core data required. When the profie is save
            ed = {path:newPath,name: $scope.input.newElementPath,myMeta : {isNew:true}};
            switch ($scope.input.multiplicity) {
                case 'opt' :
                    ed.min=0; ed.max = "1";
                    break;
                case 'req' :
                    ed.min=1; ed.max='1';
                    break;
                case 'mult' :
                    ed.min=0; ed.max='*';
                    break;
            }
            ed.definition = $scope.input.definition || newPath;
            ed.type = [{code:$scope.input.newDatatype.code}];

            $scope.logOfChanges.push({type:'A',display:'Added '+ newPath,ed:ed})

            //this is a property against the component that will add the ed to the tree view
            $scope.newNodeToAdd = ed;
            $scope.input.dirty = true;
            delete $scope.input.newNode;
            resetInput();

           // buildTree();

        };

        $scope.changeBinding = function() {

            var vsUrl = prompt("Enter the ValueSet Url");
            if (vsUrl) {
                try {
                    $scope.edFromTreeNode.binding.valueSetReference.reference = vsUrl
                } catch (ex) {
                    alert('error changing ValueSet url')
                }

            }

        };


        //when an element is selected in the tree....
        $scope.treeNodeSelected = function(item) {
           // console.log(item);
            delete $scope.input.newNode;      //the var that displays the new node data
            delete $scope.edFromTreeNode;
            delete $scope.selectedNode;

            $scope.selectedNode = item.node;    //the node in the tree view...

            delete $scope.currentNodeIsParent;
            if (item.node && item.node.parent == '#') {
                $scope.currentNodeIsParent = true;
            }

            if (item.node && item.node.data && item.node.data.ed) {
                $scope.edFromTreeNode = item.node.data.ed;


                //need to figure out what the possible multiplicity options are...
                //todo - this will choke on multiplicities like 1..2
                var min = $scope.edFromTreeNode.min;
                var max = $scope.edFromTreeNode.max;
                //if there's a base then use the min/max values on those...
                if ($scope.edFromTreeNode.base) {
                    min = $scope.edFromTreeNode.base.min;
                    max = $scope.edFromTreeNode.base.max;
                }



                $scope.possibleMultiplicity = [];
                console.log(item.node.data.ed)

                if (min == 1) {
                    //this is a required value - we have some limitations about what can be done...
                    if (max == '*'){
                        $scope.possibleMultiplicity.push({mult:'1..*',min:1,max:'1'});
                        $scope.possibleMultiplicity.push({mult:'1..1',min:1,max:'1'});
                    }
                    //if both min and max are 1, then this is a required single field and cannot be altered...
                } else {
                    //this is an optional value (min ==0)...
                    if (max == '*') {
                        $scope.possibleMultiplicity.push({mult:'0..1',min:0,max:'1'});
                        $scope.possibleMultiplicity.push({mult:'1..1',min:1,max:'1'});
                        $scope.possibleMultiplicity.push({mult:'0..*',min:0,max:'*'});
                        $scope.possibleMultiplicity.push({mult:'1..*',min:1,max:'*'});
                    } else {
                        //this is a 0..1
                        $scope.possibleMultiplicity.push({mult:'0..1',min:0,max:'1'});
                        $scope.possibleMultiplicity.push({mult:'1..1',min:1,max:'1'});

                    }

                }




                $scope.$digest();       //the event originated outside of angular...
            }

        }

        $scope.changeMultiplicity = function(choice) {
            $scope.edFromTreeNode.min = choice.min;
            $scope.edFromTreeNode.max = choice.max;
            console.log(choice)
        }
        
    })
    .controller('validateInstanceCtrl', function($scope,appConfigSvc,resourceCreatorSvc){
        $scope.config = appConfigSvc.config();

        $scope.input = {show:'raw',extValue:{}};      //options = raw, results, parsed

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
                    console.log(updatedExt)
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
            GetDataFromServer.ahHocFHIRQuery(url).then(
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
            console.log($scope.resource);

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

                    console.log(vo);
                    $scope.extensions.push(vo);
                });
                //return isExtensionArray;
            }

            function parseBranch(branch,path) {
                angular.forEach(branch,function(v,k){
                    //console.log(k,v);

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

                        //processArray(v);
                        //console.log('array')



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


            //console.log($scope.extensions)
            //console.log($scope.input.show)

            //$scope.input.show='parsed'
        };


        //retrieve all the profiles based on this resource type on the server
        function getProfilesForResourceType(resourceType) {
            $scope.profilesThisType = [];
            var url = $scope.input.server.url + "StructureDefinition?kind=resource&type="+resourceType;
            GetDataFromServer.ahHocFHIRQuery(url).then(
                function(data) {
                    console.log(data)
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
            //console.log($scope.input.server);
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
            //console.log(input);
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
            //console.log(input);
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
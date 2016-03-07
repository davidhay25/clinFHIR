/* Controller for the resource builder
* Note that this uses jsTree to convert the internal resource model from a flat list to a hierarchy.
* todo - should replace that with a specific function...
* todo - this controller has ben=come far too big - should be re-factored...
* */

//https://coderwall.com/p/rqdrwq/nginx-conf-query-string-processing

angular.module("sampleApp")
    .controller('resourceCreatorCtrl',
        function ($scope,resourceCreatorSvc,GetDataFromServer,SaveDataToServer,
              RenderProfileSvc,appConfigSvc,supportSvc,$uibModal,ResourceUtilsSvc,Utilities,$location) {

    var profile;                    //the profile being used as the base
    var type;       //base type
    $scope.treeData = [];           //populates the resource tree
    $scope.results = {};            //the variable for resource property values...

    $scope.displayMode = 'resource';    //'resource' = resource builder, ''patient = patient
    $scope.selectedPatientResourceType = [];

    //expose the config service on the scope. Used for showing the Patint details...
    $scope.appConfigSvc = appConfigSvc;
    $scope.ResourceUtilsSvc = ResourceUtilsSvc;


    //the newpatient event is fired when a new patient is selected. We need to create a new resource...
    $scope.$on('newpatient',function(event,patient){
        console.log(patient)
        setUpForNewProfile(resourceCreatorSvc.getCurrentProfile());

    })

    //config - in particular the servers defined. The samples will be going to the data server...
    $scope.config = appConfigSvc.config();
    $scope.dataServer = $scope.config.allKnownServers[0];   //set the current dataserver... {name:,url:}
    appConfigSvc.setCurrentDataServer($scope.dataServer);


    //the actual Url of the profile currently being used...
    $scope.results.profileUrl = $scope.config.servers.conformance + "StructureDefinition/Condition";   //default profile

    //save the current patient in the config services - so other controllers/components can access it...
    appConfigSvc.setCurrentPatient({resourceType:'Patient',id:'340',name : [{text:'Ryder Walker'}]});



    //see if a profile url was passed in when invoked
    var params = $location.search();
    if (params) {
        if (params.url) {
            $scope.results.profileUrl = params.url;
        }
    }

    //event fired by ng-include of main page after the main template page has been loaded... (Otherwise the treeview isn't there...)
    $scope.includeLoaded = function() {
        //initial load..
        loadProfile($scope.results.profileUrl);
    };

    var type;//     the base type = $scope.results.profileUrl;      //todo - change type...

    $scope.selectProfile = function() {
        loadProfile($scope.results.profileUrl);
    };


    //sample patient data...
    supportSvc.getAllData(appConfigSvc.getCurrentPatient().id).then(
        //returns an object hash - type as hash, contents as bundle - eg allResources.Condition = {bundle}
        function(allResources){
           // console.log(allResources)
          //  $scope.allResources = allResources;     //needed when selecting a reference to an existing resouce for this patient...
            //this is so the resourceBuilder directive  knows who the patient is - and their data.
            //the order is significant - allResources must be set first...
            appConfigSvc.setAllResources(allResources);

        }

    )
    .finally(function(){
        $scope.loadingPatient = false;
    });


    //get all the standard resource types - the one defined in the fhir spec. Used for the select profile modal...
    RenderProfileSvc.getAllStandardResourceTypes().then(
        function(standardResourceTypes) {
            $scope.standardResourceTypes = standardResourceTypes ;

        }
    );


    //load the selected profile, and display the tree
    //for now - use the ProfileUrl which directly points to the profile. Want to support uri as well later on..
    function loadProfile(profileUrl) {
        /*delete $scope.conformProfiles;      //profiles that this resource claims conformance to. Not for baseresources
        $scope.treeData.length = 0;
        delete $scope.selectedChild;    //a child element off the current path (eg Condition.identifier
        delete $scope.children;         //all the direct children for the current path
        delete $scope.dataType ;        //the datatype selected for data entry
        */

        $scope.waiting = true;


        GetDataFromServer.getConformanceResourceByUrl(profileUrl).then(
            function(profile) {
                setUpForNewProfile(profile);

            }
        ).finally(
            function(){
                $scope.waiting = false;
            }
        );
    }


    //initialize everything for a newly loaded profile...
    function setUpForNewProfile(profile) {
        delete $scope.conformProfiles;      //profiles that this resource claims conformance to. Not for baseresources
        $scope.treeData.length = 0;         //removes all the treedata from the array
        delete $scope.selectedChild;    //a child element off the current path (eg Condition.identifier
        delete $scope.children;         //all the direct children for the current path
        delete $scope.dataType ;        //the datatype selected for data entry
        delete $scope.validateResults;  //the results of a validation

       // console.log(profile)
        resourceCreatorSvc.setCurrentProfile(profile);
        $scope.results.profileUrl = profile.url;

        //now set the base type. If a Core profile then it will be the profile name. Otherwise, it is the constarinedType
        if (profile.constrainedType) {
            type = profile.constrainedType;
            $scope.conformProfiles = [profile.url]       //the profile/s that this resource claims conformance to
        } else {
            //assume that this is a core resource. The type is the SD.name element
            type = profile.name;
        }

     //   console.log(type)

        //create the root node.
        var rootEd = resourceCreatorSvc.getRootED(type);
        $scope.treeData.push({id:'root',parent:'#',text:type,state:{opened:true},path:type,
            ed:rootEd});

        navigatorNodeSelected('root',rootEd);   //this will display the child nodes of the root

        //add the current patient

        resourceCreatorSvc.addPatientToTree(type+'.subject',appConfigSvc.getCurrentPatient(),$scope.treeData);  //todo - not always 'subject'
        drawTree();
    }


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

        drawTree(); //when the tree load is complete, the 'treebuild' event is raised. the handler looks at 'savingResource' and calls save...

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

        //called after the tree has been built. Mainly to support the saving
        if ($scope.savingResource) {
            delete $scope.savingResource;


            saveResourceToServer()




        }

        if ($scope.validatingResource) {
            delete $scope.validatingResource;
            Utilities.validate($scope.resource).then(
                function(data){
                  //  console.log(data);
                    $scope.validateResults = {outcome:'The resource is valid!'};
                },
                function(data) {
                    var oo = data.data;
                    console.log(oo);
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

    $scope.closeValidationOutcome = function(){
        delete $scope.validateResults;
    };

    //draws the tree showing the current resource
    function drawTree() {
        $('#treeView').jstree('destroy');
        $('#treeView').jstree(
            { 'core' : {'data' : $scope.treeData ,'themes':{name:'proton',responsive:true}}}
        ).on('changed.jstree', function (e, data){
            //seems to be the node selection event...

            var node = getNodeFromId(data.node.id);

            //  $scope.selectedNode = node;

            if (node && node.ed) {
                navigatorNodeSelected(data.node.id,node.ed)
            }


            /*
            delete $scope.children;     //the node may not have children (only BackboneElement datatypes do...
            var node = getNodeFromId(data.node.id);

          //  $scope.selectedNode = node;

            if (node && node.ed) {
                //todo - now redundate.. see$scope.selectedNode
                $scope.selectedNodeId = data.node.id;   //the currently selected element. This is the one we'll add the new data to...

                resourceCreatorSvc.getPossibleChildNodes(node.ed).then(
                    function(data){
                        $scope.children = data;    //the child nodes...
                    },
                    function(err){

                    }
                );

            }

            delete $scope.dataType;     //to hide the display...
            */

            $scope.$digest();       //as the event occurred outside of angular...

        }).on('redraw.jstree',function(e,data){
            buildResource();
            $scope.$broadcast('treebuilt');
            $scope.$digest();       //as the event occurred outside of angular...
        });
    }



        //when the user has selected a node in the navigator tree (or called externally). Display the value of the node or possible child nodes
    var navigatorNodeSelected = function(nodeId,ed){
      //  $scope.selectedNode = node;
        delete $scope.children;     //the node may not have children (only BackboneElement datatypes do...
        $scope.selectedNodeId = nodeId;   //the currently selected element. This is the one we'll add the new data to...
        delete $scope.dataType;     //to hide the display...
        resourceCreatorSvc.getPossibleChildNodes(ed).then(
            function(data){
                $scope.children = data;    //the child nodes...
            },
            function(err){

            }
        );
    } ;


    //when one of the datatypes of the child nodes of the currently selected element in the tree is selected...
    $scope.childSelected = function(ed,inx) {
        console.log(inx)
        $scope.selectedChild = ed;
        //the datatype of the selected element. This will display the data entry form.
        $scope.dataType = ed.type[inx].code;

        if ($scope.dataType == 'BackboneElement') {
            //if this is a BackboneElement, then add it to the tree and select it todo - may want to ask first
            var treeNode = {id : new Date().getTime(),state:{opened:true}}
            treeNode.parent =  $scope.selectedNodeId;
            treeNode.ed = $scope.selectedChild;     //the ElementDefinition that we are adding
            treeNode.text = $scope.selectedChild.myData.display;    //the property name
            treeNode.path = $scope.selectedChild.path;
            //treeNode.type = 'bbe';      //so we know it's a backboneelement, so should have elements referencing it...
            treeNode.isBbe = true;      //so we know it's a backboneelement, so should have elements referencing it...
            //add the new node to the tree...
            $scope.treeData.push(treeNode);    //todo - may need to insert at the right place...


            $scope.selectedNodeId = treeNode.id;   //the currently selected element in the tree. This is the one we'll add the new data to...
            var node = getNodeFromId(treeNode.id);

            $scope.waiting = true;
            resourceCreatorSvc.getPossibleChildNodes(node.ed).then(
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
            resourceCreatorSvc.dataTypeSelected($scope.dataType,$scope.results,ed,$scope,appConfigSvc.getAllResources());
            //console.log($scope.profileUrlInReference);
        }
    };


    //when a new element has been populated. The 'find reference resource' function creates the fragment - the others don't
    $scope.saveNewDataType = function(fragment) {
        fragment = fragment || resourceCreatorSvc.getJsonFragmentForDataType($scope.dataType,$scope.results);
        //var fragment = resourceCreatorSvc.getJsonFragmentForDataType($scope.dataType,$scope.results);
        //now add the new property to the tree...
        var treeNode = {id : new Date().getTime(),state:{opened:true},fragment:fragment.value,display:fragment.text}
        treeNode.parent =  $scope.selectedNodeId;
        treeNode.ed = $scope.selectedChild;     //the ElementDefinition that we are adding

        var display = $scope.selectedChild.myData.display;  //from the ED...
        if (display.indexOf('[x]') > -1) {
            //this is a polymorphic field...
            display = display.slice(0, -3) + $scope.dataType.toProperCase();
           // console.log(display)
        }
        treeNode.text = display;    //the property name
        treeNode.path = $scope.selectedChild.path;
        treeNode.dataType = {code : $scope.dataType};
        //add the new node to the tree...
        $scope.treeData.push(treeNode);    //todo - may need to insert at the right place...

        drawTree() ;        //and redraw...
        //delete the datatype - this will hide the input form...
        delete  $scope.dataType;
    };

    //when entering a new element
    $scope.cancel = function() {
        delete $scope.dataType;
    };

    $scope.removeNode = function() {
        var id = $scope.selectedNodeId;
        var inx = -1;
        for (var i=0; i<$scope.treeData.length;i++) {
            if ($scope.treeData[i].id == id) {
                inx = i;
            }
        }
        if (inx > -1) {
            $scope.treeData.splice(inx,1);
            drawTree();
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

        //a promise to the resolved when modal exits.
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
    $scope.parkAndBuild = function() {
        console.log($scope.selectedChild)
        var ed = $scope.selectedChild;  //the ED describing the current element
        if (ed && ed.type && ed.type[0].profile) {
            var profileName =ed.type[0].profile[0];
            alert(profileUrl)
        }
    };

    var saveResourceToServer = function() {
        $uibModal.open({
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
                            console.log(oo)

                            $scope.saveState='fail';
                            $scope.saving = false;
                            $scope.outcome = "There was an error saving the resource: " ;
                            $scope.oo = oo;

                        }
                    ).finally(function(){
                        $scope.showWaiting = false;
                    })
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

            });
        };


    //=========== selecting a new profile ============

    $scope.showFindProfileDialog = {};
    //display the profile (SD) selector
    $scope.findProfileNew = function() {
        //$scope.input.profileType = null;    //reset the profile selector
        $scope.showFindProfileDialog.open();
    };

    //when a profile is selected...  This is configured in the directive...
    $scope.selectedProfile = function(profile) {
        console.log(profile);
        $scope.dirty=false;     //a new form is loaded
        $scope.parkedHx = false;
        setUpForNewProfile(profile);
        //$scope.dynamic.profile = angular.copy(profile);

        //add to list of favourite profiles & update list
        //RenderProfileSvc.addToFavouriteProfiles(profile);
        //$scope.allKnownProfiles = Utilities.addToFavouriteProfiles(profile); //RenderProfileSvc.getFavouriteProfiles();


    };


    $scope.selectPatientResourceType = function(bundle) {
        console.log(bundle)
        $scope.selectedPatientResourcesOfType = bundle;
    };


})
    .controller('patientCtrl', function ($scope,appConfigSvc,resourceCreatorSvc,ResourceUtilsSvc,supportSvc) {
        //expose the config service on the scope. Used for showing the Patint details...
        $scope.appConfigSvc = appConfigSvc;
        $scope.ResourceUtilsSvc = ResourceUtilsSvc;
        $scope.display = {editMode:false};


        $scope.searchForPatient = function(name) {
            console.log(name)
            resourceCreatorSvc.findPatientsByName(name).then(
                function(data){
                    // ResourceUtilsSvc.getOneLineSummaryOfResource(patient);
                    $scope.matchingPatientsBundle = data.data;
                    console.log($scope.matchingPatientsBundle)
                },
                function(err) {
                    alert('Error finding patient: '+angular.toJson(err))
                }
            )
        };

        //a new patient is selected
        $scope.selectNewPatient = function(patient) {
            delete  $scope.allResources;

            appConfigSvc.setCurrentPatient(patient);
            $scope.display.editMode=false;
            appConfigSvc.setAllResources({});
            supportSvc.getAllData(patient.id).then(
                //returns an object hash - type as hash, contents as bundle - eg allResources.Condition = {bundle}
                function(allResources){
                    //console.log(allResources)
                    $scope.allResources = allResources;
                    //$scope.allResources = allResources;     //needed when selecting a reference to an existing resouce for this patient...
                    //this is so the resourceBuilder directive  knows who the patient is - and their data.
                    //the order is significant - allResources must be set first...
                    appConfigSvc.setAllResources(allResources);
                    $scope.$emit('newpatient',patient)

                }

                )
                .finally(function(){
                    $scope.loadingPatient = false;
                });
        }

});
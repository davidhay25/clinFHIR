
/*This is a reall bad name! It's actually a profile editor...*/
angular.module("sampleApp")
.controller('logicalModelCtrl',function($scope,$rootScope,profileCreatorSvc,resourceCreatorSvc,GetDataFromServer,
                                        appConfigSvc,modalService,RenderProfileSvc,$uibModal,Utilities,$timeout){


    //get the fhir version as so much depends on it...
    $scope.fhirVersion = 2;
    var tmp = appConfigSvc.getCurrentConformanceServer();
    if (tmp.version == 3) {
        $scope.fhirVersion = 2;
    }

    $scope.dataTypes = resourceCreatorSvc.getDataTypesForProfileCreator();      //all the known data types

    $scope.appConfigSvc = appConfigSvc;      //so we can display donfig stuff on the page
    $scope.Utilities = Utilities;           //for the get profile from url which is different in stu2 & 3

    $scope.setNew = function(){

        if ($scope.fhirVersion == 3 && !$scope.profileInEditor.type) {
            modalService.showModal({}, {bodyText: "This base profile does not have a 'type' property so can't be used as the basis for a custom profile."})
        } else {
            $scope.mode = 'new';
        }
    };

    $scope.zoomedMM = false;
    
    $scope.toggleZoom= function() {
        $scope.zoomedMM = !$scope.zoomedMM;
        $timeout(function(){
            $scope.profileNetwork.fit();
           
        },750)
    }
    
    //all the known Resource types. Used when creating a reference
    RenderProfileSvc.getAllStandardResourceTypes().then(
        function(standardResourceTypes) {
            $scope.standardResourceTypes = standardResourceTypes ;

        }
    );

    //when a new name is entered into the name box, see if there is already a profile with that url. 
    $scope.checkExistingProfile = function(name) {

        resourceCreatorSvc.getProfileFromConformanceServerById(name).then(
            function(data) {
                //oops, the file exists
                if (isAuthoredByClinFhir(data)) {
                    modalService.showModal({}, {bodyText: 'The profile already exists and will be replaced if the name is not chosen.'})
                    $scope.mode='edit';      //allow this profile to be changed...
                } else {
                    modalService.showModal({}, {bodyText: 'This profile is not authored by clinFHIR. You need to choose another name'});
                    $scope.input.profileName = "";
                }


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
            $scope.selectedNode = $scope.model[0];      //<<updated july...
        }
        $scope.currentNodeIsParent = true;
        //


    }

    //setUpDisplayNewProfile();


    var createGraphOfProfile = function(profile) {

        //use a clone of the current profile. This will be updated as a profile is developed
        if (!$scope.graphProfile) {
            //$scope.graphProfile = angular.copy($scope.frontPageProfile)
            $scope.graphProfile = angular.copy(profile)

        }

        resourceCreatorSvc.createGraphOfProfile($scope.graphProfile).then(
            function(graphData) {
                var container = document.getElementById('profileNetwork');

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
                    //console.log(obj)

                    var nodeId = obj.nodes[0];  //get the first node
                    //console.log(nodeId,graphData)
                    var node = graphData.nodes.get(nodeId);
                    //console.log(node)
                    $scope.selectedProfileNetworkED = node.ed;
                    $scope.$digest();
                    //selectedNetworkElement

                });
            }
        );
    };

    
    /*
    //when a new profile is chosen from the list on the front page...
    $rootScope.$on('newProfileChosen',function() {

        //the graph display for the current profile
        delete $scope.graphProfile;     //delete any graphProfile currently created

        createGraphOfProfile();
        setUpDisplayNewProfile()

    });
*/
    
    
    //this is the event when the profileGraph tab is chosen. Should really move this to a separate controller...
    $scope.redrawProfileGraph = function() {
        console.log('click')

        $timeout(function(){
            $scope.profileNetwork.fit();
            console.log('fitting...')
        },500            )


    }

    //$scope.editText = 'Edit';       //will change the text when a core profile...
    //when there is a non-core profile - allow it to be edited...
    $scope.startEdit = function() {

        //console.log($scope.frontPageProfile.code);

        // extensionSD.code = [{system:'http://fhir.hl7.org.nz/NamingSystem/application',code:'clinfhir'}]

        if (Utilities.isAuthoredByClinFhir($scope.frontPageProfile)) {
        //if (isAuthoredByClinFhir($scope.frontPageProfile)) {
            $scope.mode = 'edit';           //edit (current), new, view
            $scope.input.profileName = $scope.frontPageProfile.name  //maintained by frontCtrl
        } else {
            modalService.showModal({}, {bodyText: 'Only profiles authored by clinFHIR can be edited'});
        }
    };

    function isAuthoredByClinFhir(profile) {
       // return true
        var isAuthoredByClinFhir = false;
        if (profile.code) {
            profile.code.forEach(function(coding){
                if (coding.system == 'http://fhir.hl7.org.nz/NamingSystem/application' &&
                    coding.code == 'clinfhir') {
                    isAuthoredByClinFhir = true;
                }
            })
        }
        return isAuthoredByClinFhir;
    }

    //allows the user to view the contents of a valueSet. Note that the '$scope.showVSBrowserDialog.open' call is
    //actually implemented in the 'resourceCreatorCtrl' controller - it's the parent of this one...
    //if 'isUrl' is true then this is a cannonical profile.url that was passed in. Otherwise it's a direct url to the Valueset (this can be confusing!)
    $scope.showValueSetForProfile = function(url,isUrl) {

        console.log(isUrl)
        $scope.showWaiting = true;

        if (isUrl) {
            //this is a cannonical url - retrieve from the currently defined terminology server
            //this is mal-named - it returns the actual valueset...
            Utilities.getValueSetIdFromRegistry(url,function(vs){
                console.log(vs)
                $scope.showVSBrowserDialog.open(vs.resource);
            })
        } else {
            //this is a direct url to the resource
            GetDataFromServer.getValueSet(url).then(
                function(vs) {

                    $scope.showVSBrowserDialog.open(vs);

                }
            ).finally (function(){
                $scope.showWaiting = false;
            });
        }



    };

    //when a profile is selected from the front screen, check if it is a core type
    //note that the tree component has already been set up with the new profile so no need to do it again...
    $scope.$on('profileSelected',function(event,selectedProfile){
        delete $scope.isBaseResource;
        $scope.logOfChanges = [];
        $scope.allowEdit = false;    //the profile being viewed can be altered
        //var selectedProfile = data.profile;


        $scope.frontPageProfile = selectedProfile;      //this is the property in the tree component...
        console.log(selectedProfile)

        $scope.profileInEditor = selectedProfile;

        $scope.input.profileName = selectedProfile.id;
        //is this a core profile? If it is, it cannot be edited. todo - ?move this to a service??
        //determine this if the url has the format 'http://hl7.org/fhir/StructureDefinition/{definedResourceName}
        var urlOfProfile = selectedProfile.url;
        if (! urlOfProfile) {
            alert('This profile has no URL!');
            return;
        }

        if (urlOfProfile.indexOf('http://hl7.org/fhir/StructureDefinition/')> -1) {
            //this is a base resource...
            $scope.isBaseResource = true;
        } else {

            if (isAuthoredByClinFhir) {
                $scope.allowEdit = true;
            }
            

        }


        //perform the local setup required...
        //the graph display for the current profile
        delete $scope.graphProfile;     //delete any graphProfile currently created

        createGraphOfProfile(selectedProfile);
        setUpDisplayNewProfile();

        //generate a differential view
        delete $scope.differences;
        delete $scope.error;

        profileCreatorSvc.diffFromBase(selectedProfile,appConfigSvc).then(
            function(vo) {
               // console.log(differences)
                $scope.differences = vo.differences;
                $scope.baseDefinition = vo.baseDefinition;
            },function(err) {
                $scope.diffError = "Unable to create difference file - can't locate a base profile";
                //alert(angular.toJson(err))
            }
        )
        
        
        
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
                closeTheProfileEditor();
            })
        } else {
            closeTheProfileEditor();
        }
    };

    //function to clear all the variables relating to the current profile and close the page
    function closeTheProfileEditor() {
        delete $scope.model;
        delete $scope.selectedNode;
        delete $scope.edFromTreeNode;

        //now set the displayMode. If there is a 'currentMode' on the rootScope, then set to that (as it was the mode
        //from where the profile editor was invoked. Otherwise, load the front page...
        if ($rootScope.lastModeActivity && $rootScope.lastModeActivity.currentMode) {
            $rootScope.$broadcast('setDisplayMode',{newMode:$rootScope.lastModeActivity.currentMode,currentMode: 'profileEditor'});  //display the profile editor page
        } else {
            $rootScope.$broadcast('setDisplayMode',{newMode:'front',currentMode: 'profileEditor'});  //display the profile editor page
        }

        //$rootScope.$emit('closeProfileEditPage');
        
        
        
    }

    //when the tree is re-drawn. model is the array of tree nodes.
    //actually - this happens whenever an ED is changed. should really change the name...
    $scope.onTreeDraw = function(item) {
        //console.log(item);
        $rootScope.$broadcast('setWaitingFlag',false)
        $scope.waiting = false;     //turn off the waiting icon
        $scope.model = item;
        //console.log('modal=',$scope.model)

    };

    $scope.changeDefinition = function() {

        if ($scope.editDefinition){
            //make the component update the model it is based on...
            $scope.updateElementDefinitionInComponent = {ed:$scope.edFromTreeNode,item:$scope.treeNodeItemSelected};
        }

        $scope.editDefinition = ! $scope.editDefinition
    }

    $scope.changeComments = function() {

        if ($scope.editComments){
            //make the component update the model it is based on...
            $scope.updateElementDefinitionInComponent = {ed:$scope.edFromTreeNode,item:$scope.treeNodeItemSelected};
        }

        $scope.editComments = ! $scope.editComments
    }

    //remove a datatype from the list of options...
    $scope.removeDataType = function(index) {

        var type;
        if ($scope.edFromTreeNode.myMeta.isExtension) {
            type = $scope.edFromTreeNode.myMeta.analysis.dataTypes;
        } else {
            type = $scope.edFromTreeNode.type;
        }


        if (type.length == 1) {
            //in theory, should never be called if only 1 left...
            alert("Sorry, you can't remove the last datatype")
        } else {
            type.splice(index,1);
            $scope.edFromTreeNode.type = type;
            $scope.edFromTreeNode.myMeta = $scope.edFromTreeNode.myMeta || {};
            $scope.edFromTreeNode.myMeta.isDirty = true;
            //make the component update the model it is based on...
            $scope.updateElementDefinitionInComponent = {ed:$scope.edFromTreeNode,item:$scope.treeNodeItemSelected};
            if ($scope.edFromTreeNode.myMeta.isExtension) {
                setIsCoded($scope.edFromTreeNode.myMeta.analysis);
            }

        }
    };

    //set the 'isCoded' flag for extensions
    function setIsCoded(analysis) {
        analysis.isCoded = false;
        analysis.dataTypes.forEach(function(dt){
            if (['code','Coding','CodeableConcept'].indexOf(dt.code) > -1) {
                analysis.isCoded = true;
            }
        })
    }

    //remove the current node (and all child nodes)
    $scope.removeNode = function(){
        if ($scope.selectedNode.parent == '#' ) {
            alert("You can't delete the root node!");
            return;
        }
        var ed = $scope.selectedNode.data.ed; //the ExtensionDefinition we want to remove
        // var path = ed.path;     //the path of the element to be removed...

        //pass in the ed, as the path alone is not enough - eg when this is an extension being deleted...
        $scope.deleteAtPath = ed;     //is a component property - will cause the element and all children to be removed...
        
        $scope.logOfChanges.push({type:'D',display:'Removed '+ ed.path,path:ed.path,ed:ed})

        //add to the differences array - but make sure it's present as it can be slow to load!
        //todo should really wait until present...
        if ($scope.differences) {
            $scope.differences.push({type:'removed',ed:ed})
        }


        delete $scope.input.newNode;    //indicates whether a child or a sibling - will hide the new entry
        delete $scope.edFromTreeNode;
        delete $scope.selectedNode;

    };

    //$scope.editProfile = function

    //restore a deleted element - one that was deleted in this session
    //todo - is this appropriate now that we can restore from the difference?
    $scope.restore = function(ed,inx){
        $scope.restoreRemoved = ed;     //this is a property on the component...
        $scope.logOfChanges.splice(inx,1)

        //now remove it from the differences array...
        if ($scope.differences) {
            var inx1 = -1;
            $scope.differences.forEach(function(diff,diffInx){
                if (diff.ed.path == ed.path) {
                    inx1 = diffInx;
                }
            })

            if (inx1 > -1) {
                $scope.differences.splice(inx1);
            }
        }



    };

    //remove a new node that was added...
    $scope.removeNewNode = function(ed,inx) {
        $scope.deleteAtPath = ed;            //this is a property on the component...
        $scope.logOfChanges.splice(inx,1)
    };

    //save the new (or updated) profile
    $scope.save = function() {
        var name = $scope.input.profileName;

          if (! name) {
            alert('Please enter a name')
            return;
        }

        //pass in the name of the profile, the model (with all the data), the profile that is being altered
        //and whether this is a new profile, or updating an existing

        console.log($scope.model)
        //return;

        var isEdit = false;
        if ($scope.mode == 'edit') {isEdit = true;}
        $rootScope.$broadcast('setWaitingFlag',true);
        profileCreatorSvc.saveNewProfile(name,$scope.model,$scope.frontPageProfile,isEdit).then(
            function(vo) {
                //vo is an array of messages as as one time extension defs could be created automatically...
                modalService.showModal({}, {bodyText: vo.log[0]})

                //alert(angular.toJson(vo.log))
                //now add to the list of profiles...
                //console.log(vo)
                var clone = angular.copy(vo.profile);
                appConfigSvc.addToRecentProfile(clone,true);  //add to the list, replacing any existing..
                //resourceCreatorSvc.setCurrentProfile(clone);
                if ($scope.recent) {
                    $scope.recent.profile = appConfigSvc.getRecentProfile();    //re-establish the recent profile list
                }


                //added tuesday nov-8
                $rootScope.$emit('profileSelected',clone);      //will cause the builder to be set up for the seelcted profile...


                // temp  closeTheProfileEditor();    //close the editor and re-display the front page

            },
            function(log) {
                alert(angular.toJson(log))
            }
        ).finally(function(){
            $rootScope.$broadcast('setWaitingFlag',false);
            $rootScope.$emit('profileEditComplete');        //6 feb 2017 - will hide the edit screen.  This all needs refactoring...
        });
    };


    //add a new child node to the current one (as an extension)
    $scope.addNewNodeDEP = function(type) {

        console.log(type);
        var newPath,parentId,ed;
        var edParent = $scope.selectedNode.data.ed;       //the elementDefinition of the parent
        if (type == 'child') {
            newPath = edParent.path + '.' + $scope.input.newElementPath;     //the full path of the new child node
            //parentId = edParent.path;

        } else {
            parentId = $scope.selectedNode.parent;
            if (parentId == '#') {
                alert("Can't add a sibling to the parent");
                return;
            }
            newPath = parentId + '.' + $scope.input.newElementPath;
        }

        //create a basic Extension definition with the core data required. When the profile is saved, the other stuff will be added
        ed = {path:newPath,name: $scope.input.newElementPath,myMeta : {isNew:true, isExtension:true}};
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
        ed.type = [{code:$scope.input.newDatatype.code}];       //<!--- todo is this right?


        //this is an extension - so we store the datatype in the analysis object...
        var vo = {code:$scope.input.newDatatype.code};
        //if this is a reference, and there is a type specified then add the profile
        if ($scope.input.newDatatype.code == 'Reference' && $scope.input.newRRForNode) {
            vo.profile = ['http://hl7.org/fhir/StructureDefinition/'+$scope.input.newRRForNode.name];
        }
        ed.myMeta.analysis = {dataTypes:[vo]};

        //update the log of chnages
        $scope.logOfChanges.push({type:'A',display:'Added '+ newPath,ed:ed});

        //this is a property against the component that will add the ed to the tree view
        $scope.newNodeToAdd = ed;       //<<<<<<  here is the add function... see it in profileEditor.html
        $scope.input.dirty = true;
        delete $scope.input.newNode;
        resetInput();


        //this is test added for the graph stuff...
        // $scope.frontPageProfile.snapshot.element.push(ed); //  todo - not sure about the impact of this...
        if (!$scope.graphProfile) {
            $scope.graphProfile = angular.copy($scope.frontPageProfile)

        }


        $scope.graphProfile.snapshot.element.push(ed); //  todo - not sure about the impact of this...
        createGraphOfProfile();     //note that $scope.GraphProfile does exist for the createGraphOfProfile function

        //$rootScope.$emit('newProfileChosen');

    };

    //add a datatype to an extension element...
    $scope.addDTToElement = function(dt) {
        var type = {code:dt.code}

        if (dt.code == 'Reference') {
            if ($scope.input.newRRForExtension) {
                type.profile = ['http://hl7.fhir.org/'+$scope.input.newRRForExtension.name];
            }

        }
        $scope.edFromTreeNode.myMeta.analysis.dataTypes.push(type);

        if ($scope.edFromTreeNode.myMeta.isExtension) {
            setIsCoded($scope.edFromTreeNode.myMeta.analysis);
        }

        //make the component update the model it is based on...
        $scope.updateElementDefinitionInComponent = {ed:$scope.edFromTreeNode,item:$scope.treeNodeItemSelected};

        //$scope.edFromTreeNode.type.push({code:dt});
        $scope.input.addNewDTToExtension = false;
    };

    //change the binding for a coded element...
    $scope.changeBinding = function() {


        $uibModal.open({
            backdrop: 'static',      //means can't close by clicking on the backdrop.
            keyboard: false,       //same as above.
            templateUrl: 'modalTemplates/vsFinder.html',
            size:'lg',
            controller: 'vsFinderCtrl',
            resolve  : {
                currentBinding: function () {          //the default config
                    return $scope.edFromTreeNode.binding;
                }
            }
        }).result.then(
            function(vo) {
                console.log(vo)


                //todo - there's an assumption here that
               // $scope.edFromTreeNode.binding = {strength:vo.strength,description: "test",
                   // valueSetReference : {reference : 'ValueSet/'+ vo.vs.id}};

                $scope.edFromTreeNode.binding = {strength:vo.strength,description: vo.description,
                    valueSetUri : vo.vs.url};

                $scope.edFromTreeNode.myMeta = $scope.edFromTreeNode.myMeta || {};
                $scope.edFromTreeNode.myMeta.isDirty = true;

                //make the component update the model it is based on...
                $scope.updateElementDefinitionInComponent = {ed:$scope.edFromTreeNode,item:$scope.treeNodeItemSelected};

            }
        );

        /*

         var vsUrl = prompt("Enter the ValueSet Url");
         if (vsUrl) {
         try {
         //var binding = {valueSetReference : vsUrl};


         //$scope.edFromTreeNode.binding = edFromTreeNode.binding || {binding : { valueSetReference : {}}};

         $scope.edFromTreeNode.binding = {valueSetReference : {reference : vsUrl}};
         $scope.edFromTreeNode.myMeta = $scope.edFromTreeNode.myMeta || {};
         $scope.edFromTreeNode.myMeta.isDirty = true;

         //make the component update the model it is based on...
         $scope.updateElementDefinitionInComponent = {ed:$scope.edFromTreeNode,item:$scope.treeNodeItemSelected};
         } catch (ex) {
         alert('error changing ValueSet url')
         }

         }

         */

    };

    //when an element is selected in the tree....
    $scope.treeNodeSelected = function(item) {
        // console.log(item);
        delete $scope.input.newNode;      //the var that displays the new node data
        delete $scope.edFromTreeNode;
        delete $scope.treeNodeItemSelected;
        delete $scope.selectedNode;

        $scope.selectedNode = item.node;    //the node in the tree view...

        delete $scope.currentNodeIsParent;
        if (item.node && item.node.parent == '#') {
            $scope.currentNodeIsParent = true;
        }

        if (item.node && item.node.data && item.node.data.ed) {
            $scope.edFromTreeNode = item.node.data.ed;
            $scope.treeNodeItemSelected = item;     //the actual row in the base tree data


            //need to figure out what the possible multiplicity options are...
            //todo - this will choke on multiplicities like 1..2
            var min = $scope.edFromTreeNode.min;
            var max = $scope.edFromTreeNode.max;
            //if there's a base then use the min/max values on those...
            if ($scope.edFromTreeNode.base) {
                min = $scope.edFromTreeNode.base.min;
                max = $scope.edFromTreeNode.base.max;
            }

            //if this is a extension, then always permit any change...
            if ($scope.edFromTreeNode.myMeta && $scope.edFromTreeNode.myMeta.isExtension) {
                min=0;
                max= '*';
            }

            $scope.possibleMultiplicity = [];
            //console.log(item.node.data.ed)

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




            //$scope.$digest();       //the event originated outside of angular...
        }
        $scope.$digest();       //the event originated outside of angular...

    }

    $scope.changeMultiplicity = function(choice) {
        $scope.edFromTreeNode.min = choice.min;
        $scope.edFromTreeNode.max = choice.max;
        $scope.edFromTreeNode.myMeta =  $scope.edFromTreeNode.myMeta || {}
        $scope.edFromTreeNode.myMeta.isDirty = true;

        //make the component update the model it is based on...
        $scope.updateElementDefinitionInComponent = {ed:$scope.edFromTreeNode,item:$scope.treeNodeItemSelected};

        console.log(choice)
    };

    $scope.newExtension = function() {
        $uibModal.open({

            templateUrl: 'modalTemplates/newExtension.html',
            size: 'lg',
            controller: "extensionDefCtrl"
        }).result.then(
            function(vo) {
                console.log(vo)

                //this is copied from $scope.addNewNode todo - refactor out common code...

                var newPath = $scope.selectedNode.data.ed.path + '.' + vo.sd.id;  //get from ectensio

//create a basic Extension definition with the core data required. When the profile is saved, the other stuff will be added
                var ed = {path:newPath,name: vo.sd.id, myMeta : {isNew:false, isExtension:true}};
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
                ed.definition = 'definition from profile';
                ed.type = [{code:"Extension",profile:[vo.url]}]; //todo <<<<<<<<<<<  note that the profile is an array - fix!!!

                $scope.newNodeToAdd = ed;       //<<<<<<  here is the add function... see it in profileEditor.html
                $scope.input.dirty = true;

            })
        };

    $scope.selectExistingExtension = function(){
        var resourceType;
        try {
            resourceType = $scope.frontPageProfile.snapshot.element[0].path;
        } catch (ex) {
            alert("Oops - the profile is invalid, probably doesn't have a snapshot");
            return;
        }

        $uibModal.open({

            templateUrl: 'modalTemplates/searchForExtension.html',
            size:'lg',
            controller: function($scope,resourceType,GetDataFromServer,appConfigSvc,Utilities){
                $scope.resourceType = resourceType;

                //construct the query to retrene extension defintions...

                var conformanceSvr = appConfigSvc.getCurrentConformanceServer();

                var qry = conformanceSvr.url + "StructureDefinition?";


                qry += 'type=Extension';

                /* - 26-october it appears as if the same query can be used for stu2 & 3...
                if (conformanceSvr.version == 3) {
                    qry += "kind=complex-type&base=http://hl7.org/fhir/StructureDefinition/Extension";
                } else {
                    qry = "StructureDefinition?kind=datatype&type=Extension"; //&ext-context="+$scope.resourceType;
                    console.log('v2')
                }
                */

                $scope.qry = qry;
                

                $scope.conformanceServerUrl = conformanceSvr.url;

                $scope.showWaiting = true;


                GetDataFromServer.adHocFHIRQueryFollowingPaging(qry).then(

               // GetDataFromServer.queryConformanceServer(qry).then(
                    function(data) {
                        //filter out the ones not for this resource type. Not sure if this can be done server side...
                        $scope.bundle = {entry:[]}
                        if (data.data && data.data.entry) {
                            data.data.entry.forEach(function(entry){
                                var include = false;
                                if (entry.resource) {
                                    if (! entry.resource.context) {
                                        include = true;
                                    } else  {
                                        entry.resource.context.forEach(function(ctx){
                                            if (ctx == '*' || ctx == 'Element' ||  ctx.indexOf(resourceType) > -1) {
                                                include = true;
                                            }
                                        })
                                    }
                                }


                                if (include) {
                                    $scope.bundle.entry.push(entry)
                                }

                            })
                        }

                        $scope.bundle.entry.sort(function(a,b){
                            if (a.resource && b.resource) {
                                if (a.resource.name > b.resource.name) {
                                    return 1
                                } else {
                                    return -1;
                                }
                            } else {
                                return 0
                            }

                        });

                        //$scope.bundle = data.data;
                        console.log($scope.bundle);
                    }
                ).finally(function(){
                    $scope.showWaiting = false;
                });

                $scope.selectExtension = function(ent) {
                    $scope.selectedExtension = ent.resource


                    $scope.analyse = Utilities.analyseExtensionDefinition3($scope.selectedExtension)

                }


            },
            resolve : {
                resourceType: function () {          //the default config
                    return resourceType;
                }
            }
        }).result.then(
            function(extensionDef) {
                //an extension definition was selected
                console.log(extensionDef)

                var analysis = Utilities.analyseExtensionDefinition3(extensionDef);
                console.log(analysis)

                //--------  need to move this to a service or something! -------

                var edParent = $scope.selectedNode.data.ed;       //the elementDefinition of the parent

                newPath = edParent.path + '.extension';     //the full path of the new child node


                //create a basic Extension definition with the core data required. When the profile is saved, the other stuff will be added
                ed = {path:newPath,name: extensionDef.name,myMeta : {isNew:false, isExtension:true, isExistingExtension:true}};
                ed.min=0; ed.max = "1";
                ed.definition = "an extension";       //todo - fix...


                if (appConfigSvc.getCurrentFhirVersion() == 3) {
                    ed.type = [{code:'Extension',profile:extensionDef.url}];
                } else {
                    ed.type = [{code:'Extension',profile:[extensionDef.url]}];       
                }

                //this is a property against the component that will add the ed to the tree view
                $scope.newNodeToAdd = ed;       //<<<<<<  here is the add function... see the defintiion link  in profileEditor.html
                
                $scope.input.dirty = true;
                delete $scope.input.newNode;
                resetInput();

                //------------------------


            }
        );

    };

    //the user wants to restore an element that was removed from the base type
    $scope.RestoreFromDiff = function(inx) {
        //console.log(diff);
        var diff = $scope.differences[inx];
        $scope.restoreAtPath = null;
        $scope.restoreAtPath = diff.ed;      //component property
        $scope.differences.splice(inx,1);       //remove it from the differences array
      //  $scope.showTab.tabIndexActive='0';

      //  $scope.tabIndexActive = '0'
    }

}).filter('shortUrl',function(){
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
).filter('showUrlId',function() {
        //show the id component of a url
        return function (input) {

            if (input) {
                var ar = input.split('/');
                if (ar.length > 2) {
                    return ar[ar.length - 1]
                } else {
                    return input
                }
            } else {
                return input
            }

        }
    }    )
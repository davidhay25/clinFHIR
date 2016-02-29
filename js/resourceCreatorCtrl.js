/* Controller for the sample creator
* Whan a patient is created, the 'managingOrganization' will be set to the pre-defined origanizatiion that the tool
* creates (see cfOrganization). Then, when displaying patients created by the tool we search on that organization.
* If the data server doesn't support that search, then the patient will be created, but can't be displayed at the moment
* */


angular.module("sampleApp").controller('resourceCreatorCtrl', function ($scope,resourceCreatorSvc,GetDataFromServer,
                                                                        SaveDataToServer,RenderProfileSvc,appConfigSvc) {


    var type = 'Condition';
    var profile;            //the profile being used as the base
    $scope.treeData = [];      //populates the resource tree

    $scope.results = {};        //the variable for resource property values...


    //config - in particular the servers defined. The samples will be going to the data server...

    $scope.config = appConfigSvc.config();
    //set the current dataserver...
    $scope.dataServer = $scope.config.allKnownServers[0];   //{name:,url:}
    appConfigSvc.setCurrentDataServer($scope.dataServer);



    //get all the standard resource types - the one defined in the fhor spec...
    RenderProfileSvc.getAllStandardResourceTypes().then(
        function(standardResourceTypes) {
            $scope.standardResourceTypes = standardResourceTypes ;

        }
    );

    resourceCreatorSvc.getProfile(type).then(
        function(data) {
            profile = data;

            //create the root node.
            $scope.treeData.push({id:'root',parent:'#',text:type,state:{opened:true},path:type,
                ed:resourceCreatorSvc.getEDForPath(type)});
            resourceCreatorSvc.addPatientToTree(type+'.subject',{},$scope.treeData);  //todo - not always 'subject'
            drawTree();
        }
    );

    $scope.saveToServer = function(){
        //remove bbe that are not referenced...
        var cleanedData = resourceCreatorSvc.cleanResource($scope.treeData);

        $scope.treeData = cleanedData;

        //console.log($scope.cleanedResource)

        $scope.savingResource = true;


        drawTree();
        //buildResource();
    };

    //build the resource. Note that this depends on the model created by jsTree so can only be called
    //after that has been rendered...
    var buildResource = function(){
        var treeObject = $('#treeView').jstree().get_json();    //creates a hierarchical view of the resource
        $scope.resource = resourceCreatorSvc.buildResource(type,treeObject[0],$scope.treeData)


        //this is a version of the resource with all unreferenced BackBoneElement resources removed...
       // var cleanedTreeData = resourceCreatorSvc.cleanResource($scope.treeData);
       // $scope.treeData = cleanedTreeData;
       // drawTree();
    };


    $scope.$on('treebuilt',function(){
        //called after the tree has been built. Mainly to support the saving
       // alert('built')

        console.log($scope.resource);

      //  if ($scope.savingResource) {
        //    console.log($scope.resource)

//        }

        if ($scope.savingResource) {
            SaveDataToServer.saveResource($scope.resource).then(
                function (data) {
                    console.log(data)
                },
                function (err) {
                    console.log(err)
                }
            )
        }



    })

    //draws the tree showing the current resource
    function drawTree() {
        $('#treeView').jstree('destroy');
        $('#treeView').jstree(
            { 'core' : {'data' : $scope.treeData ,'themes':{name:'proton',responsive:true}}}
        ).on('changed.jstree', function (e, data){
            //seems to be the node selection event...

            delete $scope.children;     //the node may not have children (only BackboneElement datatypes do...
            var node = getNodeFromId(data.node.id);
console.log(node);

            $scope.selectedNode = node;
            if (node && node.ed) {
                //todo - now redundate.. see$scope.selectedNode
                $scope.selectedNodeId = data.node.id;   //the currently selected element. This is the one we'll add the new data to...


                $scope.children = resourceCreatorSvc.getPossibleChildNodes(node.ed);    //the child nodes...
                //console.log($scope.children)
            }

            delete $scope.dataType;     //to hide the display...

            $scope.$digest();       //as the event occurred outside of angular...

        }).on('redraw.jstree',function(e,data){
            buildResource();
            $scope.$broadcast('treebuilt')
            $scope.$digest();       //as the event occurred outside of angular...
        });
    }


    //when one of the child nodes of the currently selected element in the tree is selected...
    $scope.childSelected = function(ed,inx) {
        console.log(inx)
        $scope.selectedChild = ed;
        //the datatype of the selected element. This will drive the data entry form.
        $scope.dataType = ed.type[inx].code;

        if ($scope.dataType == 'BackboneElement') {
            //if this is a BackboneElement, then add it to the tree and select it todo - may want to ask first
            var treeNode = {id : new Date().getTime(),state:{opened:true}}
            treeNode.parent =  $scope.selectedNodeId;
            treeNode.ed = $scope.selectedChild;     //the ElementDefinition that we are adding
            treeNode.text = $scope.selectedChild.myData.display;    //the property name
            treeNode.path = $scope.selectedChild.path;
            treeNode.type = 'bbe';      //so we know it's a backboneelement, so should have elements referencing it...
            //add the new node to the tree...
            $scope.treeData.push(treeNode);    //todo - may need to insert at the right place...


            $scope.selectedNodeId = treeNode.id;   //the currently selected element in the tree. This is the one we'll add the new data to...
            var node = getNodeFromId(treeNode.id);
            $scope.children = resourceCreatorSvc.getPossibleChildNodes(node.ed);    //the child nodes for this node...

            drawTree() ;        //and redraw...

        } else {
            //this is a normal element - get set up to enter data specific to the datatype...

            //todo this is all carryover stuff - should go thru and check if needed...
            $scope.index = inx;         //save the position of this element in the list for the skip & next button
            delete $scope.externalReferenceSpecPage;
            delete $scope.elementDefinition;
            delete $scope.vsExpansion;
            delete $scope.UCUMAge;

            delete $scope.resourceReferenceText;
            delete $scope.profileUrlInReference;
            delete $scope.resourceList;

            //delete $scope.parentElement;
            $scope.results = {};                //clear any existing data...
            $scope.results.boolean = false;
            $scope.results.timing = {};         //needed for timing values...



            $scope.externalReferenceSpecPage = "http://hl7.org/datatypes.html#" + $scope.dataType;
            resourceCreatorSvc.dataTypeSelected($scope.dataType,$scope.results,ed,  $scope)
        }




    };


    //when a new element has been populated.
    $scope.saveNewDataType = function() {
        var fragment = resourceCreatorSvc.getJsonFragmentForDataType($scope.dataType,$scope.results);
        //console.log(fragment)
        //now add the new property to the tree...
        var treeNode = {id : new Date().getTime(),state:{opened:true},fragment:fragment.value,display:fragment.text}
        treeNode.parent =  $scope.selectedNodeId;
        treeNode.ed = $scope.selectedChild;     //the ElementDefinition that we are adding
        treeNode.text = $scope.selectedChild.myData.display;    //the property name
        treeNode.path = $scope.selectedChild.path;
        treeNode.dataType = {code : $scope.dataType};
        //add the new node to the tree...
        $scope.treeData.push(treeNode);    //todo - may need to insert at the right place...

        drawTree() ;        //and redraw...
        //delete the datatype - this will hide the input form...
        delete  $scope.dataType;
      //  buildResource();
    };

    //when entering a new element
    $scope.cancel = function() {
        delete $scope.dataType;
    };

    $scope.removeNode = function() {
        var id = $scope.selectedNode.id;
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
            $scope.showWaiting = true;
            return GetDataFromServer.getFilteredValueSet(vs,text).then(
                function(data,statusCode){

                    $scope.showWaiting = false;

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

                    $scope.showWaiting = false;
                    alert(msg);

                    return [
                        {'display': ""}
                    ];
                }
            );

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

    //this is called when a user clicked on the 'explore valueset' button
    $scope.showVSBrowserDlg = function() {

        $scope.showWaiting = true;

        GetDataFromServer.getValueSet($scope.vsReference).then(
            function(vs) {
                console.log(vs)
                $scope.showVSBrowserDialog.open(vs);


            }
        ).finally (function(){
            $scope.showWaiting = false;
        });




    };


});
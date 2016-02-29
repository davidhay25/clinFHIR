/* Controller for the sample creator
* Whan a patient is created, the 'managingOrganization' will be set to the pre-defined origanizatiion that the tool
* creates (see cfOrganization). Then, when displaying patients created by the tool we search on that organization.
* If the data server doesn't support that search, then the patient will be created, but can't be displayed at the moment
* */


angular.module("sampleApp").controller('resourceCreatorCtrl', function ($scope,resourceCreatorSvc) {


    var type = 'CarePlan';
    var profile;            //the profile being used as the base
    $scope.treeData = [];      //populates the resource tree

    $scope.results = {};        //the variable for resource property values...



    resourceCreatorSvc.getProfile(type).then(
        function(data) {
            profile = data;

            //create the root node.
            $scope.treeData.push({id:'root',parent:'#',text:type,state:{opened:true},fragment:type,path:type,
                ed:resourceCreatorSvc.getEDForPath(type)});
            resourceCreatorSvc.addPatientToTree(type+'.subject',{},$scope.treeData);  //todo - not always 'subject'
            drawTree()
        }
    );





    //add the currentl
    $scope.buildResource = function(){


        var treeObject = $('#treeView').jstree().get_json();
        console.log(treeObject);

        $scope.resource = resourceCreatorSvc.buildResource(type,treeObject[0],$scope.treeData)
    };



    //draws the tree showing the current resource
    function drawTree() {
        $('#treeView').jstree('destroy');
        $('#treeView').jstree(
            { 'core' : {'data' : $scope.treeData ,'themes':{name:'proton',responsive:true}}}
        ).on('changed.jstree', function (e, data){

            delete $scope.children;     //the node may not have children (only BackboneElement datatypes do...
            var node = getNodeFromId(data.node.id);

            if (node && node.ed) {
                $scope.selectedNodeId = data.node.id;   //the currently selected element. This is the one we'll add the new data to...
               // $scope.selectedEd = node.ed;            //
                $scope.children = resourceCreatorSvc.getPossibleChildNodes(node.ed);    //the child nodes...
                console.log($scope.children)
            }

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
            //add the new node to the tree...
            $scope.treeData.push(treeNode);    //todo - may need to insert at the right place...


            $scope.selectedNodeId = treeNode.id;   //the currently selected element in the tree. This is the one we'll add the new data to...
            var node = getNodeFromId(treeNode.id);
            $scope.children = resourceCreatorSvc.getPossibleChildNodes(node.ed);    //the child nodes...

            drawTree() ;        //and redraw...

        }



    };


    //when a new element has been populated.
    $scope.saveNewDataType = function() {
        var fragment = resourceCreatorSvc.getJsonFragmentForDataType($scope.dataType,$scope.results);
        console.log(fragment)
        //now add the new property to the tree...
        var treeNode = {id : new Date().getTime(),state:{opened:true},fragment:fragment.value}
        treeNode.parent =  $scope.selectedNodeId;
        treeNode.ed = $scope.selectedChild;     //the ElementDefinition that we are adding
        treeNode.text = $scope.selectedChild.myData.display;    //the property name
        treeNode.path = $scope.selectedChild.path;
        //add the new node to the tree...
        $scope.treeData.push(treeNode);    //todo - may need to insert at the right place...

        drawTree() ;        //and redraw...
        //delete the datatype - this will hide the input form...
        delete  $scope.dataType;
    };

    //---- these are dev routines

    $scope.addIdentifier = function() {
        //add an identifier to the root...
        var fragment = {system:'http://identifiers',value:'prp1660'}
        $scope.treeData.push({id:'idq'+new Date().getTime(),parent:'root',text:'Identifier',state:{opened:true},
            fragment:fragment,path:type+'.identifier',ed:resourceCreatorSvc.getEDForPath(type+'.identifier')});
        drawTree()
    };



    var getNodeFromId = function(id) {
        for (var i=0; i<$scope.treeData.length;i++) {
            if ($scope.treeData[i].id == id) {
                return $scope.treeData[i]
            }
        }
        return null;
    }


});
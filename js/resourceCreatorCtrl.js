/* Controller for the sample creator
* Whan a patient is created, the 'managingOrganization' will be set to the pre-defined origanizatiion that the tool
* creates (see cfOrganization). Then, when displaying patients created by the tool we search on that organization.
* If the data server doesn't support that search, then the patient will be created, but can't be displayed at the moment
* */


angular.module("sampleApp").controller('resourceCreatorCtrl', function ($scope,resourceCreatorSvc) {


    var type = 'CarePlan';
    var profile;            //the profile being used as the base
    var treeData = [];

    //$scope.childSelected = {};      //a child element selected from the current tree node...

    resourceCreatorSvc.getProfile(type).then(
        function(data) {
            profile = data;
            //console.log(resourceCreatorSvc.getEDForPath(type));



            //create the root node.
            treeData.push({id:'root',parent:'#',text:type,state:{opened:true},fragment:type,path:type,
                ed:resourceCreatorSvc.getEDForPath(type)});
            resourceCreatorSvc.addPatientToTree(type+'.subject',{},treeData);  //todo - not always 'subject'
            drawTree(treeData)
        }
    );





    //add the currentl
    $scope.buildResource = function(){
        $scope.resource = resourceCreatorSvc.buildResource(type,treeData)
    };



    function drawTree(treeData) {
        $('#treeView').jstree('destroy');
        $('#treeView').jstree(
            { 'core' : {'data' : treeData ,'themes':{name:'proton',responsive:true}}}
        ).on('changed.jstree', function (e, data){

            delete $scope.children;
           // var path = data.node.text;

            //console.log(data.node.id)
            //getPossibleChildNodes()

            var node = getNodeFromId(data.node.id);
//console.log(node.ed);

            if (node && node.ed) {
                $scope.children = resourceCreatorSvc.getPossibleChildNodes(node.ed);
                console.log($scope.children)
            }

             $scope.$digest();       //as the event occurred outside of angular

        });
    }


    $scope.childSelected = function(ed) {
        $scope.selectedChild = ed;

        //the datatype of the selected element. This will drive the data entry form.
        $scope.dataType = ed.type[0].code;
    };


    //---- these are dev routines

    $scope.addIdentifier = function() {
        //add an identifier to the root...
        var fragment = {system:'http://identifiers',value:'prp1660'}
        treeData.push({id:'idq'+new Date().getTime(),parent:'root',text:'Identifier',state:{opened:true},
            fragment:fragment,path:type+'.identifier',ed:resourceCreatorSvc.getEDForPath(type+'.identifier')});
        drawTree(treeData)
    };



    var getNodeFromId = function(id) {
        for (var i=0; i<treeData.length;i++) {
            if (treeData[i].id == id) {
                return treeData[i]
            }
        }
        return null;
    }


});
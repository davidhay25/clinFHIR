angular.module("sampleApp")
    .controller('formCtrl', function ($scope,$localStorage,$timeout,$window,$uibModal,$http,formSvc,$sce) {

        $scope.input = {};
        $scope.QName = "CBAC";      //the initial form
        $scope.server = "http://home.clinfhir.com:8054/baseR4/";        //where the Q's are stored

        $scope.renderUrl = "http://smartqedit4.azurewebsites.net/Questionnaire/Preview";      //the external rendering app

        $timeout(function () {
            //loadTree();
            let url = $scope.server + "Questionnaire/"+$scope.QName;
            $http.get(url).then(
                function(data) {
                    $scope.Q = data.data;
                    $scope.treeData = makeTreeData($scope.Q);
                    drawTree();
                    makeTable();
                    $scope.expandAll();
                }
            )
        },500);


        //load all the forms on the server. todo will need to re-factor this once the number gets large
        let url = $scope.server + "Questionnaire";
        $http.get(url).then(
            function(data) {
                console.log(data)
                $scope.allQbundle = data.data;

            }, function(err) {
                console.log(err)
            }
        );


        $scope.selectFormForRender = function(resource){

            let url = $scope.renderUrl + "?id="+ $scope.server + "Questionnaire/"+resource.id;
            $scope.externalRenderUrl = $sce.trustAsResourceUrl(url);

        };

        $scope.saveForm = function(){
            $scope.Q.id = $scope.QName;
            let url = $scope.server + "Questionnaire/"+$scope.QName;
            $http.put(url,$scope.Q).then(
                function(data) {
                    alert('Saved: '+ url)
                },function(err) {
                    alert(angular.toJson(err.data))
                }
            )
        };

        $scope.loadForm = function(){
            //todo - maybe seelct based on a List or Group of forms - not all of them
            $uibModal.open({
                backdrop: 'static',      //means can't close by clicking on the backdrop.
                keyboard: false,       //same as above.
                size: 'lg',
                templateUrl: 'modalTemplates/loadForm.html',
                controller: function ($scope, allQbundle, server,$http) {
                    $scope.bundle = allQbundle;

                    $scope.input = {}
                    /*
                    let url = server + "Questionnaire";
                    $http.get(url).then(
                        function(data) {
                            console.log(data)
                            $scope.bundle = data.data;

                        }, function(err) {
                            console.log(err)
                        }
                    );
*/
                    $scope.select=function(){
                        let resource = $scope.input.selectedEntry.resource;
                        $scope.$close(resource)
                    }

                }, resolve : {
                    allQbundle : function(){
                        return $scope.allQbundle;
                    },
                    server : function(){
                        return $scope.server;
                    }
                }
            }).result.then(function(Q){
                $scope.Q = Q;

                $scope.treeData = makeTreeData($scope.Q);
                drawTree();
                makeTable();
                $scope.expandAll();

            })


        };

        $scope.newForm = function(){
            let name = $window.prompt("What is the name of the new form (no spaces)?")
            if (name) {
                //check it's not already used
                if (name.indexOf(' ') > -1) {
                    alert('The name is upper and lowercase letters only. No spaces.')
                    return;
                }


                let url = $scope.server + "Questionnaire/"+name;
                $http.get(url).then(
                    function(data) {
                        alert("This name is already in use, sorry about that")
                    }, function (err) {
            console.log(err)
                        if (err.status = 404) {
                            $scope.Q = {resourceType: 'Questionnaire',name:name,item:[]};
                            $scope.QName = name;

                            //this should clear everything
                            $scope.treeData = makeTreeData($scope.Q);
                            drawTree();
                            makeTable();
                            $scope.expandAll();
                        }
                    }
                )
            }
        }

        $scope.externalRenderDEP = function(){
            let url = renderUrl + "id=" + $scope.server + "Questionnaire/" + $scope.QName;
            console.log(url)
        }

        $scope.expandAll = function() {
            $scope.treeData.forEach(function (item) {
                item.state = item.state || {};
                item.state.opened = true;
            });
            drawTree();
        };

        //the user wants to add a new item to the group
        $scope.addItem = function(){
           // $scope.input.currentAction = 'addItem'
            editItem();
        };

        $scope.editItem = function(inItem) {
            let vo = findItemInQ($scope.selectedNode.data.item.linkId);
            if (vo.item) {
                editItem(vo.item);
            }
            /*
            for (const groupItem of $scope.Q.item) {
                if (groupItem.item) {
                    for (const item of groupItem.item) {
                        if (item.linkId == inItem.linkId) {
                            editItem(item);
                            break;
                        }
                    }
                }
            }
            */


        };

        function editItem(item) {
            $uibModal.open({
                backdrop: 'static',      //means can't close by clicking on the backdrop.
                keyboard: false,       //same as above.
                //size: 'lg',
                templateUrl: 'modalTemplates/qItem.html',
                controller: function($scope,currentItem){
                    $scope.newOptionsType = ['display','boolean','decimal','integer','date','datetime','string','text','choice','quantity']
                    $scope.input = {};

                    console.log(currentItem)

                    let newItem = {};
                    newItem.linkId = 'id' + new Date().getTime();
                    $scope.input.newItemType = 'string'
                    //if editing
                    if (currentItem) {

                        $scope.input.ValueSet = currentItem.answerValueSet;

                        $scope.input.repeats =  currentItem.repeats;
                        $scope.input.newItemType = currentItem.type;
                        $scope.input.newItemText = currentItem.text
                        newItem.linkId = currentItem.linkId;
                        if (currentItem.code) {
                            //assume only 1 code
                            $scope.input.code = currentItem.code[0].code;
                            $scope.input.system = currentItem.code[0].system;

                        }
                    }
                    //$scope.item = currentItem;

                    $scope.save=function(){
                        newItem.text = $scope.input.newItemText;
                        newItem.type = $scope.input.newItemType;
                        newItem.repeats = $scope.input.repeats;
                        if ($scope.input.ValueSet) {
                            newItem.answerValueSet = $scope.input.ValueSet;
                        }
                        if ($scope.input.code) {
                            newItem.code=[{system:$scope.input.system,code:$scope.input.code}]
                        }
                        $scope.$close(newItem)
                    }
                }, resolve : {
                    currentItem : function(){
                        return item;
                    }
                }
            }).result.then(function(newItem){
                if (item) {
                    //editing
                    item.text = newItem.text;
                    item.type - newItem.type;
                    item.repeats = newItem.repeats;
                    item.answerValueSet = newItem.answerValueSet;
                    item.code = newItem.code;


                    $scope.selectedNode.data.item = item;  //so the current display is updated

                } else {
                    //new

                    let vo = findItemInQ($scope.selectedNode.data.item.linkId);
                    let parentItem = vo.item;
                    if (parentItem) {
                        parentItem.item = parentItem.item || []
                        parentItem.item.push(newItem);
                    }
                    /*
                    $scope.Q.item.forEach(function(qItem){
                        if (qItem.linkId == $scope.selectedNode.data.item.linkId) {
                            // add to the 'parents' items node
                            qItem.item = qItem.item || []
                            qItem.item.push(newItem);
                            console.log($scope.Q)
                        }

                    })
                    */
                }

                $scope.treeData = makeTreeData($scope.Q);
                drawTree();
                makeTable();
                $scope.expandAll();
            })
        }

        //the item is ready to be added to an existing group
        $scope.addNewItemDEP = function(){

            //let qItem = $scope.selectedNode.data.item;      //the questionnaire item object

            $scope.Q.item.forEach(function(qItem){
                if (qItem.linkId == $scope.selectedNode.data.item.linkId) {

                    //create the new Q item
                    let item = {};
                    item.text = $scope.input.newItemText;
                    item.type = $scope.input.newItemType;
                    item.linkId = 'id' + new Date().getTime();

                    //and add to the 'parent' children node
                    qItem.item = qItem.item || []
                    qItem.item.push(item);
                    console.log($scope.Q)
                    $scope.treeData = makeTreeData($scope.Q);
                }

            })



            delete $scope.input.currentAction;

            drawTree();
            $scope.expandAll();

        };

        //delete the indicated item
        $scope.deleteItem = function(deleteItem) {


            let vo = findItemInQ(deleteItem.linkId);
            if (vo.parent && vo.index > -1) {
                vo.parent.item.splice(vo.index,1)
            }
/*
            $scope.Q.item.forEach(function(groupItem){
                let groupId = groupItem.linkId;
                if (groupItem.item) {
                    let deleteInx = -1;
                    groupItem.item.forEach(function (item,inx) {
                        if (item.linkId == deleteItem.linkId) {
                            //this is the one to delete
                            deleteInx = inx;
                        }
                    });

                    if (deleteInx > -1) {
                        console.log('del')
                        groupItem.item.splice(deleteInx,1)
                    }
                }
//now see if the deleteInx has been set - if so then we know which one to delete

            });
            */
            $scope.treeData = makeTreeData($scope.Q);
            drawTree();
            $scope.expandAll();
            //console.log(item);
        };

        $scope.moveItem = function(moveItem,dirn) {
            move(moveItem,dirn)
           /* let vo = findItemInQ(moveItem.linkId);
            if (vo.parent) {
                if (dirn == 'up' && (vo.index > 0)) {
                    //console.log('move');
                    let ar = vo.parent.item.splice(vo.index,1);
                    vo.parent.item.splice(vo.index-1,0,ar[0])
                }

                if (dirn == 'dn' && (vo.index < vo.parent.item.length -1) ) {
                    //console.log('move');
                    let ar = vo.parent.item.splice(vo.index,1);
                    vo.parent.item.splice(vo.index+1,0,ar[0])
                }

            }

            $scope.Q.item.forEach(function(groupItem){
                let groupId = groupItem.linkId;
                if (groupItem.item) {
                    let moveInx = -1;
                    groupItem.item.forEach(function (item,inx) {
                        if (item.linkId == moveItem.linkId) {
                            //this is the one to move
                            moveInx = inx;
                        }
                    });

                    if (dirn == 'up' && (moveInx > 0)) {
                        //console.log('move');
                        let ar = groupItem.item.splice(moveInx,1);
                        groupItem.item.splice(moveInx-1,0,ar[0])
                    }

                    if (dirn == 'dn' && (moveInx < groupItem.item.length -1) ) {
                        //console.log('move');
                        let ar = groupItem.item.splice(moveInx,1);
                        groupItem.item.splice(moveInx+1,0,ar[0])
                    }

                }


            });
            */
            updateAfterEdit();
            //$scope.treeData = makeTreeData($scope.Q);
           // drawTree();
           // $scope.expandAll();
            //console.log(item);
        };

        //add a new group. I think a modal dialog may be better...
        $scope.addGroup = function() {
            editGroup();
            /*
            let name = $window.prompt("What is the group text")
            if (name) {
                let group = {};
                group.text = name;
                group.type = 'group';
                group.linkId = 'id' + new Date().getTime();
                $scope.Q.item.push(group)
                $scope.treeData = makeTreeData($scope.Q);
                drawTree();
                $scope.expandAll();
                */
           // }
        };

        $scope.editGroup = function(group) {
            for (const groupItem of $scope.Q.item) {
                if (groupItem.linkId == group.linkId) {
                    editGroup(groupItem);
                    break;
                }
            }

            $scope.Q.item.forEach(function(groupItem,inx) {

                if (groupItem.linkId == editGroup.linkId) {
                    groupItem.text = text
                }
            });

            /*
            let text = $window.prompt("What is the new group text",editGroup.text)
            if (text) {
                $scope.Q.item.forEach(function(groupItem,inx) {

                    if (groupItem.linkId == editGroup.linkId) {
                        groupItem.text = text
                    }
                });
                $scope.treeData = makeTreeData($scope.Q);
                drawTree();
                $scope.expandAll();
            }
            */
        };

        function editGroup(group) {
            $uibModal.open({
                backdrop: 'static',      //means can't close by clicking on the backdrop.
                keyboard: false,       //same as above.
                //size: 'lg',
                templateUrl: 'modalTemplates/qGroup.html',
                controller: function($scope,currentGroup){
                    //$scope.newOptionsType = ['display','boolean','decimal','integer','date','datetime','string','text','choice','quantity']
                    $scope.input = {};

                    console.log(currentGroup)

                    let newGroup = {};
                    newGroup.linkId = 'id' + new Date().getTime();
                    newGroup.type = 'group';
                    //$scope.input.newItemType = 'string'
                    //if editing
                    if (currentGroup) {

                        //$scope.input.ValueSet = currentItem.answerValueSet;

                        $scope.input.text = currentGroup.text
                        newGroup.linkId = currentGroup.linkId;
                        if (currentGroup.code) {
                            //assume only 1 code
                            $scope.input.code = currentGroup.code[0].code;
                            $scope.input.system = currentGroup.code[0].system;

                        }
                    }
                    //$scope.item = currentItem;

                    $scope.save=function(){
                        newGroup.text = $scope.input.text;
                        //newGroup.type = $scope.input.newItemType;
                        newGroup.repeats = $scope.input.repeats;

                        if ($scope.input.code) {
                            newGroup.code=[{system:$scope.input.system,code:$scope.input.code}]
                        }
                        $scope.$close(newGroup)
                    }
                }, resolve : {
                    currentGroup : function(){
                        return group;
                    }
                }
            }).result.then(function(newGroup){
                if (group) {
                    //editing
                    group.text = newGroup.text;
                    group.repeats = newGroup.repeats;
                    group.code = newGroup.code;

                    $scope.selectedNode.data.item = group;  //so the current display is updated

                } else {
                    //new
                    //want to add as a child to the currently selected item
                    let vo = findItemInQ($scope.selectedNode.data.item.linkId);
                    let parentItem = vo.item    //could also use node.id
                    if (parentItem) {
                        parentItem.item = parentItem.item || []
                        parentItem.item.push(newGroup)
                    } else {
                        console.log('item not found with linkId '+$scope.selectedNode.data.item.linkId)
                    }


                    //$scope.Q.item.push(newGroup)
                    /*
                    $scope.Q.item.forEach(function(qItem){
                        if (qItem.linkId == $scope.selectedNode.data.item.linkId) {
                            // add to the 'parents' items node
                            qItem.item = qItem.item || []
                            qItem.item.push(newItem);
                            console.log($scope.Q)
                        }

                    }) */
                }

                $scope.treeData = makeTreeData($scope.Q);
                drawTree();
                makeTable();
                $scope.expandAll();
            })
        }

        $scope.moveGroup = function(moveGroup,dirn) {
            move(moveGroup,dirn)
      /*      let moveInx = -1;


            $scope.Q.item.forEach(function(groupItem,inx) {

                if (moveGroup.linkId == groupItem.linkId) {
                    moveInx = inx
                }

            });
            if (dirn == 'up' && (moveInx > 0)) {
                let ar = $scope.Q.item.splice(moveInx,1)
                $scope.Q.item.splice(moveInx-1,0,ar[0])
            }

            if (dirn == 'dn' && (moveInx < $scope.Q.item.length -1)) {
                let ar = $scope.Q.item.splice(moveInx,1)
                $scope.Q.item.splice(moveInx+1,0,ar[0])
            }

            $scope.treeData = makeTreeData($scope.Q);
            drawTree();
            $scope.expandAll();
*/
        };

        function move(item,dirn) {
            let vo = findItemInQ(item.linkId);

            //set the parent to the root if not found. The item will be directly off the root...
            if (!vo.parent) {
                vo.parent = $scope.Q;
            }

           // if (vo.parent) {
                if (dirn == 'up' && (vo.index > 0)) {
                    //console.log('move');
                    let ar = vo.parent.item.splice(vo.index,1);
                    vo.parent.item.splice(vo.index-1,0,ar[0])
                }

                if (dirn == 'dn' && (vo.index < vo.parent.item.length -1) ) {
                    //console.log('move');
                    let ar = vo.parent.item.splice(vo.index,1);
                    vo.parent.item.splice(vo.index+1,0,ar[0])
                }

                updateAfterEdit()
           // }
        }

        $scope.deleteGroup = function(deleteGroup){
            let vo = findItemInQ(deleteGroup.linkId);
            if (vo.parent && vo.index > -1) {
                vo.parent.item.splice(vo.index,1)
                updateAfterEdit()
            }
        };


        function updateAfterEdit(){
            $scope.treeData = makeTreeData($scope.Q);
            drawTree();
            $scope.expandAll();
        }

        //find an item in the Q based on the linkId
        function findItemInQ(linkId) {

            let selectedItem,selectedParent,selectedIndex;

            processItem($scope.Q.item);

            return {item:selectedItem,parent:selectedParent,index:selectedIndex};

            function processItem(item,parent) {
                var index = -1;
                for (const child of item) {
                    index++;
                    if (child.linkId == linkId) {
                        selectedItem = child;
                        selectedParent = parent;
                        selectedIndex = index;
                        break;
                    }
                    if (child.item) {
                        processItem(child.item,child)
                    }
                }
            }


        }


        //create the tree array from a Questionnaire. Assume 2 level only (for now). Make recursive if gets more complex...
        function makeTreeData (Q) {
            let ar = [];
            let rootNode = {id:'root',text:'root',parent:'#',data:{type:'root'}}
            ar.push(rootNode);

            processItem(rootNode,Q.item,)

            function processItem(parentNode,inItem) {
                inItem.forEach(function(item){

                    //this is a top level group node...
                    let node = {id:item.linkId,text:item.text,parent:parentNode.id,data:{item:item}};

                    if (item.repeats) {
                        node.text += ' *'
                    }

                    ar.push(node);

                    //now process any children
                    if (item.item ) {
                        processItem(node,item.item)
                        /*
                        item.item.forEach(function(child){
                            let node = {id:child.linkId,text:child.text,parent:item.linkId,data:{item:child}};
                            ar.push(node)
                        })
                        */
                    }


                });


            }
            /*
            Q.item.forEach(function(item){

                //this is a top level group node...
                let node = {id:item.linkId,text:item.text,parent:'root',data:{item:item}};

                if (item.repeats) {
                    node.text += ' *'
                }

                ar.push(node);

                //now process any children
                if (item.item ) {
                    item.item.forEach(function(child){
                        let node = {id:child.linkId,text:child.text,parent:item.linkId,data:{item:child}};
                        ar.push(node)
                    })
                }


            });

            */
            return ar;
        }

        function makeTreeDataSAVE (Q) {
            let ar = [];
            ar.push({id:'root',text:'root',parent:'#',data:{type:'root'}});
            Q.item.forEach(function(item){

                //this is a top level group node...
                let node = {id:item.linkId,text:item.text,parent:'root',data:{item:item}};

                if (item.repeats) {
                    node.text += ' *'
                }

                ar.push(node);

                //now process any children
                if (item.item ) {
                    item.item.forEach(function(child){
                        let node = {id:child.linkId,text:child.text,parent:item.linkId,data:{item:child}};
                        ar.push(node)
                    })
                }


            });
            return ar;
        }


        //create a table view of the form - just for display
        function makeTable() {
            $scope.table = []
            $scope.Q.item.forEach(function(group){
                let row = {group:group.text}
                $scope.table.push(row)
                 if (group.item) {
                     group.item.forEach(function (item) {
                         let row = {text:item.text,type:item.type,code:item.code,repeats: item.repeats}
                         $scope.table.push(row)
                     })
                 }
            })
            console.log($scope.table)
            //also make the sample QR
            $scope.sampleQR = formSvc.makeQR($scope.Q)

        }

        //load tree. THis will retrieve the Questionnaire and construct the internal model

        function loadTreeDFEP() {



               if ($localStorage.Q) {
                console.log('hit');
                $scope.Q = $localStorage.Q
            } else {
                   //test Q
                   $scope.Q = {resourceType:'Questionnaire',status:'draft',name:'test form', item:[]};
                   $scope.Q.item.push({linkId:'group1',type:'group',text:'group1'});
                   $scope.Q.item.push({linkId:'group2',type:'group',text:'group2'});


                   $localStorage.Q = $scope.Q;

            }
        }


        function drawTree() {

            $('#tree').jstree('destroy');
            $('#tree').jstree(
                {'core': {'multiple': false, 'data': $scope.treeData, 'themes': {name: 'proton', responsive: true}}}
            ).on('changed.jstree', function (e, data) {
                if (data.node) {
                    $scope.selectedNode = data.node;
                    console.log($scope.selectedNode)
                    console.log($scope.selectedNode.data)
                    $scope.$digest();
                }
            })
        }

    }
);
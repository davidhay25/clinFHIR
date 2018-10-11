angular.module("sampleApp")
    .controller('lmFilterCtrl',
        function ($scope,logicalModelSvc,$timeout,$window,lmFilterSvc,modalService) {
            $scope.selected= {}
            $scope.input = {}

            var filteredTreeData = [];      //this will ba all the selected treenodes

            $scope.isDirty = false;

            //event fired when a model is selected in the list
            $scope.$on('modelSelected',function(){

                updateListOfChildren();
                console.log($scope.children)
                $scope.input.childEntry = "";

                delete $scope.currentChildEntry;
                $scope.selected = {}
                delete $scope.selectedNode;


            })

            function updateListOfChildren() {
                var children = lmFilterSvc.childModelEntries;
                if (children.length > 0) {
                    $scope.children = []
                    children.forEach(function(entry){
                        var id = entry.resource.id;
                        $scope.children.push({display:id,entry:entry})
                    })
                }
            }

            $scope.childSelected = function(vo) {
                //console.log(vo)
                if (! vo) {
                    return;
                }

                if ($scope.isDirty) {
                    var modalOptions = {
                        closeButtonText: "No, I've changed my mind",
                        actionButtonText: 'Yes, they can be discarded',
                        headerText: 'Confirm loading of new model',
                        bodyText: 'Recent changes to the current model will be lost. Are you sure you want to load another'
                    };

                    modalService.showModal({}, modalOptions).then(
                        function (result) {
                            loadChild()
                        }
                    );
                } else {
                    loadChild()
                }


                function loadChild() {
                    lmFilterSvc.setCurrentChildEntry(vo.entry)
                    $scope.currentChildEntry = vo.entry;        //so can hide/show apporpriately

                    //now set the paths that are currently selected
                    $scope.selected = {};
                    var resource = vo.entry.resource;
                    resource.snapshot.element.forEach(function (ed){

                        //need to change the paths to those of the parent...
                        var path = ed.path;
                        var ar = path.split('.');
                        var t = ar[0].split('--');
                        ar[0] = t[0]
                        var path1 = ar.join('.');

                        var pos = findIndexOfPath(path1)
                        if (pos > -1) {
                            $scope.selected[pos] = true;
                        }
                    });

                    createFilteredTreeData()
                    drawFilterTree(filteredTreeData);
                    $scope.isDirty = false;
                }




            };

            $scope.saveFilteredModel = function() {
                lmFilterSvc.updateChild(filteredTreeData).then(
                    function(data) {
                        alert('Filtered model saved')
                        $scope.isDirty = false;
                    },
                    function(err) {
                        console.log(err)
                        alert('There was an error saving the model: '+ angular.toJson(err.data))
                    }
                )
            };

            $scope.addNewChild = function() {



                if ($scope.isDirty) {
                    var modalOptions = {
                        closeButtonText: "No, I've changed my mind",
                        actionButtonText: 'Yes, they can be discarded',
                        headerText: 'Confirm loading of new model',
                        bodyText: 'Recent changes to the current model will be lost. Are you sure you want to load another'
                    };

                    modalService.showModal({}, modalOptions).then(
                        function (result) {
                            addNewChild()
                        }
                    );
                } else {
                    addNewChild()
                }


                function addNewChild() {
                    var newName = $window.prompt('Enter Name  (no spaces)');
                    if (newName && checkName(newName)) {
                        $scope.currentChildEntry =  lmFilterSvc.addNewChild(newName);
                        //console.log(lmFilterSvc.childModelEntries)
                        updateListOfChildren();
                        $scope.selected = {}

                        createFilteredTreeData()
                        drawFilterTree(filteredTreeData);
                        $scope.isDirty = false;

                    }


                }

                function checkName(name) {
                    if (name.indexOf(" ") > -1) {
                        alert('Name cannot have a space')
                        return false;
                    }
                    if (name.indexOf(".") > -1) {
                        alert('Name cannot have a dot')
                        return false
                    }
                    return true

                }

            };



            $scope.localTableSelect = function(path) {

                $scope.selectNodeFromTable(path);

                //this is to avoid an error when $digest is called when selecting the node
                $timeout(function(){
                    $('#filterTreeView').jstree(true).activate_node(path);

                },200)

            };

            //ensure that the parents and children of all selected nodes are checked
            $scope.updateFilteredModel = function(inx) {
                console.log($scope.selected);

                var element = $scope.treeData[inx];
                var pathJustSelected = element.data.ed.path;


                //if an element was unselected, need to unselect all children. Leave parents alone
                if (! $scope.selected[inx]) {
                    $scope.treeData.forEach(function (item) {
                        try {
                            var p = item.data.ed.path;
                            if (p.startsWith(pathJustSelected)) {       //startsWith is defined in liFilterSvc
                                var pos = findIndexOfPath(p)
                                if (pos > -1) {
                                    $scope.selected[pos] = false;
                                }
                            }

                            createFilteredTreeData()
                            drawFilterTree(filteredTreeData);

                            $scope.isDirty = true;

                        } catch (ex) {
                            //shouldn't really happen...
                            console.log('element with no path')
                        }

                    });

                    return
                }

                //todo ensure that all parents of selected elements are included





                //todo go through every selected element, and ensure that the elements are selected. Brute force - ? needs optimization
                angular.forEach($scope.selected,function(v,k){
                    if (v) {
                        var item = $scope.treeData[k]
                        console.log(item)
                        var path = item.data.ed.path;
                        console.log(path)

                        var ar = path.split('.');

                        //this selects all the parents
                        if (ar.length > 1) {
                            for (var i=0; i < ar.length -1;i++) {
                                var p = '';
                                for (var j=0; j < i+1; j++) {
                                    p +=  ar[j] + '.'
                                }

                                p = p.slice(0,-1);
                                console.log(p)
                                var pos = findIndexOfPath(p)
                                if (pos > -1) {
                                    $scope.selected[pos] = true;
                                }
                            }
                        }

                        //this selects all the children. It's simpler than the parents...





                    }
                });

                //now check children. We only do this for the element just selected


                $scope.treeData.forEach(function (item) {
                    try {
                        var p = item.data.ed.path;
                        if (p.startsWith(pathJustSelected)) {       //startsWith is defined in liFilterSvc
                            var pos = findIndexOfPath(p)
                            if (pos > -1) {
                                $scope.selected[pos] = true;
                            }
                        }
                    } catch (ex) {
                        //shouldn't really happen...
                        console.log('element with no path')
                    }

                })




                //construct a copy of treeView with only the selected elements.
                createFilteredTreeData()
                drawFilterTree(filteredTreeData);

                $scope.isDirty = true;

            };


            function createFilteredTreeData() {
                filteredTreeData.length = 0;
                angular.forEach($scope.treeData,function(item,inx){        //$scope.treeData from the parent scope
                    if ($scope.selected[inx]) {
                        filteredTreeData.push(item)
                    }
                });

                filteredTreeData.forEach(function (item) {
                    item.state.opened = true;
                })

            }

            //find the index position of a given path. This is a brute force approach - may need to refactor for perfromance
            function findIndexOfPath(path) {
                try {
                    for (var i=0; i<$scope.treeData.length;i++) {
                        var item = $scope.treeData[i];
                        if (item.data.ed.path == path) {
                            return i;
                            break;
                        }
                    }
                } catch (ex) {
                    //shouldn't ever happen...
                    console.log(ex)
                    return 0
                }


            }


            function drawFilterTree(treeData) {

                //not sure about this...  logicalModelSvc.resetTreeState($scope.treeData);    //reset the opened/closed status to the most recent saved...

                $('#filterTreeView').jstree('destroy');
                $('#filterTreeView').jstree(
                    {'core': {'multiple': false, 'data': treeData, 'themes': {name: 'proton', responsive: true}}}
                ).on('changed.jstree', function (e, data) {

                    if (data.node) {
                        console.log(data.node)
                        $scope.selectNodeFromTable(data.node.data.path)

                        $scope.$apply();       //as the event occurred outside of angular...
                    }



                }).on('redraw.jstree', function (e, data) {
/*
                    //ensure the selected node remains so after a redraw...
                    if ($scope.treeIdToSelect) {
                        $("#filterTreeView").jstree("select_node", "#"+$scope.treeIdToSelect);
                        delete $scope.treeIdToSelect
                    }
*/
                }).on('open_node.jstree',function(e,data){
/*
                    //set the opened status of the scope property to the same as the tree node so we can remember the state...
                    $scope.treeData.forEach(function(node){
                        if (node.id == data.node.id){
                            node.state.opened = data.node.state.opened;
                        }
                    });
                    $scope.$digest(); */

                }).on('close_node.jstree',function(e,data){
/*
                    //set the opened status of the scope propert to the same as the tree node so we can remember the state...
                    $scope.treeData.forEach(function(node){
                        if (node.id == data.node.id){
                            node.state.opened = data.node.state.opened;
                        }
                    })
                    $scope.$digest();

                    */
                });


            }


        });
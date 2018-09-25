angular.module("sampleApp")
    .controller('lmFilterCtrl',
        function ($scope,logicalModelSvc,$timeout) {
            $scope.selected= {}


            $scope.saveFilteredModel = function() {
                alert('This will save the filtered model as another logical model');
            }

            $scope.localTableSelect = function(path) {

                $scope.selectNodeFromTable(path);

                //this is to avoid an error when $digest is called when selecting the node
                $timeout(function(){
                    $('#filterTreeView').jstree(true).activate_node(path);

                },200)



            };

            $scope.updateFilteredModel = function(inx) {
                console.log($scope.selected);

                //todo ensure that all parents of selected elements are included
                var element = $scope.treeData[inx];



                //todo go through every selected element, and ensure that the elements are selected. Brute force - ? needs optimization

                angular.forEach($scope.selected,function(v,k){
                    if (v) {
                        var item = $scope.treeData[k]
                        console.log(item)
                        var path = item.data.ed.path;
                        console.log(path)

                        var ar = path.split('.');
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

                    }
                });



                //construct a copy of treeView with only the selected elements.

                var filteredTreeData = [];
                angular.forEach($scope.treeData,function(item,inx){        //$scope.treeData from the parent scope
                    if ($scope.selected[inx]) {
                        filteredTreeData.push(item)
                    }
                })

                filteredTreeData.forEach(function (item) {
                    item.state.opened = true;
                })

                drawFilterTree(filteredTreeData);

//console.log(element.id)
               // $('#filterTreeView').jstree(true).select_node(element.id);


            };


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
//changed
                    if (data.node) {
                        console.log(data.node)
                       // $scope.selectedNode = data.node;
                       // $scope.selectedED = logicalModelSvc.getEDForPath($scope.SD,data.node)

                        //console.log($scope.selectedED)


                       // $scope.$parent.selectNodeFromTable(data.node.data.path)
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
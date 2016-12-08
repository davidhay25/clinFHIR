
angular.module("sampleApp")
    .controller('mapperCtrl',
        function ($scope,$http,appConfigSvc,$q,GetDataFromServer,logicalModelSvc) {

            $scope.input = {};
            $scope.selectedModel = {};
            $scope.selectedModelTree = {};
            $scope.selectedNode = {};
            $scope.maps = [];       //collection of maps...
            

            $scope.conformanceServer = appConfigSvc.getCurrentConformanceServer();


            $scope.$on('nodeSelected',function(event,data){
                delete $scope.selectedMap;
                var srcElement = $scope.selectedNode['src']
                var targElement = $scope.selectedNode['targ']

                if (srcElement && targElement) {
                    for (var i=0; i < $scope.maps.length; i++) {
                        var map = $scope.maps[i];
                        if (map.src == srcElement.data.path && map.targ == targElement.data.path) {
                            $scope.selectedMap = map;
                            break;
                        }
                    }

                    if (! $scope.selectedMap) {
                        var newMap = {src:srcElement.data.path,targ:targElement.data.path};
                        $scope.maps.push(newMap)
                        $scope.selectedMap = newMap;
                    }

                }

            });



            $scope.selectModel = function(dir,model) {
                console.log(dir,model);
                $scope.selectedModel[dir] = model;
                $scope.selectedModelTree[dir] = logicalModelSvc.createTreeArrayFromSD(model);





/*
                var modelToMerge = logicalModelSvc.getModelFromBundle($scope.bundleModels,url);

                if (modelToMerge) {


                    logicalModelSvc.mergeModel($scope.SD, $scope.selectedNode.id, modelToMerge);
                }
                */

                drawTree(dir,$scope.selectedModelTree[dir])





            }

            function drawTree(dir,treeData) {
                var id = '#' + dir + 'TreeView';

                $(id).jstree('destroy');
                $(id).jstree(
                    {'core': {'multiple': false, 'data': treeData, 'themes': {name: 'proton', responsive: true}}}
                ).on('changed.jstree', function (e, data) {
                    //seems to be the node selection event...

                    //console.log(data)
                    if (data.node) {
                        $scope.selectedNode[dir] = data.node;
                        $scope.$broadcast('nodeSelected');
                        $scope.$digest();       //as the event occurred outside of angular...

                    }



                    //used in the html template...




                }).on('redraw.jstree', function (e, data) {


                    //console.log('redraw')
/*
                    if ($scope.treeIdToSelect) {
                        $("#lmTreeView").jstree("select_node", "#"+$scope.treeIdToSelect);

                        // $scope.selectedNode = findNodeWithPath(path)
                        delete $scope.treeIdToSelect
                    }


                    if ($scope.treeData.length > 0) {
                        $scope.$broadcast('treebuilt');
                        $scope.$digest();       //as the event occurred outside of angular...
                    }


                    */
                });


            }


            loadAllModels = function() {

                var url=$scope.conformanceServer.url + "StructureDefinition?kind=logical&identifier=http://clinfhir.com|author";

                //var url="http://fhir3.healthintersections.com.au/open/StructureDefinition?kind=logical&identifier=http://clinfhir.com|author";
                GetDataFromServer.adHocFHIRQueryFollowingPaging(url).then(

                    // $http.get(url).then(
                    function(data) {
                        $scope.bundleModels = data.data
                        $scope.bundleModels.entry = $scope.bundleModels.entry || [];    //in case there are no models

                        $scope.bundleModels.entry.sort(function(ent1,ent2){
                            if (ent1.resource.id > ent2.resource.id) {
                                return 1
                            } else {
                                return -1
                            }
                        })



                    },
                    function(err){
                        alert('Error loading models: ' + angular.toJson(err));
                    }
                )
            };




            loadAllModels();

        });
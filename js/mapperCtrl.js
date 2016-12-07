
angular.module("sampleApp")
    .controller('mapperCtrl',
        function ($scope,$http,appConfigSvc,$q,GetDataFromServer,logicalModelSvc) {

            $scope.input = {};
            $scope.selectedModel = {};
            $scope.selectedModelTree = {};

            $scope.conformanceServer = appConfigSvc.getCurrentConformanceServer();


            $scope.selectModel = function(dir,model) {
                console.log(dir,model);
                $scope.selectedModel[dir] = model;
                $scope.selectedModelTree[dir] = logicalModelSvc.createTreeArrayFromSD(model);
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
                        $scope.selectedNode = data.node;
                    }



                    //used in the html template...

                    $scope.$digest();       //as the event occurred outside of angular...



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
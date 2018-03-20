
angular.module("sampleApp")
    .controller('editLMDocCtrl',
        function ($scope,doc,builderSvc,$timeout) {
            $scope.doc = doc;
            $scope.compositon = doc.entry[0].resource;

            $scope.selectSection = function (sect) {
                $scope.sect = sect;
            };

            $scope.selectResource = function(resource){
                console.log(resource)
                $scope.selectedResource = resource;
            };



            $scope.generateDocTree = function(document){
                console.log(document)
                var treeData = builderSvc.makeDocumentTree(document)
                $('#docTreeView').jstree('destroy');
                $('#docTreeView').jstree(
                    {'core': {'multiple': false, 'data': treeData, 'themes': {name: 'proton', responsive: true}}}
                ).on('select_node.jstree', function (e, data) {
                    console.log(data)
                    delete $scope.currentResource;      //todo - there's a setResource() in the service too...
                    delete $scope.currentPath;
                    if (data.node.data){
                        $scope.selectResource({resource:data.node.data.resource});
                        $scope.currentPath = data.node.data.path;

                    }
                    $scope.$digest()
                })
            };

            //allow time for the DOM to be built...
            $timeout(function(){
                $scope.generateDocTree(doc)
            } ,500)
            console.log('load')
            //$scope.generateDocTree(doc);

        })

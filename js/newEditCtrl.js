/*has been deprectde - don't call make function - expensive! */

angular.module("sampleApp")
    .controller('newEditCtrl',
        function ($scope,$uibModal,newEditSvc,modalService,$http) {

        var url = 'https://stu3.simplifier.net/open/StructureDefinition/8d73d4b7-82c7-4a90-aa32-8966b692926b';
        $http.get(url).then(
            function(data) {
                $scope.profile = data.data;
                console.log($scope.profile)

                //construct the internal representation of the profile...
                newEditSvc.makeInternal($scope.profile).then(
                    function(data) {
                        $scope.internal = data;
                        console.log(data)



                        $scope.currentLogicalResource = {resourceType:'Patient'}
                        buildTree($scope.currentLogicalResource)

                    }
                )

            }
        );

        function selectNode(node) {
            console.log(node);
        }


        function buildTree(resource) {
            var treeData = newEditSvc.buildResourceTree(resource);

            //show the tree structure of this resource version
            $('#builderResourceTree').jstree('destroy');
            $('#builderResourceTree').jstree(
                {'core': {'multiple': false, 'data': treeData, 'themes': {name: 'proton', responsive: true}}}
            ).on('select_node.jstree', function (e, data) {
                console.log(data.node);
                selectNode(data.node);


/*
                delete $scope.displayResourceTreeDeletePath;
                if (data.node.data.level == 1) {
                    //a top level node that can be deleted
                    $scope.displayResourceTreeDeletePath = data.node.data.key;
                }
*/
                $scope.$digest();
            })


        }




            $scope.selectElement = function(element) {
            $scope.selectedElement = element;
        };



        //locate all the children
        function getChildren(el) {

        }


        });

angular.module("sampleApp")
    .controller('makeResourceCtrl',
        function ($scope,$http,appConfigSvc,$q, GetDataFromServer,$uibModal) {


            $scope.treeData = [];
            $scope.possibleChildren = [];
            var dontAdd = ['id','extension','modifierExtension','contained','meta','implicitRules','language','text']

            var url = appConfigSvc.getCurrentConformanceServer().url + "StructureDefinition/NutritionRequest"
            GetDataFromServer.adHocFHIRQuery(url).then(
                function (data) {
                    $scope.profile = data.data;

                    var ed = $scope.profile.snapshot.element[0];
                    var root = {id : 'NutritionRequest',parent : '#', text : 'NutritionRequest', data : {path:'NutritionRequest',ed:ed}}
                    $scope.treeData.push(root)

                    drawTree();
                }
            );


            function drawTree() {
                $scope.treeData.forEach(function (item) {
                    item.state = {opened: true};
                });

                delete $scope.selectedNode;
                $scope.possibleChildren.length = 0;
                delete $scope.selectedEd

                $('#treeView').jstree('destroy');
                $('#treeView').jstree(
                    {'core': {'multiple': false, 'data': $scope.treeData, 'themes': {name: 'proton', responsive: true}}}
                ).on('changed.jstree', function (e, data) {
                    if (data.node) {
                        $scope.selectedNode = data.node;
                        possibleChildren($scope.selectedNode.data.path)
                    }
                    $scope.$digest();       //as the event occurred outside of angular...
                })
            }
            
            //find the permissable children at this point
            function possibleChildren(path) {
                $scope.possibleChildren.length = 0;
                var ar = path.split('.');
                var childLength = ar.length +1;
                $scope.profile.snapshot.element.forEach(function (ed) {
                    var cPath = ed.path;
                    var ar1 = cPath.split('.');
                    if (ar1.length == childLength) {
                        if (cPath.substr(0,path.length)==path) {

                            if (dontAdd.indexOf(lastSegment(cPath)) == -1) {
                                $scope.possibleChildren.push(ed)
                            }



                        }
                    }
                })
                
            }


            //a specific datatype is selected...
            $scope.selectType = function(typ,path) {
                switch (typ.code) {
                    case 'BackboneElement' :
                        var ar = findNodesWithPath(path);
                        if (ar.length == 0 || $scope.selectedEd.max == '*') {
                            var parentId = $scope.selectedNode.id;      //attach to the currently selected node...
                            var arParent = path.split('.');
                            arParent.pop();
                            var id = path + '-' + ar.length;
                            var node = {id:id,parent:parentId,text:lastSegment(path),data:{path:path}}
                            $scope.treeData.push(node)
                            drawTree();
                        } else {
                            alert('Unable to add BBE')
                        }

                        break;
                    case 'Reference' :
                        alert("Can't add a Reference")
                        break;

                    default :
                        getElementValue(typ.code,path);
                        break;

                }

            }


            function getElementValue(dt,path) {
                $uibModal.open({
                    templateUrl: 'modalTemplates/addPropertyInBuilder.html',
                    size: 'lg',
                    controller: 'addPropertyInBuilderCtrl',
                    resolve : {
                        dataType: function () {          //the default config
                            return dt;
                        },
                        hashPath: function () {          //the default config
                            return {path:path,noSave:true}; //<<<<< will just return the value...
                        },
                        insertPoint: function () {          //the point where the insert is to occur ...
                            return {}
                            //return $scope.currentResource;
                        },
                        vsDetails: function () {          //the default config
                            return $scope.vsDetails;
                        },
                        expandedValueSet: function () {          //the default config
                            return $scope.expandedValueSet;
                        },
                        currentValue : function(){
                            return {};
                        },
                        container : function() {
                            return {};
                        }, resource : function(){
                            return {};
                        }
                    }
                }).result.then(function (data) {
                    console.log(data)

                    switch (dt) {
                        case 'Identifier' :
                            var ident = data.identifier;

                            var elementName = lastSegment(path);
                            var parentElement = addNode($scope.selectedNode,elementName,ident.system)

                            addNode(parentElement,'system',ident.system)
                            addNode(parentElement,'value',ident.value)

                            drawTree();


                            break;
                    }


                })
            }

            function addNode(parent,elementName,value) {
                var parentId = parent.id; //$scope.selectedNode.id;      //attach to the currently selected node...
                var id = parentId + '-' + elementName;
                var node = {id:id,parent:parentId,text:elementName,data:{path:'x'}}
                $scope.treeData.push(node)
                return node;
            }

            function findNodesWithPath(path) {
                var ar = []
                $scope.treeData.forEach(function (node) {
                    if (node.data.path == path) {
                        ar.push(node)
                    }
                })
                return ar;
            }

            $scope.selectChild = function(ed) {
                $scope.selectedEd = ed;
            }


            function lastSegment(path) {
                var ar = path.split('.');
                return ar[ar.length-1]
            }

            function makeJson() {

            }


    })
        .filter('lastName', function() {
            return function(path) {
                var ar = path.split('.');
                return ar[ar.length-1];
            }
});

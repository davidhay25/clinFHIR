/*has been deprectde - don't call make function - expensive! */

angular.module("sampleApp")
    .controller('mmCtrl',
        function ($scope,$rootScope,$timeout,profileCreatorSvc) {


            $rootScope.$on('profileSelected',function(event,profile){
                //console.log(profile)
                var nodes,edges, arEdges=[];
                profileCreatorSvc.makeProfileDisplayFromProfile(profile).then(
                    function(data) {
                        //console.log(data)
                        //create the array for the graph
                        var arNodes = [];
                        var objNodes = {};

                        //create the nodes
                        data.treeData.forEach(function (item,inx) {
                            objNodes[item.id] = inx;

                            //var ar = item.path.split('.');

                            //var node = {id:inx,label:item.path,shape:'box'};
                            var node = {id:item.id,label:item.text,shape:'box',color:'#FFFCCF'};
                            if (item.data) {
                                node.ed = item.data.ed;
                            }

                            arNodes.push(node)
                        });
                        
                        nodes = new vis.DataSet(arNodes);
                        
                        //create the edges
                        data.treeData.forEach(function (item,inx) {
                            var parentId = item.parent;
                            if (parentId !== '#') {


                                arEdges.push({from:item.id, to: parentId})
                            }

                           // var node = {id:inx,label:item.path,shape:'box'};
                           // arNodes.push(node)
                        });

                        edges = new vis.DataSet(arEdges);
                        var graphData = {
                            nodes: nodes,
                            edges: edges
                        };

                        //console.log(graphData);

                        var options = {
                            layout: {
                                hierarchical: {
                                    direction: "UD",
                                    sortMethod: "hubsize"
                                }
                            },
                            interaction: {dragNodes :false},
                            physics: {
                                enabled: false
                            }
                        };
                        var optionsDP = {
                            layout: {
                                hierarchical: {
                                    direction: "UD",
                                    sortMethod: "directed"
                                }
                            }
                        };

                        var container = document.getElementById('mmDiv');
                        $scope.network = new vis.Network(container, graphData, options);

                        $scope.network.on("click", function (obj) {
                            // console.log(obj)
                            var nodeId = obj.nodes[0];  //get the first node
                            console.log(nodeId,graphData)
                            var node = graphData.nodes.get(nodeId);
                            //console.log(node);
                            $scope.selectedGraphNode = graphData.nodes.get(nodeId);
                            console.log($scope.selectedGraphNode)
                            $scope.$digest();
                        });

                    }
                );
                
            });

            $rootScope.$on('redrawMindMap',function(event,profile){
                //console.log('redraw')
                $timeout(function(){
                    $scope.network.fit();
                },500            )


            });


        });
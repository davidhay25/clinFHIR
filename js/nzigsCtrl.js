angular.module("sampleApp")
    .controller('nzigsCtrl',
        function ($scope,$http,nzigsSvc) {

            nzigsSvc.getProfiles().then(
                function(data) {
                    $scope.profiles = data.data.profiles;
                    $scope.IGs = data.data.IGs;
                    makeProfilesGraph($scope.profiles)
                }
            )

            //$scope.profiles = nzigsSvc.getProfiles();   //all the known profiles


            function makeProfilesGraph(profiles) {
                let vo = nzigsSvc.makeProfilesGraph(profiles);
                console.log(vo.errors)
                var container = document.getElementById('profilesGraph');
                var graphOptions = {
                    physics: {
                        enabled: true,
                        barnesHut: {
                            gravitationalConstant: -10000,
                        }
                    }
                };

                $scope.profilesGraph = new vis.Network(container, vo.graphData, graphOptions);
                $scope.profilesGraph.on("click", function (obj) {

                    var nodeId = obj.nodes[0];  //get the first node


                    var node = vo.graphData.nodes.get(nodeId);
                    $scope.selectedProfile = node.profile;
                    // $scope.selectedNode = node;



                    $scope.$digest();
                });
            }



        }
    );
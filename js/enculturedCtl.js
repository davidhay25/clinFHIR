
angular.module("sampleApp")
    .controller('enculturedCtrl',
        function ($scope,enculturedSvc,$timeout) {
            $scope.input = {}
            $scope.nodes = []       //array of all nodes

            $scope.genres = ["adventurous","serious","playful","horror"]
            $scope.input.genre = $scope.genres[0]

            $scope.environments = ["modern","medieval","scifi"]
            $scope.input.environment = $scope.environments[0]

            $scope.startStory = function (seed) {
                let node = enculturedSvc.getStartNode(seed)
                $scope.nodes.push(node)
                $scope.currentNode = node
                $scope.story = enculturedSvc.makeFullStory(node,$scope.nodes)
            }

            //start a new story from this node
            $scope.newStory = function (node) {
                $scope.currentNode = node
                $scope.story = enculturedSvc.makeFullStory(node,$scope.nodes)

            }

            //when the user has selected a particular choice
            $scope.selectChoice = function (node,choiceIndex) {
                console.log(node,choiceIndex)
                node.userChoiceIndex = choiceIndex //record the choice that the user made

                //get the AI response based on the choice.
                let newNode = enculturedSvc.reactToChoice(node,choiceIndex)
                $scope.nodes.push(newNode)
                $scope.currentNode = newNode
                $scope.story = enculturedSvc.makeFullStory(newNode,$scope.nodes)

                $scope.allStories = enculturedSvc.getStoryNodes($scope.nodes)

                makeGraph(enculturedSvc.makeGraph($scope.nodes))



            }

            let makeGraph = function (graphData) {
                var container = document.getElementById('storyChart');
                var options = {
                    layout: {
                        hierarchical : {
                            sortMethod: 'directed',
                            direction : "DU"
                        }
                    },
                    physics: {
                        enabled: true,
                        barnesHut: {
                            gravitationalConstant: -10000,
                        }
                    }
                };
                $scope.chart = new vis.Network(container, graphData, options);

                $scope.chart.on("click", function (obj) {


                    var nodeId = obj.nodes[0];  //get the first node
                    var node = graphData.nodes.get(nodeId);
                    $scope.selectedNodeFromChart = node;

                    $scope.storyFromThisNode = enculturedSvc.makeFullStory(node.aiNode,$scope.nodes)

                    console.log( $scope.selectedNodeFromChart)
                    $scope.$digest();
                })

            }

            $scope.fitGraph = function(){
                $timeout(function(){
                    if ($scope.chart) {
                        $scope.chart.fit();

                    }

                },500)

            }

            //get the full story from a node
            $scope.showStory = function (node) {
                $scope.oneStory = enculturedSvc.makeFullStory(node,$scope.nodes)
            }


    })

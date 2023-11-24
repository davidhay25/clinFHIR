angular.module("sampleApp")

    .service('enculturedSvc', function() {

        function makeSampleNode(){
            let node = {}   //represenst an interaction
            node.input = ""

        }

        //acts as the id for nodes
        masterCount = 1


        return {
            getStoryNodes : function(nodes) {
                //all nodes that represent a separate story.
                //these are 'leaf' nodes that are not referenced as parents by any other

                let hashParentNodes = {}
                let lstStories = []
                nodes.forEach(function (node) {
                    if (node.parentId) {
                        hashParentNodes[node.parentId] = true
                    }
                })

                nodes.forEach(function (node) {
                    if (!hashParentNodes[node.id]) {
                        lstStories.push(node)
                    }
                })
                return lstStories

            },

            makeFullStory : function (node,nodes) {
                //generate the full story by tracing back the parents of this node

                let story = []  //the full story
                let hashNodes = {}
                //add a new section
                function addSection(node,story) {
                    story.splice(0,0,node)
                    if (node.parentId) {
                        addSection(hashNodes[node.parentId],story)
                    }
                }

                if (node && nodes) {
                    //create a hash by nodeId

                    nodes.forEach(function (node) {
                        hashNodes[node.id] = node
                    })

                    console.log(hashNodes)



                    addSection(node,story)
                }




                return story



            },

            makeGraph : function (nodes) {
                //generate a graph of the nodes
                let arGraphNodes = []
                let arEdges = []


                nodes.forEach(function (node,inx) {
                    let graphNode = {id: node.id, label: node.id,
                        shape: 'box',aiNode:node};
                    arGraphNodes.push(graphNode)

                    if (node.parentId) {
                        let edge = {id: 'e' + arEdges.length +1,
                            from: node.id,
                            to: node.parentId,
                            //label: "",
                            arrows : {from:true}}
                        arEdges.push(edge)
                    }

                })


                let graphData = {nodes: new vis.DataSet(arGraphNodes),edges: new vis.DataSet(arEdges)}

                console.log(arGraphNodes,arEdges)
                return graphData

                //let edges = new vis.DataSet(arEdges);
                //let nodes = new vis.DataSet(arGraphNodes);


            },
            getStartNode : function(seedText){
                //represents the start of the conversation
                let node = {}
                node.id = masterCount++
                node.userText = seedText    //the text supplied by the user
                node.aiText = "This is the text that the AI created from the seed text"
                //node.aiChoices = ["choice1","choice2","choice3"] //the list of choices supplied by the AI
                node.aiChoices = [`node${node.id}-choice1`,`node${node.id}-choice2`,`node${node.id}-choice3`] //the list of choices supplied by the AI

                return node


            },
            reactToChoice : function(node,choiceIndex){
                //when the user has made a choice from the selection

                let newNode = {}    //the node that the AI will create based on the choice
                newNode.id = masterCount++
                newNode.parentId = node.id  //the node from which the choice was made
                newNode.aiText = `AI text based on choice "${node.aiChoices[choiceIndex]}" from node ${node.id}`
                newNode.aiChoices = [`node${newNode.id}-choice1`,`node${newNode.id}-choice2`,`node${newNode.id}-choice3`] //the list of choices supplied by the AI
                return newNode


            }
        }
    })

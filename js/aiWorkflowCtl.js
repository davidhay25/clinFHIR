angular.module("sampleApp")
    .controller('aiWorkflowCtrl',
        function ($scope,$http,$timeout, v2ToFhirSvc,aiAssistantSvc,$uibModal) {

            let networkGraph        //a reference to the network graph so it can be destroyed
            //reset the state after a cancel
            $scope.reset = function () {

                for (let wf of $scope.allWorkflows) {
                    if (wf.key == $scope.input.lastSelectedWorkflow?.key) {
                        $scope.input.selectedWorkflow = wf
                        break
                    }
                }
                $scope.input.state = 'showWorkflow'
            }

            //load all the workflows. Note that the steps are stored in the workflow are part of the
            //object, but the conversations associated with them are separate entries
            function getWorkflowList() {

                $scope.allWorkflows = []

                localforage.iterate(function(value, key) {

                    //console.log(key)
                    if (key.startsWith('aiWorkflow')) {
                        $scope.allWorkflows.push(value)
                    }

                }).then(function() {
                    //console.log('Workflow Iteration has completed');

                    //now load the last app state if any so we can reload that state. This allows a user
                    //to view the bundle and return to the same place in the app

                    localforage.getItem('aiCurrentState').then(function(value) { //get the key for the current conversation
                        //console.log(value)
                        if (value?.workflowKey) {
                            $scope.input.selectedWorkflow = $scope.allWorkflows.find(item => item.key == value.workflowKey)
                            for (let step of $scope.input.selectedWorkflow?.steps || []) {
                                if (step.conversationKey == value?.conversationKey) {
                                    $scope.selectStep(step)
                                    break
                                }
                            }

                        } else {
                            //no previous workflow - select the first
                            if ($scope.allWorkflows.length > 0) {
                                $scope.input.selectedWorkflow = $scope.allWorkflows[0]
                                $scope.input.lastSelectedWorkflow = $scope.input.selectedWorkflow
                            }
                        }
                        $scope.input.state = 'showStep'
                        //$scope.$evalAsync()
                       // $scope.input.selectedWorkflow = value.
                    })





                    $scope.$evalAsync()
                }).catch(function(err) {
                    // This code runs if there were any errors
                    console.log(err);
                });

            }

            getWorkflowList()



            /* temp
            localforage.getItem('aiCurrentWorkflowKey').then(function(value) { //get the key for the current conversation
                console.log(value)
                if (value) {
                    //there is a current conversation so retrieve that into $scope.
                    $scope.currentConversationKey = value   //eg aiConversation-xxx
                    localforage.getItem($scope.currentConversationKey).then(function(value) {
                        if (value) {
                            $scope.currentConversation = value
                        } else {
                            //there is a 'current key' but no previous conversation so create it.
                            $scope.currentConversation = {key:$scope.currentConversationKey,date:new Date(), messages:[]}
                        }
                        $scope.$evalAsync()
                    }).catch(function(err) {
                        alert(angular.toJson(err))
                    })
                } else {
                    //this is the first time - or there was a previous new conversation but nothing was saved
                    $scope.currentConversationKey = `aiConversation-${new Date().getTime()}`
                    $scope.currentConversation = {key:$scope.currentConversationKey,date:new Date(), messages:[]}


                    //updat ethe db with the new key
                    localforage.setItem('aiCurrentConversationKey', $scope.currentConversationKey).catch(function(err) {
                        alert(angular.toJson(err))
                    });
                }

            }).catch(function(err) {
                alert(angular.toJson(err))
            })

            */


            //save the currently selected workflow and step within that workflow so can return
            //when the assistant is loaded
            function saveCurrentState() {
                let appState = {mode:'workflow',workflowKey : $scope.input.selectedWorkflow?.key,conversationKey:  $scope.input.selectedStep?.conversationKey}

                localforage.setItem("aiCurrentState", appState)
            }

            // ------- summary routines
            $scope.refreshSummary = async function () {
                //rebuild the summary of all resources


                $scope.resourceSummary = aiAssistantSvc.makeResourceDifferencesSummary(await makeWorkflowSummary())
                console.log($scope.resourceSummary)
                $scope.input.state = 'resourceHistory'
                $scope.$evalAsync()
            }
            
            $scope.selectResourceFromSummary = function (resource) {
                $scope.stepsForSelectedResource = $scope.resourceSummary.hashResource[resource.id]?.steps

                if ($scope.stepsForSelectedResource.length > 1) {
                    for (let inx = 1; inx < $scope.stepsForSelectedResource.length; inx++) {
                        let r1 = $scope.stepsForSelectedResource[inx-1].resource
                        let r2 = $scope.stepsForSelectedResource[inx].resource
                        let diff = aiAssistantSvc.differenceBetweenResources(r1,r2)
                        console.log(diff)
                        $scope.stepsForSelectedResource[inx].diff = diff
                    }


                }




                
            }
            
            //-------------

            //when a wf is selected, load the full workflow
            $scope.selectWorkflow = function (wf) {
                //$scope.input.selectedWorkflow has been set (it's the model of the dropdown).
                saveCurrentState()
                $scope.input.state = 'showWorkflow'
                $scope.input.lastSelectedWorkflow = $scope.input.selectedWorkflow

            }


            //flag to add a new workflow
            $scope.addWorkflowDEP = function () {
                $scope.input.lastSelectedWorkflow = $scope.input.selectedWorkflow
                delete $scope.input.selectedWorkflow
                $scope.input.state = "newWorkflow"
            }

            //save a new workflow to the list and make current
            $scope.saveWorkflowDEP = function () {

                delete $scope.input.selectedStep

                let key = `aiWorkflow-${new Date().getTime()}`
                let wf = {key:key,title:$scope.input.newWfTitle,description:$scope.input.newWfDescription}
                wf.steps = []

                localforage.setItem(key, wf).then(function () {
                    alert("Workflow has been saved")
                    $scope.allWorkflows.push(wf)
                    $scope.input.selectedWorkflow = wf
                    $scope.input.lastSelectedWorkflow = wf

                    $scope.input.scope = "showWorkflow"
                    saveCurrentState()      //for when app is reloaded
                    $scope.$evalAsync()
                }).catch(function(err) {
                    alert(err)
                });

                $scope.input.state = 'showWorkflow'

            }

            $scope.selectStep = function (step) {

                delete $scope.selectedWfConversation
                delete $scope.latestBundle
                delete $scope.input.selectedEntry
                $scope.inputBundle = ""

                //delete $scope.inputbundle
                $scope.input.selectedStep = step
                $scope.input.state = 'showStep'

                //the conversation within this step. the conversation has messages
                if (step.conversationKey) {
                    localforage.getItem(step.conversationKey).then(function(value) {
                        if (value) {
                            $scope.selectedWfConversation = value  // {key, messages[] }
                        } else {
                            //this conversation doesn't exist yet - ie the step is newly created.
                            $scope.selectedWfConversation = {key: step.conversationKey,messages:[]}
                        }
                        $scope.$evalAsync()
                        saveCurrentState()      //for when app is reloaded so that it returns to the same place

                        //console.log(value)


                        //if a basebundle has been selected, and there are no messages in this step so far, pass
                        //in the bundle from that step to add to the AI call
                        //basebundle is the conversationkey of the bundle to act as the base for AI consideration
                        if (step.baseBundle) {
                            localforage.getItem(step.baseBundle).then(function (value) {
                                if (value) {
                                    //console.log(value)
                                    let msg = value.messages[value.messages.length-1]
                                    //console.log(msg.bundle)
                                    $timeout(function () {
                                        $scope.inputBundle = msg.bundle
                                    },1)

                                }

                            })
                        }

                        //now generate the graph of this bundle (if it exists)
                        let bundle
                        for (const message of value?.messages || []) {
                            if (message.bundle) {
                                bundle = message.bundle   //get the latest bundle - the last message might not have one
                                $scope.latestBundle = bundle
                            }
                        }

                        $timeout(function () {
                            if (networkGraph) {
                                networkGraph.destroy()
                            }


                            if (bundle) {
                                drawGraph(bundle)
                            }
                        },1)



                    }).catch(function(err) {
                        alert(angular.toJson(err))
                    })
                }


            }

            function editWorkflow(workflow) {
                $uibModal.open({
                    templateUrl: 'modalTemplates/aiEditWorkflow.html',
                    backdrop: 'static',
                    //size : 'lg',
                    controller: function ($scope,workflow) {

                        $scope.input = {}
                        if (workflow) {
                            //edit
                            $scope.input.newWfDescription = workflow.description
                            $scope.input.newWfTitle = workflow.title
                        }


                        $scope.save = function () {

                            let key = `aiWorkflow-${new Date().getTime()}`
                            let wf = {key:key,title:$scope.input.newWfTitle,description:$scope.input.newWfDescription}
                            wf.steps = []

                            $scope.$close(wf)

                        }
                    },

                    resolve: {
                        workflow: function () {
                            return workflow
                        }
                    }

                }).result.then(function (wf) {

                    localforage.setItem(wf.key, wf).then(function () {
                        alert("Workflow has been saved")
                        $scope.allWorkflows.push(wf)
                        $scope.input.selectedWorkflow = wf
                        $scope.input.lastSelectedWorkflow = wf

                        $scope.input.scope = "showWorkflow"
                        saveCurrentState()      //for when app is reloaded
                        $scope.$evalAsync()
                    }).catch(function(err) {
                        alert(err)
                    });

                    $scope.input.state = 'showWorkflow'

            })}

            $scope.addWorkflow = function () {
                $scope.input.lastSelectedWorkflow = $scope.input.selectedWorkflow
                delete $scope.input.selectedWorkflow
                $scope.input.state = "newWorkflow"
                
                editWorkflow()
            }

            function editStep(step) {
                $uibModal.open({
                    templateUrl: 'modalTemplates/aiEditStep.html',
                    backdrop: 'static',
                    //size : 'lg',
                    controller: function ($scope,step,workflow) {
                        $scope.workflow = workflow
                        $scope.input = {}
                        if (step) {
                            //edit
                            $scope.input.wfStepDescription = step.description
                            $scope.input.wfStepTitle = step.title
                            if (step.baseBundle) { //baseBundle is actually the conversationKey of the event conversation to copy
                                $scope.input.wfStepBaseBundle = workflow.steps.find(step1 => step1.conversationKey == step.baseBundle)
                            }
                        }

                        $scope.clearBB = function () {
                            delete $scope.input.wfStepBaseBundle
                        }

                        $scope.save = function () {
                            //create a new step object regardless of new / update but for update keep the same conversationKey
                            let conversationKey = step?.conversationKey || `aiWfConversation-${new Date().getTime()}`

                            let step = {description:$scope.input.wfStepDescription,
                                title:$scope.input.wfStepTitle,
                                conversationKey:conversationKey}

                            if ($scope.input.wfStepBaseBundle) {
                                step.baseBundle = $scope.input.wfStepBaseBundle.conversationKey
                                step.baseBundleStepTitle = $scope.input.wfStepBaseBundle.title
                            } else {
                                delete step.baseBundle
                                delete step.baseBundleStepTitle
                            }

                            $scope.$close(step)

                        }
                    },

                    resolve: {
                        workflow: function () {
                            return $scope.input.selectedWorkflow
                        },
                        step: function () {
                            return step
                        }
                    }

                }).result.then(function (newStep) {
                    if (step) {
                        //update
                        Object.keys(step).forEach(key => delete step[key]);
                        Object.assign(step, newStep)
                        localforage.setItem($scope.input.selectedWorkflow.key, $scope.input.selectedWorkflow)

                        return

                        let oldStep = $scope.input.selectedWorkflow.steps.find(step => step.conversationKey == newStep.conversationKey)
                        if (oldStep) {
                            Object.assign(oldStep, newStep)
                            localforage.setItem($scope.input.selectedWorkflow.key, $scope.input.selectedWorkflow)
                        }

                    } else {
                        //new
                        //the conversation within the step is saved as a separate indexedDb object with a key in the
                        //step to retrieve it


                        $scope.input.selectedWorkflow.steps = $scope.input.selectedWorkflow.steps || []
                        $scope.input.selectedWorkflow.steps.push(newStep)

                        //update the workflow
                        localforage.setItem($scope.input.selectedWorkflow.key, $scope.input.selectedWorkflow)

                        $scope.selectStep(newStep)

                        /*
                        localforage.setItem($scope.input.selectedWorkflow.key, $scope.input.selectedWorkflow).then(function () {
                            $scope.input.wfStepDescription = ""
                            $scope.input.wfStepTitle = ""

                            $scope.selectStep(newStep)
                        }).catch(function(err) {
                            alert(angular.toJson(err))
                        });
                        */
                    }
                })

            }

            $scope.updateStep = function (step) {
                editStep(step)
            }

            $scope.addStep = function () {
                editStep()

                //temp$scope.input.state='newStep'
               // $scope.input.selectWfTabActive = 0 //ensure conversation tab is showing
            }

            //when the new step details have been entered add to the workflow
            $scope.saveStepDEP = function () {
                //$scope.wfNewStep = false
                //the conversation within the step is saved as a separate indexedDb object with a key in the
                //step to retrieve it
                let conversationKey = `aiWfConversation-${new Date().getTime()}`
                let step = {description:$scope.input.wfStepDescription,title:$scope.input.wfStepTitle,conversationKey:conversationKey}

                if ($scope.input.wfStepBaseBundle) {
                    step.baseBundle = $scope.input.wfStepBaseBundle.conversationKey
                    step.baseBundleStepTitle = $scope.input.wfStepBaseBundle.title
                }

                $scope.input.selectedWorkflow.steps = $scope.input.selectedWorkflow.steps || []
                $scope.input.selectedWorkflow.steps.push(step)

                //update the workflow
                localforage.setItem($scope.input.selectedWorkflow.key, $scope.input.selectedWorkflow).then(function () {
                    $scope.input.wfStepDescription = ""
                    $scope.input.wfStepTitle = ""

                    $scope.selectStep(step)
                }).catch(function(err) {
                    alert(angular.toJson(err))
                });

            }

            //called from the al bundle after a response has been received from the server
            $scope.onAIResponse = function (bundle) {
                drawGraph(bundle)
                $scope.latestBundle = bundle    //used for the list of resources...


            }

            //after re-order of steps to save the updated workflow
            $scope.onStepsReordered = function () {
                localforage.setItem($scope.input.selectedWorkflow.key, $scope.input.selectedWorkflow)
            }

            //invoked when the user wishes to view a bundle
            $scope.bundleFromWF = function (bundle) {
               // console.log(bundle)
                $scope.$close(bundle)

            }


            $scope.makeSummary = function () {
                makeWorkflowSummary().then(function (summary) {
                    $scope.workflowSummary = summary
                })

                $scope.input.state = 'workflowSummary'

            }


            $scope.fitGraph = function () {
                $timeout(function () {
                    if (networkGraph) {
                        //networkGraph.redraw()
                        try {
                            networkGraph.fit()
                        } catch (e) {
                            
                        }
                       
                    }

                },1)

            }

            let drawGraph = function(bundle)  {



                let options = {}
                options.bundle = bundle

                let vo = v2ToFhirSvc.makeGraph1(options);
                let graphData = vo.graphData


                let container = document.getElementById('bundleGraph');

                let graphOptions = {
                    layout : {
                        randomSeed : 42  //means it will be the same each time
                    },
                    physics: {
                        enabled: true,
                        barnesHut: {
                            gravitationalConstant: -10000,
                            centralGravity: 0.3,
                            springLength: 120,
                            springConstant: 0.04,
                            damping: 0.09,
                            avoidOverlap: 0.2
                        },
                        stabilization: {
                            iterations: 200,   // try lowering from default (1000)
                            updateInterval: 25
                        }
                    }
                };

                if (container) {
                    networkGraph = new vis.Network(container, graphData, graphOptions);
                    //$scope.graph['mynetwork'] = network;

                    networkGraph.on("stabilizationIterationsDone", function () {
                        delete $scope.showGraphWarning
                        networkGraph.setOptions( { physics: false } );
                    });

                    networkGraph.on("click", function (obj) {

                        var nodeId = obj.nodes[0];  //get the first node
                        var node = graphData.nodes.get(nodeId);


                        $scope.$digest();
                    });
                    
                }

            }

            $scope.deleteStep = async function () {
                if (confirm("Are you sure you wish to delete this step in the workflow? It cannot be recovered.")) {

                    let conversationKey = $scope.input.selectedStep.conversationKey //this is always assigned - even before the conversation is created

                    $scope.input.selectedWorkflow.steps =
                        $scope.input.selectedWorkflow.steps.filter(item => item.conversationKey !== conversationKey)

                    await localforage.setItem($scope.input.selectedWorkflow.key,$scope.input.selectedWorkflow)


                    delete $scope.input.selectedStep






                }
            }

            $scope.deleteWorkflow = async function () {
                if (confirm("Are you sure you wish to delete this workflow? It cannot be recovered (you may wish to download it first)")){
                    //first delete all the associated conversations
                    for (let step of $scope.input.selectedWorkflow.steps || []) {
                        if (step.conversationKey) {
                            await localforage.removeItem(step.conversationKey)
                        }
                    }
                    await localforage.removeItem($scope.input.selectedWorkflow.key)
                    alert("Workflow has been removed")
                    delete $scope.input.selectedWorkflow

                    //re-read the workflow list
                    $scope.allWorkflows = []
                    localforage.iterate(function(value, key) {
                        if (key.startsWith('aiWorkflow')) {
                            $scope.allWorkflows.push(value)

                        }
                    })

                }
                
            }
            
            $scope.export = function () {
                exportWorkflow()
            }


            async function makeWorkflowSummary() {
                let key = $scope.input.selectedWorkflow.key
                //let obj = angular.copy($scope.input.selectedWorkflow)

                let obj = await localforage.getItem(key);
                for (const step of obj.steps || []) {
                    let cKey = step.conversationKey
                    if (cKey) {
                        const conversation = await localforage.getItem(cKey);
                        step.conversation = conversation
                        delete step.conversationKey

                    }
                }
                return obj
            }

            async function exportWorkflow() {
                let obj = await makeWorkflowSummary()
                /*
                let key = $scope.input.selectedWorkflow.key
                //let obj = angular.copy($scope.input.selectedWorkflow)

                let obj = await localforage.getItem(key);
                for (const step of obj.steps || []) {
                    let cKey = step.conversationKey
                    if (cKey) {
                        const conversation = await localforage.getItem(cKey);
                        step.conversation = conversation
                        delete step.conversationKey

                    }
                }
*/
                let json = angular.toJson(obj)

                //console.log(key,json.length, obj)

                $scope.downloadJson(obj, defaultName = "workflow.json")


            }


            //set up the handlers for importing a workflow
            $timeout(function () {
                // ------------ import
                const input = document.getElementById("jsonInput");

                async function onChange(e) {
                    const file = e.target.files[0];
                    if (!file) return;
                    try {
                        const text = await file.text();
                        const wf = JSON.parse(text);

                        //parse the workflow.
                        //save the conversations from each step.
                        // update all keys
                        wf.key = `aiWorkflow-${new Date().getTime()}`
                        for (let step of wf.steps || []) {
                            let conversation = step.conversation
                            //if there's no conversation just ignore it
                            if (conversation) {
                                conversation.key=`aiWfConversation-${new Date().getTime()}`
                                step.conversationKey = conversation.key
                                await localforage.setItem(conversation.key,conversation)
                                delete step.conversation
                            }

                        }
                        wf.title += ' Imported'
                        await localforage.setItem(wf.key,wf)


                        //add to the list of workflows and display
                        $scope.allWorkflows.push(wf)
                        $scope.input.selectedWorkflow = $scope.allWorkflows[$scope.allWorkflows.length-1]
                        $scope.input.selectedStep = $scope.input.selectedWorkflow.steps?.[0] || {}
                        $scope.input.state = "showWorkflow"
                        saveCurrentState()

                        $scope.$evalAsync(() => {
                            console.log(wf)
                            //$scope.data = result;
                            //$scope.error = null;
                        });
                    } catch (err) {
                        console.log(err)
                        $scope.$evalAsync(() => {
                            alert("Invalid JSON file");
                        });
                    }
                    e.target.value = ""; // allows re-selecting the same file
                }

                input.addEventListener("change", onChange);
                $scope.$on("$destroy", () => input.removeEventListener("change", onChange));
            },1000)



        })
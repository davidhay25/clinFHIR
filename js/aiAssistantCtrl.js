angular.module("sampleApp")
    .controller('aiAssistantCtrl',
        function ($scope,aiAssistantSvc,$interval,$http,$timeout) {

            $scope.input = {}

            $scope.input.showDetailed = {}
            $scope.input.showDetailedHx = {}

            $scope.models = [] // ['Fast (Haiku 5.5)','Medium (Sonnet 5.5)','Slow (Opus 5.5)']
            $scope.models.push({display:"Light but fast (Haiku 5.5)",model:"claude-haiku-5-5"})
            $scope.models.push({display:"Medium (Sonnet 5.5)",model:"claude-sonnet-5-5"})
            $scope.models.push({display:"Thorough but slow (Opus 5.5)",model:"claude-opus-5-5"})

            $scope.input.selectedModel = $scope.models[0]

            //the localforage library must be loaded by the containing page
            //each conversation is a separate model in the db {messages:[]}
            //aiConversation-{key} A specific conversation keyed by a hash oh the first prompt.
            // - the key is the dateTime the conversation was started
            //currentConversationKey - the currently active conversation

            localforage.getItem('aiCurrentConversationKey').then(function(value) { //get the key for the current conversation
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

            //called from the previous conversations. Sets the previous one as the current one.
            $scope.makeCurrentConversation = function (key) {

                localforage.getItem(key).then(function(value) {

                    $scope.currentConversationKey = key   //eg aiConversation-xxx
                    $scope.currentConversation = value

                    localforage.setItem('aiCurrentConversationKey', $scope.currentConversationKey).catch(function(err) {
                        alert(angular.toJson(err))
                    });

                    $scope.input.selectTabActive = 0
                    $scope.$evalAsync()
                }).catch(function(err) {
                    alert(angular.toJson(err))
                })

            }

            function getConversationList() {
                $scope.conversationHistory = []
                localforage.iterate(function(value, key, iterationNumber) {
                    // Resulting key/value pair -- this callback
                    // will be executed for every item in the
                    // database.
                    $scope.conversationHistory
                    if (key.startsWith('aiConversation')) {
                        let vo = {key:key,date:value.date}

                        vo.display="No messages"
                        if (value?.messages.length > 0) {
                            vo.display = value?.messages[0].prompt
                        }
                        vo.count = value?.messages.length

                        $scope.conversationHistory.push(vo)
                    }

                    //console.log(key, value);
                }).then(function() {
                    console.log('Iteration has completed');
                    $scope.$evalAsync()
                }).catch(function(err) {
                    // This code runs if there were any errors
                    console.log(err);
                });
                
            }
            getConversationList()

            $scope.getPreviousConversation = function (key) {
                delete $scope.selectedPreviousConversation
                localforage.getItem(key).then(function(value) {
                    $scope.selectedPreviousConversation = value
                    $scope.selectedPreviousKey = key
                    $scope.$evalAsync()
                }).catch(function(err) {
                    alert(angular.toJson(err))
                })
            }
            
            $scope.newConversation = function () {
                //
                $scope.currentConversationKey = `aiConversation-${new Date().getTime()}`
                $scope.currentConversation = {key:$scope.currentConversationKey,date:new Date(),messages:[]}


                //set the current key. Note that there is not yet anything saved in the db
                localforage.setItem('aiCurrentConversationKey', $scope.currentConversationKey).catch(function(err) {
                    alert(angular.toJson(err))
                })

            }

            $scope.loadBundle = function (bundle) {
                $scope.$close(bundle)
            }

            $scope.sendMessage = function (msg) {
                $scope.loading = true  //we're going to add the current bundle to the message later so kee[ this for the hx
                let userMessage = msg //

                $scope.count = 0;



                let timer = $interval(function() {
                    $scope.count++;
                }, 1000);


                let currentBundle
                
                let messages = [] //this will be the list of messages to send to the AI


                for (let msg of $scope.currentConversation.messages || []) {

                    //first the user query
                    messages.push({role:'user',content:msg.prompt || "Unknown prompt"})
                    //then the response

                    if (msg.bundle) {
                        currentBundle = msg.bundle  //we want to get the latest bundle
                    }

                    let aiReply = {summary:msg.summary, assumptions:msg.assumptions,notes:msg['modelling_notes'],warnings:msg.warnings}
                    messages.push({role:'assistant',content:angular.toJson(aiReply)})
                }


                let newUserMessage = ""
                //if there's a current bundle then include it in the
                if (currentBundle) {
                    newUserMessage = `<requested_change>${angular.toJson(msg)}</requested_change>`
                    newUserMessage += `<current_bundle>${angular.toJson(currentBundle)}</current_bundle>`
                } else {
                    newUserMessage = msg
                }

                //console.log(newUserMessage)

                messages.push({role:'user',content:newUserMessage})

                let vo = {model:$scope.input.selectedModel.model,messages:messages}

                $http.post("ai/bundleBuilder",vo).then(
                    function (data) {
                        console.log(`${$scope.count} seconds`)
                        console.log(data)
                        $interval.cancel(timer);
                        if (data.data.stopReason == 'max_tokens') {
                            alert("This request was too large. Try a smaller prompt ")
                            $scope.loading = false
                            return
                        }

                        $scope.response = data.data.envelope

                        if (! $scope.response) {
                            alert("There was no response. This can be due to variability in the AI processing so you could just try again. Alternatively try a more advanced model (like opus) or a smaller prompt.")
                            $scope.loading = false
                            return
                        }

                        $scope.response.prompt = userMessage    //what the user said
                        $scope.response.usage = data.data.usage
                        $scope.response.tokens =data.data.usage["input_tokens"] + data.data.usage["output_tokens"]
                        $scope.response.time = $scope.count
                        $scope.response.model = $scope.input.selectedModel.model
                        $scope.response.stopReason = data.data.stopReason
                        

                        //update the current conversation
                        $scope.currentConversation.messages.push($scope.response)

                        //now save the updated conversation under the current key
                        localforage.setItem($scope.currentConversationKey, $scope.currentConversation)
                            .then(function() {

                                console.log(`${$scope.currentConversationKey} updated`)
                            }).catch(function(err) {
                            alert(angular.toJson(err))
                        })

                        $scope.loading = false
                        delete $scope.input.message
                        console.log($scope.response)

                    }, function (err) {
                        alert(`There was an unknown error from the server. Cannot create bundle. ${angular.toJson(err)}`)
                    }
                )

            }

            $scope.save = function () {
                $scope.$close($scope.response.bundle)
            }


        })

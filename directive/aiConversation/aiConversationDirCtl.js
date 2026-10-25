angular.module('sampleApp')
    .directive('aiconversation', function () {
        return {
            restrict: 'EA', //E = element, A = attribute, C = class, M = comment
            scope: {
                conversation : '=',
                inputbundle : '=',
                bundleselected : '&',
                airesponse: '&'
            },

            templateUrl: 'directive/aiConversation/aiConversationDir.html',
            controller: function($scope,$http,$interval,umamiSvc){

                let validationServer = "https://hapi.fhir.org/baseR4"

                let updateMessage = "If there is a need to change an existing resource, for example if" +
                    "the status of a workflow resource like ServiceRequest or MedicationRequest needs to" +
                    "change, then be sure to alter the existing resource and retain the id rather than " +
                    "creating a new one."

                $scope.input = {showDetailed:{},showValidation:{}}

                $scope.models = [] // ['Fast (Haiku 5.5)','Medium (Sonnet 5.5)','Slow (Opus 5.5)']
                $scope.models.push({display:"Light but fast (Haiku 5.5)",model:"claude-haiku-5-5"})
                $scope.models.push({display:"Medium (Sonnet 5.5)",model:"claude-sonnet-5-5"})
                $scope.models.push({display:"Thorough but slow (Opus 5.5)",model:"claude-opus-5-5"})

                $scope.input.selectedModel = $scope.models[0]

                $scope.$watch(
                    function() {
                        return $scope.conversation},
                    function() {

                    }
                );

                $scope.$watch(
                    function() {
                        return $scope.inputbundle},
                    function() {
                        //when conversation changes, do stuff
                        $scope.localInputBundle = $scope.inputbundle
                        console.log($scope.inputbundle)

                    }
                );


                $scope.useInputBundle = function () {
                    if ($scope.conversation) {
                        $scope.conversation.messages = $scope.conversation.messages || []
                        if ($scope.inputbundle && $scope.conversation.messages.length == 0) {
                            return true
                        }
                    }

                }

                $scope.sendMessage = function (msg) {

                    //determine whether to use a passed in bundle. Only if $scope.messages.length == 0


                    //create default messages just for testing
                    if (! msg) {
                        msg = "Add a new weight observation"
                        if ($scope.conversation?.messages?.length < 1) {
                            msg = "Create a bundle with a patient and asthma"
                        }
                    }
                    $scope.count = 0;

                    let timer = $interval(function() {
                        $scope.count++;
                    }, 1000);


                    $scope.loading = true  //we're going to add the current bundle to the message later so kee[ this for the hx
                    let userMessage = msg //the original user message


                    let currentBundle
                    //only add the inputbundle as the bundle to update if there aren't already any messages
                    if ($scope.useInputBundle()) {
                        currentBundle = $scope.inputbundle

                    } else {

                    }


                    let messages = [] //this will be the list of messages to send to the AI
                    for (let msg of $scope.conversation.messages || []) {

                        //first the user query
                        messages.push({role:'user',content:msg.prompt || "Unknown prompt"})
                        //then the response

                        //we only look for the most recent bundle in the messages if one wasn't supplied
                        if (! $scope.useInputBundle() && msg.bundle) {
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

                    if ($scope.inputbundle) {
                        newUserMessage += updateMessage
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

                            if ($scope.response.bundle) {
                                //validate bundle

                                let obj = {resource:$scope.response.bundle,validationServer:validationServer}

                                // $scope.waiting = true
                                $scope.validating = true
                                $http.post("validate",obj).then(
                                    function (data) {
                                        $scope.OO = data.data
                                        console.log($scope.OO)
                                        let ar = []
                                        for (let iss of $scope.OO.issue || []) {
                                            if (iss.severity == 'warning' || iss.severity == 'warning') {
                                                let iss1 = {severity:iss.severity,diagnostics:iss.diagnostics}

                                                //Get the index in the bundle of the resource with the issue
                                                let loc = iss.location[0]
                                                const match = loc.match(/\[(\d+)\]/);
                                                iss1.index = match ? parseInt(match[1], 10) : null;

                                                if (iss1.index && iss1.index < $scope.response?.bundle?.entry.length -1) {
                                                    let entry = $scope.response?.bundle?.entry[iss1.index]
                                                    //const text = resource?.text?.div?.replace(/<[^>]*>/g, '');
                                                    iss1.resourceText = entry?.resource?.text?.div?.replace(/<[^>]*>/g, '');
                                                }


                                                ar.push(iss1)
                                            }
                                        }
                                        if (ar.length > 0) {
                                            //if there are error or warning issues then add them to the conversation hx
                                            $scope.response.validationIssues = ar
                                            localforage.setItem($scope.conversation.key, $scope.conversation)
                                                .then(function() {
                                                    console.log(`${$scope.conversation.key} updated`)
                                                }).catch(function(err) {
                                                    alert(angular.toJson(err))
                                                }
                                            )

                                            $scope.validationSummary =  $scope.makeValidationString(ar)
                                        }
                                    }
                                ).finally(function () {
                                    $scope.validating = false
                                })
                            }



                            $scope.response.prompt = userMessage    //what the user said
                            $scope.response.usage = data.data.usage
                            $scope.response.tokens =data.data.usage["input_tokens"] + data.data.usage["output_tokens"]
                            $scope.response.time = $scope.count
                            $scope.response.model = $scope.input.selectedModel.model
                            $scope.response.stopReason = data.data.stopReason


                            //update the current conversation
                            $scope.conversation.messages.push($scope.response)

                            //now save the updated conversation under the current key
                            localforage.setItem($scope.conversation.key, $scope.conversation)
                                .then(function() {
                                    console.log(`${$scope.conversationKey} updated`)
                                }).catch(function(err) {
                                    alert(angular.toJson(err))
                                }
                            )

                            $scope.loading = false
                            delete $scope.input.message
                            console.log($scope.response)

                            $scope.airesponse({bundle:$scope.response.bundle})

                        }, function (err) {
                            alert(`There was an unknown error from the server. Cannot create bundle. ${angular.toJson(err)}`)
                        }
                    )

                }


                $scope.loadBundle = function (bundle) {
                    $scope.bundleselected({bundle:bundle})
                }

                $scope.makeValidationString = function(issues) {

                    if (! issues || issues.length == 0) {
                        return ""
                    }

                    let warnings = 0
                    let errors = 0
                    for (const iss of issues || []) {
                        if (iss.severity == 'error') {
                            errors++
                        } else if (iss.severity == 'warning') {
                            warnings++
                        }
                    }
                    let result = ""
                    if (errors > 0) {
                        result = `${errors} errors`
                    }
                    if (warnings > 0) {
                        result += `${warnings} warnings`
                    }
                    if (! result) {
                        result = "No validation issues"
                    }

                    return result

                }

            }


            // $scope.onSelectResource({entryIndex: idx, resource: resource,tab:$scope.ui.tab})
        }
    });
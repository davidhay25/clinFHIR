angular.module("sampleApp")
    .controller('aiAdminCtrl',
        function ($scope,$http,$timeout) {
            $scope.input = {}

            $http.get('ai/log').then(
                function (data) {
                    $scope.log = data.data
                    console.log(data.data)
                }
            )


            $scope.getDetails = function (row) {
               // console.log(row)
                $scope.selectedRow = row
                $http.get(`ai/log/${row.id}`).then(
                    function (data) {
                        //represents a single call to the AI.
                        //messages is the history of messages - the last in the array is the current from the user - {role: content:}
                        //  the content is text and contains <requested_change> and <current_bundle>
                        //response is the AI response - the envelope containing bundle, summary, modelling_note and warnings
                        $scope.details = data.data
                        let lastPrompt = $scope.details.messages[$scope.details.messages.length -1]
                        const { requestedChange, currentBundle } = extractDetails(lastPrompt.content)

                        $scope.forDisplay = {requestedChange:requestedChange,currentBundle:currentBundle}
                        $scope.forDisplay.response = $scope.details.response


                       //generate the conversations array
                        if ($scope.details.messages) {
                            $scope.details.parsedMessages = []
                            for (let msg of $scope.details.messages) {
                                if (msg.role == 'assistant') {
                                    let obj = angular.fromJson(msg.content)
                                    obj.role = 'assistant'
                                    $scope.details.parsedMessages.push(obj)
                                } else {

                                    const { requestedChange, currentBundle } = extractDetails(msg.content)
                                    if (requestedChange) {
                                        let bundle = angular.fromJson(currentBundle)
                                        $scope.details.parsedMessages.push({role:'user',text:requestedChange,bundle:bundle})
                                    } else {
                                        $scope.details.parsedMessages.push({role:'user',text:msg.content})
                                    }
                                }
                               // $scope.
                            }
                        }
//console.log($scope.details.parsedMessages)
                        console.log(data.data)
                    }, function (err) {
                        alert(angular.toJson(err.data))
                    }
                )
            }

            function extractDetails(s) {
                const changeMatch = s.match(/<requested_change>([\s\S]*?)<\/requested_change>/);
                const bundleMatch = s.match(/<current_bundle>([\s\S]*?)<\/current_bundle>/);

                const requestedChange = changeMatch ? changeMatch[1].trim().replace(/^"|"$/g, "") : null;
                const currentBundle = bundleMatch ? bundleMatch[1].trim() : null;

                return { requestedChange, currentBundle };
            }


        })
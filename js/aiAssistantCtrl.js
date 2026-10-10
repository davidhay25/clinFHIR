angular.module("sampleApp")
    .controller('aiAssistantCtrl',
        function ($scope,aiAssistantSvc,$interval) {

            $scope.input = {}
            $scope.input.message = "Create a small bundle with 3 Condition and a patient - asthma, diabetes and eczema"


            //the localforage library must be loaded by the containing page
            localforage.getItem('aiHistory').then(function(value) {
                $scope.$evalAsync(function() {
                    $scope.count = value;
                });
            });


            $scope.sendMessage = function (msg) {
                $scope.loading = true

                $scope.count = 0;

                $interval(function() {
                    $scope.count++;
                }, 1000);



                let messages = [{role:'user',content:msg}]
                let response = ""
                aiAssistantSvc.build(messages, function (chunk) {
                    // fetch runs outside Angular's digest cycle, so we must trigger it
                    $scope.$evalAsync(function () {
                        response += chunk;
                        //console.log($scope.response)
                    });
                })
                    .catch(function (err) {
                        console.error(err)
                        $scope.$evalAsync(function () { $scope.error = 'Sorry, that failed.'; });
                    })
                    .finally(function () {
                        $scope.loading = false
                        //
                        try {
                            $scope.response = angular.fromJson(response)
                            console.log($scope.response)
                        } catch (e) {
                            alert("Unable to extract json - likely a truncated response")
                        }


                        $scope.$evalAsync(function () { $scope.loading = false; });
                    });


                  //  aiAssistantSvc.sendMessage(msg)




            }

            $scope.save = function () {
                $scope.$close($scope.response.bundle)
            }


        })

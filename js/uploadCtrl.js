/*has been deprectde - don't call make function - expensive! */

angular.module("sampleApp")
    .controller('uploadCtrl',
        function ($scope,appConfigSvc,SaveDataToServer) {

            $scope.input = {resetId:true}

            //load the file from the fileSystem Assume a Json file (for now)
            $scope.loadFile = function () {
                var selectedFile = document.getElementById('inputFileName').files[0];

                if (!selectedFile) {
                    alert("Please choose the file first.")
                    return;
                }

                var reader = new FileReader();
                reader.readAsText(selectedFile)

                reader.onload = function(e) {
                    $scope.$apply(function() {
                        var contents = reader.result;


                        if (contents.substr(0,1) == '{') {
                            //assume this is a fhir resource
                            $scope.fileToUpload = angular.fromJson(contents) ;

                        } else {
                            alert('Must be a json file (for now)')
                        }

                        $scope.url = appConfigSvc.getCurrentDataServer().url+  $scope.fileToUpload.resourceType;

                    });
                };
            };



            $scope.uploadFile = function () {

                if ($scope.input.resetId) {
                    delete  $scope.fileToUpload.id;
                }

                //save the resource to the dataserver...
                SaveDataToServer.saveResource($scope.fileToUpload).then(
                    function (data) {
                        console.log(data)

                        var serverUrl;
                        serverUrl = data.headers('Content-Location');
                        if (! serverUrl) {
                            serverUrl = data.headers('Location');
                        }



                        if (serverUrl.substr(0,4)== 'http') {
                            //convert to a logical url
                            var ar = serverUrl.split('/');

                            if (ar[ar.length-2] == '_history') {
                                ar.pop();
                                ar.pop();
                            }


                            var l = ar.length;
                            serverUrl = ar[l-2]+ "/"+ar[l-1];
                        }


                        //close the dialog, passing back the url where ther resource was stored.
                        $scope.$close({url:serverUrl,description:$scope.input.description, type:$scope.fileToUpload.resourceType})



                    }, function (err) {
                        alert('Error uploading the file ' + angular.toJson(err, true))
                    }
                )

            }


        });

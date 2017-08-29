/*has been deprectde - don't call make function - expensive! */

angular.module("sampleApp")
    .controller('uploadCtrl',
        function ($scope,appConfigSvc,SaveDataToServer) {



            //load the file from the fileSystem Assume a Json file (for now)
            $scope.loadFile = function () {
                var selectedFile = document.getElementById('inputFileName').files[0];
                console.log(selectedFile);
/*

                if (selectedFile.substr(0,1) == '{') {
                    //assume this is a fhir resource
                    $scope.uploadType = 'fhir';

                   // console.log(contents)
                    $scope.fileToUpload = angular.fromJson(selectedFile) ;
                    delete  $scope.fileToUpload.id;
                } else {
                    alert('Must be a json file (for now)')
                }

                $scope.url = appConfigSvc.getCurrentDataServer().url+  $scope.fileToUpload.resourceType;

                return;

                */

                var reader = new FileReader();
                reader.readAsText(selectedFile)

                reader.onload = function(e) {
                    $scope.$apply(function() {
                        // $scope.fileToUpload = reader.result;

                        var contents = reader.result;


                        if (contents.substr(0,1) == '{') {
                            //assume this is a fhir resource
                            $scope.uploadType = 'fhir';

                            //console.log(contents)
                            $scope.fileToUpload = angular.fromJson(contents) ;
                            delete  $scope.fileToUpload.id;
                        } else {
                            alert('Must be a json file (for now)')
                        }

                        $scope.url = appConfigSvc.getCurrentDataServer().url+  $scope.fileToUpload.resourceType;

                       // console.log(contents)



                        //$scope.fileDescription = selectedFile.name;
                        // console.log(reader.result)
                    });
                };
            };



            $scope.uploadFile = function () {

                //save the resource to the dataserver...
                SaveDataToServer.saveResource($scope.fileToUpload).then(
                    function (data) {
                        console.log(data)

                        var serverUrl;
                        serverUrl = data.headers('Content-Location');
                        if (! serverUrl) {
                            serverUrl = data.headers('Location');
                        }
                        //close the dialog, passing back the url where ther resource was stored.
                        $scope.$close({url:serverUrl})



                    }, function (err) {
                        alert('Error uploading the file ' + angular.toJson(err, true))
                    }
                )

            }


        });

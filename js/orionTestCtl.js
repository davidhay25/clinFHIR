
angular.module("sampleApp")
    .controller('orionTestCtrl',
        function ($scope,$http,$sce) {
            $scope.input = {};


            $http.get('orionTest/performAnalysis').then(
                function(data) {
                    
                    $scope.results = data.data
                    displayAnalysis($scope.results)

                    console.log($scope.results)
/*
                    //build a map of v2 map by segment (
                    $scope.v2FieldMap = {}
                    $scope.results.map.forEach(function (map) {
                        var v2 = map.v2;
                        var ar = v2.split('.');
                        var segmentName = ar[0];
                        $scope.v2FieldMap[segmentName] = $scope.v2FieldMap[segmentName] || [];
                        $scope.v2FieldMap[segmentName].push(map)
                    })

                    console.log($scope.v2FieldMap)
*/
                }
            )

            function displayAnalysis(results) {
                //build a map of v2 map by segment (
                $scope.v2FieldMap = {}
                results.map.forEach(function (map) {
                    var v2 = map.v2;
                    var ar = v2.split('.');
                    var segmentName = ar[0];
                    $scope.v2FieldMap[segmentName] = $scope.v2FieldMap[segmentName] || [];
                    $scope.v2FieldMap[segmentName].push(map)
                })

                console.log($scope.v2FieldMap)
            }


            $http.get('artifacts/v2FieldNames.json').then(
                function(data) {
                    $scope.v2FieldNames = data.data;
                }
            );

            $http.get('artifacts/v2DataTypes.json').then(
                function(data) {
                    $scope.v2Datatypes = data.data;
                    console.log($scope.v2Datatypes)
                }
            );

            $http.get('orionTest/getSamples').then(
                function(data) {
                    $scope.samples = data.data;
                    console.log($scope.samples)
                }
            );

            $scope.selectSample = function(sample,type) {
                $scope.sampleType = type;
                if (type == 'hl7') {
                    $scope.selectedHL7Sample = sample;
                } else {
                    $scope.selectedFHIRSample = sample;
                }

                console.log(sample)
            };

            $scope.loadFile = function () {
                var selectedFile = document.getElementById('inputFileName').files[0];
                console.log(selectedFile);
                var reader = new FileReader();
                reader.readAsText(selectedFile)

                reader.onload = function(e) {
                    $scope.$apply(function() {
                       // $scope.fileToUpload = reader.result;

                        var contents = reader.result;
                        if (contents.substr(0,1) == '{') {
                            //assume this is a fhir resource
                            $scope.uploadType = 'fhir';

console.log(contents)
                            $scope.fileToUpload = contents;
                        } else {
                            //assume this is a v2 message
                            $scope.uploadType = 'hl7';
                            var ar = contents.split('\r');
                            console.log(ar)

                            $scope.fileToUpload = ar;
                        }


                        console.log(contents)



                        $scope.fileDescription = selectedFile.name;
                       // console.log(reader.result)
                    });
                };
            };




            $scope.performAnalysis = function() {
                var url = 'orionTest/performAnalysis?hl7='+$scope.selectedHL7Sample._id + '&fhir='+ $scope.selectedFHIRSample._id;
                $http.get(url).then(
                    function(data) {
                        console.log(data)
                        $scope.results = data.data
                        displayAnalysis($scope.results)
                        alert('Analysis complete. View the tabs for details.')
                    },function(err) {
                        alert("There as an error performing the analysis: "+ angular.toJson(err))
                        console.log(err)
                    }
                )
            };

            $scope.uploadFile = function () {

                var transmit = $scope.fileDescription || 'No description';

                if ($scope.uploadType == 'hl7') {
                    transmit += '%' + JSON.stringify($scope.fileToUpload);
                } else {
                    transmit += '%' + $scope.fileToUpload;
                }

                //var transmit = text + '%' + JSON.stringify($scope.fileToUpload);

                var url = "/orionTest/uploadFile";
                $http.post(url,btoa(transmit)).then(
                    function(data) {
                        console.log(data.data)
                        alert('File has been uploaded.')
                    },
                    function(err) {
                        alert('There was an error uploading the file: '+ angular.toJson(err));
                        console.log(err);
                    }
                )

            };



            
            $scope.selectSegment = function(segment){
                $scope.currentSegment = segment;
                $scope.currentV2Fields = $scope.v2FieldNames[segment[0]];
                //console.log($scope.currentV2Fields)
            };

            $scope.decomposeData = function(dt,data) {
                console.log(dt,data);
                var ar = []
                if (data) {
                    ar = data.split('^')
                }

                var details = $scope.v2Datatypes[dt];
                console.log(details)
                if (details) {
                    var display = "";

                    details.fieldName.forEach(function (fld,inx) {
                        if (ar[inx]) {
                            display += fld.name + "=" + ar[inx] + "<br/>";
                        }
                    })




                    return display;
                } else {
                    return dt
                }


            }

            $scope.showDT = function(dt) {
                //var dt = $scope.v2Datatypes[dt];
                console.log(dt)
                var details = $scope.v2Datatypes[dt];
                console.log(details)
                if (details) {
                    var display = "";
                    details.fieldName.forEach(function (fld) {
                        display += fld.name + " ("+ fld.type +  ")<br/>";
                    })

                    if (display) {
                        display = display.substring(0,display.length -5)
                    }

                    return display;
                } else {
                    return dt
                }

            }

            $scope.showRow = function(item) {
                //console.log(item)
                if ($scope.input.showAllMappings) {
                    return true;
                } else {
                    if (item.v2.value && item.v2.value.values.length > 0) {
                        return true;
                        /*item.v2.value.values.for(function (v) {
                            if (v) {
                                return true;
                            }
                        })*/

                    }
                }
                return false;
            }


    }).filter('dropFirst', function() {
    return function(path) {
        if (path) {
            var ar = path.split('.')
            ar.splice(0,1);
            return ar.join('.')
        }


    }
})

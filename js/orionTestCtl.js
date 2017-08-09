
angular.module("sampleApp")
    .controller('orionTestCtrl',
        function ($scope,$http,$sce) {
            $scope.input = {};

/*
            $http.get('orionTest/performAnalysis').then(
                function(data) {
                    
                    $scope.results = data.data;
                    displayAnalysis($scope.results);

                    console.log($scope.results)

                }
            );
            */

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

               // console.log($scope.v2FieldMap)
            }


            $http.get('artifacts/v2FieldNames.json').then(
                function(data) {
                    $scope.v2FieldNames = data.data;
                }
            );

            $http.get('artifacts/v2DataTypes.json').then(
                function(data) {
                    $scope.v2Datatypes = data.data;
                   // console.log($scope.v2Datatypes)
                }
            );

            $http.get('orionTest/getSamples').then(
                function(data) {
                    $scope.samples = data.data;
                   // console.log($scope.samples)
                }
            );

            $scope.selectSample = function(sample,type) {
                $scope.sampleType = type;
                if (type == 'hl7') {
                    $scope.selectedHL7Sample = sample;
                } else {
                    $scope.selectedFHIRSample = sample;
                }

               // console.log(sample)
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




            $scope.getFiles = function() {
                var url = 'orionTest/getFiles?hl7='+$scope.selectedHL7Sample._id + '&fhir='+ $scope.selectedFHIRSample._id;
                $http.get(url).then(
                    function(data) {
                        console.log(data)

                        var fhir = data.data.fhir;
                        var arHL7 = data.data.arHL7;
                        var map = data.data.map;


                        $scope.results = performAnalysis(arHL7,fhir,map);
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



            function performAnalysis(arHl7,FHIR,Map) {


                var vo = convertV2ToObject(arHl7);
                var hl7Hash = vo.hash;
                var hl7Msg = vo.msg;


                var response = {line:[]};


                response.fhir = FHIR;
                response.v2Message = hl7Msg;
                response.v2String = arHl7;
                response.map = Map;

                var arResult = [];
                Map.forEach(function (item) {
                    var result = {description: item.description};
                    result.v2 = {key: item.v2, value: getFieldValue(hl7Hash,item.v2)};

                    //we need to remove the first segment in the path as it isn't present in the actual resource...
                    var fhirKey = item.fhir;
                    var ar = fhirKey.split('.');
                    ar.splice(0,1);
                    console.log(ar)
                    //result.fhir = {key: item.fhir, value:JSONPath({path:ar.join('.')})}
                    result.fhir = {key: item.fhir, value:JSONPath({path:ar.join('.'),json:FHIR})}
                    response.line.push(result)
                });
                return response;

                //return the value of this field. - field name is like PV1-7.9.2
                function getFieldValue(hl7Hash,fieldName) {

                    var response = {values:[]}

                    var ar = fieldName.split('-');
                    var segmentCode = ar[0];                //eg PV1
                    var fieldNumberAsString = ar[1];         //eg 7.9.2
                    var fieldNumber = parseInt(ar[1],10);   //eg 7

                    var segments = hl7Hash[segmentCode]     //each segment is a full seg,ent - eg a PV1...
                    if (! segments) {
                        return
                    }
                    //var arValues = [];      //there can be more than one...
                    segments.forEach(function(seg){
                        //seg is a single segment...
                        var fieldValue = seg[fieldNumber];       //the field value as a string
                        response.fullValue = fieldValue;
                        var ar1 = fieldNumberAsString.split('.');
                        switch (ar1.length) {
                            case 1 :                        //full field
                                response.values.push(fieldValue)
                                break;
                            case 2 :                        //sub value - eg 7.9
                                if (fieldValue) {
                                    var arSubvalue = fieldValue.split('^');
                                    if (arSubvalue.length >= ar1[1]) {

                                        response.values.push(arSubvalue[ar1[1]])
                                    }
                                }
                                break;
                            case 3 :                        //sub-sub value - eg 7.9.2
                                if (fieldValue) {
                                    var arSubvalue = fieldValue.split('^');
                                    if (arSubvalue.length >= ar1[1]) {
                                        var subSubValue = ar1[1];
                                        var arSS = subSubValue.split('&');
                                        if (arSS.length >= ar1[2]) {
                                            response.values.push(arSS[ar1[2]])
                                        }



                                    }
                                }


                                break;
                        }



                    })
                    return response;
                }


                function convertV2ToObject(arHl7) {
                    var hash = {}
                    var arMessage = [];
                    arHl7.forEach(function(line){
                        var arLine = line.split('|');
                        var segmentName = arLine[0];
                        hash[segmentName] = hash[segmentName] || []
                        hash[segmentName].push(arLine);


                        arMessage.push(arLine)

                    })

                    //console.log(hash);
                    return {hash:hash,msg:arMessage};


                }
            }





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

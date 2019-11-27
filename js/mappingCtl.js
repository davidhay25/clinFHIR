angular.module("sampleApp")
    .controller('mappingCtrl',
        function ($scope,$http,v2ToFhirSvc,$uibModal,$timeout,modalService) {
            $scope.input = {};
            $scope.serverRoot = "https://vonk.fire.ly/";
            $scope.structureMapId = 'dh';
            $scope.input.isDirty = false;

            //todo - should these move to app config svc???
            let extMapUrl = "https://vonk.fire.ly/StructureDefinition/mappingMap";
            let extExampleUrl = "https://vonk.fire.ly/StructureDefinition/mappingExample";

            //get the default project (map). Really just for testing... Th
            function loadSMDEP(id) {
                let dUrl = $scope.serverRoot + "StructureMap/"+id
                $http.get(dUrl).then(
                    function(data) {
                        $scope.currentSM = data.data;

                        $scope.input.mappingFile = getStringExtension($scope.currentSM,extMapUrl)[0];
                        $scope.input.inputJson = getStringExtension($scope.currentSM,extExampleUrl)[0];
                    }
                );
            }

            function selectMap(map) {

                $scope.currentSM = map

                $scope.input.mappingFile = getStringExtension($scope.currentSM,extMapUrl)[0];
                $scope.input.inputJson = getStringExtension($scope.currentSM,extExampleUrl)[0];

            }
          //  loadSM($scope.structureMapId);

            $scope.maps = [];
            firebase.auth().onAuthStateChanged(function(user) {
                if (user) {
                    $scope.user = user;
                    console.log(user)

                    let dUrl = $scope.serverRoot + "StructureMap?publisher="+user.email
                    $http.get(dUrl).then(
                        function(data) {
                            console.log(data.data);
                            if (data.data && data.data.entry) {
                                data.data.entry.forEach(function (entry) {
                                    if (entry.resource && entry.resource.resourceType == 'StructureMap') {
                                        $scope.maps.push(entry.resource)
                                    }
                                })
                            }

                            //$scope.input.mappingFile = getStringExtension($scope.currentSM,extMapUrl)[0];
                            //$scope.input.inputJson = getStringExtension($scope.currentSM,extExampleUrl)[0];
                            console.log($scope.maps)
                            $scope.input.model = $scope.maps[0]
                            selectMap($scope.input.model);

                        }
                    );

                } else {
                    delete $scope.user
                }

            });
            $scope.login=function(){
                $uibModal.open({
                    backdrop: 'static',      //means can't close by clicking on the backdrop.
                    keyboard: false,       //same as above.
                    templateUrl: 'modalTemplates/login.html',
                    controller: 'loginCtrl'
                })
            };
            $scope.logout=function(){
                firebase.auth().signOut().then(function() {
                    delete $scope.user;
                    modalService.showModal({}, {bodyText: 'You have been logged out of clinFHIR'})
                    $scope.maps.length = 0;
                }, function(error) {
                    modalService.showModal({}, {bodyText: 'Sorry, there was an error logging out - please try again'})
                });
            };

           // $scope.selectMap = function(map){
             //   console.log(map)
          //  }

            $scope.addMap = function(map){
                $uibModal.open({
                    backdrop: 'static',      //means can't close by clicking on the backdrop.
                    keyboard: false,       //same as above.
                    templateUrl: 'modalTemplates/addMap.html',
                    controller: function(){

                    }
                })
            };
            //extension urls

           /*
            //get the mapping file (text)
            let urlMap = "artifacts/mapping/fakemeds.txt";
            $http.get(urlMap).then(
                function(data) {
                    $scope.input.mappingFile = data.data
                }
            );

            //get the message to transform
            let urlInput = "artifacts/mapping/fakemedChart.json";
            $http.get(urlInput).then(
                function(data) {
                    $scope.input.inputJson = angular.toJson(data.data,true)
                }
            );
*/
            $scope.validate = function() {

            };

            $scope.selectEntryFromBundle = function(entry){
                $scope.selectedEntry = entry
            };

            //convert the map into an SM resource using $convert, then update the resource if the conversion was successful...
            $scope.updateStructureMap = function() {
                delete $scope.convertError, $scope.transformError;
                let url = $scope.serverRoot + "StructureMap/$convert";
                let options = {headers:{}};
                options.headers['content-type'] = 'text/fhir-mapping;charset=utf-8';

                $http.post(url,$scope.input.mappingFile,options).then(
                    function(data) {
                        let structureMapResource = data.data;
                        console.log(structureMapResource)
                        structureMapResource.id = $scope.structureMapId;
                        structureMapResource.publisher = $scope.user.email;
                        //now add the map and the example file/s to the resource as extensions

                        //todo need to add sdefs to server...
                        addStringExtension(structureMapResource,extMapUrl,$scope.input.mappingFile);
                        addStringExtension(structureMapResource,extExampleUrl,$scope.input.inputJson);



                        console.log(data.data)
                        let url = $scope.serverRoot + "StructureMap/" + $scope.structureMapId;
                        $http.put(url,structureMapResource).then(
                            function() {
                                alert("StructureMap updated")
                                $scope.input.isDirty = false;
                            }, function(err) {
                                $scope.convertError = err.data;
                            }
                        )
                    },
                    function(err) {
                        console.log(err);
                        $scope.convertError = err.data

                    }
                )
            };

            $scope.copyToClipboard = function(){
                if ($scope.output) {
                    //https://stackoverflow.com/questions/29267589/angularjs-copy-to-clipboard
                    var copyElement = document.createElement("span");
                    copyElement.appendChild(document.createTextNode(angular.toJson($scope.output),2));
                    copyElement.id = 'tempCopyToClipboard';
                    angular.element(document.body.append(copyElement));

                    // select the text
                    var range = document.createRange();
                    range.selectNode(copyElement);
                    window.getSelection().removeAllRanges();
                    window.getSelection().addRange(range);

                    // copy & cleanup
                    document.execCommand('copy');
                    window.getSelection().removeAllRanges();
                    copyElement.remove();

                    alert("The bundle has been copied to the clipboard.")
                }

            };


            //perform the actual expansion...
            $scope.transform = function(){
                delete $scope.output;
                delete $scope.convertError, $scope.transformError;
                $scope.transformMessage = "Executing map on server, please wait...";
                //https://vonk.fire.ly/StructureMap/dh/$transform
                let url = $scope.serverRoot + "StructureMap/" + $scope.structureMapId + "/$transform";
                let input = $scope.input.inputJson;
                $http.post(url,input).then(
                    function(data) {
                        $scope.output = data.data;
                        delete $scope.transformMessage;
                        makeGraph($scope.output)
                    },
                    function (err) {
                        $scope.transformError = err.data;
                    }
                )
            };

            function addStringExtension(resource,url,s) {
                resource.extension = resource.extension || [];
                let ext = {url:url,valueString:s}
                resource.extension.push(ext)
            }

            function getStringExtension(resource,url) {
                let result = [];
                if (resource.extension) {
                    resource.extension.forEach(function (ext) {
                        if (ext.url == url) {
                            result.push(ext.valueString)
                        }
                    })
                }
                return result;
            }


            function makeGraph(bundle) {
                let options = {bundle:bundle,hashErrors: {},serverRoot:"https://vonk.fire.ly/"}
                let vo = v2ToFhirSvc.makeGraph(options)

                var container = document.getElementById('resourceGraph');
                var graphOptions = {
                    physics: {
                        enabled: true,
                        barnesHut: {
                            gravitationalConstant: -10000,
                        }
                    }
                };

                $scope.chart = new vis.Network(container, vo.graphData, graphOptions);

                $scope.chart.on("click", function (obj) {


                    var nodeId = obj.nodes[0];  //get the first node
                    var node = vo.graphData.nodes.get(nodeId);

                      $scope.selectedEntry = node.entry

                   // $scope.selectedNode = node;

                   // console.log( $scope.selectedNode)
                    $scope.$digest();
                })

            }

            $scope.fitSingleGraph = function(){
                $timeout(function(){
                    if ($scope.chart) {
                        $scope.chart.fit();

                    }

                },1000)

            };


        }
    );
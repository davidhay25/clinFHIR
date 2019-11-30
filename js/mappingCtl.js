angular.module("sampleApp")
    .controller('mappingCtrl',
        function ($scope,$http,v2ToFhirSvc,$uibModal,$timeout,modalService) {
            $scope.input = {};
            $scope.serverRoot = "https://vonk.fire.ly/";
           // $scope.structureMapId = 'dh';
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

            function clearInputs() {
                delete $scope.input.mappingFile;
                delete $scope.input.inputJson;
            }

            function selectMap(map) {
                clearInputs()
                //delete $scope.input.mappingFile, $scope.input.inputJson;
                //$scope.currentSM = map;
                let mf = getStringExtension(map,extMapUrl);
                if (mf.length > 0) {
                    $scope.input.mappingFile = mf[0]
                }
                let ex = getStringExtension(map,extExampleUrl);
                if (ex.length > 0) {
                    $scope.input.inputJson = ex[0]
                }
            }
            $scope.maps = [];
            firebase.auth().onAuthStateChanged(function(user) {
                if (user) {
                    $scope.user = user;
                    console.log(user)

                    let dUrl = $scope.serverRoot + "StructureMap?publisher="+user.email
                    $scope.showWaiting = true;
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
                            $scope.currentSM = $scope.maps[0]
                            //$scope.input.model = $scope.maps[0]     //todo input.model is what the selector DD is bound to - is this right??
                            selectMap($scope.currentSM);      //sets currentSM and the map and json vars from the SM
                        }
                    ).finally(function () {
                        $scope.showWaiting = false;
                    });

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

            $scope.openMap = function(){
                $uibModal.open({
                    backdrop: 'static',      //means can't close by clicking on the backdrop.
                    keyboard: false,       //same as above.
                    //size:'lg',
                    templateUrl: 'modalTemplates/openMap.html',
                    controller: function($scope,$http,serverRoot){
                        $scope.validId = false;
                        $scope.open = function(){
                            $scope.$close({id:$scope.id})
                        }

                    },resolve : {
                        serverRoot: function () {          //the default config
                            return $scope.serverRoot;
                        }
                    }
                }).result.then(function(vo){
                    console.log(vo)
                    // $scope.structureMapId = vo.id;      //the id of the current map

                    if (vo.id) {
                        let url = $scope.serverRoot + "StructureMap/"+ vo.id
                        $http.get(url).then(
                            function(data) {
                                let map = data.data;
                                $scope.currentSM = map
                                $scope.maps.push(map);
                                selectMap(map)
                            }, function (err) {
                                alert ("Sorry, the StructureMap resource with the id " +vo.id+  "could not be found.")
                            }
                        )
                    }


                })
            }

            //when a map is selected from the drop down list for this user
            $scope.selectMapFromDD = function(map){
                delete $scope.convertError;
                delete $scope.transformError;
                delete $scope.transformMessage;
                console.log(map)
                selectMap(map)

            };

            $scope.addMap = function(map){
                $uibModal.open({
                    backdrop: 'static',      //means can't close by clicking on the backdrop.
                    keyboard: false,       //same as above.
                    size:'lg',
                    templateUrl: 'modalTemplates/addMap.html',
                    controller: function($scope,$http,serverRoot){
                        $scope.validId = false;
                        $scope.checkId = function(){
                            let url = serverRoot+"StructureMap/"+$scope.id
                            $http.get(url).then(
                                function(){
                                    alert("Sorry, this Id is already in use")
                                },
                                function(err){
                                    console.log(err);
                                    if (err.status == 404) {
                                        $scope.validId = true;
                                    } else {
                                        alert("Error contacting server:"+angular.toJson(err))
                                    }
                                }
                            )
                        };

                        $scope.add = function(){
                            $scope.$close({id:$scope.id,sample:$scope.sample,description:$scope.description,name:$scope.name})
                        }

                    },resolve : {
                        serverRoot: function () {          //the default config
                            return $scope.serverRoot;

                        }
                    }
                }).result.then(function(vo){
                    console.log(vo)
                   // $scope.structureMapId = vo.id;      //the id of the current map
                    if (vo.sample) {
                        //set the sample data
                        $scope.input.inputJson = $scope.sample.inputJson;
                        $scope.input.mappingFile = $scope.sample.mappingFile;
                        //create the actual StructureMap resource
                        $scope.updateStructureMap(function(map){
                            //after the map has been created, we add it to the list of maps and make it current...
                            $scope.maps.push(map);
                            //$scope.input.model = map;   //for the dropdown
                            //$scope.currentSM = map;
                        });
                    } else {
                        //this has no sample data. It won't be saved until a mapping text has been entered & updated...
                        delete $scope.input.inputJson;
                        delete $scope.input.mappingFile;
                        $scope.currentSM = {resourceType:'StructureMap',id:vo.id,name:vo.name,description:vo.description}
                        $scope.maps.push($scope.currentSM);
                    }
                })
            };

            //get the sample mapping file (text)
            let urlMap = "artifacts/mapping/fakemeds.txt";
            $scope.sample = {};
            $http.get(urlMap).then(
                function(data) {
                    $scope.sample.mappingFile = data.data
                }
            );

            //get the message to transform
            let urlInput = "artifacts/mapping/fakemedChart.json";
            $http.get(urlInput).then(
                function(data) {
                    $scope.sample.inputJson = angular.toJson(data.data,true)
                }
            );

            $scope.validate = function() {
                alert('validate not yet enabled')
            };

            $scope.selectEntryFromBundle = function(entry){
                $scope.selectedEntry = entry
            };

            //convert the map into an SM resource using $convert, then update the SM resource if the conversion was successful...
            $scope.updateStructureMap = function(cb) {

                delete $scope.transformMessage;         //if set, transformMessage hides the transform button
                delete $scope.convertError;

                if (! $scope.input.mappingFile) {
                    alert("There must be some text in the mapping file before the StructureMap can be created")
                    return;
                }

                $scope.showWaiting = true;


                let url = $scope.serverRoot + "StructureMap/$convert";
                let options = {headers:{}};
                options.headers['content-type'] = 'text/fhir-mapping;charset=utf-8';

                $http.post(url,$scope.input.mappingFile,options).then(
                    function(data) {
                        let structureMapResource = data.data;
                        console.log(structureMapResource)
                        //structureMapResource.id = $scope.structureMapId;
                        structureMapResource.id = $scope.currentSM.id;
                        structureMapResource.publisher = $scope.user.email;
                        structureMapResource.description = $scope.currentSM.description;
                        structureMapResource.name = $scope.currentSM.name;
                        //now add the map and the example file/s to the resource as extensions

                        //todo need to add sdefs to server...
                        addStringExtension(structureMapResource,extMapUrl,$scope.input.mappingFile);
                        addStringExtension(structureMapResource,extExampleUrl,$scope.input.inputJson);

                        console.log(data.data)
                        let url = $scope.serverRoot + "StructureMap/" + $scope.currentSM.id;
                        //let url = $scope.serverRoot + "StructureMap/" + $scope.structureMapId;
                        $http.put(url,structureMapResource).then(
                            function() {
                                ///alert("StructureMap updated")
                                $scope.input.isDirty = false;
                                //$scope.currentSM = structureMapResource;

                                //update the maps array
                                for (var i=0; i < $scope.maps.length-1; i++) {
                                    if ($scope.maps[i].id == structureMapResource.id) {
                                        $scope.maps[i] = structureMapResource;
                                        $scope.currentSM = $scope.maps[i];
                                        break;
                                    }
                                }



                                if (cb) {
                                    cb(structureMapResource)
                                }
                            }, function(err) {
                                $scope.convertError = err.data;
                            }
                        ).finally(function () {
                            $scope.showWaiting = false;
                        })
                    },
                    function(err) {
                        console.log(err);
                        $scope.convertError = err.data
                        $scope.showWaiting = false;

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

                //todo - save automatically...
                if ($scope.isDirty) {
                    alert('There are unsaved changes. The transformation will be performed against the version stored on the server.')
                }

                delete $scope.transformMessage;         //if set, transformMessage hides the transform button

                delete $scope.output;
                delete $scope.convertError;
                delete $scope.transformError;
                $scope.transformMessage = "Executing map on server, please wait...";
                //https://vonk.fire.ly/StructureMap/dh/$transform
                //let url = $scope.serverRoot + "StructureMap/" + $scope.structureMapId + "/$transform";
                let url = $scope.serverRoot + "StructureMap/" + $scope.currentSM.id + "/$transform";

                //if the inpput is a resource then post directly. Otherwise must use a Paramaters
                let json = angular.fromJson($scope.input.inputJson);
                let content = $scope.input.inputJson;
                if (! json.resourceType) {
                    content = {resourceType:'Parameters',parameter:[]};
                    content.parameter.push({name:'content',valueString:$scope.input.inputJson});
                }


                $http.post(url,content).then(
                    function(data) {
                        $scope.output = data.data;
                        $scope.transformMessage = 'Transform succeeded'
                        //delete $scope.transformMessage;
                        makeGraph($scope.output)
                    },
                    function (err) {
                        $scope.transformMessage = "There was an error";
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

                if (!bundle || !(bundle.resourceType == 'Bundle') || !bundle.entry) {
                    return
                }

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
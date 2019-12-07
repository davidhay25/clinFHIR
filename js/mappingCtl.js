angular.module("sampleApp")
    .controller('mappingCtrl',
        function ($scope,$http,v2ToFhirSvc,$uibModal,$timeout,$window,$location,
                  modalService,logicalModelSvc,mappingSvc) {
            $scope.input = {};
            $scope.serverRoot = "https://vonk.fire.ly/";
            $scope.adminRoot = "https://vonk.fire.ly/administration/";        //where custom SD's are found
            $scope.confServer = "http://fhirtest.uhn.ca/baseDstu3/";            //where the CF models are found

/*
            $scope.serverRoot = "https://vonk.fire.ly/R4/";
            $scope.adminRoot = "https://vonk.fire.ly/administration/R4/";        //where custom SD's are found
            $scope.confServer = "http://fhirtest.uhn.ca/baseR4/";            //where the CF models are found
*/
            $scope.input.isDirty = false;

            //todo - should these move to app config svc???
            let extMapUrl = "https://vonk.fire.ly/StructureDefinition/mappingMap";
            let extExampleUrl = "https://vonk.fire.ly/StructureDefinition/mappingExample";

            var hash = $location.hash();

            if (hash) {
                $scope.modelSpecified = hash;
                console.log(hash)
                loadMap(hash)
            }

            /*

                        $timeout(function(){

                            var te = document.getElementById("te");
                            let cmOptions = {lineNumbers:true,lineWrapping:true,value:'testrt text'}
                            var myCodeMirror = CodeMirror.fromTextArea(te,cmOptions);
                                console.log(myCodeMirror)
                            myCodeMirror.on('change',function(evt){
                                console.log(evt)
                            })

                        },1000);

            */
            //https://stackoverflow.com/questions/6637341/use-tab-to-indent-in-textarea
            $timeout(function(){
                var textareas = document.getElementsByTagName('textarea');
                var count = textareas.length;
                for(var i=0;i<count;i++){
                    textareas[i].onkeydown = function(e){
                        if(e.keyCode==9 || e.which==9){
                            e.preventDefault();
                            var s = this.selectionStart;
                            this.value = this.value.substring(0,this.selectionStart) + "  " + this.value.substring(this.selectionEnd);
                            //this.value = this.value.substring(0,this.selectionStart) + "\t" + this.value.substring(this.selectionEnd);
                            //this.selectionEnd = s+1;
                            this.selectionEnd = s+2;
                        }
                    }
                }
            },1000);



/*
            $scope.generateShortCutDEP = function() {
                let hash = Utilities.generateHash();
                let shortCut = $window.location.href+"#"+hash

                var sc = $firebaseObject(firebase.database().ref().child("shortCut").child(hash));

                sc.modelId = $scope.currentSM.id;     //this should make it possible to query below...
                sc.shortCut = shortCut;     //the full shortcut
                sc.$save().then(
                    function(){
                        //todo add sc as extension to model
                        //$scope.treeData.shortCut = sc;

                        modalService.showModal({}, {bodyText: "The shortcut  " +  shortCut + "  has been generated for this model"})

                    }
                )
            };

            */



            function clearInputs() {
                delete $scope.input.mappingFile;
                delete $scope.input.inputJson;
            }

            function selectMap(map) {
                clearInputs();
                delete $scope.selectedEntry;
                delete $scope.output;
                if ($scope.chart) {
                    $scope.chart.destroy();
                }

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


/* */

                $timeout(function(){


                    var elSample = document.getElementById("sample");
                    let cmOptions = {lineNumbers:true,lineWrapping:true}

                    let cmSample = CodeMirror.fromTextArea(elSample,cmOptions);
                    console.log(cmSample);
                    cmSample.on('change',function(evt,changeobj){
                        //console.log(cmSample.getValue())
                        $scope.input.isDirty = true;
                        $scope.input.inputJson = cmSample.getValue();
                        $scope.$digest();
                    });

                    var elMap = document.getElementById("map");
                    var cmMap = CodeMirror.fromTextArea(elMap,cmOptions);
                    cmMap.on('change',function(evt){
                        $scope.input.isDirty = true;
                        $scope.input.mappingFile = cmMap.getValue();
                        $scope.$digest();
                    })
                },500)

                makeDownload(map)

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
                            if ($scope.maps.length > 0) {
                                $scope.currentSM = $scope.maps[0];
                                //modelSpecified is set when the model is specified as a hash...
                                if (! $scope.modelSpecified ) {
                                    selectMap($scope.currentSM);      //sets currentSM and the map and json vars from the SM
                                }

                            }


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

                    if (vo.id) {
                        loadMap(id)
                    }
                })
            };

            $scope.copyMap = function() {
                return;
                let clone = angular.copy($scope.currentSM);
                clone.publisher = $scope.user.email;

                $scope.input.inputJson = $scope.sample.inputJson;
                $scope.input.mappingFile = $scope.sample.mappingFile;

                //create the actual StructureMap resource
                $scope.currentSM = {resourceType:'StructureMap',id:vo.id,name:vo.name,description:vo.description,publisher:$scope.user.email}
                $scope.updateStructureMap(function(map){
                    //after the map has been created, we add it to the list of maps and make it current...
                    $scope.maps.push(map);
                    //$scope.input.model = map;   //for the dropdown
                    //$scope.currentSM = map;
                });

            };

            function loadMap(id) {
                let url = $scope.serverRoot + "StructureMap/"+ id
                $http.get(url).then(
                    function(data) {
                        let map = data.data;
                        $scope.currentSM = map
                        $scope.maps.push(map);
                        selectMap(map)
                    }, function (err) {
                        alert ("Sorry, there is no StructureMap resource at " + url)
                    }
                )
            }


            //when a map is selected from the drop down list for this user
            $scope.selectMapFromDD = function(map){
                delete $scope.convertError;
                delete $scope.transformError;
                delete $scope.transformMessage;
                $('#lmTreeView').jstree('destroy');
                console.log(map)
                selectMap(map)

            };

            $scope.addMap = function(map){
                $uibModal.open({
                    backdrop: 'static',      //means can't close by clicking on the backdrop.
                    keyboard: false,       //same as above.
                    size:'lg',
                    templateUrl: 'modalTemplates/addMap.html',
                    controller: function($scope,$http,serverRoot,modalService){
                        $scope.validId = false;
                        $scope.checkId = function(){

                            if ($scope.id) {
                                if ($scope.id.indexOf(" ") > -1) {
                                    modalService.showModal({},{bodyText:"The name cannot have spaces in it. Try again."})
                                    return;
                                }
                                if ($scope.id.indexOf(".") > -1) {
                                    modalService.showModal({},{bodyText:"The name cannot have a dot/period (.) in it. Try again."})
                                    return;
                                }
                                if ($scope.id.indexOf("_") > -1) {
                                    modalService.showModal({},{bodyText:"The name cannot have an underscore (_) in it. Try again."})
                                    return;
                                }
                            } else {
                                modalService.showModal({},{bodyText:"The Id cannot be blank. Try again."})
                                return;
                            }





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
                        $scope.currentSM = {resourceType:'StructureMap',id:vo.id,name:vo.name,description:vo.description,publisher:$scope.user.email}
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
                        $scope.currentSM = {resourceType:'StructureMap',id:vo.id,name:vo.name,description:vo.description,publisher:$scope.user.email}
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
                delete $scope.validateResult;
                let url = $scope.serverRoot + "Bundle/$validate";
                $http.post(url,$scope.output).then(
                    function(data) {
                        console.log(data)
                        $scope.validateResult = data.data;
                    }, function (err) {
                        console.log(err)
                    }
                )

                //alert('validate not yet enabled')
            };

            $scope.checkSample = function() {
                delete $scope.validateSampleMessage;
                try {
                    let json = angular.fromJson($scope.input.inputJson);
                    if (! json.resourceType) {
                        $scope.validateSampleMessage = "This is valid Json, but there is no resourceType so the transform will likely fail"
                    }
                } catch (ex) {
                    $scope.validateSampleMessage = "This is not valid Json, which is required at the moment"
                }
            };

            $scope.selectEntryFromBundle = function(entry){
                $scope.selectedEntry = entry
            };

            function makeDownload(map) {
                $scope.downloadMapContent = window.URL.createObjectURL(new Blob([angular.toJson(map)],
                    {type: "text/text"}));

                var now = moment().format();
                $scope.downloadMapName = "StructureMap-"+ map.id + '-' + now + '.json';

            }


            //convert the map into an SM resource using $convert, then update the SM resource if the conversion was successful...
            $scope.updateStructureMap = function(cb) {

                delete $scope.transformMessage;         //if set, transformMessage hides the transform button
                delete $scope.convertError;

                if (! $scope.input.mappingFile) {
                    alert("There must be some text in the mapping file before the StructureMap can be created")
                    return;
                }

                if ($scope.currentSM.publisher !== $scope.user.email) {
                    alert("Only the publisher ("+$scope.currentSM.publisher+") can update the map. You can make a copy using the 'Copy Map' button.")
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

                        //console.log(data.data)


                        makeDownload(structureMapResource)

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
                delete $scope.validateResult;
                delete $scope.output;
                delete $scope.convertError;
                delete $scope.transformError;
                $scope.transformMessage = "Executing map on server, please wait...";
                //https://vonk.fire.ly/StructureMap/dh/$transform
                //let url = $scope.serverRoot + "StructureMap/" + $scope.structureMapId + "/$transform";
                let url = $scope.serverRoot + "StructureMap/" + $scope.currentSM.id + "/$transform";

                //if the inpput is a resource then post directly. Otherwise must use a Paramaters

                let content = $scope.input.inputJson;
                try {
                    let json = angular.fromJson($scope.input.inputJson);
                    if (! json.resourceType) {
                        content = {resourceType:'Parameters',parameter:[]};
                        content.parameter.push({name:'content',valueString:$scope.input.inputJson});
                    }
                } catch (ex) {
                    alert("The sample is not valid Json. Please correct and retry...");
                    delete $scope.transformMessage;
                    return;
                    //console.log("Invalid Json as input...")
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

                let options = {bundle:bundle,hashErrors: {},serverRoot:$scope.serverRoot}
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

            $scope.refreshHistory = function() {
                $scope.history = [];
                let url = $scope.serverRoot + "StructureMap/"+$scope.currentSM.id + "/_history";
                $scope.waiting = true;
                $http.get(url).then(
                    function(data) {
                        console.log(data.data)
                        if (data.data && data.data.entry) {
                            data.data.entry.forEach(function (entry) {
                                let map = entry.resource;
                                if (map.resourceType == 'StructureMap') {
                                    let vo = {};
                                    vo.date = map.meta.lastUpdated;
                                    let mf = getStringExtension(map,extMapUrl);
                                    if (mf.length > 0) {
                                        vo.map = mf[0]
                                    }
                                    let ex = getStringExtension(map,extExampleUrl);
                                    if (ex.length > 0) {
                                        vo.example  = ex[0]
                                    }
                                    $scope.history.push(vo)
                                }

                            })
                        }
                    },
                    function(err) {
                        console.log(err)
                    }
                ).finally(
                    function () {
                        $scope.waiting = false;
                    }
                )
            }

            $scope.showHistoryItem = function(hx) {
                $scope.hxItem = hx;
            };

            //draws a logical model tree
            function drawTree(treeData) {

                $('#lmTreeView').jstree('destroy');
                $('#lmTreeView').jstree(
                    {'core': {'multiple': false, 'data': treeData, 'themes': {name: 'proton', responsive: true}}}

                ).on('changed.jstree', function (e, data) {
                    //seems to be the node selection event...

                    if (data.node) {
                        let selectedNode = data.node;
                        $scope.selectedNodeED = selectedNode.data.ed

                        console.log(data.node)
                    }

                    $scope.$digest();       //as the event occurred outside of angular...

                })/*
                    .on('redraw.jstree', function (e, data) {

                    //ensure the selected node remains so after a redraw...
                    if ($scope.treeIdToSelect) {
                        $("#lmTreeView").jstree("select_node", "#"+$scope.treeIdToSelect);
                        delete $scope.treeIdToSelect
                    }

                })
                    .on('open_node.jstree',function(e,data){

                    //set the opened status of the scope property to the same as the tree node so we can remember the state...
                    $scope.treeData.forEach(function(node){
                        if (node.id == data.node.id){
                            node.state.opened = data.node.state.opened;
                        }
                    });


                    $scope.$digest();
                })
                    .on('close_node.jstree',function(e,data){

                    //set the opened status of the scope propert to the same as the tree node so we can remember the state...
                    $scope.treeData.forEach(function(node){
                        if (node.id == data.node.id){
                            node.state.opened = data.node.state.opened;
                        }
                    })
                    $scope.$digest();
                });*/
            }

            $scope.showLM = function(canonicalUrl) {
                delete $scope.lmTreeViewError;
                let url = $scope.adminRoot + "StructureDefinition?url="+ canonicalUrl;
                $scope.showWaiting=true;
                $http.get(url).then(
                    function(data) {
                        if (data.data && data.data.entry && data.data.entry.length > 0) {

                            let resource;
                            data.data.entry.forEach(function (ent){
                                if (ent.resource && ent.resource.resourceType == 'StructureDefinition') {
                                    resource = ent.resource;
                                }
                            } )

                            if (resource) {
                                if (!resource.snapshot) {
                                    resource.snapshot = resource.differential;
                                }

                                $scope.selectedLM = resource;
                                let treeData = logicalModelSvc.createTreeArrayFromSD(resource);


                                drawTree(treeData)
                            } else {
                                $scope.lmTreeViewError = "The model with the url: "+canonicalUrl +" was not located on the Mapping Server"
                            }


                        }
                    },
                    function(err) {
                        alert(angular.toJson(err))
                    }
                ).finally(function () {
                    $scope.showWaiting=false;
                })

            };

            $scope.importModel = function(url) {
                $scope.showWaiting=true;
                mappingSvc.importModel(url,$scope.confServer,$scope.adminRoot).then(
                    function(data) {
                        alert('Model has been imported')
                    },
                    function(err) {
                        alert('There was an error: ' + angular.toJson(err))
                    }
                ).finally(function(){ $scope.showWaiting=false;})
            }
        }
    );
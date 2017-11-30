
angular.module("sampleApp").controller('extensionDefCtrl',
        function ($rootScope,$scope,$uibModal,appConfigSvc,GetDataFromServer,Utilities,modalService,
                  RenderProfileSvc,$http,currentExt,securitySvc,edBuilderSvc) {

            $scope.childElements = [];      //array of child elements
            $scope.input ={};
            $scope.input.multiplicity = 'opt';
            $scope.selectedResourcePaths = [];

            //if being edited...
            if (currentExt) {

                var parsedED = edBuilderSvc.parseED(currentExt);
                $scope.canSaveEd = true;
                $scope.currentExt = currentExt;

                $scope.input.name = parsedED.extensionName; //currentExt.name;
                $scope.input.url = parsedED.url;// currentExt.url;
                $scope.input.description = parsedED.description; // currentExt.description;
                $scope.input.short = parsedED.short; //currentExt.short;
                $scope.input.publisher = parsedED.publisher; //) currentExt.publisher;
                $scope.selectedResourcePaths = parsedED.selectedResourcePaths;      //the types (actually paths) where this extension can be applied
                $scope.childElements = parsedED.childElements;

            }

            RenderProfileSvc.getAllStandardResourceTypes().then(
                function(standardResourceTypes) {
                    $scope.allResourceTypes = standardResourceTypes;       //use to define the context for an extension...
                }
            );

            $scope.conformanceSvr = appConfigSvc.getCurrentConformanceServer();

            //not sure about this...
            if ($rootScope.userProfile && $rootScope.userProfile.extDef) {
                $scope.input.publisher = $rootScope.userProfile.extDef.defaultPublisher;
            }


            $scope.removeResourceType = function(inx) {
                $scope.selectedResourcePaths.splice(inx,1);
                makeSD();
            };

            $scope.save = function() {
                delete $scope.validateResults;
                $scope.showWaiting = true;
                var sd = makeSD();

                if (validate(sd)){

                    var url = $scope.conformanceSvr.url + 'StructureDefinition/'+sd.id;
                    $http.put(url,sd).then(
                        function(data){

                            modalService.showModal({}, {bodyText:"Extension has been saved."}).then(function (result) {

                            },function(){
                                //this is the 'cancel' option - but it's the one fired when there's only a single button...
                                $scope.$close({url:url,sd:sd});

                            })

                        }, function(err){
                            console.log(err)
                            $scope.validateResults = err.data;
                        }
                    ).finally(function(){
                        $scope.showWaiting = false;
                    });

                } else {
                    $scope.showWaiting = false;
                }

            };
            

            //?? should do this when about to save as well
            $scope.checkEDExists = function(name) {
                /*
                if (name.indexOf(' ') > -1) {
                    modalService.showModal({}, {bodyText:"Sorry, no spaces in the name."})
                    return;
                }
*/

                if (! /^[A-Za-z0-9\-\.]{1,64}$/.test(name)) {
                    var msg = "The name can only contain upper and lowercase letters, numbers, '-' and '.'"
                    modalService.showModal({},{bodyText:msg})
                    return
                }

                var url = $scope.conformanceSvr.url + "StructureDefinition/"+name;
                $scope.showWaiting = true;
                GetDataFromServer.adHocFHIRQuery(url).then(
                    function(data){
                        console.log(data);


                        modalService.showModal({}, {bodyText:"Sorry, this name is already in use."})

                    },function(err){
                        console.log(err);
                        //as long as the status is 404 or 410, it's save to create a new one...
                        if (err.status == 404 || err.status == 410) {
                            $scope.canSaveEd = true;

                            var cannonicalUrl =  $scope.conformanceSvr.realUrl || $scope.conformanceSvr.url;
                            $scope.input.url = cannonicalUrl + "StructureDefinition/"+name;
                            makeSD();


                        } else {
                            var config = {bodyText:'Sorry, there was an unknown error: '+angular.toJson(err,true)};
                            modalService.showModal({}, config)

                        }
                    }).finally(function(){
                    $scope.showWaiting = false;
                })
            };


            $scope.addContext = function(){
                $uibModal.open({
                    templateUrl: 'modalTemplates/addContext.html',
                    controller: function ($scope,allResourceTypes,GetDataFromServer) {
                        var that = this;
                        $scope.input = {};
                        $scope.allResourceTypes = allResourceTypes;

                        $scope.add= function () {
                            var vo = {path:$scope.input.path};
                            $scope.$close(vo)
                        }

                        $scope.selectContextType = function(type) {
                            //get the paths for the given type...

                            var url = "http://hl7.org/fhir/StructureDefinition/"+type.name
                            console.log(url)
                            GetDataFromServer.findConformanceResourceByUri(url).then(
                                function(profile) {
                                    $scope.paths = [];
                                    if (profile && profile.snapshot && profile.snapshot.element) {
                                        profile.snapshot.element.forEach(function(ed){
                                            var path = ed.path;
                                            var ar = path.split('.')
                                            if (['id','meta','implicitRules','language','contained','extension','modifierExtension'].indexOf(ar[ar.length-1]) == -1){
                                                $scope.paths.push(path);
                                            }
                                        })
                                    }
                                    $scope.input.path = $scope.paths[0];

                                },
                                function(err) {
                                    console.log(err)
                                }
                            )
                        };

                    },
                    resolve  : {
                        allResourceTypes: function () {          //the default config
                            return $scope.allResourceTypes;
                        }
                    }
                }).result.then(
                    function(result) {
                        var contextPath = result.path;
                        if (contextPath) {
                            if ($scope.selectedResourcePaths.indexOf(contextPath) == -1) {
                                $scope.selectedResourcePaths.push(contextPath)

                                makeSD();
                            }
                        }
                    })
            };

            //add a new child element...
            $scope.addChild = function () {
                $uibModal.open({
                    templateUrl: 'modalTemplates/newExtensionChild.html',
                    controller: function($scope,resourceCreatorSvc){
                        var that = this;

                        $scope.selectedDataTypes = [];     //array of selected datatypes
                        $scope.dataTypes = resourceCreatorSvc.getDataTypesForProfileCreator();

                        //add a new type for this child
                        $scope.addDataType = function () {
                            //make sure it's not already in the list of selected types...
                            for (var i=0; i< $scope.selectedDataTypes.length; i++){
                                if ($scope.selectedDataTypes[i].description == $scope.dataType.description) {
                                    return;
                                    break;
                                }
                            }

                            $scope.selectedDataTypes.push($scope.dataType)

                        };

                        $scope.removeDT = function(inx) {
                            $scope.selectedDataTypes.splice(inx,1)
                        };






                        $scope.setBinding = function(dt) {
                            console.log(dt);
                            $uibModal.open({
                                backdrop: 'static',      //means can't close by clicking on the backdrop.
                                keyboard: false,       //same as above.
                                templateUrl: 'modalTemplates/vsFinder.html',
                                size: 'lg',
                                controller : 'vsFinderCtrl',
                                resolve  : {
                                    currentBinding: function () {          //the default config
                                        return {};
                                    }
                                }
                            }).result.then(
                                function (vo) {
                                    //vo is {vs,strength}
                                    console.log(vo)
                                    dt.vs = vo;         //save the valueset against the datatype
                                }
                            )
                        };

                        $scope.save = function(){
                            var result = {};
                            result.code = $scope.code;
                            result.description = $scope.description;
                            result.dataTypes = $scope.selectedDataTypes;
                            $scope.$close(result);

                        }

                    }
                }).result.then(
                    //this is called when the 'add child element' has been saved
                    function(result) {
                        //console.log(result)



                        $scope.childElements.push(result);
                        makeSD(); //update the SD for display...
                    })
                };


            $scope.removeChild = function(inx){
                $scope.childElements.splice(inx,1)

            };

            var validate = function(sd) {
                //return true;
                var err = "";
                //a single element brings at least 3 entries in the element[] array...
                if (sd.snapshot.element.length < 3) {
                    err += 'There must be at least one element in the extension'
                }

                if (err) {
                    var config = {bodyText:err}
                    modalService.showModal({}, config).then(function (result) {
                       return false;
                    })
                } else {
                    return true;
                }
            };

            //hide the outcome of the validate operation...
            $scope.closeValidationOutcome = function(){
                delete $scope.validateResults;
            };

            //build the StructureDefinition that describes this extension
            makeSD = function() {
                //here is where we construct the vo and call the makeSD service...
                var voED = {};
                voED.extensionName = $scope.input.name;
                voED.description = $scope.input.description;
                voED.short = $scope.input.short;
                voED.url =  $scope.input.url;
                voED.publisher = $scope.input.publisher;
                voED.selectedResourcePaths = $scope.selectedResourcePaths;
                voED.fhirVersion = appConfigSvc.getCurrentConformanceServer().version;
                voED.multiplicity = $scope.input.multiplicity;
                voED.childElements = $scope.childElements;

                var extensionDefinition = edBuilderSvc.makeED(voED);
                $scope.jsonED = extensionDefinition;    //just for display

                console.log(edBuilderSvc.parseED(extensionDefinition))
                return extensionDefinition;

            };
    }



);
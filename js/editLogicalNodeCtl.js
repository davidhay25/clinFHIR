
angular.module("sampleApp")
    .controller('editLogicalNodeCtrl',
        function ($scope,allDataTypes,editNode,parentPath,RenderProfileSvc,
                  findNodeWithPath,rootForDataType,igSvc,references,baseType,$uibModal, logicalModelSvc) {


                $scope.references = references;
                console.log(references);
                $scope.rootForDataType = rootForDataType;
                $scope.canSave = true;
                $scope.allDataTypes = allDataTypes;
                $scope.parentPath = parentPath;
                $scope.pathDescription = 'Parent path';
                $scope.vsInGuide = igSvc.getResourcesInGuide('valueSet');       //so we can show the list of ValueSets in the IG
                $scope.input = {};

                RenderProfileSvc.getAllStandardResourceTypes().then(
                    function(data){
                        $scope.allResourceTypes = data;
                    });


                for (var i=0; i< $scope.allDataTypes.length; i++) {
                    if ($scope.allDataTypes[i].code == 'string') {
                        $scope.input.dataType = $scope.allDataTypes[i];
                        break;
                    }
                }


                $scope.input.multiplicity = 'opt';
                $scope.fhirMapping = function(map) {
                    $scope.isExtension = false;
                    if (map && map.indexOf('xtension') > -1) {
                        $scope.isExtension = true;
                    }
                };

                if (baseType) {

                    logicalModelSvc.getAllPathsForType(baseType).then(
                        function(listOfPaths) {
                            //console.log(listOfPaths);
                            $scope.allPaths = listOfPaths;
                        }
                    )

                }


                if (editNode) {
                    //editing an existing node
                    $scope.pathDescription = 'Path'
                    var data = editNode.data;
                    $scope.input.name = data.name;
                    $scope.input.short= data.short;
                    $scope.input.description = data.description;
                    $scope.input.comments = data.comments;
                    $scope.input.mapping = data.mapping;
                    $scope.input.mappingPath = data.mappingPath;
                    $scope.fhirMapping(data.mappingPath);       //check for an extension
                    $scope.input.fixedString = data.fixedString;
                    $scope.input.mappingPathV2 = data.mappingPathV2;

                    $scope.input.mappingFromED = angular.copy(data.mappingFromED);    //all the current mappings. Only want to update on save...

                    $scope.input.fhirMappingExtensionUrl = data.fhirMappingExtensionUrl;

                    if (data.min == 0) {
                        $scope.input.multiplicity = 'opt';
                        if (data.max == '*') {$scope.input.multiplicity = 'mult'}
                    }
                    if (data.min == 1){
                        $scope.input.multiplicity = 'req';
                        if (data.max == '*') {$scope.input.multiplicity = 'multreq'}
                    }

                    var dt = data.type[0].code;     //only the first datatype (we only support 1 right now)
                    $scope.allDataTypes.forEach(function(dt1){
                        if (dt1.code == dt) {
                            $scope.input.dataType = dt1;
                        }
                    });

                    //set the dropdown if this is a valueset from the IG...
                    if (data.selectedValueSet && data.selectedValueSet.vs){
                        $scope.isCoded = true;
                        $scope.vsInGuide.forEach(function(vs){
                            if (vs.sourceUri ==data.selectedValueSet.vs.url) {
                                $scope.input.vsFromIg = vs
                            }
                        })
                    }


                    $scope.selectedValueSet = data.selectedValueSet;


                    //if this is a reference, set the initial reference
                    if (dt == 'Reference') {
                        var profileUrl = data.type[0].targetProfile || data.type[0].profile;     //only the first datatype (we only support 1 right now)
                        $scope.references.entry.forEach(function(ent){
                            if (ent.resource.url == profileUrl) {
                                $scope.input.referenceFromIg = ent;
                                $scope.dt = {code: 'Reference', isReference: true}; //to show the reference...
                            }
                        })
                    }

                    //this is the url of the model that this item (and it's children) will map to
                    if (data.mapToModelUrl) {
                        $scope.references.entry.forEach(function(ent){
                            if (ent.resource.url == data.mapToModelUrl) {
                                $scope.input.mapToModelEnt = ent;
                                //$scope.dt = {code: 'Reference', isReference: true}; //to show the reference...
                            }
                        })
                    }

                }


                $scope.selectExistingExtension = function(){

                    $uibModal.open({

                        templateUrl: 'modalTemplates/searchForExtension.html',
                        size:'lg',
                        controller: function($scope,resourceType,GetDataFromServer,appConfigSvc,Utilities,resourceType){
                            $scope.resourceType = resourceType;
                            //$scope.allDataTypes = allDataTypes;
                            var conformanceSvr = appConfigSvc.getCurrentConformanceServer();
                            var qry = conformanceSvr.url + "StructureDefinition?";

                            qry += 'type=Extension';

                            $scope.qry = qry;


                            $scope.conformanceServerUrl = conformanceSvr.url;
                            $scope.showWaiting = true;
                            GetDataFromServer.adHocFHIRQueryFollowingPaging(qry).then(

                                function(data) {
                                    //filter out the ones not for this resource type. Not sure if this can be done server side...
                                    $scope.bundle = {entry:[]}
                                    if (data.data && data.data.entry) {
                                        data.data.entry.forEach(function(entry){
                                            var include = false;
                                            if (entry.resource) {
                                                if (! entry.resource.context) {
                                                    include = true;
                                                } else  {
                                                    entry.resource.context.forEach(function(ctx){
                                                        if (ctx == '*' || ctx == 'Element' ||  ctx.indexOf(resourceType) > -1) {
                                                            include = true;
                                                        }
                                                    })
                                                }
                                            }


                                            if (include) {
                                                $scope.bundle.entry.push(entry)
                                            }

                                        })
                                    }

                                    $scope.bundle.entry.sort(function(a,b){
                                        try {
                                            if (a.resource && b.resource) {
                                                if (a.resource.name.toUpperCase() > b.resource.name.toUpperCase()) {
                                                    return 1
                                                } else {
                                                    return -1;
                                                }
                                            } else {
                                                return 0
                                            }
                                        } catch (ex) {
                                            return 0;
                                        }



                                    });

                                    //$scope.bundle = data.data;
                                    console.log($scope.bundle);
                                }
                            ).finally(function(){
                                $scope.showWaiting = false;
                            });

                            $scope.selectExtension = function(ent) {
                                $scope.selectedExtension = ent.resource
                                $scope.analyse = Utilities.analyseExtensionDefinition3($scope.selectedExtension)
                                console.log($scope.analyse)

                                /*
                                 //set the dataType
                                 if ($scope.analyse && $scope.analyse.dataTypes && $scope.analyse.dataTypes.length > 0) {
                                 //a simple element...
                                 var dt = $scope.analyse.dataTypes[0].code; // the datatype as a string...
                                 setDataType(dt);

                                 }
                                 */

                            }
                            /*
                             function setDataType(dtString) {
                             for (var i=0; i< $scope.allDataTypes.length; i++) {
                             if ($scope.allDataTypes[i].code == dtString) {
                             $scope.input.dataType = $scope.allDataTypes[i];
                             break;
                             }
                             }
                             }
                             */

                        },
                        resolve : {
                            resourceType: function () {          //the default config

                                return baseType;

                            },
                            allDataTypes : function(){
                                return $scope.allDataTypes;
                            }
                        }
                    }).result.then(
                        function(extensionDef) {
                            //an extension definition was selected
                            console.log(extensionDef);
                            if (extensionDef && extensionDef.url) {
                                $scope.input.fhirMappingExtensionUrl = extensionDef.url;

                                var analyse = Utilities.analyseExtensionDefinition3(extensionDef)

                                if (analyse.isComplexExtension) {
                                    setDataType('BackboneElement');
                                } else if (analyse && analyse.dataTypes && analyse.dataTypes.length > 0) {
                                    //a simple element...
                                    var dt = analyse.dataTypes[0].code; // the datatype as a string...
                                    setDataType(dt);
                                }


                                function setDataType(dtString) {
                                    for (var i=0; i< $scope.allDataTypes.length; i++) {
                                        if ($scope.allDataTypes[i].code == dtString) {
                                            $scope.input.dataType = $scope.allDataTypes[i];
                                            break;
                                        }
                                    }
                                }

                            }

                        }
                    );

                };


                $scope.checkName = function(){
                    $scope.canSave = true;
                    if (! $scope.input.name) {
                        //if (! $scope.input.name || $scope.input.name.indexOf('0') > -1) { ????? why look for 0 ???
                        $scope.canSave = false;
                        modalService.showModal({},{bodyText:"The name cannot have spaces in it. Try again."})
                    }

                    var pathForThisElement = parentPath + '.'+$scope.input.name;
                    var duplicateNode = findNodeWithPath(pathForThisElement)
                    if (duplicateNode) {
                        $scope.canSave = false;
                        modalService.showModal({},{bodyText:"This name is a duplicate of another and cannot be used. Try again."})
                    }

                    if ($scope.canSave) {
                        //set the short element to the same as the name
                        $scope.input.short = $scope.input.name;
                    }
                };


                $scope.removeMap = function(inx) {
                    $scope.input.mappingFromED.splice(inx,1)
                }

                $scope.addNewMap = function(identity,map) {
                    $scope.input.mappingFromED.push({identity:identity,map:map})
                    delete $scope.input.newMapIdentity;
                    delete $scope.input.newMapValue;

                }

                $scope.save = function() {
                    var vo = {};
                    vo.name = $scope.input.name;
                    vo.short = $scope.input.short;
                    vo.description = $scope.input.description || 'definition';
                    vo.comments = $scope.input.comments;
                    vo.mapping = $scope.input.mapping;
                    vo.mappingPath = $scope.input.mappingPath;      //this is the FHIR path

                    vo.mappingFromED = $scope.input.mappingFromED;      //all mappings


                    //if mapping to an extension, the include the oath to the extension
                    if (vo.mappingPath && vo.mappingPath.indexOf('xtension') > -1) {
                        vo.fhirMappingExtensionUrl = $scope.input.fhirMappingExtensionUrl
                    }

                    vo.mappingPathV2 = $scope.input.mappingPathV2;
                    vo.type = [{code:$scope.input.dataType.code}];
                    vo.editNode = editNode;
                    vo.parentPath = parentPath;
                    vo.fixedString = $scope.input.fixedString;
                    //coded elements...
                    if ($scope.isCoded) {
                        vo.selectedValueSet = $scope.selectedValueSet;
                        vo.isCoded = true;
                    }

                    if ($scope.input.mapToModelEnt && $scope.input.mapToModelEnt.resource) {
                        //this element is mapped to another model (eventually a profile)
                        vo.isReference = true;
                        vo.referenceUri = $scope.input.mapToModelEnt.resource.url; // for the reference table...
                        vo.mapToModelUrl = $scope.input.mapToModelEnt.resource.url;        //this is the actual model being references
                    }


                    //for a reference type...
                    if ($scope.input.dataType.code == 'Reference') {
                        //vo.referenceUri = $scope.input.referenceFromIg.resource.url;

                        //set the default to any...
                        vo.referenceUri = "http://hl7.org/fhir/StructureDefinition/Resource";
                        vo.type[0].targetProfile = vo.referenceUri;

                        if ($scope.input.referenceFromIg) {
                            vo.isReference = true;
                            vo.referenceUri = $scope.input.referenceFromIg.resource.url; // for the reference table...
                            // (this is the older stu3 veriosn)  vo.type[0].profile = $scope.input.referenceFromIg.resource.url;
                            vo.type[0].targetProfile = $scope.input.referenceFromIg.resource.url;   //not quite sure why we need both...
                            console.log($scope.input.referenceFromIg)
                        }

                    }



                    switch ($scope.input.multiplicity) {
                        case 'mult' :
                            vo.min =0; vo.max='*';
                            break;
                        case 'opt' :
                            vo.min =0; vo.max='1';
                            break;
                        case 'req' :
                            vo.min =1; vo.max='1';
                            break;
                        case 'multreq' :
                            vo.min =1; vo.max='*';
                            break;
                    }

                    //input.referenceFromIg

                    $scope.$close(vo);
                };

                $scope.setDataType = function(dt) {
                    $scope.dt = dt;
                    console.log(dt);
                    $scope.isCoded = false;
                    if (dt.isCoded) {
                        $scope.isCoded = true;
                    }
                    /*
                     if (dt.code == 'Extension') {
                     $scope.isExtension = true;
                     }
                     */

                }

                $scope.selectVsFromServer = function(){
                    $uibModal.open({
                        backdrop: 'static',      //means can't close by clicking on the backdrop.
                        keyboard: false,       //same as above.
                        templateUrl: 'modalTemplates/vsFinder.html',
                        size: 'lg',
                        controller: 'vsFinderCtrl',
                        resolve  : {
                            currentBinding: function () {          //the default config
                                return {};
                            }
                        },
                        controllerDEP: function ($scope, appConfigSvc, GetDataFromServer) {
                            //this code is all from vsFinderCtrl controller - for some reason I can't reference it from here...
                            //and newExtensionDefinition
                            $scope.input = {};

                            var config = appConfigSvc.config();
                            $scope.termServer = config.servers.terminology;

                            $scope.input.arStrength = ['required', 'extensible', 'preferred', 'example'];
                            $scope.input.strength = 'preferred'; //currentBinding.strength;


                            $scope.select = function () {

                                $scope.$close({
                                    vs: $scope.input.vspreview,
                                    strength: $scope.input.strength
                                });
                            };

                            //find matching ValueSets based on name
                            $scope.search = function (filter) {
                                $scope.showWaiting = true;
                                delete $scope.message;
                                delete $scope.searchResultBundle;

                                var url = $scope.termServer + "ValueSet?name=" + filter;
                                $scope.showWaiting = true;

                                GetDataFromServer.adHocFHIRQueryFollowingPaging(url).then(
                                    //GetDataFromServer.adHocFHIRQuery(url).then(
                                    function (data) {
                                        $scope.searchResultBundle = data.data;
                                        if (!data.data || !data.data.entry || data.data.entry.length == 0) {
                                            $scope.message = 'No matching ValueSets found'
                                        }
                                    },
                                    function (err) {
                                        alert(angular.toJson(err))
                                    }
                                ).finally(function () {
                                    $scope.showWaiting = false;
                                })
                            };
                        }
                    }).result.then(
                        function (vo) {
                            //vo is {vs,strength}
                            console.log(vo)
                            $scope.selectedValueSet = vo;
                            dt.vs = vo;         //save the valueset against the datatype
                        }
                    )
                };

                $scope.selectVsFromIg = function(){
                    var vs = $scope.input.vsFromIg;
                    var vo={vs:{url:vs.sourceUri,name:vs.name},strength:'preferred'}
                    $scope.selectedValueSet = vo;
                    dt.vs = vo;

                    console.log(vo)

                }







    })

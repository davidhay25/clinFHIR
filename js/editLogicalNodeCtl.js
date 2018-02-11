
angular.module("sampleApp")
    .controller('editLogicalNodeCtrl',
        function ($scope,allDataTypes,editNode,parentPath,RenderProfileSvc,appConfigSvc, allResourceTypes,treeData,Utilities,
                  findNodeWithPath,rootForDataType,igSvc,references,baseType,$uibModal, logicalModelSvc, modalService,$timeout) {

            $scope.appConfigSvc = appConfigSvc;
            $scope.allResourceTypes = allResourceTypes;
            $scope.references = references;    // a bundle containing all the LogicalModels...
            $scope.rootForDataType = rootForDataType;
            $scope.canSave = true;
            $scope.allDataTypes = allDataTypes;
            $scope.parentPath = parentPath;
            $scope.pathDescription = 'Parent path';
            $scope.vsInGuide = igSvc.getResourcesInGuide('valueSet');       //so we can show the list of ValueSets in the IG
            $scope.input = {};

            var baseTypeUrl = appConfigSvc.config().standardExtensionUrl.baseTypeForModel;

            var that = this;


            //the display of logical models.
            $scope.lmDisplay = function(resource) {
                var baseType = Utilities.getSingleExtensionValue(resource,baseTypeUrl);
                if (baseType && baseType.valueString) {
                    return resource.name + "   ("+ baseType.valueString + ")";
                } else {
                    return resource.name;
                }





            }

            //NOT WORKING RIGHT NOW...
            function setOptionsForDtAndPathDep() {
                var path = $scope.input.mappingPath;    //the path in the fhor mapping
                if ($scope.input.dataType && path) {
                    var config = $scope.dtDef[$scope.input.dataType.code]

                    if (config) {
                        //if there's a config object for this datatype, does the path have an options set?
                        var ar = path.split('.');
                        var segment = ar[ar.length-1];
                        if (config[segment].options) {
                            console.log(config[segment].options)
                        }
                    }
                }


            }


            $scope.fhirMapping = function(map) {
                $scope.isExtension = false;
                if (map && map.indexOf('xtension') > -1) {
                    $scope.isExtension = true;
                }
            };


            //when a fhir path is selected from the type-ahead...
            $scope.fhirPathSelect = function(item) {
                console.log(item)
                //if the name is empty, set it to the last value in the path and set the datatype...
                if (! $scope.input.name && item) {

                    var ed = $scope.allPathsHash[item];
                    if (ed && ed.type) {
                        //set the datatype to the first type in the list...
                        var code = ed.type[0].code; // the datatype as a string...

                        for (var i=0; i< $scope.allDataTypes.length; i++) {
                            if ($scope.allDataTypes[i].code == code ){
                                var dt = $scope.allDataTypes[i];

                                //split off the datatype from the name
                                var ar = item.split('.');
                                var name = ar[ar.length-1];
                                name = name.replace(dt.code,'');
                                $scope.input.name = name;


                                $scope.input.dataType = dt;
                                $scope.setDataType(dt);

                            }
                        }

                        if (ed && ed.binding) {
                            //this is a coded element...
                            var ref = ed.binding.valueSetReference;
                            if (ref) {
                                var url = ref.reference;
                                var ar = url.split('/');
                                var name = ar[ar.length-1];
                                var vo={vs:{url:url,name:name},strength:ed.binding.strength}
                                $scope.selectedValueSet = vo;
                            }
                        }
                    }
                }
            };

            $scope.baseType = baseType;


            if (editNode) {
                setup(editNode);
            } else {
                for (var i=0; i< $scope.allDataTypes.length; i++) {
                    if ($scope.allDataTypes[i].code == 'string') {
                        $scope.input.dataType = $scope.allDataTypes[i];
                        break;
                    }
                }

                $scope.input.multiplicity = 'opt';
            }


            if (baseType) {
                //get all the paths - including expanding logical models...
                logicalModelSvc.getAllPathsForType(baseType,true).then(
                    function(listOfPaths) {
                        $scope.allPaths = listOfPaths.list;
                        $scope.allPathsHash = listOfPaths.hash;
                        $scope.dtDef = listOfPaths.dtDef;       //the definitions for a path (use to get the options)...
                    },function(err) {
                        alert("A Base type of "+ baseType +" was selected, but I couldn't locate the profile to get the element paths")
                    }
                )

            }



            function setup(node) {

               // if (editNode) {
                    //editing an existing node
                    $scope.pathDescription = 'Path'
                    var data = node.data;
                    $scope.input.name = data.name;
                    $scope.input.pathSegment = data.pathSegment;
                    $scope.input.short= data.short;
                    $scope.input.description = data.description;
                    $scope.input.comments = data.comments;
                    $scope.input.mapping = data.mapping;

                    $scope.input.conceptMap = data.conceptMap;

                    //$scope.input.mappingPath = data.mappingPath;
                    $scope.fhirMapping(data.mappingPath);       //check for an extension
                    $scope.input.fixedString = data.fixedString;
                    //$scope.input.mappingPathV2 = data.mappingPathV2;

                    $scope.input.mappingFromED = angular.copy(data.mappingFromED);    //all the current mappings. Only want to update on save...

                    $scope.input.mappingPath = getMapValueForIdentity('fhir');

                    if ($scope.input.mappingPath && $scope.input.mappingPath.indexOf('xtension')>-1) {
                        $scope.isExtension = true;
                    }

                    isDiscriminatorRequired();      //true if there is another fhir mapping the same
                    $scope.input.mappingPathV2 = getMapValueForIdentity('hl7V2');
                    $scope.input.mappingPathSnomed = getMapValueForIdentity('snomed');

                    $scope.input.fhirMappingExtensionUrl = data.fhirMappingExtensionUrl;


                    if (data.min == 0) {
                        $scope.input.multiplicity = 'opt';
                        if (data.max == '*') {$scope.input.multiplicity = 'mult'}
                    }
                    if (data.min == 1){
                        $scope.input.multiplicity = 'req';
                        if (data.max == '*') {$scope.input.multiplicity = 'multreq'}
                    }


                    if (! data.type) {
                        alert("For some reason the 'type' element is absent. Setting it to a string.")
                        data.type = [{code:'string'}]
                    }


                    $scope.dt = data.type[0];   //the selected datatype...
                    var dtCode = data.type[0].code;     //only the first datatype (we only support 1 right now)


                    //$timeout(setOptionsForDtAndPath,1000);      //check options for this dt & path (need to wait for the config to be loaded

                if (dtCode == 'code' || dtCode == 'Coding' || dtCode == 'CodeableConcept') {
                    $scope.isCoded = true;
                }

                    $scope.allDataTypes.forEach(function(dt1){
                        if (dt1.code == dtCode) {
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
                    if (dtCode == 'Reference') {

                        //for a core type reference, find the name of the type (it's the last segment in the url)
                        if (data.type) {
                            var profileUrl = data.type[0].targetProfile;    //normalized to this...
                            if (profileUrl) {
                                var ar = profileUrl.split('/');
                                var typeName = ar[ar.length-1];

                                //this is for references to core types....
                                $scope.allResourceTypes.forEach(function(typ){
                                    if (typ.name == typeName) {
                                        $scope.input.referenceToCoreFromIg = typ
                                    }
                                });


                                //this is for references to Logical Models
                                $scope.references.entry.forEach(function(ent){
                                    if (ent.resource.url == profileUrl) {
                                        $scope.input.referenceFromIg = ent;


                                    }
                                })
                            }

                        }

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

              //  }


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



                        $scope.filter = function(txt) {
                           // console.log(txt)
                            if (txt) {
                                $scope.bundle = filter(txt.toLowerCase())
                            }

                        };

                        $scope.conformanceServerUrl = conformanceSvr.url;
                        $scope.showWaiting = true;
                        GetDataFromServer.adHocFHIRQueryFollowingPaging(qry).then(

                            function(data) {
                                //filter out the ones not for this resource type. Not sure if this can be done server side...
                                $scope.allExtensionsBundle = data.data;     //all the extensions

                                $scope.bundle = filter()

                                /*
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
                                */

                                /*
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
*/
                                //$scope.bundle = data.data;

                            }
                        ).finally(function(){
                            $scope.showWaiting = false;
                        });


                        function filter(txt) {
                            var bundle = {entry:[]}

                            if (! $scope.allExtensionsBundle) {
                                return;
                            }

                            $scope.allExtensionsBundle.entry.forEach(function(entry){
                                var include = false;
                                if (entry.resource) {
                                    if (! entry.resource.context) {
                                        include = true;
                                    } else  {
                                        entry.resource.context.forEach(function(ctx){
                                            if (ctx == '*' || ctx == 'Element' ||  ctx.indexOf($scope.resourceType) > -1) {
                                                include = true;

                                                if (txt && entry.resource.name && entry.resource.name.toLowerCase().indexOf(txt)== -1 ) {
                                                    include = false;
                                                }


                                            }
                                        })
                                    }
                                }


                                if (include) {
                                    bundle.entry.push(entry);
                                }


                            });

                            bundle.entry.sort(function(a,b){
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

                            return bundle;

                        }

                        $scope.selectExtension = function(ent) {
                            $scope.selectedExtension = ent.resource
                            $scope.analyse = Utilities.analyseExtensionDefinition3($scope.selectedExtension)

                            //need to pass this back so we can add children of complex extensions...
                           // $scope.selectedExtension = $scope.analyse;



                            /*
                             //set the dataType
                             if ($scope.analyse && $scope.analyse.dataTypes && $scope.analyse.dataTypes.length > 0) {
                             //a simple element...
                             var dt = $scope.analyse.dataTypes[0].code; // the datatype as a string...
                             setDataType(dt);

                             }
                             */

                        }
                        

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
                        //an extension definition was selected -

                        if (extensionDef && extensionDef.url) {
                            $scope.isDirty = true;
                            $scope.input.fhirMappingExtensionUrl = extensionDef.url;

                            //need to pass the analyse object
                           // $scope.extensionAnalyse = extensionDef.analyse;


                            var analyse = Utilities.analyseExtensionDefinition3(extensionDef)

                            if (analyse.isComplexExtension) {
                                setDataType('BackboneElement');
                            } else if (analyse && analyse.dataTypes && analyse.dataTypes.length > 0) {
                                //a simple element...
                                var dt = analyse.dataTypes[0].code; // the datatype as a string...
                                setDataType(dt);
                            }
                            $scope.extensionAnalyse = angular.copy(analyse);

                            function setDataType(dt) {
                                for (var i=0; i< $scope.allDataTypes.length; i++) {
                                    if ($scope.allDataTypes[i].code == dt) {
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

                    modalService.showModal({},{bodyText:"The name cannot be blank. Try again."})
                }



                if ($scope.input.name && $scope.input.name.indexOf(" ") > -1) {
                    $scope.canSave = false;
                    modalService.showModal({},{bodyText:"The name cannot have spaces in it. Try again."})
                }

                if ($scope.input.name && $scope.input.name.indexOf(".") > -1) {
                    $scope.canSave = false;
                    modalService.showModal({},{bodyText:"The name cannot have a dot/period (.) in it. Try again."})
                }

                //for now, only do duplicate checking for adding new nodes - not renaming - todo

                if (! editNode) {
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

                }
                isDiscriminatorRequired();

            };


            //if there is more than one entry in the model where the FHIR path is the same as the one here, then a discriminator is needed
            function isDiscriminatorRequired(){
                $scope.discriminatorReq = false;
                if ($scope.input.mappingPath) {
                    //there is a mapping
                    var cnt = 0;
                    treeData.forEach(function (node) {
                        if (node.data) {
                            var map = node.data.mappingFromED;
                            if (map) {
                                map.forEach(function (mp) {
                                    if (mp.identity == 'fhir' && mp.map == $scope.input.mappingPath) {
                                        cnt ++

                                    }
                                })
                            }

                        }

                        //if (node.path == )
                    })
                    if (cnt > 1) {
                        $scope.discriminatorReq = true;
                    }
                }


            }


                //------------ mappings functions ---------

             function getMapValueForIdentity(identity){
                 if ($scope.input.mappingFromED) {
                     for (var i =0; i <  $scope.input.mappingFromED.length; i++) {
                         var map = $scope.input.mappingFromED[i];
                         if (map.identity == identity) {
                             return map.map;
                             break;
                         }
                     }
                 }

                }

            $scope.setCurrentMap = function(identity) {
                delete $scope.currentMap;
                $scope.input.mappingFromED = $scope.input.mappingFromED || []

                $scope.input.mappingFromED.forEach(function(map){

                    if (map.identity == identity) {
                        $scope.currentMap = map;      //the current map  {identity:, map:, comment:}
                    }
                })

                if (!$scope.currentMap) {
                    $scope.currentMap = {identity:identity}
                    $scope.input.mappingFromED.push($scope.currentMap);
                }

            };

            $scope.setCurrentMap('fhir');       //'cause the first tab displayed is the fhir one...

            $scope.removeMap = function(inx) {
                $scope.input.mappingFromED.splice(inx,1)
                delete $scope.currentMap;
                $scope.isDirty = true;
            };

            //when adding a new custom map...
            $scope.addNewMap = function(identity,map) {
                $scope.input.mappingFromED = $scope.input.mappingFromED || []
                $scope.input.mappingFromED.push({identity:identity,map:map})
                delete $scope.input.newMapIdentity;
                delete $scope.input.newMapValue;
                $scope.setCurrentMap(identity)
                $scope.isDirty = true;
                delete $scope.input.addOtherMap;    //
            };


            $scope.updateCurrentMapValue = function(path) {
                if (path) {
                    $scope.currentMap.map = path;
                    $scope.isDirty = true;


                }
//setDataType(input.dataType)

            }


            $scope.deleteCurrentMap = function(){
                delete $scope.currentMap;
                $scope.isDirty = true;
            }

            $scope.cancel = function() {
                if ($scope.isDirty) {
                    var modalOptions = {
                        closeButtonText: "No, don't lose changes",
                        actionButtonText: "Yes, I've changed my mind" ,
                        headerText: 'Abandon changes',
                        bodyText: 'You have updated this item. If you continue, the changes will be lost.'
                    };

                    modalService.showModal({}, modalOptions).then(
                        function (result) {
                            $scope.$dismiss();
                        }
                    );
                } else {
                    $scope.$dismiss();
                }
            }


            $scope.save = function() {
                //if adding a new mapping and forget to click the plus
                if ($scope.input.addOtherMap) {
                    $scope.addNewMap($scope.input.newMapIdentity,$scope.input.newMapValue)
                }

                //make sure there is a vaid name. Moved here (rather than the onblur) to allow the name to be set from the fhir path...
                $scope.checkName();
                if (! $scope.canSave) {
                    return
                }
                    var vo = {};
                    vo.name = $scope.input.name;
                    vo.short = $scope.input.short;
                    vo.description = $scope.input.description || 'definition';
                    vo.comments = $scope.input.comments;
                    vo.mapping = $scope.input.mapping;
                    vo.pathSegment = $scope.input.pathSegment;

                    vo.conceptMap = $scope.input.conceptMap;

                    vo.mappingPath = $scope.input.mappingPath;      //this is the FHIR path
                    vo.mappingFromED = $scope.input.mappingFromED;      //all mappings
                    vo.mappingPathV2 = $scope.input.mappingPathV2;
                    vo.mappingPathSnomed = $scope.input.mappingPathSnomed;

                    //if mapping to an extension, the include the oath to the extension
                    if (vo.mappingPath && vo.mappingPath.indexOf('xtension') > -1) {
                        vo.fhirMappingExtensionUrl = $scope.input.fhirMappingExtensionUrl

                    }

                    //make sure the v2 & fhir mappings align with the
                    alignMap('hl7V2',vo.mappingPathV2,vo.mappingFromED)
                    alignMap('fhir',vo.mappingPath,vo.mappingFromED)
                    alignMap('snomed',vo.mappingPathSnomed,vo.mappingFromED)

                    vo.type = [{code:$scope.input.dataType.code}];
                    vo.editNode = editNode;
                    //I don't think this is used .... vo.parentPath = parentPath;
                    vo.fixedString = $scope.input.fixedString;

                    vo.extensionAnalyse = $scope.extensionAnalyse;

                    //coded elements...
                    if ($scope.isCoded) {
                        vo.selectedValueSet = $scope.selectedValueSet;
                        vo.isCoded = true;
                    }

                    if ($scope.input.mapToModelEnt && $scope.input.mapToModelEnt.resource) {
                        //this element is mapped to another model (eventually a profile)
                        vo.isReference = true;
                        vo.referenceUrl = $scope.input.mapToModelEnt.resource.url; // for the reference table...
                        vo.mapToModelUrl = $scope.input.mapToModelEnt.resource.url;        //this is the actual model being references
                    }

                    //for a reference type...
                    if ($scope.input.dataType.code == 'Reference') {

                        vo.isReference = true;
                        //set the default to any...
                        vo.referenceUrl = "http://hl7.org/fhir/StructureDefinition/Resource";
                        if ($scope.input.referenceToCoreFromIg) {
                            vo.referenceUrl = "http://hl7.org/fhir/StructureDefinition/" + $scope.input.referenceToCoreFromIg.name;
                        }

                        vo.type[0].targetProfile = vo.referenceUrl;     //we use targetProfile here - service will downgrade to R2...



                        if ($scope.input.referenceFromIg) {
                            //vo.isReference = true;
                            vo.referenceUrl = $scope.input.referenceFromIg.resource.url; // for the reference table...
                            // (this is the older stu3 veriosn)  vo.type[0].profile = $scope.input.referenceFromIg.resource.url;
                            vo.type[0].targetProfile = $scope.input.referenceFromIg.resource.url;   //not quite sure why we need both...

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



                    $scope.$close(vo);
                };


            //make sure the values in the array are the the same for fhir & hl7v2
            function alignMap(identity,value,ar) {
                if (ar) {
                    var aligned = false;
                    for (var i=0;i<ar.length;i++) {
                        var map = ar[i]
                        if (map.identity == identity) {
                            // this is the correct entry
                            if (value) {
                                map.map = value;    //change the value
                            } else {
                                ar.splice(i,1)      //no value - remove from map
                            }
                            aligned = true;
                            break;

                        }
                    }
                    if (! aligned && value) {
                        //if here, there is no value for 'identity' in the ar
                        ar.push(({identity:identity,map:value}))
                    }

                }
            }

            $scope.setDataType = function(dt) {
                $scope.isDirty = true;
                $scope.dt = dt;

                $scope.isCoded = false;
                if (dt.isCoded) {
                    $scope.isCoded = true;
                }
              //  setOptionsForDtAndPath();       //see if this datatype & path has an options element set
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


                       // console.log(vo)

                        $scope.selectedValueSet = vo;

                    }
                )
            };

            $scope.selectVsFromIg = function(){
                var vs = $scope.input.vsFromIg;
                var vo={vs:{url:vs.sourceUri,name:vs.name},strength:'preferred'}
                $scope.selectedValueSet = vo;


            }



    })

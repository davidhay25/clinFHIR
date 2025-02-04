
angular.module("sampleApp")
    .controller('editLogicalNodeCtrl',
        function ($scope,allDataTypes,editNode,parentPath,RenderProfileSvc,appConfigSvc, allResourceTypes,treeData,Utilities,
                  findNodeWithPath,rootForDataType,igSvc,references,baseType,$uibModal, logicalModelSvc, modalService,$timeout) {

            $scope.appConfigSvc = appConfigSvc;
            $scope.allResourceTypes = allResourceTypes;
            $scope.references = references;    // a bundle containing all the LogicalModels...
            $scope.rootForDataType = rootForDataType;   //HTTP root for viewing datatype details
            $scope.canSave = true;
            $scope.allDataTypes = allDataTypes;
            //set the additional datatypes permitted

            $scope.additionalDT = []; //these are all the possible DT
            $scope.additionalDatatypes = [];        //these are the assigned additional Dt
            //note that additionalDT are a string... (main dt is an object)
            allDataTypes.forEach(function (dt) {
                if (['Reference','CodeableConcept','Coding','code'].indexOf(dt.code) == -1) {
                    $scope.additionalDT.push(dt.code)
                }
            });



            $scope.parentPath = parentPath;
            $scope.pathDescription = 'Parent path';
            $scope.vsInGuide = igSvc.getResourcesInGuide('valueSet');       //so we can show the list of ValueSets in the IG
            $scope.input = {};


            $scope.fhirRoot =  'http://hl7.org/fhir/STU3/'; //  'http://hl7.org/fhir/';
            var baseTypeUrl = appConfigSvc.config().standardExtensionUrl.baseTypeForModel;

            var that = this;

           // $scope.statuses = ['included','confirm','review','later','excluded'];       //note: value set in createTreeArrayFromSD()
            $scope.statuses = ['included','review','excluded'];       //note: value set in createTreeArrayFromSD()
            //the display of logical models.
            $scope.lmDisplay = function(resource) {
                var baseType = Utilities.getSingleExtensionValue(resource,baseTypeUrl);
                if (baseType && baseType.valueString) {
                    return resource.name + "   ("+ baseType.valueString + ")";
                } else {
                    return resource.name;
                }


            };
/*
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

*/

            $scope.addAdditionalDT = function(dt){
                $scope.additionalDatatypes = $scope.additionalDatatypes || []
                $scope.additionalDatatypes.push(dt)

            };

            //remove one of the additional datatypes
            $scope.removeAdditionalDT = function(inx) {
                $scope.additionalDatatypes.splice(inx,1)
            };

            $scope.fhirMapping = function(map) {
                $scope.isExtension = false;
                if (map && map.indexOf('xtension') > -1) {
                    $scope.isExtension = true;
                }
            };

            //display the ED for the FHIR mapping path
            $scope.showED = function(ED){
                console.log(ED)

                $uibModal.open({
                    templateUrl: 'modalTemplates/showED.html',
                    size:'lg',
                    controller: function($scope,ed){
                        $scope.ed = ed
                    },
                    resolve : {
                        ed: function () {          //the default config
                            //return ED

                            var t = angular.copy(ED);
                            delete t.mapping;       //just to save space
                            return t;
                        }
                    }
                })
            };


            $scope.addAlias = function() {
                let alias = window.prompt("Alias")
                $scope.input.alias = $scope.input.alias || []
                $scope.input.alias.push(alias)
            };

            $scope.removeAlias = function(inx) {
                $scope.input.alias.splice(inx,1);
            }

            //when a fhir path is selected from the type-ahead in the mapping...
            $scope.fhirPathSelect = function(item) {
                console.log(item)
                var ed = $scope.allPathsHash[item];

                console.log(ed)


                $scope.selectedED = ed;     //used to view the ED for the mapped path
                /*
                delete $scope.selectedED;
                if ($scope.edHash[path]) {
                    $scope.selectedED = $scope.edHash[path];
                }
*/



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
                            //Note that this is drectly from the SD = so the format is different in R4...
                            if (ed.binding.valueSet) {
                                //this is R4
                                $scope.selectedValueSet = ed.binding.valueSet
                            } else {
                                //this is R3
                                var ref = ed.binding.valueSetReference;
                                if (ref) {
                                    var url = ref.reference;
                                    var ar = url.split('/');
                                    var name = ar[ar.length-1];
                                    //var vo={vs:{url:url,name:name},strength:ed.binding.strength}
                                    var vo={vs:{url:url,name:name},strength:ed.binding.strength}
                                    $scope.selectedValueSet = vo;
                                }
                            }

                        }


                    }
                }
            };


            $scope.baseType = baseType;


            //default datatype is string
            for (var i=0; i< $scope.allDataTypes.length; i++) {
                if ($scope.allDataTypes[i].code == 'string') {
                    $scope.input.dataType = $scope.allDataTypes[i];
                    break;
                }
            }
            $scope.input.multiplicity = 'opt';      //default multiplicity
            $scope.input.mustSupport = false;       //default mustSupport

            $scope.input.autoExpand = false;       //default autoexpand



            if (baseType) {
                //get all the paths - including expanding logical models...
                $scope.showWaiting = true;
                logicalModelSvc.getAllPathsForType(baseType,true).then(
                    function(listOfPaths) {
                        $scope.allPaths = listOfPaths.list;
                        $scope.allPathsHash = listOfPaths.hash;
                        $scope.edHash = listOfPaths.edHash;     //all the ed's keyed by path
                       // $scope.dtDef = listOfPaths.dtDef;       //the definitions for a path (use to get the options)...
                        setup(editNode);
                    },function(err) {
                        alert("A Base type of "+ baseType +" was selected, but I couldn't locate the profile to get the element paths")
                        setup(editNode);
                    }
                ).finally(function(){
                    $scope.showWaiting = false;
                })

            } else {
                setup(editNode);
            }




            function setup(node) {
                if (! node) {

                    return;
                }

                var data = node.data;
                    //editing an existing node

                if (data.code && data.code.length > 0) {
                    $scope.input.code = {}
                    $scope.input.code.code = data.code[0].code
                    $scope.input.code.system = data.code[0].system || ""
                }

                $scope.pathDescription = 'Path'

                $scope.input.name = data.name;
                $scope.input.pathSegment = data.pathSegment;
                $scope.input.short= data.short;
                $scope.input.description = data.description;
                $scope.input.comments = data.comments;
                $scope.input.mapping = data.mapping;

                $scope.input.mustSupport = data.mustSupport || false;
                $scope.input.autoExpand = data.autoExpand || false;

                $scope.input.alias = data.alias;    //[string]

                //these 4 are from extensions...
                $scope.input.misuse = data.misuse;
                $scope.input.usageGuide = data.usageGuide;
                $scope.input.legacy = data.legacy;

                $scope.input.examples = data.examples;
                $scope.input.references = data.references;


                $scope.input.lmReviewReason = data.lmReviewReason;
                $scope.input.lmElementLink = data.lmElementLink;

                //data.edStatus = data.edStatus || 'included'
                $scope.input.edStatus = data.edStatus;

                $scope.input.conceptMap = data.conceptMap;

                //$scope.input.mappingPath = data.mappingPath;
                $scope.fhirMapping(data.mappingPath);       //check for an extension
                $scope.input.fixedString = data.fixedString;
                //$scope.input.mappingPathV2 = data.mappingPathV2;

                $scope.input.mappingFromED = angular.copy(data.mappingFromED);    //all the current mappings. Only want to update on save...

                $scope.input.mappingPath = getMapValueForIdentity('fhir');

                if ($scope.input.mappingPath) {


                   // var ed = $scope.allPathsHash[$scope.input.mappingPath];
                   // console.log(ed)

                    //the $scope.selectedED is for display. Only worls if there is an underlying base model
                    if ($scope.edHash) {
                        $scope.selectedED = $scope.edHash[$scope.input.mappingPath];    //used to show the ED
                        if ($scope.input.mappingPath.indexOf('xtension')>-1) {
                            $scope.isExtension = true;
                        }
                    }


                }


                isDiscriminatorRequired();      //true if there is another fhir mapping the same
                $scope.input.mappingPathV2 = getMapValueForIdentity('hl7V2');
                $scope.input.mappingPathSnomed = getMapValueForIdentity('snomed');
                $scope.input.mappingPathLM = getMapValueForIdentity('lm');

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


                //the main datatype is in pos 0...
                $scope.dt = data.type[0];   //the selected datatype...
                var dtCode = data.type[0].code;     //only the first datatype (we only support 1 right now)

                if (data.type.length > 1) {
                    //these are additional datatypes...

                    for (var i=1; i < data.type.length ; i++ ) {
                        let dt = data.type[i]
                        $scope.additionalDatatypes.push(dt.code)
                    }

                }


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
                    if (data.selectedValueSet){
                        $scope.isCoded = true;
                        $scope.vsInGuide.forEach(function(vs){
                            if (vs.sourceUri ==data.selectedValueSet.valueSet) {
                                $scope.input.vsFromIg = vs
                            }
                        })
                    }


                    $scope.selectedValueSet = data.selectedValueSet;

                    //if this is a reference, set the initial reference
                    if (dtCode == 'Reference') {

                        //for a core type reference, find the name of the type (it's the last segment in the url)
                        if (data.type) {
                            var profileUrl = data.type[0].targetProfile[0];    //normalized to this...
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
                                if ($scope.references && $scope.references.entry) {
                                    $scope.references.entry.forEach(function(ent){
                                        if (ent.resource.url == profileUrl) {
                                            $scope.input.referenceFromIg = ent;
                                        }
                                    })
                                }

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
                                            if (ctx) {
                                                if (ctx == '*' || ctx == 'Element' ||  ctx.indexOf($scope.resourceType) > -1) {
                                                    include = true;

                                                    if (txt && entry.resource.name && entry.resource.name.toLowerCase().indexOf(txt)== -1 ) {
                                                        include = false;
                                                    }


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

                if ($scope.input.name && $scope.input.name.indexOf("_") > -1) {
                    $scope.canSave = false;
                    modalService.showModal({},{bodyText:"The name cannot have an underscore (_) in it. Try again."})
                }

                //for now, only do duplicate checking for adding new nodes - not renaming - todo

                if (! editNode) {
                    var pathForThisElement = parentPath + '.'+$scope.input.name;

                    var duplicateNode = findNodeWithPath(pathForThisElement)
                    if (duplicateNode) {
                        $scope.canSave = false;
                        modalService.showModal({},{bodyText:"This name is a duplicate of another and cannot be used. Try again."})
                    }


                    //set the short element to the same as the name if not eneterd
                    if ($scope.canSave && ! $scope.input.short) {
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

                //check that the

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

                    if (editNode && editNode.data) {
                        vo.idFromSD = editNode.data.idFromSD;
                    } //else {
                       // vo.idFromSD =
                   // }


                    //add the code - may 2013
                    if ($scope.input.code && $scope.input.code.code) {
                        let code = {code:$scope.input.code.code}
                        if ($scope.input.code.system) {
                            code.system = $scope.input.code.system
                        } else {
                            code.system = "http://snomed.info/sct"
                        }
                        vo.code = [code]
                    }

                    vo.name = $scope.input.name;
                    vo.short = $scope.input.short;
                    vo.description = $scope.input.description || 'No description';
                    vo.comments = $scope.input.comments;
                    vo.mapping = $scope.input.mapping;
                    vo.pathSegment = $scope.input.pathSegment;

                    vo.conceptMap = $scope.input.conceptMap;

                vo.mustSupport = $scope.input.mustSupport;

                vo.autoExpand = $scope.input.autoExpand;




                vo.alias = $scope.input.alias ;

                vo.mappingPath = $scope.input.mappingPath;      //this is the FHIR path
                    vo.mappingFromED = $scope.input.mappingFromED || [];      //all mappings
                    vo.mappingPathV2 = $scope.input.mappingPathV2;
                    vo.mappingPathSnomed = $scope.input.mappingPathSnomed;
                    vo.mappingPathLM = $scope.input.mappingPathLM;

                    //if mapping to an extension, the include the oath to the extension
                    if (vo.mappingPath && vo.mappingPath.indexOf('xtension') > -1) {
                        vo.fhirMappingExtensionUrl = $scope.input.fhirMappingExtensionUrl
                    }

                    //make sure the v2 & fhir mappings align with the
                    alignMap('hl7V2',vo.mappingPathV2,vo.mappingFromED)
                    alignMap('fhir',vo.mappingPath,vo.mappingFromED)
                    alignMap('snomed',vo.mappingPathSnomed,vo.mappingFromED)
                    alignMap('lm',vo.mappingPathLM,vo.mappingFromED)




                    vo.type = [{code:$scope.input.dataType.code}];
                    //if there are additional datatypes, then add them after the main one...
                    if ($scope.additionalDatatypes && $scope.additionalDatatypes.length > 0) {
                        $scope.additionalDatatypes.forEach(function (dt) {
                            vo.type.push({code:dt})
                        })
                    }


                    vo.editNode = editNode;
                    //I don't think this is used .... vo.parentPath = parentPath;


                    if ($scope.input.fixedString) {
                        try {
                            var tmp = angular.fromJson($scope.input.fixedString);

                        } catch (ex) {
                            alert('The fixed string value must be valid Json - double quotes and all')
                            return;
                        }
                        vo.fixedString = $scope.input.fixedString;
                    }


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

                        //In supporting R4, targetProfile is always multiple
                        vo.type[0].targetProfile = [vo.referenceUrl];     //we use targetProfile here - service will downgrade to R2...



                        if ($scope.input.referenceFromIg) {
                            //vo.isReference = true;
                            vo.referenceUrl = $scope.input.referenceFromIg.resource.url; // for the reference table...
                            // (this is the older stu3 veriosn)  vo.type[0].profile = $scope.input.referenceFromIg.resource.url;
                            vo.type[0].targetProfile = [$scope.input.referenceFromIg.resource.url];   //not quite sure why we need both...

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

                    if ($scope.input.usageGuide) {
                        vo.usageGuide = $scope.input.usageGuide;
                    }
                    if ($scope.input.misuse) {
                        vo.misuse = $scope.input.misuse;
                    }
                    if ($scope.input.legacy) {
                        vo.legacy = $scope.input.legacy;
                    }


                if ($scope.input.examples) {
                    vo.examples = $scope.input.examples;
                }
                if ($scope.input.references) {
                    vo.references = $scope.input.references;
                }


                    if ($scope.input.lmReviewReason) {
                        vo.lmReviewReason = $scope.input.lmReviewReason;
                    }

                if ($scope.input.lmElementLink) {
                    vo.lmElementLink = $scope.input.lmElementLink;
                }

                if ($scope.input.edStatus) {
                    vo.edStatus = $scope.input.edStatus;
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

            $scope.removeBinding = function(){
                delete $scope.selectedValueSet;
            };

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
                    }
                }).result.then(
                    function (vo) {
                        //returns the R3 style. A bit hairy to change at the moment... - actually returns the whole VS
                       if (vo.vs) {
                           $scope.selectedValueSet = {valueSet : vo.vs.url, strength: vo.strength, description : vo.description}
                       }

                    }
                )
            };

            $scope.selectVsFromIg = function(){
                var vs = $scope.input.vsFromIg;
                //var vo={vs:{url:vs.sourceUri,name:vs.name},strength:'preferred'}
                var vo={valueSet:vs.sourceUri,description:vs.name,strength:'preferred'};
                $scope.selectedValueSet = vo;


            }



    })

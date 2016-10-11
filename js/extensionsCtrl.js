/*has been deprectde - don't call make function - expensive! */

angular.module("sampleApp")
    .controller('extensionsCtrl',
        function ($rootScope,$scope,GetDataFromServer,appConfigSvc,Utilities,$uibModal,RenderProfileSvc,SaveDataToServer,modalService,$timeout) {

            $scope.input = {param:'hl7',searchParam:'publisher',searchStatus:'all'};
/*
            $scope.mode = 'extension'

            $scope.changeMode = function(mode) {
                $scope.mode = mode;
            }
*/


            $scope.$watch('input.searchParam',function(){
               // alert('c')
                delete $scope.extensionsArray;
                delete $scope.selectedExtension;
            })





            RenderProfileSvc.getAllStandardResourceTypes().then(
                function(lst) {
                    $scope.allResourceTypes = lst;
                    //console.log($scope.allResourceTypes);
                }
            );


            $rootScope.$on('userLoggedIn',function(){
                var userProfile = $rootScope.userProfile;
                console.log(userProfile)
                if (userProfile.extDef && userProfile.extDef.defaultPublisher) {
                    $scope.input = {param:userProfile.extDef.defaultPublisher,searchParam:'publisher',searchStatus:'all'};

                }
            });

            $rootScope.$on('userLoggedOut',function() {
                $scope.input = {param:'hl7',searchParam:'publisher',searchStatus:'all'};
            });

            $rootScope.$on('setDisplayMode',function(ev,mode) {
                if (mode == 'extensions') {
                    delete $scope.extensionsArray;
                    delete $scope.selectedExtension;
                }
            });



            $scope.errors = [];
            $scope.appConfigSvc = appConfigSvc;

            //load the new extension page
            $scope.newExtension = function() {
                $uibModal.open({
                    templateUrl: 'modalTemplates/newExtension.html',
                    size: 'lg',
                    controller: "extensionDefCtrl"
                }).result.then(
                    function(result) {
                        console.log(result)
                    })
            };

            $scope.deleteExtension = function(){
                var modalOptions = {
                    closeButtonText: "No, don't Delete",
                    actionButtonText: 'Yes please',
                    headerText: 'Activate ' + $scope.selectedExtension.name,
                    bodyText: 'Are you sure you want to delete this Extension Definition? (It MUST NEVER have been used in a resource instance)'
                };
                modalService.showModal({}, modalOptions).then(
                    function(){
                        SaveDataToServer.deleteResource(appConfigSvc.getCurrentConformanceServer(),$scope.selectedExtension).then(
                            function(data){
                                console.log(data);
                                modalService.showModal({}, {bodyText:'Definition is now deleted.'});

                                $scope.extensionsArray.splice($scope.index,1);
                                delete $scope.selectedExtension;
                                delete $scope.index;


                            },
                            function(err) {
                                alert('Error updating definition: '+angular.toJson(err))
                            }
                        )
                    }
                )
            };

            $scope.editExtension = function () {
                modalService.showModal({}, {bodyText : "Sorry, editing is not yet enabled"})
            };

            $scope.retireExtension = function(){
                var modalOptions = {
                    closeButtonText: "No, don't Retire",
                    actionButtonText: 'Yes please',
                    headerText: 'Activate ' + $scope.selectedExtension.name,
                    bodyText: 'Are you sure you want to retire this Extension Definition?'
                };
                modalService.showModal({}, modalOptions).then(
                    function(){
                        $scope.selectedExtension.status = 'retire';
                        SaveDataToServer.updateResource(appConfigSvc.getCurrentConformanceServer(),$scope.selectedExtension).then(
                            function(data){
                                console.log(data);
                                modalService.showModal({}, {bodyText:'Definition is now retired, and should no longer be used. (It needs to remain in the registry for existing usages of course.)'});
                            },
                            function(err) {
                                alert('Error updating definition: '+angular.toJson(err))
                            }
                        )
                    }
                )
            };

            $scope.activateExtension = function(){
                var modalOptions = {
                    closeButtonText: "No, don't Activate",
                    actionButtonText: 'Yes please',
                    headerText: 'Activate ' + $scope.selectedExtension.name,
                    bodyText: 'Are you sure you want to activate this Extension Definition?'
                };
                modalService.showModal({}, modalOptions).then(
                    function(){
                        $scope.selectedExtension.status = 'active';
                        SaveDataToServer.updateResource(appConfigSvc.getCurrentConformanceServer(),$scope.selectedExtension).then(
                            function(data){
                                console.log(data);
                                modalService.showModal({}, {bodyText:'Definition is now active, and can be used by resource instances.'});
                            },
                            function(err) {
                                alert('Error updating definition: '+angular.toJson(err))
                            }
                        )
                    }
                )
            };

            $scope.search = function(param) {
                
                var conformanceServer =  appConfigSvc.getCurrentConformanceServer();
                var query = conformanceServer.url;
                
                //because I have to proxy Grahames server. Don't really like this...
                $scope.conformanceServer = conformanceServer.realUrl || conformanceServer.url;  //for the detail display
                var downLoadName = '';
                switch ($scope.input.searchParam) {

                    case 'publisher' :
                        query += "StructureDefinition?publisher:contains="+param;
                        downLoadName = 'publisher-'+param;
                        break;
                    case 'description' :
                        query += "StructureDefinition?description:contains="+param;
                        downLoadName = 'description-'+param;
                        break;
                    case 'name' :
                        query += "StructureDefinition?name:contains="+param;
                        downLoadName = 'name-'+param;
                        break;
                    case 'identifier' :
                        var id = $scope.input.identifierId;
                        var system = $scope.input.identifierSystem;
                        var ident = id;
                        if (!id) {
                            alert("You need to enter an Id")
                            return;
                        }
                        if (system) {
                            ident = system + "|" + id;
                        }

                        query += "StructureDefinition?identifier="+ident;
                        downLoadName = 'identifier-'+ident;
                        break;
                    case 'resource' :
                        param = $scope.input.resourceType;
                        var t = param.name;
                        //Both '*' and 'Resource' are used for 'any resource'
                        if (t == '*') {
                            t += ",Resource";
                        }
                        downLoadName = 'resource-'+param;

                        query += "StructureDefinition?ext-context:contains="+t;

                        break;
                }

                //if the status is not all...
                if ($scope.input.searchStatus !== 'all') {
                    query += "&status="+$scope.input.searchStatus;
                }

                query += "&type=Extension";     //this is the same for STU-2 & 3...

/*
                if ($scope.mode == 'extension') {
                    query += "&type=Extension";      //this is foe an extension
                } else {
                    query += "&kind=resource"
                }
                */



                getExtensions(query,downLoadName)
            }


            function getExtensions(query,downLoadName) {
                $scope.loading=true;
                delete $scope.extensionsArray;
                delete $scope.selectedExtension;
                delete $scope.index;
console.log(query)
                $scope.query = query;

                GetDataFromServer.adHocFHIRQuery(query).then(
                    function(data) {
                        var bundle = data.data;
                        $scope.loading=false;

                        if (bundle && bundle.entry) {
                            $scope.extensionsArray = bundle.entry;

                            $scope.extensionsArray.sort(function (a, b) {
                                if (a.resource.name && a.resource.name) {
                                    if (a.resource.name.toUpperCase() > b.resource.name.toUpperCase()) {
                                        return 1
                                    } else {
                                        return -1
                                    }
                                } else {
                                    return 0;
                                }


                            });
/*
                            if (selectedExtension) {
                                //this is an extension being edited. Find it in the bundle and re-set if...
                                $scope.extensionsArray.forEach(function (entry) {
                                    if (entry.resource.url == selectedExtension.url) {
                                        $scope.selectExtension(entry);

                                    }

                                })
                            }
                            */

                            $scope.downloadLinkJsonContent = window.URL.createObjectURL(new Blob([angular.toJson(bundle, true)], {type: "text/text"}));
                            $scope.downloadLinkJsonName = downLoadName;

                        }


                    },
                    function(err) {
                        $scope.loading=false;
                        alert("Error:"+angular.toJson(err));
                    }
                )
            }


            delete $scope.selectedExtension;
            
            $scope.selectExtension = function(entry,inx){

                delete $scope.isComplexExtension;
                $scope.index = inx;
                $scope.errors.length=0;

                $scope.selectedExtension = entry.resource;

                $scope.isAuthoredByClinFhir = Utilities.isAuthoredByClinFhir($scope.selectedExtension);
                
                //extensionDefinition.code = [{system:'http://fhir.hl7.org.nz/NamingSystem/application',code:'clinfhir'}]
                
                $scope.selectedExtension.localMeta = {};
                var vo = getDataTypes($scope.selectedExtension);
                $scope.analysis = vo;
                $scope.isComplexExtension = vo.isComplexExtension;
                console.log(vo)

                $scope.selectedExtension.localMeta.datatypes = vo.dataTypes;
                $scope.selectedExtension.localMeta.multiple = vo.multiple;
                $scope.selectedExtension.localMeta.polymorphicTypes = vo.polymorphicTypes;
                //for a reference datatype, this is the list of datatypes that that the extension can refer to
                $scope.selectedExtension.localMeta.referenceTypes = vo.referenceTypes;
                $scope.selectedExtension.localMeta.referenceStrength = vo.strength;
                $scope.selectedExtension.localMeta.referenceReference = vo.valueSetReference;
                $scope.selectedExtension.localMeta.valueSetUri = vo.valueSetUri;
                
                /*
                if ($scope.selectedExtension.meta && $scope.selectedExtension.meta.tag) {
                    for (var i=0; i< $scope.selectedExtension.meta.tag.length;i++){
                        var tag = $scope.selectedExtension.meta.tag[i];
                        if (tag.system == "http://clinfhir.com/user") {
                            $scope.selectedExtension.lastEditedBy = tag.display;
                            break;
                        }
                    }

                };
*/


                //$scope.selectedExtensionJson = angular.toJson(entry.resource,true)
            };


            function getDataTypes(extension) {
                delete $scope.complexExtension;

                var extAnalysis = Utilities.analyseExtensionDefinition3(extension);  //was the original service...
              //  if (extAnalysis.complexExtension) {
                   // $scope.complexExtension = extAnalysis.complexExtension;
               // }
                return extAnalysis;

/*
                var vo = {dataTypes : [],multiple:false}
                var discriminator;      //if this is sliced, then a discriminator will be set...
                if (extension.snapshot) {
                    extension.snapshot.element.forEach(function(element) {

                        //this is the root extension
                        if (element.path === 'Extension') {
                            if (element.max == '*') {
                                vo.multiple = true;
                            }
                        }

                        if (element.slicing) {
                            discriminator = element.slicing.discriminator[0];
                        }

                        if (element.path.indexOf('Extension.value')>-1) {
                            //vo.element = element;
                            var dt = element.path.replace('Extension.value','').toLowerCase();
                            vo.dataTypes.push(dt);
                            if (dt == 'reference') {
                                //if this is a reference, then need the list of types
                                vo.referenceTypes = [];
                                if (element.type) {
                                    element.type.forEach(function(t){
                                        var p = t.profile;
                                        if (p) {
                                            var ar = p[0].split('/');       //only the first
                                            vo.referenceTypes.push(ar[ar.length-1]);
                                        }
                                    })
                                }
                            }



                            if (element.binding) {

                                vo.strength = element.binding.strength;
                                if (element.binding.valueSetReference) {
                                    vo.valueSetReference = element.binding.valueSetReference.reference;
                                }

                                if (element.binding.valueSetUri) {
                                    vo.valueSetUri = element.binding.valueSetUri;
                                }

                            }

                        }
                    })
                }

                //if a discriminator has been set, then this is a complex extension so create a summary object...
                if (discriminator) {
                    $scope.complexExtension = Utilities.processComplexExtension(extension,discriminator)
                }

                return vo;

                */
            }


            //------- show valueset
            $scope.findValueSet = function(binding) {
                var valueSetUri = binding.valueSetUri;

                if (!valueSetUri) {

                    if (binding.valueSetReference) {
                        valueSetUri = binding.valueSetReference.reference;
                        modalService.showModal({}, {bodyText:"I'm going to use a valueSetReference as if it were a Uri. It *should* still work..."}).then(
                            function(){},
                            function(){
                                $scope.loading=true;
                                Utilities.getValueSetIdFromRegistry(valueSetUri, function (vsDetails) {
                                        console.log(vsDetails)
                                        $scope.loading = false;
                                        $scope.showVSBrowser(vsDetails.resource);
                                    }
                                )
                            }

                        );


                    } else {
                        modalService.showModal({}, {bodyText:'The binding.valueSetUri and binding.valueSetReference are both empty. I cannot show the value set. Sorry about that'});


                        return;
                    }



                } else {
                    // var uri = reference;        //not sure this is correct...
                    $scope.loading=true;
                    Utilities.getValueSetIdFromRegistry(valueSetUri, function (vsDetails) {
                            console.log(vsDetails)
                            $scope.loading = false;
                            $scope.showVSBrowser(vsDetails.resource);
                        }
                    );
                }




            };
/*
            function isAuthoredByClinFhir(profile) {
                // return true
                var isAuthoredByClinFhir = false;
                if (profile.code) {
                    profile.code.forEach(function(coding){
                        if (coding.system == 'http://fhir.hl7.org.nz/NamingSystem/application' &&
                            coding.code == 'clinfhir') {
                            isAuthoredByClinFhir = true;
                        }
                    })
                }

                if (!isAuthoredByClinFhir) {
                    //used identifier in the past...
                    if (profile.identifier) {
                        profile.identifier.forEach(function(ident){
                            if (ident.system == 'http://clinfhir.com' && ident.value=='author') {
                                isAuthoredByClinFhir = true;
                            }
                        })
                    }
                }

                return isAuthoredByClinFhir;
            }
*/
        });
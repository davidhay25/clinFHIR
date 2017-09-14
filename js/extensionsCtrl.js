/*has been deprectde - don't call make function - expensive! */

angular.module("sampleApp")
    .controller('extensionsCtrl',
        function ($rootScope,$scope,GetDataFromServer,appConfigSvc,Utilities,$uibModal,RenderProfileSvc,
                  SaveDataToServer,modalService,$timeout,securitySvc,$location,$firebaseObject,$window) {

            $scope.input = {param:'Orion',searchParam:'publisher',searchStatus:'all'};

            GetDataFromServer.registerAccess('extension');

            $scope.$watch('input.searchParam',function(){
                delete $scope.extensionsArray;
                delete $scope.selectedExtension;
            });

            RenderProfileSvc.getAllStandardResourceTypes().then(
                function(lst) {
                    $scope.allResourceTypes = lst;
                }
            );

            $scope.displayServers = "Conformance: " + appConfigSvc.getCurrentConformanceServer().name
                + "<div>Data: " + appConfigSvc.getCurrentDataServer().name + "</div>"
                + "<div>Term: " + appConfigSvc.getCurrentTerminologyServer().name + "</div>";

            $scope.securitySvc = securitySvc;
            $scope.leftPane = "col-md-4 col-sm-4";
            $scope.rightPane = "col-md-8 col-sm-8";


            //if a shortcut has been used there will be a hash so load that
            var hash = $location.hash();
            if (hash) {
                console.log(hash)
                $scope.leftPane = "hidden";
                $scope.rightPane = "col-md-12 col-sm-12";

                var sc = $firebaseObject(firebase.database().ref().child("shortCut").child(hash));
                sc.$loaded().then(
                    function () {
                        //console.log(sc.config)
                        var url =  sc.config.conformanceServer.url + "StructureDefinition/" +sc.config.model.id;
                        //console.log(url)
                        $scope.loadedFromBookmarkUrl = url; //true;
                        loadOneResource(url)
                    },
                    function(err) {
                        alert(angular.toJson(err))
                    }
                )
            }

            function loadOneResource(url) {
                GetDataFromServer.adHocFHIRQuery(url).then(
                    function(data) {
                        console.log(data)
                        configureForExtensionDef(data.data);
                    },
                    function(err) {
                        alert(angular.toJson(err))
                    }
                )
            }

            $scope.generateShortCut = function() {
                var hash = Utilities.generateHash();
                var sc = $firebaseObject(firebase.database().ref().child("shortCut").child(hash));
                sc.config = {conformanceServer:appConfigSvc.getCurrentConformanceServer()};
                sc.config.model = {id:$scope.selectedExtension.id}
                sc.$save().then(
                    function(){
                        var shortCut = $window.location.href+"#"+hash;
                        modalService.showModal({}, {bodyText: "The shortcut  " +  shortCut + "  has been generated for this extension"})
                    }
                )
            };

            firebase.auth().onAuthStateChanged(function(user) {
                delete $scope.input.mdComment;

                if (user) {
                    console.log(user)

                    securitySvc.setCurrentUser(user);
                    $scope.$digest() ;  //as this event occurs outside of angular apparently..
                }
            });

            $rootScope.$on('userLoggedOut',function() {
                $scope.input = {param:'hl7',searchParam:'publisher',searchStatus:'all'};
            });
            $rootScope.$on('setDisplayMode',function(ev,mode) {
                if (mode.newMode == 'extensions') {
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
                    controller: "extensionDefCtrl",
                    backdrop: 'static',
                    resolve : {
                        currentExt: function () {          //the default extension
                            return null;
                        }
                    }
                }).result.then(
                    function(result) {
                        $scope.search();
                    })
            };

            $scope.deleteExtension = function(){
                var modalOptions = {
                    closeButtonText: "No, don't Delete",
                    actionButtonText: 'Yes please',
                    headerText: 'Delete ' + $scope.selectedExtension.name + " (id= " + $scope.selectedExtension.id + ")",
                    bodyText: 'Are you sure you want to delete this Extension Definition? (It MUST NEVER have been used in a resource instance)'
                };
                modalService.showModal({}, modalOptions).then(
                    function(){
                        SaveDataToServer.deleteResource(appConfigSvc.getCurrentConformanceServer(),$scope.selectedExtension).then(
                            function(data){

                                modalService.showModal({}, {bodyText:'Definition is now deleted.'});

                                $scope.search();

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
                $uibModal.open({
                    templateUrl: 'modalTemplates/newExtension.html',
                    size: 'lg',
                    controller: "extensionDefCtrl",
                    backdrop : 'static',
                    resolve : {
                        currentExt: function () {          //the default extension
                            return $scope.selectedExtension;
                        }
                    }
                }).result.then(
                    function(result) {
                        if ($scope.loadedFromBookmarkUrl) {
                            loadOneResource($scope.loadedFromBookmarkUrl)
                        } else {
                            $scope.search();
                        }


                    });

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
                        $scope.selectedExtension.status = 'retired';
                        SaveDataToServer.updateStructureDefinition(appConfigSvc.getCurrentConformanceServer(),$scope.selectedExtension).then(
                            function(data){

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
                    bodyText: 'Are you sure you want to activate this Extension Definition? After this it cannot be edited...'
                };
                modalService.showModal({}, modalOptions).then(
                    function(){
                        $scope.selectedExtension.status = 'active';
                        SaveDataToServer.updateStructureDefinition(appConfigSvc.getCurrentConformanceServer(),$scope.selectedExtension).then(
                            function(data){

                                modalService.showModal({}, {bodyText:'Definition is now active, and can be used by resource instances.'});
                            },
                            function(err) {
                                alert('Error updating definition: '+angular.toJson(err))
                            }
                        )
                    }
                )
            };

            $scope.search = function() {
                var param = $scope.input.param;
                
                var conformanceServer =  appConfigSvc.getCurrentConformanceServer();
                var query = conformanceServer.url;

                if ($scope.input.searchParam == 'url') {
                    query += "StructureDefinition?url="+param;
                } else {
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


                }
                getExtensions(query,downLoadName)


            }


            function getExtensions(query,downLoadName) {
                $scope.loading=true;
                delete $scope.extensionsArray;
                delete $scope.selectedExtension;
                delete $scope.index;

                $scope.query = query;

                GetDataFromServer.adHocFHIRQueryFollowingPaging(query).then(
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


                configureForExtensionDef(entry.resource)
            };

            function configureForExtensionDef(ed) {
                $scope.selectedExtension = ed ;


                $scope.extensionDefForDisplay = angular.copy(ed);
                $scope.extensionDefForDisplay.snapshot.element.forEach(function (ed) {
                    delete ed.myMeta;
                })


                $scope.permissions = securitySvc.getPermissons(ed);     //what the current user can do with this resource...
                $scope.isAuthoredByClinFhir = Utilities.isAuthoredByClinFhir(ed);

                if (! $scope.isAuthoredByClinFhir) {
                    $scope.permissions.canEdit = false;
                    $scope.permissions.canDelete = false;
                    $scope.permissions.canActivate = false;
                    $scope.permissions.canRetire=false;
                }




                $scope.selectedExtension.localMeta = {};

                $scope.selectedExtension.localMeta.author =
                    Utilities.getSingleExtensionValue($scope.selectedExtension,appConfigSvc.config().standardExtensionUrl.userEmail)

                var vo = getDataTypes($scope.selectedExtension);
                $scope.analysis = vo;
                $scope.isComplexExtension = vo.isComplexExtension;

                $scope.selectedExtension.localMeta.datatypes = vo.dataTypes;
                $scope.selectedExtension.localMeta.multiple = vo.multiple;
                $scope.selectedExtension.localMeta.polymorphicTypes = vo.polymorphicTypes;
                //for a reference datatype, this is the list of datatypes that that the extension can refer to
                $scope.selectedExtension.localMeta.referenceTypes = vo.referenceTypes;
                $scope.selectedExtension.localMeta.referenceStrength = vo.strength;
                $scope.selectedExtension.localMeta.referenceReference = vo.valueSetReference;
                $scope.selectedExtension.localMeta.valueSetUri = vo.valueSetUri;
            }


            function getDataTypes(extension) {
                delete $scope.complexExtension;

                var extAnalysis = Utilities.analyseExtensionDefinition3(extension);  //was the original service...
                return extAnalysis;


            }



            $scope.showVSBrowserDialog = {};
            $scope.showVSBrowser = function(vs) {
                $scope.showVSBrowserDialog.open(vs);        //the open method defined in the directive...
            };


            //------- show valueset
            $scope.findValueSet = function(binding) {
                var valueSetUri = binding.valueSetUri;

                if (!valueSetUri) {

                    if (binding.valueSetReference) {
                        valueSetUri = binding.valueSetReference.reference;
                        modalService.showModal({}, {bodyText:"I'm going to use a valueSetReference ("+valueSetUri+ ") as if it were a Uri. It *should* still work..."}).then(
                            function(){},
                            function(){
                                $scope.loading=true;
                                Utilities.getValueSetIdFromRegistry(valueSetUri, function (vsDetails) {

                                        $scope.loading = false;
                                        if (vsDetails) {
                                            $scope.showVSBrowser(vsDetails.resource);
                                        } else {
                                            modalService.showModal({}, {bodyText:"Sorry, the ValueSet: "+valueSetUri+" was not found on the Terminology server"});
                                        }



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

                            $scope.loading = false;
                            $scope.showVSBrowser(vsDetails.resource);
                        }
                    );
                }

            };
        }).config([ '$compileProvider',
    //used for the download functionity - http://stackoverflow.com/questions/16342659/directive-to-create-adownload-button for download (bottom of page)
    function($compileProvider) {
        $compileProvider.aHrefSanitizationWhitelist(/^s*(https?|ftp|blob|mailto|chrome-extension):/);

    }]);
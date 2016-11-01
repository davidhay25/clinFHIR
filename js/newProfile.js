/*has been deprectde - don't call make function - expensive! */

angular.module("sampleApp").controller('newProfileCtrl',
        function ($rootScope,$scope,$uibModal,appConfigSvc,GetDataFromServer,SaveDataToServer,Utilities,modalService,RenderProfileSvc,$http) {

            $scope.childElements = [];      //array of child elements
            $scope.input ={};
            //$scope.input.name= 'dhTest1';
            //$scope.input.short = 'test profile'
            //$scope.input.description = "testing the new profile functionality in clinFHIR"
            $scope.selectedResourceTypes = [];


            $scope.save = function() {
                $rootScope.$broadcast('setWaitingFlag',true);
                delete $scope.validateResults;
                //first, get the base resource
                var baseType = $scope.input.type.name;
                var url = "http://hl7.org/fhir/StructureDefinition/"+baseType;      //always profile off a base type (for now)
                GetDataFromServer.findConformanceResourceByUri(url).then(
                    function(resource) {
                        console.log(resource);
                        //set the version specific parameters
                        var newResource = adaptBaseToProfile(resource,baseType);
                        if (newResource) {
                            var conf = appConfigSvc.getCurrentConformanceServer();
                            var urlBase = conf.realUrl ||conf.url;      //to allow for proxied severs (like Grahame)

                            newResource.id = $scope.input.name;
                            newResource.name = $scope.input.name;
                            newResource.url = urlBase + $scope.input.name;
                            newResource.date = moment().format();
                            newResource.description = $scope.input.description;
                            //newResource.short = $scope.input.short;
                            newResource.publisher = $scope.input.publisher;
                            //at the time of writing (Oct 12), the implementaton of stu3 varies wrt 'code' & 'keyword'. Remove this eventually...
                            newResource.identifier = [{system:"http://clinfhir.com",value:"author"}]

                           // newResource.code = [{system:'http://fhir.hl7.org.nz/NamingSystem/application',code:'clinfhir'}]

                            console.log(newResource);
                            SaveDataToServer.updateStructureDefinition(conf,newResource).then(
                                function(){
                                    modalService.showModal({},{bodyText:"The new profile has been created, and may be edited"})
                                    $scope.$close(newResource);     //close, returning the profile
                                },
                                function(err) {
                                    $scope.validateResults = err.data;
                                    modalService.showModal({},{bodyText:"Sorry, there was an error: "+angular.toJson(err)})

                                }
                            ).finally(function(){
                                $rootScope.$broadcast('setWaitingFlag',false);
                            })
                        }



                    },
                    function(err) {
                        alert('error '+ angular.toJson(err))
                    }
                )

            };


            //change the metadata in the base SD to be a profile on it. Depends on the fhir version..
            function adaptBaseToProfile(resource,type) {
                var newResource = {resourceType:'StructureDefinition'};
                var fhirVersion = appConfigSvc.getCurrentFhirVersion(); //defaults to 3 unless both data and conformance servers are on 2...

console.log(fhirVersion)
                if (fhirVersion == 2) {
                    newResource.constrainedType = type;
                    newResource.base = "http://hl7.org/fhir/StructureDefinition/"+type;
                    newResource.code = [{system:'http://fhir.hl7.org.nz/NamingSystem/application',code:'clinfhir'}]
                } else if (fhirVersion == 3) {
                    //newResource.type = type;
                    newResource.type = type;
                    newResource.derivation = 'constraint';
                    newResource.baseDefinition = "http://hl7.org/fhir/StructureDefinition/"+type;
                    newResource.keyword = [{system:'http://fhir.hl7.org.nz/NamingSystem/application',code:'clinfhir'}]

                } else {
                    modalService.showModal({},{bodyText:"There was an unknown FHIR verison: "+fhirVersion})
                    return null;
                }

                newResource.status='draft';
                newResource.snapshot = angular.copy(resource.snapshot)
                newResource.fhirVersion = resource.fhirVersion;
                newResource.kind = resource.kind;
                newResource.abstract = false;
                return newResource;
            }


            RenderProfileSvc.getAllStandardResourceTypes().then(
                function(standardResourceTypes) {
                    $scope.allResourceTypes = standardResourceTypes;       //use to define the context for an extension...
                    //console.log($scope.allResourceTypes)
                }
            );

            $scope.checkProfileExists = function(name) {
                if (name.indexOf(' ')>-1) {
                    modalService.showModal({},{bodyText:"The name cannot contain spaces"})
                    return;
                }

                var url = $scope.conformanceSvr.url + "StructureDefinition/"+name;
                $scope.showWaiting = true;
                $scope.canSaveEd = false;
                GetDataFromServer.adHocFHIRQuery(url).then(
                    function(data){

                        if (Utilities.isAuthoredByClinFhir(data.data)) {
                            modalService.showModal({},{bodyText:"There's already a profile with this name. If you carry on. it will be replaced."})
                        } else {
                            modalService.showModal({},{bodyText:"Sorry, there's already a profile with this name"})
                        }

                    },function(err){
                        console.log(err);
                        //as long as the status is 404 or 410, it's save to create a new one...
                        if (err.status == 404 || err.status == 410) {
                            $scope.canSaveEd = true;

                        } else {
                            var config = {bodyText:'Sorry, there was an unknown error: '+angular.toJson(err,true)};
                            modalService.showModal({}, config)

                        }
                    }).finally(function(){
                    $scope.showWaiting = false;
                })
            };
            $scope.conformanceSvr = appConfigSvc.getCurrentConformanceServer();

            if ($rootScope.userProfile && $rootScope.userProfile.extDef) {
                $scope.input.publisher = $rootScope.userProfile.extDef.defaultPublisher;
            }



            
            

    }



);
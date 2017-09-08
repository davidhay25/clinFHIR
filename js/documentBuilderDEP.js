angular.module("sampleApp").controller('documentBuilderCtrlDEP',
    function ($scope,$rootScope, $http,ResourceUtilsSvc,$uibModal,appConfigSvc,$localStorage,$window) {

        $scope.ResourceUtilsSvc = ResourceUtilsSvc;
        $scope.appConfigSvc = appConfigSvc;
        $scope.documentBundle = {};
        $scope.possibleResources = [];
        $scope.oneResourceType = [];
        $scope.input = {};

        $scope.emptyReasons = {}
        $scope.emptyReasons.nilknown = "Nil known";
        $scope.emptyReasons.notasked = "Not asked";
        $scope.emptyReasons.withheld = "Withheld";
        $scope.emptyReasons.unavailable = "Unavailable";


        $scope.moveSectionUp = function(evt,inx) {
            evt.stopPropagation();
            var list = $scope.config.sections;
            var b = list[inx-1];
            list[inx-1] = list[inx];
            list[inx] = b;
            buildDocument()
        };

        $scope.moveSectionDown = function(evt,inx) {
            evt.stopPropagation();
            var list = $scope.config.sections;
            var b = list[inx+1];
            list[inx+1] = list[inx];
            list[inx] = b;
            buildDocument()
        };


        $rootScope.$on('patientSelected',function(ev,patientResource){
            console.log(patientResource)
            $scope.currentPatient = patientResource;
            var svc = appConfigSvc.getCurrentDataServer();
            console.log(svc)
            var url = svc.url + 'Patient/'+patientResource.id+'/$everything?_count=100'

            $http.get(url).then(
                function(data){
                    $scope.allResourcesBundle = data.data;
                    //get the unique resources
                    $scope.uniqueResourceTypes = {};

                    $scope.allResourcesBundle.entry.forEach(function(entry){
                        var resource = entry.resource;
                        var type =resource.resourceType;

                        if (! $scope.uniqueResourceTypes[type]) {
                            $scope.uniqueResourceTypes[type] = {count: 1,display: type + 1,type:type}
                        } else {
                            $scope.uniqueResourceTypes[type].count ++
                            $scope.uniqueResourceTypes[type].display = type + " " +$scope.uniqueResourceTypes[type].count;
                        }

                    })


                    console.log(data.data)
                }
            );

        });
        

        //when the user wants to locate an existing patient in the data server
        $scope.findPatient = function(){
            $uibModal.open({
                backdrop: 'static',      //means can't close by clicking on the backdrop. stuffs up the original settings...
                keyboard: false,       //same as above.
                templateUrl: 'modalTemplates/searchForPatient.html',
                size:'lg',
                controller: function($scope,ResourceUtilsSvc,resourceSvc,supportSvc,resourceCreatorSvc,appConfigSvc,modalService){

                    $scope.input={mode:'find',gender:'male'};   //will be replaced by name randomizer
                    $scope.input.dob = new Date(1982,9,31);     //will be replaced by name randomizer
                    $scope.outcome = {log:[]};

                    $scope.input.createSamples = true;
                    //when the 'Add new patient' is selected...
                    $scope.seletNewPatientOption = function(){
                        alert ('Sorry, new patient functionality not available from here')
                    };

                    var addLog = function(display) {
                        $scope.outcome.log.push(display);
                    };

                    $scope.ResourceUtilsSvc = ResourceUtilsSvc;


                    //supportSvc.checkReferenceResources

                    $scope.selectNewPatient = function(patient) {
                        appConfigSvc.setCurrentPatient(patient);
                        //$scope.recent.patient = appConfigSvc.getRecentPatient();
                        $rootScope.$emit('patientSelected',patient);
                        $scope.$close();
                    };

                    $scope.searchForPatient = function(name) {
                        $scope.nomatch=false;   //if there were no matching patients
                        delete $scope.matchingPatientsList;
                        if (! name) {
                            alert('Please enter a name');
                            return true;
                        }
                        $scope.waiting = true;
                        resourceCreatorSvc.findPatientsByName(name).then(
                            function(data){
                                // ResourceUtilsSvc.getOneLineSummaryOfResource(patient);
                                $scope.matchingPatientsList = data;
                                if (! data || data.length == 0) {
                                    $scope.nomatch=true;
                                }


                            },
                            function(err) {
                                modalService.showModal({}, {bodyText: 'Error finding patient - have you selected the correct Data Server?'})
                            }
                        ).finally(function(){
                            $scope.waiting = false;
                        })
                    };



                    $scope.cancel = function () {
                        $scope.$close();
                    }

                }
            })
        }


        
        //store the config locally for now.
        if (! $localStorage.docBuilderConfig) {
            $http.get("artifacts/documentBuilderConfig.json").then(
                function(data) {
                    console.log(data.data);
                    $scope.config = data.data;
                    $localStorage.docBuilderConfig = angular.copy(data.data);
                }
            );
        } else {
            $scope.config = angular.copy($localStorage.docBuilderConfig);   //the config object will get updated


        }
        
        //add a new section to the document...
        $scope.addSection = function() {
            var name = $window.prompt('What is the document name');
            if (name) {

                $localStorage.docBuilderConfig.sections.push({"display":name,"sectionCode":"1098-1","types":["Observation","Condition"]});
                $scope.config.sections.push({"display":name,"sectionCode":"1098-1","types":["Observation","Condition"]});
            }
        };

        //when a resource is removed from the current section
        $scope.removeResource = function(inx) {
            var res = $scope.selectedSection.resources.splice(inx, 1);
            buildListOfPossibleResources(res.resourceType);     //update the list of possibilities
            buildDocument();
        };

        //when a single resource is selected to be added
        $scope.resourceSelected = function(res) {
            console.log(res);
            $scope.selectedSection.resources.push(res);
            delete $scope.selectedSection.emptyReason;          //make sure that emptyReason isn't set...
            buildListOfPossibleResources(res.resourceType);     //update the list of possibilities
            buildDocument();
        };

        //when a resource type is selected...
        $scope.typeSelected = function(typ) {
            console.log($scope.input.type.type)
            buildListOfPossibleResources($scope.input.type.type)
        };


        function buildListOfPossibleResources(typ) {
            $scope.oneResourceType.length = 0;
            $scope.allResourcesBundle.entry.forEach(function(entry){
                var resource = entry.resource;
                if (resource.resourceType == typ) {

                    //this is the correct type, is it already in this section?
                    var canAdd = true;
                    $scope.selectedSection.resources.forEach(function(res){
                        if (res.id == resource.id) {        //already selected
                            canAdd = false;
                        }
                    });
                    if (canAdd) {
                        $scope.oneResourceType.push(resource)
                    }

                    //$scope.oneResourceType.push(resource)

                }

            });
//console.lo
        }

        //mark that a section deliberately has no resources in it...
        $scope.setEmptyReason = function() {
            if ($scope.input.emptyReason) {
                $scope.selectedSection.emptyReason = $scope.input.emptyReason;
            } else {
                delete $scope.selectedSection.emptyReason
            }
            buildDocument();
        };

        $scope.setText = function(){
            $scope.selectedSection.text = $scope.input.text;
            buildDocument();
        }

        //when a single section has been selected
        $scope.sectionSelected = function(section) {
            section.resources = section.resources ||[];     //list of resources in this section
            $scope.selectedSection = section;
            $scope.possibleResources.length = 0;

            $scope.input.text = $scope.selectedSection.text ;

            //if an empty reason as been selected, then enable the emptyreason dialog and set the value...
            if ($scope.selectedSection.emptyReason) {
                $scope.input.emptyReason = $scope.selectedSection.emptyReason;
            } else {
                //other wise delete it...
                delete $scope.input.emptyReason;
            }
            
            if ($scope.allResourcesBundle && $scope.allResourcesBundle.entry) {
                $scope.allResourcesBundle.entry.forEach(function(entry){
                    var resource = entry.resource;
                    if (section.types.indexOf(resource.resourceType) > -1){
                        $scope.possibleResources.push(resource)
                    }

                })
            }

            
        };

        //build the actual document bundle
        var buildDocument = function() {

           var doc = {resourceType:'Bundle',type:'document'}

            doc.entry = [];

            //add the composition
            var comp = buildComposition();
            addToBundle(comp);

            //now add the sections - assume one level for now...

            $scope.config.sections.forEach(function(section){


                var compSection = {};
                compSection.title = section.display;
                compSection.code = {coding:[{code:section.sectionCode}]};
                compSection.text = "";


                if (section.emptyReason) {
                    comp.section.push(compSection);     //add to the composition
                    compSection.emptyReason = {coding:[{code:section.emptyReason,system:"http://hl7.org/fhir/ValueSet/list-empty-reason"}]}
                } else if (section.resources && section.resources.length > 0) {


                    comp.section.push(compSection);     //add to the composition
                    compSection.entry = compSection.entry || [];
                    section.resources.forEach(function(res){
                        addToBundle(res);       //add the resource to the bundle
                        var entry = {"reference":res.resourceType + "/" + res.id}; //assume a local reference
                        entry.display = ResourceUtilsSvc.getOneLineSummaryOfResource(res);
                        compSection.entry.push(entry);      //add a reference from the section to the resource
                    })
                } else if (section.text) {
                    //text only - ie no resources...
                    comp.section.push(compSection);     //add to the composition

                    compSection.title = section.display;
                }


                if (section.text) {
                    compSection.text = section.text
                } else {
                    delete compSection.text;
                }

            });


            $scope.document = doc;


            function addToBundle(res) {
                doc.entry.push({resource:res})
            }


        };

        var buildComposition = function() {
            var comp = {resourceType:'Composition',date: "2016-09-16",status:"final",section:[]}

            return comp;
        }

});
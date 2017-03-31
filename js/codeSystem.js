
angular.module("sampleApp")
    .controller('codeSystemCtrl',
        function ($scope,appConfigSvc,GetDataFromServer,Utilities,modalService,$uibModal,SaveDataToServer) {

            $scope.appConfigSvc = appConfigSvc;
            $scope.input = {};
            $scope.cs = {concept:[]};     //the CodeSystem resource
            $scope.state = 'find';          //find, edit, show

            $scope.input.searchPublisher = 'Orion'

            // modalService.showModal({}, modalOptions).then(

            $scope.displayServers = "Conformance: " + appConfigSvc.getCurrentConformanceServer().name
                + "<div>Data: " + appConfigSvc.getCurrentDataServer().name + "</div>"
                + "<div>Term: " + appConfigSvc.getCurrentTerminologyServer().name + "</div>";

            $scope.saveCS = function() {
                $scope.waiting = true;
                SaveDataToServer.saveResource($scope.cs,appConfigSvc.getCurrentTerminologyServer().url).then(
                    function(data) {
                        if ($scope.vs) {
                            //only when the CodeSystem is first created...
                            SaveDataToServer.saveResource($scope.vs,appConfigSvc.getCurrentTerminologyServer().url).then(
                                function(data1) {
                                    modalService.showModal({}, {bodyText:"CodeSystem and matching ValueSet resources have been updated"})
                                    updateComplete();
                                },
                                function(err1){
                                    modalService.showModal({}, {bodyText:"The CodeSystem resource was created, but there was an error saving the ValueSet resource: "+angular.toJson(err1)})
                                }
                            )
                        } else {
                            modalService.showModal({}, {bodyText:"CodeSystem resource has been updated"})
                            updateComplete();
                        }

                    },
                    function(err) {
                        modalService.showModal({}, {bodyText:"There was an error saving the CodeSystem resource: "+angular.toJson(err)})

                    }
                ).finally(function () {
                    $scope.waiting = false;
                })

                function updateComplete(){
                    delete $scope.cs;
                    $scope.state = 'find';
                    $scope.searchForCS($scope.input.searchName,$scope.input.searchPublisher);

                }

            };

            $scope.cancelUpdate = function(){

                var modalOptions = {
                    closeButtonText: "No, I've changed my mind",
                    actionButtonText: 'Yes, return to search',
                    headerText: 'Cancel changes',
                    bodyText: 'Are you sure you want to abandon the changes you have made to this CodeSystem?'
                };

                modalService.showModal({}, modalOptions).then(
                    function(){
                        delete $scope.cs;
                        $scope.state = 'find';
                        $scope.isAuthoredByClinFhir = false;
                        $scope.isDirty = false;


                    }
                )
            }

            //load the new extension page
            $scope.newCS = function() {
                $uibModal.open({
                    templateUrl: 'modalTemplates/newCodeSystem.html',
                    //size: 'lg',
                    controller: function($scope,appConfigSvc,publisher){

                        $scope.input = {};
                        $scope.input.publisher = publisher;
                        $scope.appConfigSvc = appConfigSvc;

                        $scope.save = function(){
                            var vo = {name:$scope.input.name.replace(/\s+/g, ''),
                                title:$scope.input.title,
                                description:$scope.input.description,
                                publisher:$scope.input.publisher}
                            $scope.$close(vo)
                        };

                        $scope.checkCSExists = function(name) {
                            name.replace(/\s+/g, '');

                            var url = appConfigSvc.getCurrentTerminologyServer().url + "CodeSystem/"+name;
                            $scope.showWaiting = true;
                            GetDataFromServer.adHocFHIRQuery(url).then(
                                function(data){
                                    modalService.showModal({}, {bodyText:"Sorry, this name is already in use."})
                                },function(err){
                                    console.log(err);
                                    //as long as the status is 404 or 410, it's save to create a new one...
                                    if (err.status == 404 || err.status == 410) {
                                        $scope.canSaveCS = true;
                                    } else {
                                        var config = {bodyText:'Sorry, there was an unknown error: '+angular.toJson(err,true)};
                                        modalService.showModal({}, config)
                                    }
                                }).finally(function(){
                                $scope.showWaiting = false;
                            })
                        };

                    },
                    resolve : {
                        publisher : function() {
                            return $scope.input.searchPublisher
                        }

                    }
                }).result.then(
                    function(vo) {
                        //console.log(vo)
                        //create a new CS
                        var vsSuffix = '-cf-vs';
                        $scope.cs = {resourceType:'CodeSystem',concept:[]}
                       // makeExample()   //temp !!!
                        $scope.cs.url = appConfigSvc.getCurrentTerminologyServer().url + "CodeSystem/" + vo.name;
                        //todo - should I check for the ValueSet or just create it?
                        $scope.cs.valueSet = appConfigSvc.getCurrentTerminologyServer().url  + "ValueSet/" + vo.name + vsSuffix;
                        $scope.cs.title = vo.title;
                        $scope.cs.name = vo.name;
                        $scope.cs.id = vo.name;
                        $scope.cs.description = vo.description;
                        $scope.cs.publisher = vo.publisher;

                        var isCFUrl = appConfigSvc.config().standardExtensionUrl.clinFHIRCreated;
                        Utilities.addExtensionOnce($scope.cs,isCFUrl,{valueBoolean:true});

                        //now create the matching ValueSet that will expand to include all concepts...
                        $scope.vs = {resourceType:'ValueSet',status:'draft',compose:{include:[]}};
                        $scope.vs.id = vo.name + vsSuffix;
                        $scope.vs.name = vo.name;
                        $scope.vs.url =  $scope.cs.valueSet;
                        $scope.vs.description = "An automatically generated valueSet to provide complete binding to the " +vo.name+ " CodeSystem resource."
                        $scope.vs.compose.include.push({system:$scope.cs.url})
                        $scope.vs.publisher = vo.publisher;
                        Utilities.addExtensionOnce($scope.vs,isCFUrl,{valueBoolean:true});

                        $scope.state = 'edit';
                        $scope.isDirty = true;

                        console.log($scope.cs)
                        $scope.isAuthoredByClinFhir = true;

                    })
            };

            $scope.previewCS = function(cs) {
                delete $scope.vs;
                $scope.cs = cs;
                $scope.state = 'preview'
                $scope.isAuthoredByClinFhir = isCFAuthored(cs);
                makeV2ValueSet();

            };

            $scope.editCS = function(){
                $scope.state = 'edit'
            }


            function isCFAuthored(cs) {
                var isCFUrl = appConfigSvc.config().standardExtensionUrl.clinFHIRCreated;
                var resp = false;
                //if authored by CF, then can edit
                var ext = Utilities.getSingleExtensionValue(cs, isCFUrl)
                if (ext && ext.valueBoolean) {
                    resp=true;

                }
                return resp;
            }

            $scope.selectCSDEP = function(cs) {
                delete $scope.vs;
                $scope.cs = cs;
                $scope.state = 'show'
                $scope.isAuthoredByClinFhir = false;
                console.log(cs)
                if (isCFAuthored(cs)) {
                    $scope.isAuthoredByClinFhir = ext.valueBoolean;
                    $scope.state = 'edit'
                }
                /*
                var isCFUrl = appConfigSvc.config().standardExtensionUrl.clinFHIRCreated;

                //if authored by CF, then can edit
                var ext = Utilities.getSingleExtensionValue(cs, isCFUrl)
                if (ext && ext.valueBoolean) {
                    $scope.isAuthoredByClinFhir = ext.valueBoolean;
                    $scope.state = 'edit'

                }
                */
                console.log($scope.isAuthoredByClinFhir)

            };




            //find matching CodeSystems based on name
            $scope.searchForCS = function(name,publisher){
                delete $scope.isDirty;
                $scope.showWaiting = true;
                delete $scope.searchResultBundle;
                delete $scope.message;
                delete $scope.input.vspreview;
                var filter="";
                if (name) {
                    filter = "&name:contains="+name;
                }

                if (publisher) {
                    filter = "&publisher:contains="+publisher;
                }
                filter = filter.substr(1);


                var url =  appConfigSvc.getCurrentTerminologyServer().url+"CodeSystem";

                if (filter) {
                    url += '?'+filter;
                }
               $scope.url = url;


                $scope.waiting = true;
                GetDataFromServer.adHocFHIRQueryFollowingPaging(url).then(
                    function(data){
                        $scope.searchResultBundle = data.data;
                        if (! data.data || ! data.data.entry || data.data.entry.length == 0) {
                            $scope.message = 'No matching CodeSystems found'
                        }
                    },
                    function(err){
                        alert(angular.toJson(err))
                    }
                ).finally(function(){
                    $scope.waiting = false;
                })
            };

            $scope.changeDescription = function(description) {
               // $scope.cs.description = description;
                $scope.isDirty = true;
            }

            $scope.removeConcept = function(inx){
                $scope.cs.concept.splice(inx,1);
                $scope.isDirty = true;
                makeV2ValueSet();

            };

            $scope.addConcept = function(){

                if (! $scope.input.code || ! $scope.input.display) {
                    modalService.showModal({}, {bodyText:"Code and Display are needed"})
                } else {
                    var concept = {code:$scope.input.code,display:$scope.input.display,definition:$scope.input.definition}
                    $scope.cs.concept.push(concept);
                    $scope.isDirty = true;
                }

                delete $scope.input.code;
                delete $scope.input.display;
                delete $scope.input.definition;

                makeV2ValueSet()

            };

            $scope.moveConcept = function(inx,dirn) {
                var ar = $scope.cs.concept;
                moveThing(ar,inx, dirn);
                makeV2ValueSet()

            };


            function moveThing(ar,inx,dirn) {
                $scope.isDirty = true;
                if (dirn == 'up') {

                    var x = ar.splice(inx-1,1);  //remove the one above
                    ar.splice(inx,0,x[0]);       //and insert...


                } else {
                    var x = ar.splice(inx+1,1);  //remove the one below
                    ar.splice(inx,0,x[0]);       //and insert...
                }
            }

            //generate a version 2 ValueSet that matches the CodeSystem we are building...
            function makeV2ValueSet() {
                var vsSuffix = '-cf-v2-vs';
                var cs = $scope.cs;         //the codeset we are copying from
                var v2vs = {resourceType:'ValueSet',status:'draft'};

                var isCFUrl = appConfigSvc.config().standardExtensionUrl.clinFHIRCreated;
                Utilities.addExtensionOnce(v2vs,isCFUrl,{valueBoolean:true});

                v2vs.id = cs.name.replace(/\s+/g, '')   + vsSuffix; //remove all spaces
                v2vs.name = cs.name;
                v2vs.url =  $scope.cs.url;
                v2vs.description = "An automatically generated version 2 valueSet that matches the " +cs.name+ " CodeSystem resource."
                v2vs.publisher = cs.publisher;
                var codeSystem = {system:cs.url,concept:[]}
                v2vs.codeSystem = [codeSystem];


                $scope.v2Vs = angular.copy($scope.cs)
                if ($scope.cs.concept) {
                    $scope.cs.concept.forEach(function(cd){
                        delete cd.property;     //not a v2 element
                        codeSystem.concept.push(cd)
                    })

                }
                $scope.v2ValueSet = v2vs;

            }

            $scope.copyV2VS = function(svr) {
                //copy the v2 valueset to the designated server
                console.log(svr);
                SaveDataToServer.saveResource($scope.v2ValueSet,svr.url).then(
                    function(data){
                        modalService.showModal({}, {bodyText:'The ValueSet has been saved at: '+svr.url+$scope.v2ValueSet.id})
                    },
                    function(err) {
                        modalService.showModal({}, {bodyText:'There was an error: '+ angular.toJson(err)})
                    }
                )



            }

            function makeExample() {
                $scope.cs.name = 'Moon Phase';
                $scope.cs.concept.push({code:'new',display:'New Moon',definition:"Disc completely in Sun's shadow (lit by earthshine only)"})
                $scope.cs.concept.push({code:'wc',display:'Waxing Crescent',definition:'1 -> 49% lit disc'})
                $scope.cs.concept.push({code:'q1',display:'First Quarter',definition:'50% lit disc'})

                $scope.cs.concept.push({code:'waxg',display:'Waxing Gibbous',definition:'51 -> 99% lit disc'})
                $scope.cs.concept.push({code:'full',display:'Full Moon',definition:'Completely illuminated disc'})
                $scope.cs.concept.push({code:'waneg',display:'Waning Gibbous',definition:'99 -> 51 % lit disc'})
                $scope.cs.concept.push({code:'lq',display:'Last Quarter',definition:'50% lit disc'})
                $scope.cs.concept.push({code:'wanecres',display:'Waning Crescent',definition:'49 -> 1% lit disc'})

                $scope.isAuthoredByClinFhir = true;

            }

            //makeExample();





    })

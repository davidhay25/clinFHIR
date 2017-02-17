
angular.module("sampleApp")
    .controller('codeSystemCtrl',
        function ($scope,appConfigSvc,GetDataFromServer,Utilities,modalService,$uibModal) {

            $scope.input = {};
            $scope.cs = {concept:[]};     //the CodeSystem resource
            $scope.state = 'find';          //find, edit, show

            // modalService.showModal({}, modalOptions).then(

            //load the new extension page
            $scope.newCS = function() {
                $uibModal.open({
                    templateUrl: 'modalTemplates/newCodeSystem.html',
                    //size: 'lg',
                    controller: function($scope,appConfigSvc){

                        $scope.input = {};
                        $scope.appConfigSvc = appConfigSvc;

                        $scope.save = function(){
                            var vo = {name:$scope.input.name,title:$scope.input.title,description:$scope.input.description}
                            $scope.$close(vo)
                        };

                        $scope.checkCSExists = function(name) {
                            var url = appConfigSvc.getCurrentTerminologyServer() + "CodeSystem/"+name;
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

                    }
                }).result.then(
                    function(vo) {
                        //console.log(vo)
                        //create a new CS
                        $scope.cs = {resourceType:'CodeSystem'}
                        $scope.cs.url = appConfigSvc.getCurrentTerminologyServer().url + vo.name;
                        $scope.cs.title = vo.title;
                        $scope.cs.name = vo.name;
                        $scope.cs.description = vo.description;
                        $scope.state = 'edit';
                        $scope.isDirty = true;

                        console.log($scope.cs)

                    })
            };

            $scope.selectCS = function(cs) {
                $scope.cs = cs;
                $scope.state = 'show'
                $scope.isAuthoredByClinFhir = false;
                console.log(cs)
                var isCFUrl = appConfigSvc.config().standardExtensionUrl.clinFHIRCreated;

                //if authored by CF, then can edit
                var ext = Utilities.getSingleExtensionValue(cs, isCFUrl)
                if (ext && ext.valueBoolean) {
                    $scope.isAuthoredByClinFhir = ext.valueBoolean;
                    $scope.state = 'edit'

                }
                console.log($scope.isAuthoredByClinFhir)

            };


            //find matching CodeSystems based on name
            $scope.search = function(filter){
                delete $scope.isDirty;
                $scope.showWaiting = true;
                delete $scope.searchResultBundle;
                delete $scope.message;
                delete $scope.input.vspreview;

                var url =  appConfigSvc.getCurrentTerminologyServer().url+"CodeSystem?name:contains="+filter;// $scope.valueSetRoot+"?name="+filter;

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
                    $scope.showWaiting = false;
                })
            };

            $scope.addConcept = function(){
                var concept = {code:$scope.input.code,display:$scope.input.display,definition:$scope.input.definition}
                $scope.cs.concept.push(concept);
                $scope.isDirty = true;
            };

            $scope.moveConcept = function(inx,dirn) {
                var ar = $scope.cs.concept;
                moveThing(ar,inx, dirn);

            };


            function moveThing(ar,inx,dirn) {

                if (dirn == 'up') {

                    var x = ar.splice(inx-1,1);  //remove the one above
                    ar.splice(inx,0,x[0]);       //and insert...


                } else {
                    var x = ar.splice(inx+1,1);  //remove the one below
                    ar.splice(inx,0,x[0]);       //and insert...
                }
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

            makeExample();



    })

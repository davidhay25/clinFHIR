angular.module("sampleApp").controller('consultbuilderCtrl',
    function ($scope,$http,GetDataFromServer,modalService,appConfigSvc) {

        
        var testUrl = "http://fhirtest.uhn.ca/baseDstu2/Basic/cf"

        var config = appConfigSvc.config();
        var serverBase = config.servers.data;       //the url of the data server


        $scope.allNotes = [];   //all notes - actually (at the moment) Basic resources

        $scope.resources = [];      //list of all possible resourcs
        $scope.consult = {};        //the actual consultation

        /*
        //temp read current note
        $http.get(testUrl).then(
            function(data) {
                var basic = data.data;
                //console.log(basic);
                var note = basic.extension[0].valueString;

                $scope.consult = angular.fromJson(atob(note));
            }
        );
        
        */



        
        $scope.consult.s = {content:[]};
        $scope.consult.o = {content:[]};
        $scope.consult.a = {content:[]};
        $scope.consult.p = {content:[]};

        $scope.input = {};

        $http.get('artifacts/consultBuilderConfig.json').then(
            function(data) {
                //console.log(data);
                $scope.resources = data.data.config.resources;
                $scope.noteType = data.data.config.noteType;
                $scope.input.noteType = $scope.noteType[0];         //default to the first in the list
            }
        );

        $scope.input.soapModel = 's';
        $scope.soapModelDetail = {};
        $scope.soapModelDetail.s = {display:'Subjective'};
        $scope.soapModelDetail.o = {display:'Objective'};
        $scope.soapModelDetail.a = {display:'Assessment'};
        $scope.soapModelDetail.p = {display:'Plan'};

        function load() {
            var url = serverBase + "Basic?code=http://clinfhir.com/fhir/NamingSystem/cf|note";      //todo add patient
            $http.get(url).then(
                function(data) {
                    //console.log(data);
                    $scope.allNotes = data.data;    //this is a bundle of Basic resources
  /*
                    console.log($scope.allNotes);
                    var hx = $scope.allNotes.entry[0].resource;
                    var note = atob(hx.extension[0].valueString);
                    $scope.historicNote = angular.fromJson(note);
*/
                }
            );
        }
        load();
        
        //extract the actual note from the Basic resource
        //being lazy extracting the extensions - should really look at the url...
        $scope.showNote = function(basic) {
            var note = atob(basic.extension[0].valueString);
            $scope.historicNote = angular.fromJson(note);
            //console.log($scope.historicNote)


            //$scope.historicNoteType = basic.extension[1].valueCoding
            
        };
        


        //save the note. Right now, we're saving is as a basic resource. Need to think about how to save real resources...
        $scope.save = function () {
            var basic = {resourceType:'Basic'}
            basic.code = {coding : [{system:'http://clinfhir.com/fhir/NamingSystem/cf',code:'note'}],text:'cfClinicalNote'};
            basic.created = moment().format();

            //this is not the correct usage for identifier - but it's convenient for now...
            basic.identifier = [];
            basic.identifier.push({system:'http://clinfhir.com/fhir/NamingSystem/cfNoteType',value:'progNote'})
            basic.extension = [];

            var extension = {url:'http://clinfhir.com/fhir/StructureDefinition/clinicalNote'};
            var json = angular.toJson($scope.consult);
            //console.log(json);

            extension.valueString = btoa(json);
            basic.extension.push(extension);

            //the type of note
            basic.extension.push({url:"http://clinfhir.com/fhir/StructureDefinition/clinicalNoteType",valueCoding:$scope.input.noteType});
         

            $scope.showWaiting = true;
            $http.post(serverBase+'Basic',basic).then(
                function(data) {
                    alert('saved')
                },function(err) {
                    alert(angular.toJson(err));
                }
            ).finally(
                function () {
                    $scope.showWaiting = false;
                }
            )

        };
        
        //select a new resource to add to the note
        $scope.newResource = function(resource) {
            $scope.addNewResource = resource; 
        };

        //add the resource to the note
        $scope.addResource = function(resource) {
            var newResource = angular.copy($scope.addNewResource)
            newResource.text = $scope.input.text;
            
            $scope.consult[$scope.input.soapModel].content.push(newResource);

            delete $scope.input.text;
            delete $scope.addNewResource;

            console.log($scope.consult)
            $scope.dirty=true;
        };

        //when a resource is selected in the actual consult note
        $scope.showResource = function(resource,key,index) {
            //console.log(key,index);
            $scope.displayResource = resource;
            $scope.keyToRemove = key;
            $scope.indexToRemove = index;


        };

        //remove the current resource
        $scope.removeResource = function() {
            var config = {bodyText:'Are you sure you want to remove the ' + $scope.displayResource.type + " resource?"};

            var modalOptions = {
                closeButtonText: "No, I've changed my mind",
                actionButtonText: 'Yes, remove it',
                headerText: 'Remve resource',
                bodyText: 'Are you sure you want to remove the ' + $scope.displayResource.type + " resource?"
            };

            modalService.showModal({}, modalOptions).then(
                function(){
                    $scope.consult[$scope.keyToRemove].content.splice($scope.indexToRemove,1)
                }
            )
        };

        //=========================== code below not currently used  =================

        //when the user wants to add specific elements to a resource
        $scope.addNewElement = function(inp) {
            $scope.newElement = inp;
            console.log(inp)

            $scope.vsDetails = {id:"condition-code","minLength":3}


        };

        $scope.vsLookup = function(text,vs) {

            console.log(text,vs)
            if (vs) {
                $scope.showWaiting = true;
                return GetDataFromServer.getFilteredValueSet(vs,text).then(
                    function(data,statusCode){
                        if (data.expansion && data.expansion.contains) {
                            var lst = data.expansion.contains;
                            return lst;
                        } else {
                            return [
                                {'display': 'No expansion'}
                            ];
                        }
                    }, function(vo){
                        var statusCode = vo.statusCode;
                        var msg = vo.error;


                        alert(msg);

                        return [
                            {'display': ""}
                        ];
                    }
                ).finally(function(){
                    $scope.showWaiting = false;
                });

            } else {
                return [{'display':'Select the ValueSet to query against'}];
            }
        };
        
        
});
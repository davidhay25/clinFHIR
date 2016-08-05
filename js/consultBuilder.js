angular.module("sampleApp").controller('consultbuilderCtrl',
    function ($scope,$rootScope,appConfigSvc,$filter,SaveDataToServer,modalService,GetDataFromServer,moment) {


        $scope.resources = [];      //list of possible resourcs


        $scope.consult = {};        //the actual consultation
        $scope.consult.s = {content:[]};
        $scope.consult.o = {content:[]};
        $scope.consult.a = {content:[]};
        $scope.consult.p = {content:[]};

        $scope.input = {};

        $scope.resources.push({type:'Condition'});
        $scope.resources.push({type:'Observation'});
        $scope.resources.push({type:'AllergyIntolerance'});
        $scope.resources.push({type:'Procedure'});
        $scope.resources.push({type:'ClinicalImpression'});
        
        $scope.input.soapModel = 's'
        $scope.soapModelDetail = {};
        $scope.soapModelDetail.s = {display:'Subjective'}
        $scope.soapModelDetail.o = {display:'Objective'}
        $scope.soapModelDetail.a = {display:'Assessment'}
        $scope.soapModelDetail.p = {display:'Plan'}


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
        };

        //when a resource is selected in the actual consult note
        $scope.showResource = function(resource) {
            $scope.displayResource = resource;
        }
        
        
});
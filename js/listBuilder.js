angular.module("sampleApp").controller('listbuilderCtrl',
    function ($scope,$rootScope,appConfigSvc,$filter,SaveDataToServer,modalService,GetDataFromServer,moment) {

        $scope.input = {};
        $scope.showResource = [];   // show/hide for individual
        $scope.versions = {};
        $scope.resource = {};
        $scope.input.showNew=false;
        $scope.hxDisplayed = false; //set true if a history item in displayed


        $rootScope.$on('patientSelected',function(event,patient){
          // console.log('patient selected in listBuilder')
        });

        //when a patient is selected, the '$everything' opeation will load all known resources into the allResources property...
        $rootScope.$on('resourcesLoadedForPatient',function(event,patient){
            //console.log('resourcesLoadedForPatient')
            $scope.allResources = appConfigSvc.getAllResources();
           // console.log($scope.allResources)

            angular.forEach($scope.allResources, function(bundle,type){
                bundle.entry.forEach(function(entry){
                    //console.log(type,entry)
                    $scope.resource[type+'/'+entry.resource.id] = entry.resource;
                })
            });
        });

        //save the updated List
        $scope.save = function() {
            $scope.selectedList.date = new moment().toISOString();
            SaveDataToServer.saveResource($scope.selectedList).then(
                function(data) {
                    $scope.dirty=false;
                    modalService.showModal({}, {bodyText: 'The List has been updated.'})
                },function(err) {
                    alert("error saving List\n"+angular.toJson(err))
                }
            )
        };

        //a particular list has been selected. Get the most recent version and display
        $scope.listSelected = function(entry) {
            console.log(entry);
            delete $scope.hxDisplayed;      //won;t be a history, so can be edited...
           // delete $scope.versionSelected;



            $scope.showResource.length=0;   //so all the resource details are hidden...
            $scope.selectedList = entry.resource;
            $scope.selectedList.entry = $scope.selectedList.entry || []


            //we always want to record the actual list id so
            //$scope.selectedListId = entry.resource.id;

            //see if the versions have been loaded for that list. Load if not...
            if (! $scope.versions[$scope.selectedList.id]) {
                //console.log('read');
                GetDataFromServer.getVersionHistory($scope.selectedList).then(
                    function(data) {
                        var versions = data.data;   //this is a bundle containing the history resources
                        console.log(versions)

                        $scope.versions[$scope.selectedList.id] = versions;


                    },function(err){
                        alert('error reading history\n'+angular.toJson(err));
                    }
                )
            } else {

            }

        };

        //a previous version is selected
        $scope.selectVersion = function(event,index) {
            console.log(index);
            var id = $scope.selectedList.id;    //the list id (even if a version is being displayed, the id will be the same of course


            event.stopPropagation();
            $scope.hxDisplayed = true;

            $scope.selectedList =$scope.versions[id].entry[index].resource;

console.log($scope.selectedList);

            /*

            try {
                var vSpecificUrl = entry.fullUrl + '/_history/'+entry.resource.meta.verionId;
                GetDataFromServer.generalFhirQuery(vSpecificUrl).then(
                    function(resource) {
                        $scope.selectedList = resource;

                    }, function (err) {

                    }
                )

                $scope.selectedList

            } catch (ex) {
                alert('There was an error retrieving that version: /n'+angular.toJson(ex));
            }
*/


        };

        $scope.moveResourceUp = function(inx) {
            var list = $scope.selectedList.entry;
            var b = list[inx-1];
            list[inx-1] = list[inx];
            list[inx] = b;
            $scope.dirty = true;
        };

        $scope.moveResourceDown = function(inx) {
            var list = $scope.selectedList.entry;
            var b = list[inx+1];
            list[inx+1] = list[inx];
            list[inx] = b;
            $scope.dirty = true;
        };

        //when a new resource is added to a list
        $scope.addResource = function(resource) {
            var reference = resource.resourceType + "/" + resource.id;  //a relative resource...
            var display = $filter("oneLineResource")(resource)
            $scope.selectedList.entry.push({item:{reference:reference,display:display}})
            $scope.dirty = true;
            $scope.input.showNew=false;
        };


        //remove an entry from the List.
        $scope.removeEntry = function(index) {
            $scope.selectedList.entry.splice(index,1);
            $scope.dirty = true;
        };

        $scope.showHideResource = function(inx){
          

            $scope.showResource[inx] = ! $scope.showResource[inx]
        }

});
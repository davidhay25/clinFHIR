angular.module("sampleApp").controller('listbuilderCtrl',
    function ($scope,$rootScope,appConfigSvc,$filter) {

        $scope.input = {};
        $scope.showResource = [];   // show/hide for individual
        $scope.resource = {};
        $scope.input.showNew=false;

        $rootScope.$on('patientSelected',function(event,patient){
           console.log('patient selected in listBuilder')
        });

        $rootScope.$on('resourcesLoadedForPatient',function(event,patient){
            //console.log('resourcesLoadedForPatient')
            $scope.allResources = appConfigSvc.getAllResources();
            console.log($scope.allResources)

            angular.forEach($scope.allResources, function(bundle,type){
                bundle.entry.forEach(function(entry){
                    //console.log(type,entry)
                    $scope.resource[type+'/'+entry.resource.id] = entry.resource;
                })
            });
            console.log($scope.resource)
        });


        $scope.listSelected = function(entry) {
            console.log(entry);
            $scope.showResource.length=0;   //so all the resource details are hidden...
            $scope.selectedList = entry.resource;
        };
/*
        $scope.selectTypeForNewDEP = function(key,value) {
            //console.log(key,value)
            //console.log($scope.input.selectedBundle)

            $scope.resourcesForSelection =[];
            $scope.input.selectedBundle.entry.forEach(function(entry){
                console.log(entry)
            })
           // $scope.selectedBundle  = 
        }
        */

        $scope.moveResourceUp = function(inx) {
            var list = $scope.selectedList.entry;
            var b = list[inx-1];
            list[inx-1] = list[inx];
            list[inx] = b;
        };

        $scope.moveResourceDown = function(inx) {
            var list = $scope.selectedList.entry;
            var b = list[inx+1];
            list[inx+1] = list[inx];
            list[inx] = b;
        };

        //when a new resource is added to a list
        $scope.addResource = function(resource) {
            var reference = resource.resourceType + "/" + resource.id;  //a relative resource...
            var display = $filter("oneLineResource")(resource)
            $scope.selectedList.entry.push({item:{reference:reference,display:display}})
            $scope.dirty = true;
            $scope.input.showNew=false;
        };


/*
        $scope.resourceSelected = function(resource) {
            console.log(resource)
        };

        */

        //remove an entry from the List.
        $scope.removeEntry = function(index) {
            $scope.selectedList.entry.splice(index,1);
            
        };

        $scope.showHideResource = function(inx){
           // delete $scope.listEntryResource
            /*
            try {
                var ref =  $scope.selectedList.entry[inx].item.reference;
                console.log(ref)
                
                
                
                var  ar = ref.split('/');
                var type = ar[0];
                var id = ar[1];
                for (var i=0; i < $scope.allResources[type].entry.length; i++) {
                    var res = $scope.allResources[type].entry[i].resource;
                    if (res.id == id) {
                        $scope.listEntryResource = res;
                        break;
                    }
                    console.log(ent)
                }

            } catch (ex) {
                alert("can't find reference")
            }
            */

            $scope.showResource[inx] = ! $scope.showResource[inx]
        }

});
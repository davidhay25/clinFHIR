angular.module("sampleApp")
    //this returns config options. At the moment it is for servers...
    //also holds the current patient and all their resources...
    //note that the current profile is maintained by resourceCreatorSvc

    .service('portHoleSvc', function($http,$q,appConfigSvc,GetDataFromServer) {

        var currentUser;
        var currentGuide;
        var hashAllResources;       //set when a patient is loaded...

        return {
            setAllResources : function(allResources){
                allResources = allResources;
            },
            getResourcesForScenario : function(){


            },
            getResourcesForProvenance : function(prov){
                var lst = [];
                prov.target.forEach(function(ref) {

                })


            }
        }
    });
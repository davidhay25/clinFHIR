angular.module("sampleApp")
    //this returns config options. At the moment it is for servers...
    //also holds the current patient and all their resources...
    //note that the current profile is maintained by resourceCreatorSvc

    .service('portHoleSvc', function($http,$q,appConfigSvc,GetDataFromServer) {

        var currentUser;
        var currentGuide;
        var hashAllResources = {};       //set when a patient is loaded...

        return {
            getResourceHistory : function (url) {
                //return a hash, indexed on version, for this resource...
                var deferred = $q.defer();

                var ar = url.split('/');
                var hxUrl = appConfigSvc.getCurrentDataServer().url + ar[0]+ "/"+ ar[1] + '/_history';      //eg condition/100/_history
                var fullId = ar[0]+ "/"+ ar[1]; //eg condition/100
                
                
               // if (hashAllResources[url]) {
                 //   deferred.resolve(hashAllResources[url])
                //} else {
                 
                    $http.get(hxUrl).then(
                        function(data){
                            // return a bundle with the history
                            var bundle = data.data;

                            var hx={};      //hash of the history items
                            if (bundle && bundle.entry) {
                                bundle.entry.forEach(function (entry) {
                                    var resource = entry.resource;      //one of the versions...
                                    hx[resource.meta.versionId] = resource;     //hash on version...
                                })
                            }
                            hashAllResources[fullId] = hx;

                            //hashAllResources[url] = data.data
                            deferred.resolve(hx)
                        },
                        function(err){
                            deferred.reject(err)
                        }

                    )
             //   }


                return deferred.promise;


            },

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
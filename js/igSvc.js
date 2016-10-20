angular.module("sampleApp")
    //this returns config options. At the moment it is for servers...
    //also holds the current patient and all their resources...
    //note that the current profile is maintained by resourceCreatorSvc

    .service('igSvc', function($http,$q,appConfigSvc,GetDataFromServer) {

        var currentUser;
        var currentGuide;

        return {
            loadIg : function(igUrl) {
                //load the IG so we can easily access it...
                GetDataFromServer.findConformanceResourceByUri(igUrl,null,'ImplementationGuide').then(
                    function(ig) {
                        console.log(ig);
                        currentGuide = ig
                    },
                    function(err) {
                        alert('error loading IG '+angular.toJson(err));
                    }
                )

            },
            getResourcesInGuide : function(type) {
                //return all the resources of the given type in the guide...
                var resources = [];
                if (currentGuide) {
                    currentGuide.package.forEach(function(pkg){
                        if (pkg.name = type) {
                            resources = pkg.resource;
                        }
                    })
                }
                return resources;

            },
            addResourceToIg: function (igUrl,packageName, vsUrl,vsName) {
                //adds the resource to the implementation guide
                var deferred = $q.defer();
                //first, get the IG..


                GetDataFromServer.findConformanceResourceByUri(igUrl,null,'ImplementationGuide').then(
                    function(ig) {
                        console.log(ig);
                        //now, find the package to add this vs to...
                        var pkg;
                        ig.package = ig.package || []
                        for (var i=0; i < ig.package.length;i++){
                            if (ig.package[i] && ig.package[i].name == packageName) {
                                pkg = ig.package[i];
                                break;
                            }
                        }
                        //if the package doesn't already exist in the IG then add it...
                        if (! pkg) {
                            pkg = {"name":packageName,resource:[]}
                            ig.package.push(pkg);
                        }

                        //now we can add the VS reference...
                        pkg.resource.push({example:false,name:vsName,sourceUri:vsUrl})

                        //and save the updated IG...
                        var url = appConfigSvc.getCurrentConformanceServer().url+"ImplementationGuide/"+ig.id;
                        $http.put(url,ig).then(
                            function(){
                                deferred.resolve();
                            },
                            function(err){
                                alert('Error saving IG:'+angular.toJson(err))
                                deferred.reject();
                            }
                        );




                    },
                    function(err) {
                        alert('error loading IG '+angular.toJson(err));
                    }

                );
                return deferred.promise;



            }
        }
    });
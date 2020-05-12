angular.module("sampleApp")
    .service('igCompanionSvc', function($http,$q) {

        return {
            getSamples : function(server) {
                //get all the samples defined. These are in DocumentReference resources....
                var deferred = $q.defer();
                let qry = server + "DocumentReference?type=http://clinfhir.com/CodeSystem/docTypes|samplequery";

                $http.get(qry).then(
                    function(data) {
                        let ar = []
                        if (data.data.entry && data.data.entry.length > 0) {
                            data.data.entry.forEach(function (entry) {
                                let dr = entry.resource;
                                if (dr.content) {
                                    let sampleGroup = {title:dr.description,queries:[]}
                                    ar.push(sampleGroup)
                                    dr.content.forEach(function (item) {
                                        let att = item.attachment
                                        sampleGroup.queries.push({url:att.url,title:att.title})
                                    })
                                }
                            })
                        }
                        deferred.resolve(ar)
                    }, function(err) {
                        console.log(err);
                        deferred.reject(err)
                    }
                )

                return deferred.promise;

            },
            getExtension: function (resource, url) {
                //return the value of an extension assuming there is only 1...
                var arExtension = [];
                if (resource && url) {
                    resource.extension = resource.extension || []
                    resource.extension.forEach(function (ext) {
                        if (ext.url == url) {
                            arExtension.push(ext)
                        }
                    });
                }

                return arExtension;
            }
        }

    });
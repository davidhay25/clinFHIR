angular.module("sampleApp")
//this performs marking services


    .service('mappingSvc', function($http,$filter,$q) {



        return {
            //imports logical model from CF and converts to vonk format
            //http://docs.simplifier.net/mappingengine/transformsetup/logicalmodel.html

            importModel: function (canUrl,confServerUrl,mapServerUrl) {
                var deferred = $q.defer();
                let name = $filter('referenceType')(canUrl);
                let fakeUrl = confServerUrl + "StructureDefinition/"+name;             //assume the url is the same as the server...
                let url = confServerUrl + "StructureDefinition?url="+fakeUrl;


                $http.get(url).then(
                    function(data){
                        let bundle = data.data;
                        if (bundle && bundle.entry && bundle.entry.length > 0) {
                            let SD = bundle.entry[0].resource;

                            if (SD.meta) {
                                delete SD.meta.extension
                            }

                            delete SD.extension;
                            SD.url = "http://hl7.org/fhir/StructureDefinition/" + name;
                            SD.kind = 'resource';
                            SD.type = name;
                            SD.id = name;
                            SD.baseDefinition = "http://hl7.org/fhir/StructureDefinition/DomainResource";
                            SD.snapshot.element.forEach(function (element) {
                                delete element.extension;
                            });
                            SD.differential = angular.copy(SD.snapshot);
                            delete SD.snapshot;
                            let el = SD.differential.element[0];
                            delete el.type;
                            delete el.label;
                            SD.differential.element[0] = el;

                            let mapUrl = mapServerUrl + "StructureDefinition/"+name;
                            $http.put(mapUrl,SD).then(
                                function (data) {
                                    deferred.resolve(data)
                                },
                                function(err) {
                                    deferred.reject(err)
                                }
                            )
                        } else {
                            deferred.reject({msg:"No model was found on the conformance server: " + url})
                        }
                    },
                    function(err) {
                        console.log(err)
                    }
                );

                return deferred.promise;


            }
        }
    })
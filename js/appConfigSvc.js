angular.module("sampleApp")
    //this returns config options. When it's all working we'll allow multiple servers...

    .service('appConfig', function() {
        return {
            config : function() {
                var config = {servers : {}}
                config.servers.terminology = "http://fhir2.healthintersections.com.au/open/";
                config.servers.data = "http://localhost:8080/baseDstu2/";
                config.servers.conformance = "http://fhir.hl7.org.nz/dstu2/";
                return config
            }
        }
    })

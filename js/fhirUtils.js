angular.module("sampleApp")
//this performs marking services


    .service('fhirUtilsSvc', function(appConfigSvc,moment) {


        let pathExtUrl = appConfigSvc.config().standardExtensionUrl.path;  //the extension for recording the model path for a comment
        let editorExtUrl = appConfigSvc.config().standardExtensionUrl.editor;
        let instanceAuthor = appConfigSvc.config().standardExtensionUrl.instanceAuthor;


        function myGetSingleExtensionValue(resource, url) {
            //return the value of an extension assuming there is only 1 (or get the last 1)...
            var extension;
            if (resource) {
                resource.extension = resource.extension || []
                resource.extension.forEach(function (ext) {
                    if (ext.url == url) {
                        extension = ext
                    }
                });
            }
            return extension;
        }


        return {
            getSingleExtensionValue : function (resource, url) {
                return myGetSingleExtensionValue(resource, url);

            }
        }
    });
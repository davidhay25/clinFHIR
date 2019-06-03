angular.module("sampleApp")
    .service('commonSvc', function() {

        return {
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
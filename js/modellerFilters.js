
angular.module("sampleApp")
    .filter('lastInPath', ['ResourceUtilsSvc', function() {
        return function(path) {
            if (path) {
                var ar = path.split('.');
                return ar[ar.length-1];
            }
        }
    }])
    .filter('pathindent', ['ResourceUtilsSvc', function() {
        return function(path) {
            if (path) {
                var ar = path.split('.');
                return 10 * ar.length;
            }
        }
    }])


    .filter('DDindent', [function() {
        return function(ddElement) {
            if (ddElement) {
                switch (ddElement.type) {
                    case "element" :
                        return 20;
                        break
                    case "grouper" :
                        return 10;
                        break
                }


            }
        }
    }])

    .filter('extensionValue', [function() {
        //get the value of the extension (assuming a valueString)
    return function(ext,url) {
        if (ext) {
            for (var i=0; i<ext.length;i++) {
                var e = ext[i];
                if (e.url == url) {
                    return e.valueString;
                    break;
                }
            }
        }

        //console.log(ext,url)
    }
}]);



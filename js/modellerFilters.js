
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
    }]);



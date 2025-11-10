angular.module("sampleApp").service('apiService', function($http, $q) {
    let currentRequest = null;

    // Cancel any in-progress request
    function cancelCurrent() {
        if (currentRequest) {
            console.log('cancelling..')
            currentRequest.resolve(); // abort the XHR
            currentRequest = null;
        }
    }

    // Cancellable POST request
    function postWithCancel(url, data, config = {}) {
        // Cancel previous request
        cancelCurrent();

        // Create a new cancel token
        currentRequest = $q.defer();

        // Add timeout to config
        config.timeout = currentRequest.promise;

        // Perform the POST
        return $http.post(url, data, config)
            .finally(() => {
                currentRequest = null; // clear when done or cancelled
            });
    }

    return {
        postWithCancel,
        cancelCurrent
    };
});


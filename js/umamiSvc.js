app.service('umamiSvc', function($timeout) {

    function safeCall(eventName, data) {
        if (window.umami) {
            window.umami.track(eventName, data);
        } else {
            // Retry briefly in case the script hasn't loaded yet
            $timeout(function() {
                if (window.umami ) {
                    window.umami.track(eventName, data);
                } else {
                    console.info("Umami not available, event skipped:", eventName);
                }
            }, 200);
        }
    }

    return { track: safeCall };
});

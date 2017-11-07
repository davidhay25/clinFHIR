angular.module("sampleApp")
//this performs marking services


    .service('sessionSvc', function() {


        var token;

        return {
            getAuthToken: function () {
                return token

            },
            setAuthToken : function(authToken){
                token = authToken;
            }
        }
    })
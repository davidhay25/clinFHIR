angular.module("sampleApp")
//this performs marking services


    .service('sessionSvc', function($localStorage) {


        var token;

        return {
            getAuthToken: function () {

                return $localStorage.oauthAccessToken

            },
            setAuthToken : function(authToken){
                $localStorage.token = authToken
                //token = authToken;
            }
        }
    })
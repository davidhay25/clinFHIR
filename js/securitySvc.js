angular.module("sampleApp").service('securitySvc', function() {

        var currentUser;

        return {
            setCurrentUser : function(user) {
                currentUser = user;
            },
            getCurrentUser : function(){
                return currentUser;
            }
        }

    });
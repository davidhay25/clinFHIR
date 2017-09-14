angular.module("sampleApp").service('securitySvc', function(Utilities,appConfigSvc) {

        var currentUser;

        return {
            setCurrentUser : function(user) {
                currentUser = user;
                //console.log(currentUser)
            },
            getCurrentUser : function(){
                //console.log(currentUser)
                return currentUser;
            },
            getPermissons : function(resource) {
                //return the permissions that the user has with regard to the current resource (generally a conformance resource)
                //eg - edit, delete. Could be type specific in the future. default (for now) is read for all (even unauthenticated}
                var permission = {canView:true};

                if (! currentUser) { return permission};

                //September 2017 - allow any logged in user to edit. todo need to think about overall access model...

                //I have super powers! )
                if (1==1 || currentUser.email == 'david.hay25@gmail.com') {
                    permission.canEdit = true;
                    permission.canDelete = true;
                    permission.canActivate = true;
                    permission.canRetire=true;
                    return permission;
                }


                var emailUrl = appConfigSvc.config().standardExtensionUrl.userEmail;
                var ext = Utilities.getSingleExtensionValue(resource,emailUrl)
                if (ext && ext.valueString) {
                    //so there is an email in the resource. Does it match?
                    if (ext.valueString == currentUser.email) {
                        permission.canDelete = true;        //yes, the user that created the resource can delete it...
                        permission.canActivate = true;      //... and activate it
                    }
                } else {
                    //if there's no email extension - but there is a logged in user - then allow edit
                    //not sure how often this will occur...
                    permission.canEdit = true;
                }
                return permission;

            }
        }

    });
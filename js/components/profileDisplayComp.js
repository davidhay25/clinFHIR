angular.module('sampleApp').component('showProfile',
    {

        bindings : {
            profile : '<',
            onvaluesetselected : '&'
        },
        templateUrl : 'js/components/profileDisplayTemplate.html',
        controller: function (resourceCreatorSvc) {
            var that = this;

            this.$onChanges = function(obj) {
                console.log(obj);
                this.selectedProfile = obj.profile.currentValue;
                console.log(this.selectedProfile)
                this.getTable();
                this.getTree();
            };

            this.showValueSet = function(uri) {
                console.log(uri);
                that.onvaluesetselected({uri:uri});

            };


            this.getTree = function() {
                delete that.treeDisplay;
                if (this.selectedProfile) {
                    that.treeDisplay = resourceCreatorSvc.createProfileTreeDisplay(this.selectedProfile, false);
                }
            };

            this.getTable = function(){

                delete that.filteredProfile;
                if (this.selectedProfile) {


                    that.filteredProfile = resourceCreatorSvc.makeProfileDisplayFromProfile(this.selectedProfile);

                }

            }

        }
})
angular.module('sampleApp').component('showProfile',
    {

        bindings : {
            profile : '<',
            onvaluesetselected : '&',
            onextensionselected : '&',
            onprofileselected : '&'
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

            //when an item with a profile is selected. could be an extension or a reference to a profiled resource or a profiled datatype
            this.showProfile = function(element,type,uri) {
                console.log(element,type,uri)
                if (element.path.indexOf('xtension') > -1 ) {
                    that.onextensionselected({uri:uri});
                } else {
                    that.onprofileselected({uri:uri});
                }


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
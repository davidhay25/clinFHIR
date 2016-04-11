angular.module('sampleApp').component('showProfile',
    {

        bindings : {
            profile : '<',
            onvaluesetselected : '&',
            onextensionselected : '&',
            onprofileselected : '&'
        },
        templateUrl : 'js/components/profileDisplayTemplate.html',
        controller: function (resourceCreatorSvc,GetDataFromServer) {
            var that = this;

            this.follow = true;
            this.profileHistory = [];       //a history of all profiles viewed

            this.$onChanges = function(obj) {
                //console.log(obj);
                this.selectedProfile = obj.profile.currentValue;
                this.profileHistory.push(this.selectedProfile.url)
                console.log(this.selectedProfile)
                this.getTable();
                this.getTree();
                setTypeDisplay();
            };


            //When the user wishes to navigate back to a previous profile
            this.reloadProfile = function(uri) {
                GetDataFromServer.findConformanceResourceByUri(uri).then(
                    function(profile) {
                        that.selectedProfile = profile;
                        setTypeDisplay();
                        that.getTable();
                        that.getTree();
                    },
                    function(err) {
                        alert(angular.toJson(err))
                    }
                )
            };

            //when an item with a profile is selected. could be an extension or a reference to a profiled resource or a profiled datatype
            this.showProfile = function(element,type,uri) {
                console.log(element,type,uri)
                if (element.path.indexOf('xtension') > -1 ) {
                    that.onextensionselected({uri:uri});
                } else {
                    that.onprofileselected({uri:uri});
                    if (that.follow) {
                        //set to follow links to other profiles...
                        GetDataFromServer.findConformanceResourceByUri(uri).then(
                            function(profile) {
                                that.selectedProfile = profile;
                                that.profileHistory.push(profile.url)
                                setTypeDisplay();
                                that.getTable();
                                that.getTree();
                            },
                            function(err) {
                                alert(angular.toJson(err))
                            }
                        )
                    }
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

            function setTypeDisplay(){
                var ar = that.selectedProfile.url.split('/');
                that.selectedType= ar[ar.length-1];
            }

        }
})
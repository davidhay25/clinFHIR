angular.module('sampleApp').component('showProfile',
    {

        bindings : {
            profile : '<',
            onvaluesetselected : '&',
            onextensionselected : '&',
            onprofileselected : '&'
        },
        templateUrl : 'js/components/profileDisplayTemplate.html',
        controller: function (resourceCreatorSvc,GetDataFromServer,$uibModal) {
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

                var modalInstance = $uibModal.open({
                    templateUrl: "/js/components/profileDisplayShowValueSet.html",
                    controller: function($scope,uri){
                        $scope.input={};

                        $scope.showAll = function() {
                            $scope.waiting = true;
                            GetDataFromServer.getExpandedValueSet($scope.vs.id).then(
                                function(result){
                                    $scope.showWaiting = false;
                                    if (result.expansion) {
                                        $scope.data = result.expansion.contains;
                                        if (! result.expansion.contains) {
                                            alert('The expansion worked fine, but no expanded data was returned')
                                        }
                                    } else {
                                        alert('Sorry, no expansion occurred');
                                    }
                                },function(err){
                                    $scope.showWaiting = false;
                                    console.log(err);
                                    if (err.status == 422) {
                                        alert('There were too many concepts to expand - use a filter.');
                                    } else {
                                        alert('Sorry, there was an error performing the expansion: '+err.msg);
                                    }

                                }
                            )
                                .finally(function(){
                                    $scope.waiting = false;
                                })
                        };

                        $scope.search = function(filter) {
                            $scope.waiting = true;
                            GetDataFromServer.getFilteredValueSet($scope.vs.id,filter).then(
                                function(result) {
                                    if (result.expansion) {
                                        $scope.data = result.expansion.contains;
                                        if (! data1.expansion.contains) {
                                            alert('The expansion worked fine, but no expanded data was returned')
                                        }
                                    } else {
                                        alert('Sorry, no expansion occurred');
                                    }
                                },
                                function(err) {
                                    angular.toJson(err);
                                }
                            ).finally(function(){
                                $scope.waiting = false;
                            })

                        };

                        //this will retrieve the valueset from the terminology server by querying the uri...
                        GetDataFromServer.getValueSet(uri).then(
                            function(vs) {
                                $scope.vs = vs;
                                console.log(vs);

                            }
                        ).finally (function(){

                        });

                    },

                    resolve: {
                        uri: function () {
                            return uri;
                        }
                    }
                });

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
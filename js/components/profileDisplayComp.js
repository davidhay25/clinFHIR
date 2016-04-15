angular.module('sampleApp').component('showProfile',
    {

        bindings : {
            profile : '<',
            treedivid : '<',           //the id of the tree DIV (there can only be a single div with this ID in the whole app
            onvaluesetselected : '&',
            onextensionselected : '&',
            onprofileselected : '&',
            ontreenodeselected : '&'
        },
        templateUrl : 'js/components/profileDisplayTemplate.html',
        controller: function (resourceCreatorSvc,GetDataFromServer,$uibModal,Utilities) {
            var that = this;
            var treeDivId = this.treedivid || 'pfTreeView';    //the div id is unique across the application, so if used multiple times, an external div must be supplied

            this.follow = true;
            this.profileHistory = [];       //a history of all profiles viewed


            this.$onChanges = function(obj) {


                //set the profile...
                if (obj.profile && obj.profile.currentValue) {
                    that.selectedProfile = obj.profile.currentValue;
                    if (that.selectedProfile) {
                        //console.log(that.selectedProfile)
                      //  this.profileHistory = [];
                        this.profileHistory.push(this.selectedProfile.url)

                        this.getTable(treeDivId);
                        //this.getTree();
                        setTypeDisplay();
                        //console.log('change selected in the profileDisplay component...')
                    }
                }

            };


            //When the user wishes to navigate back to a previous profile
            this.reloadProfile = function(uri) {
                GetDataFromServer.findConformanceResourceByUri(uri).then(
                    function(profile) {
                        that.selectedProfile = profile;
                        setTypeDisplay();
                        that.getTable(treeDivId);
                        //that.getTree();
                    },
                    function(err) {
                        alert(angular.toJson(err))
                    }
                )
            };

            //when an item with a profile is selected. could be an extension or a reference to a profiled resource or a profiled datatype
            this.showProfile = function(element,type,uri) {

                if (element.path.indexOf('xtension') > -1 ) {
                    //this is an extension
                    that.onextensionselected({uri:uri});        //throw the event
                    GetDataFromServer.findConformanceResourceByUri(uri).then(       //get the extension definition
                        function(profile) {
                           // console.log(profile);
                            var analysis = Utilities.analyseExtensionDefinition(profile);
                            console.log(analysis)

                            var modalInstance = $uibModal.open({
                                templateUrl: "/js/components/profileDisplayShowExtension.html",
                                controller: function ($scope, analysis, element) {
                                    $scope.profile=analysis.StructureDefinition;
                                    $scope.analysis = analysis;
                                    $scope.element = element;
                                    //console.log(element)

                                },
                                resolve: {
                                    analysis: function () {
                                        return analysis;
                                    },
                                    element : function() {
                                        return element;
                                    }
                                }
                            })
                        },
                        function(err) {
                            alert(angular.toJson(err))
                        }
                    )


                } else {
                    that.onprofileselected({uri:uri});          //throw the event
                    //this is a profile
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

            //show a modal that allows the user to query the associated valueset
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
                                        if (! result.expansion.contains) {
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

            //build the tree view
            this.getTreeDEP = function() {
                delete that.treeDisplay;
                if (this.selectedProfile) {
                    that.treeDisplay = resourceCreatorSvc.createProfileTreeDisplay(that.selectedProfile, false);
                }
            };

            //build the table
            this.getTable = function(treeDivId){

                delete that.filteredProfile;
                if (this.selectedProfile) {

                    //get the rows in the table...
                    var buildView = resourceCreatorSvc.makeProfileDisplayFromProfile(that.selectedProfile);
                    that.filteredProfile = buildView.lst



/*
                    $('#pfTreeView').jstree('destroy');
                    $('#pfTreeView').jstree(
                        {'core': {'multiple': false, 'data': buildView.treeData, 'themes': {name: 'proton', responsive: true}}}
                    )
                    */
                    $('#'+treeDivId).jstree('destroy');
                    $('#'+treeDivId).jstree(
                        {'core': {'multiple': false, 'data': buildView.treeData, 'themes': {name: 'proton', responsive: true}}}
                    ).on('changed.jstree', function (e, data) {
                        //console.log(data);
                        that.ontreenodeselected({item:data});

                    })
                    
                    
                }

            };

            //the type of the current profile (displayed upper right)
            function setTypeDisplay(){
                var ar = that.selectedProfile.url.split('/');
                that.selectedType= ar[ar.length-1];
            }

        }
})
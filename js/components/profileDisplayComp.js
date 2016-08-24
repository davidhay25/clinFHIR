angular.module('sampleApp').component('showProfile',
    {

        bindings : {
            profile : '<',
            treedivid : '<',           //the id of the tree DIV (there can only be a single div with this ID in the whole app
            onvaluesetselected : '&',
            onextensionselected : '&',
            onprofileselected : '&',
            ontreenodeselected : '&',
            ontreedraw : '&',
            newnode :'<',
            deleteatpath : '<',
            restoreremoved : '<',
            updateelementdefinition : '<',
            restoreatpath : '<'
        },
        templateUrl : 'js/components/profileDisplayTemplate.html',
        controller: function (resourceCreatorSvc,profileCreatorSvc,GetDataFromServer,$uibModal,Utilities) {
            var that = this;
            //todo - issue with component timing. For now require all uses of tree specify the tree id externally
            var treeDivId = this.treedivid;// || 'pfTreeView';    //the div id is unique across the application, so if used multiple times, an external div must be supplied

            this.follow = true;
            this.profileHistory = [];       //a history of all profiles viewed

            this.$onChanges = function(obj) {

                //restore a path in the profile that has been disabled
                if (obj.restoreatpath) {
                    console.log(obj.restoreatpath.currentValue);
                    if (that.baseSD && that.baseSD.snapshot && that.baseSD.snapshot.element) {
                        //first, get the SD to restore from the base (for now just the one)
                        var edToRestore;
                        var pathToInsert = obj.restoreatpath.currentValue.path;
                        for (var i=0; i<that.baseSD.snapshot.element.length; i++) {
                            var e = that.baseSD.snapshot.element[i];
                            if (e.path == pathToInsert){
                                edToRestore = e;
                                break;
                            }

                        }
                        console.log(edToRestore)

                        //so we have the ed we want to insert. Move through the profile until we have found the
                        //the base, and insert it after that. It won't necessarily be in the exact position
                        // - it will always be at the 'top' of the group but should be OK for the moment...
                        if (edToRestore) {
                            var ar = pathToInsert.split('.');
                            ar.pop();
                            var root = ar.join('.');        //this will be the direct parent of this element


                            for (var i=0; i< that.selectedProfile.snapshot.element.length; i++) {
                                var edProfile = that.selectedProfile.snapshot.element[i];
                                if (edProfile.path == root) {
                                    that.selectedProfile.snapshot.element.splice(i+1,0,edToRestore)
                                    console.log(edProfile.path)
                                    this.getTable(treeDivId);
                                    break;
                                }
                            }
                        }
                    }
                }

                //when an ED (ElementDefinition) is changed in the controller we need to update the model...
                //we pass in a VO containing the updated ed and the treeview item...
                if (obj.updateelementdefinition) {
                    console.log(obj.updateelementdefinition.currentValue)
                    var id = obj.updateelementdefinition.currentValue.item.node.id;
                    //find the item in th etreeview data that has the id
                    for (var i=0; i<that.buildView.treeData.length;i++) {
                        var item = that.buildView.treeData[i];
                        if (item.id == id) {
                            //and update the ed
                            item.data.ed = obj.updateelementdefinition.currentValue.ed;
                        }
                    }
                    //then re-announce the model...
                    that.ontreedraw({item:that.buildView.treeData});


                }

                //remove a new node that was added
                if (obj.removenewnode) {
                    var edToRestore = obj.removenewnode.currentValue;

                    //alert(edToRestore)
                    console.log(edToRestore)
                    that.selectedProfile.snapshot.element.forEach(function(ed){
                        if (ed.path == edToRestore.path) {

                            delete ed.myMeta.remove;
                        }
                    });


                    this.getTable(treeDivId);
                }

                //restore a path that was removed in this session.
                if (obj.restoreremoved) {
                    var edToRestore = obj.restoreremoved.currentValue;

                    //alert(edToRestore)
                    console.log(edToRestore)
                    that.selectedProfile.snapshot.element.forEach(function(ed){
                        if (ed.path == edToRestore.path) {
                            if (ed.path.indexOf('xtension') > -1) {
                                //this is an extenstion = we need to find the ED with the same profile...
                                //we assume that there is only a single type with a single profile...
                                //first, find the profile in the currentValue...
                                var urlOfTypeToDelete;
                                if (edToRestore.type) {
                                    //urlOfTypeToRestore = edToRestore.type[0].profile[0];
                                    urlOfTypeToRestore = Utilities.getProfileFromType(edToRestore.type[0]);

                                    
                                    
                                    if (ed.type) {
                                        if (Utilities.getProfileFromType(ed.type[0]) == urlOfTypeToRestore ) {
                                            //if (ed.type[0].profile[0] == urlOfTypeToRestore ) {
                                            
                                            ed.myMeta = ed.myMeta || {}     //should be redundant...
                                            delete ed.myMeta.remove;
                                        }
                                    }

                                }

                            } else {
                                delete ed.myMeta.remove;
                            }





                        }
                    });


                    this.getTable(treeDivId);
                }


                if (obj.deleteatpath) {
                    //actually, an ED is passed in as just a path is not enough
                    var edToDelete = obj.deleteatpath.currentValue;
                    that.selectedProfile.snapshot.element.forEach(function(ed){
                        if (ed.path == edToDelete.path) {
                            //well, we have the same path....
                            //now we need to find the profile url. We assume that the pr
                            if (ed.path.indexOf('xtension') > -1) {
                                //this is an extenstion = we need to find the ED with the same profile...
                                //we assume that there is only a single type with a single profile...
                                //first, find the profile in the currentValue...
                                var urlOfTypeToDelete;
                                if (edToDelete.type) {

                                    

                                    urlOfTypeToDelete = Utilities.getProfileFromType(edToDelete.type[0]);
                                    //urlOfTypeToDelete = edToDelete.type[0].profile[0];
                                    if (ed.type) {
                                        if (Utilities.getProfileFromType(ed.type[0]) == urlOfTypeToDelete ) {
                                            //if (ed.type[0].profile[0] == urlOfTypeToDelete ) {
                                            ed.myMeta = ed.myMeta || {}
                                            ed.myMeta.remove = true;
                                        }
                                    }
                                }
                            } else {
                                ed.myMeta = ed.myMeta || {}
                                ed.myMeta.remove=true;
                            }



                        }


                    });
                    this.getTable(treeDivId);


                }

                if (obj.newnode) {
                    //this is adding a new node to the tree... We add it to the profile, even if it might
                    //be in the wrong place. Won't upset the tree display, but does mean we need to sort
                    //by path before saving. todo - posisbly just insert in the right place to start with??
                    that.selectedProfile.snapshot.element.push(obj.newnode.currentValue);


                   // that.selectedProfile.snapshot.element.sort(function(a,b){
                     //   return a.path > b.path;
                    //})



                    this.getTable(treeDivId);
                }
                //console.log(obj);

                //set the profile...
                if (obj.profile && obj.profile.currentValue) {
                    that.selectedProfile = angular.copy(obj.profile.currentValue);
                    if (that.selectedProfile) {

                        //load the base definition for this profile. We'll use this to restore
                        var baseDefinition = that.selectedProfile.baseDefinition || that.selectedProfile.base;
                        GetDataFromServer.findConformanceResourceByUri(baseDefinition).then(
                            function(baseSD){
                                console.log(baseSD);
                                that.baseSD = angular.copy(baseSD)
                            }
                        )


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

            //build the table for the tree view...
            this.getTable = function(treeDivId){



                delete that.filteredProfile;
                if (this.selectedProfile) {

                    //get the rows in the tree source table...
                    
                    profileCreatorSvc.makeProfileDisplayFromProfile(that.selectedProfile).then(
                        function(data){
                            that.buildView = data;

                            that.ontreedraw({item:that.buildView.treeData});

                            that.filteredProfile = that.buildView.lst

                            $('#'+treeDivId).jstree('destroy');
                            $('#'+treeDivId).jstree(
                                {'core': {'multiple': false, 'data': that.buildView.treeData, 'themes': {name: 'proton', responsive: true}}}
                            ).on('changed.jstree', function (e, data) {

                                that.ontreenodeselected({item:data});
                                

                            })
                        }
                    );


                    
                    
                }

            };

            //the type of the current profile (displayed upper right)
            function setTypeDisplay(){
                var ar = that.selectedProfile.url.split('/');
                that.selectedType= ar[ar.length-1];
            }

        }
})
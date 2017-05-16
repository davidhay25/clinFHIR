
angular.module("sampleApp")
    .controller('portHoleCtrl',
        function ($scope,supportSvc,appConfigSvc,GetDataFromServer,Utilities,portHoleSvc) {

            $scope.appConfigSvc = appConfigSvc;

            $scope.input = {};

            //extension urls on provenance
            var provScenarioUrl = appConfigSvc.config().standardExtensionUrl.scenarioProvenance;
            var provNoteUrl = appConfigSvc.config().standardExtensionUrl.scenarioNote;
            var provTargetUrl = appConfigSvc.config().standardExtensionUrl.provenanceTargetUrl;

            $scope.displayProvenance = function(prov) {
                $scope.currentProvenance = prov;
            }



            //return the specific version of a reasource (in targ.local.version
            $scope.getResourceDetails = function(targ) {        //targ.local = {type:, version:, id:}
                $scope.waiting=true;
                console.log(targ)
                portHoleSvc.getResourceHistory(targ.reference).then(        //get the versions for this resource...
                    function(hx){

                        $scope.selectedResourceHx = hx;     //history (hash) of all the versions of this resource...
                        $scope.specificVersion = $scope.getSpecificVersion(hx,targ.local.version)

                    },
                    function (err) {
                        alert(angular.toJson(err))
                    }
                ).finally(function () {
                    $scope.waiting=false;
                })

            }

            //find the specific version in the array of resources

            $scope.getSpecificVersion = function(hashHx,version){
                if (hashHx) {

                    var resource;
                    angular.forEach(hashHx,function(value,key){

                        console.log(key,value)
                        if (key == version) {
                            resource = value
                        }
                        /*
                 //   for (var i=0; i< arHx.length; i++) {
                        var resource = arHx[i]
                        if (resource && resource.meta) {
                            if (resource.meta.version == version) {
                                return resource;
                            }
                        }
                        */
                    })
                    return resource;
                }
            }

            $scope.loadPatient = function() {

                supportSvc.getAllData('cf-1494878394171').then(
                    //returns an object hash - type as hash, contents as bundle - eg allResources.Condition = {bundle}
                    function (allResources) {
                        console.log(allResources)
                        $scope.allResources = allResources;
                    },
                    function(err) {
                        console.log(err);
                    }
                );

                //get the provenance recources directly (Grahame includes, Hapi doesn't)
                //?patient=cf-1494594813437
                var url = appConfigSvc.getCurrentDataServer().url + "Provenance?patient=cf-1494878394171";
                GetDataFromServer.adHocFHIRQueryFollowingPaging(url).then(
                    function(data) {
                        $scope.provenance = [];
                        var ar = []
                        if (data.data) {
                            data.data.entry.forEach(function(entry,inx) {
                                var prov = entry.resource;
                                console.log(prov)

                                prov.local = {};
                                try {
                                    prov.local.note = Utilities.getSingleExtensionValue(prov,provNoteUrl).valueString
                                } catch(ex) {

                                }
                                try {
                                    prov.local.scenario = Utilities.getSingleExtensionValue(prov,provScenarioUrl).valueString
                                } catch(ex) {

                                }

                                //this is a hack as the hapi server is not returning version specific urls
                                prov.target.forEach(function(targ){


                                    var ext = Utilities.getSingleExtensionValue(targ,provTargetUrl);
                                    if (ext) {
                                        targ.reference = ext.valueString;
                                    }

                                    var ar = targ.reference.split('/');
                                    targ.local = {type:ar[0],id:ar[1]}
                                    if (ar.length > 3) {
                                        targ.local.version = ar[3];
                                    }


                                });



                                $scope.provenance.push(prov)





                                if (prov.period) {

                                    var node = {id: inx, start: prov.period.start, resource: prov};
                                    var klass = prov.class || 'unknown';
                                    //node.group = objGroups[klass];
                                    ar.push(node);
                                } else {
                                    console.log(prov,'No period')
                                }

                            })
                        }
                        var items = new vis.DataSet(ar);

                        showTimeline({items:items})

                        $scope.provenance.sort(function(p1,p2){
                            if (moment(p1.recorded).toDate().getTime() > moment(p2.recorded).toDate().getTime()) {
                                return -1
                            } else {
                                return 1;
                            }
                        })


                        console.log($scope.provenance)
                    },
                    function(err) {
                        console.log(err);
                    }
                )




            };
            $scope.loadPatient();


            function showTimeline(timelineData) {
                $('#timeline').empty();     //otherwise the new timeline is added below the first...
                var tlContainer = document.getElementById('timeline');

                var timeline = new vis.Timeline(tlContainer);
                timeline.setOptions({});
                //timeline.setGroups(timelineData.groups);
                timeline.setItems(timelineData.items);

                timeline.on('select', function(properties){
                    timeLineItemSelected(properties,timelineData.items)
                });
            }


            function timeLineItemSelected(props,items) {
                console.log(props,items)
            }

            $scope.processView = function(view) {
                console.log(view)
                $scope.currentView = view;
            }

            $scope.views = [];
            $scope.views.push({display:'Careplan',mode:'cp'});
            $scope.views.push({display:'Task',mode:'task'});
            $scope.views.push({display:'Medications',mode:'medlist'});
            $scope.views.push({display:'Problem List',mode:'problist'});
            $scope.input.view = $scope.views[0]

    })

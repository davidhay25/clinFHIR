
angular.module("sampleApp")
    .controller('portHoleCtrl',
        function ($scope,supportSvc,appConfigSvc,GetDataFromServer,Utilities) {

            //extension urls on provenance
            var provScenarioUrl = appConfigSvc.config().standardExtensionUrl.scenarioProvenance;
            var provNoteUrl = appConfigSvc.config().standardExtensionUrl.scenarioNote;


            $scope.displayProvenance = function(prov) {
                $scope.currentProvenance = prov;
            }


            $scope.loadPatient = function() {

                supportSvc.getAllData('cf-1494850832169').then(
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
                var url = appConfigSvc.getCurrentDataServer().url + "Provenance?patient=cf-1494850832169";
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

    })

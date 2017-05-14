
angular.module("sampleApp")
    .controller('portHoleCtrl',
        function ($scope,supportSvc,appConfigSvc,GetDataFromServer) {



            $scope.loadPatient = function() {

                supportSvc.getAllData(26302).then(
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
                var url = appConfigSvc.getCurrentDataServer().url + "Provenance?patient=cf-1494594813437";
                GetDataFromServer.adHocFHIRQueryFollowingPaging(url).then(
                    function(data) {
                        $scope.provenance = [];
                        var ar = []
                        if (data.data) {
                            data.data.entry.forEach(function(entry,inx) {
                                var prov = entry.resource;
                                console.log(prov)

                                if (prov.period) {
                                    $scope.provenance.push(prov)
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

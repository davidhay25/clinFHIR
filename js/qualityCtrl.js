angular.module("sampleApp")
    .controller('qualityCtrl',
        function ($scope,$q,$http,appConfigSvc) {
            let termServer = appConfigSvc.getCurrentTerminologyServer().url;


            $scope.expandAllVS = function () {
                //analysis.valueSets comes from parent scope...
                let hash = {}, arWork = []
                $scope.vsSummary = [];
                $scope.analysis.valueSets.forEach(function (vs) {
                    //{url: valueSetUrl: strength: valueSet: codSystems}
                    let canUrl = vs.valueSetUrl;
                    if (! hash[canUrl]) {
                        hash[canUrl] = 'x'
                        let item = {canUrl:canUrl}
                        $scope.vsSummary.push(item)
                        arWork.push(expandVS(canUrl,item))
                    }

                })

                if (arWork.length > 0) {
                    $q.all(arWork).then(
                    )
                }


                function expandVS(canUrl,item) {
                    let ar = canUrl.split('|')
                    let url = termServer + "ValueSet/$expand?url=" + ar[0]
                    item.state = 'Expanding...';

                    $http.get(url).then(
                        function(data) {
                            item.state = 'Done';
                            let vs = data.data;
                            if (vs.expansion && vs.expansion.contains ) {
                                item.note = vs.expansion.contains.length + " concepts in the expansion"
                            } else {
                                item.note = "The expansion was successful, but there were no concepts in the expansion"
                            }

                        }, function(err) {
                            item.state = 'Error'
                            item.note = err.data
                        }
                    )
                }

            }
        })
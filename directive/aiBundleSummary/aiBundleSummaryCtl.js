angular.module('sampleApp')
    .directive('aibundlesummary', function () {
        return {
            restrict: 'EA', //E = element, A = attribute, C = class, M = comment
            scope: {
                bundle : '=',
                oo : '=',
                // optional: called when the user clicks a resource in the report
                // usage: on-select-resource="showEntry(entryIndex, resource)"
                onSelectResource : '&'
            },

            templateUrl: 'directive/aiBundleSummary/aiBundleSummary.html',
            controller: function($scope,$http,$interval,umamiSvc){


                $scope.ui = {tab: 0};


                $scope.input = {};
                $scope.loading = false;
                $scope.error = null;
                $scope.response = null;

                //which issues are shown
                $scope.show = {error: true, warning: true, info: true, validator: true, reviewer: true};

                // Incremented on every request and on every bundle change, so a slow
                // response for an old bundle can't overwrite the current view
                let requestId = 0;

                $scope.$watch(
                    function() {return $scope.bundle},
                    function() {
                        //when bundle changes, the old report no longer applies
                        requestId++;
                        $scope.response = null;
                        $scope.error = null;
                        $scope.loading = false;
                        delete $scope.selectedResourceTab0
                        delete $scope.selectedResourceTab1
                        delete $scope.selectedResourceTab2
                    }
                );

                $scope.getAdvice = function () {
                    umamiSvc.track('bvAISummary');
                    let thisRequest = ++requestId;
                    $scope.loading = true;
                    $scope.error = null;
                    $scope.response = null;

                    delete $scope.selectedResourceTab0
                    delete $scope.selectedResourceTab1
                    delete $scope.selectedResourceTab2

                    $scope.count = 0;
                    let timer = $interval(function() {
                        $scope.count++;
                    }, 1000);

                    let request = {bundle:$scope.bundle,oo:$scope.oo}
                    $http.post('ai/bundleSummarizer',request).then(
                        function (data) {
                            if (thisRequest !== requestId) {return}     //superseded
                            $scope.loading = false;
                            $scope.response = data.data
                        },
                        function (err) {
                            if (thisRequest !== requestId) {return}
                            $scope.loading = false;
                            $scope.error = (err.data && err.data.error) || 'The summary could not be generated.';
                            console.error(err)
                        }
                    ).finally(function () {
                        $interval.cancel(timer);
                    })
                }

                //---- report display helpers

                //number of issues of each severity (shown in the badges)
                $scope.issueCounts = function () {
                    let c = {error: 0, warning: 0, info: 0};
                    let issues = ($scope.response && $scope.response.report && $scope.response.report.issues) || [];
                    issues.forEach(function (i) {c[i.severity]++});
                    return c
                };

                //used as an ng-repeat filter: only issues that pass the checkboxes
                $scope.isVisible = function (issue) {
                    return $scope.show[issue.severity] && $scope.show[issue.source]
                };

                //click on a resource link {resource, entryIndex} - used by issues and recommendations
                $scope.selectLink = function (link) {
                    if (link.entryIndex !== null && link.entryIndex !== undefined) {

                        if ($scope.ui.tab == 1) {
                            $scope.selectedResourceTab1 = $scope.bundle.entry[link.entryIndex]
                        } else {
                            $scope.selectedResourceTab2 = $scope.bundle.entry[link.entryIndex]
                        }

                        $scope.onSelectResource({entryIndex: link.entryIndex, resource: link.resource,tab:$scope.ui.tab})
                    }
                };

                //click on a resource in the issues list (issues carry resource + entryIndex too)
                $scope.selectIssue = $scope.selectLink;

                //click on a resource link in the narrative summary
                $scope.selectResource = function (resource) {
                    let report = $scope.response && $scope.response.report;
                    let idx = report && report.resourceIndex && report.resourceIndex[resource];
                    if (idx !== undefined && idx !== null) {

                        $scope.selectedResourceTab0 = $scope.bundle.entry[idx]


                        $scope.onSelectResource({entryIndex: idx, resource: resource,tab:$scope.ui.tab})
                    }
                };
            }
        }
    });
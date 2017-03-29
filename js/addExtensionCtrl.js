/*has been deprectde - don't call make function - expensive! */

angular.module("sampleApp")
    .controller('addExtensionCtrl',
        function ($scope,resource,GetDataFromServer,appConfigSvc,Utilities) {
            $scope.input={}
            resourceType = resource.resourceType;
            //$scope.allDataTypes = allDataTypes;
            var conformanceSvr = appConfigSvc.getCurrentConformanceServer();
            var qry = conformanceSvr.url + "StructureDefinition?";
            qry += 'type=Extension';

            $scope.select = function(){
                var vo = {}
                vo.extValue = {url:$scope.analyse.url,valueString:$scope.input.value}
                vo.isModifier = $scope.input.isModifier;
                $scope.$close(vo)
            }

            $scope.selectExtDef = function(extDef) {
                console.log(extDef);
                $scope.analyse = Utilities.analyseExtensionDefinition3(extDef)
                console.log($scope.analyse)
            }

            //$scope.qry = qry;
            //$scope.conformanceServerUrl = conformanceSvr.url;
            $scope.showWaiting = true;
            GetDataFromServer.adHocFHIRQueryFollowingPaging(qry).then(

                function(data) {
                    //filter out the ones not for this resource type. Not sure if this can be done server side...
                    $scope.extensions = []
                    if (data.data && data.data.entry) {
                        data.data.entry.forEach(function(entry){
                            var include = false;
                            if (entry.resource) {
                                if (! entry.resource.context) {
                                    include = true;
                                } else  {
                                    entry.resource.context.forEach(function(ctx){
                                        if (ctx == '*' || ctx == 'Element' ||  ctx.indexOf(resourceType) > -1) {
                                            include = true;
                                        }
                                    })
                                }
                            }

                            if (include) {
                                $scope.extensions.push(entry.resource)
                            }

                        })
                    }

                    $scope.extensions.sort(function(a,b){

                           if (a.name.toUpperCase() > b.name.toUpperCase()) {
                                return 1
                            } else {
                                return -1;
                            }
                    });

                    //$scope.bundle = data.data;
                    //console.log($scope.extensions);
                }
            ).finally(function(){
                    $scope.showWaiting = false;
            }

            )

        });
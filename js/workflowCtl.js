
angular.module("sampleApp")
    .controller('workflowCtrl',
        function ($scope,$http,appConfigSvc,GetDataFromServer) {

            //load all the current tasks on the data server
            var qry = appConfigSvc.getCurrentDataServer().url+"Task";

            GetDataFromServer.adHocFHIRQueryFollowingPaging(qry).then(
                function(data){
                    console.log(data)
                    $scope.tasks = data.data;

                }
            )

            $scope.selectTask = function(task){
                console.log(task)
                $scope.currentTask = task
            }


    })

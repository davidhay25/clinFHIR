angular.module("sampleApp").controller('pvTaskCtrl',
    function ($scope,$http,appConfigSvc) {

        $http.get('./artifacts/taskStatus.json').then(
            function(data) {
                $scope.taskStatus = data.data;
                console.log($scope.taskStatus)
            }
        );


        $scope.changeStatus = function (status,note) {
            let task = angular.copy($scope.outcome.selectedResource);
            if (status) {
                task.status = status.code;
            }

            if (note) {
                task.output = task.output || []
                let item = {type:{text:'Note'},valueString:note}
                task.output.push(item)

            }

            console.log(task)

            let url = appConfigSvc.getCurrentDataServer().url + "Task/" + task.id
            $http.put(url,task).then(
                function (data) {
                    alert ("Changes saved - you will need to re-load to see them")
                },
                function (err) {
                    alert(angular.toJson(err))
                }
            )

        }

    }
)

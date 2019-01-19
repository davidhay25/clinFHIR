angular.module("sampleApp").controller('taskCtrl',
    function ($scope,$http,appConfigSvc,logicalModelSvc,Utilities) {

        let clinFhirDevice = 'Device/cfDevice';
        let fhirVersion = $scope.conformanceServer.version;     //from parent
        let taskCode =  {system:"http://loinc.org",code:"48767-8"}
        var pathExtUrl = appConfigSvc.config().standardExtensionUrl.path;  //the extension for recording the model path for a comment


        if (!pathExtUrl) {
            alert("Task warning: You must restart clinFHIR then the Logical Modeller to reset updated config")
        }

        $scope.model;
        $scope.$on('modelSelected',function(event,entry){
            console.log(event,entry)

            if (entry && entry.resource) {
                $scope.model = entry.resource;

                loadTasksForModel(entry.resource.id)

            }
        });

        function loadTasksForModel(id) {
            $scope.tasks = []
            let url = $scope.conformanceServer.url + "Task";    //from parent controller
            url += "?code="+taskCode.system +"|"+taskCode.code;
            url += "&_count=100";    //todo - need the follow links

            //url += '?requester='+clinFhirDevice;
            $http.get(url).then(
                function(data) {
                    console.log(data)
                    if (data.data && data.data.entry) {
                        data.data.entry.forEach(function (entry) {
                            let resource = entry.resource;      //the fhir Task
                            let task = {}       //internal task
                            task.resource = resource;       //for degugging...
                            task.description = resource.description;

                            let extSimpleExt = Utilities.getSingleExtensionValue(resource, pathExtUrl);
                            if (extSimpleExt) {
                                task.path = extSimpleExt.valueString;
                            }


                            console.log(task);
                            $scope.tasks.push(task)
                        })
                    }


                },function(err) {
                    console.log(err)
                }
            )
            console.log(url)
        }


        $scope.addTask = function() {
            let comment = window.prompt('Enter comment');       //todo make dialog
            if (comment) {
                let task = {resourceType:'Task'};
                task.id = 'id'+ new Date().getTime() + "-" + Math.floor(Math.random() * Math.floor(1000));
                task.description = comment;
                task.code = {coding:taskCode};

                logicalModelSvc.addSimpleExtension(task, pathExtUrl, $scope.taskNode.id)   //the path in the model


/*
                switch (fhirVersion) {
                    case 3 :
                        task.requester = {agent: {reference:clinFhirDevice,description:'clinFHIR logical modeller'}}
                        break;
                    default :
                        task.requester = {reference:clinFhirDevice,description:'clinFHIR logical modeller'};
                        break;

                }
*/


                let url = $scope.conformanceServer.url + "Task/"+ task.id;    //from parent controller
                $http.put(url,task).then(
                    function(data) {
                        $scope.tasks = $scope.tasks || []
                        $scope.tasks.push({description: task.description,path:$scope.taskNode.id});
                        alert('Comment has been added.')
                    }, function(err) {
                        alert(err)
                    }
                )
            }
        }


        $scope.$watch(function($scope) {return $scope.selectedNode},function(node,olfV){
            $scope.taskNode = node;
         //   $scope.currentTaskPath = node.id
            console.log(node);
        })

    })
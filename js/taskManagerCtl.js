angular.module("sampleApp").controller('taskManagerCtrl',
    function ($scope,$http,appConfigSvc) {

        let clinFhirDevice = 'Device/cfDevice';
        $scope.conformanceServer = appConfigSvc.getCurrentConformanceServer();
        $scope.input = {}

        let fhirVersion = $scope.conformanceServer.version;     //from parent
        let taskCode =  {system:"http://loinc.org",code:"48767-8"};
        var pathExtUrl = appConfigSvc.config().standardExtensionUrl.path;  //the extension for recording the model path for a comment
        var states = ['requested','received','accepted','rejected']

        $scope.model = {id:"StructureDefinition/ADRAllergyIntolerance"};    //load from a selector

        if (!pathExtUrl) {
            alert("Task warning: You must restart clinFHIR then the Logical Modeller to reset updated config")
        }

        //add a new not as an annotation
        $scope.addNote = function(note) {
            $scope.localTask.notes = $scope.localTask.notes || []
            var annot = {text:note,time: new Date().toISOString()};
            $scope.localTask.notes.push(annot);
            delete $scope.input.note;

            //update the task resource
            let fhirTask = $scope.selectedTask.resource;
            fhirTask.note = fhirTask.note || []
            fhirTask.note.push(annot);
            let url = $scope.conformanceServer.url + "Task/"+fhirTask.id
            $http.put(url,fhirTask).then(
                function(data){

                },function (err) {
                    alert(angular.toJson(err))
                }
            )

        };

        $scope.selectTask = function(task) {
            $scope.selectedTask = task;
            $scope.fhirTask = task.resource
            $scope.localTask = angular.copy(task)
            delete $scope.localTask.resource;
        }

        //load all the tasks for a given model
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
                            //task.resource = resource;       //for degugging...
                            task.description = resource.description;
                            task.notes = resource.note

                            if (resource.requester) {
                                switch (fhirVersion) {
                                    case 3 :
                                        if (resource.requester.agent) {
                                            task.requesterReference = resource.requester.agent;      //this is a reference
                                            task.requesterDisplay = resource.requester.agent.display;
                                        }

                                        break;
                                    default :
                                        task.requesterReference = resource.requester
                                        task.requesterDisplay = resource.requester.display;
                                        break;

                                }
                            }


                            let extSimpleExt = getSingleExtensionValue(resource, pathExtUrl);
                            if (extSimpleExt) {
                                task.path = extSimpleExt.valueString;
                            }

                            task.resource = resource;       //for degugging...


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

        loadTasksForModel($scope.model.id);

        $scope.addTask = function() {
            let comment = window.prompt('Enter comment');       //todo make dialog
            if (comment) {
                let task = {resourceType:'Task'};
                task.id = 'id'+ new Date().getTime() + "-" + Math.floor(Math.random() * Math.floor(1000));
                task.description = comment;
                task.code = {coding:taskCode};
                task.focus = {reference:"StructureDefinition/"+$scope.treeData[0].data.header.SDID};    //from the parent

                //treeData[0].data.header.SDUrl


                logicalModelSvc.addSimpleExtension(task, pathExtUrl, $scope.taskNode.id)   //the path in the model


                //todo - what is there's no logged in user?
                if ( $scope.Practitioner) {     //This is the user - from the parent controller
                    let ref = 'Practitioner/'+$scope.Practitioner.id;

                    let display = "";
                    if ($scope.Practitioner.telecom) {
                        display = $scope.Practitioner.telecom[0].value
                    };


                    switch (fhirVersion) {
                        case 3 :
                            task.requester = {agent: {reference:ref,display:display}};
                            break;
                        default :
                            task.requester = {reference:ref,display:display};
                            break;

                    }
                }





                let url = $scope.conformanceServer.url + "Task/"+ task.id;    //from parent controller
                $http.put(url,task).then(
                    function(data) {
                        $scope.tasks = $scope.tasks || []
                        $scope.tasks.push({description: task.description,path:$scope.taskNode.id});
                        alert('Comment has been added.')
                    }, function(err) {
                        alert(angular.toJson(err))
                    }
                )
            }
        };

        function getSingleExtensionValue(resource,url) {
            //return the value of an extension assuming there is only 1...
            var extension;
            if (resource) {
                resource.extension = resource.extension || []
                resource.extension.forEach(function (ext) {
                    if (ext.url == url) {
                        extension = ext
                    }
                });
            }

            return extension;
        }


    })
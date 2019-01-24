angular.module("sampleApp").controller('taskCtrl',
    function ($scope,$http,appConfigSvc,logicalModelSvc,Utilities,$uibModal,taskSvc) {

        let clinFhirDevice = 'Device/cfDevice';
        let fhirVersion = $scope.conformanceServer.version;     //from parent
        let taskCode =  {system:"http://loinc.org",code:"48767-8"}
        var pathExtUrl = appConfigSvc.config().standardExtensionUrl.path;  //the extension for recording the model path for a comment

        let lastModelIdLoaded;  //debounce...

        if (!pathExtUrl) {
            alert("Task warning: You must restart clinFHIR then the Logical Modeller to reset updated config")
        }

        //When a model is selected.
        //note - called once for each instance (ng-controller) in the logical model...
        $scope.$on('modelSelected',function(event,entry){
            //console.log(event,entry)
            if (entry && entry.resource) {
                //console.log(lastModelIdLoaded,entry.resource.id)

                if (entry.resource.id !== lastModelIdLoaded) {
                    lastModelIdLoaded = entry.resource.id;

                    $scope.model = entry.resource;
                    loadTasksForModel(entry.resource.id)

                }

            }
        });


        //when a task is selected for editing in the LM
        $scope.$on('editTask',function(event,task){
            editTask(task)
        })

        //view task and add note
        $scope.editTask = function(task) {
            editTask(task)
        };

        $scope.addNewTask = function(){
            editTask()
        };


        function editTask(task) {
            $uibModal.open({
                templateUrl: 'modalTemplates/editTask.html',
                //windowClass: 'nb-modal-window',
                size: 'lg',
                controller: function ($scope, $http, appConfigSvc, task, practitioner, taskCode, modelId,modelPath) {
                    $scope.task = task;
                    $scope.practitioner = practitioner;     //used in html page...
                    $scope.modelPath = modelPath;
                    console.log(practitioner);
                    $scope.input = {}


                    $scope.addTask = function(comment) {
                        //let comment = window.prompt('Enter comment');       //todo make dialog
                        if (comment) {
                            let task = {resourceType:'Task'};
                            task.id = 'id'+ new Date().getTime() + "-" + Math.floor(Math.random() * Math.floor(1000));

                            task.authoredOn = new Date().toISOString();

                            task.status = 'requested';
                            task.description = comment;
                            task.code = {coding:taskCode};
                            task.focus = {reference:"StructureDefinition/"+ modelId}//$scope.treeData[0].data.header.SDID};    //from the parent

                            logicalModelSvc.addSimpleExtension(task, pathExtUrl, modelPath ) ;  //the path in the model

                            //todo - what is there's no logged in user?
                            if ( practitioner) {     //This is the user - from the parent controller
                                let ref = 'Practitioner/'+practitioner.id;

                                let display = "";
                                if (practitioner.telecom) {
                                    display = practitioner.telecom[0].value
                                }


                                switch (fhirVersion) {
                                    case 3 :
                                        task.requester = {agent: {reference:ref,display:display}};
                                        break;
                                    default :
                                        //R4
                                        task.requester = {reference:ref,display:display};
                                        break;
                                }
                            }

                            let url = appConfigSvc.getCurrentConformanceServer().url + "Task/"+ task.id;    //from parent controller
                            $scope.showWaiting = true;
                            $http.put(url,task).then(
                                function(data) {
                                    alert('Comment has been added.');
                                    $scope.$close(task);
                                }, function(err) {
                                    alert(angular.toJson(err))
                                    $scope.$close();
                                }
                            ).finally(
                                function(){
                                    $scope.showWaiting = false;
                                }
                            )
                        }
                    };
                    //add the note and close the dialog...
                    $scope.addNote = function(note) {

                        //create the note...
                        var annot = {text:note,time: new Date().toISOString()};
                        if (practitioner && practitioner.telecom) {
                            //todo might want to use authorReference at some stage...
                            annot.authorString = practitioner.telecom[0].value;
                        } else {
                            annot.authorString = 'Anonymous';
                        }


                        //This is an 'update' object
                        let obj = {}
                        obj.note = annot;
                        obj.fhirServer = appConfigSvc.getCurrentConformanceServer().url;

                        let fhirTask = task.resource;

                        if (fhirTask) {
                            //this will add the note to teh task from the server...
                            let url =  "/myTask/addNote/"+fhirTask.id
                            $http.post(url,obj).then(
                                function(data){
                                    $scope.$close(annot);
                                },function (err) {
                                    alert('Error saving note: ' + angular.toJson(err))
                                }
                            )

                            /*


                            fhirTask.note = fhirTask.note || [];
                            fhirTask.note.push(annot);
                            let url = appConfigSvc.getCurrentConformanceServer().url + "Task/"+fhirTask.id
                            $http.put(url,fhirTask).then(
                                function(data){
                                    $scope.$close(annot);
                                },function (err) {
                                    alert('Error saving note: ' + angular.toJson(err))
                                }
                            )

                            */
                        } else {
                            alert('FHIR Task resource not found')
                        }
                    }
                },
                resolve : {
                    "task": function() {
                        //console.log(task);
                        return task
                    },
                    "practitioner" : function() {
                        return $scope.Practitioner;     //from the parent scope
                    },
                    "taskCode" : function() {
                        return taskCode;
                    },
                    "modelId" : function(){
                        if (task) {
                            return task.id;
                        } else {
                            return $scope.treeData[0].data.header.SDID //from the parent scope
                        }

                    },
                    "modelPath" : function() {
                        if (task) {
                            return task.path;
                        } else if ($scope.taskNode) {      //taskNode is set by the $watch below...
                            return $scope.taskNode.id;
                        } else {
                            return null;
                        }

                    }
                }
            }).result.then(
                function(rtn) {
                    if (rtn) {
                        //could be a Task or an annotation...
                        if (rtn.resourceType == 'Task') {
                            //want to add the new task to the list of tasks...
                            let iTask = taskSvc.getInternalTaskFromResource(rtn,fhirVersion)
                            $scope.tasks.push(iTask)
                            $scope.$emit('taskListUpdated',$scope.tasks);   //so the list in LM can be updated


                        } else {
                            //annotation
                            task.notes = task.notes || []
                            task.notes.push(rtn)      //for the display - the task was updated in the dialog...
                            $scope.$emit('taskListUpdated',$scope.tasks);
                        }

                    }


                }
            )

        }

        //todo - should move this to a service - used by taskManager as well...
        function loadTasksForModel(id) {
            $scope.tasks = []
            let url = $scope.conformanceServer.url + "Task";    //from parent controller
            url += "?code="+taskCode.system +"|"+taskCode.code;
            url += "&focus=StructureDefinition/"+id;
            url += "&_count=100";    //todo - need the follow links

            $http.get(url).then(
                function(data) {
                    console.log(data)
                    if (data.data && data.data.entry) {
                        data.data.entry.forEach(function (entry) {
                            let resource = entry.resource;      //the fhir Task
                            let iTask = taskSvc.getInternalTaskFromResource(resource,fhirVersion)
                            /*
                            let task = {}       //internal task
                            task.resource = resource;
                            task.description = resource.description;
                            task.notes = resource.note;

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


                            let extSimpleExt = Utilities.getSingleExtensionValue(resource, pathExtUrl);
                            if (extSimpleExt) {
                                task.path = extSimpleExt.valueString;
                            }
*/

                            //console.log(task);
                            $scope.tasks.push(iTask)
                        })
                    }
                    $scope.$emit('taskListUpdated',$scope.tasks);   //so the list in LM can be updated

                },function(err) {
                    console.log(err)
                }
            )
            console.log(url)
        }

/*
        addTaskDEP = function(comment) {
            //let comment = window.prompt('Enter comment');       //todo make dialog
            if (comment) {
                let task = {resourceType:'Task'};
                task.id = 'id'+ new Date().getTime() + "-" + Math.floor(Math.random() * Math.floor(1000));
                task.status = 'requested';
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
*/

        //when a node is selected in the designer...
        $scope.$watch(function($scope) {return $scope.selectedNode},function(node,olfV){
            $scope.taskNode = node;
            console.log(node);
        })

    })
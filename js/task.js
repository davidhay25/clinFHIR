angular.module("sampleApp").controller('taskCtrl',
    function ($scope,$http,appConfigSvc,logicalModelSvc,Utilities,$uibModal,taskSvc,$timeout) {

        //let clinFhirDevice = 'Device/cfDevice';
        let fhirVersion = $scope.conformanceServer.version;     //from parent
        let taskCode =  {system:"http://loinc.org",code:"48767-8"}
        var pathExtUrl = appConfigSvc.config().standardExtensionUrl.path;  //the extension for recording the model path for a comment

        let lastModelIdLoaded;  //debounce...

        if (!pathExtUrl) {
            alert("Task warning: You must restart clinFHIR then the Logical Modeller to reset updated config")
        }

        let wsUrl = 'ws://'+ window.location.host;
        let ws = new WebSocket(wsUrl);

        ws.onmessage = function(event) {
            console.log('socket event:', event.data)

            let obj;
            try {
                obj = angular.fromJson(event.data)
                console.log(obj)
            } catch (ex) {
                console.log('Ignoring non Json message')
                $scope.$digest();
            }


            if (obj) {
                if (obj.modelId) {
                    //this will be a note to a task...
                    if ($scope.model && (obj.modelId === $scope.model.id)) {
                        //this is an update to a task for this model...
                        loadTasksForModel(obj.modelId);

                        $timeout(function(){
                            $scope.$digest()
                            console.log('digest...')
                        },5000)

                    }

                } else if (obj.resourceType == 'Task' && $scope.model) {
                    //this is a new task. Is it for the model that is currently open?
                    let focus = obj.focus.reference;
                    let ar = focus.split('/');
                    //assume that the model id and url are related (as when created in the Logical Modeller)
                    if (ar[ar.length-1] == $scope.model.id) {
                        loadTasksForModel($scope.model.id)
                        $scope.$digest()
                    }

                }
            }


        };




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


        //edit a single task
        function editTask(task) {
            $uibModal.open({
                templateUrl: 'modalTemplates/editTask.html',
                //windowClass: 'nb-modal-window',
                size: 'lg',
                controller: function ($scope, $http, appConfigSvc, task, practitioner, taskCode, modelId,modelPath) {
                    $scope.task = task;     //this is an iTask!!!
                    $scope.practitioner = practitioner;     //used in html page...
                    $scope.modelPath = modelPath;
                    console.log(practitioner);
                    $scope.input = {};

                    //todo - this is a copy from taskManager - move to a common place
                    //allow the display for a state to be different to the actual code...
                    $scope.stateHash = {};
                    $scope.stateHash.requested = 'new';
                    $scope.stateHash.received = 'reviewed';
                    $scope.stateHash.accepted = 'accepted';
                    $scope.stateHash.rejected = 'rejected';
                    $scope.stateHash.cancelled = 'cancelled';
                    $scope.stateHash.completed = 'completed';


                    if (!modelPath) {
                        alert("Can't add comment, 'modelPath' is null")
                        $scope.$close();
                        return;
                    }

                    let userEmail;
                    if (practitioner && practitioner.telecom) {
                        practitioner.telecom.forEach(function(tele){
                            if (tele.system = 'email') {
                                userEmail = tele.value;
                            }
                        })
                    }


                    $scope.showStateChange = function(newState,currentState) {
                        //requested == new, received = reviewed
                        //return true;
                        switch (newState) {
                            case 'received' :
                                if (currentState == 'requested' || currentState == 'accepted' || currentState == 'rejected') {return true}
                                break;
                            case 'accepted' :
                                if (currentState == 'requested' || currentState == 'received') {return true}
                                break;
                            case 'rejected' :
                                if (currentState == 'requested' || currentState == 'received') {return true}
                                break;
                            case 'cancelled' :
                                if (currentState == 'cancelled' || currentState == 'completed') {return false} else {return true}
                                break;
                            case 'completed' :
                                if (currentState == 'accepted') {return true}
                                break;
                        }
                    };



                    $scope.changeState = function(newState) {

                        delete $scope.task.statusReason;

                        let note = window.prompt('Enter mandatory note about change');
                        if (! note) {
                            return;
                        }

                        var annot = {text:note,time: new Date().toISOString()};
                        annot.authorString = userEmail;

                        $scope.task.notes = $scope.task.notes || []
                        $scope.task.notes.push(annot)

                        $scope.task.statusReason = {text:note}
                        $scope.task.status = newState;

                        //{note:, fhirServer:, status:}
                        let obj = {}
                        obj.note = annot;
                        obj.fhirServer = appConfigSvc.getCurrentConformanceServer().url;
                        obj.status = newState;

                        if ($scope.user) {      //should always be present for a state change
                            obj.who = {
                                url:  "Practitioner/"+practitioner.id,
                                valueReference : {display: userEmail}
                            }
                        }
                        obj.email = userEmail;

                        let url = "/myTask/changeStatus/" +  $scope.task.id
                        $http.post(url, obj).then(
                            function (data) {
                                //for the local display
                              //  $scope.task.note = $scope.task.note || []
                               // $scope.task.note.push(annot);
                                alert('Status has been changed')
                            }, function (err) {
                                alert('Error saving note: ' + angular.toJson(err))
                            }
                        )
                    };





                    //add a new task
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

                            let url =  "/myTask/addTask/"+task.id
                            let obj = {}
                            obj.task = task;
                            obj.fhirServer = appConfigSvc.getCurrentConformanceServer().url;


                            $http.post(url,obj).then(
                                function(data){
                                    alert('Comment has been added.');
                                    $scope.$close(task);
                                },function (err) {
                                    alert('Error saving note: ' + angular.toJson(err))
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
                        let annot = {text:note,time: new Date().toISOString()};
                        if (practitioner && practitioner.telecom) {
                            //todo might want to use authorReference at some stage...
                            annot.authorString = practitioner.telecom[0].value;
                        } else {
                            annot.authorString = 'Anonymous';
                        }


                        //This is an 'update' object
                        let obj = {};
                        let fhirTask = task.resource;
                        //obj.taskId = fhirTask.id;
                        obj.modelId =  modelId;    //used in the webhooks handler to decide whether to refresh tasks- not saved...
                        obj.note = annot;
                        obj.fhirServer = appConfigSvc.getCurrentConformanceServer().url;



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
                        return $scope.treeData[0].data.header.SDID //from the parent scope

                    },
                    "modelPath" : function() {
                        if (task) {
                            return task.path;
                        } else if ($scope.taskNode) {      //taskNode is set by the $watch below...
console.log($scope.taskNode.data.idFromSD)
                            return $scope.taskNode.data.idFromSD

                            //return $scope.taskNode.id;
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
                            let iTask = taskSvc.getInternalTaskFromResource(rtn,fhirVersion);
                            let found = false;
                            $timeout(function() {
                                //check that the tasks were re-loaded via the websocket connection. We know it was actually added - as the routine checks...
                                for (let tsk of $scope.tasks) {
                                    if (tsk.id == iTask.id) {
                                        console.log(tsk.id, iTask.id)
                                        //yep - it's there
                                        found = true;
                                        break;
                                    }
                                }
                                if (!found) {
                                    console.log(iTask.id + " not found, adding manually")
                                    $scope.tasks.push(iTask);
                                    $scope.$emit('taskListUpdated',$scope.tasks);   //so the list in LM can be updated

                                }

                            },10000)


                            //want to add the new task to the list of tasks...
                           // let iTask = taskSvc.getInternalTaskFromResource(rtn,fhirVersion)
                          //  $scope.tasks.push(iTask)
                         //   $scope.$emit('taskListUpdated',$scope.tasks);   //so the list in LM can be updated


                        } else {
                            //annotation
                          //  task.notes = task.notes || []
                           // task.notes.push(rtn)      //for the display - the task was updated in the dialog...
                           // $scope.$emit('taskListUpdated',$scope.tasks);
                        }

                    }


                }
            )

        }

        //todo - should move this to a service - used by taskManager as well...
        function loadTasksForModel(id) {

/*
            let missing = {}

            */

            let hash = {};  //hash of current path to original path
            if ($scope.treeData) {
                $scope.treeData.forEach(function(item){
                    //console.log(item)
                    let originalPath = item.data.idFromSD;
                    let currentPath = item.id;
                    hash[originalPath] = currentPath;
                })
            }

           // console.log($scope.treeData )
           // console.log(hash )

            console.log('loading tasks for model...')
            $scope.tasks = []
            let url = $scope.conformanceServer.url + "Task";    //from parent controller
            url += "?code="+taskCode.system +"|"+taskCode.code;
            url += "&focus=StructureDefinition/"+id;
            url += '&status:not=cancelled';
            url += "&_count=100";    //todo - need the follow links

            $http.get(url).then(
                function(data) {

                    if (data.data && data.data.entry) {
                        data.data.entry.forEach(function (entry) {
                            let resource = entry.resource;      //the fhir Task

                            let pathExt = Utilities.getSingleExtensionValue(resource,pathExtUrl)
                            if (pathExt) {
                                let path = pathExt.valueString;
                                let iTask = taskSvc.getInternalTaskFromResource(resource,fhirVersion);
                                iTask.currentPath = hash[iTask.path]
                                //console.log(iTask);
                                $scope.tasks.push(iTask)
                                /*
                                if (hash[path]) {
                                    let iTask = taskSvc.getInternalTaskFromResource(resource,fhirVersion)
                                    $scope.tasks.push(iTask)
                                } else {
                                    missing[path] = resource.description;
                                    //console.log('Path:'+ path + " not found in model in task #" + resource.id)
                                }
                                */

                            } else {
                               // console.log('Task #'+ resource.id + ' has no extension for the path')
                            }

                        })
                        console.log($scope.tasks)
                       // console.log($scope.tasks)
                       // console.log(angular.toJson(missing));
                    }
                    $scope.$emit('taskListUpdated',$scope.tasks);   //so the list in LM can be updated

                },function(err) {
                    console.log(err)
                }
            );
            //console.log(url)
        }

        //when a node is selected in the designer...
        $scope.$watch(function($scope) {return $scope.selectedNode},function(node,olfV){
            $scope.taskNode = node;
            console.log(node);
        })

    });
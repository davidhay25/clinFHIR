angular.module("sampleApp").controller('taskManagerCtrl',
    function ($scope,$http,appConfigSvc,$firebaseObject,$firebaseArray,$uibModal,modalService,taskSvc) {

        $scope.firebase = firebase;
        $scope.appConfigSvc = appConfigSvc;
        //let clinFhirDevice = 'Device/cfDevice';
        $scope.conformanceServer = appConfigSvc.getCurrentConformanceServer();
        $scope.input = {}

        let fhirVersion = $scope.conformanceServer.version;
        let taskCode =  {system:"http://loinc.org",code:"48767-8"};


        let wsUrl = 'ws://'+ window.location.host;
        let ws = new WebSocket(wsUrl);

        ws.onmessage = function(event) {
            console.log('socket event:', event.data)

            let obj;
            try {
                obj = angular.fromJson(event.data)
            } catch (ex) {
                console.log('Ignoring non Json message')
                $scope.$digest();
            }

            console.log(obj)
            if (obj) {
                if (obj.modelId) {
                    //this will be a note to a task...
                    if ($scope.currentModelId && (obj.modelId === $scope.currentModelId)) {
                        //this is an update to a task for this model...
                        loadTasksForModel($scope.currentModelId)
                        /*
                        $timeout(function(){
                            $scope.$digest()
                            console.log('digest...')
                        },5000)
*/
                    }

                } else if (obj.resourceType == 'Task' && $scope.currentModelId) {
                    //this is a new task. Is it for the model that is currently open?
                    let focus = obj.focus.reference;
                    let ar = focus.split('/');
                    //assume that the model id and url are related (as when created in the Logical Modeller)
                    if (ar[ar.length-1] == $scope.currentModelId) {
                        loadTasksForModel($scope.currentModelId)
                        $scope.$digest()
                    }

                }
            }


        };


        $scope.instanceAuthor = appConfigSvc.config().standardExtensionUrl.instanceAuthor;  //the extension for recording the model path for a comment
        if (!$scope.instanceAuthor) {
            alert("Task warning: You must restart clinFHIR then the Task Manager to reset updated config. Note that this will reset the configured servers.")
        }

        $scope.displayServers = function(){
            let servers = "";
            servers += '<div>Data: ' + appConfigSvc.getCurrentDataServer().name + "</div>"
            servers += '<div>Conf: ' + appConfigSvc.getCurrentConformanceServer().name + "</div>"
            servers += '<div>Term: ' + appConfigSvc.getCurrentTerminologyServer().name + "</div>"
            return servers;
        };



        let hashED = {};    //will have a hash of element definitions by path
        //-----------  login stuff....

        $scope.login=function(){
            $uibModal.open({
                backdrop: 'static',      //means can't close by clicking on the backdrop.
                keyboard: false,       //same as above.
                templateUrl: 'modalTemplates/login.html',
                controller: 'loginCtrl'
            })
        };

        $scope.logout=function(){
            firebase.auth().signOut().then(function() {
                delete $scope.user;
                //delete $rootScope.userProfile;
                modalService.showModal({}, {bodyText: 'You have been logged out of clinFHIR'})

            }, function(error) {
                modalService.showModal({}, {bodyText: 'Sorry, there was an error logging out - please try again'})
            });

        };
        //called whenever the auth state changes - eg login/out, initial load, create user etc.
        firebase.auth().onAuthStateChanged(function(user) {
            //if there's a hash starting with $$$ then this has been started from the project, with an authenticted user...
            console.log('onauth',user)
            delete $scope.user;

            if (user) {
                $scope.user = user;
                //$scope.userProfile = $firebaseObject(firebase.database().ref().child("users").child(user.uid));
                console.log($scope.user)

            }

        });


        //Load the IG to get the list of models from. todo - Actually could extend to include profiles...
        let url =  $scope.conformanceServer.url + 'ImplementationGuide/cf-artifacts-au3';
        $http.get(url).then(
            function(data) {
                if (data.data && data.data) {
                    $scope.allModels = []
                    let IG = data.data;
                    IG.package.forEach(function (package) {
                        package.resource.forEach(function (res) {
                            if (res.acronym == 'logical') {
                                if (res.sourceReference && res.sourceReference.reference) {
                                    let ar = res.sourceReference.reference.split('/')

                                    $scope.allModels.push({id:ar[ar.length-1]})
                                }
                            }


                        })
                    })

                }
                if ($scope.allModels.length > 0) {
                    $scope.input.selectedModel = $scope.allModels[0]
                    $scope.selectModel($scope.input.selectedModel)
                }


                console.log($scope.allModels);
            }, function(err) {
                console.log(err)
            }
        );

        $scope.selectModel = function(entry) {
            console.log(entry)
            delete $scope.statusHistory;
            loadTasksForModel(entry.id)

        };

        $scope.refresh = function() {
            loadTasksForModel($scope.currentModelId)

        }


        //allow the display for a state to be different to the actual code...
        $scope.stateHash = {};
        $scope.stateHash.requested = 'new';
        $scope.stateHash.received = 'reviewed';
        $scope.stateHash.accepted = 'accepted';
        $scope.stateHash.rejected = 'rejected';
        $scope.stateHash.cancelled = 'cancelled';
        $scope.stateHash.completed = 'completed';

        $scope.states = [{display:'-- All statuses --',code:''}]
        angular.forEach($scope.stateHash,function(v,k){
            $scope.states.push({display:v,code:k});
        });

        $scope.input.filterStatus = $scope.states[0];
       // $scope.model = {id:"StructureDefinition/ADRAllergyIntolerance"};    //load from a selector


        //for the task list filter...
        $scope.canShowTask = function(task,filterStatus, filterEmail) {
            let canShow = false

            //check the status
            if (filterStatus.code === "") {
                canShow = true
            } else if (task.status == filterStatus.code) {
                canShow = true
            }

            if (canShow) {
                //so it passed the status check = what about the author check
                if (filterEmail !== "Anyone") {
                    if (task.requesterDisplay == filterEmail) {
                        canShow = true
                    } else {
                        canShow = false
                    }
                }
                return canShow;

            } else {
                return false;
            }


        };

        //add a new note as an annotation
        $scope.addNote = function(note) {

            $scope.localTask.notes = $scope.localTask.notes || [];

            var annot = {text:note,time: new Date().toISOString()};
            annot.authorString = $scope.user.email;
            $scope.localTask.notes.push(annot);
            delete $scope.input.note;


            //This is an 'update' object
            let obj = {}
            obj.note = annot;
            obj.fhirServer = appConfigSvc.getCurrentConformanceServer().url;
            obj.modelId =  $scope.currentModelId;
            let fhirTask =  $scope.selectedTask.resource;

            if (fhirTask) {
                //this will add the note to teh task from the server...
                let url = "/myTask/addNote/" + fhirTask.id
                $http.post(url, obj).then(
                    function (data) {
                        //for the local display
                        fhirTask.note = fhirTask.note || []
                        fhirTask.note.push(annot);
                    }, function (err) {
                        alert('Error saving note: ' + angular.toJson(err))
                    }
                )
            }
        };

        $scope.selectTask = function(task) {
            $scope.selectedTask = task;
            $scope.fhirTask = task.resource
            $scope.localTask = angular.copy(task)
            delete $scope.localTask.resource;
            delete $scope.statusHistory;


            $scope.selectedEd = hashED[task.path];
           // console.log( $scope.selectedEd)
        };

        $scope.showStateChange = function(newState,currentState) {
            //requested == new, received = reviewed
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

            delete $scope.fhirTask.statusReason;

            let note = window.prompt('Enter mandatory note about change');
            if (! note) {
                return;
            }


            var annot = {text:note,time: new Date().toISOString()};
            annot.authorString = $scope.user.email;
            $scope.fhirTask.note = $scope.fhirTask.note || []
            $scope.fhirTask.note.push(annot)

            $scope.fhirTask.statusReason = {text:note}
            //for display
            $scope.localTask.notes = $scope.localTask.notes || []
            $scope.localTask.notes.push(annot)


            $scope.selectedTask.status = newState;
            $scope.localTask.status = newState;
            $scope.fhirTask.status = newState;

            //{note:, fhirServer:, status:}
            let obj = {}
            obj.note = annot;
            obj.fhirServer = appConfigSvc.getCurrentConformanceServer().url;
            obj.status = newState;
            if ($scope.user) {      //should always be present for a state change
                obj.who = {
                    url:  $scope.instanceAuthor,
                    valueReference : {display: $scope.user.email}
                }
            }


            if ($scope.user) {
                obj.email = $scope.user.email;
            }

            let url = "/myTask/changeStatus/" +  $scope.fhirTask.id
            $http.post(url, obj).then(
                function (data) {
                    //for the local display
                    $scope.fhirTask.note = $scope.fhirTask.note || []
                    $scope.fhirTask.note.push(annot);
                }, function (err) {
                    alert('Error saving note: ' + angular.toJson(err))
                }
            )
        };

        $scope.refreshHistory = function(){
            //create a status history for the current task
            let fhirTask =  $scope.selectedTask.resource;

            if (fhirTask) {
                //this will add the note to teh task from the server...
                let url = $scope.conformanceServer.url + "Task/"+$scope.localTask.id + '/_history';    //from parent controller
                $http.get(url).then(
                    function (data) {
                        let hxBundle = data.data;
                        $scope.statusHistory = [];
                        let lastStatus="xx"
                        if (hxBundle && hxBundle.entry) {
                            hxBundle.entry.forEach(function (entry) {
                                let task = entry.resource;
                                if (task.status !== lastStatus) {
                                    //only add the state changes...
                                    //$scope.statusHistory.push(task)
                                    //the last note in the notes is the reason for the change - and hence teh user

                                    let iTask = taskSvc.getInternalTaskFromResource(task)

                                    $scope.statusHistory.splice(0,0,iTask)      //time order


                                    lastStatus = task.status;
                                }

                            })
                        }
                        console.log($scope.statusHistory)
                    }, function (err) {
                        alert('Error saving note: ' + angular.toJson(err))
                    }
                )
            }
        };

        $scope.canShowReportLine = function(task,filterEmail) {
            if (filterEmail == "Anyone") {
                return true
            } else if (task.requesterDisplay == filterEmail) {
                return true
            }
        };

        //load all the tasks for a given model
        function loadTasksForModel(id) {
            $scope.currentModelId = id;
            delete $scope.editorEmail;
            let hashEmail = {};      //all the emails of users with comments
            hashED = {};       //hash of element definitions by path - used to display details
            $scope.tasks = []
            let url = $scope.conformanceServer.url + "Task";    //from parent controller
            url += "?code="+taskCode.system +"|"+taskCode.code;
            url += "&focus=StructureDefinition/"+ id
            url += "&_count=100";    //todo - need the follow links

            $http.get(url).then(
                function(data) {
                    console.log(data)
                    if (data.data && data.data.entry) {
                        data.data.entry.forEach(function (entry) {
                            let resource = entry.resource;      //the fhir Task

                            let iTask = taskSvc.getInternalTaskFromResource(resource,fhirVersion)
                            hashEmail[iTask.requesterDisplay] = iTask.requesterDisplay


                            $scope.tasks.push(iTask)
                        })

                        $scope.allEmail = ['Anyone'];
                        for (var n in hashEmail) {
                            $scope.allEmail.push(n)
                        }

                        $scope.input.filterEmail = $scope.allEmail[0]
                    }


                },function(err) {
                    console.log(err)
                }
            );


            //load the model also. Assume it is on the same server as tasks (both on conformance)
            let urlModel = $scope.conformanceServer.url + "StructureDefinition/"+id;
            $http.get(urlModel).then(
                function(data) {
                    let model = data.data;


                    //let editorExtUrl = appConfigSvc.config().standardExtensionUrl.editor;
                    $scope.editorEmail = taskSvc.getModelEditor(model);

                    if (model.snapshot && model.snapshot.element) {
                        model.snapshot.element.forEach(function (ed) {
                            hashED[ed.path] = ed;
                        })
                    }
                },
                function(err) {
                    alert(angular.toJson(err))
                }
            )



        }




    });
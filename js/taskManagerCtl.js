angular.module("sampleApp").controller('taskManagerCtrl',
    function ($scope,$http,appConfigSvc,$firebaseObject,$firebaseArray,$uibModal,modalService,taskSvc) {

        $scope.firebase = firebase;
        $scope.appConfigSvc = appConfigSvc;
        //let clinFhirDevice = 'Device/cfDevice';
        $scope.conformanceServer = appConfigSvc.getCurrentConformanceServer();
        $scope.input = {}

        let fhirVersion = $scope.conformanceServer.version;     //from parent
        let taskCode =  {system:"http://loinc.org",code:"48767-8"};
        let pathExtUrl = appConfigSvc.config().standardExtensionUrl.path;  //the extension for recording the model path for a comment

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

        $scope.states = [{display:'-- All statuses --',code:''}]
        angular.forEach($scope.stateHash,function(v,k){
            $scope.states.push({display:v,code:k});
        });

        $scope.input.filterStatus = $scope.states[0];
       // $scope.model = {id:"StructureDefinition/ADRAllergyIntolerance"};    //load from a selector

        if (!pathExtUrl) {
            alert("Task warning: You must restart clinFHIR then the Task Manager to reset updated config")
        }

        //for the task list filter...
        $scope.canShowTask = function(task,filter) {
            if (filter.code === "") {
                return true
            } else if (task.status == filter.code) {
                return true;
            }
            return false;
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


            $scope.selectedEd = hashED[task.path];
           // console.log( $scope.selectedEd)
        };

        $scope.showStateChange = function(newState,currentState) {
            //requested == new, received = reviewed
            switch (newState) {
                case 'received' :
                    if (currentState == 'requested' || currentState == 'accepted' || currentState == 'declined') {return true}
                    break;
                case 'accepted' :
                    if (currentState == 'requested' || currentState == 'received') {return true}
                    break;
                case 'declined' :
                    if (currentState == 'requested' || currentState == 'received') {return true}
                    break;
                case 'cancelled' :
                    if (currentState == 'cancelled') {return false} else {return true}
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
            let url = "/myTask/changeStatus/" +  $scope.fhirTask.id
            $http.post(url, obj).then(
                function (data) {
                    //for the local display
                    fhirTask.note = fhirTask.note || []
                    fhirTask.note.push(annot);
                }, function (err) {
                    alert('Error saving note: ' + angular.toJson(err))
                }
            )
/*
            let url = $scope.conformanceServer.url + "Task/"+$scope.fhirTask.id;    //from parent controller
            $http.put(url,$scope.fhirTask).then(
                function() {

                }, function (err) {
                    alert(angular.toJson(err))
                }
            )
            */
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
                                    $scope.statusHistory.splice(0,0,task)      //time order
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


        //load all the tasks for a given model
        function loadTasksForModel(id) {
            $scope.currentModelId = id;
            hashED = {};       //hash of element definitions by path
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



                            $scope.tasks.push(iTask)
                        })
                    }


                },function(err) {
                    console.log(err)
                }
            );
            //console.log(url)

            //load the model also. Assume it is on the same server as tasks (both on conformance)
            let urlModel = $scope.conformanceServer.url + "StructureDefinition/"+id;
            $http.get(urlModel).then(
                function(data) {
                    let model = data.data;


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




    })
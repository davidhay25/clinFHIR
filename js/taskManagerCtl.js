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

        /*
        //load all tasks of type 'model comment'
        let url =  $scope.conformanceServer.url + "Task?code="+taskCode.system +"|"+taskCode.code;
        $http.get(url).then(
            function(data) {
                if (data.data && data.data.entry) {
                //    $scope.allTasks =
                    data.data.entry.forEach(function (entry) {

                    })
                }
                console.log(data);
            }, function(err) {
                console.log(err)
            }
        );
        */
        //allow the display for a state to be different to the actual code...
        $scope.stateHash = {};
        $scope.stateHash.requested = 'new';
        $scope.stateHash.received = 'reviewed';
        $scope.stateHash.accepted = 'accepted';
        $scope.stateHash.rejected = 'rejected';

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


            $scope.selectedEd = hashED[task.path];
           // console.log( $scope.selectedEd)
        };

        
        $scope.showStateChange = function(newState,currentState) {
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
            }
        };

        $scope.changeState = function(newState) {

            let note = window.prompt('Enter note about change (Cancel for none)');
            if (note) {
                var annot = {text:note,time: new Date().toISOString()};
                annot.authorString = $scope.user.email;
                $scope.fhirTask.note = $scope.fhirTask.note || []
                $scope.fhirTask.note.push(annot)

                //for display
                $scope.localTask.notes = $scope.localTask.notes || []
                $scope.localTask.notes.push(annot)

            }
            $scope.selectedTask.status = newState;
            $scope.localTask.status = newState;
            $scope.fhirTask.status = newState;


            let url = $scope.conformanceServer.url + "Task/"+$scope.fhirTask.id;    //from parent controller
            $http.put(url,$scope.fhirTask).then(
                function() {

                }, function (err) {
                    alert(angular.toJson(err))
                }
            )
        };




        //load all the tasks for a given model
        function loadTasksForModel(id) {
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

        //loadTasksForModel($scope.model.id);
/*
        $scope.addTaskDEP = function() {
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

        function getSingleExtensionValueDEP(resource,url) {
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

        */


    })
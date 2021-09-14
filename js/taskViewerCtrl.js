angular.module("sampleApp")
    .controller('taskViewerCtrl',
        function ($scope,$http,v2ToFhirSvc,$timeout,$localStorage) {

            $scope.input = {}

            $scope.moment = moment;

            $scope.state = 'view';
            //possible states: view, newtask, viewlog

            $scope.thisUserId = $localStorage.pcUserId || "Organization/cmdhb"
/*
            function getAllTasks() {
                let url = "/ctAllTasks"
                $scope.showWaiting = true;
                $http.get(url).then(
                    function(data) {
                        console.log(data.data)
                        $scope.bundleTasks = {resourceType:'Bundle',entry:[]}
                        $scope.completedTasks = {resourceType:'Bundle',entry:[]}
                        data.data.entry.forEach(function (entry) {
                            if (entry.resource.status == 'completed') {
                                $scope.completedTasks.entry.push(entry)
                            } else {
                                $scope.bundleTasks.entry.push(entry)
                            }
                        })
                    }
                ).finally(
                    function () {
                        $scope.showWaiting = false;
                    }
                )
            }

            getAllTasks();
        */
            function getActiveTasks() {
                let url = "/ctOpenTasks"
                $http.get(url).then(
                    function(data) {
                        console.log(data.data)
                        $scope.bundleTasks = data.data
                    }
                )

            }
            getActiveTasks()

            function getCompletedTasks() {
                let url = "/ctCompletedTasks"
                $http.get(url).then(
                    function(data) {
                        console.log(data.data)
                        $scope.completedTasks = data.data
                    }
                )

            }
            getCompletedTasks()

            $scope.getTaskHistory = function(task) {
                delete $scope.selectedTaskVersionCommunication;
                let qry = "/fhir/Task/" + task.id + "/_history"
                $scope.showWaiting = true;
                $http.get(qry).then(
                    function(data) {
                        $scope.taskHistory = data.data;

                    }, function(err) {
                        alert(angular.toJson(err.data))
                    }
                ).finally(function(){
                    $scope.showWaiting = false
                })
            }

            $scope.selectTaskVersion = function(entry) {
                delete $scope.selectedTaskVersionCommunication;
                $scope.selectedTaskVersion = entry.resource;    //the Task resource


                //now go look for the Communication that it is the focus of
                //Note that the input isn't right as it is the original Comm
                if ($scope.selectedTaskVersion.focus) {
                    let commId = $scope.selectedTaskVersion.focus.reference
                    let ar = commId.split('/')
                    $scope.allResourcesForRequest.forEach(function (resource) {
                        if (resource.id == ar[1]) {
                            $scope.selectedTaskVersionCommunication = resource;
                        }
                    })
                }

                //selectedTaskVersionCommunication

            }

            $scope.newTask = function () {
                $scope.state = "newtask"
            }

            //create the new task abd a communication
            $scope.addTask = function () {
                //create a Communication and POST it to this endpoint (will create the Task as well)
                //'from' the patient

                let bundle = {resourceType:'Bundle','type':'collection',entry:[]}

                //add patient resurce
                let patient = {resourceType:'Patient'}
                patient.id = uuidv4();
                patient.name = [{family:$scope.input.patientLName,given:[$scope.input.patientFName]}]
                if ($scope.input.patientIdentifier) {
                    patient.identifier = [$scope.input.patientIdentifier]
                }

                bundle.entry.push({resource:patient})




                let description = $scope.input.description;

                let communication = {resourceType:'Communication'}
                communication.status = "completed"
                communication.category = {coding:[{system:"http://hl7.org/fhir/uv/patient-corrections/CodeSystem/PatientCorrectionTaskTypes",code:"medRecCxReq"}]}
                communication.recipient = {reference:$scope.thisUserId}
                communication.subject = {reference:"Patient/"+patient.id }
                communication.sender = {reference:"Patient/"+patient.id }
                communication.reasonCode = {coding:[{system:"http://hl7.org/fhir/uv/patient-corrections/CodeSystem/PatientCorrectionTaskTypes",code:"medRecCxReq"}]}
                communication.payload = [{contentString:description}]
                bundle.entry.push({resource:communication})



                //$scope.generatedCommunication = communication;

                $http.post('/fhir/Communication/$process-medRecCxReq',bundle).then(
                    function() {
                        getAllTasks();
                        alert("saved!")

                    }, function(err) {
                        alert(angular.toJson( err.data))
                    }
                )

                function uuidv4() {
                    //https://intellipaat.com/community/22734/create-guid-uuid-in-javascript
                    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                        return v.toString(16);

                    });

                }

            }

            //A resource has been selected in the correction set
            $scope.selectResource = function (resource) {
                $scope.selectedResource = resource;
            }

            //A task has been selected in the list to the left. Get all the communications that
            $scope.selectPrimaryTask = function(task) {
                $scope.state = 'view';

                $scope.primaryTask = task
                $scope.allResourcesForRequest = []

                delete $scope.primaryCommunication;
                delete $scope.selectedResource;
                delete $scope.selectedTaskVersion;
                delete $scope.selectedTaskVersionCommunication;
                delete $scope.taskHistory


                //get the Primary communication (has an 'input' link)
                //todo - assume only a single input for now. May need to iterate through the array looking for Commmu
                let communicationId;
                if (task.input && task.input.length > 0) {
                    task.input.forEach(function (inp) {
                        if (inp.valueReference && inp.valueReference.reference) {
                            if (inp.valueReference.reference.indexOf("Comm") > -1) {
                                communicationId = inp.valueReference.reference;     //eg Communication/{id}
                            }
                        }
                    })
                }

                if (communicationId) {
                    //we have the id of the primary communicatoion, so retrieve it
                    $scope.showWaiting = true;

                    let url = "/fhir/" + communicationId        //note communicationId includes the type...
                    $http.get(url).then(
                        function (data) {
                            $scope.primaryCommunication = data.data
                            //Don't add here - it gets added in the 'about' call
                            //$scope.allResourcesForRequest.push(data.data)

                            //now get the other Communication resources with an 'about' reference to the primary one
                            //nested so know when to draw the graph - todo more performant options are possible

                            let ar = communicationId.split('/');        //split the id from the resource type
                            url = "/fhir/Communication?about=" + ar[1];

                            $http.get(url).then(
                                function (data) {
                                    $scope.showWaiting = false;
                                    console.log(data.data)
                                    if (data.data.entry) {      //A Bundle is returned
                                        //add each resource to the
                                        data.data.entry.forEach(function (entry) {
                                            $scope.allResourcesForRequest.push(entry.resource)
                                        })
                                    }

                                    //make pseudo=bundle for graph
                                    let bundle = {entry:[]}
                                    $scope.allResourcesForRequest.forEach(function (resource) {
                                        bundle.entry.push({resource:resource})
                                    })

                                    let options = {bundle:bundle,hashErrors:{},serverRoot:""}

                                    drawGraph(options)

                                }, function(err) {

                                })

                        },
                        function(err) {
                            alert(angular.toJson(err))
                        }
                    )
                }
                $scope.allResourcesForRequest.push(task)    //have the task second...

            }


            //add a communication that has a link to the primary one...
            $scope.requestInfo = function() {
                let comment = prompt("What do you want to say?")
                if (comment) {
                    //construct a Communication with an 'about' link to the primary one...
                    //the server will add the 'sent' element - so tz consistent across users...
                    let bundle = {resourceType:'Bundle','type':'collection',entry:[]}

                    let communication = {resourceType:'Communication'}
                    communication.status = "completed"
                    communication.category = {coding:[{system:"http://hl7.org/fhir/uv/patient-corrections/CodeSystem/PatientCorrectionTaskTypes",code:"medRecCxReq"}]}
                    communication.about = {reference:"Communication/"+$scope.primaryCommunication.id }
                    communication.subject = $scope.primaryCommunication.subject
                    communication.recipient = [$scope.primaryCommunication.subject]
                    communication.sender = {reference:$scope.thisUserId }  //the UI user
                    communication.reasonCode = {coding:[{system:"http://hl7.org/fhir/uv/patient-corrections/CodeSystem/PatientCorrectionTaskTypes",code:"medRecCxReq"}]}
                    communication.payload = {contentString:comment}
                    bundle.entry.push({resource:communication})

                    $http.post('/fhir/Communication/$process-medRecCxReq',bundle).then(
                        function(data) {
                            //let updatedCommunication = data.data   //the communication is returned
                            $scope.selectPrimaryTask($scope.primaryTask);
                            alert("The Communication has been saved, and the Task updated.")

                        }, function(err) {
                            alert(angular.toJson("Error creating Communication " + angular.toJson(err.data)))
                        }
                    )
                }
            }

            //enter a response from a patient to a request for more info
            $scope.respondToRequestInfo = function(communicationToRespondTo) {
                let comment = prompt("How did the patient respond?")
                if (comment) {
                    //construct a Communication with an 'about' link to the primary one...
                    //the server will add the 'sent' element - so tz consistent across users...
                    let bundle = {resourceType:'Bundle','type':'collection',entry:[]}
                    let communication = {resourceType:'Communication'}
                    communication.status = "completed"
                    communication.inResponseTo = [{reference:"Communication/"+communicationToRespondTo.id}]
                    communication.category = {coding:[{system:"http://hl7.org/fhir/uv/patient-corrections/CodeSystem/PatientCorrectionTaskTypes",code:"medRecCxReq"}]}
                    communication.about = {reference:"Communication/"+$scope.primaryCommunication.id }
                    communication.subject = $scope.primaryCommunication.subject
                    communication.recipient = [{reference:$scope.thisUserId }]
                    communication.sender = $scope.primaryCommunication.subject  //the UI user
                    communication.reasonCode = {coding:[{system:"http://hl7.org/fhir/uv/patient-corrections/CodeSystem/PatientCorrectionTaskTypes",code:"medRecCxReq"}]}
                    communication.payload = {contentString:comment}

                    bundle.entry.push({resource:communication})

                    $http.post('/fhir/Communication/$process-medRecCxReq',bundle).then(
                        function(data) {
                            $scope.selectPrimaryTask($scope.primaryTask);
                            alert("The Communication has been saved, and the Task updated.")
                            //todo - move this Task update to the API



                        }, function(err) {
                            alert(angular.toJson( err.data))
                        }
                    )

                }
            }


            //close the task
            $scope.closeRequest = function() {
                let comment = prompt("What is the closing message?")
                if (comment) {
                    //construct a Communication with an 'about' link to the primary one...
                    //the server will add the 'sent' element - so tz consistent across users...

                    let communication = {resourceType:'Communication'}
                    communication.status = "completed"
                    communication.category = {coding:[{system:"http://hl7.org/fhir/uv/patient-corrections/CodeSystem/PatientCorrectionTaskTypes",code:"medRecCxReq"}]}
                    communication.about = {reference:"Communication/"+$scope.primaryCommunication.id }
                    communication.subject = $scope.primaryCommunication.subject
                    communication.recipient = $scope.primaryCommunication.subject
                    communication.sender = {reference : $scope.thisUserId} //the UI user
                    communication.reasonCode = {coding:[{system:"http://hl7.org/fhir/uv/patient-corrections/CodeSystem/PatientCorrectionTaskTypes",code:"medRecCxReq"}]}
                    communication.payload = {contentString:comment}

                    $http.post('/fhir/Communication',communication).then(
                        function(data) {
                            let updatedCommunication = data.data   //the communication is returned
                            let clone = angular.copy($scope.primaryTask)
                            delete clone.owner;     //no one owns the task any more
                            //clone.owner = {reference:$scope.thisUserId};        //change the owner to this user
                            clone.status = "completed"
                            // the communication
                            clone.focus = {reference : "Communication/"+ updatedCommunication.id}
                            updateTask(clone,function(){
                                $scope.selectPrimaryTask($scope.primaryTask);
                                getAllTasks();
                                alert("The Communication has been saved, and the Task status set to 'completed'.")
                            })

                        }, function(err) {
                            alert(angular.toJson( err.data))
                        }
                    )
                }
            }

            function updateTask(clone,cb){
                $http.put('/fhir/Task/'+ clone.id,clone).then(
                    function (data){
                        console.log(data)
                        $scope.primaryTask = data.data;     //The updated Task is returned by the server
                        for (let i=0; i < $scope.bundleTasks.entry.length; i++) {
                            if ($scope.bundleTasks.entry[i].resource.id == clone.id) {
                                $scope.bundleTasks.entry[i].resource = data.data;
                                break;
                            }
                        }
                        cb()
                       // $scope.selectPrimaryTask($scope.primaryTask);
                        //alert("The Communication has been saved, and the Task updated.")
                    },
                    function (err){
                        alert(angular.toJson("Error creating Task " + err.data))
                    }
                )
            }

            //---------- Graph functions

            function drawGraph(options) {
                console.log(options)
                let vo = v2ToFhirSvc.makeGraph(options)
                console.log(vo)

                var container = document.getElementById('graph');
                var graphOptions = {
                    physics: {
                        enabled: true,
                        barnesHut: {
                            gravitationalConstant: -10000,
                        }
                    }
                };
                $scope.chart = new vis.Network(container, vo.graphData, graphOptions);

                $scope.chart.on("click", function (obj) {

                    var nodeId = obj.nodes[0];  //get the first node
                    var node = vo.graphData.nodes.get(nodeId);

                    if (node.entry) {
                        $scope.selectedResource = node.entry.resource;
                    }


                    //this is the entry that is selected from the 'bundle entries' tab...
                    //$scope.selectedBundleEntry = node.entry;

                    $scope.$digest();
                });
            }

            $scope.fitGraph = function(){
                $timeout(function(){
                    if ($scope.chart) {
                        $scope.chart.fit();
                    }
                },1000)
            };

            //============ log functions

            $scope.showLog = function() {
                $scope.loadLog()
                $scope.state='viewlog'
            }


            $scope.loadLog = function() {
                $http.get('/manage/getLog').then(
                    function(data) {
                        //all log entries
                        let hash = {}
                        data.data.forEach(function (log) {
                            hash[log.corrId] = hash[log.corrId] || {}
                            let item = hash[log.corrId]
                            if (log.status) {
                                //this is the log of the bundle sent to the server
                                item.status = log.status;
                                item.toServer = log.resource
                            } else {
                                //this is the initial request
                                item.url = log.url
                                item.date = log.date
                                item.fromClient = log.resource

                            }
                        })
                        $scope.apiLog = []
                        Object.keys(hash).forEach(function (key) {
                            let item = hash[key];

                            $scope.apiLog.push(item)
                        })




                })
            }

            $scope.selectLogItem = function(log){
                $scope.selectedLogItem = log;
            }

        }
    )
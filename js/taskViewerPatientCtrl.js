angular.module("sampleApp")
    .controller('taskViewerPatientCtrl',
        function ($scope,$http) {

            $scope.input = {}

            $scope.input.newRequestTarget = "me"

            $scope.newTask = function () {
                $scope.state = "newtask"
            }

            //called when the Organizations have been loaded form the server (async)
            $scope.$on('orgsLoaded',function(evt,args) {
                $scope.recipientOrganization = $scope.organizations[0]
            })

            //called when the Patiets with a task have been loaded form the server (async)
            $scope.$on('patsLoaded',function(evt,args) {
                $scope.selectedPatientItem = $scope.allPatients[0]
            })

            //the patient makes a reply

            $scope.patientReply = function(item) {
                let communicationToRespondTo = item.resource;
                if (! communicationToRespondTo.sender) {
                    alert("No sender found...")
                    return
                }

                let msg = "What do you want to say"
                let text = "<div xmlns='http://www.w3.org/1999/xhtml'>From Patient</div>"

                let comment = prompt(msg)
                if (comment) {
                    //construct a Communication with an 'about' link to the primary one...
                    //the server will add the 'sent' element - so tz consistent across users...
                    let bundle = {resourceType:'Bundle','type':'collection',entry:[]}
                    let communication = {resourceType:'Communication'}


                    communication.text = {div:text}

                    communication.status = "completed"
                    communication.inResponseTo = [{reference:"Communication/"+communicationToRespondTo.id}]
                    communication.category = {coding:[{system:"http://hl7.org/fhir/uv/patient-corrections/CodeSystem/PatientCorrectionTaskTypes",code:"medRecCxReq"}]}
                    communication.about = [{reference:"Communication/"+$scope.primaryCommunication.id }]
                    communication.subject = $scope.primaryCommunication.subject

                    //The recipient of this comm is the sender of the one being replied to...
                    communication.recipient = [communicationToRespondTo.sender] //  [{reference:$scope.thisUserId }]

                    //The sender of this comm is the recipient of the one being replied to...
                    //It's actually the current patient - todo need to think through the implications of changing
                    communication.sender = communicationToRespondTo.recipient[0]; //$scope.primaryCommunication.subject  //the UI user
                    communication.reasonCode = {coding:[{system:"http://hl7.org/fhir/uv/patient-corrections/CodeSystem/PatientCorrectionTaskTypes",code:"medRecCxReq"}]}
                    communication.payload = [{contentString:comment}]

                    bundle.entry.push({resource:communication})

                    $http.post('/fhir/Communication/$process-medRecCxReq',bundle).then(
                        function(data) {
                            //$scope.selectPrimaryTask($scope.primaryTask);
                            $scope.selectPatientTask()
                            alert("The Communication has been saved, and the Task updated.")
                            //todo - move this Task update to the API



                        }, function(err) {
                            alert(angular.toJson( err.data))
                        }
                    )

                }
            }

            $scope.SelectPatientFromServer = function (){
                alert('Will support selecting a patient from the server.')
            }

            $scope.selectPatient = function() {
                //get all the tasks for the patient of the corrections type
                $scope.tasksForPatient = []
                let item = $scope.input.selectedPatientItem;    //the entries in the patient dropdown are items -
                let url = "/proxy/Task?subject="+item.resource.id + "&code=medRecCxReq"
                $http.get(url).then(
                    function(data) {
                        if (data.data && data.data.entry) {
                            data.data.entry.forEach(function (entry) {
                                $scope.tasksForPatient.push(entry.resource)
                            })
                        }
                    },function(err) {
                        alert(angular.toJson(err))
                    }
                )
                //getActiveTasksForPatient($scope.input.selectedPatientItem)
            }



            function getActiveTasksForPatientDEP(item) {
                $scope.tasksForPatient = []
                let ref = 'Patient/'+item.resource.id

                $scope.bundleTasks.entry.forEach(function (entry){
                    let task = entry.resource
                    if (task.for && task.for.reference && task.for.reference == ref) {
                        $scope.tasksForPatient.push(task);
                    }
                })
                console.log($scope.tasksForPatient)
            }

            $scope.selectPatientTask = function(task) {
                $scope.state = 'view'
                $scope.allResourceItemsForTask = []
                console.log('task selected',task)
                //generate the display of communications

                //implemented in the parent contreoller ? todo move to service
                //populates $scope.allResourcesForRequest and $scope.primaryTask and $scope.primaryCommunication
                $scope.selectPrimaryTask(task,function(lst){
                    lst.forEach(function (resource){
                        let item = {resource:resource}
                        if (resource.sender && resource.sender.reference) {
                            if (resource.sender.reference.indexOf("Patient") > -1) {
                                item.fromPatient = true
                            }
                        }
                        if (resource.resourceType == 'Communication') {
                            $scope.allResourceItemsForTask.push(item)
                        }

                    })


                    $scope.allResourcesForTask = lst    //all the resources for the task, ordered...
                })



            }

            //create the new task and a communication
            $scope.addTask = function () {
                //create a Communication and POST it to this endpoint (will create the Task as well)
                //'from' the patient

                let bundle = {resourceType:'Bundle','type':'collection',entry:[]}

                //add patient resurce
                //todo - need to adjust for the current patient (Me)

                let aboutPatient = $scope.input.selectedPatientItem.resource;

                if ($scope.input.newRequestTarget !== 'me') {
                    //this is NOT the same patient as in the UI
                    aboutPatient = {resourceType:'Patient'}
                    patient.id = uuidv4();
                    patient.name = [{family:$scope.input.patientLName,given:[$scope.input.patientFName]}]
                    if ($scope.input.patientIdentifier) {
                        patient.identifier = [$scope.input.patientIdentifier]
                    }
                } else {
                    //this is the same patient. As an existing patient (selected from the server)
                    //we know the patient exists on the server, so doesn't need to be added to the bundle...
                }


                bundle.entry.push({resource:patient})

                let description = $scope.input.description;
                let topic = $scope.input.topic;
                let communication = {resourceType:'Communication'}


                let text = "<div xmlns='http://www.w3.org/1999/xhtml'>Initial request</div>"
                communication.text = {div:text}

                communication.status = "completed"
                communication.category = {coding:[{system:"http://hl7.org/fhir/uv/patient-corrections/CodeSystem/PatientCorrectionTaskTypes",code:"medRecCxReq"}]}
                communication.recipient = {reference:"Organization/" + $scope.selectedOrganization.id}
                communication.subject = {reference:"Patient/"+aboutPatient.id }
                communication.sender = {reference:"Patient/"+aboutPatient.id }
                communication.reasonCode = {coding:[{system:"http://hl7.org/fhir/uv/patient-corrections/CodeSystem/PatientCorrectionTaskTypes",code:"medRecCxReq"}]}
                communication.topic = topic
                communication.payload = [{contentString:description}]
                bundle.entry.push({resource:communication})


                $http.post('/fhir/Communication/$process-medRecCxReq',bundle).then(
                    function() {

                        //todo - this is not in scope...getActiveTasks()

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


        }
    )
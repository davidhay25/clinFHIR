angular.module("sampleApp")
    .controller('taskViewerCtrl',
        function ($scope,$http,v2ToFhirSvc,$timeout) {

            $scope.input = {}

            $scope.state = 'view';
            //possible states: view, newtask


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


            $scope.newTask = function () {
                $scope.state = "newtask"
            }

            //create the new task abd a communication
            $scope.addTask = function () {
                //create a Communication and POST it to this endpoint (will create the Task as well)

                let description = $scope.input.description;

                let communication = {resourceType:'Communication'}
                communication.status = "completed"
                communication.category = {coding:[{system:"\"https://www.maxmddirect.com/fhir/us/mmdtempterminology/6qlB89NQ/CodeSystem/FHIRPatientCorrectionTemp",code:"medRecCxReq"}]}
                //communication.about = {reference:"Task/"+taskId }
                communication.subject = {reference:"Patient/"+$scope.input.patientId }
                communication.sender = {reference:"Patient/"+$scope.input.patientId }
                communication.reasonCode = {coding:[{system:"\"https://www.maxmddirect.com/fhir/us/mmdtempterminology/6qlB89NQ/CodeSystem/FHIRPatientCorrectionTemp",code:"medRecCxReq"}]}
                //communication.payload = [{ContentReference:{reference:'DocumentReference/'+docRefId}}]
                communication.payload = {contentString:description}

                $scope.generatedCommunication = communication;

                $http.post('/fhir/Communication',communication).then(
                    function() {
                        alert("saved!")
                    }, function(err) {
                        alert(angular.toJson( err.data))
                    }
                )

                /*

                let taskId = 'cf-' + new Date().getTime() + "t"
                let communicationId = 'cf-' + new Date().getTime() + "c"
                let docRefId = 'cf-' + new Date().getTime() + "d"



                let task = {resourceType:'Task'}
                task.code = {coding:[{system:"\"https://www.maxmddirect.com/fhir/us/mmdtempterminology/6qlB89NQ/CodeSystem/FHIRPatientCorrectionTemp",code:"medRecCxReq"}]}
                task.status = "received"
                task.intent = "proposal"
                task.description = description
                task.for = {reference:"Patient/"+$scope.input.patientId }
                task.requester = {reference:"Patient/"+$scope.input.patientId }     //assume requested by the patient
                task.owner = {reference:"Practitioner/"+$scope.input.ownerId }

                let inp = {}
                inp.type = {text:"Original communication"}
                inp.valueReference = {reference:"Communication/"+communicationId }
                task.input = [inp]




                //let docRef = {resourceType:'DocumentReference'};
                let bundle = {resourceType: description}

*/

            }

            //A resource has been selected in the correction set
            $scope.selectResource = function (resource) {
                $scope.selectedResource = resource;
            }

            //A task has been selected in the list to the left. Get all the communications that
            $scope.selectPrimaryTask = function(task) {
                $scope.primaryTask = task
                $scope.allResourcesForRequest = []




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
                    let url = "/fhir/" + communicationId        //note communicationId includes the type...
                    $http.get(url).then(
                        function (data) {
                            $scope.primaryCommunication = data.data
                            $scope.allResourcesForRequest.push(data.data)

                            //now get the other Communication resources with an 'about' reference to the primary one
                            //nested so know when to draw the graph - todo more performant options are possible

                            let ar = communicationId.split('/');        //split the id from the resource type
                            url = "/fhir/Communication?about=" + ar[1];

                            $http.get(url).then(
                                function (data) {
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

                    let communication = {resourceType:'Communication'}
                    communication.status = "completed"
                    communication.category = {coding:[{system:"\"https://www.maxmddirect.com/fhir/us/mmdtempterminology/6qlB89NQ/CodeSystem/FHIRPatientCorrectionTemp",code:"medRecCxReq"}]}
                    communication.about = {reference:"Communication/"+$scope.primaryCommunication.id }
                    communication.subject = $scope.primaryCommunication.subject
                    communication.sender = $scope.primaryCommunication.subject  //todo should be UI user
                    communication.reasonCode = {coding:[{system:"\"https://www.maxmddirect.com/fhir/us/mmdtempterminology/6qlB89NQ/CodeSystem/FHIRPatientCorrectionTemp",code:"medRecCxReq"}]}
                    communication.payload = {contentString:comment}

                    $http.post('/fhir/Communication',communication).then(
                        function() {
                            alert("saved!")
                        }, function(err) {
                            alert(angular.toJson( err.data))
                        }
                    )

                }
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

                    $scope.selectedResource = node.entry.resource;

                    //this is the entry that is selected from the 'bundle entries' tab...
                    $scope.selectedBundleEntry = node.entry;

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

        }
    )
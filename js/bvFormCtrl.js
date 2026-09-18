angular.module("sampleApp")
    .controller('bvFormCtrl',
        function ($scope,$http,$timeout,$localStorage,$uibModal) {

            $scope.formInput = {}

            //get all the Q from the local fhir server
            function loadAllQ() {
                let qry = "https://clinfhir.com/fhir/Questionnaire?_elements=id,name,description,url"
                $http.get(qry).then(
                    function (data) {
                        $scope.bundleQSummary = data.data
                      //  console.log(data.data)
                    }
                )
            }
            loadAllQ()

            //load the modelreview with this Q
            $scope.loadModelReview = function() {
                let cacheName = 'cache-Q'       //just use a single name
                $localStorage[cacheName] = $scope.activeQ

                //console.log(window)


                const url = `${window.location.origin}/forms/modelReview.html?${cacheName}`

                const features = 'noopener,noreferrer'
                window.open(url, '_blank', features)

            }

            $scope.loadQFromServer = function (id) {
                delete $scope.extractBundle
                let qry = `https://clinfhir.com/fhir/Questionnaire/${id}`
                $http.get(qry).then(
                    function (data) {
                        let Q = data.data
                        $scope.activeQ = Q
                        isExtractEnabled(Q)
                        $scope.formInput.state = 'renderQ'
                        setContext()
                        $timeout(function () {

                            $scope.sendMessage('sdc.displayQuestionnaire', {questionnaire:Q});

                        },1000)


                    }
                )
            }


            $scope.prePopConfig = $localStorage['ppConfig']
            if (! $scope.prePopConfig) {
                //prePopConfig = {dataServer:"https://hapi.fhir.org/baseR4"}
                $scope.prePopConfig = {dataServer:"https://clinfhir.com/fhir"}
                $scope.prePopConfig.termServer = "https://tx.fhir.org/r4"
                $scope.prePopConfig.formServer = "https://hapi.fhir.org/baseR4"

                $scope.prePopConfig.patient = {reference: 'Patient/sample1', display: 'Example Patient'}
                $scope.prePopConfig.practitioner = { reference: 'Practitioner/sample1', display: 'Example Practitioner' }

            }

            console.log($scope.prePopConfig)

            //display the configuration screen for prepop

            $scope.loadPPConfig = function () {
                $uibModal.open({
                    templateUrl: 'modalTemplates/prePopConfig.html',
                    size: 'lg',
                    controller: 'prePopConfigCtrl',
                    resolve : {
                        prePopConfig : function(){
                            return angular.copy($scope.prePopConfig)
                        }
                    }
                }).result.then(function (pp) {
                    $scope.prePopConfig = pp
                    //todo - update localstorage as well
                    $localStorage['ppConfig'] = $scope.prePopConfig
                })

            }



            $scope.formInput.state = "getQ"         //other state = renderQ
/*
            if ($localStorage.bvQ) {
                $scope.loadedFromCache = true

            }
*/
            $scope.previousQ = $localStorage.bvQ
            //$scope.formInput.json = $localStorage.bvQ || ""



            $scope.selectBundle = function () {

                //add id's to all resources for tthe detail link. todo - should be able to use entry.fullUrl if known
                for (let entry of $scope.extractBundle.entry) {
                    entry.resource.id = entry.fullUrl   //the extract service creates a uri
                }

                $scope.process($scope.extractBundle)
                $scope.setTab.mainTabActive = 1     //display the graph first
            }
/*
            $timeout(function () {
                let url = "https://dev.fhirpath-lab.com/swm-csiro-smart-forms"
                const iframe = document.getElementById('formPreview');

                iframe.onload = function () {
                    console.log('iframe loaded');
                    formViewerSetup()
                };
                iframe.src = `${url}?messaging_handle=${encodeURIComponent($scope.messagingHandle)}&messaging_origin=${encodeURIComponent($scope.messagingOrigin)}`

            },1000)


*/
            function formViewerSetup() {

                //if the messagingHandle exists, the setuo has already been done.
                if ($scope.messagingHandle) {
                    return
                }

                $scope.messageCounter = 0
                let url = "https://dev.fhirpath-lab.com/swm-csiro-smart-forms"
                const iframe = document.getElementById('formPreview');

                $scope.messagingHandle = 'cf-forms-' + Date.now() // Unique handle for this session
                $scope.messagingOrigin = window.location.origin // Origin for message validation

                $timeout(function () {
                    //need to pass the messaging handle & origin when initializing the iFrame
                    iframe.src = `${url}?messaging_handle=${encodeURIComponent($scope.messagingHandle)}&messaging_origin=${encodeURIComponent($scope.messagingOrigin)}`

                },500)



                window.addEventListener('message',function (data) {
                    let msg = data.data
                    let msgType = msg.messageType

                   // console.log(msg,msgType)

                    if (msg.responseToMessageId) {
                        if (hashResponse[msg.responseToMessageId]) {
                            hashResponse[msg.responseToMessageId](msg)
                            delete hashResponse[msg.responseToMessageId]

                        }
                    }

                    switch (msgType) {
                        case "sdc.ui.changedFocus":
                            //console.log(msg.payload.linkId)
                            break
                        case 'sdc.ui.changedQuestionnaireResponse' :
                           // console.log(msg.payload?.questionnaireResponse)

                            //automatically call extract after any change
                            $scope.sendMessage('sdc.requestExtract', {})

                            //temp setQR(msg.payload?.questionnaireResponse)
                            break

                        default :
                            //this could be the response to an extract.
                            //todo i should really track that message Id
                            if (msg.payload?.extractedResources) {
                                //temp $scope.processExtractBundle(msg.payload.extractedResources)
                               // console.log(msg.payload.extractedResources)
                                $scope.extractBundle = msg.payload.extractedResources

                                $scope.$digest()
                            } else if (msg.payload?.questionnaireResponse) {
                                //temp setQR(msg.payload.questionnaireResponse)
                              //  console.log(msg.payload?.questionnaireResponse)

                                //if a QR was returned then call extract
                                $scope.sendMessage('sdc.requestExtract', {})


                                $scope.$digest()
                            } else {
                                //console.log(angular.toJson(msg))
                                //console.log(msg.payload)
                                if (msg.payload?.status == 'error') {
                                    let msg1 = "An error was returned from the last operation. Details are: \n"
                                    for (const iss of msg.payload?.outcome?.issue) {
                                        msg1 += iss.diagnostics + "\n"
                                    }
                                    msg1 += "A common cause of this is that the Data Server is unavailable"
                                    alert(msg1)
                                }

                            }

                            break

                    }
                })

            }


            //allow enough time for iframe to be set up. must be a better way, but it doesn't really affect the app
            $timeout(function () {
                    formViewerSetup()
            },1000)

            let contextCreated = false
            let setContext = function () {
                if (contextCreated) {
                 //   return
                } else {
                    contextCreated = true
                }

                //return //<<< temp
                /*$scope.sendMessage('sdc.configureContext', {
                    context: {
                        subject: prePopConfig.patient,
                        author: prePopConfig.practitioner,

                        launchContext: [
                            {
                                name: 'source',
                                contentReference: prePopConfig.practitioner
                            },{
                                name: 'testObservation',
                                contentResource: testResource
                            }
                        ]

                    }
                })*/

                let testResource = {resourceType:'Observation',valueString:"test data"}

                //tod can the context be a resource
                //the testObservation must be present for prepop to work. todo ask Brian
                $scope.sendMessage('sdc.configureContext', {
                    context: {
                        subject: $scope.prePopConfig.patient,
                        author: $scope.prePopConfig.practitioner,

                        launchContext: [
                            {
                                name: 'source',
                                contentReference: $scope.prePopConfig.practitioner
                            },{
                                name: 'testObservation',
                                contentResource: testResource
                            }
                        ]

                    }
                })

                $scope.sendMessage('sdc.configure', {
                    terminologyServer: $scope.prePopConfig.termServer,// 'https://tx.fhir.org/r4',
                    dataServer: $scope.prePopConfig.dataServer, //'https://hapi.fhir.org/baseR4',
                    formsServer: $scope.prePopConfig.formServer //'https://hapi.fhir.org/baseR4'
                });
            }

            //setContext()



            let hashResponse = {}
            $scope.sendMessage = function(messageType, payload,fnResponse) {
                let messagingHandle = $scope.messagingHandle

                const iframe = document.getElementById('formPreview');

                //should never happen...
                if (!iframe || !iframe.contentWindow) {
                    alert('Iframe not loaded yet!');
                    return;
                }

                const messageId = `msg-${++$scope.messageCounter}`;

                if (fnResponse) {
                    hashResponse[messageId] = fnResponse
                }

                const message = {
                    messagingHandle,
                    messageId,
                    messageType,
                    payload
                };

                const targetWindow = iframe.contentWindow;
                const targetOrigin = '*' //http://localhost:8081'; // must match iframe origin

               // console.log('Sending message:', message);
                targetWindow.postMessage(message, targetOrigin);
                return messageId
            };



            $scope.loadQ = function (json) {
                delete $scope.extractBundle
                $localStorage.bvQ = json

                let Q = angular.fromJson(json)
                $scope.activeQ = Q
                isExtractEnabled(Q)

                //console.log(Q)

                $scope.formInput.state = 'renderQ'

                $timeout(function () {
                    setContext()
                        $scope.sendMessage('sdc.displayQuestionnaire', {questionnaire:Q});
                },1000)




                }

            //instruct the renderer to pre-pop
            //parameters are set in the sdc.configureContext() and sdc.configure() calls
            $scope.setPrepop = function () {
                let responseFn = function () {
                    $scope.sendMessage('sdc.requestCurrentQuestionnaireResponse',{})
                }

                $scope.sendMessage('sdc.requestPrepopulate',{},responseFn)


            }

            $scope.getExtractBundle = function () {
                delete $scope.extractBundle
                $scope.sendMessage('sdc.requestExtract', {},function (outcome) {
/* - don't really need this callback
                    if (outcome?.payload?.outcome) {

                        $scope.extractOutcome = outcome?.payload?.outcome

                    }
                    $scope.$digest()
                    */
                  //  console.log("outcome of extraction",outcome)
                });
            }


            function isExtractEnabled(Q) {
                $scope.noExtract = false

                let cnt = countExtensionUrl(Q,"http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-definitionExtract")

                if (cnt == 0) {
                    $scope.noExtract = true
                }

                function countExtensionUrl(obj, url) {
                    let count = 0;

                    if (!obj || typeof obj !== "object") {
                        return count;
                    }

                    if (Array.isArray(obj.extension)) {
                        for (const ext of obj.extension) {
                            if (ext.url === url) {
                                count++;
                            }

                            // An extension can itself contain extensions
                            count += countExtensionUrl(ext, url);
                        }
                    }

                    if (Array.isArray(obj.item)) {
                        for (const item of obj.item) {
                            count += countExtensionUrl(item, url);
                        }
                    }

                    return count;
                }

            }

        })
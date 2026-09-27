angular.module("sampleApp")
    .controller('bvFormCtrl',
        function ($scope,$http,$timeout,$localStorage,$uibModal,bundleVisualizerSvc) {

            $scope.formInput = {}

            $scope.formInput.state = "getQ"         //other state = renderQ

            $scope.previousQ = $localStorage.bvQ

            //remember the context type (query a fhir server ot use a bundle from the library)
            $scope.contextType = $localStorage.contextType || 'query' //default to query

            if ($scope.contextType == 'bundle') {
                $scope.contextBundleItem =  $localStorage.contextBundleItem
            }


            //get all the Q from the local fhir server. Todo - is some kind of filtering needed
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

            $scope.changeContextType = function () {
                if ($scope.contextType == 'query') {
                    $scope.contextType = 'bundle'
                } else {
                    $scope.contextType = 'query'
                    delete $scope.contextBundleItem
                }
                $localStorage.contextType = $scope.contextType

            }


            //select the bundle to act as the form data source (if not a REST query against a FHIR server)
            $scope.selectContextBundle = function () {
                delete $scope.contextBundleItem

                $uibModal.open({
                    templateUrl: 'modalTemplates/selectBundle.html',
                    size: 'lg',
                    controller: function ($scope) {
                        $scope.input = {}

                        //Load the lists. Needed to set Context on forms if context set to a list
                        $http.get('bv/lists').then(
                            function (data) {
                                $scope.lists = data.data

                            },function () {
                                $scope.lists = []
                                console.log("Error retrieving lists")
                            }
                        )

                        //when an item in the list is selected...
                        $scope.selectListEntry = function (bundleItem) {
                            console.log(bundleItem)
                            if (bundleItem.type == 'query') {
                                alert("Only stored bundles can be used")
                                return
                            }

                            $http.get(`bv/bundle/${bundleItem.bundleId}`).then(
                                function (data) {
                                    let newBundleItem = angular.copy(bundleItem)
                                    newBundleItem.bundle = data.data?.bundle
                                    newBundleItem.source='bundle'
                                    $scope.$close(newBundleItem)
                                    //$scope.$close(data.data)
                                }, function () {
                                    alert("Error retrieving bundle")
                                }
                            )

                            /*
                            if (bundleItem.type == 'query') {
                                //execute the query returning the bundle
                                $http.get(bundleItem.query).then(
                                    function (data) {

                                        //$scope.$close({type:'query',bundle:data.data,query:bundleItem.query})
                                        let newBundleItem = angular.copy(bundleItem)
                                        newBundleItem.bundle = data.data
                                        newBundleItem.source='query'
                                        $scope.$close(newBundleItem)
                                    }, function () {
                                        alert(`Unable to retrieve bundle from ${bundleItem.query}`)
                                    }
                                )
                            } else {
                                $http.get(`bv/getBundle/${bundleItem.bundleId}`).then(
                                    function (data) {
                                        let newBundleItem = angular.copy(bundleItem)
                                        newBundleItem.bundle = data.data?.bundle
                                        newBundleItem.source='bundle'
                                        $scope.$close(newBundleItem)
                                        //$scope.$close(data.data)
                                    }, function () {
                                        alert("Error retrieving bundle")
                                    }
                                )
                            }
                            */

                        }
                    }
                }).result.then(function (bundleItem) {

                    $scope.contextBundleItem = bundleItem // name, description enriched with source, bundle
                    $localStorage.contextBundleItem = bundleItem

                })
            }

            //load the Q viewer (modelReview) with this Q
            $scope.loadModelReview = function(Q) {
                let cacheName = 'cache-Q'       //just use a single name
                $localStorage[cacheName] = Q// $scope.activeQ

                const url = `${window.location.origin}/forms/modelReview.html?${cacheName}`

                const features = 'noopener,noreferrer'
                window.open(url, '_blank', features)

            }

            $scope.selectQFromList = function (entry) {
                console.log(entry)
                let qry = `https://clinfhir.com/fhir/Questionnaire/${entry.resource.id}`
                $http.get(qry).then(
                    function (data) {
                        let Q = data.data
                        $scope.selectedQ = Q
                        let vo = bundleVisualizerSvc.makeQTree(Q)

                        let treeData = vo.treeData

                        //show the tree structure of this resource (adapted from scenario builder)
                        $('#bvQTree').jstree('destroy');
                        $('#bvQTree').jstree(
                            {'core': {'multiple': false, 'data': treeData, 'themes': {name: 'proton', responsive: true}}}
                        ).on('ready.jstree', function () {
                            $('#bvQTree').jstree(true).open_all();
                        })




                    }, function (err) {
                        alert("Q not found")
                    })



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

                $scope.prePopConfig.patient = {reference: 'Patient/NNJ9186', display: 'Peter Jordan'}
                $scope.prePopConfig.practitioner = { reference: 'Practitioner/sample1', display: 'Example Practitioner' }

            }



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


            $scope.selectBundle = function () {

                //add id's to all resources for tthe detail link. todo - should be able to use entry.fullUrl if known
                for (let entry of $scope.extractBundle.entry) {
                    entry.resource.id = entry.fullUrl   //the extract service creates a uri
                }

                $scope.process($scope.extractBundle)
                $scope.setTab.mainTabActive = 1     //display the graph first
            }

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

                    //If it's a response message, see if a handler was saved when the request message was invoked
                    //and execute it. Clear the hash after
                    if (msg.responseToMessageId) {
                        if (hashResponse[msg.responseToMessageId]) {
                            hashResponse[msg.responseToMessageId](msg)
                            delete hashResponse[msg.responseToMessageId]

                        }
                    }

                    //specific processingo for messages from the renderer - whether a response message or originating
                    //from the renderer
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


            let setContext = function () {

                //return //<<<<<  temp

              //  let testResource = {resourceType:'Observation',valueString:"test data"}

                //tod can the context be a resource
                //the testObservation must be present for prepop to work. todo ask Brian

                $scope.sendMessage('sdc.configure', {
                    terminologyServer: $scope.prePopConfig.termServer,// 'https://tx.fhir.org/r4',
                    dataServer: $scope.prePopConfig.dataServer //'https://hapi.fhir.org/baseR4',
                    //formsServer: $scope.prePopConfig.formServer //'https://hapi.fhir.org/baseR4'
                });

                $scope.sendMessage('sdc.configureContext', {
                    context: {
                        subject: $scope.prePopConfig.patient,
                        author: $scope.prePopConfig.practitioner
                    }
                })

/*  Leave this here just to remind me that I can send other context objects into the Q (needs further investigation)
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
                */



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

                //stash the callback for when the response is received. It will be called then
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
                //
                $scope.activeQ = Q
                isExtractEnabled(Q)         //determine if there are SDC definition extraction extensions. To notify the user

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

                //If the context has been set to a bundle, then set the data server to point
                //to the clinFHIR API that provides REST access to bundle contents. By default the
                //data server will have been set to the fhie server query url from pre-pop
                //also extract the patient from the bundle and set that.
                //todo I think I need to re-load the Q after the context has been changed. Otherwise it's using the old context

                if ($scope.contextBundleItem?.source == 'bundle') {

                    let serverRoot = `https://clinfhir.com/bqry/${$scope.contextBundleItem.bundleId}`
//alert(serverRoot)


                    //todo - need to experiment to see if they all need to be included in the setcontext call
                    //and if the testResource is needed
                    //let testResource = {resourceType:'Observation',valueString:"test data"}

                    let patientId   //Patient/{}
                    let ar = $scope.contextBundleItem.bundle.entry.filter(entry => entry.resource?.resourceType == 'Patient')
                    switch (ar.length) {
                        case 0:
                            alert("There are no Patients in this bundle. Pre-pop cancelled")
                            return
                            break
                        case 1:
                            let patientEntry = ar[0]
                            patientId = `Patient/${patientEntry.resource.id}`

                    }

                    //for now - find a Practitioner. todo - there must be a better way
                    let authorId = $scope.prePopConfig.practitioner
                    let ar1 = $scope.contextBundleItem.bundle.entry.filter(entry => entry.resource?.resourceType == 'Practitioner')
                    if (ar1.length > 0) {
                        authorId = `Practitioner/${ar1[0].resource.id}`
                    }

                    console.log(serverRoot, patientId, authorId)
                    let configureObj = {
                        terminologyServer: $scope.prePopConfig.termServer,
                        formsServer: $scope.prePopConfig.formServer,
                        dataServer:   serverRoot        //queries will be fulfilled by the bundle
                    }


                    let configureContextObj = {
                        context: {
                            subject: {reference:patientId},
                            author: {reference:authorId}
                        }
                    }


                    //set up the pyramid of doom
                    $scope.sendMessage('sdc.configure',configureObj ,function () {
                        $scope.sendMessage('sdc.configureContext', configureContextObj,function () {
                            $scope.sendMessage('sdc.displayQuestionnaire', {questionnaire:$scope.activeQ},function () {
                                $scope.sendMessage('sdc.requestPrepopulate',{},function () {
                                    $scope.sendMessage('sdc.requestCurrentQuestionnaireResponse',{},function () {

                                    })
                                })
                            })
                        })
                    })

                } else {

                    //if the pre-pop is REST queries against a FHIR server

                    setContext()    //sets up the context from the prepop object...
                    $timeout(function () {
                        $scope.sendMessage('sdc.requestPrepopulate',{},responseFn)
                    },500)

                }




               // $scope.sendMessage('sdc.requestPrepopulate',{},responseFn)


            }

            $scope.getExtractBundle = function () {
                delete $scope.extractBundle
                $scope.sendMessage('sdc.requestExtract', {},function (outcome) {

                });
            }


            //are there any SDC extract extensions
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
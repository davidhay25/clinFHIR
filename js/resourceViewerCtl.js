
angular.module("sampleApp")
    .controller('resourceViewerCtrl',
        function ($scope,supportSvc,appConfigSvc,resourceCreatorSvc,resourceSvc,$sce,sessionSvc,questionnaireSvc,
                  $uibModal, $timeout,GetDataFromServer,modalService,ResourceUtilsSvc,builderSvc,$window,$http) {


            $scope.outcome = {};
            $scope.graph = {};

            $scope.ResourceUtilsSvc = ResourceUtilsSvc; //needed for 1 line summary
            $scope.appConfigSvc = appConfigSvc;     //for displaying the patient json

            $scope.isSMART = appConfigSvc.getCurrentDataServer().smart;     //if true, this server requires SMART
            $scope.oauthAccessToken;    //if SMART, this will be the access token...

            //---------- SMART stuff ------ move to a common service eventually..
            $scope.smartLogin = function() {
                $http.get('smartAuth/'+appConfigSvc.getCurrentDataServer().name).then(
                    function(data) {
                        $window.location.href = data.data.authUrl;
                    },
                    function(data) {
                        alert(data.msg)
                    }
                );
            };

            //always see if therer is an active token for this session.
            //https://stackoverflow.com/questions/23124032/set-httpprovider-default-headers-after-user-authentification
            $http.get("/smartAuth/getToken").then(
                function(data) {
                    sessionSvc.setAuthToken("Bearer " + data.data.token)
                  //  $http.defaults.headers.common['Authorization'] = "Bearer " + data.data.token;
                    alert("Bearer " + data.data.token)
                }
            );


            //----------------------


            //find all the questionnaires (authored by CF) on the conformance server...
            questionnaireSvc.findQ().then(
                function(bundle) {
                    $scope.QBundle = bundle;
                }
            )

            $scope.selectQ = function(Q) {
                $scope.currentQ = Q;
            }


            $scope.showGQL = appConfigSvc.getCurrentDataServer().name == 'Grahames STU3 server';

            $scope.displayServers = "<div>Data: " + appConfigSvc.getCurrentDataServer().name + "</div>"

            //when a new scenario is selected with a patient from the server. passes in all data for that patient
            $scope.$on('patientSelected',function(event,patientData){
                renderPatientDetails(patientResource);
                console.log(patientResource)
            });


            //load a bundle (used by the document function)
            $scope.loadBundle = function() {

            };

            //when a document is selected in from the list of documents...
            $scope.selectDocument = function(docRef) {

                $scope.documentReference = docRef;
                delete $scope.docAttachment;

                //$scope.docAttachments = []

                if (docRef.content && docRef.content.length > 0) {
                    var con = docRef.content[0];        //only the first one...

                    // docRef.content.forEach(function (con) {
                    var url = con.attachment.url;      //assume a complete url to the document bundle...
                    if (url) {
                        GetDataFromServer.adHocFHIRQuery(url).then(
                            function (data) {
                                var bundle = data.data;     //the resource returned by the call...

                                $scope.docAttachment = {bundle: bundle};
                                $scope.docAttachment.html = getDocHtml(bundle);

                                generateDocGraph(bundle);

                                var treeData = builderSvc.makeDocumentTree(bundle)
                                $('#docTreeView1').jstree('destroy');
                                $('#docTreeView1').jstree(
                                    {
                                        'core': {
                                            'multiple': false,
                                            'data': treeData,
                                            'themes': {name: 'proton', responsive: true}
                                        }
                                    }
                                ).on('select_node.jstree', function (e, data) {
                                    console.log(data)
                                    //delete $scope.docTreeResource;
                                    delete $scope.docSectionText;
                                    delete $scope.docTreeResource;
                                    delete $scope.docSection
                                    delete $scope.currentResource;      //todo - there's a setResource() in the service too...

                                    if (data.node.data) {
                                        if (data.node.data.section) {
                                            $scope.docSection = angular.copy(data.node.data.section);
                                            $scope.docSection.text = {div:'text removed'};
                                        }

                                        if (data.node.data.resource) {
                                            $scope.selectResourceInDocTree({resource: data.node.data.resource});
                                        }
                                        if (data.node.data.text) {
                                            $scope.docSectionText = data.node.data.text;

                                        }

                                    }
                                    $scope.$digest()
                                })

                            }
                        )

                    }
                }

            };

            $scope.selectResourceInDocTree = function(resource) {
                $scope.docTreeResource = resource;
            };

            //called when the tab is selected...
            $scope.redrawChart = function(){
                $timeout(function(){
                    if ($scope.docGraph) {
                        $scope.docGraph.fit();

                    }

                },1000)

            }


            //generate the document graph from the bundle
            var generateDocGraph = function(bundle) {

                var allResources = [];

                //assemble a list of all the resources in the bundle...
                bundle.entry.forEach(function (entry) {
                    var resource = entry.resource;
                    //if the resource has no id, then set thu id to the full url (hopefully a urn) as that is what the references to it will use
                    if (! resource.id) {
                        resource.id = entry.fullUrl;
                    }
                    allResources.push(resource);

                });

                var graphData = resourceCreatorSvc.createGraphOfInstances(allResources);

                $scope.docQuality = builderSvc.documentQualityReport(graphData.rawData.nodes,graphData.rawData.edges)

                var container = document.getElementById('documentGraph');
                $scope.docGraph = new vis.Network(container, graphData, {});


                $scope.docGraph.on("click", function (obj) {
                    var nodeId = obj.nodes[0];  //get the first node
                    var selectedGraphNode = graphData.nodes.get(nodeId);

                    console.log(selectedGraphNode)

                    delete $scope.graphDocResource

                    $scope.graphDocResource = selectedGraphNode.resource;

                    $scope.$digest();
                });



            }


            //assuming that this is a fhir document - generate the document views - html & tree
            var getDocHtml = function(bundle) {

                var comp = _.find(bundle.entry,function(o){
                    return o.resource.resourceType=='Composition';
                });

                if (comp) {
                    return(builderSvc.makeDocumentText(comp.resource,bundle))
                }

                //


            };

            //==== for fhirpath ===

            $scope.selectFPResource = function(resource){
                $scope.fpResource = resource
            };

            $scope.selectSingleBundle = function(bundle){
                $scope.fpResource = bundle

            };

            //======== document functions

            //display the docment graph. Only works for one document per patient
            $scope.selectCCDADocumentDEP = function(composition) {
                console.log(composition);

                //work on copies
                $scope.currentComposition = angular.copy(composition);
                var localAllResourcesList = angular.copy($scope.allResourcesAsList)

                //not currently used - was going to support a separate node for sections linked from the document
                var sectionNodeMaster = {resourceType:"Section",id:'sectionNodeMaster'};
                sectionNodeMaster.entry = [];
                //temp disable $scope.currentComposition.sectionNodeMasterNode = {'reference':'Section/sectionNodeMaster'}
                //temp disable localAllResourcesList.push(sectionNodeMaster)




                //move through sections and create a node to represent that, moving the references from the composition to the node...
                $scope.currentComposition.section.forEach(function(section,inx){
                    var newNode = angular.copy(section);
                    newNode.resourceType = "Section";
                    newNode.id = 'sectionNode'+inx;

                    delete section.entry
                    delete section.text

                    //the reference from the Composition to the section
                    section.section = {'reference':'Section/sectionNode'+inx}
                    sectionNodeMaster.entry.push({'reference':'Section/sectionNode'+inx})

                    localAllResourcesList.push(newNode)
                })

                //move through the list of all resources, remove the current composition & insert the updated one
                for (var i=0; i < localAllResourcesList.length; i++) {
                    var resource = localAllResourcesList[i]

                    if (resource.resourceType == 'Composition' && resource.id == $scope.currentComposition.id) {
                        localAllResourcesList.splice(i,1,$scope.currentComposition);
                        break;
                    }
                }



                //create and draw the graph representation...
                var graphData = resourceCreatorSvc.createGraphOfInstances(localAllResourcesList);
                var container = document.getElementById('documentGraph');
                var docGraph = new vis.Network(container, graphData, {});
               // $scope.graph['mynetwork'] = network;
                docGraph.on("click", function (obj) {
                    // console.log(obj)
                    var nodeId = obj.nodes[0];  //get the first node
                    var node = graphData.nodes.get(nodeId);

                    var selectedGraphNode = graphData.nodes.get(nodeId);

                    console.log(selectedGraphNode)
                    delete $scope.currentDocumentSectionText;
                    delete $scope.currentDocumentSection
                    if (selectedGraphNode.resource && selectedGraphNode.resource) {
                        $scope.currentDocumentSection = selectedGraphNode.resource;
                       // delete $scope.currentDocumentSection.text;
                    }


                    if (selectedGraphNode && selectedGraphNode.resource && selectedGraphNode.resource.text) {
                        $scope.currentDocumentSectionText = selectedGraphNode.resource.text.div;


                    }


                    //drawResourceTree($scope.selectedGraphNode.resource)

                    $scope.$digest();
                });


                //createGraphOneResource(composition,"documentGraph")


            }


            $scope.filterTimeLineByCondition = function(reference) {
                delete $scope.outcome.selectedResource;
                //console.log(reference);
                //create and draw the timeline. The service will display the number of encounters for each condition
                //todo - this code is (mostly) a copy from the function above - refactor..
                var timelineData =resourceCreatorSvc.createTimeLine($scope.allResourcesAsList,$scope.allResources['Condition'],reference);

                // console.log(timelineData)
                $('#encTimeline').empty();     //otherwise the new timeline is added below the first...
                var tlContainer = document.getElementById('encTimeline');

                var timeline = new vis.Timeline(tlContainer);
                timeline.setOptions({});
                timeline.setGroups(timelineData.groups);
                timeline.setItems(timelineData.items);

                timeline.on('select', function(properties){
                    timeLineItemSelected(properties,timelineData.items)
                });
               // $scope.$digest();

            };


            //show the section text (html)
            $scope.showText = function(section){


                $uibModal.open({
                    backdrop: 'static',      //means can't close by clicking on the backdrop. stuffs up the original settings...
                    keyboard: false,       //same as above.
                    templateUrl: 'modalTemplates/showSection.html',
                    size:'lg',
                    controller : function($scope,section){
                        $scope.section = section;
                    },
                    resolve : {
                        section : function(){
                            return section
                        }}
                })
            }




            //used by patientViewer to select a patient to display
            $scope.findPatient = function(){

                delete $scope.graphDocResource;
                delete $scope.docTreeResource;
                delete $scope.docAttachment;
                delete $scope.docSectionText;
                delete $scope.docGraph;
                delete $scope.fpResource;
                delete $scope.docSection;

                delete $scope.documentReferenceList;
                delete $scope.allResources;
                delete $scope.vitalsTable;
                delete $scope.outcome.resourceTypes;
                delete $scope.outcome.allResourcesOfOneType;

                delete $scope.resourcesFromServer;
                $uibModal.open({
                    backdrop: 'static',      //means can't close by clicking on the backdrop. stuffs up the original settings...
                    keyboard: false,       //same as above.
                    templateUrl: 'modalTemplates/searchForPatient.html',
                    size:'lg',
                    controller: 'findPatientCtrl'
                }).result.then(
                    function(resource){
                        console.log(resource)
                        if (resource) {
                            $scope.currentPatient = resource;
                            //load the existing resources for this patient...
                            appConfigSvc.setCurrentPatient(resource);

                            $scope.waiting = true;

                           //GetDataFromServer.adHocFHIRQueryFollowingPaging(appConfigSvc.getCurrentPatient().id).then(

                             supportSvc.getAllData(appConfigSvc.getCurrentPatient().id).then(
                                //returns an object hash - type as hash, contents as bundle - eg allResources.Condition = {bundle}

                                function(data){

                                    if (data.DocumentReference) {
                                        $scope.documentReferenceList = data.DocumentReference.entry;
                                    }

                                    renderPatientDetails(data)
                                    $scope.$broadcast('patientObservations',data['Observation']);//used to draw the observation charts...
                                 },
                                 function(err){
                                    console.log(err)
                             }).finally(
                                 function(){
                                     $scope.waiting = false;
                                 }
                             )

                        }

                    }
                )
            };




            function renderPatientDetails(allResources) {
                $scope.hasVitals = false;
                delete $scope.vitalsTable;
                delete $scope.outcome.selectedResource;

                //the order is significant - allResources must be set first...
                appConfigSvc.setAllResources(allResources);


                $scope.allResources = allResources;
                $scope.singleBundle = {resourceType:'Bundle','type':'bundle',entry:[]}

                //all conditions is used by the timeline display to
                $scope.outcome.resourceTypes = [];
                angular.forEach(allResources, function (bundle, type) {

                    if (bundle && bundle.entry &&  bundle.entry.length > 0) {
                        $scope.outcome.resourceTypes.push({type: type, bundle: bundle});
                        if (type == 'Observation') {
                            //if there are Obervations, then may be able to build a Vitals table...
                            $scope.hasVitals = true;
                        }

                        //create the single 'megabundle' of all resources for the fhirPath
                        if (bundle.entry) {
                            bundle.entry.forEach(function(entry){
                                $scope.singleBundle.entry.push(entry) ;
                            })
                        }

                    }

                });

                $scope.outcome.resourceTypes.sort(function (a, b) {
                    if (a.type > b.type) {
                        return 1
                    } else {
                        return -1
                    }
                });


                //for the reference navigator we need a plain list of resources...
                $scope.allResourcesAsList = [];
                $scope.allResourcesAsDict = {};
                angular.forEach(allResources, function (bundle, type) {

                    if (bundle.entry) {
                        bundle.entry.forEach(function (entry) {
                            var hash = entry.resource.resourceType + "/" + entry.resource.id;
                            $scope.allResourcesAsDict[hash] = entry.resource;

                        })
                    }

                    /* comment out in madrid - do I need this???
                    //also need to add the reference resources to the dictionary (so thay can be found in outgoing references)
                    supportSvc.getReferenceResources().forEach(function (resource) {
                        var hash = resource.resourceType + "/" + resource.id;
                        $scope.allResourcesAsDict[hash] = resource;
                    });
*/


                });

                //need to do this after the hash has been created to avoid duplications...
                angular.forEach($scope.allResourcesAsDict,function(res){
                    $scope.allResourcesAsList.push(res);
                });


                //create and draw the graph representation...
                var graphData = resourceCreatorSvc.createGraphOfInstances($scope.allResourcesAsList);
                var container = document.getElementById('mynetwork');
                if (container) {
                    var network = new vis.Network(container, graphData, {});
                    $scope.graph['mynetwork'] = network;
                    network.on("click", function (obj) {

                        var nodeId = obj.nodes[0];  //get the first node
                        var node = graphData.nodes.get(nodeId);

                        $scope.selectedGraphNode = graphData.nodes.get(nodeId);
                        // console.log($scope.selectedGraphNode);

                        drawResourceTree($scope.selectedGraphNode.resource)

                        $scope.$digest();
                    });
                } else {
                    //alert("can't find the element 'mynetwork' in the page")
                }





                //create and draw the timeline. The service will display the number of encounters for each condition
                var timelineData =resourceCreatorSvc.createTimeLine($scope.allResourcesAsList,allResources['Condition']);

                //console.log(timelineData)
                $('#encTimeline').empty();     //otherwise the new timeline is added below the first...
                var tlContainer = document.getElementById('encTimeline');

                //seems to be absent when there is no internet - or no doc sections vs - in plane back from madrid in may....
                if (tlContainer) {
                    var timeline = new vis.Timeline(tlContainer);
                    timeline.setOptions({});
                    timeline.setGroups(timelineData.groups);
                    timeline.setItems(timelineData.items);

                    timeline.on('select', function(properties){
                        timeLineItemSelected(properties,timelineData.items)
                    });
                }



                $scope.conditions = timelineData.conditions;


                $scope.resourceSelected();  //when called with no parameters will clear the display



            }

            //when a single timeline entry is selected
            var timeLineItemSelected = function(properties,items){

                var node = items.get(properties.items[0]);

                $scope.outcome.selectedResource = node.resource;
                createGraphOneResource(node.resource,'resourcenetworkgraphtl')
                $scope.$digest();
            }

            //=========== these functions support the 'view resources' display. todo - ?move to a separate controller???
            $scope.typeSelected = function(vo) {
                //vo created to better support the display - has the type and the bundle containing all resources of that type
                delete $scope.outcome.selectedResource;
                delete $scope.vitalsTable;

                $scope.outcome.selectedType = vo.type;
                $scope.outcome.allResourcesOfOneType = vo.bundle;
            };



            function createGraphOneResource(resource,containerId) {

                //todo this is likely inefficient as may have already been done..
                var resourceReferences = resourceSvc.getReference(resource, $scope.allResourcesAsList, $scope.allResourcesAsDict);

                var graphData = resourceCreatorSvc.createGraphAroundSingleResourceInstance(resource,resourceReferences)
                var container = document.getElementById(containerId);

                var network = new vis.Network(container, graphData, {});
                $scope.graph[containerId] = network;

                network.on("click", function (obj) {


                    var modalOptions = {
                        closeButtonText: 'No, I made a mistake',
                        actionButtonText: 'Yes, load it',
                        headerText: 'Change resource',
                        bodyText: 'Do you wish to make this resource the focus?'
                    };

                    modalService.showModal({}, modalOptions).then(function (result) {
                        var nodeId = obj.nodes[0];  //get the first node
                        var node = graphData.nodes.get(nodeId);
                        $scope.resourceSelected({resource:node.resource});
                        $scope.$digest();
                    })

                });
            }

            $scope.fitGraphInContainer = function(containerId) {


                if ($scope.graph[containerId]) {

                    //this event is commonly called by tab.select() which I think is fired before the tab contents are shown.
                    //for the fit() to work, we wait a bit to be sure that the contents are displayed...
                    $timeout(function(){
                        $scope.graph[containerId].fit()
                        console.log('fitting...')
                    },500            )

                }
            };

            //when an individual resource has been selected... isVersion is true whendisplaying a version
            $scope.resourceSelected = function(entry,isVersion) {
                delete $scope.outcome.selectedResource;
                delete $scope.resourceReferences;
                delete $scope.downloadLinkJsonContent;
                delete $scope.downloadLinkJsonName;
                delete $scope.xmlResource;
                delete $scope.downloadLinkXmlContent;
                delete $scope.downloadLinkXmlName;
                delete $scope.resourceVersions;
                //delete $scope.outcome.allResourcesOfOneType; - leave the list of this type of resource intact...

                if (entry && entry.resource) {

                    var resource = entry.resource;
                    drawResourceTree(resource);         //display the resource tree
                    $scope.outcome.selectedResource = resource;     //for the json display
                    $scope.resourceReferences = resourceSvc.getReference(resource, $scope.allResourcesAsList, $scope.allResourcesAsDict);

                    if (! isVersion) {
                        //don't load versions again!
                        $scope.loadVersions(resource);  //load all the versions for this resource...
                    }


                    createGraphOneResource(resource,'resourcenetwork')

                    $scope.downloadLinkJsonContent = window.URL.createObjectURL(new Blob([angular.toJson(resource, true)], {type: "text/text"}));
                    $scope.downloadLinkJsonName = resource.resourceType + "-" + resource.id;

                    GetDataFromServer.getXmlResource(resource.resourceType + "/" + resource.id + "?_format=xml&_pretty=true").then(
                        function (data) {
                            $scope.xmlResource = data.data;
                            $scope.downloadLinkXmlContent = window.URL.createObjectURL(new Blob([data.data], {type: "text/xml"}));
                            $scope.downloadLinkXmlName = resource.resourceType + "-" + resource.id + ".xml";

                        },
                        function (err) {
                            $scope.xmlResource = "<error>Sorry, Unable to load Xml version</error>";
                            // alert(angular.toJson(err, true))
                        }
                    ).finally(function(){

                    })

                }

            };


            $scope.selectNewResource = function(reference) {
                $scope.resourceSelected({resource:reference.resource})

            };
            //--------------------------------

            function drawResourceTree(resource) {
                var treeData = resourceCreatorSvc.buildResourceTree(resource);

                //show the tree of this version
                $('#resourceTree').jstree('destroy');
                $('#resourceTree').jstree(
                    {'core': {'multiple': false, 'data': treeData, 'themes': {name: 'proton', responsive: true}}}
                )

                $('#graphResourceTree').jstree('destroy');
                $('#graphResourceTree').jstree(
                    {'core': {'multiple': false, 'data': treeData, 'themes': {name: 'proton', responsive: true}}}
                )


            }


            $scope.loadVersions = function(resource) {
                resourceCreatorSvc.loadVersions(resource).then(
                    function(data) {
                        $scope.resourceVersions = data.data;    //a bundle of all the versions for this resource...
                    }
                )
            };

            $scope.selectVersion = function(resource) {
                $scope.outcome.selectedResource = resource;     //todo - any side effects of a version rather than the latest?

                drawResourceTree(resource)

                $scope.resourceSelected({resource:resource});


            };


            //generate the table of vitals copied from resourceCreatorCtrl...
            $scope.getVitals = function(){
                //return the list of vitals observations so that a table can be generated
               // delete $scope.outcome.selectedResource;
               // delete $scope.outcome.selectedType;
               // delete $scope.outcome.allResourcesOfOneType;

                //toggle table...
                if ($scope.vitalsTable) {
                    delete $scope.vitalsTable;
                    return;
                }

                supportSvc.getVitals({patientId:appConfigSvc.getCurrentPatient().id}).then(
                    function(vo){
                        var codes = vo.vitalsCodes;     //an array of codes - todo: add display ?get from profile to allow adjustable table
                        var grid = vo.grid;             //obects where each property is a date (to become a colum
                        //get a list of dates
                        var dates = [];
                        angular.forEach(grid,function(item,date){
                            dates.push(date);
                        });
                        dates.sort(function(a,b){
                            if (b > a) {
                                return 1
                            } else {
                                return -1
                            }
                        });

                        //convert the data grid into one suitable for display - ie the dates (properties) as columns
                        $scope.vitalsTable = {rows:[],dates:[]};

                        var firstRow = true;
                        codes.forEach(function(code){
                            var row = {code:code.code,unit:code.unit,display:code.display,cols:[]};
                            //now, add a column for each date...
                            dates.forEach(function(date){
                                item = grid[date];
                                var v = '';
                                if (item[code.code]) {      //is there a value for this code on this date
                                    v = item[code.code].valueQuantity.value;
                                }
                                row.cols.push({value:v});
                                //add the date to the list of dates on the first row only
                                if (firstRow) {
                                    $scope.vitalsTable.dates.push(date);
                                }

                            });
                            firstRow = false
                            $scope.vitalsTable.rows.push(row);
                        });


                    }
                )
            };

        });

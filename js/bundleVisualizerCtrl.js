angular.module("sampleApp")
    .controller('bundleVisualizerCtrl',
        function ($scope,$uibModal,$http,v2ToFhirSvc,$timeout,modalService,apiService,
                  GetDataFromServer,$window,appConfigSvc,$localStorage,$q,moment,bundleVisualizerSvc,$sce) {


            //the window.search parameter is checked at the bottom of this controller. That ensures
            //all functions have been loaded...

            //used to display the HTML when displaying a document
            $scope.to_trusted = function(html_code) {
                return $sce.trustAsHtml(html_code);
            }

            //todo - get this from config
            let localhapiserver = "http://localhost:9090/fhir"

            $scope.input = {};

            $scope.maxForGraph = 100 //the maximum resources for which the full graph is generated.

            $scope.selectors = []
            $scope.selectors.push({display:"Paste Bundle",code:'paste'})
            $scope.selectors.push({display:"New Query",code:'query'})
            $scope.selectors.push({display:"Locally saved queries",code:'saved'})
            $scope.selectors.push({display:"Shared Library Queries",code:'library'})
            $scope.selectors.push({display:"Stored Library Bundles",code:'stored'})
            $scope.input.selectedSelector = $scope.selectors[0]


            //used for binary display
            $scope.base64Decode = function (b64) {
                if (b64) {
                    return atob(b64)
                }
            }

            $scope.ui = {}
            $scope.ui.tabEntries = 0
            $scope.setTab = {}          //for setting the tab from code

            $scope.moment = moment
            $scope.dataServer = $localStorage.dataServer || {url:"http://hapi.fhir.org/baseR4/"}
            $scope.validationServer = $localStorage.validationServer || appConfigSvc.getCurrentConformanceServer();

            $scope.showSelector = true; //at startup, show the selector

            function getHashCodeDEP(s) {
                //https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
                var hash = 0, i, chr;
                if (s.length === 0) return hash;
                for (i = 0; i < s.length; i++) {
                    chr   = s.charCodeAt(i);
                    hash  = ((hash << 5) - hash) + chr;
                    hash |= 0; // Convert to 32bit integer
                }
                return hash;
            }

            //queries now stored in local browser cache
            $scope.savedQueries = $localStorage.bvQueries || []
            $scope.localStorage = $localStorage     //so can easily update


            function getLibrarySummary() {
                $http.get('bvLibrary').then(
                    function (data) {
                        $scope.library = data.data
                    }, function (err) {
                        alert(angular.toJson(err))
                    }
                )
            }
            getLibrarySummary()


            //this is a list of bundles saved to the library
            function getListAllBundles() {
                $http.get('bv/getAllBundles').then(
                    function (data) {
                        $scope.libraryAllBundles = data.data
                    }, function (err) {
                        alert(angular.toJson(err))
                    }
                )
            }
            getListAllBundles()

            $scope.addBundleToLibrary = function () {
                $uibModal.open({
                    templateUrl: 'modalTemplates/addBundleEntry.html',
                    size: 'lg',
                    controller: function ($scope, bundle) {
                        $scope.input = {};

                        $scope.save = function () {
                            let vo = {name:$scope.input.name,description:$scope.input.description,author:$scope.input.author}
                            $scope.$close(vo)
                        }

                    },
                    resolve : {
                        bundle : function(){
                            return $scope.fhir
                        }
                    }
                }).result.then(function (vo) {
                    let entry = {}
                    entry.id = `bv${new Date().getTime()}`
                    entry.date = new Date()
                    entry.name = vo.name
                    entry.description = vo.description
                    entry.author = vo.author
                    entry.bundle = $scope.fhir
                    entry.active = true //means this will appear in the main selection list


                    $http.post('bv/saveBundle',entry).then(
                        function () {
                            getListAllBundles()
                            alert("Bundle has been saved in the Library")
                        }, function (err) {
                            alert(angular.toJson(err.data))
                        }

                    )


                })

            }




            //when the 'add to library' link is clicked in saved queries.
            //todo - may want to add authentication
            //todo - may want snapshot of bundle rather than live link
            //todo - may add a modal to update description, add category etc
            $scope.addLinkToLibrary = function (item) {
                if (confirm("Are you sure you want to add this link to the Library? Any other user will be able to execute it...")) {
                    item.type = 'link'

                    $http.post('bvLibrary',item).then(
                        function (data) {
                            alert("Link has been added to the Library")
                            item.inLibrary = true   //saved in localStorage so will update
                            getLibrarySummary()
                        }, function (err) {
                            alert(angular.toJson(err))
                        }
                    )
                }



            }

            $scope.executeLibraryQuery = function (item) {
                //todo - keep separate from executeSavedQuery as we want to support 'snapshotted' bundles in the future
                let newQry = `proxyRequest?qry=${encodeURIComponent(item.qry)}`
                $http.get(newQry).then(
                    function (data) {
                        let bundle = data.data
                        if (bundle.resourceType !== 'Bundle' || ! bundle.entry || bundle.entry.length < 1 ) {
                            alert("Must return a Bundle with at least one entry")
                        } else {
                            processBundle(data.data)

                        }

                    }, function (err) {
                        alert("Unable to access the Library")
                        //alert(angular.toJson(err))

                    }
                )
            }


            //performs bundle using local hapi server
            $scope.performValidation = function(){
                validate($scope.fhir,$scope.validationServer.url,function(hashErrors){
                    $scope.hashErrors = hashErrors;
                })
            }

            //validate the resources in the bundle, then draw the graph (which needs the errors to display)
            let processBundle = function(oBundle,validationServer) {

                delete $scope.hashErrors
                // $scope.CarePlans = []       //a list of all Careplans in the bundle (

                $scope.DR = []          //list of DiagnosticReports
                $scope.encounters = []
                delete $scope.selectedDeepValidationEntry
                delete $scope.deepValidationResult

                $scope.showSelector = false     //hide the selector

                delete $scope.serverRoot;
                $scope.fhir = oBundle;

                //now that we have a local hapi server this is much faster
                $scope.performValidation()

                $scope.isDocument = false


                //create a hash for bundle by name
                $scope.hashByName = {}
                $scope.hashByRef = {}       //the target of a reference {type}/{id}
                if (oBundle.entry) {
                    oBundle.entry.forEach(function(entry) {
                        let resource = entry.resource;

                        if (resource.resourceType == "Composition") {
                            $scope.isDocument = true
                        }

                        if (resource.resourceType == "CarePlan") {
                            // $scope.CarePlans.push(entry)
                        }

                        if (resource.resourceType == "Encounter") {
                            //$scope.encounters.push(entry)
                        }

                        if (resource.resourceType == "DiagnosticReport") {
                            $scope.DR.push({DR:entry.resource})
                        }

                        $scope.hashByName[resource.resourceType] = $scope.hashByName[resource.resourceType] || []
                        $scope.hashByRef[resource.resourceType + "/" + resource.id] = resource
                        if (resource.name) {
                            let item = {entry:entry}
                            item.display = resource.name;     //todo - maybe check datatype?
                            $scope.hashByName[resource.resourceType].push(item)
                        }
                    })

                    if ($scope.DR.length > 0) {
                        $scope.DR.forEach(function (item) {
                            let vo = bundleVisualizerSvc.makeDRSummary(item.DR,$scope.hashByRef)
                            item.obs = vo.obs
                        })
                    }

                    /*
                                        if ($scope.CarePlans.length > 0) {
                                            $scope.cpSummary = bundleVisualizerSvc.makeCarePlanSummary($scope.CarePlans,$scope.hashByRef)
                                        }
                    */
                    Object.keys($scope.hashByName).forEach(function (k,v) {
                        let ar = $scope.hashByName[k]
                        ar.sort(function(a,b){
                            if (a.display > b.display) {
                                return 1
                            } else {
                                return -1
                            }
                        })
                    })
                }

                //hash of observations by code
                $scope.hashObservations = v2ToFhirSvc.makeObservationsHash(oBundle)


                //create hash by type
                $scope.hashEntries = {}

                if (oBundle.entry) {
                    oBundle.entry.forEach(function(entry) {
                        let resource = entry.resource;
                        if (resource) {
                            let type = resource.resourceType;
                            $scope.hashEntries[type] = $scope.hashEntries[type] || []
                            $scope.hashEntries[type].push(entry)
                        }
                    })

                    //sorted by type
                    $scope.sortedEntries = []
                    Object.keys($scope.hashEntries).forEach(function (key) {
                        let h = $scope.hashEntries[key]
                        $scope.sortedEntries.push({type:key,entries:h})
                    })
                    $scope.sortedEntries.sort(function (a,b){
                        if (a.type > b.type) {
                            return 1
                        } else {
                            return -1
                        }
                    })

                }



                //------------- construct the graph based on canonical references
                let vo = v2ToFhirSvc.makeGraphCanonical(oBundle)
                $scope.hashRefsByResource = vo.hashRefsByResource;  //the set of canonical resources from this resource
                delete $scope.isCanonical
                if (Object.keys($scope.hashRefsByResource).length > 0) {
                    $scope.isCanonical = true

                    var container = document.getElementById('canonicalGraph');
                    var graphOptions = {
                        physics: {
                            enabled: true,
                            barnesHut: {
                                gravitationalConstant: -10000,
                            }
                        }
                    };
                    $scope.canonicalGraph = new vis.Network(container, vo.graphData, graphOptions);
                    $scope.canonicalGraph.on("click", function (obj) {

                        var nodeId = obj.nodes[0];  //get the first node
                        var node = vo.graphData.nodes.get(nodeId);
                        $scope.selectedCanResource = node.resource;
                        $scope.$digest();
                    });
                }





                //---------- draw the main graph


                //the serverRoot is needed to figure out the references when the reference is relative
                //we assume that all the resources are from the same server, so figure out the server root
                //by looking at the first fullUrl (remove the /{type}/{id} at the end of the url

                let serverRoot = "";
                if ($scope.fhir && $scope.fhir.entry) {
                    //work out the server root from the first entry
                    let first = $scope.fhir.entry[0]
                    if (first && first.fullUrl) {
                        let fullUrl = first.fullUrl

                        let serverRoot
                        //the 'serverRoot' may actually be urn:uuid: - meaning that GUIDs are in play, or may be an actual server base address
                        if (fullUrl.indexOf("urn:uuid:") > -1) {
                            //not a server
                            // serverRoot = ""  //fullUrl.substr(8)      //strip off the guid
                        } else {
                            let ar = first.fullUrl.split('/')
                            ar.pop();
                            ar.pop();
                            serverRoot = ar.join('/') + "/"

                        }

                        $scope.serverRoot = serverRoot;

                    } else {
                        //todo - do we really need the fullUrl
                        // alert('All entries need the fullUrl for the graph generation to work properly. The graph may be incomplete..')

                    }
                }


                let options = {bundle:$scope.fhir,hashErrors:$scope.hashErrors,serverRoot:serverRoot}
                drawGraph(options)

                let bundle = angular.copy(oBundle)


                //------ make the document summary object for display
                delete $scope.document;     //contains the document specific resources suitable for layout

                if (bundle.type == 'document' || $scope.isDocument) {
                    $scope.document = bundleVisualizerSvc.makeDocument(bundle, $sce)
                }
                /*
                if (bundle.type == 'document' || $scope.isDocument) {
                    let arComposition = [];

                    //create a hash by type & id - to find document references
                    let hash = {};

                    bundle.entry.forEach(function (entry) {
                        if (entry.resource) {


                            let key;

                            //if the id is an oid (entry.fullUrl has urn:uuid:) then reference will just be the oid
                            if (entry.fullUrl?.indexOf('urn:uuid:') > -1) {
                                key = entry.fullUrl
                            } else {
                                key = entry.resource.resourceType + "/" + entry.resource.id
                            }

                            //key = entry.resource.resourceType + "/" + entry.resource.id //temp

                            hash[key] = entry.resource;

                            if (entry.resource.resourceType == 'Composition') {
                                arComposition.push(entry.resource)
                            }
                        }

                    });


                    switch (arComposition.length) {
                        case 0 :
                            alert('This is a document, but there is no Composition resource')
                            break;
                        case 1 :
                            $scope.document = {composition : arComposition[0]};
                            break;
                        default:
                            alert('There were '+arComposition.length + ' Composition resources, and there should only be 1')
                    }

                    //if there's exactly one composition...
                    if ($scope.document.composition) {
                        //now get the subject
                        if ($scope.document.composition.subject) {
                            if ($scope.document.composition.subject.reference) {

                                //the reference won't
                                $scope.document.subject = hash[$scope.document.composition.subject.reference];

                                if (!$scope.document.subject) {
                                    alert('The subject reference from Composition ('+$scope.document.composition.subject.reference+') is not in the bundle')
                                }
                            } else {
                                alert('The composition resource is missing the subject reference')
                            }
                        } else {
                            alert('The composition resource is missing the subject property')
                        }

                        //get the resources referenced from the composition
                        $scope.document.sectionResources = []

                        if ($scope.document.composition.section) {
                            $scope.document.composition.section.forEach(function(section,inx){
                                //let section = angular.copy(oSection)
                                section.realResources = []
                                if (section.entry) {
                                    section.entry.forEach(function (entry) {
                                        let resource = hash[entry.reference]
                                        if (resource) {
                                            //todo check for list
                                            let item = {display:resource.resourceType,resource:resource}

                                            const json = angular.toJson(resource, true);
                                            const html = `<pre>${json}</pre>`;
                                            item.trustedPopover = $sce.trustAsHtml(html);

                                            section.realResources.push(item)


                                        } else {
                                            section.realResources.push({display:'unknown reference:'+entry.reference})
                                        }

                                    })
                                }


                            })


                        }

                    }
                }

                console.log(angular.copy($scope.document))

                console.log(bundleVisualizerSvc.makeDocument (bundle,$sce) )


              */

            };




            $scope.selectDRObs = function(obs) {
                $scope.selectedDRObservation = obs
            }


            $scope.selectSection = function(section) {
                delete $scope.selectedEntryFromSection
                $scope.selectedSection = section
            }

            $scope.selectEntryFromSection = function(oReference) {
                let reference = oReference.reference;
                $scope.selectedEntryFromSection = $scope.hashByRef[reference]
            }

            $scope.popoverText = function (adHoc) {

                let json = angular.toJson(adHoc,true)
                let rawHtml = `<pre>${json}</pre>`
                return $sce.trustAsHtml(rawHtml);


            }

            $scope.selectResourceFromRender = function(resource) {
                $scope.selectedResourceFromRender = resource.resource
            }

            //-------- related to queries
            $scope.testNewQuery = function(qry) {

                //If the full server is not set then use the local hapi server
                if (qry.indexOf('http') == -1) {
                    qry = `${localhapiserver}/${qry}`
                }


                delete $scope.executedQueryBundle

                let newQry = `proxyRequest?qry=${encodeURIComponent(qry)}`
                $scope.waiting = true
                $http.get(newQry).then(
                    function (data) {
                        $scope.waiting = false
                        let bundle = data.data
                        if (bundle.resourceType !== 'Bundle' || ! bundle.entry || bundle.entry.length < 1 ) {
                            alert("Must return a Bundle with at least one entry")
                        } else {
                            $scope.executedQueryBundle = data.data;
                        }

                    }, function (err) {
                        $scope.waiting = false
                        alert("Unable to get any response from that Query. Is it a complete query - including the 'http' ?")
                        //alert(angular.toJson(err))

                    }
                )

/*
                return


                if (qry.substr(0,4) !== 'http') {
                    qry = $scope.dataServer.url + qry
                }
                $scope.executedQuery = qry




                let proxiedQuery = "proxyfhir/" + qry
                //$http.get(qry).then(
                $http.get(proxiedQuery).then(
                    function (data) {
                        //todo - same logic as when query supplied - might be to a FHIR server or not
                        let bundle = data.data
                        if (bundle.resourceType !== 'Bundle' || ! bundle.entry || bundle.entry.length < 1 ) {
                            alert("Must return a Bundle with at least one entry")
                        } else {
                            $scope.executedQueryBundle = data.data;
                        }


                    },
                    function (err) {
                        alert(angular.toJson(err))
                    }
                )
                */
            }



            $scope.clearQuery = function() {
                delete $scope.input.newQuery
                delete $scope.executedQuery
                delete $scope.executedQueryBundle
            }

            $scope.addNewQuery = function(qry,name,description) {

                $localStorage.bvQueries = $localStorage.bvQueries || []
                let newQuery = {name: name,qry: qry ,description:description}

                $localStorage.bvQueries.push(newQuery)
                $scope.savedQueries = $localStorage.bvQueries   //update the UI todo - don't really need 2 vars...

                processBundle($scope.executedQueryBundle);      //set when the query is tested

            }

            $scope.viewNewQueryBundle = function(bundle) {
                processBundle(bundle);
            }

            $scope.executeSavedQuery = function (item) {
                let newQry = `proxyRequest?qry=${encodeURIComponent(item.qry)}`
                $scope.waiting = true
                $http.get(newQry).then(
                    function (data) {
                        $scope.waiting = false
                        let bundle = data.data
                        if (bundle.resourceType !== 'Bundle' || ! bundle.entry || bundle.entry.length < 1 ) {
                            alert("Must return a Bundle with at least one entry")
                        } else {
                            processBundle(data.data)

                        }

                    }, function (err) {
                        $scope.waiting = false
                        alert("Unable to access the Library")
                        //alert(angular.toJson(err))

                    }
                )



            }

            $scope.displaySavedBundle = function(item) {
                processBundle(item.bundle)
            }

            //------- passed a bundle in json or xml ------

            $scope.viewNewBundle = function(bundle,name) {
                //view a bundle directly. If 'name' is not null, then save for this user


                let json
                if (bundle.substr(0,1) == "<") {
                    //assume this is xml
                    $http.post('transformJson',bundle).then(
                        function(data) {
                            json = data.data

                            process(json,name)
                        },
                        function(err) {
                            console.log(err)
                            alert(err.data.message)
                        }
                    )
                } else {
                    //assume this is json
                    try {
                        json = angular.fromJson(bundle)

                    } catch (ex) {
                        alert("Must be a valid Json bundle")
                        return;
                    }


                    try {
                        process(json,name)
                    } catch (ex) {
                        alert("Unable to parse - not a valid FHIR bundle")
                    }

                }



                }
                function process(json,name) {

                    // $scope.showSelector = false
                    processBundle(json);


            }




            //show or hide the patient in the main graph
            $scope.showHidePatient = function(toggle) {

                let options = {bundle:$scope.fhir,hashErrors:$scope.hashErrors,serverRoot:$scope.serverRoot}
                options.hidePatient = toggle;
                drawGraph(options)

            };


            //will update the config. We don't care if manually entered servers are lost or the default servers changed
            if (appConfigSvc.checkConfigVersion()) {
                alert('The config was updated. You can continue.')
            }



            //pre-defined queries
            $scope.queries = [];

            //inward and outwards references in graph

            $scope.input.showInRef = true;
            $scope.input.showOutRef = true;

            if ($localStorage.bvQueries) {
                $scope.queries = $localStorage.bvQueries
            }


            $scope.queryPopover = function(query) {
                let result = query.query
                if (query.description) {
                    result += " ("+query.description + ")"
                }
                return result

            };

            $scope.deleteQuery = function(inx) {
                if (confirm('Are you sure you wish to remove this query from your local store?')){
                    $localStorage.bvQueries.splice(inx,1)
                }

            };

            $scope.changeServerDEP = function(type) {
                $uibModal.open({
                    templateUrl: 'modalTemplates/setBVServer.html',
                    size: 'lg',
                    controller: function ($scope,allServers,serverType) {
                        $scope.input = {};
                        $scope.serverType = serverType



                        $scope.checkServer = function(url) {
                            $scope.canSave = false
                            if (url.substr(url.length -1) !== '/') {
                                url += '/';
                                $scope.input.url += '/'
                            }
                            url += "metadata";
                            $http.get(url).then(
                                function(data) {
                                    if (data.data && data.data.resourceType == 'CapabilityStatement' ) {
                                        $scope.canSave = true
                                    } else {
                                        alert("This url did not return a CapabilityStataement from "+ url)
                                    }
                                },
                                function (err) {
                                    alert("This url did not return a CapabilityStatement from "+ url)
                                }
                            )


                        }

                        $scope.allServers = allServers;

                        $scope.setServer = function(svr) {

                            $scope.input.url = svr.url
                            $scope.input.name = svr.name
                            $scope.canSave = true
                        }

                        $scope.save = function() {
                            let name = $scope.input.name || "User defined"
                            let svr = {name:name,url:$scope.input.url}
                            $scope.$close(svr)
                        }

                    },
                    resolve : {

                        allServers : function(){
                            return appConfigSvc.getAllServers();
                        },
                        serverType : function() {
                            return type
                        }
                    }
                }).result.then(
                    function(svr) {
                        switch (type) {
                            case "validation" :
                                $localStorage.validationServer = svr;
                                $scope.validationServer = svr;
                                break
                            case "data" :
                                $localStorage.dataServer = svr;
                                $scope.dataServer = svr;
                                break
                        }


                    }
                )

            };

            $scope.selectBundleEntry = function(entry,entryErrors) {
                delete $scope.selectedFromSingleGraph;  //does this need to be done?

                delete $scope.selectedFshFromSingleGraph

                let resourceId = entry.resource.id

                $scope.selectedBundleEntryErrors = []     //an array of errors for this entry
                //only if the bundle has been validated
                if ($scope.validationResult) {
                    for (const iss of $scope.validationResult.issue) {
                        let loc = iss.location[0]
                        const match = loc.match(/\[(\d+)\]/);
                        const firstIndex = match ? parseInt(match[1], 10) : null;
                        if (firstIndex !== null) {

                            const resource = $scope.fhir.entry[firstIndex].resource
                            if (resource.id == resourceId) {
                                $scope.selectedBundleEntryErrors.push(iss)
                            }
                        }
                    }

                }


                $scope.selectedFromSingleGraph = entry.resource
                delete $scope.fshText
                delete $scope.xmlText
                $scope.selectedBundleEntry = entry


                $scope.createGraphOneEntry();


                $http.post("./fsh/transformJsonToFsh",entry.resource).then(
                    function(data) {
                        try {
                            let response = data.data

                            //as the FSH transform is so slow, need to be sure the resource is still selected
                            if (response.resourceId == $scope.selectedBundleEntry.resource.id) {
                                $scope.fshText = response.fsh

                            } else {
                                console.log("Ignoring response for "+ response.resourceId)
                            }
                        } catch (ex) {
                            console.error(angular.toJson(ex))
                            $scope.fshText = "Unable to transform into FSH"
                        }
                    }, function(err) {
                        console.log("FSH Transform error")
                    }
                )


/*

                apiService.postWithCancel('fsh/transformJsonToFsh', entry.resource)
                  .then(response => {

                      try {
                          let response = data.data
                          $scope.fshText = response.fsh.instances[entry.resource.id]
                          if (response.fsh.aliases) {
                              $scope.fshText = response.fsh.aliases + "\n\n" +$scope.fshText
                          }


                      } catch (ex) {
                          $scope.fshText = "Unable to transform into FSH"
                      }


                  })
                  .catch(error => {
                    if (error && error.status === -1) {
                      console.log('Previous POST canceled');
                    } else {
                      console.error('POST failed:', error);
                    }
                  });
*/

                //get the FSH of the resource
                /*
                $http.post("fsh/transformJsonToFsh",entry.resource).then(
                    function(data) {
                        //console.log(data.data)
                        try {
                            let response = data.data
                            $scope.fshText = response.fsh.instances[entry.resource.id]
                            if (response.fsh.aliases) {
                                $scope.fshText = response.fsh.aliases + "\n\n" +$scope.fshText
                            }


                        } catch (ex) {
                            $scope.fshText = "Unable to transform into FSH"
                        }

                    }, function(err) {
                        console.log("FSH Transform error")

                    }
                )
                */

                //get the Xml
                $http.post("transformXML",entry.resource).then(
                    function(data) {

                        try {
                            $scope.xmlText = vkbeautify.xml(data.data)
                        } catch (ex) {
                            $scope.xmlText = "Unable to transform into XML"
                        }

                    }, function(err) {
                        console.log("Xml Transform error")

                    }
                )

                let treeData = v2ToFhirSvc.buildResourceTree(entry.resource);

                //show the tree structure of this resource (adapted from scenario builder)
                $('#builderResourceTree').jstree('destroy');
                $('#builderResourceTree').jstree(
                    {'core': {'multiple': false, 'data': treeData, 'themes': {name: 'proton', responsive: true}}}
                )

            };

            $scope.createGraphOneEntry = function(){



                if (!$scope.selectedBundleEntry) {
                    return;
                }

                let primaryResourceId = $scope.selectedBundleEntry.resource?.id    //will be the primary resource

                //the fullUrl is a default ?if it exists should we onlt use that???
                let url = $scope.selectedBundleEntry.fullUrl;// || resource.resourceType + "/" + resource.id;
                if (!url) {
                    //If the resource has an id, then construct the url from that.
                    //If a serverRoot has been passed in, then make the url an absolute one.
                    let resource = $scope.selectedBundleEntry.resource;
                    if (resource.id) {
                        if ($scope.serverRoot) {
                            url = $scope.serverRoot + resource.resourceType + "/" + resource.id;
                        } else {
                            url = resource.resourceType + "/" + resource.id;
                        }
                    }
                } else {
                    //if there is a full url, then strip of any guid marker
                    //  2022-10-25 - why do this? url = url.replace("urn:uuid:","")
                }

                let options = {bundle:$scope.fhir,
                    hashErrors:$scope.hashErrors,
                    serverRoot:$scope.serverRoot,
                    primaryResourceId : primaryResourceId,
                    centralResourceId:url}

                options.showInRef = $scope.input.showInRef;
                options.showOutRef = $scope.input.showOutRef;
                options.recursiveRef = $scope.input.recursiveRef;
                options.hidePatient = $scope.input.showHidePatient;

                let vo = v2ToFhirSvc.makeGraph1(options);
                $scope.graphErrors = vo.lstErrors


                let container = document.getElementById('singleResourceGraph');


                let graphOptions = {
                    physics: {
                        enabled: true,
                        barnesHut: {
                            gravitationalConstant: -10000,
                            centralGravity: 0.3,
                            springLength: 120,
                            springConstant: 0.04,
                            damping: 0.09,
                            avoidOverlap: 0.2
                        },
                        stabilization: {
                            iterations: 200,   // try lowering from default (1000)
                            updateInterval: 25
                        }

                    }
                }

                $scope.singleResourceChart = new vis.Network(container, vo.graphData, graphOptions);

                // 🚀 Turn off physics after initial layout
                $scope.singleResourceChart.once('stabilizationIterationsDone', function () {
                    $scope.singleResourceChart.setOptions({ physics: false });
                });


                $scope.singleResourceChart.on("doubleClick", function (obj) {
                   // delete $scope.selectedFshFromSingleGraph
                    var nodeId = obj.nodes[0];  //get the first node
                    var node = vo.graphData.nodes.get(nodeId);

                    $scope.selectFromSingleGraph()
                })


                let fshResourceId //must be declared outside the function
                let clickNodeId;
                $scope.singleResourceChart.on("click", function (obj) {

                    var nodeId = obj.nodes[0];  //get the first node
                    //multiple clicks or double click
                    if (nodeId == clickNodeId) {
                        return
                    }
                    delete $scope.selectedFshFromSingleGraph
                    clickNodeId = nodeId
                    var node = vo.graphData.nodes.get(nodeId);

                    $scope.selectedFromSingleGraph = node.resource;
                    fshResourceId = $scope.selectedFromSingleGraph.id


/*
                    apiService.postWithCancel('fsh/transformJsonToFsh', node.resource)
                        .then(response => {
                            console.log('Server response:', response.data);
                            try {
                                let resp = response.data
                                $scope.selectedFshFromSingleGraph = resp.fsh.instances[node.resource.id]
                                if (resp.fsh.aliases) {
                                    $scope.selectedFshFromSingleGraph = resp.fsh.aliases + "\n\n" +$scope.selectedFshFromSingleGraph
                                }


                            } catch (ex) {
                                console.error(ex)
                                $scope.selectedFshFromSingleGraph = "Unable to transform into FSH"
                            }

                        })
                        .catch(error => {
                            if (error && error.status === -1) {
                                console.log('Previous POST canceled');
                            } else {
                                console.error('POST failed:', error);
                            }
                        });

*/

                    //create FSH of selected resource
                    $http.post("./fsh/transformJsonToFsh",node.resource).then(
                        function(data) {
                            try {
                                let response = data.data

                                if (response.resourceId == fshResourceId) {
                                    $scope.selectedFshFromSingleGraph = response.fsh

                                } else {
                                    console.log("Ignoring response for "+ response.resourceId)
                                }
                            } catch (ex) {
                                alert(angular.toJson(ex))
                                $scope.selectedFshFromSingleGraph = "Unable to transform into FSH"
                            }
                        }, function(err) {
                            console.log("FSH Transform error")
                        }
                    )





                    $scope.$digest();
                });


            };


            //From the 'references graph' when a resource is clicked, then selected for view in bundle entries tab
            //use in other places as well
            $scope.selectFromMainGraph = function (resource){
                $scope.fhir.entry.forEach(function (entry){
                    if (entry.resource && (entry.resource.id == resource.id)) {
                        $scope.selectBundleEntry (entry,[])
                        $scope.setTab.mainTabActive = $scope.ui.tabEntries
                    }
                })
            }



            //when a resource has been selected from the 'single resource' graph
            //just shows the details - already on the details tab!
            $scope.selectFromSingleGraph = function(resource) {

                resource = resource || $scope.selectedFromSingleGraph
                // fhir.entry - all entries in bundle
                // $scope.selectedBundleEntry - current bundle entry being displayed
                // $scope.selectedFromSingleGraph - resource selected from graph
                if (resource) {
                    $scope.fhir.entry.forEach(function (entry){
                        if (entry.resource && (entry.resource.id == resource.id)) {
                            //$scope.selectedBundleEntry = entry
                            $scope.selectBundleEntry (entry,[])
                        }
                    })
                }
            }

            $scope.fitSingleGraph = function(){
                $timeout(function(){
                    if ($scope.singleResourceChart) {
                        $scope.singleResourceChart.fit();

                    }
                },1000)

            };

            $scope.fitCanonicalGraph = function(){
                $timeout(function(){
                    if ($scope.canonicalGraph) {
                        $scope.canonicalGraph.fit();

                    }
                },2000)

            };

            $scope.fitGraph = function(){
                $timeout(function(){
                    if ($scope.chart) {
                        $scope.chart.fit();
                    }
                },1000)
            };

            $scope.selectBundleFromListDEP = function(entry) {
                delete $scope.selectedBundleEntryErrors;
                delete $scope.selectedBundleEntry;

                $scope.selectedEntry = entry;
                processBundle(entry.resource);

            };

            $scope.selectObservationCode = function(item) {

                $scope.selectedObservations = item.resources
            }

            $scope.selectObservation = function(obs){
                $scope.selectedObservation = obs
            }

            $scope.selectResourceFromSection = function(ref){
                $scope.selectedRef = ref        //to highlight under sections
                $scope.resourceFromSection = $scope.hashByRef[ref]
            }



            function drawGraph(options) {

                //>>>>>>>>>>>> this i sthe new graph routine....
                let vo = v2ToFhirSvc.makeGraph1(options)

                $scope.graphErrors = vo.lstErrors

                $scope.showGraphWarning = true
                var container = document.getElementById('resourceGraph');

                let graphOptions = {
                    physics: {
                        enabled: true,
                        barnesHut: {
                            gravitationalConstant: -10000,
                            centralGravity: 0.3,
                            springLength: 120,
                            springConstant: 0.04,
                            damping: 0.09,
                            avoidOverlap: 0.2
                        },
                        stabilization: {
                            iterations: 200,   // try lowering from default (1000)
                            updateInterval: 25
                        }
                    }
                };

                var graphOptionsDEP = {
                    physics: {
                        enabled: true,
                        barnesHut: {
                            gravitationalConstant: -10000,
                        }
                    }
                };


                delete  $scope.noFullGraph
                if ($scope.fhir.entry.length < $scope.maxForGraph) {
                    $scope.chart = new vis.Network(container, vo.graphData, graphOptions);

                    $scope.chart.on("click", function (obj) {

                        var nodeId = obj.nodes[0];  //get the first node
                        var node = vo.graphData.nodes.get(nodeId);
                        $scope.selectedNode = node;

                        //this is the entry that is selected from the 'bundle entries' tab...
                        $scope.selectedBundleEntry = node.entry;

                        $scope.$digest();
                    });

                    $scope.chart.on("doubleClick", function (obj) {

                        const nodeId = obj.nodes[0];  //get the first node
                        const node = vo.graphData.nodes.get(nodeId);

                        
                        $scope.selectFromMainGraph(node.entry.resource)
                    })





                    //https://stackoverflow.com/questions/32403578/stop-vis-js-physics-after-nodes-load-but-allow-drag-able-nodes
                    $scope.chart.on("stabilizationIterationsDone", function () {
                        delete $scope.showGraphWarning
                        $scope.chart.setOptions( { physics: false } );
                    });


                } else {
                    $scope.noFullGraph = true
                }


            }




            //validate each entry
            $scope.getResourceFromIssue = function (iss) {
                $scope.selectedIssue = iss

                // "Bundle.entry[0].resource.section[5].text.div",
                let loc = iss.location[0]

                const match = loc.match(/\[(\d+)\]/);
                const firstIndex = match ? parseInt(match[1], 10) : null;

                if (firstIndex !== null) {
                    $scope.issueResource = $scope.fhir.entry[firstIndex].resource
                }




            }

            //used by bundle validate
            let validate = function(resource) {
                let hashErrors = {};    //related to position in bundle...
                $http.post("validate",resource).then(
                    function (data) {

                        //this is an OO
                        $scope.validationResult = data.data
                        let issues = data.data.issue
                        $scope.validationResult.issue = []

                        //remove all the 'should have text element' errors
                        const exclude = "dom-6:"
                        issues = issues.filter(item => !item.diagnostics.includes(exclude));


                        //create a hash by resource id
                        $scope.errorsByResource = {}
                        $scope.allErrors = []

                        for (const iss of issues) {
                            let loc = iss.location[0]

                            const match = loc.match(/\[(\d+)\]/);
                            const firstIndex = match ? parseInt(match[1], 10) : null;

                            if (firstIndex !== null) {
                                if (firstIndex > $scope.fhir.entry.length) {
                                    console.error(`Theres an issue with a location of ${loc} but there are only ${$scope.fhir.entry.length} entries  in the bundle`)
                                } else {
                                    const resource = $scope.fhir.entry[firstIndex].resource
                                    $scope.validationResult.issue.push(iss)

                                    $scope.errorsByResource[resource.id] = $scope.errorsByResource[resource.id] || {resource:resource,issues:[]}
                                    $scope.errorsByResource[resource.id].issues.push(iss)
                                }
                            } else {
                                $scope.errorsByResource["Bundle"] = $scope.errorsByResource["Bundle"] || {resource:resource,issues:[]}
                                $scope.errorsByResource["Bundle"].issues.push(iss)
                            }
                        }
                    }, function (err) {
                        console.log(err)
                    }
                )



            }

            let validateBundleDEPDEP = function(bundle) {
                delete $scope.bundleValidationResult
                let url = $scope.validationServer.url + "Bundle/$validate";
                $http.post(url,bundle).then(
                    function(data) {

                        $scope.bundleValidationResult= data.data;


                    },function(err) {
                        console.log(err)
                        $scope.bundleValidationResult = err.data;

                    }
                )

            }



            //perform a validation of the resources in the bundle...
            let validateBundleDEP = function(bundle,cb) {

                let url = $scope.validationServer.url + "Bundle/$validate";


                //bundle validation...
                $scope.waiting = true;
                //delete $scope.hashErrors;
                $http.post(url,bundle).then(
                    function(data) {

                        $scope.validationResult = data.data;


                    },function(err) {
                        console.log(err)
                        $scope.validationResult = err.data;

                    }
                ).finally(
                    function () {
                        $scope.waiting = false;

                        //count of errors for each resource
                        let hashErrors = {};
                        $scope.validationResult.issue.forEach(function (issue) {
                            if (issue.location) {
                                let g1 = issue.location[0].indexOf('[')
                                let g2 = issue.location[0].indexOf(']')
                                if (g1 && g2) {
                                    let inx = issue.location[0].substr(g1+1,g2-g1-1)

                                    hashErrors[inx-1] = hashErrors[inx-1] || [];


                                    if (issue.location) {
                                        issue.location.forEach(function (loc,inx) {

                                            let ar = loc.split('.');
                                            ar.splice(0,3);
                                            issue.location[inx] = ar.join('.')

                                        })
                                    }



                                    hashErrors[inx-1].push(issue)
                                }
                            }
                        });

                        cb(hashErrors)


                        if ($scope.validationResult || $scope.validationResult.issue) {
                            $scope.valErrors = 0, $scope.valWarnings=0;

                            $scope.validationResult.issue.forEach(function(iss){
                                if (iss.severity == 'error') {
                                    $scope.valErrors++
                                } else {
                                    $scope.valWarnings++
                                }
                            })

                        }


                    }
                )


            };

            $scope.copyToClipboard = function(){
                if ($scope.fhir) {
                    //https://stackoverflow.com/questions/29267589/angularjs-copy-to-clipboard
                    var copyElement = document.createElement("span");
                    copyElement.appendChild(document.createTextNode(angular.toJson($scope.fhir),2));
                    copyElement.id = 'tempCopyToClipboard';
                    angular.element(document.body.append(copyElement));

                    // select the text
                    var range = document.createRange();
                    range.selectNode(copyElement);
                    window.getSelection().removeAllRanges();
                    window.getSelection().addRange(range);

                    // copy & cleanup
                    document.execCommand('copy');
                    window.getSelection().removeAllRanges();
                    copyElement.remove();

                    alert("The bundle has been copied to the clipboard.")
                }

            };

            //has a query been passed in. Used by BundleVisualizer to pass across a bundle
            let search = $window.location.search;
            //processBundle must be before search

            if (search) {
                //for now, assume the search is in the format bundleid={id}
                //we can enhance it if the needs grow
                let s = search.substr(1); //remove the leading '?'
                let ar = s.split('&')
                for (let p of ar) {
                    let ar1 = p.split('=')
                    if (ar1[0] == 'bundleid') {
                        let bundleid = ar1[1]
                        let qry = `bv/getBundle/${bundleid}`
                        $http.get(qry).then(
                            function (data) {
                                let vo = data.data

                                if (vo.bundle.entry?.length > 0) {
                                    $scope.urlPassedIn = true;  //flag that the bundle is to be retreived and displayed - not the selector
                                    //if the first entry in the bundle is a Bundle, then this must be a bundle of bundles from a FHIR server. Select it
                                    processBundle(vo.bundle)
                                }

                            }, function (err) {
                                alert(angular.toJson(err))
                            }
                        )
                        break
                    }
                }


                return


                search = decodeURIComponent(search)

                console.log(search)

                let qry = search.substr(1); //remove the leading '?'
                //this proxy simply returns the servers response - it doesn't need to be a Bundle and any paging is ignored
                let newQry = `proxyGet?qry=${encodeURIComponent(qry)}`
                console.log(newQry)
                //todo if keep then use new proxy EP
                $http.get(newQry).then(
                    function (data) {
                        //So this could either be a bundle, or a response from the /bv/getBundle/:id
                        //call used by graphbuilder - an object that conatins a bundle

                        //so the response . We'll just grab the first one...
                        let response = data.data;

                        console.log(response)

                        let bundle


                        if (response.resourceType =='Bundle') {
                            bundle = response
                        } else if (response.bundle) {
                            bundle = response.bundle
                        } else {
                            alert("Response needs to either be a bundle, or an obect with an element called 'bundle'")
                            return
                        }

                        if (bundle.entry?.length > 0) {
                            $scope.urlPassedIn = true;  //flag that the bundle is to be retreived and displayed - not the selector
                            //if the first entry in the bundle is a Bundle, then this must be a bundle of bundles from a FHIR server. Select it
                            processBundle(bundle)
                            /*
                            if (response.entry[0].resource.resourceType == 'Bundle') {
                               // $scope.toggleSidePane();    //hide the sidepane
                                processBundle(response.entry[0].resource)
                            } else {
                                //the first entry is not a Bundle - just process it
                             //   $scope.toggleSidePane();    //hide the sidepane
                                processBundle(response)
                            }
*/
                        }


                    },
                    function(err) {
                        alert("Sorry, the query '"+ qry +"' couldn't be executed")

                    }
                )

            } else {
                //nothing passed in when the app was started- read bundles from the defined server

            }
        }
    );
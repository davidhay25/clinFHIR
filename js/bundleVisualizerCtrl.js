angular.module("sampleApp")
    .controller('bundleVisualizerCtrl',
        function ($scope,$uibModal,$http,v2ToFhirSvc,$timeout,modalService,
                  GetDataFromServer,$window,appConfigSvc,$localStorage,$q,moment,bundleVisualizerSvc,$sce) {


            //used to display the HTML when displaying a document
            $scope.to_trusted = function(html_code) {
                return $sce.trustAsHtml(html_code);
            }

            //$scope.btoa = btoa

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

            function getHashCode(s) {
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
            //$scope.bvConfig = $localStorage.bvConfig || {}

            $scope.localStorage = $localStorage     //so can easily update

            //default to no validation
            if (! $localStorage.bvConfig) {
                $localStorage.bvConfig = {noValidate : true}
            }

            //turn off autovalidation - todo - remove all references when loading...
            $localStorage.bvConfig = {noValidate : true}

            //console.log($scope.savedQueries)

            //---     load the index of samples
            $http.get("samples/index.json").then(
                function (data) {
                    $scope.exampleIndex = data.data
                }
            )
            $scope.selectExample = function(example) {
                $http.get(`samples/${example.name}`).then(
                    function (data) {
                        $scope.exampleBundle = data.data
                    }
                )

            }

            $scope.loadExample = function (json) {
                processBundle(json)
            }

            $scope.performValidation = function(){
                validate($scope.fhir,$scope.validationServer.url,function(hashErrors){
                    $scope.hashErrors = hashErrors;
                })
            }

            let search = $window.location.search;

            if (search) {
                search = decodeURIComponent(search)
                let bundleId;
                console.log(search)

                let qry = search.substr(1); //remove the leading '?'
                let proxiedQuery = "/proxyfhir/" + qry

                console.log(proxiedQuery)

                $http.get(proxiedQuery).then(
                    function (data) {
                        //assume that the query in the url was a full search url - eg
                        //If this is to a FHIR server with a stored Bundle it ww\ill be a bundle of bundles
                        //If to an ordinary server (like github) then it will just be a bundle...

                        //so the response . We'll just grab the first one...
                        let response = data.data;
                        if (response.resourceType !=='Bundle') {
                            alert("The app was invoked with a Url that did not return a Bundle")
                            return;
                        }

                        if (response.entry && response.entry.length > 0) {
                            $scope.urlPassedIn = true;  //flag that the bundle is to be retreived and displayed - not the selector
                            //if the first entry in the bundle is a Bundle, then this must be a bundle of bundles from a FHIR server. Select it
                            if (response.entry[0].resource.resourceType == 'Bundle') {
                               // $scope.toggleSidePane();    //hide the sidepane
                                processBundle(response.entry[0].resource)
                            } else {
                                //the first entry is not a Bundle - just process it
                             //   $scope.toggleSidePane();    //hide the sidepane
                                processBundle(response)
                            }

                        }
                        //console.log(data.data)

                    },
                    function(err) {
                        alert("Sorry, the query '"+ qry +"' couldn't be executed")
                       // console.log("")
                    }
                )

            } else {
                //nothing passed in when the app was started- read bundles from the defined server

            }

            $scope.selectDRObs = function(obs) {
                $scope.selectedDRObservation = obs
            }

            $scope.deepValidate = function(){
                $scope.waiting = true
                bundleVisualizerSvc.deepValidation($scope.fhir,$scope.validationServer.url).then(
                    function(data) {
                        console.log(data)
                        $scope.deepValidationResult = data
                    }, function(err) {
                        $scope.deepValidationResult = err
                        console.log(err)
                    }
                ).then(function (){
                    $scope.waiting = false
                })
            }

            $scope.validateWithInferno = function(){
                //curl 'https://inferno-dev.healthit.gov/validatorapi/validate?profile=http://hl7.org/fhir/uv/ips/StructureDefinition/Composition-uv-ips' -X POST -H 'Content-Type: application/fhir+json' --data-raw $'{\n  "resourceType" : "Composition"\n}'
                let url = "/proxyfhir/https://inferno-dev.healthit.gov/validatorapi/validate?profile=http://hl7.org/fhir/uv/ips/StructureDefinition/Composition-uv-ips"

                $scope.validatingWithInferno = true;
                delete $scope.infernoError
                delete $scope.infernoValidationResult

                $http.post(url,$scope.fhir).then(
                    function (data){
                        $scope.infernoValidationResult = data.data
                        console.log(data.data)
                    }, function(err) {
                        $scope.infernoError = err.data
                        console.log(err.data)
                    }
                ).finally(
                    function(){
                        $scope.validatingWithInferno = false
                    }
                )

            }

            $scope.selectFromInfernoValidate = function (iss) {
                console.log(iss)
                if (iss.expression) {
                    //get the index of the enry in the bundle

                    $scope.selectedInfernoValidationEntry = fhirpath.evaluate($scope.fhir, iss.expression[0])
/*
                    console.log(fhirpath.evaluate($scope.fhir, iss.expression[0]));


                    let ar = iss.expression[0].split('.')     //entry[n]
                    if (ar.length > 1) {
                        let t = ar[1]
                        let g = t.indexOf('[')
                        let inx = t.substr(g+1,t.length -g -2)
                        console.log(inx)
                        $scope.selectedInfernoValidationEntry = $scope.fhir.entry[inx]
                    }
            */

                }
            }


            $scope.selectFromDeepValidate = function (iss) {
                console.log(iss)
                if (iss.location) {
                    //get the index of the enry in the bundle
                    let ar = iss.location[0].split('.')     //entry[n]
                    if (ar.length > 1) {
                        let t = ar[1]
                        let g = t.indexOf('[')
                        let inx = t.substr(g+1,t.length -g -2)
                        console.log(inx)
                        $scope.selectedDeepValidationEntry = $scope.fhir.entry[inx]
                    }

                }
            }

            $scope.selectSection = function(section) {
                delete $scope.selectedEntryFromSection
                $scope.selectedSection = section
            }
            $scope.selectEntryFromSection = function(oReference) {
                let reference = oReference.reference;


                $scope.selectedEntryFromSection = $scope.hashByRef[reference]
            }

            $scope.selectResourceFromRender = function(resource) {
                $scope.selectedResourceFromRender = resource.resource
            }

            //-------- related to queries
            $scope.testNewQuery = function(qry) {

                delete $scope.executedQueryBundle

                if (qry.substr(0,4) !== 'http') {
                    qry = $scope.dataServer.url + qry
                }
                $scope.executedQuery = qry


                let proxiedQuery = "/proxyfhir/" + qry
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
            }



            $scope.clearQuery = function() {
                delete $scope.input.newQuery
                delete $scope.executedQuery
            }

            $scope.addNewQuery = function(qry,name) {
                if (qry.substr(0,4) !== 'http') {
                    qry = $scope.dataServer.url + qry
                }

                $localStorage.bvQueries = $localStorage.bvQueries || []
                let newQuery = {name: name,qry: qry }

                $localStorage.bvQueries.push(newQuery)

                processBundle($scope.executedQueryBundle);      //set when the query is tested



            }

            $scope.viewNewQueryBundle = function(bundle) {
                processBundle(bundle);
            }

            $scope.executeSavedQuery = function (item) {
                //this is a DR resource
                $scope.waiting = true;

                var req = {
                    method: 'GET',
                    url: item.qry,
                    headers: {
                        'Cache-Control': 'no-cache'
                        //'Pragma':'no-cache'
                    }
                }

               // $http(req).then(

                $http.get(item.qry).then(
                    function (data) {
                        console.log(data)
                        //todo - same logic as when query supplied - might be to a FHIR server or not

                        //if 'set validation server' is true, then supply the validation server in the call
                        validationServer = null

                        processBundle(data.data,validationServer)
                    },
                    function (err) {
                        alert(angular.toJson(err))
                    }
                ).finally(
                    function(){
                        $scope.waiting = false;
                    }
                )

            }

            $scope.displaySavedBundle = function(item) {
                processBundle(item.bundle)
            }

            //------- passed a bundle in json or xml ------

            $scope.viewNewBundle = function(bundle,name) {
                //view a bundle directly. If 'name' is not null, then save for this user
                //todo - convert from XML if needed

                let json
                if (bundle.substr(0,1) == "<") {
                    //assume this is xml
                    $http.post('/transformJson',bundle).then(
                        function(data) {
                            json = data.data
                            console.log(json)
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

                        //process(json,name)

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
                console.log(toggle)
                let options = {bundle:$scope.fhir,hashErrors:$scope.hashErrors,serverRoot:$scope.serverRoot}
                options.hidePatient = toggle;
                drawGraph(options)
            };


            //will update the config. We don't care if manually entered servers are lost or the default servers changed
            if (appConfigSvc.checkConfigVersion()) {
                alert('The config was updated. You can continue.')
            }

            $http.post('/stats/login',{module:'bundleVisualizer'}).then(
                function(data){

                },
                function(err){
                    console.log('error accessing clinfhir to register access',err)
                }
            );

            //pre-defined queries
            $scope.queries = [];


            //inward and outwards references in graph
            $scope.input = {};
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
                if (confirm('Are you sure you wish to remove this query')){
                    $localStorage.bvQueries.splice(inx,1)
                }

            };



            $scope.changeServer = function(type) {
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
                            console.log(svr)
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




            $scope.selectIssueDEP = function(issue){

                console.log(issue)
                //find the actual entry - a bit of a hack tttt
                if (issue.location) {
                    let g1 = issue.location[0].indexOf('[')
                    let g2 = issue.location[0].indexOf(']')
                    if (g1 && g2) {
                        let inx = issue.location[0].substr(g1+1,g2-g1-1)
                        console.log(inx -1)
                        $scope.selectedIssueEntry = $scope.fhir.entry[inx-1]
                    }
                }

            };


            $scope.selectBundleEntry = function(entry,entryErrors) {
                delete $scope.selectedFromSingleGraph;  //does this need to be done?
                $scope.selectedFromSingleGraph = entry.resource
                delete $scope.fshText
                delete $scope.xmlText
                $scope.selectedBundleEntry = entry
                $scope.selectedBundleEntryErrors = entryErrors;

                $scope.createGraphOneEntry();

                //get the FSH of the resource
                $http.post("./fsh/transformJsonToFsh",entry.resource).then(
                    function(data) {
                        console.log(data.data)
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

                //get the Xml
                $http.post("./transformXML",entry.resource).then(
                    function(data) {
                       // console.log(data.data)
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

                let options = {bundle:$scope.fhir,hashErrors:$scope.hashErrors,serverRoot:$scope.serverRoot,centralResourceId:url}
                options.showInRef = $scope.input.showInRef;
                options.showOutRef = $scope.input.showOutRef;
                options.recursiveRef = $scope.input.recursiveRef;
                options.hidePatient = $scope.input.showHidePatient;

                let vo = v2ToFhirSvc.makeGraph(options);
                //let vo = v2ToFhirSvc.makeGraph($scope.fhir,$scope.hashErrors,$scope.serverRoot,false,id)
                //console.log(vo);

                let container = document.getElementById('singleResourceGraph');
                let graphOptions = {
                    physics: {
                        enabled: true,
                        barnesHut: {
                            gravitationalConstant: -10000,
                        }
                    }
                };
                $scope.singleResourceChart = new vis.Network(container, vo.graphData, graphOptions);

                $scope.singleResourceChart.on("click", function (obj) {
                    delete $scope.selectedFshFromSingleGraph
                    var nodeId = obj.nodes[0];  //get the first node

                    var node = vo.graphData.nodes.get(nodeId);

                    $scope.selectedFromSingleGraph = node.resource;

                    //create FSH of selected resource
                    $http.post("./fsh/transformJsonToFsh",node.resource).then(
                        function(data) {
                            //console.log(data.data)
                            try {
                                let response = data.data
                                $scope.selectedFshFromSingleGraph = response.fsh.instances[node.resource.id]
                                if (response.fsh.aliases) {
                                    $scope.selectedFshFromSingleGraph = response.fsh.aliases + "\n\n" +$scope.selectedFshFromSingleGraph
                                }


                            } catch (ex) {
                                $scope.selectedFshFromSingleGraph = "Unable to transform into FSH"
                            }

                        }, function(err) {
                            console.log("FSH Transform error")

                        }
                    )
                    //selectedFshFromSingleGraph


                    $scope.$digest();
                });


            };


            //From the 'references graph' when a resource is clicked, then selected for view in bundle entries tab
            $scope.selectFromMainGraph = function (resource){

                //if ($scope.selectedFromSingleGraph) {

                    $scope.fhir.entry.forEach(function (entry){
                        if (entry.resource && (entry.resource.id == resource.id)) {
                            //$scope.selectedBundleEntry = entry
                            $scope.selectBundleEntry (entry,[])
                            $scope.setTab.mainTabActive = $scope.ui.tabEntries
                        }
                    })

               // }

                //$scope.setTab.mainTabActive = $scope.ui.tabEntries
            }

            //$scope.setTab = {}
            //$scope.setTab.mainTabActive = 3

            //when a resource has been selected from the 'single resource' graph
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
                console.log(item)
                $scope.selectedObservations = item.resources
            }

            $scope.selectObservation = function(obs){
                $scope.selectedObservation = obs
            }

            $scope.selectResourceFromSection = function(ref){
                $scope.selectedRef = ref        //to highlight under sections
                $scope.resourceFromSection = $scope.hashByRef[ref]
            }

            //validate the resources in the bundle, then draw the graph (which needs the errors to display)
            let processBundle = function(oBundle,validationServer) {

                delete $scope.hashErrors
               // $scope.CarePlans = []       //a list of all Careplans in the bundle (
                $scope.DR = []          //list of DiagnosticReports
                delete $scope.selectedDeepValidationEntry
                delete $scope.deepValidationResult

                $scope.showSelector = false     //hide the selector

                delete $scope.serverRoot;
                $scope.fhir = oBundle;

                //create a hash for bundle by name
                $scope.hashByName = {}
                $scope.hashByRef = {}       //the target of a reference {type}/{id}
                if (oBundle.entry) {
                    oBundle.entry.forEach(function(entry) {
                        let resource = entry.resource;

                        if (resource.resourceType == "CarePlan") {
                           // $scope.CarePlans.push(entry)
                        }

                        if (resource.resourceType == "DiagnosticReport") {
                           // let vo = bundleVisualizerSvc.makeDRSummary()
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

                            console.log(item)

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
                console.log($scope.hashObservations)

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
                    console.log($scope.sortedEntries)
                }

                //------------- construct the graph based on canonical references
                let vo = v2ToFhirSvc.makeGraphCanonical(oBundle)
                $scope.hashRefsByResource = vo.hashRefsByResource;  //the set of canonical resources from this resource
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
                        console.log(fullUrl)
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
                            console.log(serverRoot)
                        }



                        $scope.serverRoot = serverRoot;

                    } else {
                        //todo - do we really need the fullUrl
                        // alert('All entries need the fullUrl for the graph generation to work properly. The graph may be incomplete..')

                    }
                }

                let options = {bundle:$scope.fhir,hashErrors:$scope.hashErrors,serverRoot:serverRoot}
                drawGraph(options)


               // let options = {bundle:$scope.fhir,hashErrors:{},serverRoot:serverRoot}
               // drawGraph(options)

                //validation is now a deliberate process...
                if (false) {
                    validate(oBundle, validationServer,function(hashErrors){
                        //returns a hash by position in bundle with errors...
                        $scope.hashErrors = hashErrors;
                    });

                }
                //note that this function is defined on the root...

                let bundle=angular.copy(oBundle)

                //if this is a document, then
                delete $scope.document;     //contains the document specific resources suitable for layout
                if (bundle.type == 'document') {
                    let arComposition = [];

                    //create a hash by type & id - to find document references
                    let hash = {};

                    bundle.entry.forEach(function (entry) {
                        if (entry.resource) {


                            let key;

                            //2020-05-10 - hask key is not full Url (as references won't be - updated: but the can!)
                            key = entry.resource.resourceType + "/" + entry.resource.id

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
                                            section.realResources.push({display:resource.resourceType,resource:resource})
                                        } else {
                                            section.realResources.push({display:'unknown reference:'+entry.reference})
                                        }

                                    })
                                }


                            })
                        }




//console.log($scope.document.composition)


                    }
                }
            };


            function drawGraph(options) {
                let vo = v2ToFhirSvc.makeGraph(options)

                $scope.showGraphWarning = true
                var container = document.getElementById('resourceGraph');
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
                    $scope.selectedNode = node;

                    //this is the entry that is selected from the 'bundle entries' tab...
                    $scope.selectedBundleEntry = node.entry;

                    $scope.$digest();
                });

                //https://stackoverflow.com/questions/32403578/stop-vis-js-physics-after-nodes-load-but-allow-drag-able-nodes
                $scope.chart.on("stabilizationIterationsDone", function () {
                    delete $scope.showGraphWarning
                    $scope.chart.setOptions( { physics: false } );
                });


            }




            //validate each entry

            let validate = function(bundle,inValidationServer,cb) {
                $scope.valErrors = 0
                $scope.valWarnings=0;

                let validationServer = inValidationServer || $scope.validationServer.url


                //defauk to no validate


            //    if ($localStorage.bvConfig && $localStorage.bvConfig.noValidate) {
             //       return
            //    }


                $scope.waiting = true;



                //this is the 'per entry' validation
                let arQuery = []
                let hashErrors = {};    //related to position in bundle...
                bundle.entry.forEach(function (entry,inx) {
                    let resource = entry.resource
                    let url =  validationServer+resource.resourceType +"/$validate";  // "/proxyfhir/" +
                    arQuery.push(processValidation(url,resource,hashErrors,inx))
                });


                if (arQuery.length > 0) {
                    $q.all(arQuery).then(
                        function(){
                            //  deferred.resolve(hashErrors)
                            cb(hashErrors)
                        },
                        function(){
                            //  deferred.resolve(hashErrors)
                            cb(hashErrors)
                        }


                    ).finally(function(){
                        $scope.waiting = false;
                    })


                } else {
                    cb({})
                }

                // return deferred.promise;


                function processValidation(url,resource,hash,inx){
                    let deferred = $q.defer();

                    $http.post(url,resource).then(
                        function(data){
                            //no errors
                            //hash[inx] = data.data.issue
                            let addToIssue = false
                            if (data.data.issue) {
                                data.data.issue.forEach(function(iss){
                                    if (iss.severity == 'warning') {
                                        $scope.valWarnings++
                                        addToIssue = true
                                    }
                                });

                                if ( addToIssue ) {
                                    data.data.issue.forEach(function (iss) {
                                        iss.resource = {type:resource.resourceType, id: resource.id}
                                    })

                                    hash[inx] = data.data.issue; //{resource:resource,issue:data.data.issue}
                                }
                            }

                            deferred.resolve();
                        },

                        function(err){
                            if (err.data) {
                                hash[inx] = err.data.issue
                                err.data.issue.forEach(function(iss){
                                    if (iss.severity == 'error') {
                                        $scope.valErrors++
                                    } else {
                                        $scope.valWarnings++
                                    }
                                })
                            }



                            deferred.resolve();
                        }
                    )

                    return deferred.promise;

                    function processValidationItem(issue) {


                    }

                }

            }



            let validateBundle = function(bundle) {
                delete $scope.bundleValidationResult
                let url = $scope.validationServer.url + "Bundle/$validate";
                $http.post(url,bundle).then(
                    function(data) {
                        console.log(data)
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
                        console.log(data)
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
                                    //console.log(inx -1)
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

            function deDupeBundleDEP(bundle) {
                let newBundle = angular.copy(bundle)

                return newBundle
                //I don't know why I needed to do this - and sorting is dangerous for Document & Message bundkes


                newBundle.entry.length = 0;
                let idHash = {};

                bundle.entry.forEach(function (entry) {

                    if (entry.resource) {
                        let resourceId = entry.fullUrl;
                        if (entry.resource.id) {
                            resourceId = entry.resource.resourceType + "/" + entry.resource.id;
                        }




                        if (! idHash[resourceId]) {
                            newBundle.entry.push(entry);
                            idHash[resourceId] = true;
                        }
                    } else {
                        alert("There is an entry with the fullUrl "+ entry.fullUrl + " that has no resource - ignoring...")
                    }


                });

                newBundle.entry.sort(function(a,b){

                    let ida = a.resource.id || a.fullUrl;
                    let idb = b.resource.id || b.fullUrl;

                    let a1 = a.resource.resourceType + "/" + ida;
                    let b1 = b.resource.resourceType + "/" + idb;

                    //let a1 = a.resource.resourceType + "/" + a.resource.id;
                    //let b1 = b.resource.resourceType + "/" + b.resource.id;

                    if (a1 > b1) {
                        return 1
                    } else if (b1 > a1) {
                        return -1
                    } else {
                        return 0
                    }
                });

                return newBundle;
            }
        }
    );
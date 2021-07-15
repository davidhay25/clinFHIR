angular.module("sampleApp")
    .controller('bundleVisualizerCtrl',
        function ($scope,$uibModal,$http,v2ToFhirSvc,$timeout,modalService,
                  GetDataFromServer,$window,appConfigSvc,$localStorage,$q) {


            //console.log($window.location)
            //todo - default to a new 'main clinfhir' server that is only availalble to apps on the clinfir server
            //$scope.dataServer = $localStorage.dataServer || {url:"http://home.clinfhir.com:8054/baseR4/"}
            $scope.dataServer = $localStorage.dataServer || {url:"http://hapi.fhir.org/baseR4/"}
            //defaut
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
            };

            //---------- login stuff
            $scope.firebase = firebase;
            //called whenever the auth state changes - eg login/out, initial load, create user etc.
            firebase.auth().onAuthStateChanged(function(user) {

                if (user) {
                    //$scope.userProfile = $firebaseObject(firebase.database().ref().child("users").child(user.uid));
                    $scope.user = {email:user.email}
                    //delete $scope.showNotLoggedIn;

                    if (! $scope.urlPassedIn) {
                        //If a url was passed in then don't load anything else - even if the user is logged in
                        //get any saved bundles for this user. These are saved against the Bundle endpoint where
                        //Bundle.identifier.system = the users email
                        //Bundle.identifier.value = name of the bundle

                        //todo We may want to move to a List of bundles rather than retrieving them all for performance...
                        let url = $scope.dataServer.url + "Bundle?identifier=" + user.email + '|'

                        $http.get(url).then(
                            function(data) {
                                //scope.userBundles = data.data;
                                $scope.savedBundles = []
                                data.data.entry.forEach(function (entry) {
                                    let bundle = entry.resource
                                    let item = {"name":bundle.identifier.value,bundle : bundle}
                                    $scope.savedBundles.push(item)
                                })
                                console.log(data.data)
                            }, function (err) {
                                console.log(err)
                            }
                        )

                        //get any queries. Stored in DocumentReferences
                        let queryUrl = $scope.dataServer.url + "DocumentReference?identifier=" + user.email + '|'
                        $http.get(queryUrl).then(
                            function(data) {
                                $scope.savedQueries = []
                                if (data.data.entry) {
                                    data.data.entry.forEach(function(entry){
                                        let item = {"name":entry.resource.identifier[0].value}
                                        item.qry = atob(entry.resource.content[0].attachment.data)
                                        $scope.savedQueries.push(item)
                                    })

                                }

                                console.log(data.data)
                            }, function (err) {
                                console.log(err)
                            }
                        )
                    }

                    $scope.$digest()
                } else {
                    console.log('no user')
                    delete $scope.user

                    $scope.$digest()
                }
            });

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
                    modalService.showModal({}, {bodyText: 'You have been logged out of clinFHIR'})
                }, function(error) {
                    modalService.showModal({}, {bodyText: 'Sorry, there was an error logging out - please try again'})
                });
            };


            let search = $window.location.search;

            if (search) {
                search = decodeURIComponent(search)
                let bundleId;
                console.log(search)

                let qry = search.substr(1); //remove the leading '?'
                $http.get(qry).then(
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


            //-------- related to queries
            $scope.testNewQuery = function(qry) {
                if (qry.substr(0,4) !== 'http') {
                    qry = $scope.dataServer.url + qry
                }
                $scope.executedQuery = qry

                $http.get(qry).then(
                    function (data) {
                        //todo - same logic as when query supplied - might be to a FHIR server or not
                        $scope.executedQueryBundle = data.data;
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

                let b64 = btoa(qry)
                let dr = {resourceType:'DocumentReference'}

                dr.identifier = {system:$scope.user.email,value:name};
                dr.id = 'cf-' + getHashCode('cf' + $scope.user.email + name)
                dr.status = 'current'
                dr.category = {text:'clinFHIR query'}
                dr.content = [{attachment:{data:b64}}]

                let url = $scope.dataServer.url + "DocumentReference/" + dr.id
                console.log(dr)
                //console.log(bundleToSave.identifer)

                $http.put(url,dr).then(
                    function (data) {
                        console.log('saved OK')
                        processBundle($scope.executedQueryBundle)
                    },
                    function (err) {
                        alert(angular.toJson(err))
                    }
                )
            }

            $scope.viewNewQueryBundle = function(bundle) {
                processBundle(bundle);
            }

            $scope.executeSavedQuery = function (item) {
                //this is a DR resource
                $http.get(item.qry).then(
                    function (data) {
                        //todo - same logic as when query supplied - might be to a FHIR server or not
                        processBundle(data.data)
                    },
                    function (err) {
                        alert(angular.toJson(err))
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
                        process(json,name)

                    } catch (ex) {
                        alert("Must be a valid Json bundle")
                        return;
                    }

                }



                }
                function process(json,name) {

                    // $scope.showSelector = false
                    processBundle(json);

                    if (name) {
                        //save the bundle on the dataserver. Use a put. will overwrite
                        let bundleToSave = angular.copy(json)
                        bundleToSave.type = "collection"
                        bundleToSave.identifier = {system:$scope.user.email,value:name};
                        bundleToSave.id = 'cf-' + getHashCode('cf' + $scope.user.email + name)

                        let url = $scope.dataServer.url + "Bundle/" + bundleToSave.id
                        //console.log(url)
                        //console.log(bundleToSave.identifer)

                        $http.put(url,bundleToSave).then(
                            function (data) {
                                console.log('saved OK')
                            },
                            function (err) {
                                alert(angular.toJson(err))
                            }
                        )
                }
            }
/*
            $scope.leftPaneClass = "col-sm-2 col-md-2"
            $scope.rightPaneClass = "col-md-10 col-sm-10";

            $scope.showSidePane = true;
            $scope.toggleSidePane = function(){
                if (! $scope.showSidePane) {
                    $scope.leftPaneClass = "col-sm-2 col-md-2"
                    $scope.rightPaneClass = "col-md-10 col-sm-10";
                } else {
                    $scope.leftPaneClass = "hidden"
                    $scope.rightPaneClass = "col-md-12 col-sm-12";
                }
                $scope.showSidePane = !$scope.showSidePane
            };

            */



            //show or hide the patient in the main graph
            $scope.showHidePatientDEP = function(toggle) {
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


            $scope.addQueryDEP = function(){
                $uibModal.open({
                    templateUrl: 'modalTemplates/addQuery.html',
                    size: 'lg',
                    controller: function ($scope,dataServer,$http) {
                        $scope.input = {};
                        $scope.dataServer = dataServer

                        $scope.canSave = function() {
                            if (! $scope.response || ! $scope.input.name) {
                                return false;
                            }

                            if ($scope.response) {
                                if ($scope.response.resourceType !== 'Bundle') {
                                    return false;
                                } else {
                                    if (! $scope.response.entry || $scope.response.entry.length ==0) {
                                        return false;
                                    }
                                }
                            }
                            return true;
                        };


                        $scope.save = function(){
                            $scope.$close({query:$scope.input.query,display:$scope.input.name,description:$scope.input.description})
                        };

                        $scope.execute = function(qry) {

                            let options = {headers: {'Accept':'application/fhir+json'}};
                            let fullQry = qry

                            if (qry.substr(0,4) !== 'http') {
                                 fullQry = dataServer.url + qry
                            }

                            $scope.actualQuery = fullQry;

                            $scope.waiting = true;
                            $http.get(fullQry,options).then(
                                function(data) {
                                    $scope.response = data.data;
                                },
                                function(err) {
                                    $scope.response = err.data;
                                }
                            ).finally(
                                function(){
                                    $scope.waiting = false;
                                }
                            )

                        }
                    },
                    resolve : {
                        dataServer: function () {          //the default config
                            return $scope.dataServer;

                        }
                    }
                }).result.then(function(vo) {
                        $localStorage.bvQueries = $localStorage.bvQueries || []
                        $localStorage.bvQueries.push(vo);
                        $scope.queries = $localStorage.bvQueries
                    }
                )
            };

            $scope.deleteQueryDEP = function(inx) {
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

                        //$scope.input.dataServer = dataServer;
                        //$scope.input.validationServer = validationServer;

                        $scope.checkServer = function(url) {
                            $scope.canSave = false
                            if (url.substr(url.length -1) !== '/') {
                                url += '/';
                                $scope.input.url += '/'
                            }
                            url += "meta";
                            $http.get(url).then(
                                function(data) {
                                    if (data.data && data.data.resourceType == 'CapabilityStatement' ) {
                                        $scope.canSave = true
                                    } else {
                                        alert("This url did not return a CapabilityStataement from "+ url)
                                    }
                                },
                                function (err) {
                                    alert("This url did not return a CapabilityStataement from "+ url)
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




            $scope.importBundleDEP = function() {
                $uibModal.open({
                    templateUrl: 'modalTemplates/importBundle.html',
                    size: 'lg',
                    controller: function($scope,appConfigSvc,modalService,dataServer) {
                        $scope.input = {};
                        $scope.identiferChecked = true;     //false if the identifier has been checked (or is null)

                        let identifierSystem = appConfigSvc.config().standardSystem.bundleIdentifierSystem;
                        //let cfCreatedExt = appConfigSvc.config().standardExtensionUrl.clinFHIRCreated;

                        if (!identifierSystem) {
                            alert('identifier system null')
                            return;
                        }

                        $scope.canSave = function() {
                            if (!$scope.identiferChecked) {
                                return false
                            }
                            if (! $scope.input.raw) {
                                return false
                            }
                            return true;
                        };




                        //see if the identifier already exists
                        $scope.testIdentifier = function(){
                            let identifier = $scope.input.identifier;
                            var url = dataServer.url+"Bundle?identifier=";
                            url += identifierSystem + "|" + $scope.input.identifier ;

                            var config = {headers:{'content-type':'application/fhir+json'}}
                            $http.get(url,config).then(
                                function(data) {
                                    if (data.data && data.data.entry && data.data.entry.length > 0) {
                                        alert("This identifier has already been used. Try another.");
                                        delete $scope.input.identifier;
                                        return;
                                    } else {
                                        $scope.identiferChecked = true;
                                        alert("This identifier is ok to use.")
                                    }
                                })
                        };

                        $scope.import = function() {
                            var raw = $scope.input.raw;

                            var g = raw.indexOf('xmlns="http://hl7.org/fhir"') || raw.indexOf("xmlns='http://hl7.org/fhir'");
                            if (g > -1) {
                                //this is Xml (I think!) Use the Bundle endpoint
                                $scope.waiting = true;
                                var url = dataServer.url+"Bundle";

                                var config = {headers:{'content-type':'application/fhir+xml'}}
                                $http.post(url,raw,config).then(
                                    function(data) {
                                        //the bundle was saved - now read it back from the server in Json format...

                                        let serverId = data.headers('Content-Location');
                                        serverId = serverId || data.headers('content-location');
                                        serverId = serverId || data.headers('location');
                                        serverId = serverId || data.headers('Location');

                                        console.log(serverId);
                                        //this seems to be a full URl - is this always the case?

                                        if (serverId) {

                                            //url += "/"+serverId;
                                            config = {headers:{'accept':'application/fhir+json'}};
                                            $http.get(serverId).then(
                                                function(data){
                                                    //now we can import the bundle
                                                    importFromJson(data.data);

                                                }, function (err) {
                                                    var msg = "The bundle was saved Ok, but couldn't be retrieved from the server";
                                                    modalService.showModal({}, {bodyText:msg});
                                                    //$scope.$cancel()
                                                }
                                            ).finally(function(){
                                                $scope.waiting = false;
                                            });

                                        } else {
                                            var msg = "The bundle was saved Ok, but I couldn't determine which Id was assigned to it, so cannot import it. Sorry about that."
                                            modalService.showModal({}, {bodyText:msg});
                                        }
                                    },
                                    function(err) {

                                        var msg = "The server couldn't process the Xml. Is it valid FHIR and a valid bundle?";
                                        var config = {bodyText:msg}
                                        try {
                                            var oo = angular.fromJson(err.data);
                                            console.log(oo);
                                            config.oo = oo;
                                        } catch (ex){
                                            msg += angular.toJson(err);
                                        }

                                        modalService.showModal({}, config);
                                        $scope.waiting = false;
                                    }
                                )
                            } else {
                                //this is json - just return if
                                importFromJson(raw,true)
                            }

                        };

                        let importFromJson = function(json,stripText) {

                            try {
                                var res = angular.fromJson(json)

                            } catch (ex) {
                                modalService.showModal({}, {bodyText:'This is not valid JSON'});
                                return;
                            }

                            delete res.id;      //we'll create our own
                            if (! res.resourceType) {
                                modalService.showModal({}, {bodyText:"The element 'resourceType' must exist."});
                                return;
                            }

                            if (res.resourceType !== 'Bundle') {
                                modalService.showModal({}, {bodyText:"The 'resourceType' must be 'Bundle'."});
                                return;
                            }

                            if (! res.entry || res.entry.length == 0) {
                                modalService.showModal({}, {bodyText:"There must be at least one entry in the bundle"});
                                return;
                            }

                            if (res.entry && res.entry.length > 200) {
                                modalService.showModal({}, {bodyText:"The maximum number of entries in a saved bundle is 200."});
                                return;
                            }


                            if ($scope.input.identifier) {

                                res.identifier = {"system":identifierSystem,value:$scope.input.identifier}

                                if (res.type == 'transaction') {
                                    res.type = 'collection'
                                    alert("Changing bundle type to 'collection' as transactions can't be saved directly")
                                }

                                var url = dataServer.url+"Bundle";
                                var config = {headers:{'content-type':'application/fhir+json'}}
                                $http.post(url,res,config).then(
                                    function() {
                                        alert("Bundle has been saved,")
                                    },
                                    function(err){
                                        console.log(err)
                                        alert("Sorry, there was an error and the bundle wasn't saved:" + angular.toJson(err.data))
                                    }
                                ).finally(
                                    function(){
                                        $scope.$close(res);
                                    }
                                )

                                //identifierSystem + "|" + $scope.input.identifier ;
                            } else {
                                $scope.$close(res);     //close the dialog, passing across the resource
                            }




                        }

                    },
                    resolve : {
                        dataServer: function () {          //the default config
                            return $scope.dataServer;

                        }
                    }

                }).result.then(function (bundle) {
                    //the importer will return a resource that is the one to be selected...  (might have been a bundle)

                    let newBundle = deDupeBundle(bundle)


                    console.log(newBundle)
                    processBundle(newBundle);


                })

            };

            $scope.selectIssue = function(issue){

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
                $scope.selectedBundleEntry = entry
                $scope.selectedBundleEntryErrors = entryErrors;

                $scope.createGraphOneEntry();


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
                }

                let options = {bundle:$scope.fhir,hashErrors:$scope.hashErrors,serverRoot:$scope.serverRoot,centralResourceId:url}
                options.showInRef = $scope.input.showInRef;
                options.showOutRef = $scope.input.showOutRef;
                options.recursiveRef = $scope.input.recursiveRef;

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

            };


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

            $scope.selectBundleFromList = function(entry) {
                delete $scope.selectedBundleEntryErrors;
                delete $scope.selectedBundleEntry;

                $scope.selectedEntry = entry;
                processBundle(entry.resource);

            };
/*
            $scope.selectQueryDEP = function(query) {
                delete $scope.selectedBundleEntryErrors;
                delete $scope.selectedBundleEntry;
                $scope.selectedQuery = query;
                $scope.waiting = true;
                let url = query.query;

                if (url.indexOf('http') == -1) {
                    url = $scope.dataServer.url + url;
                }

                var config = {
                    closeButtonText: "No thankyou",
                    actionButtonText: 'Yes please',
                    headerText: 'Execute query',
                    bodyText: "Do you want to execute the query: " + url
                };

                modalService.showModal({}, config).then(
                    function() {
                        $scope.waiting = true;
                        GetDataFromServer.adHocFHIRQueryFollowingPaging(url).then(
                            function(data) {
                                //console.log(data)

                                let newBundle = deDupeBundle(data.data)
                                //console.log(newBundle)
                                processBundle(newBundle);
                            },
                            function(err) {
                                console.log(err);
                            }
                        ).finally(function(){
                            $scope.waiting = false;
                        })
                    }
                );
            };
*/
            //validate the resources in the bundle, then draw the graph (which needs the errors to display)
            let processBundle = function(oBundle) {

                $scope.showSelector = false     //hide the selector

                delete $scope.serverRoot;

                //hide the side pane
                //$scope.showSidePane = true;
                //$scope.toggleSidePane();

                $scope.fhir = oBundle;

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
                }

                //construct the graph based on canonical references
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


                   // todo - set the entry for the 'main' graph as well...$scope.selectBundleEntry = function(entry,entryErrors) {

                   // }


                    $scope.$digest();
                });


                //note that this function is defined on the root...
                validate(oBundle,function(hashErrors){
                    //returns a hash by position in bundle with errors...

                    $scope.hashErrors = hashErrors;
                    //$scope.validationResult = hashErrors

                    //the serverRoot is needed to figure out the references when the reference is relative
                    //we assume that all the resources are from the same server, so figure out the server root
                    //by looking at the first fullUrl (remove the /{type}/{id} at the end of the url

                    let serverRoot = "";
                    if ($scope.fhir && $scope.fhir.entry) {
                        //work out the server root from the first entry
                        let first = $scope.fhir.entry[0]
                        if (first && first.fullUrl) {
                            console.log(first.fullUrl)
                            let ar = first.fullUrl.split('/')
                            ar.pop();
                            ar.pop();
                            serverRoot = ar.join('/') + "/"
                            console.log(serverRoot)
                            $scope.serverRoot = serverRoot;

                        } else {
                            //todo - do we really need the fullUrl
                           // alert('All entries need the fullUrl for the graph generation to work properly. The graph may be incomplete..')
                        }
                    }

                    let options = {bundle:$scope.fhir,hashErrors:$scope.hashErrors,serverRoot:serverRoot}
                    drawGraph(options)

                });

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
            }

            //when validate called from the UI
            $scope.validate = function() {

            };


            //validate each entry
            //return hashErrors in callback - keyed by index within the bundle
            let validate = function(bundle,cb) {
                //temp - disable validation - make a user initiated function
                //cb({})
                //return;

                //validateBundle(bundle) - just validates the whole bundle

                $scope.waiting = true;

                $scope.valErrors = 0, $scope.valWarnings=0;

                //this is the 'per entry' validation
                let arQuery = []
                let hashErrors = {};    //related to position in bundle...
                bundle.entry.forEach(function (entry,inx) {
                    let resource = entry.resource
                    let url = $scope.validationServer.url+resource.resourceType +"/$validate";
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

            function deDupeBundle(bundle) {
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
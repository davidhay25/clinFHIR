angular.module("sampleApp").controller('queryCtrl',function($scope,$uibModal,$localStorage,appConfigSvc,
    resourceCreatorSvc,ResourceUtilsSvc,$http,modalService
        ,commonSvc,$location,v2ToFhirSvc,$timeout){

//profileCreatorSvc  RenderProfileSvc  SaveDataToServer  $rootScope

    $scope.config = $localStorage.config;
    $scope.input = {serverType:'known'};  //serverType allows select from known servers or enter ad-hoc
    $scope.result = {selectedEntry:{}}
    $scope.ResourceUtilsSvc = ResourceUtilsSvc;
    $scope.fhirBasePath="http://hl7.org/fhir/";


    //anonQuery

    $scope.input.showQuery = true  ;       //if true, the query builder can be shown
    $scope.input.showResults = false;     //show the resoult of a query

    //note that functions to check the $location # for a server & setuo initial one are below $scope.selectServer & $scope.buildQuery


    //select a server. If 'server' is populated then we've selected a known server. If url is populated then an ad-hoc url has been entered
    //has to be at the top as called at startup
    //the 'url' is used when entering an ad-hoc server
    $scope.selectServer = function(server,url) {
        if (url) {
            if (url.substring(url.length-1) !== '/') {
                url += '/'
            }
            server = {name:'Ad Hoc server',url:url}
            $scope.server = server;
        }

        $scope.input.parameters = "";
        delete $scope.filteredProfile;
        delete $scope.response;
        delete $scope.err;
        delete $scope.conformance;
        delete $scope.input.selectedType;
        delete $scope.standardResourceTypes;

        delete $scope.searchParamList;
        delete $scope.includeList;

        $scope.input.showQuery = true;
        $scope.input.showResults = false;

      //  $scope.server = server;

        $scope.input.validationServer = server;     //default the validation server to the selected server

        $scope.waiting = true;

        let qry = $scope.server.url + "metadata";

        $http.get(qry).then (
            
            function (data) {
                $localStorage.serverQueryServer = server;
                $scope.conformance = data.data;     //the CapabilityStatement (Conformance) resource
                $scope.hashResource = {};           //has of capstmt resource entry by type...
                $scope.standardResourceTypes= []
                data.data.rest[0].resource.forEach(function(res){

                    //include a type if there is a 'read' interaction
                    if (res.interaction) {
                        if (res.interaction.filter(item => item.code == 'search-type').length > 0) {
                            $scope.standardResourceTypes.push({name:res.type})
                        }

                    }


                    //sort the search parameters alphabetically...
                    if (res.searchParam) {
                        res.searchParam.sort(function (a,b) {
                            if (a.name > b.name) {
                                return 1
                            } else {
                                return -1
                            }

                        });
                    }


                    //todo ?? should this be added if there is no type query??
                    $scope.hashResource[res.type] = res;
                })

            },function (err) {
                alert('Error loading conformance resource:'+angular.toJson(err));
            }
        ).finally(function(){
            $scope.waiting = false;
        });

        $scope.buildQuery();        //builds the query from the params on screen

    };

    //create the list of 'common' types - from teh library
    $localStorage.queryHistory = $localStorage.queryHistory || [];

    //Get rid of any junk prior to this upgrade. These have the 'anonQuery' element set
    if ($localStorage.queryHistory.length > 0) {
        if ($localStorage.queryHistory[0].anonQuery) {
            $localStorage.queryHistory.length = 0;
        }
    }


    $scope.queryHistory = $localStorage.queryHistory;
    $scope.commonTypes = []

    //get all the unique types in the history for the parameters selection
    $localStorage.queryHistory.forEach(function (hx){
        if (hx.type && $scope.commonTypes.indexOf(hx.type) == -1) {
            $scope.commonTypes.push(hx.type)
        }
    })



    $scope.getOperationDefinition = function(url){

        $scope.selectedOpDefUrl = url;
        let qry = $scope.server.url + "OperationDefinition?url=" + url;
        $http.get(qry).then(
            function (data) {
                if (data.data.entry.length >= 0) {
                    $scope.operationDefinition = data.data.entry[0].resource;


                }
            },
            function (err) {
                console.log("Can't find OpDef " + url)
            }
        )


    }


    //builds the query from the user entered data
    $scope.buildQuery = function() {
        delete $scope.anonQuery;
        delete $scope.query;
        delete $scope.response;
        var qry = '';//$scope.server.url;

        if (!$scope.input.selectedType) {
            return;
        }

        if ($scope.input.selectedType){
            qry += $scope.input.selectedType.name;
        }


        let prefix = '?';

        if ($scope.searchParamList) {
            $scope.searchParamList.forEach(function (param){
                let name = param.name


                if ($scope.input.selectedSearchParam && $scope.input.selectedSearchParamValue) {    //only set when an include is selected
                    if ($scope.input.selectedSearchParam[name] && $scope.input.selectedSearchParamValue[name]) {
                        let value = $scope.input.selectedSearchParamValue[name]


                        qry += prefix + name + "=" + value;
                        prefix = "&"


                    }
                }

            })
        }


        //add any chained queries -  input.selectedChain is a hash of possible chain values, input.selectedChainValue{}
        if ($scope.input.selectedChain && $scope.input.selectedChainValue) {

            Object.keys($scope.input.selectedChain).forEach(function (key){

                let cbValue = $scope.input.selectedChain[key];      //the value of the checkbox
                let chainValue =  $scope.input.selectedChainValue[key];     //the value entered by the user
                if (cbValue && chainValue) {

                    qry += prefix + key + '.' + chainValue
                    prefix = "&"
                }

            })
        }


        //add any includes input.selectedInclude is a hash of possible includes
        if ($scope.input.selectedInclude) {
            Object.keys($scope.input.selectedInclude).forEach(function (key){
                let value = $scope.input.selectedInclude[key]
                if (value) {
                    qry += prefix + "_include=" + $scope.input.selectedType.name + ":" +  key
                    prefix = "&"
                }

            })
        }


        qry += prefix + "_count=100"

        $scope.anonQuery = qry;     //the query, irrespective of the server...
        $scope.query = $scope.server.url + qry;     //the query againts the current server...

        $scope.adHocQry = $scope.query;     //to allow the user to manually change

    };

    //------------- determine the server when launched-----------------------
    // the most recently selected server
    $scope.server = $localStorage.serverQueryServer || appConfigSvc.getCurrentDataServer();
    $scope.input.serverType = "known"

    var hash = $location.hash();
    if (hash) {
        console.log("server passed in: " + hash)
        $scope.fromHash = true;
        $scope.input.serverType = "adhoc"
        $scope.input.adHocServer = hash;


        if (hash.substring(hash.length-1) !== '/') {
            hash += '/'
        }
        $scope.server = {name:'Ad Hoc server',url:hash}


       // $scope.selectServer(null,hash)
    } else {
        //$scope.selectServer($scope.server);
    }

    $scope.selectServer($scope.server);

    $scope.makeUrl = function(type) {
        return  $scope.config.baseSpecUrl + type;
    }

    function clear() {
        delete $scope.operationDefinition
        delete $scope.selectedOpDefUrl
    }

    $scope.showVSBrowserDialog = {};
    $scope.showVSBrowser = function(vs) {
        $scope.showVSBrowserDialog.open(vs);        //the open method defined in the directive...
    };

    //these are the definitions for the base elements in R4. Copied from gb2...
    $http.get('./artifacts/resourceElements.json').then(
        function(data) {
            //console.log(data.data);
            $scope.resourceElements = data.data
        }
    );

    $http.get('artifacts/fhirHelp.json').then(
        function(data) {
            $scope.fhirHelp = data.data;
            console.log($scope.fhirHelp)
        }, function (err) {
            console.log(err);
        }
    );

    //setDefaultInput();

    //registrt that app started...
    $http.post('/stats/login',{module:"query",servers: {}})

    //GetDataFromServer.registerAccess('query');

    //validate a response against a profile
    $scope.validateResponseDEP = function(server,profileUrl,json){
        console.log(server,profileUrl,json);
        delete $scope.responseValidationResult;
        delete $scope.responseValidationSuccess;

        profileUrl = profileUrl || "http://hl7.org/fhir/StructureDefinition/"+json.resourceType;

        var url = server.url + json.resourceType + "/$validate";

        //add the profile to the resource - remove any others...
        delete json.meta.profile;
        json.meta.profile = [profileUrl]

        $http.post(url,angular.toJson(json)).then(
            function(data) {
                $scope.responseValidationResult = data.data;    //should be an OO
                $scope.responseValidationSuccess = true
                //just make sure there are no warnings - like if the profile could not be found....
                if (data.data) {
                   // try {
                        var oo = data.data;
                        if (oo.issue) {
                            oo.issue.forEach(function (iss) {
                                if (iss.severity !== 'information') {   //information is not an error
                                    $scope.responseValidationSuccess = false
                                }
                            })
                        }
                   // } catch (ex) {
                     //   $scope.responseValidationSuccess = false
                    //}

                }



            },function(err) {
                $scope.responseValidationSuccess = false
                $scope.responseValidationResult = err.data;    //should be an OO

            }
        )


    };


    $scope.treeNodeSelectedDEP = function(item) {

        delete $scope.edFromTreeNode;
        if (item.node && item.node.data && item.node.data.ed) {
            $scope.edFromTreeNode = item.node.data.ed;
            $scope.$digest();       //the event originated outside of angular...
        }

    };



    //when a resource tye is selected in the builder
    $scope.typeSelected = function(type) {
        $scope.type = type;
        delete $scope.query;        //remove the current query
        $scope.input.selectedType = type
        $scope.input.selectedSearchParam = {};      //clear the list of selected parameters
        $scope.input.selectedSearchParamValue = {}  //... and the parameter values

        delete $scope.searchParamList;
        delete $scope.includeList;

        if ($scope.hashResource[type.name]) {
            $scope.searchParamList = $scope.hashResource[type.name].searchParam;

            //locate all the potential _includes
            let ar = $scope.hashResource[type.name].searchParam;
            if (ar) {
                $scope.includeList = ar.filter(item => (item.type=='reference')); // paramList;
            }

        } else {
            console.log('No hashResource for ' + type.name)
        }

        $scope.buildQuery();

    };


    $scope.selectFromHistory = function(hx){
        if ($scope.server) {
            $scope.hx = hx;

        }

    };

    $scope.executeFromHistory = function(hx) {

        //use the current server for the query - may not be the same as in the history...
        let qry = $scope.server.url + hx.query;
        $scope.query = qry;
        executeQuery(qry,hx.type,true)
    }

    //the handler for when a valueset is selected from within the <show-profile component on conformanceDisplay.html
    $scope.showValueSetForProfileDEP = function(url){
        //url is actually a URI
        let ar = url.split('|')
        $scope.showVSBrowserDialog.open(null,ar[0]);

    };




    //when a resource type is selected in the list
    $scope.showType = function(type){
        clear()
        delete $scope.selectedProfile;
        $scope.selectedType = type;
        //type.type is the actual type - tyep is an instance ot rest[x].resource...




        let pseudoProfile = {resourceElements:$scope.resourceElements[type.type]}
        pseudoProfile.header = {name:type.type}
        let treeData = commonSvc.makeTree(pseudoProfile)


        var id = '#pfTreeViewConf';

        $(id).jstree('destroy');
        $(id).jstree(
            {'core': {'multiple': false, 'data': treeData, 'themes': {name: 'proton', responsive: true}}}
        ).on('select_node.jstree', function (e, data) {
            if (data.node.data) {
                $scope.edFromTreeNode = data.node.data;

            }
            $scope.$digest()
        })


    };

    $scope.executeAdHoc = function(qry) {
        let type = $scope.input.selectedType.name
        executeQuery($scope.server.url + qry,type)
    }

    $scope.doit = function() {
        $scope.buildQuery();
        let type = $scope.input.selectedType.name
        executeQuery($scope.query,type)
    }

    let executeQuery = function(qry,type,executeFromHistory) {
       // $scope.buildQuery();        //always make sure the query is correct;
        delete $scope.response;
        delete $scope.err;
        delete $scope.result.selectedEntry;
        $scope.waiting = true;

        let config = {headers:{Accept:"application/fhir+json"}}
        let accessToken = $scope.input.accessToken;
        if (accessToken) {
            config.headers.Authorization = "Bearer " + accessToken;
        }

        $scope.query = qry;

        $http.get(qry,config).then (


            function(data){
                $scope.response = data;

                $scope.input.showQuery = false;       //hide the query builder tab contents
                $scope.input.showResults = true;      //show the results

                //if this is query that hasn't been performed before - add it to the history...
                if (! executeFromHistory) {
                    let anonQuery = qry.replace($scope.server.url,"");      //remove the server...

                    let ar = $localStorage.queryHistory.filter(item => (item.query == anonQuery && item.server == $scope.server.url))
                    if (ar.length == 0) {
                        let hx = {
                            type: $scope.type.name,
                            server : $scope.server.url,
                            query : anonQuery
                        };

                        $localStorage.queryHistory.push(hx)

                        if ($scope.commonTypes.filter(item => item == type).length == 0) {
                            $scope.commonTypes.push(type);
                            $scope.commonTypes.sort();
                        }

                    }
                }


        /*

        return;


                $localStorage.queryHistory.forEach(function (hx){

                    if (hx.query == anonQuery && ) {
                        found = true
                    }
                })

                if (! found) {

                    var hx = {
                        type: type,
                        anonQuery:$scope.anonQuery,
                        parameters:$scope.input.parameters,
                        server : $scope.server,
                        query : qry,
                        verb:$scope.input.verb
                    };




                    let hx = {
                        server : $scope.server.url,
                        query : anonQuery
                    };

                    $localStorage.queryHistory.push(hx)

                    if ($scope.commonTypes.filter(item => item == type).length == 0) {
                        $scope.commonTypes.push(type);
                        $scope.commonTypes.sort();
                    }



                }

  */

                $scope.input.parameters = "";

                let options = {bundle:data.data,hashErrors: {},serverRoot:$scope.server.url}
                drawGraph(options)

            },
            function(err) {
                $scope.err = err;
                $scope.response = {resourceType:'Bundle',entry:[]};
                $scope.input.showQuery = false;       //hide the query builder tab contents
                $scope.input.showResults = true;      //show the results

            }
        ).finally(function(){
            $scope.waiting = false;
        })
    };

    //display the bundle in the results pane
    $scope.showBundle = function(bundle){
        delete $scope.result.selectedEntry;
        delete xmlResource;
        $scope.bundle = bundle;

        //$scope.result.selectedEntry = bundle;
        $('#queryResourceTree').jstree('destroy');      //don't render the tree (todo though might look into this later)

    };

    $scope.selectVersion = function(resource) {

        showResource(resource)
    }

    //select an entry from the query result
    $scope.selectEntry = function(entry){
        delete $scope.bundle;
        delete $scope.xmlResource;
        delete $scope.selectedResource;
        delete $scope.selectedResourceVersions;

        showResource(entry.resource);

        //get the versions = todo - check if supported in CS
        let qryVersion = $scope.server.url + entry.resource.resourceType + "/" + entry.resource.id + "/_history"
        let config = {};
        if ($scope.input.accessToken) {
            config.headers = {Authorization:"Bearer " + $scope.input.accessToken}
        }
        $http.get(qryVersion,config).then(
            function (data) {
                //only if tthere is more than one version
                if (data.data && data.data.entry &&  data.data.entry.length > 1) {
                    $scope.selectedResourceVersions = data.data;
                }
            },
            function (err) {
                console.log(err)
            }
        )
/*
        return

        //$scope.result.selectedEntry = entry;
        $scope.selectedResource = entry.resource;

        var r = angular.copy(entry.resource);
        var newResource =  angular.fromJson(angular.toJson(r));

        var treeData = resourceCreatorSvc.buildResourceTree(newResource);

        //retrieve the XML version - todo - utilize the lantana library/\...
        let qry = $scope.server.url + r.resourceType + "/" + r.id + "?_format=xml&_pretty=true"
      //  let config = {};
        if ($scope.input.accessToken) {
            config.headers = {Authorization:"Bearer " + $scope.input.accessToken}
        }

        $http.get(qry,config).then(
            function (data) {
                $scope.xmlResource = data.data;
            },
            function (err) {
                $scope.xmlResource = "<error>Sorry, Unable to load Xml version</error>";
            }
        )

        //get the versions = todo - check if supported in CS
        let qryVersion = $scope.server.url + r.resourceType + "/" + r.id + "/_history"
        $http.get(qryVersion,config).then(
            function (data) {
                //only if tthere is more than one version
                if (data.data && data.data.entry &&  data.data.entry.length > 1) {
                    $scope.selectedResourceVersions = data.data;
                }
            },
            function (err) {
               console.log(err)
            }
        )

        //show the tree of this version
        $('#queryResourceTree').jstree('destroy');
        $('#queryResourceTree').jstree(
            {'core': {'multiple': false, 'data': treeData, 'themes': {name: 'proton', responsive: true}}}
        )
        */

    };

    showResource = function (resource) {
        $scope.selectedResource = resource;

        var r = angular.copy(resource);
        var newResource =  angular.fromJson(angular.toJson(r));

        var treeData = resourceCreatorSvc.buildResourceTree(newResource);

        //retrieve the XML version - utilize the lantana library...
        let qry = "transformXML";
        $http.post(qry,resource).then(
            function (data) {
                $scope.xmlResource = vkbeautify.xml(data.data);
            },
            function (err) {
                $scope.xmlResource = "<error>Sorry, Unable to load Xml version</error>";
            }
        )



        //show the tree of this version
        $('#queryResourceTree').jstree('destroy');
        $('#queryResourceTree').jstree(
            {'core': {'multiple': false, 'data': treeData, 'themes': {name: 'proton', responsive: true}}}
        )
    }

    $scope.fitGraph = function(){
        $timeout(function(){
            if ($scope.chart) {
                $scope.chart.fit();
            }
        },1000)
    };

    function drawGraph(options) {
        let vo = v2ToFhirSvc.makeGraph(options)

        var container = document.getElementById('bundleGraph');
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



})
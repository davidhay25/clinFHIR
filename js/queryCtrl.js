angular.module("sampleApp").controller('queryCtrl',function($scope,$rootScope,$uibModal,$localStorage,appConfigSvc,resourceCreatorSvc,
                                 profileCreatorSvc,GetDataFromServer,ResourceUtilsSvc){

    $scope.config = $localStorage.config;
    $scope.operationsUrl = $scope.config.baseSpecUrl + "operations.html";
    $scope.input = {serverType:'known'};  //serverType allows select from known servers or enter ad-hoc
    $scope.result = {selectedEntry:{}}
    $scope.ResourceUtilsSvc = ResourceUtilsSvc;

    $scope.queryHistory = $localStorage.queryHistory;
    $scope.makeUrl = function(type) {
        return  $scope.config.baseSpecUrl + type;
    }

    setDefaultInput();



    $localStorage.queryHistory = $localStorage.queryHistory || [];


    $scope.treeNodeSelected = function(item) {

        delete $scope.edFromTreeNode;
        if (item.node && item.node.data && item.node.data.ed) {
            $scope.edFromTreeNode = item.node.data.ed;
            $scope.$digest();       //the event originated outside of angular...
        }

    };



    //the profile is uri - ie it doesn't point directly to the resource

    $scope.showProfileByUrl = function(uri) {


        delete $scope.selectedProfile;
        //first get the profile from the conformance server

        GetDataFromServer.findConformanceResourceByUri(uri).then(
            function(profile) {
                //now get the profile
                $scope.selectedProfile = profile;



            }
        )


    }

    //note that the parameter is a URL - not a URI
    $scope.showProfile = function(url) {

        delete $scope.selectedProfile;
        if (url.substr(0,4) !== 'http') {
            //this is a relative reference. Assume that the profile is on the current conformance server
            url = $scope.config.servers.conformance + url;

        }


        //generate a display of the profile based on it's URL. (points directly to the SD)
        resourceCreatorSvc.getProfileDisplay(url).then(
            function(vo) {
                $scope.filteredProfile = vo.lst;
                $scope.selectedProfile = vo.profile;
            },
            function(err){

            }
        );
    };



    //select a server. If 'server' is populated then we've selected a known server. If url is populated then an ad-hoc url has been entered
    $scope.selectServer = function(server,url) {

        if (url) {
            server = {name:'Ad Hoc server',url:url}
        }



        $scope.input.parameters = "";
        delete $scope.filteredProfile;
        delete $scope.response;
        delete $scope.err;
        delete $scope.conformance;
        delete $scope.input.selectedType;

        $scope.server =server;

        $scope.waiting = true;
        resourceCreatorSvc.getConformanceResource($scope.server.url).then(
            function (data) {
               // $scope.conformanceForQuery = data.data;
                $scope.conformance = data.data;
                console.log($scope.conformance);
                //analyseConformance(data.data);      //figure out the server capabi

            },function (err) {
                alert('Error loading conformance resource:'+angular.toJson(err));
            }
        ).finally(function(){
            $scope.waiting = false;
        })



        $scope.buildQuery();        //builds the query from the params on screen

    };




    //whan a resource tye is selected
    $scope.typeSelected = function(type) {

        var ar = $scope.conformance.rest[0].resource;

        for (var i = 0; i < ar.length ; i++) {
            if (ar[i].type == type.name) {
                //this is the definition of the type...
                var t = ar[i];
                $scope.queryParam = t.searchParam;
                console.log($scope.queryParam);
                $scope.buildQuery();
                break;
            }
        }


    }


    $scope.addParamToQuery = function(modelUrl) {
        $uibModal.open({
            templateUrl: 'modalTemplates/queryParam.html',
            //size: 'lg',
            controller: function ($scope,paramList) {
                $scope.paramList = paramList;
                $scope.input = {};

                $scope.close = function() {
                    $scope.$close({param:$scope.input.param,value:$scope.input.paramValue})
                }


            },
            resolve : {
                paramList: function () {          //the default config
                    console.log($scope.queryPara)
                    return $scope.queryParam;
                }
            }}).result.then(function(vo) {
                console.log(vo)
                if (vo) {
                    delete $scope.response;

                    if ($scope.input.parameters) {
                        $scope.input.parameters = $scope.input.parameters + '&'
                    } else {
                        $scope.input.parameters =""
                    }
                    $scope.input.parameters += vo.param.name + '=' + vo.value;
                    $scope.buildQuery()
                }



        })
    };



    $scope.addParamToQueryDEP = function(param,value) {

        delete $scope.response;

        if ($scope.input.parameters) {
            $scope.input.parameters = $scope.input.parameters + '&'
        } else {
            $scope.input.parameters =""
        }
        $scope.input.parameters += param.name + '=' + value;
    }


    $scope.buildQuery = function() {
        delete $scope.anonQuery;
        delete $scope.query;
        delete $scope.response;
        var qry = '';//$scope.server.url;

        if ($scope.input.selectedType){
            qry += $scope.input.selectedType.name;
        }



        if ($scope.input.parameters) {
            qry += "?"+$scope.input.parameters;
        }


        $scope.anonQuery = qry;     //the query, irrespective of the server...
        $scope.query = $scope.server.url + qry;     //the query againts the current server...

    };

    function setDefaultInput() {
        var type = angular.copy($scope.input.selectedType);
        // var server = angular.copy($scope.input.server);
        $scope.input = {serverType:'known'};
        $scope.input.localMode = 'serverquery'
        $scope.input.verb = 'GET';
       // $scope.input.category="parameters";
        if (type) {
            $scope.input.selectedType = type;       //remember the type
        }
        //  $scope.input.server =server;
    }

    $scope.selectFromHistory = function(hx){
        if ($scope.server) {

            delete $scope.conformance;
            $scope.input.selectedType = {name:hx.type};
            $scope.input.parameters = hx.parameters;
            $scope.input.verb = hx.verb;
            $scope.buildQuery();
        }

    };

    $scope.showConformanceDEP = function(){
        delete $scope.filteredProfile;
        if ($scope.server) {
            $scope.waiting = true;
            resourceCreatorSvc.getConformanceResource($scope.server.url).then(
                function (data) {

                    $scope.conformance = data.data      //setting the conformance variable shows the de
                },function (err) {
                    alert('Error loading conformance resource:'+angular.toJson(err));
                }
            ).finally(function(){
                $scope.waiting = false;
            })
        }
    };

    $scope.removeConformance = function(){
        delete  $scope.conformance;
    };


    //todo - allow the conformance to be selected - maybe a separate function...
    $scope.loadConformance = function(url) {
        $scope.waiting = true;
        delete $scope.filteredProfile;
        delete $scope.selectedType;
        url = url || "http://fhir.hl7.org.nz/baseDstu2/Conformance/ohConformance";


        resourceCreatorSvc.getConformanceResourceFromUrl(url).then(
            function (data) {

                $scope.conformance = data.data
            },function (err) {
                alert('Error loading conformance resource:'+angular.toJson(err));
            }
        ).finally(function(){
            $scope.waiting = false;
        })
    };

    $scope.createConformanceQualityReport = function() {
        $scope.waiting = true;
        resourceCreatorSvc.createConformanceQualityReport($scope.conformance).then(
            function(report) {
                $scope.qualityReport = report;

                $scope.waiting = false;
            }
        );

    };

    //the handler for when a valueset is selected from within the <show-profile component on conformanceDisplay.html
    $scope.showValueSetForProfile = function(url){
        //url is actually a URI


        GetDataFromServer.getValueSet(url).then(
            function(vs) {

                $scope.showVSBrowserDialog.open(vs);

            }
        ).finally (function(){
            $scope.showWaiting = false;
        });
    };

    /*
    //when the user selects a reference to a profiled resource....
    $scope.showReferencedProfileDEP = function(uri) {


        //retrieve the profile based on its URI and re-set the selected profile

        GetDataFromServer.findConformanceResourceByUri(uri).then(
            function(profile) {

                $scope.selectedProfile = profile;
            },
            function(err) {
                console.log(err)
            }
        )

    };

    */

    //when a resource type is selected in the list
    $scope.showType = function(type){
        delete $scope.selectedProfile;
        $scope.selectedType = type;

        delete $scope.filteredProfile;

        //note that the reference is a URL - ie a direct reference to the SD - not a URI...
        if (type.profile && type.profile.reference) {
            //there is an issue that the url for the 'base' resources is not resolving - eg
            //http://hl7.org/fhir/profiles/Account *should* be a direft reference to the SD for Account - but it doesn't
            //for the moment we'll do a 'search by url' for these ones...
            var reference = type.profile.reference;
            if (reference.indexOf('http://hl7.org/fhir/')> -1) {
                //this is needs to be treated as a URI, and we have to change it a bit...
                reference=reference.replace('profiles','StructureDefinition')       //this seems wrong...
                reference=reference.replace('Profile','StructureDefinition')

                localFindProfileByUri(reference)

            } else {
                //this is a 'real' reference - ie it is a resolvable URL...
                $scope.showProfile(reference);
            }
        } else {
            //there is no profile - only a 'type' element.
            var type = type.type;       //this is the base resource type
            var uri = 'http://hl7.org/fhir/StructureDefinition/'+type;
            localFindProfileByUri(uri);     //contained function
        }

        function localFindProfileByUri(uri){
            $scope.waiting = true;
            GetDataFromServer.findConformanceResourceByUri(uri).then(
                function(profile){
                    $scope.selectedProfile = profile;
                    $scope.filteredProfile = profileCreatorSvc.makeProfileDisplayFromProfile(profile)
                },
                function(err) {
                    alert(angular.toJson(err))
                }
            ).finally(function(){
                $scope.waiting = false;
            })
        }

    };

    $scope.doit = function() {
        $scope.buildQuery();        //always make sure the query is correct;
        delete $scope.response;
        delete $scope.err;
        delete $scope.result.selectedEntry;
        $scope.waiting = true;
        resourceCreatorSvc.executeQuery('GET',$scope.query).then(
            function(data){

                $scope.response = data;


                var hx = {
                    anonQuery:$scope.anonQuery,
                    type:$scope.input.selectedType.name,
                    parameters:$scope.input.parameters,
                    server : $scope.server,
                   // id:$scope.input.id,
                    verb:$scope.input.verb};


                $scope.queryHistory = resourceCreatorSvc.addToQueryHistory(hx)
                //delete $scope.input.id;
                $scope.input.parameters = "";

            },
            function(err) {
                $scope.err = err;

            }
        ).finally(function(){
            $scope.waiting = false;
            setDefaultInput();
        })
    }

    $scope.server = appConfigSvc.getCurrentDataServer();
    $scope.selectServer($scope.server)


    //when the page was invoked, a conformance url was specified so display that...
    //assume the conformance url is on the NZ server...

    /*
    $scope.startup = $rootScope.startup;        //put it on the scope so the html page can access i..
    if ($rootScope.startup && $rootScope.startup.conformanceUrl) {
       // $scope.input.localMode = 'showconformance';
        $scope.config.servers.conformance = "http://fhir.hl7.org.nz/dstu2/";
        var url = "http://fhir.hl7.org.nz/dstu2/Conformance/" + $rootScope.startup.conformanceUrl;
        $scope.loadConformance(url);
    }
*/

})
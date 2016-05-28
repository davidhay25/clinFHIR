angular.module("sampleApp").controller('valuesetCtrl',
    function ($scope, Utilities, appConfigSvc,SaveDataToServer,GetDataFromServer,resourceCreatorSvc,modalService) {

    $scope.hw = 'hw'
    $scope.results = {};
    $scope.input = {};
        $scope.input.searchName = 'cond'

    var config = appConfigSvc.config();
    $scope.valueSetRoot = config.servers.terminology + "ValueSet/";
        //var qry = config.servers.terminology + "ValueSet/"+name+"/$expand?filter="+filter;
    var svr = appConfigSvc.getServerByUrl(config.servers.terminology);
    if (svr.version <3) {
        var config = {bodyText:"Warning: this application needs to work with a Terminology Server supporting version 3 of FHIR"}
        modalService.showModal({}, config).then(function (result) {
            //this is the 'yes'
            $scope.displayMode = 'front';
        })
    }

    $scope.arScopingValueSet = [];
    $scope.arScopingValueSet.push()
    $scope.showScopingValueSet = true;  //allows the scping valueset to be selected in the search...

    function createNewValueSet(id) {
        $scope.vs = {resourceType : "ValueSet", status:'draft',compose:{include:[]}};
        $scope.url = $scope.valueSetRoot+id;
        $scope.vs.id=id;       //the id of the vs on the terminology server
        $scope.include = {system:'http://snomed.info/sct',concept:[]};
        $scope.includeForFilter = {system:'http://snomed.info/sct',filter:[]};


        $scope.vs.compose.include.push($scope.include);
        $scope.vs.compose.include.push($scope.includeForFilter);
        // $scope.vs.compose.filter.push(filter);
        $scope.include.concept.push({code:"170631002",display:'Asthma disturbing sleep'})
        $scope.include.concept.push({code:"280137006",display:'Diabetic foot'})
    }

    //remove an 'included' concept
    $scope.removeInclude = function (conceptToRemove) {
        //console.log(conceptToRemove)

        for (var i=0; i < $scope.vs.compose.include.length; i++) {
            var include = $scope.vs.compose.include[i];
            //console.log(include)
            if (include.concept) {
                for (var j=0; j< include.concept.length; j++){
                    var concept = include.concept[j];

                    //console.log(concept)
                    if (conceptToRemove.code == concept.code) {
                        console.log('de')
                        include.concept.splice(j,1)
                        break;
                    }
                }

            }

        }
    };

    $scope.removeIsa = function (filtertToRemove) {
        //console.log(conceptToRemove)

        for (var i=0; i < $scope.vs.compose.include.length; i++) {
            var include = $scope.vs.compose.include[i];
            //console.log(include)
            if (include.filter) {
                for (var j=0; j< include.filter.length; j++){
                    var filter = include.filter[j];

                    //console.log(concept)
                    if (filter.value == filtertToRemove.value) {
                        console.log('de')
                        include.filter.splice(j,1)
                        break;
                    }
                }

            }

        }
    };


    //createNewValueSet("dhtest");


    $scope.vsReference = true;      //to show the included file

    var reference = "http://hl7.org/fhir/ValueSet/condition-code";


    $scope.search = function(filter){
        $scope.showWaiting = true;
        var url = config.servers.terminology + "ValueSet?name="+filter;
        GetDataFromServer.adHocFHIRQuery(url).then(
            function(data){
                $scope.searchResultBundle = data.data;
            },
            function(err){
                alert(angular.toJson(err))
            }
        ).finally(function(){
            $scope.showWaiting = false;
        })
    };
        
    $scope.selectVs = function(vs) {
        delete $scope.canEdit;
        delete $scope.input.vspreview;
        $scope.vs = vs;
        if (isAuthoredByClinFhir(vs)){
            $scope.canEdit = true;
        }
    };

    //add a new concept to the ValueSet
    $scope.addConcept = function(){
      
        $scope.include.concept.push({code:$scope.results.cc.code,display:$scope.results.cc.display})
    };

    $scope.isAConcept = function() {

        $scope.includeForFilter.filter.push({property:'concept',op:'is-a',value:$scope.results.cc.code})

    };

    $scope.expand = function(filter){
        delete $scope.expansion;
        $scope.showWaiting = true;
        if (filter){
            GetDataFromServer.getFilteredValueSet($scope.vs.id,filter).then(
                function(data){
                    console.log(data)
                    $scope.expansion = data.expansion;
                }
            ).finally(function(){
                $scope.showWaiting = false;
            });
        } else {
            GetDataFromServer.getExpandedValueSet($scope.vs.id).then(
                function(data) {
                    console.log(data)
                    $scope.expansion = data.expansion;
                }
            ).finally(function(){
                $scope.showWaiting = false;
            });
        }
    };

    $scope.save = function () {
        $scope.vs.id = $scope.vsId
        SaveDataToServer.saveValueSetToTerminologyServerById($scope.vsId,$scope.vs).then(
            function (data) {
                console.log(data)
                alert('ValueSet saved.')
            },
            function (err) {
                alert(angular.toJson(err))
            }
        )
    };

    function isAuthoredByClinFhir(vs) {
        var isAuthoredByClinFhir = false;
        if (vs.code) {
            vs.code.forEach(function(coding){
                if (coding.system == 'http://fhir.hl7.org.nz/NamingSystem/application' &&
                    coding.code == 'clinfhir') {
                    isAuthoredByClinFhir = true;
                }
            })
        }
        return isAuthoredByClinFhir;
    }

    //=========== most of these finctions are copied from resourceCreatorCtrl. Thre are better ways of reuse !....  ==========
    Utilities.getValueSetIdFromRegistry(reference,function(vsDetails) {
            $scope.vsDetails = vsDetails;
        }
    );

    //when the user has selected an entry from the autocomplete...
    $scope.selectCCfromList = function(item,model,label,event){
        //get the full lookup for this code - parents, children etc.
        $scope.results.cc = $scope.results.cc || {};


        $scope.results.cc.system = item.system;
        $scope.results.code = item.code;
        $scope.results.display = $scope.results.cc.display;

        $scope.results.ccDirectCode = item.code;
        $scope.results.ccDirectSystem = item.system;
        $scope.results.ccDirectDisplay = $scope.results.cc.display;

        resourceCreatorSvc.getLookupForCode(item.system,item.code).then(
            function(data) {
                console.log(data);
                $scope.terminologyLookup = resourceCreatorSvc.parseCodeLookupResponse(data.data)
                console.log($scope.terminologyLookup);
            },
            function(err) {
                //this will generally occur when using stu-2 - so ignore...
                alert(angular.toJson(err));
            }
        );

    };

    //--------- code for CodeableConcept lookup
    $scope.vsLookup = function(text,vs) {

        console.log(text,vs)
        if (vs) {
            $scope.waiting = true;
            return GetDataFromServer.getFilteredValueSet(vs,text).then(
                function(data,statusCode){
                    if (data.expansion && data.expansion.contains) {
                        var lst = data.expansion.contains;
                        return lst;
                    } else {
                        return [
                            {'display': 'No expansion'}
                        ];
                    }
                }, function(vo){
                    var statusCode = vo.statusCode;
                    var msg = vo.error;


                    alert(msg);

                    return [
                        {'display': ""}
                    ];
                }
            ).finally(function(){
                $scope.waiting = false;
            });

        } else {
            return [{'display':'Select the ValueSet to query against'}];
        }
    };

    function setTerminologyLookup(system,code) {
        resourceCreatorSvc.getLookupForCode(system,code).then(
            function(data) {
               // console.log(data);
                $scope.terminologyLookup = resourceCreatorSvc.parseCodeLookupResponse(data.data)
               // console.log($scope.terminologyLookup);
            },
            function(err) {
                alert(angular.toJson(err));
            }
        );
    }

    $scope.selectChildTerm = function(code,display){
        $scope.results.ccDirectDisplay = display;
        $scope.results.ccDirectCode = code;

        $scope.results.cc.code = code;
        $scope.results.cc.display = display;

        console.log($scope.results.cc)
        setTerminologyLookup($scope.results.ccDirectSystem,code)
    }

    //the user selects the parent...
    $scope.selectParentCC = function() {
        $scope.results.ccDirectDisplay = $scope.terminologyLookup.parent.description;
        $scope.results.ccDirectCode = $scope.terminologyLookup.parent.value;
        //look up the relations to this one...
        setTerminologyLookup($scope.results.ccDirectSystem,$scope.results.ccDirectCode)


        //$scope.results.cc = $scope.terminologyLookup.parent;
        //console.log('s')
    };

    //use the terminology operation CodeSystem/$lookup to get details of the code / system when manually entered
    $scope.lookupCode = function(system,code) {


        resourceCreatorSvc.getLookupForCode(system,code).then(
            function(data) {
                console.log(data);
                $scope.lookupResult = data.data;
                $scope.terminologyLookup = resourceCreatorSvc.parseCodeLookupResponse(data.data)
                $scope.results.ccDirectDisplay = $scope.terminologyLookup.display;

                //console.log($scope.terminologyLookup);

            },
            function(err) {
                alert(angular.toJson(err));
            }
        )
    };


});
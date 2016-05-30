angular.module("sampleApp").controller('valuesetCtrl',
    function ($scope, Utilities, appConfigSvc,SaveDataToServer,GetDataFromServer,resourceCreatorSvc,modalService,
            $uibModal) {

    //$scope.hw = 'hw'
    $scope.results = {};
    $scope.input = {};
    //$scope.input.searchName = 'dhay';

        //register that the application has been started... (for reporting)
        resourceCreatorSvc.registerAccess();
        
    $scope.state = 'find';      // edit / new / find
    $scope.input.conceptCache = {};        //hash to store the lookup details of a concept. todo We could cache this...

    var config = appConfigSvc.config();
    var termServ = config.servers.terminology;      //the currently configured terminology server

    //--------- terminology servers........

    $scope.terminologyServers = [];
    config.terminologyServers.forEach(function(svr){

        if (svr.version == 3) {
            $scope.terminologyServers.push(svr);
            if (svr.url == termServ) {
                $scope.termServer = svr;
            }
        }
    });


    //----- changing the terminology server...
    $scope.changeTerminologyServer = function(svr){
        appConfigSvc.setServerType('terminology',svr.url)
        $scope.valueSetRoot = config.servers.terminology + "ValueSet/";
    };

        
    $scope.valueSetRoot = config.servers.terminology + "ValueSet/";
        //var qry = config.servers.terminology + "ValueSet/"+name+"/$expand?filter="+filter;

        //console.log(config.servers.terminology)
    var svr = appConfigSvc.getServerByUrl(config.servers.terminology);

    if (svr){
        if (svr.version <3) {
            var config = {bodyText:"Warning: this application needs to work with a Terminology Server supporting version 3 of FHIR"}
            modalService.showModal({}, config).then(function (result) {
                //this is the 'yes'
                $scope.displayMode = 'front';
            })
        }
    } else {
        alert("There was a unrecognized server url: "+ config.servers.terminology)
    }


    $scope.arScopingValueSet = [];
    $scope.arScopingValueSet.push()
    $scope.showScopingValueSet = true;  //allows the scping valueset to be selected in the search...


    $scope.vsReference = true;      //to show the included file

    //var reference = "http://hl7.org/fhir/ValueSet/condition-code";
    var reference = "http://hl7.org/fhir/ValueSet/condition-cause";
                     //http://fhir3.healthintersections.com.au/open/ValueSet/condition-cause

    //make a copy of the current vs
    $scope.copyVs = function(){
        $scope.newVs($scope.vs);
        $scope.input.isDirty = true;
    };

    $scope.newVs = function(vs) {
        delete $scope.vs;
        delete $scope.searchResultBundle;
        $scope.state='new';

        $uibModal.open({
            backdrop: 'static',      //means can't close by clicking on the backdrop. stuffs up the original settings...
            keyboard: false,       //same as above.
            templateUrl: 'modalTemplates/inputValueSetName.html',
            size:'lg',
            controller: function($scope,GetDataFromServer,config,modalService){
                $scope.checkName = function(name){
                    var url = config.servers.terminology + "ValueSet/"+name;
                    GetDataFromServer.adHocFHIRQuery(url).then(
                        function(){
                            //it found a valueset with that name
                            modalService.showModal({}, {bodyText: 'Sorry, this valueSet already exists.'})
                        },
                        function(err){
                            console.log(err);
                            $scope.nameValid = true;
                        }
                    );


                }
            }, resolve : {
                config: function () {          //the default config
                    return config;

                }
            }
        }).result.then(
            function(name){
                console.log(name)
                createNewValueSet(name,vs)
                $scope.canEdit = true;
            },
            function() {
                //if the user cancels...
            }
        )
    
        
    };

    //create a new ValueSet. If vs is passed in, then use that as the basis...
    function createNewValueSet(id,vs) {

        console.log(vs)
        if (vs) {
            //passing in a copy of the ValueSet to copy...
            $scope.vs = vs;
            $scope.vs.id=id;       //the id of the vs on the terminology server
            $scope.vs.name = id;
            $scope.vs.compose.include.forEach(function(inc){
                if (inc.concept) {
                    $scope.include = inc;
                } else if (inc.filter) {
                    $scope.includeForFilter = inc;
                }
            });

            //establish the separate variables that reference the include.concept and include.filter
            $scope.include =  $scope.include || {system:'http://snomed.info/sct',concept:[]};
            $scope.includeForFilter = $scope.includeForFilter || {system:'http://snomed.info/sct',filter:[]};


        } else {
            //a new ValueSet
            $scope.vs = {resourceType : "ValueSet", status:'draft', id: id,compose:{include:[]}};
            $scope.vs.name = id;        //so the search will work on id
            $scope.url = $scope.valueSetRoot+id;


            //establish the separate variables that reference the include.concept and include.filter
            $scope.include = {system:'http://snomed.info/sct',concept:[]};
            $scope.includeForFilter = {system:'http://snomed.info/sct',filter:[]};

        }

        //the contact must include clinfhir to allow editing...
        $scope.vs.contact = $scope.vs.contact || []
        $scope.vs.contact.push({name : 'clinfhir'})

    }

    //remove an 'included' concept
    $scope.removeInclude = function (conceptToRemove) {
        //console.log(conceptToRemove)
        var includeToDelete = -1;
        for (var i=0; i < $scope.vs.compose.include.length; i++) {
            var include = $scope.vs.compose.include[i];
            //console.log(include)
            if (include.concept) {
                for (var j=0; j< include.concept.length; j++){
                    var concept = include.concept[j];

                    //console.log(concept)
                    if (conceptToRemove.code == concept.code) {

                        include.concept.splice(j,1);
                        $scope.input.isDirty = true;
                        if (include.concept.length ==0 ){
                            includeToDelete = i;
                        }
                        break;
                    }
                }

            }

        }

        if (includeToDelete > -1) {
            $scope.include.filter.length = 0;
            $scope.vs.compose.include.splice(includeToDelete,1)
        }
    };

    $scope.removeIsa = function (filtertToRemove) {
        //console.log(conceptToRemove)
        var includeToDelete = -1;

        for (var i=0; i < $scope.vs.compose.include.length; i++) {
            var include = $scope.vs.compose.include[i];
            //console.log(include)
            if (include.filter) {
                for (var j=0; j< include.filter.length; j++){
                    var filter = include.filter[j];

                    //console.log(concept)
                    if (filter.value == filtertToRemove.value) {
                        include.filter.splice(j,1)
                        $scope.input.isDirty = true;
                        if (include.filter.length ==0 ){
                            includeToDelete = i;
                        }
                        break;
                    }
                }

            }

        }

        if (includeToDelete > -1) {
            $scope.includeForFilter.filter.length = 0;
            $scope.vs.compose.include.splice(includeToDelete,1)
        }
    };


    //find matching ValueSets based on name
    $scope.search = function(filter){
        $scope.showWaiting = true;
        delete $scope.searchResultBundle;
        delete $scope.message;
        //var url = config.servers.terminology + "ValueSet?name="+filter;

        var url = $scope.valueSetRoot+"?name="+filter;

        GetDataFromServer.adHocFHIRQuery(url).then(
            function(data){
                $scope.searchResultBundle = data.data;
                if (! data.data || ! data.data.entry || data.data.entry.length == 0) {
                    $scope.message = 'No matching ValueSets found'
                }
            },
            function(err){
                alert(angular.toJson(err))
            }
        ).finally(function(){
            $scope.showWaiting = false;
        })
    };

    //select a ValueSet from the search set...
    $scope.selectVs = function(vs) {
        delete $scope.input.hasSystem;
        delete $scope.input.hasIsa;
        delete $scope.input.hasConcept;
        delete $scope.input.isDirty;
        delete $scope.canEdit;
        delete $scope.input.vspreview;
        delete $scope.expansion;
        $scope.vs = vs;
        $scope.state='edit';


        //get the details of any 'is-a' codes so we can display the name in th eUI
        if (vs.compose && vs.compose.include) {
            vs.compose.include.forEach(function (inc) {

                //this initializes the separate variables pointing at the concept & filter elements...
                if (inc.concept) {
                    $scope.include = inc;
                } else if (inc.filter) {
                    $scope.includeForFilter = inc;
                }




                if (inc.filter) {
                    inc.filter.forEach(function (filter) {
                        console.log(filter)
                        if (! $scope.input.conceptCache[filter.value]) {

                             resourceCreatorSvc.getLookupForCode("http://snomed.info/sct",filter.value).then(
                                 function(data) {
                                     console.log(data);
                                     if (data.data.parameter) {
                                         var parameter = data.data.parameter;
                                         for (var i=0; i < parameter.length;i++) {
                                             if (parameter[i].name == 'display') {
                                                 $scope.input.conceptCache[filter.value] = parameter[i].valueString;
                                                 console.log(parameter[i].valueString)
                                                 break;
                                             }
                                         }
                                     }


                                     },
                                     function(err) {
                                        alert(angular.toJson(err));
                                 }
                             )


                        }


                    })
                }

            })

        }

        //these are the 'pointer' variables,,,
        $scope.include =  $scope.include || {system:'http://snomed.info/sct',concept:[]};
        $scope.includeForFilter = $scope.includeForFilter || {system:'http://snomed.info/sct',filter:[]};


        if (isAuthoredByClinFhir(vs)){
            $scope.canEdit = true;
        }
    };

    //return to the selected list
    $scope.backToList = function(){
        if ($scope.input.dirty) {
            alert('dirty')
        }

        delete $scope.vs;
        $scope.state='find';

    };

    //add a new concept to the ValueSet
    $scope.addConcept = function(){

        //$scope.vs.compose.include.push($scope.include);
        //$scope.vs.compose.include.push($scope.includeForFilter);


        if ($scope.include.concept.length == 0) {
            $scope.vs.compose.include.push($scope.include);
        }

        $scope.include.concept.push({code:$scope.results.cc.code,display:$scope.results.cc.display})
        $scope.input.isDirty = true;
    };

    //add an 'is-a' concept
    $scope.isAConcept = function() {

      //  var isaElement;

    if ($scope.includeForFilter.filter.length == 0) {
        $scope.vs.compose.include.push($scope.includeForFilter);
    }

        $scope.includeForFilter.filter.push({property:'concept',op:'is-a',value:$scope.results.cc.code})
        $scope.input.isDirty = true;
    };

    $scope.expand = function(filter){
        delete $scope.expansion;
        $scope.showWaiting = true;
        if (filter){
            GetDataFromServer.getFilteredValueSet($scope.vs.id,filter).then(
                function(data){
                    console.log(data)
                    $scope.expansion = data.expansion;
                },
                function(err){
                    alert(angular.toJson(err))
                }
            ).finally(function(){
                $scope.showWaiting = false;
            });
        } else {
            GetDataFromServer.getExpandedValueSet($scope.vs.id).then(
                function(data) {
                    console.log(data)
                    $scope.expansion = data.expansion;
                },
                function(err){
                    alert(angular.toJson(err))
                }
            ).finally(function(){
                $scope.showWaiting = false;
            });
        }
    };

    $scope.save = function () {
      //  $scope.vs.id = $scope.vsId

       // $scope.vs

        $scope.showWaiting = true;

        SaveDataToServer.saveValueSetToTerminologyServerById($scope.vs.id,$scope.vs).then(
            function (data) {
                console.log(data)
                alert('ValueSet saved.')
                $scope.input.isDirty = false;
            },
            function (err) {
                alert(angular.toJson(err))
            }
        ).finally(function(){
            $scope.showWaiting = false;
        })
    };

    function isAuthoredByClinFhir(vs) {
        var isAuthoredByClinFhir = false;
        if (vs.contact) {
            vs.contact.forEach(function(contact){
                if (contact.name == 'clinfhir') {
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
            $scope.showWaiting = true;
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
                $scope.showWaiting = false;
            });

        } else {
            return [{'display':'Select the ValueSet to query against'}];
        }
    };

    function setTerminologyLookup(system,code) {
        $scope.showWaiting = true;
        resourceCreatorSvc.getLookupForCode(system,code).then(
            function(data) {
                console.log(data);
                $scope.terminologyLookup = resourceCreatorSvc.parseCodeLookupResponse(data.data)
               // console.log($scope.terminologyLookup);
            },
            function(err) {
                alert(angular.toJson(err));
            }
        ).then(function(){
            $scope.showWaiting = false;
        });
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
    $scope.selectParentCC = function(parent) {
        $scope.results.ccDirectDisplay = parent.description;
        $scope.results.ccDirectCode = parent.value;
        //look up the relations to this one...
        setTerminologyLookup($scope.results.ccDirectSystem,$scope.results.ccDirectCode)
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
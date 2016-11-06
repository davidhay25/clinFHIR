/*has been deprectde - don't call make function - expensive! */

angular.module("sampleApp").controller('extensionDefCtrl',
        function ($rootScope,$scope,$uibModal,appConfigSvc,GetDataFromServer,Utilities,modalService,RenderProfileSvc,$http) {

            $scope.childElements = [];      //array of child elements
            $scope.input ={};
            $scope.input.multiplicity = 'opt';
            $scope.selectedResourceTypes = [];
            
            RenderProfileSvc.getAllStandardResourceTypes().then(
                function(standardResourceTypes) {
                    $scope.allResourceTypes = standardResourceTypes;       //use to define the context for an extension...
                    //console.log($scope.allResourceTypes)
                }
            )

            

            $scope.conformanceSvr = appConfigSvc.getCurrentConformanceServer();

            if ($rootScope.userProfile && $rootScope.userProfile.extDef) {
                $scope.input.publisher = $rootScope.userProfile.extDef.defaultPublisher;
            }

            $scope.selectContext = function(context) {
                console.log(context);
                if ($scope.selectedResourceTypes.indexOf(context.name) == -1) {
                    $scope.selectedResourceTypes.push(context.name)

                    makeSD();
                }

            };

            $scope.removeResourceType = function(inx) {
                $scope.selectedResourceTypes.splice(inx,1);
                makeSD();
            };

            $scope.save = function() {
                delete $scope.validateResults;
                $scope.showWaiting = true;
                var sd = makeSD();

                if (validate(sd)){

                    var url = $scope.conformanceSvr.url + 'StructureDefinition/'+sd.id;
                    $http.put(url,sd).then(
                        function(data){
                            //console.log(data)


                            modalService.showModal({}, {bodyText:"Extension has been saved."}).then(function (result) {

                            },function(){
                                //this is the 'cancel' option - but it's the one fired when there's only a single button...
                                $scope.$close({url:url,sd:sd});
                                console.log('close')
                            })



                        }, function(err){
                            console.log(err)
                            $scope.validateResults = err.data;
                        }
                    ).finally(function(){
                        $scope.showWaiting = false;
                    });

                    /*
                    var url = $scope.conformanceSvr.url+ "StructureDefinition/$validate"
                    $http.post(url,sd).then(
                        function(data){
                            console.log(data)
                        }, function(err){
                            console.log(err)
                            $scope.validateResults = err.data;
                        }
                    )


*/




                    /*  ---- this is a validate operation

                    Utilities.validate(sd,$scope.conformanceSvr.url).then(
                        function(data){
                            console.log(data)
                            var config = {bodyText:''};
                            modalService.showModal({}, config)

                        },function(err){
                            console.log(err)
                            $scope.validateResults = err.data;
                        }
                    ).finally(function(){
                        $scope.showWaiting = false;
                    })

*/
                } else {
                    $scope.showWaiting = false;
                }

            };
            
            $scope.setBinding = function() {
                $uibModal.open({
                    backdrop: 'static',      //means can't close by clicking on the backdrop.
                    keyboard: false,       //same as above.
                    templateUrl: 'modalTemplates/vsFinder.html',
                    size: 'lg',
                    controller: 'vsFinderCtrl'
                }).result.then(
                    function (vo) {
                        console.log(vo)
                    }
                )
            }

            //?? should do this when about to save as well
            $scope.checkEDExists = function(name) {
                var url = $scope.conformanceSvr.url + "StructureDefinition/"+name;
                $scope.showWaiting = true;
                GetDataFromServer.adHocFHIRQuery(url).then(
                    function(data){
                        console.log(data);
                        //if there is already an SDef - see if it authored by clinFHIR - todo
/*
                        if (data.status !== 410) {
                            //410 indicates that the Sdef was deleted, od OK to overwrite
                            var config = {bodyText:'Sorry, that name is already used on the Conformance server'};
                            modalService.showModal({}, config)
                        } else {
                            $scope.canSaveEd = true;
                        }
*/

                        modalService.showModal({}, {bodyText:"Sorry, this name is already in use."})

                    },function(err){
                        console.log(err);
                        //as long as the status is 404 or 410, it's save to create a new one...
                        if (err.status == 404 || err.status == 410) {
                            $scope.canSaveEd = true;
                            
                        } else {
                            var config = {bodyText:'Sorry, there was an unknown error: '+angular.toJson(err,true)};
                            modalService.showModal({}, config)

                        }
                    }).finally(function(){
                    $scope.showWaiting = false;
                })
            };

            //add a new child element...
            $scope.addChild = function () {
                $uibModal.open({

                    templateUrl: 'modalTemplates/newExtensionChild.html',

                    controller: function($scope,resourceCreatorSvc){
                        var that = this;

                        
                        $scope.selectedDataTypes = [];     //array of selected datatypes
                        $scope.dataTypes = resourceCreatorSvc.getDataTypesForProfileCreator();


                        $scope.addDataType = function () {
                            //make sure it's not already in the list...
                            for (var i=0; i< $scope.selectedDataTypes.length; i++){
                                if ($scope.selectedDataTypes[i].description == $scope.dataType.description) {
                                    return;
                                    break;
                                }
                            }

                            $scope.selectedDataTypes.push($scope.dataType)

                        };

                        $scope.removeDT = function(inx) {
                            //console.log(inx)
                            $scope.selectedDataTypes.splice(inx,1)
                        };

                        $scope.setBinding = function(dt) {
                            console.log(dt);
                            $uibModal.open({
                                backdrop: 'static',      //means can't close by clicking on the backdrop.
                                keyboard: false,       //same as above.
                                templateUrl: 'modalTemplates/vsFinder.html',
                                size: 'lg',
                                controller: function($scope,appConfigSvc,GetDataFromServer) {
                                    //this code is all from vsFinderCtrl controller - for some reason I can't reference it from here...
                                    $scope.input = {};

                                    var config = appConfigSvc.config();
                                    $scope.termServer = config.servers.terminology;
                                    //$scope.valueSetRoot = config.servers.terminology + "ValueSet/";

                                    $scope.input.arStrength = ['required','extensible','preferred','example'];
                                    $scope.input.strength = 'preferred'; //currentBinding.strength;


                                    $scope.select = function() {

                                        $scope.$close({vs: $scope.input.vspreview,strength:$scope.input.strength});
                                    };

                                    //find matching ValueSets based on name
                                    $scope.search = function(filter){
                                        $scope.showWaiting = true;
                                        delete $scope.message;
                                        delete $scope.searchResultBundle;

                                        var url = $scope.termServer+"ValueSet?name="+filter;
                                        $scope.showWaiting = true;
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
                                }
                            }).result.then(
                                function (vo) {
                                    //vo is {vs,strength}
                                    console.log(vo)
                                    dt.vs = vo;         //save the valueset against the datatype
                                }
                            )
                        };

                        $scope.save = function(){
                            var result = {};
                            result.code = $scope.code;
                            result.description = $scope.description;
                            result.short = $scope.description;
                            result.dataTypes = $scope.selectedDataTypes;
                            $scope.$close(result);

                        }

                    }
                }).result.then(
                    //this is called when the 'add child element' has been saved
                    function(result) {
                        //console.log(result)
                        $scope.childElements.push(result);

                        makeSD()



                    })


                };


            $scope.removeChild = function(inx){
                $scope.childElements.splice(inx,1)

            };

            var validate = function(sd) {
                //return true;
                var err = "";
                //a single element brings at least 3 entries in the element[] array...
                if (sd.snapshot.element.length < 3) {
                    err += 'There must be at least one element in the extension'
                }

                if (err) {
                    var config = {bodyText:err}
                    modalService.showModal({}, config).then(function (result) {
                       return false;
                    })
                } else {
                    return true;
                }
            };

            //hide the outcome of the validate operation...
            $scope.closeValidationOutcome = function(){
                delete $scope.validateResults;
            };

            //build the StructueDefinition that describes this extension
            makeSD = function() {

                var extensionDefinition = {resourceType:'StructureDefinition'};


                //the version of fhir that this SD is being deployed against...
                var fhirVersion = $scope.conformanceSvr.version;        //get from the conformance server
                var name = $scope.input.name;       //the name of the extension
                var definition = $scope.input.description || $scope.input.name;       //the defintion of the extension. It is required...
                var comments = $scope.input.description;       //the name of the extension
                var short = $scope.input.short;


                extensionDefinition.id = name;

                //to allow for proxied requests...
                var cannonicalUrl =  $scope.conformanceSvr.realUrl || $scope.conformanceSvr.url;
                extensionDefinition.url = cannonicalUrl + name;

                //the format for a simple extensionDefinition SD is different to a complex one...
                var extensionTypeIsMultiple = false;
                if ($scope.childElements.length > 1) {
                    extensionTypeIsMultiple = true;
                }

                //the code is used so clinfhir knows which SD resources it has authored - and can modify...

                extensionDefinition.name = name;
                extensionDefinition.status = 'draft';
                extensionDefinition.abstract= false;
                extensionDefinition.publisher = $scope.input.publisher;
                extensionDefinition.contextType = "resource";

                //if no context defined, then allow all

                if ($scope.selectedResourceTypes.length == 0) {
                    extensionDefinition.context = ['*'];
                } else {
                    extensionDefinition.context = [];
                    $scope.selectedResourceTypes.forEach(function(typ){
                        extensionDefinition.context.push(typ)
                    })

                }

                //at the time of writing (Oct 12), the implementaton of stu3 varies wrt 'code' & 'keyword'. Remove this eventually...
                extensionDefinition.identifier = [{system:"http://clinfhir.com",value:"author"}]

                if (fhirVersion == 2) {
                    extensionDefinition.kind='datatype';
                    extensionDefinition.constrainedType = 'Extension';      //was set to 'kind' which is the search name!
                    extensionDefinition.code = [{system:'http://fhir.hl7.org.nz/NamingSystem/application',code:'clinfhir'}]
                    extensionDefinition.base = 'http://hl7.org/fhir/StructureDefinition/Extension';
                } else if (fhirVersion ==3) {
                    extensionDefinition.kind='complex-type';
                    extensionDefinition.type='Extension';
                    //extensionDefinition.baseType = 'Extension';
                    extensionDefinition.baseDefinition = 'http://hl7.org/fhir/StructureDefinition/Extension';
                    extensionDefinition.derivation = 'constraint';
                    extensionDefinition.contextType = "resource";// "datatype";
                    extensionDefinition.context=["Element"];
                    extensionDefinition.keyword = [{system:'http://fhir.hl7.org.nz/NamingSystem/application',code:'clinfhir'}]
                }

                var min,max;
                switch ($scope.input.multiplicity) {
                    case 'opt' :
                        min=0; max = "1";
                        break;
                    case 'req' :
                        min=1; max='1';
                        break;
                    case 'mult' :
                        min=0; max='*';
                        break;
                }

                extensionDefinition.snapshot = {element:[]};

                if (extensionTypeIsMultiple) {
                    var ed1 = {path : 'Extension',name: name,short:short,definition:definition,
                        comments:comments,min:min,max:max,type:[{code:'Extension'}]};


                    ed1.id = ed1.path;




                    extensionDefinition.snapshot.element.push(ed1);

                    var edSlicing = {path : 'Extension.extension',name: name,short:short,definition:definition,
                        comments:comments,min:min,max:max,type:[{code:'Extension'}]};
                    edSlicing.slicing = {discriminator:['url'],ordered:false,rules:'open'}

                    edSlicing.id = edSlicing.path;
                    extensionDefinition.snapshot.element.push(edSlicing);


                }

                //for each defined child, add the component ElementDefinition elements...
                $scope.childElements.forEach(function(ce,inx){
                    var vo = ce;
                    vo.min = min;
                    vo.max = max;

                    extensionDefinition.snapshot.element = extensionDefinition.snapshot.element.concat(makeChildED(vo,extensionTypeIsMultiple,inx))


                });


                /*  We *may* need to add this with a complex extension (don't know) keep for the moment...

                //the url of this extension. It's at the bottom (not sure why)..
                var edUrl = {path : 'Extension.url',name: name,short:short,definition:definition,
                    min:1,max:"1",type:[{code:'uri'}],fixedUri:$scope.conformanceSvr.url + name};

                edUrl.id = edUrl.path;
                extensionDefinition.snapshot.element.push(edUrl);
*/

                $scope.jsonED = extensionDefinition;    //just for display

                //console.log(JSON.stringify(extensionDefinition));



                if (fhirVersion ==3 && extensionDefinition.snapshot && extensionDefinition.snapshot.element) {
                    delete extensionDefinition.snapshot.element[0].type;
                }



                //ensure that all the elements have the name set...
                extensionDefinition.snapshot.element.forEach(function(ed){
                    ed.name = name;
                })


                return extensionDefinition;

            };

            //build the ElementDefinitions for a single child
            function makeChildED(vo,isComplex,index){
                //vo.name, vo.short, vo.definition, vo.comments, vo.min, vo.max, vo.code, vo.dataTypes[code,description]
                //console.log(vo)

                vo.description = vo.description || 'No Description'

                //if complex, then the root is '1 level down'. Remember we only support a single level of complexity...
                var extensionRoot = 'Extension';
                if (isComplex) {
                    extensionRoot = 'Extension.extension';
                }

                var arED = [];
                var ed1 = {path : extensionRoot,name: vo.code,min:vo.min,max:vo.max,
                    short:vo.short,definition:vo.description,
                    comments:vo.comments,min:vo.min,max:vo.max,type:[{code:'Extension'}]};

                ed1.base = {path: ed1.path,min:ed1.min, max:ed1.max};


                var ed2 = {path : extensionRoot + '.url',name: vo.code,representation:['xmlAttr'],
                    comments:vo.comments,definition:vo.description,min:1,max:"1",type:[{code:'uri'}],fixedUri:vo.code};

                ed2.base = {path: ed2.path,min:ed2.min, max:ed2.max};

                //the value name is 'value' + the code with the first letter capitalized, or value[x] if more than one...
                var valueName = '[x]';
                if (vo.dataTypes.length == 1) {
                    valueName = vo.dataTypes[0].code;
                    valueName = valueName[0].toUpperCase()+valueName.substr(1);
                }

                var ed3 = {path : extensionRoot + '.value'+valueName,name: vo.name,short:vo.short,definition:vo.definition,
                    comments:vo.comments,definition:vo.description,min:vo.min,max:vo.max,type:[]};
                vo.dataTypes.forEach(function(type){

                    ed3.base = {path: ed3.path,min:ed3.min, max:ed3.max};

                    ed3.type.push({code:type.code})

                    if (type.vs) {
                        //this is a bound valueset
                        ed3.binding = {strength : type.vs.strength,valueSetUri:type.vs.vs.url,description:vo.description}
                    }

                });

                //required by STU-3
                ed1.id = ed1.path + index;
                ed2.id = ed2.path + index;
                ed3.id = extensionRoot + '.value[x]' + index;


                arED.push(ed1);
                arED.push(ed2);
                arED.push(ed3);
                return arED;

            }


    }



);
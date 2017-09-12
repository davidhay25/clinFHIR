
angular.module("sampleApp")

    .service('edBuilderSvc', function(Utilities,securitySvc,appConfigSvc) {


        return {
            makeED : function(voED) {
                //construct the ED (a StructureDefinition) from a VO
                /*
                    voED.extensionName - name of the extension (as entered by the user ($scope.input.name)
                    voED.description    ($scope.input.description)
                    voED.short
                    voED.url  ($scope.input.url)
                    voED.publisher; //$scope.input.publisher;
                    voED.selectedResourcePaths[]        - the resource paths that this extension can apply to ($scope.selectedResourceTypes)
                    voED.fhirVersion
                    voED.multiplicity //$scope.input.multiplicity
                    voED.childElements[]        //the description of the contents of the ED. both 'simple' and complex
                        description
                        code
                        short
                        comments
                        datatypes[]
                            code
                            vs
                                strength
                                vs
                                    url


                 */
                var extensionDefinition = {resourceType:'StructureDefinition'};

                Utilities.setAuthoredByClinFhir(extensionDefinition);      //adds the 'made by clinfhir' extension...

                //in theory, there should always be a current user...
                var currentUser = securitySvc.getCurrentUser();
                if (currentUser) {
                    Utilities.addExtensionOnce(extensionDefinition,
                        appConfigSvc.config().standardExtensionUrl.userEmail,
                        {valueString:currentUser.email})
                }

                //the version of fhir that this SD is being deployed against...
                //var fhirVersion = $scope.conformanceSvr.version;        //get from the conformance server

                var fhirVersion = appConfigSvc.getCurrentConformanceServer().version;
                //var name = voED.extensionName;       //the name of the extension
                var definition = voED.description || voED.extensionName;       //the definition of the extension. It is required...
                var comments = voED.description;       //the name of the extension
               // var short = $scope.input.short;

                extensionDefinition.id = voED.extensionName;
                extensionDefinition.url = voED.url;



                //the code is used so clinfhir knows which SD resources it has authored - and can modify...

                extensionDefinition.name = voED.extensionName;
                extensionDefinition.status = 'draft';
                extensionDefinition.abstract= false;
                extensionDefinition.publisher = voED.publisher; //$scope.input.publisher;
                extensionDefinition.contextType = "resource";
                extensionDefinition.description = comments;

                if (voED.selectedResourcePaths.length == 0) {
                    extensionDefinition.context = ['*'];
                } else {
                    extensionDefinition.context = [];
                    voED.selectedResourcePaths.forEach(function(typ){
                        extensionDefinition.context.push(typ)
                    })

                }

                //at the time of writing (Oct 12), the implementaton of stu3 varies wrt 'code' & 'keyword'. Remove this eventually...
                //sep 2017 - extensionDefinition.identifier = [{system:"http://clinfhir.com",value:"author"}]

                if (voED.fhirVersion == 2) {
                    extensionDefinition.kind='datatype';
                    extensionDefinition.constrainedType = 'Extension';      //was set to 'kind' which is the search name!
                    extensionDefinition.base = 'http://hl7.org/fhir/StructureDefinition/Extension';
                } else if (voED.fhirVersion ==3) {
                    extensionDefinition.kind='complex-type';
                    extensionDefinition.type='Extension';

                    extensionDefinition.baseDefinition = 'http://hl7.org/fhir/StructureDefinition/Extension';
                    extensionDefinition.derivation = 'constraint';

                }

                var min,max;
                switch (voED.multiplicity) {
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
                var extensionTypeIsMultiple = false;
                if (voED.childElements.length > 1) {
                    extensionTypeIsMultiple = true;
                    var ed1 = {path : 'Extension',name: voED.extensionName,short:voED.short,definition:definition,
                        comments:comments,min:min,max:max,type:[{code:'Extension'}]};

                    ed1.id = ed1.path;
                    extensionDefinition.snapshot.element.push(ed1);

                    var edSlicing = {path : 'Extension.extension',name: voED.extensionName,short:voED.short,definition:definition,
                        comments:comments,min:min,max:max,type:[{code:'Extension'}]};
                    edSlicing.slicing = {discriminator:['url'],ordered:false,rules:'open'}

                    edSlicing.id = edSlicing.path;
                    extensionDefinition.snapshot.element.push(edSlicing);

                }


                //the format for a simple extensionDefinition SD is different to a complex one...
               // var extensionTypeIsMultiple = false;
               // if ($scope.childElements.length > 1) {
                 //   extensionTypeIsMultiple = true;
               // }

                //for each defined child, add the component ElementDefinition elements...
                voED.childElements.forEach(function(ce,inx){
                    var vo = ce;
                    vo.min = voED.min;
                    vo.max = voED.max;

                    extensionDefinition.snapshot.element =
                        extensionDefinition.snapshot.element.concat(makeChildED(vo,extensionTypeIsMultiple,inx))


                });


                if (voED.fhirVersion == 3 && extensionDefinition.snapshot && extensionDefinition.snapshot.element
                    && extensionDefinition.snapshot.element.length > 0) {
                    delete extensionDefinition.snapshot.element[0].type;
                }

                //ensure that all the elements have the name set as it's a required element...
                extensionDefinition.snapshot.element.forEach(function(ed){
                    if (!ed.name) {
                        ed.name = 'Name not set'
                    }
                });


                return extensionDefinition;



                //build the ElementDefinitions for a single child
                function makeChildED(vo,isComplex,index){

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

                    // var ed3 = {path : extensionRoot + '.value'+valueName,name: vo.name,short:vo.short,definition:vo.definition,
                    //   comments:vo.comments,definition:vo.description,min:vo.min,max:vo.max,type:[]};

                    var ed3 = {path : extensionRoot + '.value'+valueName,name: vo.code,short:vo.short,definition:vo.definition,
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



            },parseED : function(SD) {
                //parse a SD into the internal representation of an ED - the voED object
            }
        }


    });


angular.module("sampleApp")

    .service('edBuilderSvc', function(Utilities,securitySvc,appConfigSvc) {


        return {
            parseED : function(SD) {
                //parse a SD into the internal representation of an ED - the voED object
                //if a simple ED then there will be 3 ElementDefinition children
                //if a complex ED then there will be 2 + (n*3) elements.
                //each triplet corresponds to a single childElement[] in the voED


                if (!SD || !SD.snapshot || !SD.snapshot.element || SD.snapshot.element.length < 3) {
                    return;
                }

                var arED = SD.snapshot.element;     //all the child elements in the


                var voED = {};
                voED.extensionName = SD.name;
                voED.url = SD.url;
                voED.description = SD.description;
                voED.short = SD.short;
                voED.publisher = SD.publisher;
                voED.selectedResourcePaths = []
                if (SD.context) {

                    if (SD.context[0] !== '*'){

                        SD.context.forEach(function(ctx){
                            voED.selectedResourcePaths.push(ctx)
                        })
                    }
                }
                voED.childElements = [];
                var isComplex = false;
                if (arED.length > 3) {
                    isComplex = true;
                }

                if (isComplex) {
                    //process in 3-element batches...
                    for (var i=2; i< arED.length; i=i+3) {
                        var ar = arED.slice(i,i+3);
                        var child = processTriplet(ar);
                        console.log(child);
                        voED.childElements.push(child);
                    }

                } else {
                    var child = processTriplet(arED);   //will look at the first 3 EDs,,
                    voED.childElements.push(child);
                }

                return voED;

                //process 3 sequential ED elements into a single entry for childElements.
                //This will only work reliably on SD's published by CF
                function processTriplet(arED) {
                    var child = {};     //the child element

                    //retrieve a specific part of the data from different elements...
                    arED.forEach(function (ed) {
                        var ar = ed.path.split('.');
                        var lastSegment = ar[ar.length-1];

                        if (lastSegment == 'url') {
                            child.code = ed.fixedUri;
                        } else if (lastSegment.indexOf('value')>-1) {
                            //This has the the value - and the types...

                            child.dataTypes = [];
                            ed.type.forEach(function (typ) {
                                var t = {code:typ.code,description:typ.code};
                                if (ed.binding) {
                                    t.vs = {strength: ed.binding.strength};
                                    t.vs.vs = {url: ed.binding.valueSetUri};
                                }
                                //t.description = typ.description;
                                child.dataTypes.push(t)

                            })
                        } else {
                            child.min = ed.min;
                            child.max = ed.max;
                            child.description = ed.definition;
                        }



                    })




                    return child;

                }

            },
            makeED : function(voED) {
                //construct the ED (a StructureDefinition) from a VO
                /*
                    voED.extensionName - name of the extension (as entered by the user ($scope.input.name)
                    voED.description    ($scope.input.description)
                    voED.short
                    voED.url  ($scope.input.url)
                    voED.publisher; //$scope.input.publisher;
                    voED.selectedResourceTypes[]        - the resource paths that this extension can apply to ($scope.selectedResourceTypes)
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
                var fhirVersion = appConfigSvc.getCurrentConformanceServer().version;
                var definition = voED.description || voED.extensionName;       //the definition of the extension. It is required...
                var comments = voED.description;       //the name of the extension

                extensionDefinition.id = voED.extensionName;
                extensionDefinition.url = voED.url;



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
                    var ed1 = {path : 'Extension',short:voED.short,definition:definition,
                        comments:comments,min:min,max:max,type:[{code:'Extension'}]};

                    ed1.id = ed1.path;
                    extensionDefinition.snapshot.element.push(ed1);

                    var edSlicing = {path : 'Extension.extension',short:voED.short,definition:definition,
                        comments:comments,min:min,max:max,type:[{code:'Extension'}]};

                    if (fhirVersion == 2) {
                        edSlicing.slicing = {discriminator:['url'],ordered:false,rules:'open'}
                    } else {
                        edSlicing.slicing = {discriminator:[{type:'value',path:'url'}],ordered:false,rules:'open'}
                    }


                    edSlicing.id = edSlicing.path;
                    extensionDefinition.snapshot.element.push(edSlicing);

                }


                //for each defined child, add the component ElementDefinition elements...
                voED.childElements.forEach(function(ce,inx){
                    var vo = ce;
                    vo.min = min;   //set from code above...
                    vo.max = max;

                    extensionDefinition.snapshot.element =
                        extensionDefinition.snapshot.element.concat(makeChildED(vo,extensionTypeIsMultiple,inx))


                });


                //type in first element isn't allowed...
                if (voED.fhirVersion == 3 && extensionDefinition.snapshot && extensionDefinition.snapshot.element
                    && extensionDefinition.snapshot.element.length > 0) {
                    delete extensionDefinition.snapshot.element[0].type;
                }


                return extensionDefinition;



                //build the ElementDefinitions for a single child
                function makeChildED(vo,isComplex,index){

                    //code is required for complex extensions, so make one up if not present...
                    if (! vo.code && vo.dataTypes && vo.dataTypes.length > 0) {
                        vo.code = vo.dataTypes[0].code + index
                    }

                    vo.description = vo.description || 'No Description';

                    //if complex, then the root is '1 level down'. Remember we only support a single level of complexity...
                    var extensionRoot = 'Extension';
                    if (isComplex) {
                        extensionRoot = 'Extension.extension';
                    }

                    //todo - do we want label at all? it's optional, what value does it have
                    var arED = [];
                    var ed1 = {path : extensionRoot,label: vo.code,min:vo.min,max:vo.max,
                        short:vo.short,definition:vo.description,
                        type:[{code:'Extension'}]};

                    ed1.base = {path: ed1.path,min:ed1.min, max:ed1.max};


                    var ed2 = {path : extensionRoot + '.url',label: vo.code,representation:['xmlAttr'],
                        definition:vo.description,min:1,max:"1",type:[{code:'uri'}],fixedUri:vo.code};

                    ed2.base = {path: ed2.path,min:ed2.min, max:ed2.max};

                    //the value name is 'value' + the code with the first letter capitalized, or value[x] if more than one...
                    var valueName = '[x]';

                    if (vo.dataTypes && vo.dataTypes.length == 1) {
                        valueName = vo.dataTypes[0].code;
                        valueName = valueName[0].toUpperCase()+valueName.substr(1);
                    }

                    var ed3 = {path : extensionRoot + '.value'+valueName,label: vo.code,short:vo.short,definition:vo.definition,
                        definition:vo.description,min:vo.min,max:vo.max,type:[]};


                    if (vo.dataTypes) {
                        vo.dataTypes.forEach(function(type){
                            ed3.base = {path: ed3.path,min:ed3.min, max:ed3.max};
                            ed3.type.push({code:type.code})

                            if (type.vs) {
                                //this is a bound valueset
                                ed3.binding = {strength : type.vs.strength,valueSetUri:type.vs.vs.url,description:vo.description}
                            }

                        });
                    }


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
        }


    });

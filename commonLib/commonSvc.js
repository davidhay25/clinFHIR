angular.module("sampleApp").service('cofSvc', function(ecosystemSvc,ecoUtilitiesSvc,$q,$filter) {



    //return an analysis object of an Extension Definition. (derived from Utilities.analyseExtensionDefinition3)
    var analyseExtensionDefinition =  function(SD) {
        //return a vo that contains an analysis of the extension. Used by the profile builder only and extension directive
        // (at this point)
       // var that = this;

        //if this is a complex extension (2 level only) then the property 'complex' has the analysis...
        var vo = {dataTypes: [], multiple: false};
        vo.display = SD.display; //will use this when displaying the element
        vo.name = SD.name;
        vo.isComplexExtension = false;
        vo.context = SD.context;
        vo.publisher = SD.publisher;
        vo.url = SD.url;
        vo.description = SD.description;

        var discriminator;      //if this is sliced, then a discriminator will be set...
        var complex = false;    //will be true if this is a

        if (SD.snapshot) {
            //first off, set the common data about the extension that is found in the first ED
            var ed = SD.snapshot.element[0];
            vo.definition = ed.definition;
            vo.short = ed.short;   //the short name of the extension - whether simple or complex
            if (ed.max == '*') {
                vo.multiple = true;
            }




            //next, let's figure out if this is a simple or a complex extension.
            var arElements = [];
            SD.snapshot.element.forEach(function (element,inx) {
                if (element.path) {
                    var arPath = element.path.split('.')

                    //console.log(element.slicing)
                    /*
                    The genomics extensions have a slicing element even for a 'simple' extension
                    so, change the criteria to a path >= 3 segments
                    changed March 30, 2107
                    if (element.slicing) {
                        vo.isComplexExtension = true;
                    }
                    */
                    if (arPath.length > 2) {
                        vo.isComplexExtension = true;
                    }


                    //get rid of the id elements and the first one - just to simplify the code...
                    var include = true;
                    if (inx == 0 || arPath[arPath.length-1] == 'id' || element.slicing) {include = false}

                    //get rid of the url and value that are part of the 'parent' rather than the children...
                    if (arPath.length == 2) {
                        //updated as was not getting details for simple extensions...
                        if (arPath[1] == 'url') {include = false}

                        if (vo.isComplexExtension && arPath[1].indexOf('value')>-1){
                            include = false
                        }    //THIS is the parent...


                    }


                    if (include) {
                        arElements.push(element);
                    }
                }

            });





            if (vo.isComplexExtension) {
                //process as if it was a simple extension
                processComplex(arElements,vo)
            } else {
                //process as if it was a simple extension
                processSimple(arElements,vo)
            }


        }

        //          console.log(vo)
//console.log('----------')
        return vo;

        //process a complex extension. Will only handle a single level hierarchy - ie a list of child extensions
        //probably not too had to make it recursive, but is it worth it? other stuff would need to change as well...
        function processComplex(arElement,vo) {
            vo.children = [];       //these will be the child extensions
            var child = {};         //this is a single child element

            arElement.forEach(function (element) {
                if (element.path) {
                    var arPath = element.path.split('.');
                    if (arPath.length == 2) {
                        //this is defining the start of a new child. create a new object and add it to the children array
                        child = {min: element.min, max: element.max};
                        child.ed = element;     //Hopefully this is the representative ED
                        child.ed.myMeta = {};

                        vo.children.push(child);
                    } else if (arPath.length > 2) {
                        //this will be the definition of the child. we're only interested in the code and the datatype/s
                        var e = arPath[2];
                        if (e.indexOf('value') > -1) {
                            //this is the value definition - ie what types
                            child.ed.type = element.type;
                            child.ed.binding = element.binding;     //the child.ed was set by the 'parent' and won't have the binding...


                            //pull the bound ValueSet out for convenience...
                            if (element.binding) {
                                if (element.binding.valueSetReference) {
                                    //we may need to check whether this is a relative reference...
                                    child.boundValueSet = element.binding.valueSetReference.reference;
                                }
                                if (element.binding.valueSetUri) {
                                    child.boundValueSet = element.binding.valueSetUri;
                                }
                                child.bindingStrength = element.binding.strength;

                            }


                            //see if this is a complex dataType (so we can set the icon correctly)
                            if (element.type) {
                                element.type.forEach(function (typ) {
                                    var code = typ.code;        //the datatype code
                                    if (code) {
                                        //if (/[A-Z]/.test(code)) {  aug2017 - don't know why there is a caps check here...
                                        child.ed.myMeta.isComplex = true;
                                        // }
                                    }
                                })
                            }

                        }

                        if (e.indexOf('url') > -1) {
                            //this is the code of the child
                            child.code = element.fixedUri
                        }

                    }
                }


            });


        }

        //process this as if it were a simple extension
        function processSimple(arElement,vo) {
            arElement.forEach(function (element) {
                //we're only interested in finding the 'value' element to find out the datatypes it can assume...
                if (element.path.indexOf('Extension.value') > -1) {
                    //this defines the value type for the extension

                    //look at the 'type' property to see the supported data types
                    if (element.type) {
                        vo.type = element.type;
                        element.type.forEach(function (typ) {
                            var code = typ.code;        //the datatype code
                            if (code) {

                                vo.dataTypes.push(typ);
                                //vo.dataTypes.push({code:code});
                                //is this a codedd type?
                                if (['CodeableConcept', 'code', 'coding'].indexOf(code) > -1) {
                                    vo.isCoded = true;

                                }

                                /* - no it isn't!  Jun 2017...
                                //if the datatype starts with an uppercase letter, then it's a complex one...
                                if (/[A-Z]/.test( code)){
                                    vo.isComplex = true;    //this really should be 'isComplexDatatype'
                                }
                                */

                                //is this a reference?
                                if (code == 'Reference') {

                                }
                            }
                        })
                    }

                    if (element.binding) {
                        vo.binding = element.binding;
                        if (element.binding.valueSetUri) {
                            vo.boundValueSet = element.binding.valueSetUri
                        } else if (element.binding.valueSetReference){
                            vo.boundValueSet = element.binding.valueSetReference.reference;
                        }

                    }

                }

            })
        }

    };


    return {
        makeLogicalModelFromSD : function(profile,track){
            //given a StructureDefinition which is a profile (ie potentially has extensions) generate a logical model by de-referencing the extensions
            //currently only working for simple extensions
            var deferred = $q.defer();
            var confServer = "http://snapp.clinfhir.com:8081/baseDstu3/";       //get from track,
            //var confServer = track.confServer ||  "http://snapp.clinfhir.com:8081/baseDstu3/";

            if (profile && profile.snapshot && profile.snapshot.element) {

                var logicalModel = angular.copy(profile);       //this will be the logical model
                var queries = [];       //the queries to retrieve the extension definition
                logicalModel.snapshot.element.length = 0; //remove the current element definitions

                profile.snapshot.element.forEach(function (ed) {
                    logicalModel.snapshot.element.push(ed)
                    var path = ed.path;
                    var ar = path.split('.');
                    if (ar.indexOf('extension') > -1) {
                        //this is an extension

                        if (ed.type) {
                            var profileUrl = ed.type[0].profile;
                            if (profileUrl) {

                                queries.push(ecoUtilitiesSvc.findConformanceResourceByUri(profileUrl,confServer).then(
                                    function (sdef) {
                                        var analysis = analyseExtensionDefinition(sdef);

                                        if (! analysis.isComplexExtension) {

                                            if (! ed.name) {
                                                ed.name = analysis.name;
                                            }

                                            ed.type = analysis.type;
                                            ed.binding = analysis.binding;
                                            //now update the path and other key properties of the ed
                                            var text = $filter('getLogicalID')(profileUrl);

                                            //oct3-2017 why did I do this???
                                            ed.path = ed.path.replace('extension',text)


                                            //ed.builderMeta || {}
                                            ed.builderMeta = {isExtension : true};  //to colourize it, and help with the build..
                                            ed.builderMeta.extensionUrl = profileUrl;

                                            ed.comments = sdef.description;


                                        } else {
                                            console.log(profileUrl + " is complex, not processed")
                                        }


                                    },
                                    function(err) {
                                        //unable to locate extension
                                        console.log(profileUrl + " not found")
                                    }
                                ))
                            }

                        }

                    }


                });

                if (queries.length > 0) {
                    //yes - execute all the queries and resolve when all have been completed...
                    $q.all(queries).then(
                        function () {
                            deferred.resolve(logicalModel);
                        },
                        function (err) {

                            //return the error and the incomplete model...
                            deferred.reject({err:err,lm:logicalModel})



                        }
                    )

                } else {
                    //no - we can return the list immediately...
                    deferred.resolve(logicalModel)

                }



            } else {
                deferred.reject();
            }

            return deferred.promise;





        },
        makeGraph: function (lst) {
            var arNodes = [], arEdges = [];
            var objColours = ecosystemSvc.objColours();

            lst.forEach(function (item) {

                var node = {id: item.id, label: item.type, shape: 'box', item: item};

                if (objColours[item.baseType]) {
                    node.color = objColours[item.baseType];
                }

                arNodes.push(node);

                if (item.table) {
                    item.table.forEach(function (row) {
                        if (row.references) {
                            row.references.forEach(function (ref) {
                                var edge = {
                                    id: 'e' + arEdges.length + 1, from: item.id, to: ref.targetItem.id,
                                    label: ref.sourcePath, arrows: {to: true}
                                };

                                arEdges.push(edge)
                            })
                        }
                    })
                }

            });

            var nodes = new vis.DataSet(arNodes);
            var edges = new vis.DataSet(arEdges);

            // provide the data in the vis format
            var graphData = {
                nodes: nodes,
                edges: edges
            };

            return {graphData: graphData};

        }
    }
})
angular.module("sampleApp").service('profileDiffSvc',
    function() {



    return {
        makeCanonicalObj : function(SD) {
            if (SD && SD.snapshot && SD.snapshot.element) {
                var hashPath = {}
                var newSD = {snapshot: {element:[]}}        //a new SD that removes the excluded elements (max=0)
                var canonical = {item:[]}      //the canonical object...
                var excludeRoots = []           //roots which have been excluded...
                SD.snapshot.element.forEach(function(ed){
                    var include = true;
                    var path = ed.path;
                    var arPath = path.split('.');
                    arPath = arPath.splice(1)


                    var item = {path:arPath.join('.')};
                    item.originalPath = path;
                    item.ed = ed;
                    item.min = ed.min;
                    item.max = ed.max;
                    item.multiplicity = ed.min + ".."+ed.max;
                    item.type = ed.type;
                    item.difference = {};       //a # of differences - set during the analysis phase...

                    //if multiplicity is 0, then add to the exclude roots
                    if (item.max == 0) {
                        include = false;
                        excludeRoots.push(path)
                    }

                    //if this path starts with any of the exclude roots, then don't include...
                    excludeRoots.forEach(function(root){
                        if (path.substr(0,root.length) == root) {
                            include = false;
                        }
                    })


                    //pull out any fixed elements...
                    //need to iterate through all the properies of the ED to see if any start with 'fixed'
                    angular.forEach(ed,function (value,key) {

                        if (key.substr(0,5) == 'fixed') {
                            console.log(key)
                            item.fixed = {key: key, value:value}
                        }
                    });




                    //special processing for coded elements
                    if (item.type) {
                        item.type.forEach(function(typ) {

                            if (['code', 'Coding', 'CodeableConcept'].indexOf(typ.code) > -1){
                                //this is a coded element, add the bound valueset
                                if (ed.binding) {
                                    item.coded = {strength:ed.binding.strength}

                                    if ( ed.binding.valueSetReference) {
                                        item.coded.valueSetReference = ed.binding.valueSetReference.reference;
                                    }

                                    item.coded.valueSetUri = ed.binding.valueSetUri;
                                }
                            }
                        }
                    )}


                    //special processing for extensions...
                    if (arPath[arPath.length-1] == 'extension' || arPath[arPath.length-1] == 'modifierExtension') {
                        include = false;
                        item.extension = {name:ed.name}
                        if (item.type) {
                            item.type.forEach(function(typ) {
                                if (typ.profile) {
                                    include = true;
                                    if (angular.isArray(typ.profile)) {
                                        item.extension.url = typ.profile[0]
                                    } else {
                                        item.extension.url = typ.profile
                                    }
                                    item.originalPath += '_'+item.extension.url;    //to make it unique

                                }
                            })
                        }
                    }
                    if (include) {
                        canonical.item.push(item)

                        //check for a dusplaicate path
                        var p = ed.path;
                        if (hashPath[p]) {
                            hashPath[p] ++;
                            ed.path = ed.path + '_'+hashPath[p];

                        } else {
                            hashPath[p] = 1;
                        }
                        newSD.snapshot.element.push(ed);
                    }


                });
                return {canonical:canonical, SD : newSD};
            }

        },
        analyseDiff : function(primary,secondary) {
            //pass in the canonical model (NOT the SD or ED)
            //var analysis = {};

            secondary.report = {fixed:[],missing:[],valueSet:[]};

            var primaryHash = {};
            primary.item.forEach(function(item){
                var path = item.originalPath;   //extensions will be made unique
                primaryHash[path]= item
            });

          //  console.log(primaryHash)
            //fields in secondary, not in primary
            //analysis.notInPrimary = []


            secondary.item.forEach(function (item) {

                console.log(item)

                //may want to check the primary...
                if (item.fixed) {
                    console.log(item.fixed)
                   // secondary.report.fixed = secondary.report.fixed || []
                    secondary.report.fixed.push({item:item,fixed:item.fixed})

                    item.difference.fixed = item.fixed;
                }

                if (!primaryHash[item.originalPath] ) {
                    //this is a new path in the secondary. Either an extension, or is core, but not in the primary...
                    //analysis.notInPrimary.push(item)
                    var reportItem = {path:item.path,min:item.min}
                    if (item.extension) {
                        reportItem.extension = item.extension.url
                    }


                    if (item.min !== 0) {
                        item.difference.brk = true;         //breaking change
                       // reportItem.
                    } else {
                        item.difference.nip = true;         //not in primary
                    }
                    secondary.report.missing.push(reportItem);

                } else {
                    var primaryItem = primaryHash[item.originalPath];
                    //the path is in both, has it changed? First the multiplicity
                    if (primaryItem.multiplicity !== item.multiplicity ){
                        item.difference.mc = true;         //multiplicity changed
                    }

                    if (item.coded) {
                        //the secondary is coded
                        if (! primaryItem.coded) {

                            item.difference.vsd = true;     //the primary is not!
                        } else {
                            var vsItem = {}
                            if (item.coded.valueSetReference) {
                                if (primaryItem.coded.valueSetReference !== item.coded.valueSetReference) {
                                    item.difference.vsd = true;
                                    vsItem = {path:item.path,different:true,vsReference:item.coded.valueSetReference}
                                } else {
                                    vsItem = {path:item.path,different:false,vsReference:item.coded.valueSetReference}
                                }
                            }

                            if (item.coded.valueSetUri) {
                                if (item.coded.valueSetUri !== primaryItem.coded.valueSetUri) {
                                    item.difference.vsd = true;
                                    vsItem = {path:item.path,different:true,vsUri:item.coded.valueSetUri}
                                } else {
                                    vsItem = {path:item.path,different:false,vsUri:item.coded.valueSetUri}
                                }
                            }

                            secondary.report.valueSet.push(vsItem);

                        }

                    }

                }

                })

            //console.log(analysis)
            console.log(secondary.report)

        }
    }

    });
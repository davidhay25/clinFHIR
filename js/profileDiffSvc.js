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
                    item.difference = {};       //a # of differences

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

            var primaryHash = {};
            primary.item.forEach(function(item){
                var path = item.originalPath;   //extensions will be made unique
                primaryHash[path]= item
            });

            console.log(primaryHash)
            //fields in secondary, not in primary
            //analysis.notInPrimary = []
            secondary.item.forEach(function (item) {
                if (!primaryHash[item.originalPath] ) {
                    //analysis.notInPrimary.push(item)
                    if (item.min !== 0) {
                        item.difference.brk = true;         //breaking change
                    } else {
                        item.difference.nip = true;         //not in primary
                    }

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
                            if (item.coded.valueSetReference) {
                                if (primaryItem.coded.valueSetReference !== item.coded.valueSetReference) {
                                    item.difference.vsd = true;
                                }
                            }

                            if (item.coded.valueSetUri !== primaryItem.coded.valueSetUri) {
                                item.difference.vsd = true;
                            }

                        }




                    }

                }

                })

            //console.log(analysis)


        }
    }

    });
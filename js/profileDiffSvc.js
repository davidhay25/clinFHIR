angular.module("sampleApp").service('profileDiffSvc',
    function() {



    return {
        makeCannonicalObj : function(SD) {
            if (SD && SD.snapshot && SD.snapshot.element) {
                var cannonical = {item:[]}      //the cannonical object...
                var excludeRoots = []           //roots which have been excluded...
                SD.snapshot.element.forEach(function(ed){
                    var include = true;
                    var path = ed.path;
                    var arPath = path.split('.');
                    arPath = arPath.splice(1)


                    var item = {path:arPath.join('.')};
                    item.ed = ed;
                    item.min = ed.min;
                    item.max = ed.max;
                    item.type = ed.type;

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
                                    if (ed.binding.valueSetReference) {

                                    }
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

                                }
                            })
                        }
                    }
                    if (include) {
                        cannonical.item.push(item)
                    }


                });
                return cannonical;
            }

        }
    }

    });
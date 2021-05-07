

angular.module("sampleApp")

    .service('packageViewerSvc', function($q,$http) {

        function dropFirstInPath(path) {
            let ar = path.split('.')
            ar.splice(0,1)
            return ar.join('.')
        }


        return {

            extensionSummary : function(sd) {
                //generate a summary of the extenstion contents
                let summary = {}

                //is this a simple or a complex extension
                let isSimple = true

                if (sd.snapshot.element.length > 8) { isSimple = false};    //slightly arbitrary number...

             //   sd.snapshot.element.forEach(function (element){
               //     if (element.sliceName) { isSimple = false}
             //  })
                summary.isSimple = isSimple

                if (isSimple) {
                    let item = {}
                    sd.snapshot.element.forEach(function (element,ctr){
                        if (ctr == 0) {
                            summary.short = element.short;
                            summary.definition = element.definition;
                        } else if (element.id.indexOf('[x]:') > -1) {

                            item.type = element.type
                            item.binding = element.binding
                            summary.contents = [(item)]
                        }

                      //  console.log(element.id, element.sliceName)
                    })
                } else {
                    let hash = {}, slices = []

                    sd.snapshot.element.forEach(function (element,ctr){
                        hash[element.id] = element
                        if (element.sliceName) {
                            slices.push(element.sliceName)
                        }
                    })

                    console.log(hash)
                    slices.forEach(function (slice){
                        let item = {sliceName : slice}

                        let urlKey = "Extension.extension:" + slice
                        if (hash[urlKey]) {
                            item.name = hash[urlKey].sliceName
                            item.definition = hash[urlKey].definition;
                        }

                        let typeKey = "Extension.extension:" + slice + '.value[x]'
                        if (hash[typeKey]) {
                            item.type = hash[typeKey].type;
                            item.binding = hash[typeKey].binding;
                        }



                        summary.contents = summary.contents || []
                        summary.contents.push(item)

                    })



return summary;

                    sd.snapshot.element.forEach(function (element,ctr){

                        if (element.sliceName) {
                           // hash[]
                        }

                        console.log(element.id, element.sliceName)
                        if (ctr == 0) {
                            summary.short = element.short;
                            summary.definition = element.definition;
                        } else if (element.id.indexOf('[x]:') > -1) {
                            let item = {}
                            item.type = element.type
                            item.binding = element.binding
                            summary.contents = summary.contents || []
                            summary.contents.push(item)
                        }

                        //  console.log(element.id, element.sliceName)
                    })

                }
                return summary;

            },

            createTreeArray : function(sd) {
                var cntExtension = 0;
                let hashPath = {}   //key is path, value is id
                let arTree = [];
                if (sd && sd.snapshot && sd.snapshot.element) {
                    sd.snapshot.element.forEach(function (ed,inx) {
                        hashPath[ed.path] = ed.id
                        var include = true;

                        var path = ed.path;
                        var arPath = path.split('.');
                        var item = {data:{}};
                        item.data.ed = ed;

                        item.id = ed.id;

                        if (arPath.length == 1) {
                            //this is the root node
                            item.parent = '#';
                            item.text = sd.type;  //"Root"
                        } else {
                            //default text
                            let text = arPath[arPath.length - 1];   //the text will be the last entry in the path...
                            //text += "_" + inx;
                            arPath.pop();//
                            let parentId = hashPath[arPath.join('.')]
                            item.parent = parentId; //arPath.join('.');
                            //var text = arPath[arPath.length - 1];   //the text will be the last entry in the path...

                            if (ed.sliceName) {
                                text += ": " + ed.sliceName;
                            }

                            item.text = text ;
                            //item.text += cnt;

                        }

                        item.state = {opened: true};     //default to fully expanded
                        item.data.ed = ed;  //added for profileDiff

                        decorateItem(item)


                       // item.attr class = "extension"

                        //check for extensions...
                        if (item.data && item.data.ed && item.data.ed.type) {
                            item.data.ed.type.forEach(function (typ) {
                                //if there's no profile, then it's a placeholder...
                                if (typ.code == 'Extension' && ! typ.profile) {
                                    include = false;
                                }
                            })
                        }

                        if (include) {
                            arTree.push(item);
                        }

                    })
                }

                return arTree

                function decorateItem(item) {
                    let attr = {class:''}

                    //is this an extension
                    if (item.data && item.data.ed && item.data.ed.type) {
                        item.data.ed.type.forEach(function (typ){
                            if (typ.code == 'Extension') {
                                attr.class += " extension"
                            }
                        })
                    }

                    if (item.data.ed.min > 0) {
                        attr.class += " required"
                    }

                    //to override the 'inheriting' of colours
                    if (attr.class == "") {
                        attr.class = "normal"
                    }

                    item['li_attr'] = attr;//{class:'extension'}
                }


            },

            makeLogicalModel : function(SD,IG) {
                let that = this;
                //let SD = vo.SD;
               // let confServer = vo.confServer;
                let deferred = $q.defer();

                let elementsToIgnore = ['id', 'meta', 'implicitRules', 'language', 'contained'];

                let baseType = SD.snapshot.element[0].path;
                let rootName = 'myResource';
                //let vo ={rootName:rootName,baseType:baseType};
                let queries = [];       //these will be extensions to de-compose...
                let excluded = [];      //elements excluded by setting max to 0

                var newElementArray = [];
                SD.snapshot.element.forEach(function (ed) {
                    //let ed = angular.copy(el);      //something is updating the element...
                    let item = {};
                    item.ed = ed;
                    item.path = dropFirstInPath(ed.path)
                    item.description = ed.short || ed.definition ;

                    let include = true;
                    let arPath = ed.path.split('.');

                    if (elementsToIgnore.indexOf(arPath[arPath.length-1]) !== -1) {
                        include = false;
                    }

                    if ( ed.path.indexOf('xtension') > -1) {
                        if (ed.type) {
                            ed.type.forEach(function (typ) {
                                if (typ.profile) {

                                    //stu2/3 difference
                                    let profile = typ.profile
                                    if (angular.isArray(typ.profile)) {
                                        profile = typ.profile[0]
                                    }
                                    item.description = profile;
                                  //temp  queries.push(checkExtensionDef(profile, item));
                                } else {
                                    //no profile, don't include
                                    include = false;
                                }

                            })
                        }
                    } else {
                        //when slicing - not for an extension
                        if (ed.sliceName) {
                            item.description = ed.sliceName + " " + item.description;
                        }
                    }


                    if (ed.slicing) {
                        //don't show the discriminator element
                        include = false;
                    }

                    //if max is 0 (or any of the parents) then don't include
                    if (ed.max == '0') {
                        excluded.push(ed.path)
                        include = false;
                    }

                    //check is any of the parents have
                    excluded.forEach(function(excl){
                        if (ed.path.indexOf(excl)> -1) {
                            include = false;
                        }
                    })


                    if (include) {
                        newElementArray.push(item);
                    }

                });

                $q.all(queries).then(
                    function () {
                        deferred.resolve(newElementArray);
                    },
                    function (err) {
                        console.log('ERROR: ', err)
                        deferred.reject({allElements:newElementArray,err:err});
                    }
                );


                //  SD.snapshot.element = newElementArray;  ?? why did I do thos????

                return deferred.promise;
                //==============================================

                //retrieve the Extension Definition to populate child nodes
                function checkExtensionDef(extUrl, item) {
                    console.log('checking '+ extUrl)

                    item.extUrl = extUrl;
                    var deferred = $q.defer();

                    let qry = confServer + "StructureDefinition?url=" + extUrl;

                    item.children = item.children || []

                    localGetMostRecentResourceByCanUrl(qry,'extension').then(
                        function(vo) {
                            let extensionDef = vo.resource;     //should really only be one...
                            if (! extensionDef) {
                                item.err = "Extension definition not found"
                                deferred.resolve();
                                return;
                            }

                            item.description = extensionDef.description;

                            //console.log(extensionDef)
                            if (extensionDef && extensionDef.snapshot && extensionDef.snapshot.element) {
                                //item.children = item.children || []
                                let isComplex = false;  //will be complex
                                extensionDef.snapshot.element.forEach(function (ed) {
                                    //the path ending in .url has the name in fixedUri
                                    if (ed.path == 'Extension.extension' && ! ed.slicing && ed.sliceName) {
                                        item.children.push(angular.copy(ed))
                                    }


                                })
                            }

                            if (vo.err) {
                                item.err = vo.err
                                //item.children.push({err:vo.err});
                            }

                            deferred.resolve();
                        }
                    );





                    return deferred.promise;
                };



            }
        }
    })


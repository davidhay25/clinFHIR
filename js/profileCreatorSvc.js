angular.module("sampleApp").service('profileCreatorSvc',
    function($q,$http,RenderProfileSvc,appConfigSvc,ResourceUtilsSvc,GetDataFromServer,$localStorage,Utilities,$sce) {
        
        
        return  {
            makeProfileDisplayFromProfile : function(inProfile) {
                var deferred = $q.defer();
                var lstTree = [];

                var profile = angular.copy(inProfile);      //w emuck around a bit with the profile, so use a copy
                //console.log(profile);
                var arIsDataType = [];          //this is a list of disabled items...
                var lst = [];           //this will be a list of elements in the profile to show.
                var elementsToDisable = ['id', 'meta', 'implicitRules', 'language', 'text', 'contained'];
                var dataTypes = ['CodeableConcept', 'Identifier', 'Period', 'Quantity', 'Reference','HumanName'];

                var cntExtension = 0;
                //a hash of the id's in the tree. used to ensure we don't add an element to a non-esixtant parent.
                //this occurs when the parent has a max of 0, but child nodes don't
                var idsInTree = {};
                var hashTree = {};
                var queries = [];       //a list of queries to get the details of extensions...
                if (profile && profile.snapshot && profile.snapshot.element) {

                    profile.snapshot.element.forEach(function (item) {
                        item.myMeta = item.myMeta || {};

                        var include = true;
                        var el = {path: item.path};

                        var path = item.path;

                        if (! path) {
                            alert('empty path in Element Definition\n'+angular.toJson(item))
                            return;
                        }

                        var ar = path.split('.');

                        //process extensions first as this can set the include true or false - all the others only se false
                        //process an extension. if it has a profile, then display it with a nicer name.
                        if (ar[ar.length - 1] == 'extension') {
                            // disabled = true;    //by default extensions are disabled...
                            //if the extension has a profile type then include it, otherwise not...
                            include = false;

                            if (item.type) {
                                item.type.forEach(function (it) {
                                    if (it.code == 'Extension' && it.profile) {
                                        // disabled = false;
                                        include=true;
                                        //load the extension definition
                                        queries.push(GetDataFromServer.findConformanceResourceByUri(it.profile).then(
                                            function(sdef) {
                                                var analysis = Utilities.analyseExtensionDefinition2(sdef);
                                                item.myMeta.analysis = analysis;
                                                console.log(analysis)
                                            }, function(err) {
                                                alert('Error retrieving '+ t.profile + " "+ angular.toJson(err))
                                            }
                                        ));

                                        //use the name rather than 'Extension'...
                                        ar[ar.length - 1] = "*"+ item.name;
                                    }
                                })
                            }
                        }

                        //todo hide the modifier extension. Will need to figure out how to display 'real' extensions
                        if (ar[ar.length - 1] == 'modifierExtension') {
                            //disabled = true;
                            include = false;
                        }

                        if (ar.length == 1) {
                            //this is the root node
                            //note - added data friday pm montreal
                            lstTree.push({id:ar[0],parent:'#',text:ar[0],state:{opened:true,selected:true},path:path,data: {ed : item}});
                            idsInTree[ar[0]] = 'x'
                            include = false;
                        }

                        //obviously if the max is 0 then don't show  (might waant an option later to show
                        if (item.max == 0) {
                            include = false;
                        }

                        //standard element names like 'text' or 'language'
                        if (ar.length == 2 && elementsToDisable.indexOf(ar[1]) > -1) {
                            include = false;
                        }

                        //don't include id elements...
                        if (ar[ar.length-1] == 'id') {
                            include = false;
                        }

                        ar.shift();     //removes the type name at the beginning of the path
                        item.myMeta.path = ar.join('. ');     //create a path that doesn't include the type (so is shorter)


                        //set various meta items based on the datatype
                        if (item.type) {
                            item.type.forEach(function (it) {

                                console.log(it.code)
                                //a node that has child nodes
                                if (it.code == 'BackboneElement') {
                                    item.myMeta.isParent = true;
                                }

                                if (it.code == 'Extension') {
                                    item.myMeta.isExtension = true;
                                }

                                if (it.code == 'Reference') {
                                    item.myMeta.isReference = true;
                                }

                                //if the datatype starts with an uppercase letter, then it's a complex one...
                                if (/[A-Z]/.test( it.code[0])){
                                    item.myMeta.isComplex = true;
                                }

                            })
                        }

                        //add to tree only if include is still true...
                        if (include) {
                            var id = path;
                            var arText = path.split('.');
                            var text = arText[arText.length-1];

                            var arTree = path.split('.');
                            if (arTree[arTree.length-1] == 'extension') {
                                text = item.name;
                                id = id + cntExtension;
                                cntExtension++;
                            }

                            arTree.pop();
                            var parent = arTree.join('.');

                            var dataType = '';
                            if (item.type) {
                                item.type.forEach(function (it){
                                    dataType += " " + it.code;
                                })
                            }

                            var node = {id:id,parent:parent,text:text,state:{opened:false,selected:false},
                                a_attr:{title: dataType}, path:path};

                            if (item.myMeta.isExtension) {
                                //todo - a class would be better, but this doesn't seem to render in the tree...
                                 node.a_attr.style='color:blueviolet'
                              }

                            node.data = {ed : item};
/*
                            //set the icon to display. todo Would be better to use a class, but can't get that to work...
                            if (!item.myMeta.isParent) {
                                //if it's not a parent node, then set to a data type...
                                if (item.myMeta.isComplex) {
                                    node.icon='/icons/icon_datatype.gif';
                                } else {
                                    node.icon='/icons/icon_primitive.png';
                                }


                                if (item.myMeta.isReference) {
                                    node.icon='/icons/icon_reference.png';
                                }



                            }

                            if (item.myMeta.isExtension) {
                                node.icon='/icons/icon_extension_simple.png';
                            }

*/


                            //so long as the parent is in the tree, it's safe to add...
                            if (idsInTree[parent]) {
                                lstTree.push(node);
                                idsInTree[id] = 'x'
                                lst.push(item);
                            }

                        }


                        //if the type is a recognized datatype, then hide all child nodes todo - won't show profiled datatyoes
                        //note that this check is after it has been added to the list...

                        if (item.type) {
                            item.type.forEach(function (type) {
                                if (dataTypes.indexOf(type.code) > -1) {
                                    arIsDataType.push(path)
                                }
                            });
                        }




                    });

                }


                if (queries.length) {
                    $q.all(queries).then(
                        function() {


                            //here is where we set the icons - ie after all the extension definitions have been loaded & resolved...
                            lstTree.forEach(function(node){
                                console.log(node);

                                //set the '[x]' for code elements
                                if (node.data && node.data.ed && node.data.ed.type && node.data.ed.type.length > 1) {
                                       node.text += '[x]'
                                }

                                //set the '[x]' for extensions (whew!)
                                if (node.data && node.data.ed && node.data.ed.myMeta && node.data.ed.myMeta.analysis &&
                                    node.data.ed.myMeta.analysis.dataTypes && node.data.ed.myMeta.analysis.dataTypes.length > 1) {
                                    node.text += '[x]'
                                }

                                //set the display icon
                                if (node.data && node.data.ed && node.data.ed.myMeta){




                                    var myMeta = node.data.ed.myMeta;

                                    if (!myMeta.isParent) {     //leave parent node as folder...

                                        var r = myMeta;
                                        if (myMeta.isExtension && myMeta.analysis) {
                                            r = myMeta.analysis;
                                        }
                                        //var isComplex = myMeta.isComplex ||


                                            if (r.isComplex) {
                                                node.icon='/icons/icon_datatype.gif';
                                            } else {
                                                node.icon='/icons/icon_primitive.png';
                                            }

                                            if (r.isReference) {
                                                node.icon='/icons/icon_reference.png';
                                            }


                                        //if it's not a parent node, then set to a data type...





                                    }

                                //    if (myMeta.isExtension) {

                                       // node.icon='/icons/icon_extension_simple.png';
                                   // }



                                    console.log('-->',node.data.ed.myMeta)



                                }
                            })



                            deferred.resolve({table:lst,treeData:lstTree})
                        }
                    )

                } else {
                    deferred.resolve({table:lst,treeData:lstTree})
                }



                return deferred.promise;

                // return {table:lst,treeData:lstTree};

            }
        }
    }
);
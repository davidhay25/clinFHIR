angular.module("sampleApp")
//this performs marking services


    .service('newEditSvc', function($q,GetDataFromServer,Utilities) {

        //paths that will be ignored when looking for existing data in the reference
        var ignorePaths = ['id','contained','language','meta','implicitRules']

        function replaceLastInPath(path,name) {
            var ar = path.split('.');
            ar[ar.length-1] = name;
            return ar.join('.');
        }

        function getLastInPath(path) {
            var ar = path.split('.');
            return ar[ar.length-1];
        }


        return {
            buildResourceTree: function (resource) {
                //pass in a resource instance...
                if (! resource) {
                    //function is called when clicking on the space between resources...
                    return;
                }
                var tree = [];
                var idRoot = 0;
                //console.log(resource)
                function processNode(tree, parentId, element, key, level,pathRoot) {

                    if (angular.isArray(element)) {
                        var aNodeId1 = getId()
                        var newLevel = level++;
                        var data = {key:key, element:element,level:newLevel,path:pathRoot+'.'+key}
                        var newNode1 = {id: aNodeId1, parent: parentId, data:data, text: key, state: {opened: true, selected: false}};
                        tree.push(newNode1);

                        newLevel++
                        element.forEach(function (child, inx) {
                            processNode(tree, aNodeId1, child, '[' + inx + ']',newLevel,pathRoot+'.'+key);
                        })

                    } else if (angular.isObject(element)) {
                        var newLevel = level++;
                        var oNodeId = getId();
                        var data = {key:key, element:element,level:newLevel,path:pathRoot+'.'+key}
                        var newNode2 = {id: oNodeId, parent: parentId, data: data, text: key, state: {opened: true, selected: false}};



                        tree.push(newNode2);

                        //var newLevel = level++;
                        newLevel++
                        angular.forEach(element, function (child, key1) {
                            processNode(tree, oNodeId, child, key1,newLevel,pathRoot+'.'+key);

                        })
                    } else {
                        //a simple element
                        if (key == 'div') {

                        } else {

                            //console.log(key,element)
                            //http://itsolutionstuff.com/post/angularjs-how-to-remove-html-tags-using-filterexample.html
                            //strip out the html tags... - elemenyt is not always a string - bit don't care...
                            try {
                                if (element.indexOf('xmlns=')>-1) {
                                    element = element.replace(/<[^>]+>/gm, ' ')
                                }
                            } catch (ex) {

                            }



                            var display = key + " " + '<strong>' + element + '</strong>';
                            var data = {key:key, element:element,level:level,path:pathRoot+'.'+key}
                            //data.element = element;
                            var newNode = {
                                id: getId(),
                                parent: parentId,
                                data:data,
                                text: display,
                                state: {opened: true, selected: false}
                            };
                            tree.push(newNode);
                        }
                    }
                }


                var rootId = getId();
                var rootItem = {id: rootId, parent: '#', text: resource.resourceType, state: {opened: true, selected: true}}
                tree.push(rootItem);

                angular.forEach(resource, function (element, key) {
                    processNode(tree, rootId, element, key, 1,resource.resourceType);
                });

                //var parentId = '#';
                return tree;

                //generate a new ID for an element in the tree...
                function getId() {
                    idRoot++;
                    return idRoot;

                }


            },
            makeInternal : function(profile) {
                var deferred = $q.defer();
                var internal = {element:[]}
                var query = []

                profile.snapshot.element.forEach(function(ed){
                    var include = true;
                    var myElement = {}
                    myElement.path = ed.path;       //the actual resource path
                    myElement.originalPath = ed.path;       //gets replaced for extensions...
                    if (ed.max == '*') {
                        myElement.multi = true;
                    }

                    if (ed.type) {
                        ed.type.forEach(function (typ) {
                            if (typ.code == 'Extension') {
                                var profile = typ.profile;  //note stu differences
                                if (profile) {
                                    console.log(profile)
                                    myElement.isExtension = true;
                                    query.push(processExtension(profile,internal,myElement))
                                } else {
                                    //if this is an extension without a profile then don't include it...
                                    include = false;
                                }
                            }
                        })
                    }

                    if (ignorePaths.indexOf(getLastInPath(myElement.originalPath)) > -1) {
                        include = false;
                    }


                    if (include) {
                        myElement.ed = ed;
                        internal.element.push(myElement)
                    }

                });


                if (query.length > 0) {
                    $q.all(query).then(
                        function(ext){
                            //the function will return a list of elements to add.
                            console.log(ext)

                            for (var i=0; i<ext.length; i++) {
                                //for each element, find out where it is in the main element list and insert it at that spot


                                var ar = ext[i];
                                if (ar.length > 0) {
                                    var firstElement = ar[0];       //the first (and maybe only) to insert
                                    //find the innsert point
                                    for (var inx = 0; inx < internal.element.length; inx++) {

                                        if (internal.element[inx].path ==  firstElement.parentPath){
                                            break;
                                        }
                                    }
                                    //inx will be the insert point
                                    //internal.element.splice(inx+1,0)

                                    for (var j=0; j<ar.length; j++ ) {
                                        internal.element.splice(inx+j+1,0,ar[j])
                                    }
                                }

                            }


/*
                            internal.element.sort(function(a,b){
                                if (a.path > b.path) {
                                    return 1
                                } else {
                                    return -1
                                }
                            });
*/
                            deferred.resolve(internal)
                        },
                        function(err) {
                            console.log(err)
                            deferred.reject(internal)
                        }
                    )
                } else {

                }


                return deferred.promise;


                function replaceLastInPathDEP(path,name) {
                    var ar = path.split('.');
                    ar[ar.length-1] = name;
                    return ar.join('.');
                }


                function processExtension(profile,internal,element) {
                    var deferred = $q.defer();

                    GetDataFromServer.findConformanceResourceByUri(profile).then(
                        function (data) {
//console.log(data)

                            var analysis = Utilities.analyseExtensionDefinition3(data);
                            console.log(analysis)
                            element.analysis = analysis;

                            if (element.ed.sliceName) {
                                element.path = replaceLastInPath(element.path,element.ed.sliceName);
                            }

                            //if complex, then create nodes to insert after the 'parent'
                            var childElements = []
                            if (analysis.isComplexExtension) {
                                analysis.children.forEach(function (child) {
                                    var myElement = {}
                                    myElement.parentPath = element.path;
                                    myElement.path = element.path + '.' + child.code;    //same path as the parent - fix
                                    childElements.push(myElement)
                                })
                            }




                            deferred.resolve(childElements);
                        },
                        function (err) {
                            deferred.reject();
                        }
                    )

                    return deferred.promise
                }

            }
         }}
    )
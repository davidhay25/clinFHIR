
angular.module("sampleApp")

    .service('designerSvc', function(GetDataFromServer,$localStorage,$http,$timeout,$q,$filter) {

        var elementsToIgnore =['id','meta','implicitRules','language','text','contained','extension','modifierExtension'];


        String.prototype.dropFirst = function() {
            var ar = this.split('.');
            if (ar.length > 1 ) {
                ar.splice(0,1);
                return ar.join('.')
            } else {
                return this;
            }
        };

        String.prototype.getLastBySlash = function() {
            var ar = this.split('/');
            return ar[ar.length-1]
        };


        return {
            findNodeWithKey : function(nodes,key) {
                //todo - set up a hash so we can index direcrly. this will do for now...
                for (var i=0; i< nodes.length; i++) {
                    var node = nodes[i];
                    if (node.key == key) {
                        return node;
                        break;
                    }
                }
            },

            addReference : function(nodes,fromKey,fromPath,toKey){
                //add a reference
                var fromNode = this.findNodeWithKey(nodes,fromKey);
                var toNode = this.findNodeWithKey(nodes,toKey);
                if (fromNode && toNode) {
                    //now find the path in the from node
                    var item = fromNode.myData;
                    for (var i=0; i< item.elements.length; i++) {
                        var element = item.elements[i];
                        if (element.path == fromPath) {
                            element.meta.references = element.meta.references || [];

                            var key = fromKey+fromPath+toKey;
                            var link = {key:key,from:fromKey,path:fromPath,to:toKey,text:fromPath.dropFirst()};
                            element.meta.references.push(link);
                            return link;
                            break;
                        }
                    }

                }


            },

            initGraph : function(arNodes, arLinks) {
                //add the starting nodes that all graphs will need - composition patient etc.
                var deferred = $q.defer();
                var that = this;

                var nodesToAdd = [];
                nodesToAdd.push({type:'Patient',key:'patient1'});
                nodesToAdd.push({type:'Practitioner',key:'practitioner1'});
                nodesToAdd.push({type:'Composition',key:'composition1',links:[
                    {from: 'composition1', path:'Composition.subject',to:'patient1'},
                    {from: 'composition1', path:'Composition.author',to:'practitioner1'}
                    ]});
                nodesToAdd.push({type:'Encounter',key:'encounter1'});
                var arQuery = [];

                //first get all the nodes....
                nodesToAdd.forEach(function (thing) {
                    var url = "http://hl7.org/fhir/StructureDefinition/"+thing.type;
                    arQuery.push(
                       process(that,url,arNodes,thing)
                    )
                });

                $q.all(arQuery).then(
                    function(data){

                        //arNodes = arNodes.concat(data);//r.copy(newNode));
                        var vo = {nodes:data,links:[]}
                        //now add the links (actually, could do that anytime, but seems tidier here...)
                        nodesToAdd.forEach(function (thing) {
                            if (thing.links) {
                                thing.links.forEach(function (link) {
                                    var newLink = that.addReference(vo.nodes,link.from,link.path,link.to)
                                    if (newLink) {
                                        vo.links.push(newLink);     //this is the list of links for the graph...
                                    } else {
                                        console.log("can't link ",link)
                                    }

                                })
                            }

                        })



                        deferred.resolve(vo);

                    },function(err) {
                        console.log(err)
                        deferred.reject(err)
                    }
                );

                function process(svc,url,arNodes,thing) {
                    var deferred = $q.defer();
                       svc.getProfileElements(url).then(
                           function (vo) {
                               var item = {url:url,elements:vo.elements};     //my data about this node
                               var newNode = that.newNode(thing.type,item,thing.key);             //the new node
                               //arNodes.push(angular.copy(newNode));
                               deferred.resolve(newNode)

                           }, function(err){
                               console.log(err)
                               deferred.reject(err)
                           });

                    return deferred.promise;
                }

                return deferred.promise;
            },

            possibleReferences : function(node,allNodes) {
                //return a list of all the nodes that this one can create a reference to

                //construct a hash of all resource types in the current model todo - create and maintina this separately...
                var hashResources = {Resource:[]};
                allNodes.forEach(function (node) {
                    var type = node.myData.type;        //the resource type. When we support profiles, this will be the constained type...
                    hashResources[type] = hashResources[type] || []
                    hashResources[type].push(node.key);
                    hashResources['Resource'].push(node.key);   //all resources

                });

                var ar = [];
                var item = node.myData;
                item.elements.forEach(function (ed) {

                    var path = ed.path;
                    if (ed.type) {
                        ed.meta.links = []
                        ed.type.forEach(function (typ) {
                            if (typ.code == 'Reference') {


                                //this is a reference
                                var profile = typ.targetProfile;    //R3
                                if (!profile && type.profile) {profile = profile[0]}    //R2

                                if (profile) {
                                    var type = profile.getLastBySlash();
                                    ed.meta.links = ed.meta.links.concat(hashResources[type]);

                                }

                            }
                        })
                    }

                });


            },
            newNode : function(type,item,key) {

                key = key || type + '-' + new Date().getTime();



                item.key = key;
                item.type = type;

                // var item = {key:key,resourceType:'Condition'};
                var newNode = {key:key,items:[]}
                newNode.myData = item;
                newNode.myTitle = type;
                item.elements.forEach(function (ed) {
                    if (ed.meta.include) {
                        newNode.items.push({name:ed.meta.displayPath, iskey:false, myData: ed})
                    }
                });


                return newNode;




            },

            getProfileElements : function(url) {
                var deferred = $q.defer();

                var elements = [];      //array of elementDefinitions
                GetDataFromServer.findConformanceResourceByUri(url).then(
                    function(SD) {
                        //now create an array of paths in the profile (excluding non desired ones)
                        SD.snapshot.element.forEach(function (ed) {
                            var path = ed.path;
                            var ar = path.split('.');
                            var include = true;
                            if (elementsToIgnore.indexOf(ar[1]) > -1) {
                                include = false;
                            }

                            if (ar.length ==1) {include=false;}

                            if (include) {
                                ar.splice(0,1)

                                ed.meta = {displayPath:ar.join('.'),include:false};
                                if (ar.length == 1 &&  ed.min !== 0) {
                                    ed.meta.include=true;
                                }

                                elements.push(ed)
                            }

                        });


                        deferred.resolve({elements:elements});
                    },function(err){
                        deferred.reject(err)
                });

                return deferred.promise;
            }
        }
    });

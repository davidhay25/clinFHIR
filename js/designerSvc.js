
angular.module("sampleApp")

    .service('designerSvc', function(GetDataFromServer,$localStorage,$http,$timeout,$q) {

        var elementsToIgnore =['id','meta','implicitRules','language','text','contained','extension','modifierExtension'];
/*
        // define several shared Brushes

*/
        return {

            initGraph : function(arNodes, arLinks) {
                //add the starting nodes that all graphs will need - composition patient etc.
                var deferred = $q.defer();
                var that = this;

                var nodesToAdd = [];
                nodesToAdd.push({type:'Patient',key:'patient'});
                nodesToAdd.push({type:'Practitioner',key:'practitioner'});
                nodesToAdd.push({type:'Composition',key:'composition',links:[
                    {from: 'composition', path:'subject',to:'patient'},
                    {from: 'composition', path:'author',to:'practitioner'}
                    ]});

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
                        console.log(data)
                        //arNodes = arNodes.concat(data);//r.copy(newNode));
                        var vo = {nodes:data,links:[]}
                        //now add the links (actually, could do that anytime, but seems tidier here...)
                        nodesToAdd.forEach(function (thing) {
                            if (thing.links) {
                                thing.links.forEach(function (link) {
                                    vo.links.push(link);
                                })
                            }

                        })


//console.log(nodesToAdd)

                        deferred.resolve(vo);

                    },function(err) {
                        console.log(err)
                        deferred.reject(err)
                    }
                )

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
                           })

                    return deferred.promise;
                }

                return deferred.promise;
            },

            possibleReferences : function(node,allNodes) {
                //return a list of all the nodes that this one can create a reference to
                var ar = []
                var item = node.myData;
                item.elements.forEach(function (ed) {
                    if (ed.meta.include) {
                        var path = ed.path;
                        if (ed.type) {
                            ed.type.forEach(function (typ) {
                                if (typ.code == 'Reference') {


                                    //this is a reference
                                    var profile = typ.targetProfile;    //R3
                                    if (!profile && type.profile) {profile = profile[0]}    //R2

                                    if (profile) {
                                        //now find all existing models that match that profile...
                                        allNodes.forEach(function (eNode) {
                                            var eItem = eNode.myData;
                                            if (eItem && eItem.url == profile) {
                                                console.log('--> ' + eItem.key)
                                            }
                                        })

                                    }


                                    console.log(path,profile)
                                }
                            })
                        }
                    }
                });


            },
            newNode : function(label,item,key) {

                key = key || "NewNode" + new Date().getTime();
                item.key = key;

                // var item = {key:key,resourceType:'Condition'};
                var newNode = {key:key,items:[]}
                newNode.myData = item;
                newNode.myTitle = label;
                item.elements.forEach(function (ed) {
                    if (ed.meta.include) {
                        newNode.items.push({name:ed.meta.displayPath, iskey:false, myData: ed})
                    }
                });


                return newNode;
               // nodeArray.push(angular.copy(newNode))
               // console.log(newNode);
               // var link = { from: key, to: "Suppliers", text: "author", toText: "1"};
               // $scope.linkDataArray.push(link)



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
                                if (ed.min !== 0) {
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

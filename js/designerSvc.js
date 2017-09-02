
angular.module("sampleApp")

    .service('designerSvc', function(GetDataFromServer,$localStorage,$http,$timeout,$q) {

        var elementsToIgnore =['id','meta','implicitRules','language','text','contained','extension','modifierExtension'];

        return {

            newNode : function(label,data,nodeArray) {

                var key = "NewNode" + new Date().getTime();
                data.key = key;

                // var item = {key:key,resourceType:'Condition'};
                var newNode = {key:key,items:[]}
                newNode.myData = data;
                newNode.myTitle = label;
                data.elements.forEach(function (ed) {
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

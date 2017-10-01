angular.module("sampleApp")
//this performs marking services


    .service('markerSvc', function() {


        //paths that will be ignored when looking for existing data in the reference
        var ignorePaths = ['id','text','subject','resourceType','patient','entry']

        //find all the references between resources (aka connections) from a single resource
        function getReferences(refs,resource,nodePath,index) {
            angular.forEach(resource,function(value,key){

                //if it's an object, does it have a child called 'reference'?
                if (angular.isArray(value)) {
                    value.forEach(function(obj,inx) {
                        //examine each element in the array
                        if (obj) {  //somehow null's are getting into the array...
                            var lpath = nodePath + '.' + key;
                            if (obj.reference) {
                                //this is a reference!

                                var ar = obj.reference.split('/')   //assume a relative reference

                                refs.push({path: lpath, type:ar[0]})
                            } else {
                                //if it's not a reference, then does it have any children?
                                getReferences(refs,obj,lpath,inx)
                            }
                        }



                    })
                } else

                if (angular.isObject(value)) {
                    var   lpath = nodePath + '.' + key;
                    if (value.reference) {
                        //this is a reference!
                        //console.log('>>>>>>>>'+value.reference)
                        var ar = value.reference.split('/')   //assume a relative reference
                        refs.push({path:lpath, type:ar[0]})
                    } else {
                        //if it's not a reference, then does it have any children?
                        getReferences(refs,value,lpath)
                    }
                }




            })
        }


        //get all the paths that have a value in the resource
        function getData(resource) {
            var arData = [];
            angular.forEach(resource,function (value,path) {
                console.log(path,value);
                if (ignorePaths.indexOf(path) == -1) {
                    //this is an existing value that should be in the test resource
                    var item = {type: resource.resourceType,path:path,value:value};
                    if (angular.isObject(value)) {
                        item.jsonValue = angular.toJson(value);
                    }
                    arData.push(item)
                }
            });
            return arData
        }

        //see if the test resources have the required data...
        function scoreData(testResources, refResources) {
            var score = {data:[]}
            var found = 0, count = 0;
            var countedPathHash = {};       //a hash of reasource paths that have already been counted
            angular.forEach(refResources,function (arItem,type) {
                arItem.forEach(function (item) {
                    item.data.forEach(function (property) {     //{type: path: value: }
                        //now go through each resource of this type in the test to see if one has this value...
                        property.result = "not found";
                        count ++;
                        var test = testResources[property.type];
                        if (test) {
                            for (var i=0; i < test.length; i++ ) {
                                var resource = test[i].resource;
                                if (resource[property.path]) {
                                    //there is a value on this path, does it match the required one?
                                    var hash = resource.id + "-"+property.path;
                                    if (! countedPathHash[hash]) {
                                        var same = false;
                                        if (property.jsonValue) {
                                            var json = angular.toJson(resource[property.path])
                                            if (json == property.jsonValue) {
                                                same = true;
                                            }

                                        } else {
                                            if (resource[property.path] == property.value) {
                                                //yes!
                                               same = true;
                                            }
                                        }
                                        if (same) {
                                            property.result = "found"
                                            property.score = 1;
                                            found ++;
                                            countedPathHash[hash] = true;
                                        }



                                    }


                                }
                            }
                        }

                        score.data.push(property)
                    })
                })
            });

            //now the score
            score.score = Math.round((found / count) * 10000 )/100;   //as a percantage to 2 decimal places...
            return score;
        }

        //create a hash indexed by resource type for all resources in the bundle
        function analyseBundle(bundle) {
            var obj = {};
            bundle.entry.forEach(function(entry){
                var resource = entry.resource;
                var type = resource.resourceType;
                obj[type] = obj[type] || [];
                var item = {resource:resource};

                //now, get all the references from this resource
                var refs = [];
                getReferences(refs,resource,resource.resourceType);
                item.references = refs;

                //now the values in the reference resources (top level only)
                item.data = getData(resource);

                obj[type].push(item);

            });
            return obj;
        }

        //create lists of connections - {from: path: to:}
        function checkReferences(testResources, refResources){

            var refList = makeConnectionList(refResources)
            var testList = makeConnectionList(testResources)
            //console.log(refList)
            //console.log(testList)
            var  found=0
            //now, go through the refList and mark all the ones where there is an equivalent in the test list...
            //this is not a particularly efficient algorithm...
            refList.forEach(function (conn) {
                for (var i=0; i < testList.length; i++) {
                    var cn = testList[i];
                    if (conn.hash == cn.hash && ! cn.found) {
                        cn.found = true;
                        conn.found = true;      //mark that there is a connection of this type in the test bundle..
                        found++;
                        break;
                    }
                }
            });

            //now the score
            var result = {connections: refList};
            result.score = Math.round((found / refList.length) * 10000 )/100;   //as a percantage to 2 decimal places...
            return result;
        }

        function makeConnectionList(objResource) {
            //make an array of connection types (resource references) for all resources in the object {from: path: to: hash: }
            var lst = [];
            angular.forEach(objResource,function(arResources,type){
                arResources.forEach(function (resource) {
                    resource.references.forEach(function (ref) {
                        var item = {from: type, path: ref.path, to: ref.type};
                        item.hash = type+'-'+ref.path+'-'+ref.type;         //to make the comparison quickef...
                        lst.push(item)
                    })
                })
            });
            return lst;
        }


        function compareResourceTypes(testResources, refResources) {
            //see if the number and type of resources is the same in both bundles
            var result = {types:{},score:0};
            var cntInRef = 0;     //number of resource types in the reference
            var totalScore = 0;     //the total score - used to calculate the overall score
            angular.forEach(refResources,function(ar,type){
                //for each type in the references, are there the same number in the bundle being tested?
                cntInRef++;
                result.types[type] = {test:0,ref:ar.length,score:0}

                if (testResources[type]) {
                    //set the number of this resourceType in the bundle being tested...
                    var cntTest = testResources[type].length;
                    var cntRef = ar.length;
                    result.types[type].test = cntTest;
                    if (cntTest == cntRef) {
                        result.types[type].score = 100
                    } else {
                        result.types[type].score = 75
                    }
                    totalScore += result.types[type].score;
                }

                //now work out the score for this category - the average of all the individual scores...
                result.score = Math.round((totalScore / cntInRef) * 100)/100;
                //console.log(type,ar)

                //Math.round(num * 100) / 100
            })
            return result;

        }


        return {
            mark: function (inTestContainer,inRefContainer) {

                //the analysis routines can update the resources...
                var testContainer = angular.copy(inTestContainer);
                var refContainer = angular.copy(inRefContainer);

                var testResources = analyseBundle(testContainer.bundle);   //resources in bundle being tested
                var refResources = analyseBundle(refContainer.bundle);     //resources in reference bundle


                //console.log(testResources)
                //console.log(refResources)

                var score = {overallScore:0};     //the scoring object
                score.compareResourceTypes = compareResourceTypes(testResources,refResources);
                score.references = checkReferences(testResources, refResources);
                score.data = scoreData(testResources, refResources);

                //overall score
                score.score = (score.compareResourceTypes.score + score.references.score + score.data.score) / 3
                score.score = Math.round(score.score * 100) / 100
               // console.log(testContainer,testResources)
               // console.log(score)
                return score

            }
        }
    })
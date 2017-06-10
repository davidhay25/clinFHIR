angular.module("sampleApp")
//this performs marking services


    .service('markerSvc', function($http,$q,appConfigSvc,GetDataFromServer,Utilities,$filter,supportSvc,SaveDataToServer) {



        function getReferences(refs,node,nodePath,index) {
            angular.forEach(node,function(value,key){

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



        function countResources(bundle) {
            var obj = {};
            bundle.entry.forEach(function(entry){
                var resource = entry.resource;
                var type = resource.resourceType;
                obj[type] = obj[type] || []
                var item = {resource:resource};

                //now, get all the references from this resource

                var refs = [];
                getReferences(refs,resource,resource.resourceType)
                item.references = refs;

                obj[type].push(item);

            });
            return obj;


        }


        function checkReferences(testResources, refResources){
            //create lists of connections - {from: path: to:}
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
                        var item = {from: type, path: ref.path, to: ref.type}
                        item.hash = type+'-'+ref.path+'-'+ref.type;         //to make the comparison quickef...
                        lst.push(item)
                    })
                })
            })
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

                var testResources = countResources(testContainer.bundle);   //resources in bundle being tested
                var refResources = countResources(refContainer.bundle);     //resources in reference bundle


                //console.log(testResources)
                //console.log(refResources)

                var score = {overallScore:0};     //the scoring object
                score.compareResourceTypes = compareResourceTypes(testResources,refResources);
                score.references = checkReferences(testResources, refResources);
                score.score = (score.compareResourceTypes.score + score.references.score) / 2
                score.score = Math.round(score.score * 100) / 100
               // console.log(testContainer,testResources)
               // console.log(score)
                return score

            }
        }
    })
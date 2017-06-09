angular.module("sampleApp")
//this performs marking services


    .service('markerSvc', function($http,$q,appConfigSvc,GetDataFromServer,Utilities,$filter,supportSvc,SaveDataToServer) {


        function createResourceSignature() {

        }

        function countResources(bundle) {
            var obj = {};
            bundle.entry.forEach(function(entry){
                var resource = entry.resource;
                var type = resource.resourceType;
                obj[type] = obj[type] || []
                obj[type].push(resource);
            });
            return obj;
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
            mark: function (testContainer,refContainer) {
                var testResources = countResources(testContainer.bundle);   //resources in bundle being tested
                var refResources = countResources(refContainer.bundle);     //resources in reference bundle

                var score = {overallScore:0};     //the scoring object
                score.compareResourceTypes = compareResourceTypes(testResources,refResources)


                console.log(testContainer,testResources)
                console.log(score)
                return score

            }
        }
    })
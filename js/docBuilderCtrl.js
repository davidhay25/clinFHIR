/*has been deprectde - don't call make function - expensive! */

angular.module("sampleApp")
    .controller('docBuilderCtrl',
        function ($scope,$rootScope,builderSvc) {


            //$scope.resourcesBundle - bundle representing current document - defined in parent Controller

            $scope.builderSvc = builderSvc;         //so we can access service functions from the page...
            $scope.resourcesNotInThisSection = [];  //a list of resources that aren't in this section todo make recursive based on references
            $scope.input = {}


            $rootScope.$on('addResource',function(event,resource){
                console.log(resource)
                var reference =  builderSvc.referenceFromResource(resource)
                $scope.resourcesNotInThisSection.push(reference)

            });

            $rootScope.$on('newSet',function(){
                delete $scope.currentSection
            })
           

            $scope.initializeDocumentDEP = function() {
                $scope.docInit = true;
            };


            $scope.addResourceToSection = function(reference) {
                //add the resource to this sestion and remove from the 'potentials' list
                $scope.currentSection.entry.push({reference:reference})
                $rootScope.$emit('docUpdated',$scope.compositionResource);
                removeStringFromArray($scope.resourcesNotInThisSection,reference);   //remove from the 'not in section' array...
                
            };


            $scope.removeReferenceFromSection = function(index) {
                var reference = $scope.currentSection.entry.splice(index,1);
                $scope.resourcesNotInThisSection.push(reference[0].reference);
                $rootScope.$emit('docUpdated',$scope.compositionResource);

            };


            //remove a string from an array based on it's value
            removeStringFromArray = function(arr, ref) {
                var g = arr.indexOf(ref);
                if (g > -1) {
                    arr.splice(g,1)
                }
            }


            $scope.selectSection = function(section) {
                $scope.currentSection = section;

                //now compile the list of resources that aren't in this section
                $scope.resourcesNotInThisSection.length = 0;
                $scope.resourcesBundle.entry.forEach(function(entry){
                    var resource= entry.resource;
                    //var reference = resource.resourceType + "/" + resource.id;

                    var reference =  builderSvc.referenceFromResource(resource);
                    var isInSection = false;
                    for (var i=0; i < $scope.currentSection.entry.length; i++) {

                        if ($scope.currentSection.entry[i].reference == reference) {
                            isInSection = true;
                            break;
                        }
                    }

                    if (! isInSection) {
                        $scope.resourcesNotInThisSection.push(builderSvc.referenceFromResource(resource));
                    }

                })


            };

            $scope.addSection = function() {
                var title = $scope.input.sectName
                delete $scope.input.sectName;     //the name given to the section
                //$scope.compositionResource is defined in parent controller (builderCtrl);
                var section = {title:title,entry:[]};
                
                $scope.compositionResource.section.push(section)
                $scope.selectSection(section)
                $rootScope.$emit('docUpdated',$scope.compositionResource);
            }
    });
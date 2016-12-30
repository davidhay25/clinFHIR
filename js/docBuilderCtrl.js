/*has been deprectde - don't call make function - expensive! */

angular.module("sampleApp")
    .controller('docBuilderCtrl',
        function ($scope,$rootScope,builderSvc,$uibModal) {


            //$scope.resourcesBundle - bundle representing current document - defined in parent Controller

            $scope.builderSvc = builderSvc;         //so we can access service functions from the page...
            $scope.resourcesNotInThisSection = [];  //a list of resources that aren't in this section todo make recursive based on references
            $scope.input = {}


            $rootScope.$on('addResource',function(event,resource){
                console.log(resource)
                var reference =  builderSvc.referenceFromResource(resource)
                $scope.resourcesNotInThisSection.push({reference:reference,display:resource.text.div})

            });

            $rootScope.$on('newSet',function(){
                delete $scope.currentSection

                
                
            })

            $rootScope.$on('resourceEdited',function(event,resource){
                //a resource has been edited - re-create the document text...
                //These are scope variables from the parent controller...
                $scope.generatedHtml = builderSvc.makeDocumentText($scope.compositionResource);
            });

            $scope.editSection =function(section) {
                $uibModal.open({
                    templateUrl: 'modalTemplates/editSection.html',
                    size: 'lg',
                    controller: function($scope,section){
                        $scope.section = section;

                        $scope.save = function(){
                            $scope.$close();
                        }
                    },
                    resolve : {
                        section: function () {          //the default config
                            return section;
                        }
                    }
                })
            };

            $scope.selectResourceFromSection = function(ref){
                console.log(ref);
                var resource = builderSvc.resourceFromReference(ref);

                $scope.selectResource(resource);        //<<<< this is in the parent controller

            };

            $scope.initializeDocumentDEP = function() {
                $scope.docInit = true;
            };


            $scope.addResourceToSection = function(reference) {
                //add the resource to this section and remove from the 'potentials' list

                var display = ""
                var resource = builderSvc.resourceFromReference(reference);
                if (resource) {
                    display = resource.text.div
                }
                
                $scope.currentSection.entry.push({reference:reference.reference,
                    display: display})
                $rootScope.$emit('docUpdated',$scope.compositionResource);

                //remove from the 'not in this section' array...
                for (var i=0; i < $scope.resourcesNotInThisSection.length; i++) {
                    if ($scope.resourcesNotInThisSection[i].reference == reference.reference) {
                        $scope.resourcesNotInThisSection.splice(i,1);
                        break;
                    }
                }

                // removeStringFromArray($scope.resourcesNotInThisSection,reference);   //remove from the 'not in section' array...

                //These are all scope variables from the parent controller...
                $scope.generatedHtml = builderSvc.makeDocumentText($scope.compositionResource,$scope.resourcesBundle)

            };


            $scope.removeReferenceFromSection = function(index) {
                var reference = $scope.currentSection.entry.splice(index,1);


                var display = "";

                var resource = builderSvc.resourceFromReference(reference[0].reference);
                if (resource) {
                    display = resource.text.div

                }

                $scope.resourcesNotInThisSection.push({reference:reference[0].reference,
                    display:display});
                $rootScope.$emit('docUpdated',$scope.compositionResource);

                //These are all scope variables from the parent controller...
                $scope.generatedHtml = builderSvc.makeDocumentText($scope.compositionResource,$scope.resourcesBundle)

            };


            //remove a string from an array based on it's value
            removeStringFromArrayDEP = function(arr, ref) {
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
                        $scope.resourcesNotInThisSection.push(
                            {reference:builderSvc.referenceFromResource(resource),display:resource.text.div});
                    }

                })


            };

            $scope.addSection = function() {
                var title = $scope.input.sectName
                delete $scope.input.sectName;     //the name given to the section
                //$scope.compositionResource is defined in parent controller (builderCtrl);
                //create a text section with a placeholder for generated text
                var text = {status : 'generated', div : "<div id='gen'>Generated text here</div>"}
                var section = {title:title,text : text, entry:[]};
                $scope.compositionResource.section = $scope.compositionResource.section || []
                $scope.compositionResource.section.push(section);
                $scope.selectSection(section)
                $rootScope.$emit('docUpdated',$scope.compositionResource);

                //These are all scope variables from the parent controller...
                $scope.generatedHtml = builderSvc.makeDocumentText($scope.compositionResource,$scope.resourcesBundle)
            }
    });
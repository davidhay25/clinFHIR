
angular.module("sampleApp")
    .controller('builderCtrl',
        function ($scope,$http,appConfigSvc,$q,GetDataFromServer,resourceCreatorSvc,RenderProfileSvc,builderSvc,
                  $timeout,$localStorage,$filter) {

            $scope.input = {};

            $scope.resourcesBundle = $localStorage.builderBundle || {resourceType:'Bundle',entry:[]}




            $scope.makeGraph = function() {
                var vo = builderSvc.makeGraph($localStorage.builderBundle)   //todo - may not be the right place...


                console.log(vo);

                var container = document.getElementById('resourceGraph');
                //var container = $('#resourceGraph');

                var options = {
                    physics: {
                        enabled: true,
                        barnesHut: {
                            gravitationalConstant: -10000,
                        }
                    }
                };
                console.log(container);

                $scope.chart = new vis.Network(container, vo.graphData, options);
                
                
                return;

  /*
                //so that we can draw a table with the references in it...
                $scope.modelReferences = vo.references;
                $scope.uniqueModelsList = vo.lstNodes;


                //console.log($scope.uniqueModelsList)
                var allNodesObj = vo.nodes;
*/
               
            }
            $timeout(function(){
                $scope.makeGraph()
            }, 1000);
            //$scope.makeGraph()

            $scope.redrawChart = function(){
                //$scope.chart.fit();
                $timeout(function(){
                    $scope.chart.fit();
                    console.log('fitting...')
                },1000            )

            }

            $scope.selectResource = function(resource) {
                delete $scope.input.text;
                console.log(resource);
                $scope.currentResource = resource;

                var uri = "http://hl7.org/fhir/StructureDefinition/"+resource.resourceType;
                GetDataFromServer.findConformanceResourceByUri(uri).then(
                    function(SD) {
                        console.log(SD);

                        var objReferences = {}      //a hash of path vs possible resources for that path

                        var references = builderSvc.getReferences(SD); //a list of all possible references by path
                        console.log(references);
                        references.forEach(function(ref){
                            var path = ref.path
                            objReferences[path] = objReferences[path] || {resource:[],ref:ref}
                            //now find all existing resources with this type
                            var type = $filter('getLogicalID')(ref.profile);
//console.log(type)
                            var ar = builderSvc.getResourcesOfType(type,$scope.resourcesBundle);
                            if (ar.length > 0) {
                                ar.forEach(function(resource){

                                    //objReferences[path].ref = ref;
                                    objReferences[path].resource.push(resource);
                                })
                            }
                        })

                        console.log(objReferences)
                        $scope.objReferences = objReferences;

                    }
                )


            };

            $scope.linkToResource = function(pth,resource,ref){
                //reference this resource to the current one
                var path = $filter('dropFirstInPath')(pth);

                if (ref.max == 1) {
                    $scope.currentResource[path] = {reference:resource.resourceType+'/'+resource.id}
                }
                if (ref.max =='*') {
                    $scope.currentResource[path] = $scope.currentResource[path] || []
                    $scope.currentResource[path].push({reference:resource.resourceType+'/'+resource.id})
                }


                console.log(resource,ref)
            }



            $scope.addNewResource = function(type) {
                var resource = {resourceType : type};
                resource.id = 't'+new Date().getTime();
                resource.text = {status:'generated',div:"<div  xmlns='http://www.w3.org/1999/xhtml'>"+
                    $scope.input.text+'</div>'};
                console.log(resource);
                $scope.resourcesBundle.entry.push({resource:resource});
                $localStorage.builderBundle = $scope.resourcesBundle;
            };

            $scope.newTypeSelected = function(item) {
                var type = item.name;
                var uri = "http://hl7.org/fhir/StructureDefinition/"+type;
                GetDataFromServer.findConformanceResourceByUri(uri).then(
                    function(data) {
                        console.log(data);
                        $scope.currentType = data;
                        $scope.references = builderSvc.getReferences($scope.currentType)
                        console.log($scope.references);

                    }
                )

            }

            RenderProfileSvc.getAllStandardResourceTypes().then(
                function(lst) {
                    $scope.resources = lst
                    //console.log($scope.resources);


                }
            );






        });
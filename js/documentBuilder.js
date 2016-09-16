angular.module("sampleApp").controller('documentBuilderCtrl',
    function ($scope,$http,ResourceUtilsSvc) {

        $scope.ResourceUtilsSvc = ResourceUtilsSvc;

        $scope.documentBundle = {};
        $scope.possibleResources = [];
        $scope.oneResourceType = [];
        $scope.input = {};
        $http.get('http://localhost:8080/baseDstu3/Patient/1211/$everything?_count=100').then(
            function(data){
                $scope.allResourcesBundle = data.data;
            }
        );

        $http.get("artifacts/documentBuilderConfig.json").then(
            function(data) {
                console.log(data.data);
                $scope.config = data.data
            }
        );



        //when a resource is removed from the current section
        $scope.removeResource = function(inx) {
            var res = $scope.selectedSection.resources.splice(inx,1);
            buildListOfPossibleResources(res.resourceType);     //update the list of possibilities
            buildDocument();
        }

        //when a single resource is selected to be added
        $scope.resourceSelected = function(res) {
            console.log(res);
            $scope.selectedSection.resources.push(res);
            delete $scope.selectedSection.emptyReason;          //make sure that emptyReason isn't set...
            buildListOfPossibleResources(res.resourceType);     //update the list of possibilities
            buildDocument();
        };

        //when a resource type is selected...
        $scope.typeSelected = function(typ) {
            buildListOfPossibleResources(typ)
        };


        function buildListOfPossibleResources(typ) {
            $scope.oneResourceType.length = 0;
            $scope.allResourcesBundle.entry.forEach(function(entry){
                var resource = entry.resource;
                if (resource.resourceType == $scope.input.type) {

                    //this is the correct type, is it already in this section?
                    var canAdd = true;
                    $scope.selectedSection.resources.forEach(function(res){
                        if (res.id == resource.id) {        //already selected
                            canAdd = false;
                        }
                    });
                    if (canAdd) {
                        $scope.oneResourceType.push(resource)
                    }

                    //$scope.oneResourceType.push(resource)

                }

            });
//console.lo
        }

        //mark that a section deliberately has no resources in it...
        $scope.setEmptyReason = function() {
            if ($scope.input.emptyReason) {
                $scope.selectedSection.emptyReason = $scope.input.emptyReason;
            } else {
                delete $scope.selectedSection.emptyReason
            }
        };

        //when a single section has been selected
        $scope.sectionSelected = function(section) {
            section.resources = section.resources ||[];     //list of resources in this section
            $scope.selectedSection = section;
            $scope.possibleResources.length = 0;

            //if an empty reason as been selected, then enable the emptyreason dialog and set the value...
            if ($scope.selectedSection.emptyReason) {
                $scope.input.emptyReason = $scope.selectedSection.emptyReason;
            } else {
                //other wise delete it...
                delete $scope.input.emptyReason;
            }
            

            $scope.allResourcesBundle.entry.forEach(function(entry){
                var resource = entry.resource;
                if (section.types.indexOf(resource.resourceType) > -1){
                    $scope.possibleResources.push(resource)
                }

            })
            
        };

        //build the actual document bundle
        var buildDocument = function() {

           var doc = {resourceType:'Bundle',type:'document'}

            doc.entry = [];

            //add the composition
            var comp = buildComposition();
            addToBundle(comp);

            //now add the sections - assume one level for now...

            $scope.config.sections.forEach(function(section){

                if (section.emptyReason) {
                    //if the section is marked as empty, then create a section with the reason...
                    var compSection = {};       //the section element in the composition
                    comp.section.push(compSection);     //add to the composition
                    compSection.title = section.display;
                    compSection.code = {coding:[{code:section.code}]};
                    compSection.emptyReason = {coding:[{code:section.emptyReason,system:"http://hl7.org/fhir/ValueSet/list-empty-reason"}]}
                } else if (section.resources && section.resources.length > 0) {

                    var compSection = {};       //the section element in the composition
                    comp.section.push(compSection);     //add to the composition
                    compSection.title = section.display;
                    compSection.code = {coding:[{code:section.code}]};
                    compSection.entry = [];
                    section.resources.forEach(function(res){
                        addToBundle(res);       //add the resource to the bundle
                        var entry = {"reference":res.resourceType + "/" + res.id} //assume a local reference
                        entry.display = ResourceUtilsSvc.getOneLineSummaryOfResource(res);
                        compSection.entry.push(entry);      //add a reference from the section to the resource
                    })
                }
            });


            $scope.document = doc;


            function addToBundle(res) {
                doc.entry.push({resource:res})
            }


        };

        var buildComposition = function() {
            var comp = {resourceType:'Composition',date: "2016-09-16",status:"final",section:[]}

            return comp;
        }

});
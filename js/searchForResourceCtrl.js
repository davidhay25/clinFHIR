
//the cntroller for the resource lookup dialog...
//templateUrl: "/modalTemplates/searchForResource.html",

angular.module("sampleApp")
    .controller('searchForResourceCtrl', function ($scope, vo,Utilities,GetDataFromServer,profileUrl,appConfigSvc,ResourceUtilsSvc) { //$modalInstance,
        //console.log(vo)
        $scope.profileUrl = profileUrl;
        $scope.typeWasSpecified = true;
        $scope.loading = true;
        $scope.resourceType = vo.resourceType;
        $scope.results = {};
        $scope.input={};
        $scope.anyResource = false;
        $scope.tab = {tabQuery : true};
        $scope.resourceTypeList = [];
        $scope.config = appConfigSvc.config();


        $scope.ResourceUtilsSvc = ResourceUtilsSvc;
        
        var searchParamsByName = {};  //indexed by name...

        //console.log(vo)

        //if there was no resource type passed in, then need to allow the user to select a resource type -
        //but only from the list of resources that are 'reference'
        if ( $scope.resourceType == 'Resource') {
            $scope.typeWasSpecified = false;
            Utilities.getAllResourceTypes(function(lst){
                lst.forEach(function(r){
                    if (r.reference) {
                        $scope.resourceTypeList.push(r)
                    }
                })
            });
        }

        //when the user can select the type...
        $scope.typeSelected = function(type){
            //console.log(type)
            $scope.resourceType= type.name;
            findSearchParams();     //there a possible race condition here if the ocnformance hasn't been loaded - but unlikley I think
        };

        //retireve the conformane resource from the current data server so we know what search paramters are available
        //returns a promise from $http
        Utilities.getConformanceResourceForServerType('data').then(
            function(data) {
                //console.log(conf);
                $scope.loading = false;
                $scope.conf = data.data;

                findSearchParams();     //find the search parameters for this resource type
            },
            function(err) {
                alert('error retrieving conformance resoruce for the Data server')

        });

        function findSearchParams(){
            if ($scope.conf && $scope.conf.rest) {
                $scope.conf.rest[0].resource.forEach(function(def){        //<<< assume there is only one rest endpoint
                    if (def.type == $scope.resourceType ) {
                        $scope.searchParams = def.searchParam;      //an array of search params
                        //populate the dictionary...
                        searchParamsByName = {};        //clear any existing
                        $scope.searchParams.forEach(function(param){
                            searchParamsByName[param.name] =param;
                        });
                    }
                })
            }
        }

        $scope.search = function() {
            delete $scope.selectedResources;    //the bundle of returned resources...
            delete $scope.selectedResource;     //the selected resource. 
            delete $scope.selectedResourceJson;

            //build the search string;
            var searchString = $scope.resourceType + "?";
            angular.forEach($scope.results,function(value,key){
                console.log(value,key)
                var param = searchParamsByName[key];    //the parameter defininition
                
                if (value) {
                    if (param.type == 'token') {
                        //if a token then use the text modifier to search the description rather than the code...
                        searchString += key + ':text=' + value + '&';
                    } else {
                        searchString += key + '=' + value + '&';
                    }
                }

            });
            searchString = searchString.substr(0,searchString.length-1);
            console.log(searchString);
            $scope.searchString = searchString;
            $scope.loading = true;

            //this will actually check the data server...
            GetDataFromServer.generalFhirQuery(searchString).then(
                function(data){

                    //is this to match a specific profile?
                    if ($scope.profileUrl && data && data.entry) {
                        $scope.selectedResources = {entry:[]}
                        //only include resources which have a matching profile
                        data.entry.forEach(function(item){
                            var resource = item.resource;
                            if (resource.meta && resource.meta.profile) {
                                for (var i=0; i<resource.meta.profile.length;i++){
                                    if (resource.meta.profile[i] == $scope.profileUrl){
                                        $scope.selectedResources.entry.push(item);
                                        break;
                                    }
                                }
                            }
                        })

                    } else {
                        $scope.selectedResources = data;
                    }

                },function(err){

                }).finally(function(){
                $scope.loading = false;
            });

        };

        $scope.selectResource = function(ent){
            //when the user has selected an entry in the list...
            //console.log(ent)
            $scope.selectedResource = ent.resource;
            $scope.selectedResourceJson = JSON.stringify(ent.resource,null,2);
        };

        //when the user has selected the resource.
        $scope.ok = function () {
            var selectedResource = null;      //<<< this will be from teh selection of course...
            //console.log($scope.results)
            $scope.$close($scope.selectedResource);

        };

        $scope.cancel = function () {
            //alert('cancel')
            $scope.$dismiss();
        };





    });
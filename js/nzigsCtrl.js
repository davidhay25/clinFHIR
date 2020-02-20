angular.module("sampleApp")
    .controller('nzigsCtrl',
        function ($scope,$http,nzigsSvc) {

            let confServer = "http://home.clinfhir.com:8054/baseR4/";

            $scope.input = {}
            nzigsSvc.getProfiles().then(
                function(data) {
                    $scope.profiles = data.data.profiles;
                    $scope.IGs = data.data.IGs;

                    $scope.extensions = data.data.extensions;

                    decorateProfileExtensions();
                    makeProfilesGraph($scope.profiles)
                }
            );

            //$timeout()

            function decorateProfileExtensions() {
                let hash = {};
                $scope.extensions.forEach(function (ext) {
                    ext.profiles = []   //profiles using this extension
                    hash[ext.url] = ext
                })
                $scope.profiles.forEach(function (prof) {
                    if (prof.extensions) {
                        prof.extensions.forEach(function (ext) {
                            let extDesc = hash[ext.url];
                            if (extDesc) {
                                ext.description = extDesc.description
                                extDesc.profiles.push({profile:prof,path:ext.path})

                            } else {
                                console.log("Undefined extension url:  "+ext.url)
                            }


                        })
                    }

                })

            }


            //construct the graph of all the profiles. Builds the extension (and other) caches as it goes...
            function makeProfilesGraph(profiles) {
                let vo = nzigsSvc.makeProfilesGraph(profiles);
                console.log(vo.errors)
                var container = document.getElementById('profilesGraph');
                var graphOptions = {
                    layout: {
                        hierarchical: {
                            direction: "UD"
                        }
                    }
                };


                $scope.profilesGraph = new vis.Network(container, vo.graphData, graphOptions);
                $scope.profilesGraph.on("click", function (obj) {
                    delete $scope.selectedFsh;
                    delete $scope.selectedSD;
                    delete $scope.allElements;
                    delete $scope.input.selectedElement;

                    var nodeId = obj.nodes[0];  //get the first node

                    var node = vo.graphData.nodes.get(nodeId);
                    $scope.selectedProfile = node.profile;


                    //retrieve the FSH
                    if (node.profile && node.profile.name) {
                        let fshUrl = confServer + 'Binary/profile-' + node.profile.name;
                        $http.get(fshUrl).then(
                            function (data) {
                                //console.log(data.data)
                                $scope.selectedFsh = data.data;
                            }, function () {
                                $scope.selectedFsh = "No shorthand found"
                            }
                        );
                    }


                    //retrieve the profile StructureDefinition
                    delete $scope.profileError;
                    if (node.profile) {
                        let url = node.profile.url;
                        if (url) {
                            let qry = confServer + "StructureDefinition?url=" + url;

                            nzigsSvc.getMostRecentResourceByCanUrl(qry).then(
                                function (vo1) {
                                    $scope.selectedSD = vo1.resource;
                                    $scope.profileError = vo1.err;

                                    //remove the unneeded elements
                                    if ($scope.selectedSD && $scope.selectedSD.snapshot && $scope.selectedSD.snapshot.element) {
                                        $scope.selectedSD.snapshot.element.forEach(function (ele) {
                                            delete ele.mapping;
                                            delete ele.constraint;
                                        })
                                    }

                                    let vo = {SD: $scope.selectedSD, confServer: confServer};
                                    nzigsSvc.makeLogicalModel(vo).then(
                                        function (arLines) {
                                            //console.log(arLines)
                                            $scope.allElements = arLines;
                                        }, function (vo) {
                                            console.log(vo)
                                            $scope.allElements = vo.allElements;
                                        }
                                    )

                                }
                            )


                        }
                    }
                    $scope.$digest();
                })



            }}






    )
    .filter('pathindent', function() {
    return function(path) {
        if (path) {
            let ar = path.split('.');
            return 10 * ar.length;
        }
    }
});



angular.module("sampleApp")
    .controller('nzigsCtrl',
        function ($scope,$http,nzigsSvc,$uibModal) {

            let confServer = "http://home.clinfhir.com:8054/baseR4/";

            //$scope.termServer = "https://r4.ontoserver.csiro.au/fhir/";

            $scope.termServer = "https://ontoserver.csiro.au/stu3-latest/";

            $scope.input = {};

            nzigsSvc.getProfiles().then(
                function(igSummary) {
                    $scope.profiles = igSummary.profiles;
                    $scope.IGs = igSummary.IGs;

                    $scope.extensions = igSummary.extensions;

                    decorateProfileExtensions();
                    makeProfilesGraph($scope.profiles)
                }
            );

            $scope.showRow = function(row) {
                if ($scope.input.showHelp) {
                    return false;
                }

                if ($scope.input.filterText) {
                    let filter = $scope.input.filterText.toLowerCase();

                    if (isMatch(filter,row.description)) {
                        return true;
                    }
                    if (isMatch(filter,row.url)) {
                        return true;
                    }

                    for (let i=0; i < row.profiles.length; i++) {
                        let profile = row.profiles[i]
                        if (profile.profile) {
                            let name = profile.profile.name
                            if (isMatch(filter,name)) {
                                return true;
                                break
                            }
                        }

                    }
                    /*

                    if (row.description) {
                        let description = row.description.toLowerCase();
                        if (description.indexOf(filter) > -1) {
                            return true
                        }
                    }
                    if (row.url) {
                        let url = row.url.toLowerCase()
                        if (url.indexOf(filter) > -1) {
                            return true
                        }
                    }

*/

                    return false

                } else {
                    return true;
                }


                function isMatch(filter,text) {
                    if (text) {
                        let lText = text.toLowerCase()
                        if (lText.indexOf(filter) > -1) {
                            return true
                        } else {
                            return false;
                        }
                    }
                }

            }


            //load the valueset browser. Pass in the url of the vs - the expectation is that the terminology server
            //can use the $expand?url=  syntax
            $scope.viewVS = function(uri) {
                if (uri) {
                    var ar = uri.split('|')

                    $uibModal.open({
                        templateUrl: "/modalTemplates/vsDisplay.html",
                        //size : 'lg',
                        controller: function($scope,uri,termServer,$http) {
                            let url =  termServer +  "ValueSet/$expand?url="+uri;
                            $scope.uri = uri;
                            $scope.showWaiting = true;
                            $http.get(url).then(
                                function(data){
                                    var expandedVs = data.data;
                                    if (expandedVs.expansion) {
                                        $scope.data = expandedVs.expansion.contains;
                                        if (! expandedVs.expansion.contains) {
                                            alert('The expansion worked fine, but no expanded data was returned')
                                        }
                                        console.log(expandedVs.expansion)
                                    } else {
                                        alert('Sorry, no expansion occurred');
                                    }
                                },
                                function(err) {
                                    alert(angular.toJson(err))
                                    console.log(err);
                                }).finally(
                                    function(){
                                        $scope.showWaiting = false;
                                    }
                            )

                        },
                        resolve: {
                            uri : function() {
                                return ar[0]
                            },
                            termServer : function() {
                                //if this is a profiled reference...
                                return $scope.termServer
                            }
                        }
                    });
                }

            };

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
                            direction: "LR",
                            levelSeparation: 200,
                            nodeSpacing : 100
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
                                        });

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
                                    } else {
                                        alert('The profile with the url: ' + url + " was not found on the server")
                                    }

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



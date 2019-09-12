angular.module("igApp")
    .controller('igCtrl',
        function ($scope,$uibModal,$http) {

            let hashExtension = {};     //a hash of ed urls
            let hashType = {};      //a hash of resource types
            let url = "http://test.fhir.org/usage-stats";
            registerAccess();

            //let url = "/artifacts/usagestats.json";
            $http.get(url).then(
                function(data) {
                    let vo = data.data;
                    $scope.allIGs = [];
                    for (var IGurl in vo) {

                        let IG = vo[IGurl];
                        $scope.allIGs.push({url:IGurl,ig:IG})
                        //console.log(IG)
                        for (var extUrl in IG.usage) {
                            let arExt = IG.usage[extUrl];
                            hashExtension[extUrl] = hashExtension[extUrl] || []
                            arExt.forEach(function (path) {
                                let item = {path : path, ig:IGurl, url: extUrl};
                                hashExtension[extUrl].push(item)

                                //now populate the type hash...
                                if (path) {
                                    let ar = path.split('.');
                                    let type = ar[0];
                                    hashType[type] = hashType[type] || []
                                    hashType[type].push(item)
                                }
                            })

                        }

                    }



                    //convert hashType to an array (of arrays) and sort
                    $scope.arTypes = []
                    for (var type in hashType) {
                        let hash = {}
                        let arExt = hashType[type];
                        //get the count of unique extension defs for this type
                        let cnt = 0
                        arExt.forEach(function (item) {
                            let url = item.url;
                            if (! hash[url]) {
                                hash[url] = 'x';
                                cnt++;
                            }
                        })



                        $scope.arTypes.push({type:type,items:arExt,uniqueCnt : cnt});
                    }

                    $scope.sortTypeView('name');
                    /*
                    $scope.arTypes.sort(function(a,b){
                        if (a.type > b.type) {
                            return 1
                        } else {
                            return -1
                        }
                    });

                    */




                    for (var ext in hashExtension) {
                        let arExt = hashExtension[ext];
                        //console.log(arExt)
                        arExt.sort(function (a, b) {
                            if (a.ig > b.ig) {
                                return 1
                            } else {
                                return -1
                            }

                        })
                    }

                    //need to copy the hash into an array so it can be sorted...
                    $scope.arExtensions = []
                    for (var ext in hashExtension) {
                        let arExt = hashExtension[ext];

                        $scope.arExtensions.push({url:ext,usage: arExt});
                    }

                    console.log($scope.arExtensions)



                    $scope.sortEDView('freq')



                }

            );

            $scope.hashIGDetailDescription = {};
            $scope.hashIGDetailDescription.extensions = "Extensions defined by this IG";
            $scope.hashIGDetailDescription.profiles = "Profiles defined by this IG";
            $scope.hashIGDetailDescription.used = "External extensions used by this IG";

            $scope.selectIG = function(IG) {
                //delete $scope.selectedIGDetailsKey;
                $scope.selectedIG = IG;
                console.log(IG)
                $scope.usedExtensionsByPath = []

                //create an array of extensions used by path
                let hashPath = {};

                for (var url in IG.ig.usage) {
                    let arPath = IG.ig.usage[url];
                    arPath.forEach(function (path) {
                        hashPath[path] = hashPath[path] || []
                        hashPath[path].push({url:url});

                    });
                }

                for (var path in hashPath) {
                    let arUrl = hashPath[path];
                    $scope.usedExtensionsByPath.push({path:path,url:arUrl})
                }
                $scope.usedExtensionsByPath.sort(function(a,b){
                    if (a.path > b.path) {
                        return 1

                    } else {
                        return -1
                    }
                })




            };

            $scope.showIGDetails = function(key){

                $scope.selectedIGDetailsKey = key;


            }


            $scope.sortEDView = function(key) {
                switch (key) {
                    case 'url' :
                        $scope.arExtensions.sort(function (a,b) {
                            if (a.url < b.url) {
                                return -1
                            } else {
                                return 1
                            }
                        });
                        break;

                    case 'name' :
                        $scope.arExtensions.sort(function (a,b) {
                            let aName = a.url.split('/')
                            let bName = b.url.split('/')
                            if (aName[aName.length-1].toLowerCase() < bName[bName.length-1].toLowerCase()) {
                                return -1
                            } else {
                                return 1
                            }
                        });
                        break;

                    case 'freq' :

                        $scope.arExtensions.sort(function (a,b) {
                            if (a.usage.length > b.usage.length) {
                                return -1
                            } else {
                                return 1
                            }
                        });




                        break;
                }
            }

            $scope.selectED = function(ext) {

                console.log(ext)

                $scope.selectedEDUrl = ext.url;

                $scope.selectedED = ext.usage;
                //console.log(k,v)
            };

            $scope.sortTypeView = function(key) {

                switch (key) {
                    case 'freq' :

                        $scope.arTypes.sort(function(a,b){
                            if (a.uniqueCnt < b.uniqueCnt) {
                                return 1
                            } else {
                                return -1
                            }
                        });
                        break;
                    case 'name' :
                        $scope.arTypes.sort(function(a,b){
                            if (a.type > b.type) {
                                return 1
                            } else {
                                return -1
                            }
                        });
                        break;
                }

            }

            $scope.selectType = function(type) {
                $scope.selectedType = type;


                $scope.selectedType.items.sort(function(a,b){
                    try {
                        let keyA = a.path + a.url + a.ig;
                        let keyB = b.path + b.url + b.ig;
                        if (keyA > keyB) {
                            return -1
                        } else {
                            return 1
                        }
                    } catch (ex) {
                        return 0;
                    }

                })

            };

            function registerAccess(){
                //register access for the logs...
                $http.post('/stats/login',{module:'igAnalysis'}).then(
                    function(data){

                    },
                    function(err){
                        console.log('error accessing clinfhir to register access',err)
                    }
                );

            }

        })
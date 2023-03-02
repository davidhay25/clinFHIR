angular.module("sampleApp")
    .controller('r5qaCtrl',
        function ($scope,$http,$sce,$localStorage,$timeout) {

            $scope.input = {};

            $scope.hashByWG = {}

            $scope.setVisibility = function() {
                //go through all the resources & pages for all WG setting visibility
                if (! $scope.hashByWG) {return}    //as can be called b4 file has loaded
                Object.keys($scope.hashByWG).forEach(function (key) {
                    $scope.hashByWG[key].resources.forEach(function (item) {

                        item.hide = false

                        if ($scope.input.claimedonly && ! item.claimedby ) {
                            item.hide = true
                        }

                        if ($scope.input.unclaimedonly && item.claimedby ) {
                            item.hide = true
                        }

                        if ($scope.input.fmm5only && item.fmm !== 5 ) {
                            item.hide = true
                        }
                    })
                })

                Object.keys($scope.hashByWG).forEach(function (key) {
                    $scope.hashByWG[key].pages.forEach(function (item) {

                        item.hide = false

                        if ($scope.input.claimedonly && ! item.claimedby ) {
                            item.hide = true
                        }

                        if ($scope.input.unclaimedonly && item.claimedby ) {
                            item.hide = true
                        }

                    })
                })

            }

            $scope.makeIndexList = function() {
                //construct array of WG
                //let hashAllPages = data.data


                $scope.hashByWG = {}
                Object.keys($scope.pages).forEach(function (key) {
                    let item = $scope.pages[key]

                    item.id = key
                    let wg = item.wg.trim()
                    let type = item.type

                    $scope.hashByWG[wg] = $scope.hashByWG[wg] || {resources:[],pages:[]}
                    switch (type) {
                        case 'resource' :
                            //create the display name & fmm
                            let name = item.name
                            let ar = name.split('-')    //wg-fmm-display
                            item.fmm = ar[1]
                            item.wg = ar[0]
                            item.display = ar[2]




                            $scope.hashByWG[wg].resources.push(item)
                            break
                        case 'page' :
                            let name1 = item.name
                            let ar1 = name1.split('-')    //wg-display
                            ar1.splice(0,1)

                            item.display = ar1.join('-')    //may have hyphens in name

                            $scope.hashByWG[wg].pages.push(item)
                            break
                    }

                })

                console.log($scope.hashByWG)



            }




            $http.get("/qa/pages").then(
                function (data) {
                    //console.log(data.data)
                    $scope.pages = data.data
                    $scope.makeIndexList()

                }
            )

            $scope.selectWg = function (hashWg) {
                console.log(hashWg)
                $scope.selectedHashWg = hashWg
            }

            $scope.claimPage = function(){
                let vo = {id:$scope.selectedId,name:$scope.input.userName}
                $http.post("/qa/claim/",vo).then(
                    function(data) {
                        $scope.selectedPage.claimedby = $scope.input.userName
console.log(data)
                    },
                    function (err) {

                    }
                )
            }

            //the id of the page
            $scope.selectPage = function(id) {
                console.log(id)

                $scope.selectedId = id
                //$scope.iFrameSource = "about:blank"
                $scope.iFrameSource = $sce.trustAsResourceUrl("about:blank");
                $scope.selectedPage = $scope.pages[id]
                let url = `https://docs.google.com/document/d/${id}`

                console.log(url)
                $scope.iFrameSource = $sce.trustAsResourceUrl(url);
            }

        })
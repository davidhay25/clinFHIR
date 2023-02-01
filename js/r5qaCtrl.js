angular.module("sampleApp")
    .controller('r5qaCtrl',
        function ($scope,$http,$sce,$localStorage,$timeout) {

            $scope.input = {};

            $scope.hashByWG = {}
            $http.get("/qa/pages").then(
                function (data) {
                    //console.log(data.data)

                    //construct array of WG
                    let hashAllPages = data.data
                    Object.keys(hashAllPages).forEach(function (key) {
                        let item = hashAllPages[key]
                        item.id = key
                        let wg = item.wg.trim()
                        let type = item.type
                        $scope.hashByWG[wg] = $scope.hashByWG[wg] || {resources:[],pages:[]}
                        switch (type) {
                            case 'resource' :
                                $scope.hashByWG[wg].resources.push(item)
                                break
                            case 'page' :
                                $scope.hashByWG[wg].pages.push(item)
                                break
                        }

                    })

                    console.log($scope.hashByWG)

                    $scope.pages = data.data

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
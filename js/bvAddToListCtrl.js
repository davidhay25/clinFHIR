/* Used to add a list or an item to an existing list*/
angular.module("sampleApp")
    .controller('bvAddToListCtrl',
        function ($scope,$http,$timeout,source,user) {

            $scope.input = {}
            $scope.input.description = source.description

            $scope.input.state= "select"      //select or add

            $scope.source = source      //fromLibrary

            $http.get('bv/lists').then(
                function (data) {
                    $scope.lists = data.data
                },function () {
                    alert("Error retrieving lists")
                }
            )

            $scope.addToList = function () {
                let item = source
                item.dateAdded = new Date()
                item.addedBy = user.email
                $scope.bvAddselectedList.entries.push(item)
                $http.put('bv/list',$scope.bvAddselectedList).then(
                    function () {
                        alert("Item has been added to the list.")
                        $scope.$close()
                    }, function (err) {
                        alert(angular.toJson(err))
                    }
                )
            }

            $scope.createList = function (name,description) {
                let list = {name:name,description:description, entries:[]}
                if (user?.email) {
                    list.createdBy = user.email
                }
                let item = source
                item.dateAdded = new Date()
                list.entries.push(item)
                $http.post('bv/list',list).then(
                    function () {
                        alert("List has been created with this item.")
                        $scope.$close()
                    }, function (err) {
                        alert(angular.toJson(err))
                    }
                )
            }

            $scope.selectList = function (list) {
                delete $scope.issue
                $scope.bvAddselectedList = list

                switch (source.type) {
                    case 'bundle' :
                        let ar = list.entries.filter(item => item.bundleId == source.bundleId)
                        if (ar.length > 0) {
                            $scope.issue = "This Bundle is already in the list"
                        }
                        break
                    case 'query' :
                        let ar1 = list.entries.filter(item => item.query == source.query)
                        if (ar1.length > 0) {
                            $scope.issue = "This Query is already in the list"
                        }
                        break

                }

            }




        })
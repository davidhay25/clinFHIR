/* used to display available lists in the selector*/
angular.module("sampleApp")
    .controller('bvListsCtrl',
        function ($scope,$http,$timeout,$localStorage,$uibModal) {




            //list {type (link/bundle), url (linkurl or bundle ref) , display }
            $scope.listInput = {}

            function getLists(cb){
                $http.get('bv/lists').then(
                    function (data) {
                        $scope.lists = data.data
                        if (cb) {
                            cb()
                        }
                    },function () {
                        alert("Error retrieving lists")
                    }
                )
            }
            getLists()

            //fired when a list is updated
            $scope.$on('listChanged',function (event) {

                getLists(function () {
                    if ($scope.selectedList && $scope.lists?.length > 0) {

                        let ar = $scope.lists.filter(
                            item => item.id == $scope.selectedList.id
                        )

                        if (ar.length == 1) {
                           // console.log($scope.selectedList)
                            $scope.selectedList = ar[0]
                        } else {
                            console.log('list not found')
                        }
                    }
                })


            })



            $scope.selectList = function (list) {
                delete $scope.issue
                $scope.selectedList = list
            }

            $scope.loadBundle = function (bundleId,name,description) {
                $scope.getBundleFromLibrary({id:bundleId,name:name,description:description})
            }


            $scope.addNewList = function () {
                $uibModal.open({
                    templateUrl: 'modalTemplates/bvEditList.html',
                    backdrop: 'static',
                    size : 'lg',
                    controller: function($scope,list,user) {
                        $scope.user = user
                        $scope.list = angular.copy(list)    //make a copy so cancel works
                        $scope.input = {isDirty : true}

                        $scope.save = function() {
                            $scope.$close($scope.list)
                        }

                    },

                    resolve: {
                        list: function () {
                            let lst = {entries:[],userOnlyEdit : false}
                            if ($scope.user?.email) {
                                lst.createBy = $scope.user.email
                            }
                            return lst
                        },
                        user : function () {
                            return $scope.user
                        }
                    }

                }).result.then(function (list) {

                    $http.put('bv/list',list).then(
                        function () {
                            $scope.lists.push(list)
                            $scope.selectedList = list
                            alert("List has been created.")
                        })
                })
            }



            //edits the currently selected list
            $scope.editList = function () {
                $uibModal.open({
                    templateUrl: 'modalTemplates/bvEditList.html',
                    backdrop: 'static',
                    size : 'lg',
                    controller: function($scope,list,user) {
                        $scope.user = user
                        $scope.list = angular.copy(list)    //make a copy so cancel works
                        $scope.input = {isDirty : true}

                        $scope.canEdit = function () {
                            return true
                        }

                        $scope.removeItem = function (inx) {
                            $scope.input.isDirty = true
                            $scope.list.entries.splice(inx,1)
                        }

                        $scope.save = function() {
                            $scope.$close($scope.list)
                        }

                    },

                    resolve: {
                        list: function () {
                            return $scope.selectedList
                        },
                        user : function () {
                            return $scope.user
                        }
                    }

                }).result.then(function (list) {
                    //console.log('updating list',list)
                    $http.put('bv/list',list).then(
                        function () {
                            alert("List has been updated.")
                            getLists(function(){

                                let ar = $scope.lists.filter(
                                    item => item.id == $scope.selectedList.id
                                )

                                if (ar.length == 1) {
                                   // console.log($scope.selectedList)
                                    $scope.selectedList = ar[0]
                                } else {
                                    console.log('list not found')
                                }

                            })
                        }, function (err) {
                            alert(angular.toJson(err))
                        }
                    )

                })
            }

        })
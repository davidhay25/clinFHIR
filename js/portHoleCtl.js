
angular.module("sampleApp")
    .controller('portHoleCtrl',
        function ($scope,$q,$http,profileDiffSvc,$uibModal,logicalModelSvc) {



            $scope.processView = function(view) {
                console.log(view)
                $scope.currentView = view;
            }

            $scope.views = [];
            $scope.views.push({display:'Careplan',mode:'cp'});
            $scope.views.push({display:'Task',mode:'task'});
            $scope.views.push({display:'Medications',mode:'medlist'});
            $scope.views.push({display:'Problem List',mode:'problist'});

    })

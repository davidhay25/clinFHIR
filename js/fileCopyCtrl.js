/*has been deprectde - don't call make function - expensive! */

angular.module("sampleApp")
    .controller('fileCopyCtrl',
        function ($rootScope,$scope,$uibModal,modalService,fileList) {
            $scope.fileList = fileList;

        });
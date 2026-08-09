angular.module("sampleApp")
    .controller('extensionExplorerCtrl',
        function ($scope) {

            $scope.$on('processBundle',function (evt) {
                delete $scope.selectedExtExtension
                delete $scope.input.selectedExtUrl
                delete $scope.selectedExtResource
                delete $scope.bundleHasModifier
                delete $scope.bundleHasExtensions
            })


            //select the resource to list the extensions on
            $scope.selectExtResource = function(v) {
                delete $scope.selectedExtExtension
                $scope.selectedExtResource = v

            }

            //select a specific extension
            $scope.selectExtension = function (ext) {
                $scope.selectedExtExtension = ext
            }

            $scope.selectExtUrl = function (url) {
                if (url) {
                    $scope.input.selectedExtUrl = url
                }
            }

            $scope.canShow = function (item) {

                if ($scope.input.selectedExtUrl == 'All') {return true}

                for (const ext of item.extensions) {
                    if (ext.url == $scope.input.selectedExtUrl) {
                        return true
                        break
                    }
                }
            }



        })

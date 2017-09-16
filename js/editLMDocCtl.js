
angular.module("sampleApp")
    .controller('editLMDocCtrl',
        function ($scope,doc) {
            $scope.doc = doc;
            $scope.compositon = doc.entry[0].resource;

        })

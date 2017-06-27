angular.module('sampleApp')
    .directive('profileTable', function () {
        return {
            restrict: 'EA', //E = element, A = attribute, C = class, M = comment
            scope: {
                //@ reads the attribute value, = provides two-way binding, & works with functions
                items: '=',
                selectItem : '&',
                showEDE : '&',
                selectExtensionFromProfileE : '&',
                showValueSetE : '&'
            },

            templateUrl: 'directive/profiletable/profileTable.html',
            controller: function($scope){
                $scope.selectItemI = function(profile,type) {
                    $scope.selectItem()(profile,type)
                    console.log(profile,type)
                };


                $scope.showED = function(ed){
                    $scope.showEDE()(ed);
                };


                $scope.selectExtensionFromProfile = function (extension) {
                    console.log(extension)
                    $scope.selectExtensionFromProfileE()(extension)
                };

                $scope.showValueSet = function (vs,type) {
                    $scope.showValueSetE()(vs,type)
                }
            }
        }
    });
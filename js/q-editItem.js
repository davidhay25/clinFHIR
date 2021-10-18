//edit an item
angular.module("sampleApp")
    .controller('q-editItemCtrl',
        function ($scope,item,qtypes,multiplicities,QVS) {
            $scope.input = {}
            $scope.qtypes = qtypes
            $scope.arVsName = []
            $scope.QVS = QVS

            $scope.QVS.forEach(function (vs) {
                $scope.arVsName.push(vs.name)
            })

            $scope.multiplicities = multiplicities
            $scope.currentItem = angular.copy(item)  //always editing

            //set the type...
            $scope.qtypes.forEach(function (typ,inx) {
                if ($scope.currentItem.data.type == typ) {
                    $scope.input.type = $scope.qtypes[inx]
                }
            })

            //set the multiplicity
            $scope.multiplicities.forEach(function (m,inx) {
                if ($scope.currentItem.data.mult == m) {
                    $scope.input.mult = $scope.multiplicities[inx]
                }
            })

            //set the valueSet
            $scope.arVsName.forEach(function (name,inx) {

                if ($scope.currentItem.data.vsName == name) {
                    $scope.input.vsName = $scope.arVsName[inx]

                }
            })


            $scope.close = function(){
                $scope.currentItem.data.mult = $scope.input.mult
                $scope.currentItem.data.type = $scope.input.type
                $scope.currentItem.data.vsName = $scope.input.vsName
                $scope.$close( $scope.currentItem)
            }

    })

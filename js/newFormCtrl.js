/*has been deprectde - don't call make function - expensive! */

angular.module("sampleApp")
    .controller('newFormCtrl',function ($scope,$uibModal,modalService) {

        var showEdit = ['CodeableConcept','string','date','dateTime','Identifier']

        if (!String.prototype.startsWith) {
            String.prototype.startsWith = function(search, pos) {
                return this.substr(!pos || pos < 0 ? 0 : +pos, search.length) === search;
            };
        }

        $scope.$watch(function(scope){
            return scope.treeData
        },function(){
            $scope.formModel = $scope.treeData;
            console.log('ping2!')

        });


        $scope.addRow = function (id) {
            var pathSuffix =  $scope.formModel.length;
            console.log(id) ;

            var copyRow,copyRowPos;
            $scope.formModel.forEach(function(row,inx) {
                if (row.id == id) {
                    copyRow = angular.copy(row)
                    copyRowPos = inx;
                }
            })
            if (copyRow) {
                copyRow.id += pathSuffix + '.' + copyRow.id;
                $scope.formModel.splice(copyRowPos,0,copyRow);

                //now insert any child nodes
                var arInsertRows = []
                var parentPath = copyRow.data.path;
                $scope.formModel.forEach(function(row,inx) {
                    var path = row.data.path;
                    if (path.startsWith(parentPath) && path !== parentPath) {
                        console.log(path)

                        arInsertRows.push(angular.copy(row))
                    }

                });
                if (arInsertRows.length > 0) {

                    arInsertRows.forEach(function(row){
                        copyRowPos++;
                        row.id = pathSuffix + '.' + row.id;
                        $scope.formModel.splice(copyRowPos,0,row)

                    })


                }

            }

        };

        $scope.showEdit = function(dt) {
                if (showEdit.indexOf(dt) > -1) {
                    return true;
                } else {
                    return false;
                }
            }

        });
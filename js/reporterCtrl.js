/*has been deprectde - don't call make function - expensive! */

angular.module("sampleApp")
    .controller('reporterCtrl',
        function ($scope,$http) {

            $scope.input = {}

        var url = '/errorReport';
        $http.get(url).then(
            function(data) {
                
                $scope.errors = data.data;

                //get the list of unique emails
                $scope.uniqueEmails={};
                $scope.uniqueEmails['all'] = {display:'all',count:0,email:'all'}
                $scope.input.email = $scope.uniqueEmails['all']
                $scope.errors.forEach(function(err){
                    var email = 'all';
                    if (err.user && err.user.email) {
                        email = err.user.email;
                    }
                        if ($scope.uniqueEmails[email]) {
                            $scope.uniqueEmails[email].count ++;
                            $scope.uniqueEmails[email].display = email + " " + $scope.uniqueEmails[email].count
                        } else {
                            $scope.uniqueEmails[email] = {display:email + " 1",count:1,email:email}
                        }



                })



            }
        );

        //filter based on email
        $scope.emailSelected = function() {
            console.log($scope.input.email)
            //$scope.emailFilter = 
        }

        $scope.errorSelected = function(err) {
            $scope.selectedError = err;
            $scope.selectedErrorMeta = angular.copy(err);
            delete $scope.selectedErrorMeta.resource;
            delete $scope.selectedErrorMeta.oo;
        }

    });
/*has been deprectde - don't call make function - expensive! */

angular.module("sampleApp")
    .controller('loginSmileCtrl',
        function ($rootScope,$scope, appConfigSvc, $http,modalService) {

            $scope.input = {password:"",username:""};

            //strategy is to see if the user can write to the server...
            $scope.userLogin = function() {

                var username = $scope.input.username;
                var password = $scope.input.password;

                var b64 = btoa(username + ":" + password);
                var config = {headers:{}}
                config.headers.authorization = 'Basic '+ b64

                var url = appConfigSvc.getCurrentConformanceServer().url + "ImplementationGuide/testIG";  //just a random query...
                var IG = {resourceType:'ImplementationGuide',id:'testIG',url:'http://clinfhir.com/ImplementationGuide/testIG',status:'draft'};
                $scope.waiting = true
                $http.put(url,IG,config).then(
                    function (data) {
                        //a valid login. Create the user object
                        var user = {name:username,authHeader:'Basic '+ b64};

                        var msg = "Excellent! This user is able to update Implementation Guides...";
                        modalService.showModal({},{bodyText:msg});

                        $scope.$close(user);

                    },
                    function (err) {
                        var msg = "Sorry, this is not a valid user - or one that cannot write Implementation Guides to the database. Try again.";
                        modalService.showModal({},{bodyText:msg})
                    }
                ).finally(
                    function(){
                        $scope.waiting = false
                    }
                )
            };
        });
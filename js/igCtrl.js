/*has been deprectde - don't call make function - expensive! */

angular.module("sampleApp")
    .controller('igCtrl',
        function ($scope,$rootScope,$uibModal,$http,modalService,$timeout,$firebaseObject) {

            //-----------  login stuff....

            //called whenever the auth state changes - eg login/out, initial load, create user etc.
            firebase.auth().onAuthStateChanged(function(user) {
                if (user) {
                    $rootScope.userProfile = $firebaseObject(firebase.database().ref().child("users").child(user.uid));
                    logicalModelSvc.setCurrentUser(user);
                    console.log(user);
                } else {
                    console.log('no user')
                    logicalModelSvc.setCurrentUser(null);
                    // No user is signed in.
                }
            });

            //pages to edit various resource types
            $scope.editorPage = {}
            $scope.editorPage.valueSet = "valuesetCreator.html";
            $scope.editorPage.logicalModel = "logicalModeller.html";

            $scope.login=function(){
                $uibModal.open({
                    backdrop: 'static',      //means can't close by clicking on the backdrop.
                    keyboard: false,       //same as above.
                    templateUrl: 'modalTemplates/login.html',
                    controller: 'loginCtrl'
                })
            };


            $scope.logout=function(){
                firebase.auth().signOut().then(function() {
                    delete $rootScope.userProfile;
                    modalService.showModal({}, {bodyText: 'You have been logged out of clinFHIR'})

                }, function(error) {
                    modalService.showModal({}, {bodyText: 'Sorry, there was an error lgging out - please try again'})
                });

            };



            $scope.firebase = firebase;

            //------------------------------------------

            $scope.setIframe = function(pkg,inx){
                var url= $scope.editorPage[pkg.name];
                $scope.selectedPackage = pkg;
                $scope.selectedResource = pkg.resource[inx];
                var res = pkg.resource[inx];
                url += '?vs='+res.sourceUri + '&ig='+$scope.ig.url;


                $scope.iFrameSource=url
            }


            $scope.addResource = function(pkg){
                var url= $scope.editorPage[pkg.name];
              
                url +=  '?ig='+$scope.ig.url;
                $scope.iFrameSource=url

            };

            $scope.selectGuide=function(entry){
                console.log(entry)
                $scope.ig = entry.resource;
            }

            //load all the logical models created by clinFHIR
            loadAllModels = function() {
                var url="http://fhir3.healthintersections.com.au/open/ImplementationGuide?publisher=clinfhir";
                $http.get(url).then(
                    function(data) {
                        $scope.bundleModels = data.data
                    },
                    function(err){

                    }
                )
            };
            loadAllModels();
    });
/*has been deprectde - don't call make function - expensive! */

angular.module("sampleApp")
    .controller('loginCtrl',
        function ($rootScope,$scope,$firebaseAuth,$uibModal,modalService) {

        //https://firebase.google.com/docs/auth/web/manage-users

            $scope.input = {password:"",email:""};

            //var auth = $firebaseAuth();

            $scope.resetPW=function(){

                var email = $scope.input.email;
                firebase.auth().sendPasswordResetEmail(email).then(function() {
                    modalService.showModal({}, {bodyText: 'A reset password email has been sent to '+email})

                }).catch(function(error) {
                    console.error("Error: ", error);
                });
            };

            $scope.userLogin = function() {
                var email = $scope.input.email;
                var password = $scope.input.password;
                firebase.auth().signInWithEmailAndPassword(email, password).then(function(){
                    $scope.$close();

                }).catch(function(error) {
                    // Handle Errors here.
                    var errorCode = error.code;
                    var errorMessage = error.message;
                    console.log(errorCode,errorMessage)
                    alert(angular.toJson(errorMessage))

                    switch (errorCode) {
                        case 'auth/wrong-password':
                            modalService.showModal({}, {bodyText:'Invalid password, please try again'});
                            $scope.input.password = "";
                            break;
                        case 'auth/user-not-found':

                            var modalOptions = {
                                closeButtonText: "No, don't add account",
                                actionButtonText: 'Yes, create account with this password',
                                headerText: 'Create new valueSet',
                                bodyText: 'This email is not registered. Do you want to register?'
                            };

                            modalService.showModal({}, modalOptions).then(
                                function (result) {
                                    firebase.auth().createUserWithEmailAndPassword(email, password).then(
                                        function(){
                                            $scope.$close();
                                        }
                                    ).catch(function(error) {
                                        // Handle Errors here.
                                        var errorCode = error.code;
                                        var errorMessage = error.message;
                                        alert(angular.toJson(errorMessage))
                                        // ...
                                    });
                                });


                            break;
                        default:
                    }

                });
            };

            firebase.auth().onAuthStateChanged(function(user) {
                if (user) {

                    //$rootScope.currentUser = firebase.auth().currentUser;
                    console.log(firebase.auth().currentUser)

                } else {
                    console.log('not logged in')
                }
            });

           


        });
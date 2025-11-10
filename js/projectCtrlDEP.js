/*has been deprectde - don't call make function - expensive! */

angular.module("sampleApp")
    .controller('projectCtrl',
        function ($scope,$firebaseArray,appConfigSvc,modalService) {

            //NOTE: assume the the rootScope.fbProjects has been bound in resourceCreator...

          //  var ref = firebase.database().ref().child("projects");
            //console.log(ref)
            // create a synchronized array
          //  $scope.fbProjects = $firebaseArray(ref);

            $scope.projectMode = 'view';
            $scope.input={};
            
            $scope.showProject = function(inx){

                $scope.projectMode = 'view';
                $scope.currentProject = $scope.fbProjects[inx];
                $scope.input.name =  $scope.currentProject.name;
                $scope.input.description =  $scope.currentProject.description;
                $scope.input.password =  $scope.currentProject.password;

                
            };

            $scope.removeProject = function(inx) {
                $scope.fbProjects.$remove($scope.currentProject).then(function(ref){
                    console.log('removed from server')
                    delete $scope.currentProject;
                })
            };

            $scope.updateProject = function(inx) {
                $scope.currentProject.name = $scope.input.name;
                $scope.currentProject.updated = moment().format();
                $scope.currentProject.description = $scope.input.description;

                //password is optional...
                delete $scope.currentProject.password;
                if ($scope.input.password) {
                    $scope.currentProject.password = $scope.input.password;
                }

                $scope.fbProjects.$save($scope.currentProject).then(
                    function(ref){
                        modalService.showModal({}, {bodyText: 'Project has been updated'})
                    },
                    function(err){
                        modalService.showModal({}, {bodyText: 'There was an error: '+err})
                    }
                )};


            $scope.newProject = function(){
                delete $scope.input.name;
                delete $scope.input.description;
                delete $scope.input.password;
                $scope.input.servers = {};
                $scope.projectMode='new';
                $scope.input.servers.data = appConfigSvc.getCurrentDataServer();
                $scope.input.servers.conformance = appConfigSvc.getCurrentConformanceServer();
               // $scope.input.servers.terminology
                
            };
            
            $scope.addProject = function(){
                var project = {name:$scope.input.name,description:$scope.input.description,profiles:[]};
                project.created = moment().format();
                project.servers = {};

                project.servers.data = $scope.input.servers.data ;
                project.servers.conformance = $scope.input.servers.conformance;

                $scope.fbProjects.$add(project).then(function(ref){
                    console.log('added to server')
                },function(err){
                    alert('There was an error:'  + err)
                })
            }


        });
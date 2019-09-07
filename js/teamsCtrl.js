angular.module("sampleApp")
    .controller('teamsCtrl',
        function ($scope,$firebaseAuth,$uibModal,modalService,teamsSvc,$localStorage) {


            $scope.teams = $localStorage.teams;
            if (! $scope.teams) {
                teamsSvc.getTeams().then(
                    function(data) {

                        $scope.teams = data.data;

                    }
                );
            }

            $scope.reset = function(){
                teamsSvc.getTeams().then(
                    function(data) {

                        $scope.teams = data.data;
                        $localStorage.teams = data.data;
                    }
                );
            }

            $scope.selectTeam = function (team) {
                $scope.team = team;
                console.log(team)
            }

            $scope.editTeam = function () {
                $uibModal.open({
                    backdrop: 'static',      //means can't close by clicking on the backdrop.
                    keyboard: false,       //same as above.
                    templateUrl: 'modalTemplates/editTeam.html',
                    controller: function($scope) {
                        $scope.input = {};
                        $scope.add = function() {
                            let team = {}
                            team.name = $scope.input.name;
                            team.purpose = $scope.input.purpose;
                            team.service = {display: $scope.input.service}
                            team.contact = [
                                {type:$scope.input.contactType,value:$scope.input.contactValue}
                            ]
                            $scope.$close(team)
                        }
                    }
                }).result.then(
                    function(team) {
                        $scope.teams.push(team)
                        $scope.team = team;
                        $localStorage.teams = $scope.teams
                    })
            };

            $scope.removeTeam = function(inx) {

                let team = $scope.teams[inx]
                if (confirm("Are you sure you wish to remove "+team.name+ "?")) {
                    $scope.teams.splice(inx,1)
                    $localStorage.teams = $scope.teams;
                    delete $scope.team;
                }
            };


            $scope.editLocation = function () {
                $uibModal.open({
                    backdrop: 'static',      //means can't close by clicking on the backdrop.
                    keyboard: false,       //same as above.
                    templateUrl: 'modalTemplates/editTeamLocation.html',
                    controller: function($scope) {
                        $scope.input = {};
                        $scope.add = function() {
                            let location = {}
                            location.display = $scope.input.name;
                            location.hours = $scope.input.hours;
                            location.role = {display: $scope.input.role}
                            location.contact = [
                                {type:$scope.input.contactType,value:$scope.input.contactValue}
                            ]
                            $scope.$close(location)
                        }
                    }
                }).result.then(
                    function(location) {
                        $scope.team.location = $scope.team.location || []
                        $scope.team.location.push(location)
                        $localStorage.teams = $scope.teams
                    })
            };

            $scope.removeLocation = function(inx) {
                let location = $scope.team.location[inx]
                if (confirm("Are you sure you wish to remove "+location.display+ "?")) {
                    $scope.team.location.splice(inx,1)
                    $localStorage.teams = $scope.teams;
                }
            };


            $scope.editMember = function (member) {
                $uibModal.open({
                    backdrop: 'static',      //means can't close by clicking on the backdrop.
                    keyboard: false,       //same as above.
                    templateUrl: 'modalTemplates/editTeamMember.html',
                    controller: function($scope) {
                        $scope.input = {};
                        $scope.add = function() {
                            let member = {}
                            member.name = $scope.input.name;
                            member.CPN = $scope.input.CPN;
                            member.role = {display: $scope.input.role}
                            member.contact = [
                                {type:$scope.input.contactType,value:$scope.input.contactValue}
                            ]
                            member.qualification = [{display:$scope.input.qualification}]
                            $scope.$close(member)
                        }

                     }
                }).result.then(
                    function(member) {
                        $scope.team.member = $scope.team.member || []
                        $scope.team.member.push(member)
                        $localStorage.teams = $scope.teams
                    })

            }

            $scope.removeMember = function(inx) {
                let member = $scope.team.member[inx]
                if (confirm("Are you sure you wish to remove "+member.name+ "?")) {
                    $scope.team.member.splice(inx,1)
                    $localStorage.teams = $scope.teams;
                }
            };
        }
    );
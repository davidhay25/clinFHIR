angular.module("sampleApp")
    .controller('teamsCtrl',
        function ($scope,$firebaseAuth,$uibModal,modalService,teamsSvc) {

            teamsSvc.getTeams().then(
                function(teams) {
                    $scope.teams = teams;
                    console.log(teams)
                }
            );

            $scope.selectTeam = function (team) {
                $scope.team = team;
                console.log(team)
            }


        }
    );
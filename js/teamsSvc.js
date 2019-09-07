angular.module("sampleApp")

    .service('teamsSvc', function($q,$http) {


        return {
            getTeams: function (vo) {

                return $http.get("artifacts/teams.json")


            }
        }


    }
);
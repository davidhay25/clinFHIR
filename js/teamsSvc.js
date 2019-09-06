angular.module("sampleApp")

    .service('teamsSvc', function($q) {


        return {
            getTeams: function (vo) {
                let deferred = $q.defer();

                let teams = `
                    [
                        {"name":"Mental Health"},
                        {"name":"Stroke Rehab"}
                    
                    ]

                `;


                deferred.resolve(angular.fromJson(teams));

                return deferred.promise;


            }
        }


    }
);
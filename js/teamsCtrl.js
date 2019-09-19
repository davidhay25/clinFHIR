angular.module("sampleApp")
    .controller('teamsCtrl',
        function ($scope,$firebaseAuth,$uibModal,modalService,teamsSvc,$localStorage,$http) {

        $scope.input = {}
            $scope.teams = $localStorage.teams;
            $scope.organizations = $localStorage.organizations;
            if ($scope.organizations){
                $scope.input.organization = $scope.organizations[0]
            }

            $http.post('/stats/login',{module:"teams",servers:{}}).then(
                function(data){
                    //console.log(data);
                },
                function(err){
                    console.log('error accessing clinfhir to register access',err)
                }
            );


            if (! $scope.teams) {
                teamsSvc.getTeams().then(
                    function(data) {

                        $scope.teams = data.data.teams;
                        $scope.organizations = data.data.orgs;
                        $scope.input.organization = $scope.organizations[0]
                        $localStorage.orgs = data.data.organizations;
                    }
                );
            }

            $scope.reset = function(){
                if (confirm("This will reset the teams back to the default set")) {
                    teamsSvc.getTeams().then(
                        function(data) {

                            $scope.teams = data.data.teams;
                            $scope.organizations = data.data.orgs;
                            $localStorage.teams = data.data.teams;
                            $localStorage.organizations = data.data.orgs;
                            $scope.input.organization = $scope.organizations[0]
                            delete $scope.team;

                        }
                    );
                }

            }

            $scope.selectOrganization = function(){
                //$scope.input.organization set by dropdown
                delete $scope.team;
            }

            $scope.selectTeam = function (team) {
                $scope.team = team;
                console.log(team)
            };

            $scope.editTeam = function (originalTeam) {


                $uibModal.open({
                    backdrop: 'static',      //means can't close by clicking on the backdrop.
                    keyboard: false,       //same as above.
                    templateUrl: 'modalTemplates/editTeam.html',
                    controller: function($scope,team) {
                        $scope.team = team || {}
                        let teamb4edit = angular.copy(team);

                        $scope.input = {};

                        $scope.addContact = function(){
                            $scope.team.contact = $scope.team.contact || [];
                            $scope.team.contact.push({type:$scope.input.contactType,value:$scope.input.contactValue});
                            delete $scope.input.contactType;
                            delete $scope.input.contactValue;
                        };


                        $scope.deleteContact = function(inx) {
                            $scope.team.contact.splice(inx,1)
                        };

                        $scope.addService = function() {
                            if ($scope.input.service) {
                                $scope.team.service = $scope.team.service || [];
                                $scope.team.service.push({display:$scope.input.service});
                                delete $scope.input.service;
                            }

                        };

                        $scope.deleteService = function(inx) {
                            $scope.team.service.splice(inx,1)
                        };

                        $scope.add = function() {
                            if ($scope.input.service) {
                                $scope.team.service = $scope.team.service || [];
                                $scope.team.service.push({display:$scope.input.service});
                                /*
                                let msg = "Looks like you're adding a service but haven't clicked the '+' icon. The service will not be added. Are you sure you want to continue?";
                                if (! confirm(msg)) {
                                    return;
                                };
*/
                            }

                            if ($scope.input.contactType || $scope.input.contactValue) {
                                $scope.team.contact = $scope.team.contact || [];
                                $scope.team.contact.push({type:$scope.input.contactType,value:$scope.input.contactValue});
                                /*
                                let msg = "Looks like you're adding a contact but haven't clicked the '+' icon. The contact will not be added. Are you sure you want to continue?";
                                if (! confirm(msg)) {
                                    return;
                                };
                                */
                            }

                            $scope.$close($scope.team)
                        };

                        $scope.cancel = function() {
                            $scope.$close(teamb4edit)
                        };

                        let checkDirty = function(){
                            let msg = "";
                            if ($scope.input.service) {
                                msg = "Looks like you're adding a service";
                                return;
                            }
                        }

                    },
                    resolve : {
                        team : function(){
                            return originalTeam;
                        }
                    }
                }).result.then(
                    function(team) {

                        if (originalTeam) {
                            //editing
                            for (var i=0; i < $scope.teams.length; i++) {
                                let t = $scope.teams[i];
                                if (t.id == originalTeam.id) {
                                    $scope.teams[i] = team;
                                    break;
                                }
                            }
                        } else {
                            //new
                            team.id = 'id' + new Date().getTime();
                            team.managingOrganization = $scope.input.organization;
                            $scope.teams.push(team)
                          //  $scope.team = team;
                        }

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

            $scope.editMember = function (inx) {
                let originalMember;
                if (inx !== undefined) {
                    originalMember = $scope.team.member[inx];
                }

                $uibModal.open({
                    backdrop: 'static',      //means can't close by clicking on the backdrop.
                    keyboard: false,       //same as above.
                    templateUrl: 'modalTemplates/editTeamMember.html',
                    controller: function($scope,member) {
                        $scope.input = {};
                        $scope.member = member || {}
                        let memberb4edit = angular.copy(member);
                        $scope.addQualification = function(){
                            $scope.member.qualification = $scope.member.qualification || [];
                            $scope.member.qualification.push({display:$scope.input.qualification})
                            delete $scope.input.qualification;
                        };

                        $scope.addContact = function(){
                            $scope.member.contact = $scope.member.contact || []
                            $scope.member.contact.push({type:$scope.input.contactType,value:$scope.input.contactValue});
                            delete $scope.input.contactType;
                            delete $scope.input.contactValue;
                        };

                        $scope.deleteContact = function(inx) {
                            $scope.member.contact.splice(inx,1)
                        }

                        $scope.deleteQualification = function(inx) {
                            $scope.member.qualification.splice(inx,1)
                        }
                        $scope.cancel = function() {
                            $scope.$close(memberb4edit)
                        };

                        $scope.add = function() {
                            if ($scope.input.qualification) {
                                $scope.member.qualification = $scope.member.qualification || [];
                                $scope.member.qualification.push({display:$scope.input.qualification})
                            }

                            if ($scope.input.contactType) {
                                $scope.member.contact = $scope.member.contact || []
                                $scope.member.contact.push({type:$scope.input.contactType,value:$scope.input.contactValue});
                            }

                            $scope.$close($scope.member)
                        }

                     },
                resolve : {
                    member : function(){
                        return originalMember;
                    }
                }
                }).result.then(
                    function(newMember) {

                        if (originalMember) {
                            //editing
                            $scope.team.member[inx] = newMember;
                        } else {
                            $scope.team.member = $scope.team.member || []
                            $scope.team.member.push(newMember)
                        }

                        $localStorage.teams = $scope.teams
                    })

            };

            $scope.removeMember = function(inx) {
                let member = $scope.team.member[inx]
                if (confirm("Are you sure you wish to remove "+member.name+ "?")) {
                    $scope.team.member.splice(inx,1)
                    $localStorage.teams = $scope.teams;
                }
            };
        }
    );
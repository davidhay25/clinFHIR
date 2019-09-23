angular.module("sampleApp")
    .controller('teamsCtrl',
        function ($scope,$firebaseAuth,$uibModal,modalService,teamsSvc,$localStorage,$http) {

        $scope.input = {}
            //$scope.teams = $localStorage.teams;
            $scope.organizations = $localStorage.organizations;
            if ($scope.organizations){
                $scope.input.organization = $scope.organizations[0]
            }

            teamsSvc.loadTeams( $scope.organizations).then(
                function(teams) {
                    $scope.teams = teams;
                    console.log(teams)
                }, function(err) {
                    console.log(err)
                }
            )


            $http.post('/stats/login',{module:"teams",servers:{}}).then(
                function(data){
                    //console.log(data);
                },
                function(err){
                    console.log('error accessing clinfhir to register access',err)
                }
            );
/*
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

            */

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
                    controller: function($scope,team,teamsSvc) {

                        $scope.services = angular.copy(teamsSvc.getServices());

                        $scope.team = team || {}
                        let teamb4edit = angular.copy(team);

                        $scope.input = {};

                        $scope.addContact = function(){

                            $uibModal.open({
                                    backdrop: 'static',      //means can't close by clicking on the backdrop.
                                    keyboard: false,       //same as above.
                                    templateUrl: 'modalTemplates/addContactPoint.html',
                                    controller: function ($scope) {
                                        $scope.input = {};
                                        $scope.add = function(){
                                            let cp = {system:$scope.input.system,value : $scope.input.value}
                                            $scope.$close(cp)
                                        }
                                    }
                                }
                            ).result.then(
                                function(cp){
                                    console.log(cp)
                                    $scope.team.contact = $scope.team.contact || []
                                    $scope.team.contact.push(cp)
                                }
                            )


                            /*
                            $scope.team.contact = $scope.team.contact || [];
                            $scope.team.contact.push({type:$scope.input.contactType,value:$scope.input.contactValue});
                            delete $scope.input.contactType;
                            delete $scope.input.contactValue;
                            */
                        };


                        $scope.deleteContact = function(inx) {
                            $scope.team.contact.splice(inx,1)
                        };

                        $scope.addService = function(svc,inx) {
                            if (svc) {
                                $scope.team.service = $scope.team.service || [];

                                //$scope.team.service.push({display:$scope.input.service});
                                $scope.team.service.push(svc);
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

                           // teamsSvc.updateTeam(team)


                        } else {
                            //new
                            team.id = 'id' + new Date().getTime();
                            team.managingOrganization = $scope.input.organization;
                            $scope.teams.push(team)

                        }

                        teamsSvc.updateTeam(team)

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
                    size:"lg",
                    templateUrl: 'modalTemplates/editTeamMember.html',

                    controller: function($scope,member) {
                        $scope.input = {};
                        $scope.member = member || {};
                        let serverUrl = "http://home.clinfhir.com:8054/baseR4/";

                        $scope.scope = 'all';       //scope of search
                        let memberb4edit = angular.copy(member);

                        $scope.roles = teamsSvc.getRoles();

                        $scope.search = function(name) {
                            let url;
                            switch ($scope.scope) {
                                case "org" :
                                    //todo - add org id
                                    url = serverUrl + "PractitionerRole?practitioner.name="+name;
                                    url += "&_include=PractitionerRole:practitioner";
                                    break;
                                case "all" :
                                    url = serverUrl + "Practitioner?name="+name;
                                    break;
                                default :
                                    alert("Direct entry not yet supported")
                                    return;
                                break;
                            }

                            console.log(url);
                            $http.get(url).then(
                                function(data) {
                                    let bundle = data.data;
                                    console.log(bundle)
                                    //now construct a list of practitioners
                                    $scope.practitioners = []
                                    if (data.data.entry) {
                                        data.data.entry.forEach(function (entry) {
                                            let resource = entry.resource;
                                            if (resource.resourceType == 'Practitioner') {
                                                let p = {}
                                                p.resource = resource;
                                                p.name = teamsSvc.getHumanNameSummary(resource.name);
                                                if (resource.identifier) {
                                                    resource.identifier.forEach(function (ident) {
                                                        if (ident.system == "https://standards.digital.health.nz/id/hpi-person") {
                                                            p.cpn = ident.value
                                                        }
                                                    })
                                                }

                                                if (resource.qualification) {
                                                    p.qual = [];
                                                    resource.qualification.forEach(function (qual) {
                                                        p.qual.push(teamsSvc.getQualificationObj(qual))
                                                    })
                                                }
                                              //  p.qual =  resource.qualification;
                                                $scope.practitioners.push(p);
                                            }





                                            }
                                        )
                                    }



                                }
                            )

                        };

                        $scope.selectPractitioner = function(prac){
                            $scope.selectedPractitioner = prac;
                        };



                        $scope.addContact = function(){
                            $scope.member.contact = $scope.member.contact || []
                            $scope.member.contact.push({type:$scope.input.contactType,value:$scope.input.contactValue});
                            delete $scope.input.contactType;
                            delete $scope.input.contactValue;
                        };

                        $scope.deleteContact = function(inx) {
                            $scope.member.contact.splice(inx,1)
                        };


                        $scope.cancel = function() {
                            $scope.$dismiss();
                        };

                        $scope.add = function() {
                            $scope.selectedPractitioner.role = $scope.role;
                            $scope.$close($scope.selectedPractitioner)
                        }

                     },
                resolve : {
                    member : function(){
                        return originalMember;
                    }
                }
                }).result.then(
                    function(prac) {

                        console.log(prac)

                        $scope.team.member = $scope.team.member || []
                        $scope.team.member.push(prac)
                        teamsSvc.updateTeam($scope.team);

                        return;

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
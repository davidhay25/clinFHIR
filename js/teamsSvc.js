angular.module("sampleApp")

    .service('teamsSvc', function($q,$http) {

        let serverUrl = "http://home.clinfhir.com:8054/baseR4/";

        //extension urls
        let purposeUrl = "http://clinfhir.com/fhir/StructureDefinition/team-purpose";
        let serviceUrl = "http://clinfhir.com/fhir/StructureDefinition/team-service";
        let coverageUrl = "http://clinfhir.com/fhir/StructureDefinition/team-coverage";

        let practiceScopeUrl = "http://hl7.org.nz/fhir/StructureDefinition/practitioner-scope-of-practice";

        let hpiSystem = "https://standards.digital.health.nz/id/hpi-person";



        //get the value of a single extension
        function getExtension(resource,url) {
            let ar = [];        //return an array of values...
            if (resource.extension) {
                resource.extension.forEach(function(ext){
                    if (ext.url == url) {
                        ar.push(ext)
                    }
                })
            }
            return ar;
        }

        function addExtension(resource,url,value) {
            resource.extension = resource.extension || []
            let ext = angular.extend({},{url:url},value)
            resource.extension.push(ext);
        }

        function loadAllTeams () {

        }

        return {

            addMember : function(teamId) {

            },

            getQualificationObj : function(qual) {
                let vo = {}
                if (qual) {
                    if (qual.code && qual.code.coding) {
                        vo.codeDisplay = qual.code.coding[0].display;
                    } else {
                        vo.codeDisplay = "No code found"
                    }

                    let arScopePractice = getExtension(qual,practiceScopeUrl);
                    if (arScopePractice.length > 0) {
                        vo.scopePractice = [];
                        arScopePractice.forEach(function (ext) {
                            vo.scopePractice.push(ext.valueString)
                        })

                    }

                }
                return vo;


            },

            getHumanNameSummary : function(hn){
                if (!hn) {
                    return "";
                }
                let data = hn[0];   //assume HN is always an array
                var txt = "";
                if (data.text) {
                    return data.text;
                } else {
                    txt += getString(data.given);
                    txt += getString(data.family);
                    return txt;
                }

                function getString(ar) {
                    var lne = '';
                    if (ar) {
                        if (angular.isArray(ar)) {      //make sure it's an array. eh humanname isn't...
                            ar.forEach(function(el){
                                lne += el + " ";
                            } )
                        } else {
                            lne += ar + " ";
                        }
                    }
                    return lne;
                }
            },

            getCategories : function() {
                //return all the team categories. This will be a ValueSet of course;
                let lst = []
                lst.push({code:'mhealth','display':'Mental Health Team',system:'http://clinfhir.com/fhir/CodeSystem/team-category'})
                lst.push({code:'comhealth','display':'Community Health Team',system:'http://clinfhir.com/fhir/CodeSystem/team-category'})
                lst.push({code:'dental','display':'Community Dental Services',system:'http://clinfhir.com/fhir/CodeSystem/team-category'})
            },
            getRoles : function() {
                //return all the team categories. This will be a ValueSet of course;
                let lst = []
                lst.push({code:'x1','display':'SMO',system:'http://clinfhir.com/fhir/CodeSystem/team-role'})
                lst.push({code:'x2','display':'Registered Nurse',system:'http://clinfhir.com/fhir/CodeSystem/team-role'})
                lst.push({code:'x3','display':'Psychologist',system:'http://clinfhir.com/fhir/CodeSystem/team-role'})
                lst.push({code:'x4','display':'Speech therapy',system:'http://clinfhir.com/fhir/CodeSystem/team-role'})
                lst.push({code:'x5','display':'Social Worker',system:'http://clinfhir.com/fhir/CodeSystem/team-role'})
                lst.push({code:'x6','display':'Dietician',system:'http://clinfhir.com/fhir/CodeSystem/team-role'})

                lst.sort(function(a,b){
                    if (a.display > b.display) {
                        return 1
                    } else {
                        return -1
                    }
                })
                return lst;

            },


            getServices : function() {
                //return all the team categories. This will be a ValueSet of course;
                let lst = []
                lst.push({code:'mhealth','display':'Acute Mental Health Assessment',system:'http://clinfhir.com/fhir/CodeSystem/team-service'})
                lst.push({code:'comhealth','display':'Dental treatment',system:'http://clinfhir.com/fhir/CodeSystem/team-service'})
                lst.push({code:'x1','display':'Stroke Rehabilitation',system:'http://clinfhir.com/fhir/CodeSystem/team-service'})
                lst.push({code:'x2','display':'Older person assessment',system:'http://clinfhir.com/fhir/CodeSystem/team-service'})
                return lst;
            },


            loadTeams : function(organizations){        //organizations is temp
                //load all tha teams at the moment...
                let deferred = $q.defer();
                let url = serverUrl + "CareTeam?_include=CareTeam:participant";
                let teams = [];
                let that = this;

                $http.get(url).then(
                    function(data) {
                        console.log(data.data);
                        if (data.data.entry) {
                            let hashPractitioner = {};
                            //create a hash of Practitioner for populating team.member...
                            data.data.entry.forEach(function(entry) {
                                if (entry.resource.resourceType == 'Practitioner') {
                                    hashPractitioner['Practitioner/'+ entry.resource.id] = entry.resource;
                                }
                            });
                            console.log(hashPractitioner)
                            data.data.entry.forEach(function(entry){
                                if (entry.resource.resourceType == 'CareTeam') {
                                    let team = {member:[],location:[],contact:[]};      //internal representation of team
                                    team.id = entry.resource.id;
                                    team.resource = entry.resource;
                                    team.name = team.resource.name;
                                    team.managingOrganization = organizations[0];       //temp
                                    team.contact = entry.resource.telecom;

                                    let arPurpose = getExtension(entry.resource,purposeUrl);
                                    if (arPurpose.length > 0) {
                                        team.purpose = arPurpose[0].valueString;        //should only be a single purpose
                                    }

                                    let arCoverage = getExtension(entry.resource,coverageUrl);
                                    if (arCoverage.length > 0) {
                                        team.coverage = arCoverage[0].valueString;        //should only be a single purpose
                                    }

                                    let arService = getExtension(entry.resource,serviceUrl);
                                    if (arService.length > 0) {
                                        team.service = []
                                        arService.forEach(function (ext) {
                                            team.service.push(ext.valueCodeableConcept.coding[0])

                                        })
                                    }

                                    if (entry.resource.participant) {
                                        team.member = []
                                        entry.resource.participant.forEach(function (part) {
                                            let ref = part.member.reference;
                                            console.log(ref);
                                            console.log(hashPractitioner[ref])
                                            let practitioner = hashPractitioner[ref];
                                            let mem = {};
                                            mem.name = that.getHumanNameSummary(practitioner.name);
                                            mem.resource = practitioner;
                                            if (part.role && part.role.length > 0 && part.role[0]) {
                                                mem.role = part.role[0].coding[0]
                                            }

                                            if (practitioner.qualification) {
                                                mem.qualification = []
                                                practitioner.qualification.forEach(function (qual) {
                                                    mem.qualification.push(that.getQualificationObj(qual))
                                                })
                                            }


                                            //mem.qualification = practitioner.qualification;
                                            if (practitioner.identifier) {
                                                practitioner.identifier.forEach(function (ident) {
                                                    if (ident.system == hpiSystem) {
                                                        mem.CPN = ident.value;
                                                    }
                                                })
                                            }
                                            team.member.push(mem)

                                        })
                                    }

                                    teams.push(team)
                                }
                            })
                        }
                        deferred.resolve(teams);
                    },
                    function(err) {
                        console.log(err)
                    }
                );
                return deferred.promise;
            },

            updateTeam : function(team) {
                //update a single careTeam resource

                let CareTeam = {resourceType:'CareTeam'};      //the resource
                CareTeam.id = team.id || "id-"+new Date().getTime();
                CareTeam.name = team.name;

                if (team.service && team.service.length > 0) {
                    //CareTeam.
                    team.service.forEach(function (concept) {
                        let cc = {valueCodeableConcept:{coding:[concept]}}
                        addExtension(CareTeam,serviceUrl,cc)

                    })
                }

                if (team.purpose) {
                    addExtension(CareTeam,purposeUrl,{valueString : team.purpose})
                }

                if (team.coverage) {
                    addExtension(CareTeam,coverageUrl,{valueString : team.coverage})
                }

                if (team.contact && team.contact.length > 0) {
                    CareTeam.telecom = []
                    team.contact.forEach(function (contact) {
                        CareTeam.telecom.push(contact)
                    })

                }

                if (team.member) {
                    CareTeam.participant = CareTeam.participant || [];
                    team.member.forEach(function (p) {
                        let part = {}
                        part.role = [{coding:[p.role]}];
                        part.member = {reference:'Practitioner/'+p.resource.id}
                        CareTeam.participant.push(part)
                    })
                }



                console.log(CareTeam)
                let url = serverUrl+"CareTeam/"+CareTeam.id;
                $http.put(url,CareTeam).then(
                    function() {

                    }, function(err) {
                        alert(angular.toJson(err.data))
                    }
                )



            },


            getTeams: function (vo) {

                return $http.get("artifacts/teams.json")


            }
        }


    }
);
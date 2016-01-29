angular.module("sampleApp").service('supportSvc', function($http,$q) {

    var serverBase;
    var observations=[];    //used for generating sample data plus vitals...
    observations.push({code:'8310-5',display:'Body Temperature',min:36, max:39,unit:'C',round:10,isVital:true});
    observations.push({code:'8867-4',display:'Heart Rate',min:70,max:90,unit:'bpm',round:1,isVital:true});
    observations.push({code:'9279-1',display:'Respiratory Rate',min:25,max:35,unit:'resp/min',round:1,isVital:true});
    observations.push({code:'8302-2',display:'Height',max:90,min:90,unit:'cm',round:10});
    observations.push({code:'3141-9',display:'Weight',max:90,min:70,unit:'Kg',round:10,isVital:true});

    return {
        getVitals : function(vo) {
            //get the observation types shown as vitals, and return the raw bundle plus a grid for display...
            //only 100 observations at the moment
            var deferred = $q.defer();
            var patientId = vo.patientId;


            var that = this;
            var response = {vitalsCodes:[]};      //the response object as we want to return more than one thing...

            //create the url for retrieving the vitals data. Want to show how it could be done...
            var url = serverBase+"Observation?subject="+patientId;

            //create the list of codes to include in the query
            var filterString="";
            observations.forEach(function(item){
                if (item.isVital) {
                    filterString += ","+item.code;
                    response.vitalsCodes.push({code:item.code,display:item.display,unit:item.unit});
                }
            });

            filterString = filterString.substring(1);
            url += "&code="+filterString;
            url += "&_count=100";

            console.log('url='+url);
            $http.get(url).then(
                function(data){
                    console.log(data);
                    response.grid = that.getGridOfObservations(data.data);      //an object hashed by date.



                    deferred.resolve(response)

                },
                function(err){
                    alert(angular.toJson(err))
                    deferred.reject(err)
                }
            );
            return deferred.promise;






        },
        getAllData : function(patientId) {
            //return all the data for the indicated patient. Don't use the 'everything' operation
            //currently only get a max of 100 resources of each type. Need to implement paging to get more...
            var deferred = $q.defer();
            var resources = [];
            resources.push({type:'Observation',patientReference:'subject'});
            resources.push({type:'Encounter',patientReference:'patient'});
            resources.push({type:'Appointment',patientReference:'patient'});

            var arQuery = [];
            var allResources = {};

            resources.forEach(function(item){
                var uri = serverBase + item.type + "?" + item.patientReference + "=" + patientId + "&_count=100";
                arQuery.push(

                    getAllResources(uri).then(
                        function(bundle){
                            allResources[item.type] = bundle;    //this will be a bundle
                        }
                    )
                )
            });

            $q.all(arQuery).then(
                function(data){
                    deferred.resolve(allResources);
                },
                function(err){
                    alert("error loading all patient data:\n\n"+ angular.toJson(err));
                    deferred.reject(err);
            });

            return deferred.promise;

            //get all the resources for a single type.
            function getAllResources(uri) {
                var deferred = $q.defer();
                var bundle = {entry:[]}



                //thereIsMore = true;
                //while (thereIsMore) {
                    loadPage(uri).then(
                        function(data){
                            var pageBundle = data.data;     //the bundle representing this page...
                            //thereIsMore = false
                            if (pageBundle.link){
                                //if there's a link, then need to check for a 'next' link...
                            }


                            deferred.resolve(pageBundle)
                        }
                    );
                //}


                return deferred.promise;



            }

            function loadPage(uri,start) {
                return $http.get(uri);



            }


        },
        loadSamplePatients : function(vo) {
            //var deferred = $q.defer();
            var uri = serverBase + "Patient?organization="+vo.organizationId+"&_count=100";     //<<<<<
            return $http.get(uri);
        },
        setServerBase : function(sb) {
            serverBase = sb;
        },
        postBundle : function(bundle) {
            var deferred = $q.defer();

            $http.post(serverBase,bundle).then(
                function(data) {
                    deferred.resolve(data)

                },
                function(err) {

                    alert(angular.toJson(err));
                    deferred.reject(err)

                }
            );

            return deferred.promise;

        },
        getGridOfObservations : function(bundle) {
            var grid = {};      //there will be a property for each unique datetime, with a collection of matching observations for each time.
            if (bundle && bundle.entry) {
                bundle.entry.forEach(function(entry){
                    var obs = entry.resource;
                    var code = obs.code.coding[0].code;
                    var date = obs.effectiveDateTime;
                    if (date) {
                        if (! grid[date]) {
                            grid[date] = {}
                        }
                        var g = grid[date];
                        g[code] = obs

                        //grid[date].push(obs)
                    }

                });

                console.log(grid);

                return grid;

            }
        }
        }
    }
);
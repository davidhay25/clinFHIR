angular.module("sampleApp").service('resourceSvc', function() {

    var outwardLinks = [];
    var inwardLinks = [];

    var getOutwardLinks = function(resource){

        //look for outgoing references
        var checkLinks = function(list,object,rootPath) {
            angular.forEach(object,function(value,key){

                //console.log(rootPath)

                if (value && value.reference) {
                    //console.log('->reference',value.reference)

                    var reference = value.reference;    //the reference - eg Condition/100
                    //console.log(value,key)


                    //a bit of a hack - auditEvent has a property called 'reference'
                    if (reference.reference) {
                        reference = reference.reference;
                    }



                    outwardLinks.push({reference:reference,element: rootPath + " " +key,key:key})

                } else {
                    //going to assume that a reference will never have children...
                    if (angular.isObject(value)) {
                        checkLinks(list,value,rootPath+'.'+key);
                    }
                }

            })
        };
        outwardLinks = [];


        checkLinks(outwardLinks,resource,resource.resourceType);


    };

    //get all the resources that reference the focussed one.
    var getInwardLinks = function(resource,allResources) {
        var id = resource.resourceType + "/" + resource.id;   //the id of the focussed resource
        //console.log(id);

        inwardLinks = [];


        //a recursive function
        //check the object to see if there are references with this resource as the target
        //look for outgoinf references
        //list = the accumulating list if inward resources
        //object = the particular node being examined
        //resource being checked is the actual resource (it has many nodes)
        var checkInLinks = function (list, object, resourceBeingChecked) {
            angular.forEach(object, function (value, key) {

                //assume that any value that has a reference property is a resource refernece. Should really
                //recurse down 'object' types
                if (value.reference) {
                    //This is a reference. Is it to the resource being evaluated?
                    if (value.reference == id) {

                        //console.log(key,resourceBeingChecked)

                        list.push({name: key, resource: resourceBeingChecked});
                    }

                }

                if (angular.isObject(value)) {
                    checkInLinks(list, value, resourceBeingChecked);
                }

            })
        };

        allResources.forEach(function(resource) {

            //both the node being checked and the resource being checked will be the same at the start...
            checkInLinks(inwardLinks, resource, resource);
        })


    };



    return {
        getReference : function(resource,allResources,allResourcesDict){
            if (resource) {
                getOutwardLinks(resource);

                if (allResources) {
                    getInwardLinks(resource,allResources);
                }


                //if the dictionary was passed in, then populate the actual resource as well. This is not needed by the graph generator...
                if (allResourcesDict) {
                    outwardLinks.forEach(function(item){
                        item.resource = allResourcesDict[item.reference];
                    })
                }


                return ({outwardLinks:outwardLinks,inwardLinks:inwardLinks})
            } else {
                return ({outwardLinks:[],inwardLinks:[]})
            }


        }

    }

});
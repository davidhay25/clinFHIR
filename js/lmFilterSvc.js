angular.module("sampleApp")
    .service('lmFilterSvc', function(appConfigSvc,$http) {

        if (!String.prototype.startsWith) {
            String.prototype.startsWith = function(search, pos) {
                return this.substr(!pos || pos < 0 ? 0 : +pos, search.length) === search;
            };
        }

        var parentEntry;               //the currently selected Entry
        var internalChildModelEntries=[];     //an array of all the models that are filtered from this model (to support csiro)
        var currentChildEntry;          //the currently selected child
        return {
            setCurrentChildEntry : function(entry){
                currentChildEntry = entry;
            },
            updateChild(filteredTreeData) {
                //update the child entry from the currently selected paths...
                //todo ? need to validate model first???

                // console.log(filteredTreeData);

                var resource = currentChildEntry.resource;
                resource.snapshot.element.length = 0;
                filteredTreeData.forEach(function(item){
                    var ed = item.data.ed;      //the ElementDefinition
                    //replace the first element of the path with the id of the child model
                    var ar = ed.path.split('.');
                    ar[0] = resource.id;
                    ed.path = ar.join('.')
                    resource.snapshot.element.push(ed)
                })

                delete resource.snapshot.element[0].label;



                console.log(currentChildEntry)

                console.log(angular.toJson(resource))

                var json = angular.toJson(resource);
                var confServer = appConfigSvc.getCurrentConformanceServer();
                var url = confServer.url + "StructureDefinition/"+ resource.url;

                console.log(url)
                return $http.put(url,resource);


            },
            addNewChild : function(name) {
                //add a new child model. (assume unique)
                var base = parentEntry.resource.id + '--';
                var newEntry = {resource:{resourceType:'StructureDefinition'}}
                newEntry.resource.id = base + name;
                newEntry.resource.url = base + name;
                newEntry.resource.name = base + name;
                newEntry.resource.status = 'active'
                newEntry.resource.kind = 'logical';
                //newEntry.resource.keyword = [{ "system": "http://fhir.hl7.org.nz/NamingSystem/application",
                 //   "code": "clinfhir"}]
                newEntry.resource.identifier = [{system:'http://clinfhir.com',value:'author'}]
                newEntry.resource.abstract=false;
                newEntry.resource.type=base + name
                newEntry.resource.baseDefinition = 'http://hl7.org/fhir/StructureDefinition/Element'
                newEntry.resource.derivation = 'specialization';
                newEntry.resource.snapshot = {element:[]};
                internalChildModelEntries.push(newEntry);

                currentChildEntry= newEntry;        //select the new child as current
                return newEntry;

            },
            childModelEntries : internalChildModelEntries,
            findChildModels: function (entry, bundleModels) {
                parentEntry = entry;
                internalChildModelEntries.length = 0;

                if (entry && bundleModels) {

                    var resource = entry.resource;  //the model that has just been selected
                    var base = resource.id + '--';   //all models in the bundle that start with this are considered to be child models

                    bundleModels.entry.forEach(function (ent) {
                        if (ent.resource && ent.resource.id && ent.resource.id.startsWith(base)) {
                            internalChildModelEntries.push(ent)
                        }
                    })
                }

            }
        }

    });
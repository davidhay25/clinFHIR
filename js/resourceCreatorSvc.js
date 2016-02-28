angular.module("sampleApp").service('resourceCreatorSvc', function($q,$http) {


    var currentProfile;     //the profile being used...

    var getElementDefinitionFromPath = function(path){
        //get the element definition for the path from the profile
        return currentProfile[path];
    };

    return {

        getEDForPath : function(path) {
          //return the elementdefinition for a given path
            return this.currentProfile[path];
        },


        getPossibleChildNodes : function(ed){
            //given an element definition, return a collection of the possible child nodes
            var exclusions=['id','meta','implicitRules','language','text','contained','extension','modifierExtension'];
            var children = [];
            var path = ed.path;     //the path of this ed. child nodes will have this as a parent, and one more dot in the path
            //var ar = path.split('.');
            var pathLength = path.length;
            var dotCount = (path.split('.').length);
            //var dotCount = ar.length-1;
            angular.forEach(this.currentProfile,function(e,k){
                //console.log(e,k);
                //console.log(k)
                var ar = k.split('.');

                if (k.substr(0,pathLength) == path && ar.length == dotCount+1) {
                   // console.log('match')
                    //only add children that are not in the exclusion list. Will need to change this when we implement extensions...
                    var propertyName = ar[dotCount];  //the name of the property in the resource
                    if (exclusions.indexOf(propertyName) == -1) {
                        e.myData = {display:propertyName};
                        children.push(e);
                    }



                }

                //var dc = (k.split('.').length-1);



            });

            return children;
        },

        buildResource : function(type,treeData) {
            //build the resource from the treeData. Assume that it is in the correct order - ie that all nested
            //elements follow each other properly. This assumes that the creator routines insert into the treeData array
            //rather than appending...
            var that = this;
            var workingObject;  //the working object - where we are in the resource being built.
            var resource = {};
            treeData.forEach(function(item){
                //console.log(item)
                var id = item.id;       //the internal id of this node
                var path = item.path;   //the resource path

                var ed = that.currentProfile[path];    //the elementDefinition from the profile for this path
                var fragment = item.fragment;      //the json fragment (if any) at this point

                console.log(id,path,fragment,ed);


                var ar = path.split('.');


                switch (ar.length) {

                    case 1 :
                        //this is the root
                        //resource[path] = fragment;
                        workingObject = resource;//[path];
                        break;
                    default :
                        //is this a 'real' property, or a parent node...
                        if (ed.type[0].code == 'BackboneElement' ) {
                            //so this is a parent node. Add it to the resource...
                            var node = {}
                        } else {
                            //this is 'normal' property. add to the workingObject
                            var propertyName = ar[ar.length-1];
                            //is this is single or multiple value?
                            var multiple = true;

                            if (ed.base && ed.base.max) {
                                //the base property is used in profiled resources...
                                if (ed.base.max == '1') {
                                    multiple = false;
                                }
                            } else {
                                //this must be one of the core resource defintions...
                                if (ed.max == '1') {
                                    multiple = false
                                }
                            }

                            if (multiple) {
                                workingObject[propertyName] = workingObject[propertyName] || []
                                workingObject[propertyName].push(fragment);
                            } else {
                                workingObject[propertyName] = fragment;
                            }


                        }

                        break;

                }




            })

            console.log(resource);
            return resource;


        },

        addPatientToTree: function(path, patient, treeData) {
            //add the patient reference to the tree  path = path to patient, patient = patient resource, treeData = data for tree
            var fragment = {patient:{reference:'Patient/100',display:'John Doe'}};
            //path = the path in the resource - relative to the parent
            //fragment = the json to render at that path. If a 'parent' in the resource (node type=BackboneElement) - eg Condition.Stage then the fragment is empty.
           // var patientNode = getElementDefinitionFromPath(path)

            treeData.push({id:'patient',parent:'root',text:'subject',path:path,fragment:fragment});


        },
        getProfile : function(type){
                var deferred = $q.defer();
                var that=this;

                $http.get("artifacts/"+type+".json").then(
                    function(data) {
                        that.currentProfile = {};
                        data.data.snapshot.element.forEach(function(elementDefinition){
                            that.currentProfile[elementDefinition.path] = elementDefinition;
                        });



                        //this.currentProfile = data.data;
                        deferred.resolve(data.data)
                    }
                );



             //   http://fhir2.healthintersections.com.au/open/StructureDefinition/Condition



                return deferred.promise;


            }

    }

});
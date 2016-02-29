angular.module("sampleApp").service('resourceCreatorSvc', function($q,$http,RenderProfileSvc,GetDataFromServer,Utilities) {


    var currentProfile;     //the profile being used...

    //function to capitalize the first letter of a word...
    String.prototype.toProperCase = function () {
        return this.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
    };

    var getElementDefinitionFromPathDEP = function(path){
        //get the element definition for the path from the profile
        return currentProfile[path];
    };

    return {

        getJsonFragmentForDataType : function(dt,results) {
            //create a js object that represents a fragment of data for inclusion in a resource based on the datatype...

            var fragment;


            
                //the actual data entry elements will depend on the datatype...
                switch ( dt) {

                    case 'Money':
                        var qty = {value:results.money_amount,units:results.money_units};
                        var text = qty.value  + " " + qty.units;
                        addValue(qty,'Money',text,false);
                        break;

                    case 'positiveInt':
                        var qty = results.positiveint;
                        var text = results.positiveint;
                        addValue(qty,'positiveInt',text,true);
                        break;

                    case 'integer':
                        var qty = results.integer;
                        var text = results.integer;
                        addValue(qty,'integer',text,true);
                        break;

                    case 'ContactPoint' :
                        var use = results.ct.use;
                        var system = results.ct.system;
                        var value = results.ct.value;

                        var ct = {use:use,system:system,value:value};
                        addValue(ct,'ContactType',use + " "+ system + " " + value,false);
                        break;

                    case 'HumanName' :
                        var text = results.hn.text;
                        var hn = {use:results.hn.use,text:text};
                        if (results.hn.fname) {
                            hn.given=[results.hn.fname]
                        }
                        if (results.hn.lname) {
                            hn.family=[results.hn.lname]
                        }

                        addValue(hn,'HumanName',text,false);
                        break;

                    case 'Address' :
                        var use = results.addr.use;
                        var text = results.addr.text;
                        var address = {use:use,text:text};
                        addValue(address,'Address',use + " " + text,false);
                        break;


                    case 'Timing' :

                        var timing = {repeat:{}};

                        timing.repeat.duration = results.timing.duration;
                        timing.repeat.durationUnits = results.timing.units;
                        timing.repeat.frequency = results.timing.freq;
                        timing.repeat.frequencyMax = results.timing.freq_max;
                        timing.repeat.durationperiod =results.timing.period;
                        timing.repeat.periodMax = results.timing.period_max;
                        timing.repeat.periodUnits = results.timing.period_units;
                        timing.repeat.when = results.timing.when

                        var daStart = moment(results.timing_start).format();
                        var daEnd = moment(results.timing_end).format();


                        timing.bounds = {start: daStart,end: daEnd};

                        var text = results.timingDescription;
                        addValue(timing,'Timing',text,false);

                        break;


                    //---------

                    case 'Ratio' :

                        var num = {value:results.ratio_num_amount,units:results.ratio_num_units};
                        var denom = {value:results.ratio_denom_amount,units:results.ratio_denom_units};
                        var ratio = {numerator : num,denominator:denom};
                        var text = num.value + " " + num.units+ " over " + denom.value + " " + denom.units;
                        addValue(ratio,'Ratio',text,false);
                        break;

                    case 'Quantity' :

                        var qty = {value:results.quantity_amount,unit:results.quantity_units};

                        var text = qty.value  + " " + qty.units;
                        addValue(qty,'Quantity',text,false);


                        break;

                    case 'Range' :

                        var st = {value:results.range_amount_start,units:results.range_units};
                        var en = {value:results.range_amount_end,units:results.range_units};

                        var range = {low:st,end:en};
                        var text = "Between " + st.value + " and " + en.value + " " + st.units;
                        addValue(range,'Range',text,false);



                        break;

                    case 'Annotation' :
                        var anot = {text:results.annotation.text,authorString : results.annotation.authorString};
                        addValue(anot,'Annotation',anot.text,false);
                        break;
                    case 'Narrative' :
                        //add the narrative as a value to the root element
                        profile.snapshot.element[0].valueNarrative = results.narrative;
                        break;
                    case 'string' :
                        addValue(results.string,'String',results.string,true);
                        break;
                    // case 'id' :
                    //   addValue(results.id,'String',results.id);
                    // break;

                    case 'uri' :
                        addValue(results.uri,'uri',results.uri,true);
                        break;

                    case 'date' :

                        var da = moment(results.date_start).format("YYYY-MM-DD");

                        addValue(da,'Date',da,true);
                        break;
                    case 'dateTime' :
                        var da = moment(results.date_start).format();

                        addValue(da,'DateTime',da,true);

                        break;
                    case 'instant' :

                        var time = moment(results.time); //the time component. the date is set to the current date

                        var da = moment(results.date_start);// the date .format();

                        time.set('year',da.get('year'))
                        time.set('month',da.get('month'))
                        time.set('date',da.get('date'))


                        addValue(time.format(),'instant',time.format(),true);

                        break;
                    case 'code' :
                        addValue(results.code,'Code',results.code,true);
                        break;
                    case 'Coding' :
                        var coding = results.coding;
                        addValue(coding,'Coding',"",false);
                        break;
                    case 'CodeableConcept' :

                        var cc = results.cc;
                        var ccText = results.ccText;
                        //if represented as a set of radio buttons, then the response is a json string not an object
                        if (cc && angular.isString(cc)) {
                            try {
                                cc = JSON.parse(cc);
                            } catch (ex) {
                                alert('There was an error saving the CodeableConcept. Likely the response from theTerminology' +
                                    'server was not understood. The data is NOT saved. Sorry about that')
                                return;
                            }

                        }



                        //todo - the expansion is returning an extension with more info - may be useful later...
                        if (cc && cc.extension) {
                            delete cc.extension;
                        }

                        var newCC;      //this will be teh cc that we are saving...
                        if (cc) {
                            //var ccText = cc.display;
                            newCC = {coding:[cc]};

                        } else {
                            newCC = {};
                        }

                        if (!ccText) {  //the user didn't enter any text...
                            if (newCC.coding) {     //but they did select an option...
                                ccText = newCC.coding[0].display;
                            } else {
                                //WTF - no selection or text???
                                return;
                            }

                        }

                        newCC.text = ccText;
                        addValue(newCC,'CodeableConcept',ccText,false);
                        break;
                    case 'Reference' :
                        if (results.resourceItem) {
                            //a real resource was selected
                            var selectedResource = results.resourceItem.resource;

                            var v = {reference: selectedResource.resourceType + "/" + selectedResource.id};



                            if (results.resourceItemText) {
                                v.display = results.resourceItemText;
                            } else {
                                v.display = ResourceUtilsSvc.getOneLineSummaryOfResource(selectedResource);
                            }


                            var referenceDisplay = "";
                            if (selectedResource.text) {
                                referenceDisplay = selectedResource.text.div
                            }


                            addValue(v,'Reference',referenceDisplay,false);
                        } else {
                            //no resource selected - was there any text?
                            if (results.resourceItemText) {
                                var v = {display: results.resourceItemText};
                                addValue(v,'Reference',results.resourceItemText);
                            }

                        }
                        break;
                    case 'Identifier' :
                        var v = {'system': results.identifier_system,value:results.identifier_value};
                        addValue(v,'Identifier',results.identifier_value,false);
                        break;
                    case 'Period' :

                        var daStart = moment(results.date_start).format('YYYY-MM-DD');
                        var daEnd = moment(results.date_end).format('YYYY-MM-DD');


                        var display = 'From'+ moment(results.date_start).format('YYYY-MM-DD');
                        display += ' to '+ moment(results.date_end).format('YYYY-MM-DD');
                        var v = {start: daStart,end: daEnd};

                        if (results.period.startOnly) {
                            display = 'From'+ moment(results.date_start).format('YYYY-MM-DD');
                            v = {start: daStart};
                        }


                        addValue(v,'Period',display,false);
                        break;
                    case 'Age' :


                        //this is being set as a JSON string rather than an object - I'm not sure why...
                        var units = JSON.parse(results.ageunits);
                        var v = {value: results.age.value,
                            units: units.display,
                            system:'http://ucum.org',
                            code:units.code};



                        addValue(v,'Age',results.age.value + " "+units.display,true);
                        break;
                    case 'boolean' :
                        var v = results.boolean;
                        addValue(v,'Boolean',v ? 'Yes' : 'No',true)
                        break;

                }

                return fragment;


            //set the return value. Copied from the original - hence the (currently) unused elements
            function addValue(v,dataType,text,isPrimitive) {


                fragment = {value:v,text:text};

            }



        },

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
                        e.myData = {display:propertyName,displayClass:""};
                        if (e.min !== 0) {
                            e.myData.displayClass += 'elementRequired ';
                        }

                        if (e.type && e.type[0].code == 'BackboneElement') {
                            e.myData.displayClass += "backboneElement";
                        }


                        children.push(e);
                    }



                }

                //var dc = (k.split('.').length-1);



            });

            return children;
        },


        buildResource : function(type,treeObject,treeData) {
            //create the sample resource...
            var resource = {resourceType:type}

            //create an object hash of the treeData
            var treeHash = {};
            for (var i=0; i<treeData.length; i++) {
                var node = treeData[i];
                treeHash[node.id] = node;
            }

            //is this a releating element?
            function canRepeat(ed) {
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
                return multiple;
            }


            function addChildrenToNode(resource,node,text) {
                //add the node to the resource. If it has children, then recursively call
                var lnode = treeHash[node.id];
                var path = lnode.path;
                var ar = path.split('.');
                var propertyName = ar[ar.length-1];

                if (propertyName.indexOf('[x]') > -1) {
                    //this is a polymorphic field...
                    propertyName = propertyName.slice(0, -3) + lnode.dataType.code.toProperCase();


                }

                if (lnode.fragment) {
                    //if the 'resource' is an array, then there can be multiple elements...

                    //this should never occur..
                    if (angular.isArray(resource)) {
                        alert('array passed')
                        var o = {};
                        o[propertyName] = lnode.fragment;
                        resource.push(o)

                    } else {
                        //console.log(lnode)
                        resource[propertyName] = lnode.fragment;
                        text.value += lnode.display + ' ';
                        //console.log(text);
                    }


                }



                if (node.children && node.children.length > 0) {
                    node.children.forEach(function(child){
                        var childNodeHash = treeHash[child.id];
                        var ed = childNodeHash.ed;      //the element definition describing this element
                        //is this a backbone
                        if (ed && ed.type) {
                            if (ed.type[0].code == 'BackboneElement') {
                                //yes! a backbone element. we need to create a new object to act as teh resource
                                var ar1 = ed.path.split('.');
                                var pName = ar1[ar1.length-1];


                                var obj;
                                //is this a repeating node? - ie an array...
                                var cr = canRepeat(ed);
                                obj = {};
                                if (cr) {
                                    //this is a repeating element. Is there already an array for this element?
                                    if (! resource[pName]) {
                                        resource[pName] = [];
                                    }
                                    resource[pName].push(obj);


                                } else {
                                    //this is a singleton...
                                    resource[pName] = obj;
                                }


                                addChildrenToNode(obj,child,text)
                            } else {

                                addChildrenToNode(resource,child,text)
                            }


                        } else {
                            //no, just add to the resource
                            addChildrenToNode(resource,child,text)
                        }



                    })
                }

            }


            var text = {value:""};
            addChildrenToNode(resource,treeObject,text);

            console.log(text)
            return resource;


        },


        buildResourceDEP : function(type,treeData) {
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
            var fragment = {reference:'Patient/100',display:'John Doe'};
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


            },
        dataTypeSelected : function(dt,results,element,scope) {
            //todo - get rid of the scope...
            switch (dt) {

                case 'Period' :
                    results.period = {startOnly:false};
                    break;

                case 'Quantity' :

                    scope.showWaiting = true;
                    //age-units
                    GetDataFromServer.getExpandedValueSet('ucum-common').then(
                        function(vs) {

                            scope.showWaiting = false;
                            scope.ucum = vs.expansion.contains;
                        }, function(err){
                            scope.showWaiting = false;
                            alert("Unable to get the UCUM codes, you can still enter them manually");
                            console.log(err)

                        }
                    );
                    break;


                case 'Identifier' :


                    //see if there is a constraint in identifier system - if so, then set it as a default...
                    if (element.constraint) {
                        var search = 'identifier[system/@value=';
                        element.constraint.forEach(function(con){
                            if (con.xpath && con.xpath.indexOf(search)>-1) {
                                var g = con.xpath.indexOf('=');
                                var system = con.xpath.substr(g+1);
                                system = system.replace(/]/g,"");
                                results.identifier_system = system;
                            }
                        })
                    };


                    break;

                case 'ContactPoint' :
                    results.ct = {use:'home',system:'mobile'};
                    break;

                case 'HumanName' :
                    results.hn = {use:'usual'};
                    break;

                case 'Address' :
                    results.addr = {use:'home'};
                    break;

                case 'Narrative' :
                    //enter extra narrative
                    results.narrative = ""; //todo scope.profile.snapshot.element[0].valueNarrative;
                    break;

                case 'Annotation' :
                    //enter extra narrative
                    results.annotation = {text:'',authorString:''};
                    break;


                case 'Age' :
                    scope.UCUMAgeUnits = Utilities.getUCUMUnits('age');
                    break;

                case 'Money' :
                    scope.UCUMMoneyUnits = Utilities.getUCUMUnits('money');
                    break;

                case 'Reference' :
                    //todo - have a service that creates a full summary of a resource - and a 1 liner for the drop down
                    //console.log(element)
                    if (! RenderProfileSvc.isUrlaBaseResource(element.type[0].profile[0])) {
                        //this is a reference to profile on a base resource. need to load the profile so we can figure out the base type
                        scope.profileUrlInReference = element.type.profile[0];
                        GetDataFromServer.findResourceByUrl('StructureDefinition',element.type.profile[0],function(profile){
                            if (profile) {

                                var resourceType = profile.constrainedType;//  Utilities.getResourceTypeFromUrl();
                                scope.resourceType = resourceType;
                                scope.selectedReferenceResourceType = RenderProfileSvc.getResourceTypeDefinition(resourceType) ;//  scope.resourcetypes[resourceType];
                                //todo -this won;t be correct...
                                //-temp- scope.externalReferenceSpecPage = "http://hl7.org/fhir/2015May/" + resourceType + ".html";
                                //todo - need to pass the profilein as welll

                                //if this is a 'reference' type resource (lkike origanization)t then don't
                                //incldue any of thm in the list

                                scope.resourceList = RenderProfileSvc.getResourcesSelectListOfType(
                                    scope.allResources,resourceType,profile.url);



                            }

                        });
                    } else {
                        //this is a base resource...

                        //DSTU-2 - type.profile is an array
                        var ar = element.type[0].profile[0].split('/');
                        var resourceType = ar[ar.length-1];
                        console.log(resourceType)

                        //if any resource can be referenced here
                        if (resourceType== 'Resource') {
                            scope.uniqueResources = RenderProfileSvc.getUniqueResources(scope.allResources);
                        } else {
                            delete scope.uniqueResources;
                        }

                        //this defines the resource type - eg whether it is a reference resource rather than linked to a patient...
                        scope.selectedReferenceResourceType = RenderProfileSvc.getResourceTypeDefinition(resourceType);//scope.resourcetypes[resourceType];


                        scope.resourceType = resourceType;


                        //if the resource type is one that is a 'reference' - ie doesn't link to a patient then
                        //the resurceList is empty. Otherwise populate it with the existing resources of that type for the patient
                        if (scope.selectedReferenceResourceType.reference) {
                            // if (scope.allResourceTypesIndexedByType[resourceType].reference) {
                           // delete scope.resourceList;
                        } else {
                            //the list of resources of this type linked to this patient that can be selected...
                            scope.resourceList = RenderProfileSvc.getResourcesSelectListOfType(
                                scope.allResources,resourceType);
                        }

                    }

                    break;
                case 'date' :
                    //results.date_start = "";
                    break;
                case 'string' :
                    //results.string = "";
                    break;



                case 'Coding' :
                    //returns the Url of the reference.
                    var valueSetReference = RenderProfileSvc.getUniqueResources(element);

                    results.coding = null;
                    if (valueSetReference) {
                        Utilities.getValueSetIdFromRegistry(valueSetReference.reference,

                            function (vsDetails) {

                                scope.vsDetails = vsDetails;
                            });
                        scope.vsReference = valueSetReference.reference;
                    }
                    break;
                case 'CodeableConcept' :
                    scope.vsReference = null;
                    delete scope.valueSet;
                    if (element.binding) {

                        //get the name of the referenced valueset in the profile - eg http://hl7.org/fhir/ValueSet/condition-code
                        var valueSetReference = RenderProfileSvc.getValueSetReferenceFromBinding(element);

                        //Assuming there is a valueset...
                        if (valueSetReference) {
                            scope.showWaiting = true;
                            results.cc = "";

                            Utilities.getValueSetIdFromRegistry(valueSetReference.reference,

                                function(vsDetails){
                                    scope.vsDetails = vsDetails;

                                    //if the current registry does have a copy of the valueset, and it's a small one, then render as
                                    //a series of radio buttons.
                                    if (scope.vsDetails && scope.vsDetails.type == 'list') {
                                        //this is a list type - ie a small number, so retrieve the entire list (expanded
                                        //but not filtered) and set the appropriate scope. This will be rendered as a set of
                                        //radio buttons...
                                        scope.showWaiting = true;
                                        // delete scope.valueSet;
                                        //scope.showWaiting = true;
                                        GetDataFromServer.getExpandedValueSet(scope.vsDetails.id).then(   //get the expanded vs
                                            function(data){
                                                //get rid of the '(qualifier value)' that is in some codes...
                                                angular.forEach(data.expansion.contains,function(item){
                                                    if (item.display) {
                                                        item.display = item.display.replace('(qualifier value)',"");
                                                    }

                                                });
                                                scope.valueSet = data;
                                            }).finally(function() {
                                                scope.showWaiting = false;
                                            }
                                        )
                                    } else {
                                        scope.showWaiting = false;
                                    }


                                });

                            scope.vsReference = valueSetReference.reference;




                        }

                    }
                    break;
                case 'code' :
                    delete scope.valueSet;
                    delete scope.vsReference;
                    if (element.binding) {
                        //retrieve the reference to the ValueSet
                        var valueSetReference = RenderProfileSvc.getValueSetReferenceFromBinding(element);



                        if (valueSetReference) {

                            //get the id of the valueset on the registry server
                            Utilities.getValueSetIdFromRegistry(valueSetReference.reference,

                                function(vsDetails){
                                    scope.vsDetails = vsDetails;

                                    if (vsDetails) {
                                        scope.showWaiting = true;
                                        //get the expansion...
                                        GetDataFromServer.getExpandedValueSet(vsDetails.id).then(
                                            function(vs){
                                                //and if the expansion worked, we're in business...
                                                if (vs.expansion) {
                                                    scope.vsExpansion = vs.expansion.contains;
                                                }


                                            }
                                        ).finally(function(){
                                            scope.showWaiting = false;
                                        });
                                    }

                                });


                            scope.vsReference = valueSetReference.reference;

                        }
                    }
                    break;
            }



        },
        cleanResource : function(treeData) {
            //remove all the elements that are of type BackboneElement but have no references to them.
            //these are elements that would be empty in the constructed resource
            var arParents =[];   //this will be all elementid's that are referencey by sometheing
            var newArray = [];      //this will be the cleaned array
            treeData.forEach(function(item){
                var parent = item.parent;
                if (arParents.indexOf(parent) == -1){
                    arParents.push(parent);
                }
            });

            //now find elements of type bbe

            treeData.forEach(function(item){
                if (item.type == 'bbe'){
                    var id = item.id;
                    if (arParents.indexOf(id) > -1) {
                        newArray.push(item);
                    }
                } else {
                    newArray.push(item);
                }

            });

            console.log(treeData)
            console.log(newArray)

            return newArray;

        }

    }

});
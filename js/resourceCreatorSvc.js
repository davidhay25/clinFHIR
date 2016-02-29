angular.module("sampleApp").service('resourceCreatorSvc', function($q,$http) {


    var currentProfile;     //the profile being used...

    var getElementDefinitionFromPath = function(path){
        //get the element definition for the path from the profile
        return currentProfile[path];
    };

    return {

        getJsonFragmentForDataType : function(dt,results) {
            //create a js object that represents a fragment of data for a resource based on the datatype...

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

                        //addValue(da,'Date',da);

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
                //console.log(v)
                fragment = {value:v};

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

            var resource = {}

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


            function addChildrenToNode(resource,node) {
                //add the node to the resource. If it has children, then recursively call
                var lnode = treeHash[node.id];
                var path = lnode.path;
                var ar = path.split('.')
                var propertyName = ar[ar.length-1];

                if (lnode.fragment) {
                    //if the 'resource' is an array, then there can be multiple elements...
                    if (angular.isArray(resource)) {
                        var o = {};
                        o[propertyName] = lnode.fragment;
                        resource.push(o)

                    } else {
                        resource[propertyName] = lnode.fragment;
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
                               // obj = {};
                                //resource[ar1[ar1.length-1]] = obj;

                                var obj;
                                //is this a repeating node? - ie an array...
                                var cr = canRepeat(ed);
                                //cr = true;
                                obj = {};
                                if (cr) {

                                    //this is a repeating element. Is there already an array for this element?
                                    //obj = {};

                                    if (! resource[pName]) {
                                        resource[pName] = [];
                                    }
                                    resource[pName].push(obj);

                                    /*
                                    if (resource[pName]) {
                                        obj = resource[pName]
                                    } else {

                                        resource[pName] = [];
                                        obj = resource[pName]
                                    }*/


                                } else {
                                    //this is a singleton...

                                    /*
                                    if (resource[pName]) {
                                        obj=resource;
                                    } else {
                                        resource[pName] = {};
                                        obj = resource[pName];
                                    }
*/
                                    resource[pName] = obj;
                                    //obj=resource;

                                    //resource[pName] = {};
                                    //obj = resource[pName];
                                }


                                addChildrenToNode(obj,child)
                            } else {

                                addChildrenToNode(resource,child)
                            }


                        } else {
                            //no, just add to the resource
                            addChildrenToNode(resource,child)
                        }



                    })
                }

            }

            addChildrenToNode(resource,treeObject);

            console.log(resource)



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


            }

    }

});
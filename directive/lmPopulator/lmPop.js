angular.module('sampleApp')
    .directive('lmPopulator', function () {
        return {
            restrict: 'EA', //E = element, A = attribute, C = class, M = comment
            scope: {
                //@ reads the attribute value, = provides two-way binding, & works with functions
                model: '=',
                selectItem : '&'
            },

            templateUrl: 'directive/lmPopulator/lmPopulator.html',
            controller: function($scope,logicalModelSvc,GetDataFromServer,$filter,supportSvc,$uibModal,
                                 appConfigSvc,$http,modalService,ResourceUtilsSvc){

                //react to change of model
                $scope.$watch(function(scope){
                    return scope.model
                },function(){
                    console.log('ping!')
                    drawTree();
                });


                var patientId ='12844';
                $scope.ResourceUtilsSvc = ResourceUtilsSvc;
                $scope.showPatientSummary = function(){
                    var html = ""
                    angular.forEach($scope.patientData,function(v,k) {
                        html +=  v.entry.length + ' ' +   k + "<br/>"
                    });
                    return html
                };

                //get sample data. I thnk this should be passed in to allow a patient to be selected...
                supportSvc.getAllData(patientId).then(
                    //returns an object hash - type as hash, contents as bundle - eg allResources.Condition = {bundle}
                    function(data) {
                        console.log(data)
                        $scope.patientData = data;
                    }
                );

                //and here's the patient...
                var url = appConfigSvc.getCurrentDataServer().url + "Patient/"+patientId;
                $http.get(url).then(
                    function(data) {
                        console.log(data)
                        $scope.patient = data.data;
                    }
                );


                $scope.refreshModel = function() {
                    var modalOptions = {
                        closeButtonText: "No, I've changed my mind",
                        actionButtonText: 'Yes, create a new form',
                        headerText: 'Refresh form',
                        bodyText: 'Are you sure you wish to refresh the form. This will delete all entries (apart from the patient) '
                    };


                    // var txt = 'There are '+ $scope.patientData[type].entry.length + ' Resources of this type. ';
                    // txt += 'Please confirm that you wish to import them all?'
                    modalService.showModal({}, modalOptions).then(function(){

                        drawTree();
                    })
                };

                //when the use wants to pre-pop from the patient data (like Condition)
                $scope.prePop = function(section){
                    //console.log(section)
                    $uibModal.open({
                        templateUrl: 'directive/lmPopulator/lmPrePop.html',
                        //size : 'lg',
                        controller : function($scope,patientData,ResourceUtilsSvc){
                            $scope.patientData = patientData;
                            $scope.ResourceUtilsSvc = ResourceUtilsSvc;     //used to display resource type summary
                            //console.log(patientData);

                            $scope.closeModal = function() {
                                $scope.$close()
                            }

                        }, resolve : {
                            patientData : function(){
                                return $scope.patientData[section.profile]
                            }
                        }
                    })

                };

                $scope.input = {};
                $scope.input.newValue = {};

                $scope.sectionInstances = [];

                //add a new instance of this section
                $scope.addSection = function(section) {
                    console.log(section)
                    var clone = angular.copy(section);
                    //id crafted to display easily in the form...
                    var id = new Date().getTime() + '.' +  $filter('dropFirstInPath')(section.code); ;
                    clone.code = 'cd'+ id;
                    
                    //set id's for the children so the values can be tracked...
                    clone.children.forEach(function (child,index) {
                        //child is a tree node...
                        child.id = id + '-'+ index;// child.id + id;
                    });
                    
                    //now find where to insert it - after this set of masterCodes
                    var pos = -1;
                    $scope.sections.forEach(function(sect,inx) {
                        if (sect.masterCode == section.masterCode) {
                            pos = inx;
                        }
                    });

                    $scope.sections.splice(pos+1,0,clone);
                    return clone;

                };

                $scope.selectSection = function(section) {
                    $scope.selectedSection = section;       //this is actually the definition
                    //console.log(section)

                    //find all the instances of this section.
                    $scope.selectedSectionInstances = [];
                    $scope.sectionInstances.forEach(function (inst) {
                        if (inst.code == section.code ) {
                            $scope.selectedSectionInstances.push(inst)
                        }
                    });

                    switch ($scope.selectedSectionInstances.length) {
                        case 0 :
                            //there are no instances yet. Create one and add to the array
                            var instance = {code:section.code,children:section.children,section: section,values: []}

                            $scope.sectionInstances.push(instance);
                            $scope.selectedInstance = instance;
                            break;
                        case 1 :
                            //there's a single instance, select it by default
                            $scope.selectedInstance = $scope.selectedSectionInstances[0]
                            break;
                        default :
                            //there's more than one instance.
                            break

                    }


//console.log($scope.selectedInstance)

                    //$scope.selectedSection = section.children;
                };

                $scope.selectChild = function(child) {
                    console.log(child)
                    $scope.selectItem()(child)

                };

                $scope.addValue = function(child,value,isMultiple){
                    child.values = child.values || []
                    if (isMultiple) {
                        child.values.push({value:value,field:child.text})

                    } else {
                        child.values[0] = {value:value,field:child.text}
                    }

                    makeDocument($scope.sections,$scope.sectionInstances)

                };

                //functions and prperties to enable the valueset viewer
                $scope.showVSBrowserDialog = {};
                $scope.showVSBrowser = function(vs) {
                    $scope.showVSBrowserDialog.open(vs);        //the open method defined in the directive...
                };
                $scope.viewVS = function(uri,child,isMultiple) {
                    $scope.currentChildForVS = {child:child,isMultiple:isMultiple};       //a bit crufty this, should really pass it to the VS browswe somehow...
                    $scope.waiting = true;
                    GetDataFromServer.getValueSet(uri).then(
                        function(vs) {
                            $scope.showVSBrowserDialog.open(vs);

                        }, function(err) {
                            alert(err)
                        }
                    ).finally (function(){
                        $scope.waiting = false;
                    });
                };

                //when a code is selected from a dialog
                $scope.codeSelected = function(code) {
                    console.log(code,$scope.currentChildForVS.child)
                    var child = $scope.currentChildForVS.child;
                    var value = code.display + " ("+ code.code + ")";

                    $scope.input.newValue[child.id] = value;       //this is where the form values are stored...
                    $scope.addValue(child,value,$scope.currentChildForVS.isMultiple)
                };


                $scope.doPrePopDEP = function() {
                    //now look for prepop of repeating resources (like Condition)
                    var ppResources = ['Condition','MedicationStatement']

                    //need to fix the sections to iterate over, as the pre-pop function adds new ones...
                    var fixedSections = angular.copy($scope.sections);
                    // $scope.sections.forEach(function (sect) {
                    fixedSections.forEach(function (sect) {
                        if (sect.profile) {
                            //so this section is mapped to a referenced resource, is it one that we can pre-populate from?
                            if (ppResources.indexOf(sect.profile) > -1) {
                                //yes, it is...
                                prePopRepeats(sect);    //perform the actual pre-pop
                            }
                        }
                    });
                }

                //construct the document model...
                var makeDocument = function(sections,instances) {
                    $scope.document = {sections:[]};

                    sections.forEach(function (section) {
                        //are there any instances of this section
                        instances.forEach(function (inst) {
                            if (inst.code == section.code) {
                                //yes (at least one). each instance is a separate section in the document.

                                var docSection = {code:inst.code,values:[],display:''}
                                $scope.document.sections.push(docSection);
                                //now pull out all the values from the instance, where there is data in them...
                                inst.children.forEach(function (child) {
                                    if (child.values && child.values.length > 0) {


                                        child.values.forEach(function (v) {
                                            if (v.value) {
                                                docSection.values.push(v)
                                            }
                                        })


                                    }
                                })
                            }
                        })
                        
                    })
                };

                //get the fhir mapping (if any) from the tree node
                function getMapping(data) {
                    var fhirPath;
                    if (data) {
                        data.forEach(function (map) {
                            if (map.identity == 'fhir') {
                                fhirPath = map.map
                            }
                        })
                    }
                    return fhirPath;
                }

                //mapped resources - like Condition & AllergyIntolerance
                $scope.prePopRepeats = function(section) {
                    var type = section.profile;         //this is actually a resoruce type...
                    console.log(type)
                    if ($scope.patientData[type]) {

                        var modalOptions = {
                            closeButtonText: "No, I've changed my mind",
                            actionButtonText: 'Yes, please add these resources to the form',
                            headerText: 'Add resources to form',
                            bodyText: 'There are '+ $scope.patientData[type].entry.length + ' Resources of this type. '
                        };


                       // var txt = 'There are '+ $scope.patientData[type].entry.length + ' Resources of this type. ';
                       // txt += 'Please confirm that you wish to import them all?'
                        modalService.showModal({}, modalOptions).then(function(){
                            //so the patient has data of this type
                            $scope.patientData[type].entry.forEach(function(entry,inx){

                                var resource = entry.resource;      //the resource from the patient data
                                console.log(inx,entry.resource)
                                //first, construct a new section for this resource

                                var newSection = $scope.addSection(section)
                                console.log(newSection);

                                //add a new instance per 'pre-popped' element to hold the values
                                var instance = {code:newSection.code,children:newSection.children,section: newSection, values: []}
                                $scope.sectionInstances.push(instance);

                                //now, work through the child elements of the 'parent' section to pull out the mapped values
                                newSection.children.forEach(function (child) {

                                    if (child.mappingPath) {
                                        console.log(child.mappingPath)

                                        var v = getPrepopValue(resource,child.mappingPath)
                                        //console.log(v)
                                        if (v) {
                                            var v1 = v[0];

                                            if (angular.isObject(v1)){
                                                v1 = v1.text;
                                            }

                                            $scope.input.newValue[child.id] = v1;       //this is where the form values are stored...
                                            $scope.addValue(child,v1,false)

                                        }

                                        //finally, add the instance
                                        //  var instance = {code:child.code,children:child.children,section: child,values: []}
                                        // $scope.sectionInstances.push(instance);


                                    }

                                })


                            })
                        })



                    }

                    console.log($scope.sectionInstances)
                }

                //return the value (if any) for this resource in this path. For now, just off the root...
                function getPrepopValue(resource,fhirPath) {

                    //always return an array...
                    if (fhirPath && resource) {
                        var ar = fhirPath.split('.');
                        if (ar.length == 2) {
                            var elementName = ar[1];
                            var v = resource[elementName];
                            if (v) {
                                if (! angular.isArray(v)) {
                                    v = [v]
                                }
                            }
                            return v;
                        }
                    }
                }

                function drawTree() {
                    console.log('----------------------------------')
                    $scope.values = {};        //a hash that contains values entered by the user
                    var treeData = logicalModelSvc.createTreeArrayFromSD($scope.model);

                    $scope.allNodes = [];  //an ordered list of all paths
                    $scope.sections = [];   //the sections (top level elements) in the model
                    var topNode = treeData[0];      //the parent node for the mpdel
                    var section;

                    var singleTopNodeSection = {masterCode:'top',code:'top',title:'top level elements',node:{},children:[]};
                    $scope.sections.push(singleTopNodeSection);

                    var ppPatient;
                    treeData.forEach(function (node) {
                        if (node.parent == topNode.id) {
                            //this is directly off the parent...

                            var type ='unknown';
                            try {
                                type = node.data.ed.type[0].code
                            } catch (ex){}//shouldn't happen...

                            if (type == 'BackboneElement' || type == 'Reference') {
                                //this has child nodes
                                //this is a new section.
                                section = {code:node.id,title:node.text,node:node,children:[]};
                                section.masterCode = node.id;      //this is used to distinguish between instances of this section

                                if (node.data.max == '*') {
                                    //this is a repeating section
                                    section.canRepeat = true;
                                }

                                //if this is a reference, then add the type so it can be pre-populated
                                if (type == 'Reference') {

                                    try {
                                        var profile =  node.data.ed.type[0].targetProfile;
                                        section.profile = $filter('referenceType')(profile)
                                    } catch (ex){}//shouldn't happen...


                                }


                                $scope.sections.push(section);
                            } else {
                                //this is a single element off the root..
                                singleTopNodeSection.children.push(node);
                            }

                           // nestedChildIds = {};
                           // nestedChildIds[node.id] = 'x';  //any nodes that have this as a parent will be inclded. This will 'flatten' the tree
                        } else {
                            if (section) {
                                //does this node (itself a child) allow multiple values

                                if (node.data.max == '*') {
                                    node.multiple = true;
                                }
                                var cloneNode = angular.copy(node);
                                cloneNode.vs = node.data.selectedValueSet
                                delete cloneNode.data;      //too much data!

                                section.children.push(cloneNode);

                                var fhirPath = getMapping(node.data.mappingFromED);
                                if (fhirPath) {
                                    //currently only works for Patient...
                                    cloneNode.mappingPath = fhirPath;

                                    //console.log(fhirPath)
                                    var v = getPrepopValue($scope.patient,fhirPath)
                                    //console.log(v)
                                    if (v) {
                                        var v1 = v[0];

                                        if (angular.isObject(v1)){
                                            v1 = v1.text;
                                        }


                                        $scope.input.newValue[cloneNode.id] = v1;       //this is where the form values are stored...
                                        $scope.addValue(cloneNode,v1,false)
                                        if (! ppPatient) {
                                            //need to add a Patient instance...
                                            ppPatient = true;
                                            var instance = {code:section.code,children:section.children,section: section,values: []}
                                            $scope.sectionInstances.push(instance);
                                        }
                                    }
                                }
                            }
                        }

                        $scope.allNodes.push(node)
                    });

                    if (1==2) {

                    }




                    makeDocument($scope.sections,$scope.sectionInstances)


                }

            }
        }
    });
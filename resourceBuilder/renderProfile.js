/*  so I don't forget http://stackoverflow.com/questions/15279244/dynamically-add-directives-on-angularjs*/

//directive to render a UI for a profile.
angular.module("sampleApp").directive( 'profileForm', function ( $compile ) {
    return {
        restrict: 'E',
        scope: {
            //allresources: '=' ,
            profile : '=',
            patient : '=',
            loadalldata : '&',
            parkresource : '&',         //called to park the resource currently being built
            updated : '&',              //called when the resource has been updated. dirty checking basically...
            //resourcetypes : '=',
            preview : '=',
            currentUser : '=',
            selectProfile : '&'
        },
        templateUrl:'/resourceBuilder/renderProfile.html',  // was    '/js/directives/cc/renderProfile.html',

        controller: function ( $rootScope, $scope, $element,SaveDataToServer,GetDataFromServer,Utilities,
                               $uibModal,RenderProfileSvc,ResourceUtilsSvc,CommonDataSvc ) {


            $scope.allResourceTypesIndexedByType = $rootScope.allResourceTypesIndexedByType;
            $scope.results = {};    //placeholder for the data...
            $scope.resource = {};   //the resource that is being created...
            //a single element has been created/updated

            $scope.newResults = {};         //stores data enteres against the path
            $scope.pathDataEntered = {};    //records that a path has had data against it - for the checkboxes......


            $scope.timingArray = RenderProfileSvc.populateTimingList();   //the list that converts from 'tds' to the timing units...

            $scope.index = 0;       //the index of the current set of child elements

            //call the validation service with the resource, displaying the outcome...
            $scope.validateResource = function() {
                $scope.validationInProgress = true;


                Utilities.validate($scope.generatedResourceForValidation).then(
                    function(oo) {
                        $scope.validateResults = {outcome:'Resource is valid.'};

                    },function(oo) {

                        if (oo.issue) {
                            delete oo.text;
                           // oo.issue.forEach(function(iss){
                             //   delete iss.diagnostics;
                           // });
                        }
                        $scope.validateResults = oo;



                    }).finally(
                        function(){
                            $scope.validationInProgress = false;
                         }
                    );


            };

            // a convenience fucntion that will park the current resource, then download the profile
            //  we're currently selected. eg creating
            $scope.parkAndBuild = function(){
                $scope.activateParkResource();

                $scope.selectProfile()($scope.resourceType);


            };

            //parks a profile (which contains all the data collected so far.). This can be re-edited, but is
            //not available for referencing (as it doesn't yet have an Id).
            $scope.activateParkResource = function() {

                $scope.parked = true;       //to prevent multiple parking...
                //see http://weblogs.asp.net/dwahlin/creating-custom-angularjs-directives-part-3-isolate-scope-and-function-parameters
                $scope.parkresource()(angular.copy($scope.profile),'mytext');

                delete $scope.profileIssues;
                delete $scope.currentlySelectedRoot;

            };

            $scope.crumbs = [];     //the breadcrimb to where the resource is being modified


            //watch for the profile to be changed by the 'host' app...
            $scope.elementList = [];
            $scope.$watch(
                function() {return $scope.profile},
                function() {

                    delete $scope.parked;
                    delete $scope.dataType;
                    delete $scope.externalSpecPage;
                    delete $scope.currentlySelectedRoot;

                    $scope.parsedProfile = false;           //indicates if the profile has been parsed - eg extensions expanded...
                    if ($scope.profile) {
                        $scope.pathDataEntered = {};        //reset the 'data entered' object
                        //by setting the resource Id in the resource, the server will update the resource if it
                        //is changed.
                        //$scope.resourceId = 'rb'+new Date().getTime();
                        $scope.showProfileIssues = false;
                        $scope.profileIssues = Utilities.profileQualityReport($scope.profile);

                    }

                    $scope.crumbs.length=0;     //the crumbtrail when navigating child elements


                    if ($scope.profile && $scope.profile.snapshot && $scope.profile.snapshot.element) {

                        //this draws the element list for the table...
                        RenderProfileSvc.parseProfile($scope.profile).then(
                            function(data) {
                                $scope.parsedElementList = data;

                                drawListOfElements(data[0]);     //parent as the root..


                            }, function(err) {
                                console.log(err)
                            }
                        );

                        //todo - will only work for base spec...
                        $scope.externalSpecPage = "http://hl7.org/fhir/" + $scope.profile.id + ".html";


                        //temp !!! drawListOfElements($scope.profile.snapshot.element[0]);     //parent as the root..

                        $scope.crumbs = [{element: $scope.profile.snapshot.element[0],
                            display:$scope.profile.snapshot.element[0].path,index:0}];  //first element is the root

                        //the currently selected root. Either the top of the element or one that has child elements...
                        $scope.currentlySelectedRoot = $scope.profile.snapshot.element[0];


                        buildResource();        //create a blank resource...
                    } else {
                        //clear the various work elements while loading the new SD
                        $scope.elementList.length=0;
                        delete $scope.resource;
                        delete $scope.element;
                    }
                }
            );



            $scope.toggleFullScreen = function() {
                alert('t')
            }

            $scope.toggleShowProfileIssues = function(){
                $scope.showProfileIssues = ! $scope.showProfileIssues;
            };

            //when the patient changes...
            $scope.$watch(
                function() {return $scope.patient},
                function() {

                    $scope.allResources = CommonDataSvc.getAllResources();



                    //clear the decks
                    delete $scope.parked;
                    delete $scope.dataType;
                    //$scope.profile = null;      //<<< todo hmmm - should this be done here?
                   // $scope.crumbs.length=0;
                    // - after preview work...$scope.currentlySelectedRoot = null;
                    buildResource();        //create a blank resource with the patient in it...

                });



            //this populates the table with the elements from the profile...
            function drawListOfElements(parent) {

                $scope.elementList.length=0;
                var arParentPath = parent.path.split('.');

                //make sure there is a value property for this element - this is where the child values will go...
                if (!parent.value) {
                    parent.key = arParentPath.join("_");

                    //for DSTU-2 the root has a * in the max field!
                    if (parent.max == '*' && (parent.path.indexOf('.')> -1)) {
                        //this node can have multiple 'sets' of values...
                        parent.value = [{}];
                        parent.selectedPage = 0;
                    } else if (parent.path.indexOf('.') !== -1 && ! parent.type) {
                        //this is for prpperties like medicationPrescription.dispense that have single, complex children

                        parent.value = [{}];
                        parent.selectedPage = 0;
                    } else {
                        parent.value = {};
                    }
                }



                $scope.parsedElementList.forEach(function(element){
                    var arPath = element.path.split('.')

                    //include in the list if the element is a direct child of the parent, or an extension of a child
                    var include = false;

                    //direct child
                    if (element.path.indexOf(parent.path) > -1  && arPath.length == arParentPath.length+1) {include = true}

                    //extension to a direct child
                    if (element.path.indexOf(parent.path) > -1  && arPath.length == arParentPath.length+2
                    && arPath[arParentPath.length+1] == 'extension') {include=true}


                    if (include) {

                   // if (arPath.length == arParentPath.length + 1 &&  element.path.indexOf(parent.path) > -1 ) {
                   // if (element.path.indexOf(parent.path) > -1) {
                        //if (element.path.substr(0,parentPath.length) == parentPath) {
                        $scope.elementList.push(element);
                    }



                })




            }


            //return true if this element is actually a child node...
            $scope.isAChildNode = function(element) {

                //DSTU-2
                if (element.type  && element.type[0].code == 'BackboneElement') {
                    return true;
                } else {
                    return false;
                }
                /*
                if (! element.type) {return true;}
                for (var i=0; i < element.type.length;i++) {
                    if (element.type[i].code == 'Element') {
                        return true;
                        break;
                    }
                }
                */
                //return false;
            };

            //when an element with child elements is selected (eg careplan.activity)

            $scope.showChild = function(element) {
                delete $scope.dataType;
                var ar = element.path.split('.');

                var display = ar[ar.length-1];


                $scope.crumbs.push({element: element,
                    display:display,index:$scope.crumbs.length});  //first element is the root

                $scope.currentlySelectedRoot = element;


                drawListOfElements(element)

            };

            $scope.selectFromCrumb = function(crumb) {
                delete $scope.dataType;

                drawListOfElements(crumb.element)
                $scope.currentlySelectedRoot = crumb.element;
                //delete everything to the right in the crumb trail
                $scope.crumbs.splice(crumb.index+1,5);

            };

            //adds a page to the currentlySelectedRoot
            $scope.addPage = function(){
                if (angular.isArray($scope.currentlySelectedRoot.value)) {
                    $scope.currentlySelectedRoot.value.push({});
                    $scope.currentlySelectedRoot.selectedPage = $scope.currentlySelectedRoot.value.length -1;
                } else {
                    alert("The current root value is not an array:"+angular.toJson($scope.currentlySelectedRoot));
                }
            };

            $scope.selectPage = function(inx){
                $scope.currentlySelectedRoot.selectedPage = inx;
            };


            //after data has been entered for an element
            $scope.saveNewDataType = function(moveToNext){

                //the actual data entry elements will depend on the datatype...
                switch ( $scope.dataType) {

                    case 'Money':
                        var qty = {value:$scope.results.money_amount,units:$scope.results.money_units};
                        var text = qty.value  + " " + qty.units;
                        addValue(qty,'Money',text,false);
                        break;

                    case 'positiveInt':
                        var qty = $scope.results.positiveint;
                        var text = $scope.results.positiveint;
                        addValue(qty,'positiveInt',text,true);
                        break;

                    case 'integer':
                        var qty = $scope.results.integer;
                        var text = $scope.results.integer;
                        addValue(qty,'integer',text,true);
                        break;

                    case 'ContactPoint' :
                        var use = $scope.results.ct.use;
                        var system = $scope.results.ct.system;
                        var value = $scope.results.ct.value;

                        var ct = {use:use,system:system,value:value};
                        addValue(ct,'ContactType',use + " "+ system + " " + value,false);
                        break;

                    case 'HumanName' :
                        var text = $scope.results.hn.text;
                        var hn = {use:$scope.results.hn.use,text:text};
                        if ($scope.results.hn.fname) {
                            hn.given=[$scope.results.hn.fname]
                        }
                        if ($scope.results.hn.lname) {
                            hn.family=[$scope.results.hn.lname]
                        }

                        addValue(hn,'HumanName',text,false);
                        break;

                    case 'Address' :
                        var use = $scope.results.addr.use;
                        var text = $scope.results.addr.text;
                        var address = {use:use,text:text};
                        addValue(address,'Address',use + " " + text,false);
                        break;


                    case 'Timing' :

                        var timing = {repeat:{}};

                        timing.repeat.duration = $scope.results.timing.duration;
                        timing.repeat.durationUnits = $scope.results.timing.units;
                        timing.repeat.frequency = $scope.results.timing.freq;
                        timing.repeat.frequencyMax = $scope.results.timing.freq_max;
                        timing.repeat.durationperiod =$scope.results.timing.period;
                        timing.repeat.periodMax = $scope.results.timing.period_max;
                        timing.repeat.periodUnits = $scope.results.timing.period_units;
                        timing.repeat.when = $scope.results.timing.when

                        var daStart = moment($scope.results.timing_start).format();
                        var daEnd = moment($scope.results.timing_end).format();


                        timing.bounds = {start: daStart,end: daEnd};

                        var text = $scope.results.timingDescription;
                        addValue(timing,'Timing',text,false);

                        break;


                    //---------

                    case 'Ratio' :

                        var num = {value:$scope.results.ratio_num_amount,units:$scope.results.ratio_num_units};
                        var denom = {value:$scope.results.ratio_denom_amount,units:$scope.results.ratio_denom_units};
                        var ratio = {numerator : num,denominator:denom};
                        var text = num.value + " " + num.units+ " over " + denom.value + " " + denom.units;
                        addValue(ratio,'Ratio',text,false);
                        break;

                    case 'Quantity' :

                        var qty = {value:$scope.results.quantity_amount,unit:$scope.results.quantity_units};

                        var text = qty.value  + " " + qty.units;
                        addValue(qty,'Quantity',text,false);


                        break;

                    case 'Range' :

                        var st = {value:$scope.results.range_amount_start,units:$scope.results.range_units};
                        var en = {value:$scope.results.range_amount_end,units:$scope.results.range_units};

                        var range = {low:st,end:en};
                        var text = "Between " + st.value + " and " + en.value + " " + st.units;
                        addValue(range,'Range',text,false);



                        break;

                    case 'Annotation' :
                        var anot = {text:$scope.results.annotation.text,authorString : $scope.results.annotation.authorString};
                        addValue(anot,'Annotation',anot.text,false);
                        break;
                    case 'Narrative' :
                        //add the narrative as a value to the root element
                        $scope.profile.snapshot.element[0].valueNarrative = $scope.results.narrative;
                        break;
                    case 'string' :
                        addValue($scope.results.string,'String',$scope.results.string,true);
                        break;
                   // case 'id' :
                     //   addValue($scope.results.id,'String',$scope.results.id);
                       // break;

                    case 'uri' :
                        addValue($scope.results.uri,'uri',$scope.results.uri,true);
                        break;

                    case 'date' :

                        var da = moment($scope.results.date_start).format("YYYY-MM-DD");

                        addValue(da,'Date',da,true);
                        break;
                    case 'dateTime' :
                        var da = moment($scope.results.date_start).format();

                        addValue(da,'DateTime',da,true);

                        break;
                    case 'instant' :

                        var time = moment($scope.results.time); //the time component. the date is set to the current date

                        var da = moment($scope.results.date_start);// the date .format();

                        time.set('year',da.get('year'))
                        time.set('month',da.get('month'))
                        time.set('date',da.get('date'))


                        addValue(time.format(),'instant',time.format(),true);

                        break;
                    case 'code' :
                        addValue($scope.results.code,'Code',$scope.results.code,true);
                        break;
                    case 'Coding' :
                        var coding = $scope.results.coding;
                        addValue(coding,'Coding',"",false);
                        break;
                    case 'CodeableConcept' :

                        var cc = $scope.results.cc;
                        var ccText = $scope.results.ccText;
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
                        if ($scope.results.resourceItem) {
                            //a real resource was selected
                            var selectedResource = $scope.results.resourceItem.resource;

                            var v = {reference: selectedResource.resourceType + "/" + selectedResource.id};



                            if ($scope.results.resourceItemText) {
                                v.display = $scope.results.resourceItemText;
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
                            if ($scope.results.resourceItemText) {
                                var v = {display: $scope.results.resourceItemText};
                                addValue(v,'Reference',$scope.results.resourceItemText);
                            }

                        }
                        break;
                    case 'Identifier' :
                        var v = {'system': $scope.results.identifier_system,value:$scope.results.identifier_value};
                        addValue(v,'Identifier',$scope.results.identifier_value,false);
                        break;
                    case 'Period' :

                        var daStart = moment($scope.results.date_start).format('YYYY-MM-DD');
                        var daEnd = moment($scope.results.date_end).format('YYYY-MM-DD');

                        //addValue(da,'Date',da);

                        var display = 'From'+ moment($scope.results.date_start).format('YYYY-MM-DD');
                        display += ' to '+ moment($scope.results.date_end).format('YYYY-MM-DD');
                        var v = {start: daStart,end: daEnd};

                        if ($scope.results.period.startOnly) {
                            display = 'From'+ moment($scope.results.date_start).format('YYYY-MM-DD');
                            v = {start: daStart};
                        }


                        addValue(v,'Period',display,false);
                        break;
                    case 'Age' :


                        //this is being set as a JSON string rather than an object - I'm not sure why...
                        var units = JSON.parse($scope.results.ageunits);
                        var v = {value: $scope.results.age.value,
                            units: units.display,
                            system:'http://ucum.org',
                            code:units.code};



                        addValue(v,'Age',$scope.results.age.value + " "+units.display,true);
                        break;
                    case 'boolean' :
                        var v = $scope.results.boolean;
                        addValue(v,'Boolean',v ? 'Yes' : 'No',true)
                        break;

                }


                buildResource();
                delete $scope.dataType;

                if (moveToNext) {
                    $scope.skip();

                }

            };


            $scope.skip = function(back) {

                if (back) {
                    if ($scope.index == 0) {
                        $scope.index = $scope.elementList.length;
                    } else {
                        $scope.index--;
                    }
                }  else {
                    if ($scope.index == $scope.elementList.length) {
                        $scope.index = 0;
                    } else {
                        $scope.index++;
                    }
                }



                var nextElement = $scope.elementList[$scope.index];

                $scope.showElement(nextElement,nextElement.type[0],$scope.index);

            };


            $scope.cancel = function() {
                delete $scope.dataType;
            };

            //add the currently entered value to the current element, respecting multiplicity...
            var addValue = function(v,dataType,text,isPrimitive) {

                if (!$scope.preview) {
                    $scope.updated()(true);       //this is an external function - so the container knows that the resource has been updated
                }


                $scope.pathDataEntered[$scope.element.path] = 'x';  //so we an add a check to the UI

                var rootElement = $scope.currentlySelectedRoot;     //the root to add this element to...
                var element = $scope.element;                   //this is the actual element that is being added
                var arPath = element.path.split('.');
                var propertyName = arPath[arPath.length-1];     //the property name is the end of the path
                var isMultiple = (element.max == '*');          //there can be multiple values for this property



                //todo - should be able to get this directly from the profile now (base element)

                //also need to check the 'original' multiplicity for this element - even if it is single,
                //it may be a multiple property that has been constrained to a single - eg identifier so still needs to be in an array...
                //so the multiplicity for the base will over-write the one in the project...
                //fortunately, in DSTU-2 that is now a property of the profile itself...


                if ($scope.profile.base && $scope.profile.base.max) {
                    if ($scope.profile.base.max != '1') {
                        isMultiple = true;
                    }
                }
/*
                if (!isMultiple && $scope.baseProfileIndexedByPath) {
                    var baseElement = $scope.baseProfileIndexedByPath[element.path];    //this is the definition for this path from the base resource
                    if (baseElement && baseElement.max == '*') {
                        isMultiple = true;
                    }
                }
*/
                var inx = rootElement.selectedPage;// 0;//$scope.selectedPage;
                if (!inx) {inx=0;}  //default to first page

                //set the key for this value.
                var key = rootElement.key + '-' +inx + '-' + propertyName;


                var valueObject = {v:v,key:key,dataType:dataType,text:text,element:element,isPrimitive: isPrimitive};







                //all extensions are stored on a property 'extension'. The resource bulder will put them in the right place
                if (element.myMeta && element.myMeta.isExtension) {
                    var dt = "value" + dataType.charAt(0).toUpperCase() + dataType.slice(1);
                    //var extension = {url:element.type[0].profile};
                    var extension = {url:element.extensionUrl};
                    extension[dt] = v;
                    valueObject.v = extension;
                    //if this is a simple extension, then the propertyName will be 'extension'. Otherwise, it will come from the url (which is a code)...
                    propertyName = 'extension';      //this will cause all extensions to be places in an array wit th ename 'extension' against tthe root

                }


                if (angular.isArray(rootElement.value)){
                    //if the parent element is an array, then it is a root that can have multiple sets of child nodes... - like careplan.participant

                    var inx = rootElement.selectedPage;// 0;//$scope.selectedPage;

                    //this will be a 'set' of values - eg multiple careplan.participant entries...
                    if (!rootElement.value[inx] ) {
                        rootElement.value[inx] = {}
                    }

                    if (isMultiple) {
                        //this is an individual 'leaf'
                        if (! rootElement.value[inx][propertyName]){
                            rootElement.value[inx][propertyName] = [];
                        }
                        rootElement.value[inx][propertyName].push(valueObject);
                    } else {
                        //this can only have a single value...
                        rootElement.value[inx][propertyName] = valueObject;

                    }

                } else {
                    //if an object, then a single of values, with the property name from the path. This is usually the root...
                    if (isMultiple || propertyName == 'extension') {
                        if (! rootElement.value[propertyName]) {
                            rootElement.value[propertyName] = []
                        }
                        //if the property itself can be multiple, then add to an array of values...
                        rootElement.value[propertyName].push(valueObject);

                    } else {
                        //if single, then there can only be one - to replace any that might already be there...
                        rootElement.value[propertyName] = valueObject
                    }
                }



            };

            //construct the resource from the profile...

            function buildResource() {

                delete $scope.validateResults;  //the outcome of a validation...

                if ($scope.profile && $scope.profile.snapshot ) {
                    ///RenderProfileSvc.newMakeResource($scope.profile,$scope.patient);
                    var SDClone = angular.copy($scope.profile);
                    delete SDClone.snapshot.element;
                    SDClone.snapshot.element = $scope.parsedElementList;

                    var resource = RenderProfileSvc.makeResource(SDClone,$scope.patient,$scope.resourceId);
                    $scope.generatedResourceForValidation = resource;

                    var json = angular.toJson(resource,true);
                    $scope.resource = json;
                }

            }


            //display the complete definition for this element...
            $scope.showElementDefinition = function(element,inx){

                delete $scope.vsReference;


                if (element.type) {
                    var type = element.type[0];     //todo - multi types!
                    //this is a coded item that may have a valueset associated with it...
                    if (type.code == 'CodeableConcept' || type.code == 'code' || type.code == 'Coding') {
                        //alert('code')

                        if (element.binding && element.binding.valueSetReference) {
                            var reference = element.binding.valueSetReference.reference;
                            $scope.vsReference = element.binding.valueSetReference.reference;
                            //alert(reference)
                        }
                    }
                }




                $scope.index = inx;
                delete $scope.dataType;

                $scope.currentElement = element;
                $scope.elementDefinition = angular.toJson(element,true);
            };


            //variables for the vs browser dialog.
            //  <vs-browser trigger="showVSBrowserDialog"></vs-browser> is defined in renderProfile.html

            $scope.showVSBrowserDialog = {};
            $scope.showVSBrowser = function(vs) {
                $scope.showVSBrowserDialog.open(vs);        //the open method defined in the directive...
            };

            //this is called when a user clicked on the 'explore valueset' button
            $scope.showVSBrowserDlg = function() {

                $scope.showWaiting = true;

                GetDataFromServer.getValueSet($scope.vsReference).then(
                    function(vs) {
                        $scope.showVSBrowserDialog.open(vs);

                       // $scope.showVSBrowser(vs)
                    }
                ).finally (function(){
                        $scope.showWaiting = false;
                });

/*
                GetDataFromServer.getValueSet($scope.vsReference,function(vs){
                    $scope.showWaiting = false;
                    if (vs) {
                        $scope.showVSBrowser(vs)
                    } else {

                        alert("I'm sorry, I was unable to load the ValueSet: "+$scope.vsReference)
                    }
                })

*/


            };

            //when a user selects a datatype..
            $scope.showElement = function(element,type,inx) {


                //check if this has a fixed value.todo - what about fixed value extensions?
                //todo - can a fixed type have more than one type allowed?
                var fixedTypePropertyName = 'fixed'+type.code;   //eg fixedCodeableConcept
                if (element[fixedTypePropertyName]) {


                    alert('This property has a fixed value which has been applied to the resource');
                    $scope.element = element;
                    addValue(element[fixedTypePropertyName],type.code,"");

                    buildResource();
                    return;
                }


                //need to determine if this is an extension...

                if (element.type && element.type.length > 0 && element.type[0].code == 'Extension' ) {      //only look at the first one...

                    if (element.type[0].profile){
                        var profile = element.type[0].profile;
                        //todo we assume that all profiles are in the profile server - not scalable...

                        var ar = profile.split('/');
                        //retrieve the profile that describes the extension...
                        var profileName = ar[ar.length - 1];
                        GetDataFromServer.getProfile(profileUrl).then(
                            function (data) {

                                //we update the profile (SD) by adding value elements, so make a clone...
                                //$scope.dynamic.profile = angular.copy(data);
                                //todo right now, we assume that each extension is a single extension - this will need enhancing...
                                var extensionElement;       //this will be the element that has the extension.
                                var extensionType;
                                if (data.snapshot.element) {
                                    for (var i = 0; i < data.snapshot.element.length; i++) {
                                        var e = data.snapshot.element[i];

                                        if (e.type) {
                                            var type1 = e.type[0].code;      //todo only the first code

                                            if (['Extension', 'id', 'uri'].indexOf(type1) == -1) {
                                                //we ignore all elements of these types. The first one that is not in the list is the one we'll use...
                                                extensionElement = e;
                                                extensionType = e.type[0];

                                                break;
                                            }
                                        }

                                    }
                                }

                                if (extensionElement) {
                                    //if extensionElement is defined, then we have found the one we wish to display.
                                    //we leave the element as the one in the main profile <<<< todo ?need to copy things like bindings across??

                                    //$scope.element = extensionElement;
                                    //$scope.parentElement = element;         //<<< the element on the SD of the resource we are creating...
                                    //$scope.dataType = angular.copy(extensionType); //create a copy so we can clear it from the scope...

                                    //copy the binding across so we set things like valuests and so forth
                                    //todo - this will need work when we expand the capabilities of extensions beyond 1 per SD...
                                    element.binding = extensionElement.binding;


                                    //also make a reference to the extension definition so we can construct a proper extension in the resource...
                                    //element.extensionDefinitionElement = extensionElement;
                                    //selectElement(extensionElement,type,inx);
                                    selectElement(element, extensionType, inx);

                                }


                            },
                            function (err) {

                            }
                        );

                    } else {
                        alert('Sorry, this is just a placeholder where Extensions can be added to the Profile')
                    }
                    return;
                } else {
                    //this is an element that is NOT an extension...
                    //$scope.element = element;
                    //$scope.dataType = angular.copy(type.code); //create a copy so we can clear it from the scope...
                    selectElement(element,type,inx);
                }

            };



            //an element has been selected from the list...
            var selectElement = function(element,type,inx) {

                $scope.index = inx;         //save the position of this element in the list for the skip & next button
                delete $scope.externalReferenceSpecPage;
                delete $scope.elementDefinition;
                delete $scope.vsExpansion;
                delete $scope.UCUMAge;
                //delete $scope.parentElement;
                $scope.results = {};                //clear any existing data...
                $scope.results.boolean = false;
                $scope.results.timing = {};         //needed for timing values...

                //this is an element that is NOT an extension...
                $scope.element = element;
                $scope.dataType = angular.copy(type.code); //create a copy so we can clear it from the scope...
                //$scope.dataType = $scope.dataType.toLowerCase();


                //by default make the separate spec page a datatype. The resource reference will override this...

                $scope.externalReferenceSpecPage = "http://hl7.org/datatypes.html#" + $scope.dataType;



                switch (type.code) {

                    case 'Period' :
                        $scope.results.period = {startOnly:false};
                        break;

                    case 'Quantity' :

                        $scope.showWaiting = true;
                        //age-units
                        GetDataFromServer.getExpandedValueSet('ucum-common').then(
                            function(vs) {

                                $scope.showWaiting = false;
                                $scope.ucum = vs.expansion.contains;
                            }, function(err){
                                $scope.showWaiting = false;
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
                                    $scope.results.identifier_system = system;
                                }
                            })
                        };


                        break;

                    case 'ContactPoint' :
                        $scope.results.ct = {use:'home',system:'mobile'};
                        break;

                    case 'HumanName' :
                        $scope.results.hn = {use:'usual'};
                        break;

                    case 'Address' :
                        $scope.results.addr = {use:'home'};
                        break;

                    case 'Narrative' :
                        //enter extra narrative
                        $scope.results.narrative = $scope.profile.snapshot.element[0].valueNarrative;
                        break;

                    case 'Annotation' :
                        //enter extra narrative
                        $scope.results.annotation = {text:'',authorString:''};
                        break;


                    case 'Age' :
                        $scope.UCUMAgeUnits = Utilities.getUCUMUnits('age');
                        break;

                    case 'Money' :
                        $scope.UCUMMoneyUnits = Utilities.getUCUMUnits('money');
                        break;

                    case 'Reference' :
                        //todo - have a service that creates a full summary of a resource - and a 1 liner for the drop down

                        delete $scope.resourceReferenceText;
                        delete $scope.profileUrlInReference;


                        
                        if (! RenderProfileSvc.isUrlaBaseResource(Utilities.getProfileFromType(type))) {
                            //if (! RenderProfileSvc.isUrlaBaseResource(type.profile[0])) {
                            //this is a reference to profile on a base resource. need to load the profile so we can figure out the base type
                            //$scope.profileUrlInReference = type.profile[0];
                            $scope.profileUrlInReference =  Utilities.getProfileFromType(type);


                            

                            //GetDataFromServer.findResourceByUrl('StructureDefinition',type.profile[0],function(profile){
                            GetDataFromServer.findResourceByUrl('StructureDefinition',Utilities.getProfileFromType(type),function(profile){
                                if (profile) {

                                    var resourceType = profile.constrainedType;//  Utilities.getResourceTypeFromUrl();
                                    $scope.resourceType = resourceType;
                                    $scope.selectedReferenceResourceType = RenderProfileSvc.getResourceTypeDefinition(resourceType) ;//  $scope.resourcetypes[resourceType];
                                    //todo -this won;t be correct...
                                    //-temp- $scope.externalReferenceSpecPage = "http://hl7.org/fhir/2015May/" + resourceType + ".html";
                                    //todo - need to pass the profilein as welll

                                    //if this is a 'reference' type resource (lkike origanization)t then don't
                                    //incldue any of thm in the list

                                    $scope.resourceList = RenderProfileSvc.getResourcesSelectListOfType(
                                        $scope.allResources,resourceType,profile.url);



                                }

                            });
                        } else {
                            //this is a base resource...

                            //DSTU-2 - type.profile is an array

                            
                            
                            //var ar = type.profile[0].split('/');
                            var ar = Utilities.getProfileFromType(type).split('/');
                            var resourceType = ar[ar.length-1];


                            //if any resource can be referenced here
                            if (resourceType== 'Resource') {
                                $scope.uniqueResources = RenderProfileSvc.getUniqueResources($scope.allResources);
                            } else {
                                delete $scope.uniqueResources;
                            }

                            //this defines the resource type - eg whether it is a reference resource rather than linked to a patient...
                            $scope.selectedReferenceResourceType = RenderProfileSvc.getResourceTypeDefinition(resourceType);//$scope.resourcetypes[resourceType];


                            $scope.resourceType = resourceType;


                            //if the resource type is one that is a 'reference' - ie doesn't link to a patient then
                            //the resurceList is empty. Otherwise populate it with the existing resources of that type for the patient
                            if ($scope.selectedReferenceResourceType.reference) {
                           // if ($scope.allResourceTypesIndexedByType[resourceType].reference) {
                                delete $scope.resourceList;
                            } else {
                                //the list of resources of this type linked to this patient that can be selected...
                                $scope.resourceList = RenderProfileSvc.getResourcesSelectListOfType(
                                    $scope.allResources,resourceType);
                            }

                        }

                        break;
                    case 'date' :
                        //$scope.results.date_start = "";
                        break;
                    case 'string' :
                        //$scope.results.string = "";
                        break;



                    case 'Coding' :
                        //returns the Url of the reference.
                        var valueSetReference = RenderProfileSvc.getUniqueResources(element);

                        $scope.results.coding = null;
                        if (valueSetReference) {
                            Utilities.getValueSetIdFromRegistry(valueSetReference.reference,

                                function (vsDetails) {

                                $scope.vsDetails = vsDetails;
                            });
                            $scope.vsReference = valueSetReference.reference;
                        }
                        break;
                    case 'CodeableConcept' :
                        $scope.vsReference = null;
                        delete $scope.valueSet;
                        if (element.binding) {

                            //get the name of the referenced valueset in the profile - eg http://hl7.org/fhir/ValueSet/condition-code
                            var valueSetReference = RenderProfileSvc.getValueSetReferenceFromBinding(element);

                            //Assuming there is a valueset...
                            if (valueSetReference) {
                                $scope.showWaiting = true;
                                $scope.results.cc = "";

                                Utilities.getValueSetIdFromRegistry(valueSetReference.reference,

                                    function(vsDetails){
                                    $scope.vsDetails = vsDetails;

                                    //if the current registry does have a copy of the valueset, and it's a small one, then render as
                                    //a series of radio buttons.
                                    if ($scope.vsDetails && $scope.vsDetails.type == 'list') {
                                        //this is a list type - ie a small number, so retrieve the entire list (expanded
                                        //but not filtered) and set the appropriate scope. This will be rendered as a set of
                                        //radio buttons...
                                        $scope.showWaiting = true;
                                       // delete $scope.valueSet;
                                        //$scope.showWaiting = true;
                                        GetDataFromServer.getExpandedValueSet($scope.vsDetails.id).then(   //get the expanded vs
                                            function(data){
                                                //get rid of the '(qualifier value)' that is in some codes...
                                                angular.forEach(data.expansion.contains,function(item){
                                                    if (item.display) {
                                                        item.display = item.display.replace('(qualifier value)',"");
                                                    }

                                                });
                                                $scope.valueSet = data;
                                            }).finally(function() {
                                                $scope.showWaiting = false;
                                            }
                                        )
                                    } else {
                                        $scope.showWaiting = false;
                                    }


                                });

                                $scope.vsReference = valueSetReference.reference;




                            }

                        }
                        break;
                    case 'code' :
                        delete $scope.valueSet;
                        delete $scope.vsReference;
                        if (element.binding) {
                            //retrieve the reference to the ValueSet
                            var valueSetReference = RenderProfileSvc.getValueSetReferenceFromBinding(element);



                            if (valueSetReference) {

                                //get the id of the valueset on the registry server
                                Utilities.getValueSetIdFromRegistry(valueSetReference.reference,

                                    function(vsDetails){
                                    $scope.vsDetails = vsDetails;

                                    if (vsDetails) {
                                        $scope.showWaiting = true;
                                        //get the expansion...
                                        GetDataFromServer.getExpandedValueSet(vsDetails.id).then(
                                            function(vs){
                                                //and if the expansion worked, we're in business...
                                                if (vs.expansion) {
                                                    $scope.vsExpansion = vs.expansion.contains;
                                                }


                                            }
                                        ).finally(function(){
                                            $scope.showWaiting = false;
                                        });
                                    }

                                });


                                $scope.vsReference = valueSetReference.reference;

                            }
                        }
                    break;
                }
            };



            $scope.SaveResourceToServer = function() {
                //todo basic validation - eg all required elements present...

                $uibModal.open({
                    templateUrl: 'resourceBuilder/confirmNewResource.html',
                    size:'lg',
                    controller: function($scope,resource,profile,user,parentScope,reloadAllResources) {


                        $scope.reloadAllResources = reloadAllResources;
                        $scope.resource = resource;
                        $scope.resourceAsString = JSON.stringify(resource,null,2);
                        $scope.outcome="";       //not saved yet...
                        $scope.saveState="before";
                        $scope.input ={};
                        $scope.issues = Utilities.validateResourceAgainstProfile(resource,profile);
                        $scope.messageAttachments = {oo:$scope.oo,resource:resource,issues:$scope.issues};
                        $scope.afterMessageSent = function() {
                            $scope.$close();
                        };


                        $scope.saveResource = function() {
                            $scope.saving = true;
                            SaveDataToServer.saveResource($scope.resource).then(
                                function(data) {
                                    //save successful...

                                    $scope.saveState='success';
                                    $scope.saving = false;
                                    $scope.outcome = "Resource saved with the ID:";


                                    //determine the id of the resource assigned by the server
                                    var serverId;
                                    serverId = data.headers('Content-Location');
                                    if (! serverId) {
                                        serverId = data.headers('Location');
                                    }



                                    $scope.outcome += serverId;

                                    $scope.allowNewConversation = true;

                                    //create an event to record the
                                    var myEvent = {type:'saveResource'};   //this is an audit event
                                    myEvent.display = "Created "+$scope.resource.resourceType + " resource";
                                    myEvent.data = {resource:$scope.resource,url:data.headers.location};
                                    myEvent.data.headers = data.headers;

                                    SaveDataToServer.sendActivityObject(myEvent);

                                    //re-load all the resources for this patient as chances are this new resource references it...
                                    //http://stackoverflow.com/questions/30244358/angularjs-directive-element-method-binding-typeerror-cannot-use-in-operator
                                    $scope.reloadAllResources()({id:serverId});
                                },
                                function(err) {
                                    console.log(err)

                                    $scope.saveState='fail';
                                    $scope.saving = false;
                                    $scope.outcome = "There was an error saving the resource: " ;
                                    $scope.oo = err.oo.body;




                                    var myEvent = {type:'saveResource'};   //this is an audit event
                                    myEvent.error = true;
                                    myEvent.display = "Error saving "+$scope.resource.resourceType + " resource";
                                    myEvent.data = {url:err.oo.url,outcome:err.oo.body,resource:$scope.resource};
                                    myEvent.data.headers = err.headers;
                                    myEvent.error = true;
                                    SaveDataToServer.sendActivityObject(myEvent)
                                }
                            )
                        }
                    },
                    resolve : {
                        resource : function() {
                            return JSON.parse($scope.resource);
                        },
                        profile : function() {
                            return $scope.profile;
                        },
                        user :function(){
                            return $scope.currentUser;
                        },
                        reloadAllResources : function() {
                            return $scope.loadalldata;     //this is the external load function...
                        },
                        parentScope : function() {
                            //needed so we can emit events from the scope - eg when a resource is rejected...
                            return $scope;
                        }
                    }
                }).result.then(function(){
                        //User clicked save

                        $scope.updated()(false);       //this is an external function, notify that contents have been saved

                },
                function(){
                    //alert('Resource not saved. You can continue editing.')
                });




            };



            //toggle the 'hiding' of non-user enterable properties
            $scope.showAllPropertiesDEP = function() {


                drawListOfElements($scope.profile.snapshot.element[0]);
            };


            //--- code for timing

            $scope.updateTimingDetails = function(item) {

                if (item && item.timing) {
                    $scope.results.timing.duration = item.timing.duration;
                    $scope.results.timing.units = item.timing.units;
                    $scope.results.timing.freq = item.timing.freq;
                    $scope.results.timing.freq_max = item.timing.freqMax;
                    $scope.results.timing.period = item.timing.period;
                    $scope.results.timing.period_max = item.timing.periodMax;
                    $scope.results.timing.period_units = item.timing.periodUnits;
                    $scope.results.timing.when = item.timing.when;
                }



            };

            //------ code for resource reference
            $scope.resourceReferenceSelected = function() {
                delete $scope.resourceReferenceText;
                delete $scope.referencedResource;
                if ($scope.results.resourceItem) {
                    var resource = $scope.results.resourceItem.resource;
                    $scope.referencedResource = angular.toJson(resource,true);
                    if (resource && resource.text) {
                        $scope.resourceReferenceText = resource.text.div;

                    }
                }
            };


            //generate a list of all the patients resources of this type.I think this is the 'any resource' support..
            $scope.resourceTypeSelected = function(resourceType){
                //this is the list of available resource to reference
                $scope.resourceList =  RenderProfileSvc.getResourcesSelectListOfType($scope.allResources,resourceType.key);
            };

            //the user wants to locate a resource on the server that is not in the cached list of resources
            //(ie it didn't have a reference to the patient - like an organization.
            $scope.searchResource = function() {

                var modalInstance = $uibModal.open({
                    templateUrl: "/modalTemplates/searchForResource.html",
                    size : 'lg',
                    controller: 'searchForResourceCtrl',
                    resolve: {
                        vo : function() {
                            return {
                                resourceType: $scope.resourceType
                            }
                        },
                        profileUrl : function() {
                            //if this is a profiled reference...
                            return $scope.profileUrlInReference;
                        }
                    }
                });

                //a promise to the resolved when modal exits.
                modalInstance.result.then(function (selectedResource) {
                    //user clicked OK
                    if (selectedResource) {


                        var v = {reference: selectedResource.resourceType + "/" + selectedResource.id};
                        v.display = ResourceUtilsSvc.getOneLineSummaryOfResource(selectedResource);
                        addValue(v,'Reference',"");
                        buildResource();
                        delete $scope.dataType;
                    }

                }, function () {
                    //no resource selected...
                });
            };

            //--------- code for CodeableConcept lookup
            $scope.vsLookup = function(text,vs) {


                if (vs) {
                    $scope.showWaiting = true;
                    return GetDataFromServer.getFilteredValueSet(vs,text).then(
                        function(data,statusCode){

                            $scope.showWaiting = false;

                            if (data.expansion && data.expansion.contains) {

                                var lst = data.expansion.contains;


/*  TEMP TODO - just for connectathon testing...
                                lst.sort(function(a,b){
                                    if (a.display > b.display) {
                                        return 1
                                    } else {
                                        return -1
                                    }
                                })
*/
                                return lst;

                                //return data.expansion.contains;


                            } else {
                                return [
                                    {'display': 'No expansion'}
                                ];
                            }


                        }, function(vo){
                            var statusCode = vo.statusCode;
                            var msg = vo.error;

                            $scope.showWaiting = false;
                            alert(msg);

                            return [
                                {'display': ""}
                            ];
                        }
                    );

                } else {
                    return [{'display':'Select the ValueSet to query against'}];
                }
            };




            //---------options for date popup

            $scope.dateOptions = {
                formatYear: 'yy',
                startingDay: 1
            };

            //$scope.formats = ['dd-MMMM-yyyy', 'yyyy/MM/dd', 'dd.MM.yyyy', 'shortDate'];
            $scope.format = 'dd-MMMM-yyyy';
            $scope.opened = false;

            $scope.dateOpen1 = function($event,opened) {
                $event.preventDefault();
                $event.stopPropagation();


                $scope[opened] = true;
            };


            //------------------
        }
    };
}),
    function($compileProvider) {
        $compileProvider.aHrefSanitizationWhitelist(/^s*(https?|ftp|blob|mailto|chrome-extension):/);
        // pre-Angularv1.2 use urlSanizationWhitelist()
    };
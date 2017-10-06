/*has been deprectde - don't call make function - expensive! */

angular.module("sampleApp")
    .controller('docBuilderCtrl',
        function ($scope,$rootScope,builderSvc,$uibModal,Utilities,GetDataFromServer,modalService) {


            var that = this;

            $scope.builderSvc = builderSvc;         //so we can access service functions from the page...
            $scope.resourcesNotInThisSection = [];  //a list of resources that aren't in this section todo make recursive based on references
            $scope.input = {}


            //---------- event handlers.........
            $rootScope.$on('addResource',function(event,resource){

                var reference =  builderSvc.referenceFromResource(resource)

                var text = "No text";
                if (resource.text && resource.text.div && resource.text.div) {
                    text = resource.text.div;
                }

                $scope.resourcesNotInThisSection.push({reference:reference,display:text})

            });

            $rootScope.$on('newSet',function(){
                delete $scope.currentSection



            })

            $rootScope.$on('resourceEdited',function(event,resource){
                //a resource has been edited - re-create the document text...
                //These are scope variables from the parent controller...
                $scope.generatedHtml = builderSvc.makeDocumentText($scope.compositionResource);
            });

            //retrieve the list of section codes. This would be replaced in a profile of course...
            var vsUrl = 'http://hl7.org/fhir/ValueSet/doc-section-codes';      //the default set of document section codes...
            var sectionCodes;
            Utilities.getValueSetIdFromRegistry(vsUrl,function(vsDetails) {

                if (vsDetails) {

                    GetDataFromServer.getExpandedValueSet(vsDetails.id).then(
                        function (vs) {
                            sectionCodes = vs.expansion.contains;
                            sectionCodes.sort(function(a,b){
                                if (a.display > b.display) {
                                    return 1;
                                } else {
                                    return -1
                                }
                            })
                            //console.log(vs);
                        }, function (err) {
                            //get an error of the LOINC code is not included in the termnology server.
                            var msg = 'The terminology service was unable to expand the Document section codes. ';
                            msg += 'This generally means that the LOINC system is not loaded into the service. ';
                            msg += "The impact is that when creating a document, you'll need to enter section type text manually. Sorry about that.";


                            //Temp - better to display this in the dociment seciotn... modalService.showModal({}, {bodyText:msg});

                            //alert(err + ' expanding ValueSet:')
                        }
                    )


                }

            })



            $scope.editSection = function(section) {
                var editing = false;
                if (section) {
                    editing = true;
                }
                $uibModal.open({
                    templateUrl: 'modalTemplates/editSection.html',
                    size: 'lg',
                    controller: function($scope,inSection,sectionCodes,appConfigSvc,$filter,
                                         builderSvc, ResourceUtilsSvc){
                        inSection = inSection || {}
                        //var that=this;
                        $scope.inSection = inSection
                        $scope.input = {};
                        $scope.mode="New";
                        $scope.sectionCodes = sectionCodes;


                        //https://github.com/netgusto/upndown
                        var und = new upndown();    //this is an ordinary library on the global scope...

                        $scope.generateText = function(sect){
                            //create text as markdown
                            var text = "";
                            sect.entry.forEach(function (entry) {
                                var ref = entry.reference;
                                if (ref) {
                                    var resource = builderSvc.resourceFromReference(ref);
                                    if (resource) {
                                        text += ResourceUtilsSvc.getOneLineSummaryOfResource(resource) +'\n';

                                        if (resource.resourceType == 'List') {
                                            if (resource.entry && resource.entry.length > 0) {
                                                resource.entry.forEach(function (entry) {
                                                    var refChild = entry.item.reference;
                                                    var resChild = builderSvc.resourceFromReference(refChild);
                                                    text += '* ' + ResourceUtilsSvc.getOneLineSummaryOfResource(resChild) +'\n';
                                                })
                                            }

                                        }
                                    }
                                }


                            })

                            console.log(text);
                            return text;



                        }

                        if (! sectionCodes) {
                            $scope.message = "The Valueset 'http://hl7.org/fhir/ValueSet/doc-section-codes' " +
                                "(which holds the list of section codes) was not found on the Terminology server" +
                                " ("+ appConfigSvc.getCurrentConformanceServer().name + "). " +
                                "You can enter text for a section, but not a code."
                        }

                        if (inSection) {
                            $scope.input.title = inSection.title;
                            if (inSection.text) {

                                $scope.input.generated = $scope.generateText(inSection);
                                //convert into markdown for display
                                var rawText = $filter('cleanTextDiv')(inSection.text.div);

                                und.convert(rawText,function(err,md){
                                    if (err) {
                                        $scope.input.text = rawText;
                                    } else {
                                        $scope.input.text = md;
                                    }
                                })

                            }



                            if (inSection.code && inSection.code.coding && inSection.code.coding.length > 0 && inSection.code.coding[0]) {       //this is a Coding...
                                sectionCodes.forEach(function (c) {
                                    if (c.code == inSection.code.coding[0].code) {
                                        $scope.input.sectionCode = c;
                                    }
                                })
                            }
                            $scope.mode="Edit";

                        }

                        $scope.selectCode = function(code){
                            if (! $scope.input.title) {
                                $scope.input.title = code.display;
                            }

                        };

                        $scope.save = function(){
                            var section = {title:$scope.input.title};
                            if ($scope.input.text) {
                                //convert from markdown to html
                                var html = $filter('markDown')($scope.input.text)
                                section.text = {status:'additional',div:$filter('addTextDiv')(html)}
                            }

                            section.entry = inSection.entry || [];
                            if ($scope.input.sectionCode) {
                                section.code = {coding:[$scope.input.sectionCode]}
                            }

                            $scope.$close(section);
                        }
                    },
                    resolve : {
                        inSection: function () {          //the default config
                            return section;
                        },
                        sectionCodes : function () {
                            return sectionCodes;
                        },
                        children : function() {



                            return $scope.selectedContainer.bundle;     //note that this is from in the parent scope
                        }
                    }
                }).result.then(function (sect) {
                    //return a section object...

                    if (editing) {
                        //only update the properties that the modal can change...
                        section.title = sect.title;
                        section.code = sect.code;
                        section.text = sect.text;

                    } else {
                        $scope.compositionResource.section = $scope.compositionResource.section || [];
                        $scope.compositionResource.section.push(sect);
                    }

                    $scope.selectSection(sect)
                    $rootScope.$emit('docUpdated',$scope.compositionResource);

                    //make document text used to invoke builderService.generateSectionText() whicg generated the section text from
                    //the references resources. Have changed that...
                    $scope.generatedHtml = builderSvc.makeDocumentText($scope.compositionResource,$scope.resourcesBundle)
                })
            };

            $scope.selectResourceFromSection = function(ref){
                //console.log(ref);
                var resource = builderSvc.resourceFromReference(ref);
                $scope.selectResource(resource);        //<<<< this is in the parent controller

            };


            $scope.moveSectionResource = function(inx,dirn) {

                var ar = $scope.currentSection.entry;
                moveThing(ar,inx, dirn);

            };

            $scope.moveSection = function(inx,dirn) {

                var ar = $scope.compositionResource.section;
                moveThing(ar,inx, dirn);

            };

            $scope.deleteSection = function(inx) {
                var modalOptions = {
                    closeButtonText: "No, I changed my mind",
                    actionButtonText: 'Yes, please delete',
                    headerText: 'Delete section',
                    bodyText: 'Are you sure you wish to delete this section? (The referenced resources will not be removed). '
                };

                modalService.showModal({}, modalOptions).then(
                    function (){
                        $scope.compositionResource.section.splice(inx,1);
                    }
                )

            };


            function moveThing(ar,inx,dirn) {

                if (dirn == 'up') {

                    var x = ar.splice(inx-1,1);  //remove the one above
                    ar.splice(inx,0,x[0]);       //and insert...


                } else {
                    var x = ar.splice(inx+1,1);  //remove the one below
                    ar.splice(inx,0,x[0]);       //and insert...
                }


                $rootScope.$emit('docUpdated',$scope.compositionResource);

                //These are all scope variables from the parent controller...
                $scope.generatedHtml = builderSvc.makeDocumentText($scope.compositionResource,$scope.selectedContainer.bundle)
            }



            $scope.addResourceToSection = function(reference) {
                //add the resource to this section and remove from the 'potentials' list

                var display = "";
                var resource = builderSvc.resourceFromReference(reference);
                if (resource) {
                    display = resource.text.div
                }

                var ent = {reference:reference.reference};
                if (display) {
                    ent.display = display
                }
                $scope.currentSection.entry.push(ent)

                $rootScope.$emit('docUpdated',$scope.compositionResource);      //generates the graph

                //remove from the 'not in this section' array...
                for (var i=0; i < $scope.resourcesNotInThisSection.length; i++) {
                    if ($scope.resourcesNotInThisSection[i].reference == reference.reference) {
                        $scope.resourcesNotInThisSection.splice(i,1);
                        break;
                    }
                }

                //These are all scope variables from the parent controller...
                $scope.generatedHtml = builderSvc.makeDocumentText($scope.compositionResource,$scope.selectedContainer.bundle)

            };


            $scope.removeReferenceFromSection = function(index) {
                var reference = $scope.currentSection.entry.splice(index,1);
                var display = "";

                var resource = builderSvc.resourceFromReference(reference[0].reference);
                if (resource) {
                    display = resource.text.div

                }

                $scope.resourcesNotInThisSection.push({reference:reference[0].reference,
                    display:display});
                $rootScope.$emit('docUpdated',$scope.compositionResource);

                //These are all scope variables from the parent controller...
                //$scope.generatedHtml = builderSvc.makeDocumentText($scope.compositionResource,$scope.resourcesBundle)
                $scope.generatedHtml = builderSvc.makeDocumentText($scope.compositionResource,$scope.selectedContainer.bundle)

            };


            $scope.selectSection = function(section) {
                $scope.currentSection = section;

                //now compile the list of resources that aren't in this section
                $scope.resourcesNotInThisSection.length = 0;
                $scope.selectedContainer.bundle.entry.forEach(function(entry){
                    var resource= entry.resource;

                    var reference =  builderSvc.referenceFromResource(resource);
                    var isInSection = false;
                    for (var i=0; i < $scope.currentSection.entry.length; i++) {

                        if ($scope.currentSection.entry[i].reference == reference) {
                            isInSection = true;
                            break;
                        }
                    }

                    if (! isInSection && resource.resourceType !== 'Composition') {
                        var refItem = {reference:builderSvc.referenceFromResource(resource)}
                        if (resource.text) {
                            refItem.display = resource.text.div;
                        } else {
                            refItem.display = resource.resourceType;
                        }

                        $scope.resourcesNotInThisSection.push(refItem)

                    }

                })


            };

            $scope.addSectionDEP = function() {
                var title = $scope.input.sectName
                delete $scope.input.sectName;     //the name given to the section
                //$scope.compositionResource is defined in parent controller (builderCtrl);
                //create a text section with a placeholder for generated text
                var text = {status : 'generated', div : "<div id='gen'>Generated text here</div>"}
                var section = {title:title,text : text, entry:[]};
                $scope.compositionResource.section = $scope.compositionResource.section || []
                $scope.compositionResource.section.push(section);
                $scope.selectSection(section)
                $rootScope.$emit('docUpdated',$scope.compositionResource);

                //These are all scope variables from the parent controller...
                //$scope.generatedHtml = builderSvc.makeDocumentText($scope.compositionResource,$scope.resourcesBundle)
                $scope.generatedHtml = builderSvc.makeDocumentText($scope.compositionResource,$scope.selectedContainer.bundle)
            }
        });
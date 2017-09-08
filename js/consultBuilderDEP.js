angular.module("sampleApp").controller('consultbuilderCtrl',
    function ($scope,$http,GetDataFromServer,modalService,appConfigSvc,resourceCreatorSvc) {


        var config = appConfigSvc.config();
        var serverBase = config.servers.data;       //the url of the data server


        $scope.allNotes = [];   //all notes - actually (at the moment) Basic resources

        $scope.resources = [];      //list of all possible resourcs
        $scope.consult = {};        //the actual consultation


        $scope.input = {};



        $scope.loadResource = function() {

            resourceCreatorSvc.loadResource().then(
                function(treeData) {
                    $('#loadTree').jstree(
                        {'core': {'multiple': false, 'data': treeData, 'themes': {name: 'proton', responsive: true}}}
                    )
                },
                function(err){
                    console.log(err);
                }
            )
/*
            return;

            var idRoot = 0;
            $http.get('http://fhirtest.uhn.ca/baseDstu2/CarePlan/14977').then(
                function(data) {
                    var resource = data.data;
                    var tree = [];
                    console.log(resource)






                    //process a single note
                    function processNode(parentPath,tree,key,element,parentId) {
                        //console.log(key,element);

                        if (angular.isArray(element)) {
                            //an array - process each one using the same parent Path & id
                            element.forEach(function(elementC) {
                                processNode(parentPath,tree,key,elementC,parentId)
                            })
                        } else if (angular.isObject(element)) {
                            //a complex value. each element needs to be processed...
                            //but first, each node needs an id
                            var nodeId = getId();
                            var nodePath =  parentPath + '.' +key;
                            console.log(nodeId,parentId,nodePath,element);
                            //and add to the tree here...


                            var newNode = {id:nodeId,parent:parentId,text:nodePath,state:{opened:false,selected:false}};
                            //newNode.data = {ed : child.ed};
                            tree.push(newNode);


                            angular.forEach(element,function(elementC, keyC){
                                //the path will depend on whether this is an object or an array

                                var pathC = parentPath + '.' +key;// + '.' + keyC;
                                if (angular.isArray(elementC)){
                                    pathC = parentPath
                                }
                                var parentId = getId();
                                processNode(pathC ,tree,keyC,elementC,nodeId); //
                            })

                        } else {
                            //a simple value
                            var path = parentPath + '.' +key;
                            var id = getId();
                            console.log(id,parentId,path,element);
                            // now add to the tree...

                            var newNode = {id:id,parent:parentId,text:path,state:{opened:false,selected:false}};
                            //newNode.data = {ed : child.ed};
                            tree.push(newNode);

                        }

                    }

                    var parent = "CarePlan";
                    var rootId = getId();
                    var item = {};      //this will be the ed for the resource root...
                    tree.push({id:rootId,parent:'#',text:parent,state:{opened:true,selected:true},path:parent,data: {ed : item}});

                    angular.forEach(resource,function(element,key){
                        processNode(parent,tree,key,element,rootId)
                    })



                    $('#loadTree').jstree(
                        {'core': {'multiple': false, 'data': tree, 'themes': {name: 'proton', responsive: true}}}
                    )


                },function(err) {
                    console.log(err);
                }
            );

            function getId() {
                idRoot++;
                return idRoot;
               // return "id"+idRoot;//
            }


*/
        };


        $http.get('artifacts/consultBuilderConfig.json').then(
            function(data) {
                //console.log(data);
                $scope.resources = data.data.config.resources;
                $scope.noteType = data.data.config.noteType;
                $scope.input.noteType = $scope.noteType[0];         //default to the first in the list
                
                var template = data.data.config.templates[0];
                //console.log(template)

                $scope.consult = {};
                $scope.template = {};

                template.sections.forEach(function(section){
                    $scope.consult[section.code] = {content:[]};    //$scope.consult.s = {content:[]};
                    $scope.template[section.code] = {display:section.display};  // $scope.template.s = {display:'Subjective'};
                })

            }
        );

        $scope.input.soapModel = 's';



        function load() {
            var url = serverBase + "Basic?code=http://clinfhir.com/fhir/NamingSystem/cf|note";      //todo add patient
            $http.get(url).then(
                function(data) {
                    //console.log(data);
                    $scope.allNotes = data.data;    //this is a bundle of Basic resources

                }
            );
        }
        load();
        
        //extract the actual note from the Basic resource
        //being lazy extracting the extensions - should really look at the url...
        $scope.showNote = function(basic) {
            var note = atob(basic.extension[0].valueString);
            $scope.historicNote = angular.fromJson(note);
            
        };

        $scope.editNote = function(){
            $scope.input.active = "1";

        };


        //save the note. Right now, we're saving is as a basic resource. Need to think about how to save real resources...
        $scope.save = function () {
            var basic = {resourceType:'Basic'}
            basic.code = {coding : [{system:'http://clinfhir.com/fhir/NamingSystem/cf',code:'note'}],text:'cfClinicalNote'};
            basic.created = moment().format();

            //this is not the correct usage for identifier - but it's convenient for now...
            basic.identifier = [];
            basic.identifier.push({system:'http://clinfhir.com/fhir/NamingSystem/cfNoteType',value:'progNote'})
            basic.extension = [];

            var extension = {url:'http://clinfhir.com/fhir/StructureDefinition/clinicalNote'};
            var json = angular.toJson($scope.consult);
            extension.valueString = btoa(json);
            basic.extension.push(extension);

            var extensionTempl = {url:'http://clinfhir.com/fhir/StructureDefinition/clinicalTemplate'};
            var jsonTempl = angular.toJson($scope.consult);
            extensionTempl.valueString = btoa(jsonTempl);
            basic.extension.push(extensionTempl);

            //the type of note
            basic.extension.push({url:"http://clinfhir.com/fhir/StructureDefinition/clinicalNoteType",valueCoding:$scope.input.noteType});
         

            $scope.showWaiting = true;
            $http.post(serverBase+'Basic',basic).then(
                function(data) {
                    alert('saved')
                },function(err) {
                    alert(angular.toJson(err));
                }
            ).finally(
                function () {
                    $scope.showWaiting = false;
                }
            )

        };
        
        //select a new resource to add to the note
        $scope.newResource = function(resource) {
            $scope.addNewResource = resource; 
        };

        //add the resource to the note
        $scope.addResource = function(resource) {
            var newResource = angular.copy($scope.addNewResource)
            newResource.text = $scope.input.text;
            
            $scope.consult[$scope.input.soapModel].content.push(newResource);

            delete $scope.input.text;
            delete $scope.addNewResource;

            console.log($scope.consult)
            $scope.dirty=true;
        };

        //when a resource is selected in the actual consult note
        $scope.showResource = function(resource,key,index) {
            //console.log(key,index);
            $scope.displayResource = resource;
            $scope.keyToRemove = key;
            $scope.indexToRemove = index;


        };

        //remove the current resource
        $scope.removeResource = function() {
            var config = {bodyText:'Are you sure you want to remove the ' + $scope.displayResource.type + " resource?"};

            var modalOptions = {
                closeButtonText: "No, I've changed my mind",
                actionButtonText: 'Yes, remove it',
                headerText: 'Remve resource',
                bodyText: 'Are you sure you want to remove the ' + $scope.displayResource.type + " resource?"
            };

            modalService.showModal({}, modalOptions).then(
                function(){
                    $scope.consult[$scope.keyToRemove].content.splice($scope.indexToRemove,1)
                }
            )
        };

        //=========================== code below not currently used  =================

        //when the user wants to add specific elements to a resource
        $scope.addNewElement = function(inp) {
            $scope.newElement = inp;
            console.log(inp)

            $scope.vsDetails = {id:"condition-code","minLength":3}


        };

        $scope.vsLookup = function(text,vs) {

            console.log(text,vs)
            if (vs) {
                $scope.showWaiting = true;
                return GetDataFromServer.getFilteredValueSet(vs,text).then(
                    function(data,statusCode){
                        if (data.expansion && data.expansion.contains) {
                            var lst = data.expansion.contains;
                            return lst;
                        } else {
                            return [
                                {'display': 'No expansion'}
                            ];
                        }
                    }, function(vo){
                        var statusCode = vo.statusCode;
                        var msg = vo.error;


                        alert(msg);

                        return [
                            {'display': ""}
                        ];
                    }
                ).finally(function(){
                    $scope.showWaiting = false;
                });

            } else {
                return [{'display':'Select the ValueSet to query against'}];
            }
        };
        
        
});
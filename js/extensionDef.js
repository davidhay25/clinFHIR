/*has been deprectde - don't call make function - expensive! */

angular.module("sampleApp").controller('extensionDefCtrl',
        function ($scope,$uibModal,appConfigSvc) {

            $scope.childElements = [];      //array of child elements
            $scope.input ={};
            $scope.input.multiplicity = 'opt';

            var config = appConfigSvc.config();

            console.log(config);

//temp
            $scope.setBinding = function() {
                $uibModal.open({
                    backdrop: 'static',      //means can't close by clicking on the backdrop.
                    keyboard: false,       //same as above.
                    templateUrl: 'modalTemplates/vsFinder.html',
                    size: 'lg',
                    controller: 'vsFinderCtrl'
                }).result.then(
                    function (vo) {
                        console.log(vo)
                    }
                )
            }



            //add a new child element...
            $scope.addChild = function () {
                $uibModal.open({

                    templateUrl: 'modalTemplates/newExtensionChild.html',

                    controller: function($scope,resourceCreatorSvc){
                        var that = this;

                        $scope.selectedDataTypes = [];     //array of selected datatypes
                        $scope.dataTypes = resourceCreatorSvc.getDataTypesForProfileCreator();


                        $scope.addDataType = function () {
                            //make sure it's not already in the list...
                            for (var i=0; i< $scope.selectedDataTypes.length; i++){
                                if ($scope.selectedDataTypes[i].description == $scope.dataType.description) {
                                    return;
                                    break;
                                }
                            }

                            $scope.selectedDataTypes.push($scope.dataType)

                        };

                        $scope.removeDT = function(inx) {
                            //console.log(inx)
                            $scope.selectedDataTypes.splice(inx,1)
                        };

                        $scope.setBinding = function(dt) {
                            console.log(dt);
                            $uibModal.open({
                                backdrop: 'static',      //means can't close by clicking on the backdrop.
                                keyboard: false,       //same as above.
                                templateUrl: 'modalTemplates/vsFinder.html',
                                size: 'lg',
                                controller: function($scope,appConfigSvc,GetDataFromServer) {
                                    //this code is all from vsFinderCtrl controller - for some reason I can't reference it from here...
                                    $scope.input = {};

                                    var config = appConfigSvc.config();
                                    $scope.termServer = config.servers.terminology;
                                    //$scope.valueSetRoot = config.servers.terminology + "ValueSet/";

                                    $scope.input.arStrength = ['extensible','extensible','preferred','example'];
                                    $scope.input.strength = 'preferred'; //currentBinding.strength;


                                    $scope.select = function() {

                                        $scope.$close({vs: $scope.input.vspreview,strength:$scope.input.strength});
                                    };

                                    //find matching ValueSets based on name
                                    $scope.search = function(filter){
                                        $scope.showWaiting = true;
                                        delete $scope.message;
                                        delete $scope.searchResultBundle;

                                        var url = $scope.termServer+"ValueSet?name="+filter;
                                        $scope.showWaiting = true;
                                        GetDataFromServer.adHocFHIRQuery(url).then(
                                            function(data){
                                                $scope.searchResultBundle = data.data;
                                                if (! data.data || ! data.data.entry || data.data.entry.length == 0) {
                                                    $scope.message = 'No matching ValueSets found'
                                                }
                                            },
                                            function(err){
                                                alert(angular.toJson(err))
                                            }
                                        ).finally(function(){
                                            $scope.showWaiting = false;
                                        })
                                    };
                                }
                            }).result.then(
                                function (vo) {
                                    //vo is {vs,strength}
                                    console.log(vo)
                                    dt.vs = vo;         //save the valueset against the datatype
                                }
                            )
                        };

                        $scope.save = function(){
                            var result = {};
                            result.code = $scope.code;
                            result.description = $scope.description;
                            result.dataTypes = $scope.selectedDataTypes;
                            $scope.$close(result);

                        }

                    }
                }).result.then(
                    //this is called when the 'add child element' has been saved
                    function(result) {
                        console.log(result)
                        $scope.childElements.push(result);

                        makeSD()



                    })


                };


            //build the StructueDefinition that describes this extension
            makeSD = function() {

                var extensionDefinition = {};

                switch ($scope.input.multiplicity) {
                    case 'opt' :
                        extensionDefinition.min=0; extensionDefinition.max = "1";
                        break;
                    case 'req' :
                        extensionDefinition.min=1; extensionDefinition.max='1';
                        break;
                    case 'mult' :
                        extensionDefinition.min=0; extensionDefinition.max='*';
                        break;
                }

                var name = $scope.input.name;       //the name of the extension
                var definition = $scope.input.name;       //the name of the extension
                var comments = $scope.input.name;       //the name of the extension
                var short = $scope.input.name;

                extensionDefinition.name = name;
                extensionDefinition.url = config.servers.conformance + name;


                extensionDefinition.snapshot = {element:[]};

                var ed1 = {path : 'Extension',name: name,short:short,definition:definition,
                    comments:comments,min:extensionDefinition.min,max:extensionDefinition.max,type:[{code:'Extension'}]};


                extensionDefinition.snapshot.push(ed1);

                //for each defined child, add the component ElementDefinition elements...
                $scope.childElements.forEach(function(ce){
                    var vo = ce;
                    vo.min = extensionDefinition.min;
                    vo.max = extensionDefinition.max;

                    extensionDefinition.snapshot.element = extensionDefinition.snapshot.element.concat(makeChildED(vo))


                })


                $scope.jsonED = extensionDefinition;    //just for display

                console.log(JSON.stringify(extensionDefinition));


            };

            //build the ElementDefinitions for a single child
            function makeChildED(vo){
                //vo.name, vo.short, vo.definition, vo.comments, vo.min, vo.max, vo.code, vo.dataTypes[code,description]
                var arED = [];
                var ed1 = {path : 'Extension.extension',name: vo.name,short:vo.short,definition:vo.definition,
                    comments:vo.comments,min:vo.min,max:vo.max,type:[{code:'Extension'}]};
                var ed2 = {path : 'Extension.extension.url',name: 'The code for this child',representation:'xmlAttr',
                    comments:vo.comments,min:1,max:1,type:[{code:'uri'}],fixedUri:vo.code};

                //the value name is 'value' + the code with the first letter capitalized, or value[x] if more than one...
                var valueName = '[x]';
                if (vo.dataTypes.length == 1) {
                    valueName = vo.dataTypes[0].code;
                    valueName = valueName[0].toUpperCase()+valueName.substr(1);
                }

                var ed3 = {path : 'Extension.value'+valueName,name: vo.name,short:vo.short,definition:vo.definition,
                    comments:vo.comments,min:vo.min,max:vo.max,type:[]};
                vo.dataTypes.forEach(function(type){
                    ed3.type.push({code:type.code})

                    if (type.vs) {
                        //this is a bound valueset
                        ed3.binding = {strength : type.vs.strength,valueSetUri:type.vs.vs.url}
                    }

                });


                arED.push(ed1);
                arED.push(ed2);
                arED.push(ed3);
                return arED;

            }


    }
);
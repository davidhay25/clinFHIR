angular.module("sampleApp")
    .controller('nzCtrl',
        function ($scope,$http,modalService,appConfigSvc,fhirUtilsSvc,v2ToFhirSvc) {

            console.log(location.host);
            $scope.input = {}
            //will update the config. We don't care if manually entered servers are lost or the default servers changed
            if (appConfigSvc.checkConfigVersion()) {
                alert('The config was updated. You can continue.')
            }

            firebase.auth().onAuthStateChanged(function(user) {

                if (user) {
                    $scope.user = user;

                    console.log(user)


                } else {
                    delete $scope.user

                }

            });


            $scope.login=function(){
                $uibModal.open({
                    backdrop: 'static',      //means can't close by clicking on the backdrop.
                    keyboard: false,       //same as above.
                    templateUrl: 'modalTemplates/login.html',
                    controller: 'loginCtrl'
                })
            };

            $scope.logout=function(){
                firebase.auth().signOut().then(function() {
                    delete $scope.user;
                    modalService.showModal({}, {bodyText: 'You have been logged out of clinFHIR'})

                }, function(error) {
                    modalService.showModal({}, {bodyText: 'Sorry, there was an error logging out - please try again'})
                });
            };


            let appRoot = location.host;

            $scope.copyExampleToClipboard = function(item) {

                //https://stackoverflow.com/questions/29267589/angularjs-copy-to-clipboard
                var copyElement = document.createElement("span");
                copyElement.appendChild(document.createTextNode(angular.toJson(item),2));
                copyElement.id = 'tempCopyToClipboard';
                angular.element(document.body.append(copyElement));

                // select the text
                var range = document.createRange();
                range.selectNode(copyElement);
                window.getSelection().removeAllRanges();
                window.getSelection().addRange(range);

                // copy & cleanup
                document.execCommand('copy');
                window.getSelection().removeAllRanges();
                copyElement.remove();

                alert("The item has been copied to the clipboard.")

            }


            let FHIRVersion =4;
            appConfigSvc.setServerType('conformance','http://home.clinfhir.com:8054/baseR4/');
            appConfigSvc.setServerType('data','http://home.clinfhir.com:8054/baseR4/');       //set the data server to the same as the conformance for the comments
            //appConfigSvc.setServerType('terminology',"http://home.clinfhir.com:8054/baseR4/");
            appConfigSvc.setServerType('terminology',"https://ontoserver.csiro.au/stu3-latest/");

            //get from the IG when everything is moved to R4...
            $scope.selectSample = function(example){
                $scope.input.selectedExample = example;
                delete $scope.input.selectedExampleJson;

                let url = example.url;
                if (url.indexOf('http') == -1) {
                    url = 'http://home.clinfhir.com:8054/baseR4/' + url;        //todo
                    $scope.input.selectedExample.url = url;     //so it displays in full on the page
                }

                $http.get(url).then(
                    function(data) {
                        $scope.input.selectedExampleJson = data.data;

                        $scope.treeData = v2ToFhirSvc.buildResourceTree(data.data);

                        drawTree();





                    },
                    function(err) {
                        console.log(err)
                    }
                )

            };


            let drawTree = function(resource) {
                //show the tree structure of this resource (adapted from scenario builder)
                $('#resourceTree').jstree('destroy');
                $('#resourceTree').jstree(
                    {'core': {'multiple': false, 'data': $scope.treeData, 'themes': {name: 'proton', responsive: true}}}
                )
            };

            $scope.collapseAll = function() {
                $scope.treeData.forEach(function (item) {
                    item.state.opened = false;
                })
                $scope.treeData[0].state.opened=true;
                drawTree();
            };

            $scope.examples = [];

            let igTypeUrl = appConfigSvc.config().standardExtensionUrl.igEntryType;

            //get the IG
            let url = appConfigSvc.getCurrentConformanceServer().url + 'ImplementationGuide/cf-artifacts-nz3';
            $scope.models = [];
            $http.get(url).then(
                function(data) {
                    $scope.IG = data.data;


                    if (FHIRVersion == 3) {
                        $scope.IG.package.forEach(function (package) {
                            //$scope.modelsByPackage[package.name] = [];      //todo - assume that name exists...
                            package.resource.forEach(function (item) {
                                let type = fhirUtilsSvc.getSingleExtensionValue(item,igTypeUrl);
                                if (type) {
                                    console.log(type.valueCode)
                                    switch (type.valueCode) {
                                        case 'logical' :
                                            //we KNOW that this field exists, and that the url is made up from the url...
                                            //('cause it's all clinFHIR controlled)
                                            let ar = item.sourceReference.reference.split('/');
                                            let id = ar[ar.length-1]
                                            let url = '/logicalModeller.html#$$$'+id;
                                            let entry = {url:url,description:item.description,name:item.name}
                                            $scope.models.push(entry)
                                            //$scope.modelsByPackage[package.name].push(entry)
                                            break;
                                    }
                                }

                            })

                        });
                    }

                    if (FHIRVersion == 4) {
                        $scope.IG.definition.resource.forEach(function (item) {
                            let type = fhirUtilsSvc.getSingleExtensionValue(item,igTypeUrl);
                            if (type) {
                                console.log(type.valueCode)
                                switch (type.valueCode) {
                                    case 'logical' :
                                        //we KNOW that this field exists, and that the url is made up from the url...
                                        //('cause it's all clinFHIR controlled)
                                        let ar = item.reference.reference.split('/');
                                        let id = ar[ar.length-1]
                                        let url = '/logicalModeller.html#$$$'+id;
                                        let entry = {url:url,description:item.description,name:item.name}
                                        $scope.models.push(entry)
                                        //$scope.modelsByPackage[package.name].push(entry)
                                        break;
                                }
                            } else {
                                //if there's no extension, then is is an example?
                                if (item.exampleCanonical || item.exampleBoolean) {
                                    //at the moment the canonical is referencing the LM - not the profile
                                    $scope.examples.push({display:item.name,url:item.reference.reference});

                                }
                            }
                        })


                    }



//console.log($scope.models)


                }, function(err) {
                    alert(angular.toJson(err));
                }
            );


            $scope.taskManager = "/taskManager.html#$$$cf-artifacts-nz3"


        }
    )
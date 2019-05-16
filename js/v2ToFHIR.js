angular.module("sampleApp")
    .controller('v2Ctrl',
        function ($scope,$uibModal,$http,v2ToFhirSvc,$timeout,modalService) {

            //$scope.conformanceServer = 'http://snapp.clinfhir.com:8081/baseDstu3/';
            $scope.conformanceServer = 'http://fhirtest.uhn.ca/baseR4/';

            $scope.engines = [{name:'Public Node-Red',api:'http://home.clinfhir.com:1880/v2/',documentation:''}];
            //$scope.engines = [{name:'Node-Red',api:'http://localhost:1880/v2/'}];
            $scope.engines.push({name:'redux-r3'});
            $scope.engines.push({name:'redux-r4'});
            $scope.engines.push({name:"{name:'Local Node-Red',api:'http://localhost:1880/v2/'}"});
            $scope.engine = $scope.engines[0];



            $scope.pasteV2 = function() {
                $uibModal.open({
                    templateUrl: 'modalTemplates/pasteText.html',
                    size: 'lg',
                    controller: function ($scope) {
                        $scope.save = function() {
                            $scope.$close($scope.text);
                        }
                    }
                }).result.then(
                    function(result) {
                        console.log(result)
                        delete $scope.fhir;
                        delete $scope.validationResult;
                        $scope.selectedMessageName = "Pasted";

                        let ar = result.split(/\n/)
                        //console.log(ar)
                        $scope.selectedMessage = result;
                        $scope.arSelectedMessage = ar;





/*
                        delete $scope.fhir;
                        delete $scope.validationResult;
                        delete $scope.selectedMessage;
                        delete $scope.arSelectedMessage;
                        $scope.selectedMessageName = name;
                        var url = 'v2/message/'+name;
                        console.log(url)
                        $http.get(url).then(
                            function(data) {
                                //console.log(data)

                                let ar = data.data.split(/\n/)
                                //console.log(ar)
                                $scope.selectedMessage = data.data;
                                $scope.arSelectedMessage = ar;

                            }

                        )

                        */



                });
            };





            $scope.test = function(){
                alert('test')
            }

            $scope.selectBundleType = function(type) {
                $scope.selectedBundleType = type;
                $http.get($scope.conformanceServer + '/StructureDefinition/'+type).then(
                    function(data) {
                        //console.log(data)
                        var ar = []
                        data.data.snapshot.element.forEach(function (element) {
                            if (element.mapping) {
                                element.mapping.forEach(function (map) {
                                    if (map.identity == 'v2') {
                                        ar.push({path:element.path,map:map.map,type:element.type})
                                    }
                                })
                            }

                        })


                        ar.sort(function(a,b){
                            if (a.map > b.map) {
                                return 1
                            } else {
                                return -1
                            }
                        });

                        $scope.map = ar;
                    },
                    function(data) {
                        console.log(data)
                    }
                );
            };

            $scope.selectIssue = function(issue){
                console.log(issue)
                //find the actual entry - a bit of a hack tttt
                if (issue.location) {
                    let g1 = issue.location[0].indexOf('[')
                    let g2 = issue.location[0].indexOf(']')
                    if (g1 && g2) {
                        let inx = issue.location[0].substr(g1+1,g2-g1-1)
                        console.log(inx -1)
                        $scope.selectedIssueEntry = $scope.fhir.entry[inx-1]
                    }
                }

            };

            $scope.selectBundleEntry = function(entry) {
                $scope.selectedBundleEntry = entry
            };

            $scope.showSubComponents = function(cell){

                var t = "";
                var ar = cell.split('^')
                ar.forEach(function (element, inx) {
                    t += '<div>'+ (inx+1) + " " +element+'</div>'
                });


                return t
            }

            $scope.convert = function(){
                //var url = "http://localhost:1880/v2/";
                let url = $scope.engine.api;
                let options = {headers:{'Content-type':'text/text'}};
                delete $scope.fhir;

                $scope.showWaiting = true;
                $http.post(url,$scope.selectedMessage,options).then(
                    function(data) {
                        console.log(data);
                        $scope.fhir = data.data;
                        getBundleTypes($scope.fhir);

                        $scope.validate(function(hashErrors){
                            let vo = v2ToFhirSvc.makeGraph($scope.fhir,hashErrors)

                            console.log(vo)
                            var container = document.getElementById('resourceGraph');
                            var options = {
                                physics: {
                                    enabled: true,
                                    barnesHut: {
                                        gravitationalConstant: -10000,
                                    }
                                }
                            };
                            $scope.chart = new vis.Network(container, vo.graphData, options);

                            $scope.chart.on("click", function (obj) {


                                var nodeId = obj.nodes[0];  //get the first node
                                var node = vo.graphData.nodes.get(nodeId);
                                $scope.selectedNode = node;

                                console.log( $scope.selectedNode)
                                $scope.$digest();
                            })


                            console.log(vo)

                        });




                    },function(err) {
                        console.log(err)
                        alert('There was an error with processing the message:' + angular.toJson(err.data))
                    }
                ).finally(
                    function () {
                        $scope.showWaiting = false;
                    }
                )
            };

            $scope.fitGraph = function(){
                $timeout(function(){
                    if ($scope.chart) {
                        $scope.chart.fit();

                    }

                },1000)

            }

            var getBundleTypes = function(bundle) {
                delete $scope.BundleTypes;
                $scope.BundleTypes = []
                let hash = {}
                bundle.entry.forEach(function(entry){
                    let type = entry.resource.resourceType;
                    if (! hash[type]) {
                        hash[type] = entry;
                        $scope.BundleTypes.push(type)
                    }

                })
            }

            $scope.validate = function(cb) {
                let url = $scope.conformanceServer + "Bundle/$validate";
                $scope.showWaiting = true;
                //delete $scope.hashErrors;
                $http.post(url,$scope.fhir).then(
                    function(data) {
                        console.log(data)
                        $scope.validationResult = data.data;


                    },function(err) {
                        console.log(err)
                        $scope.validationResult = err.data;

                    }
                ).finally(
                    function () {
                        $scope.showWaiting = false;



                        //count of errors for each resource
                        let hashErrors = {};
                        $scope.validationResult.issue.forEach(function (issue) {
                            if (issue.location) {
                                let g1 = issue.location[0].indexOf('[')
                                let g2 = issue.location[0].indexOf(']')
                                if (g1 && g2) {
                                    let inx = issue.location[0].substr(g1+1,g2-g1-1)
                                    console.log(inx -1)
                                    hashErrors[inx-1] = hashErrors[inx-1] || []
                                    hashErrors[inx-1].push(issue)
                                }
                            }
                        })

                        cb(hashErrors)


                        if ($scope.validationResult || $scope.validationResult.issue) {
                            $scope.valErrors = 0, $scope.valWarnings=0;

                            $scope.validationResult.issue.forEach(function(iss){
                                if (iss.severity == 'error') {
                                    $scope.valErrors++
                                } else {
                                    $scope.valWarnings++
                                }
                            })

                        }


                    }
                )
            };

            $http.get('/v2/messages').then(
                function(data) {
                    console.log(data)
                    $scope.messageNames = data.data;
                },
                function(data) {
                    console.log(data)
                }
            );

            $scope.selectLine = function(line,inx) {
                $scope.selectedLineInx = inx;
                $scope.arSelectedLine = line.split('|')

            };

            $scope.copyToClipboard = function(){
                if ($scope.fhir) {
                    //https://stackoverflow.com/questions/29267589/angularjs-copy-to-clipboard
                    var copyElement = document.createElement("span");
                    copyElement.appendChild(document.createTextNode(angular.toJson($scope.fhir),2));
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

                    alert("The bundle has been copied to the clipboard.")
                }

            }

            $scope.selectMessage = function(name) {
                delete $scope.fhir;
                delete $scope.validationResult;
                delete $scope.selectedMessage;
                delete $scope.arSelectedMessage;
                delete $scope.selectedLineInx;
                delete $scope.arSelectedLine;
                delete $scope.selectedLineInx;
                delete $scope.selectedNode;
                delete $scope.selectedBundleEntry;

                $scope.selectedMessageName = name;
                var url = 'v2/message/'+name;
                console.log(url)
                $http.get(url).then(
                    function(data) {
                        //console.log(data)

                        let msg = data.data.replace(/\|/g, '| ');

                        //let msg = data.data.split('|').join('| ');
                        let ar = msg.split(/\n/)

                        //let ar = data.data.split(/\n/)
                        //console.log(ar)
                        $scope.selectedMessage = data.data;
                        $scope.arSelectedMessage = ar;

                    }

                )
            };


        }
    ).filter('displayv2',function(){
    return function(v2) {
        if(v2) {
            var ar = v2.split(/\n/)
            return ar.join(/\n\n/);
        }


    }
})
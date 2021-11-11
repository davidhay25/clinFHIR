angular.module("sampleApp")
    .controller('QBuilderCtrl',
        function ($scope,$firebaseAuth,$uibModal,modalService,
                  $localStorage,$http,$timeout,QBuilderSvc,v2ToFhirSvc) {


        //http://localhost:8091/baseR4/Task?_id=57&_include=Task:patient&_include=Task:owner&_include=Task:focus
            //http://localhost:8091/baseR4/Task?_id=67&_include=Task:patient&_include=Task:owner&_include=Task:focus&_include=Task:requester
            $scope.input = {}
            $scope.form = {}

            //main data server (not necessarily the Forms Manager)
            $scope.dataServer = "http://localhost:8091/baseR4"

            $scope.multiplicities = ["0..1","0..*","1..1","1..*"]
            $scope.mult = $scope.multiplicities[0] //first time in default to optional
            $scope.qtypes = ["text","string","group","display","boolean","decimal","integer","date","dateTime","time"]
            $scope.qtypes = $scope.qtypes.concat(["url","choice","open-choice","attachment","reference","quantity"])
            $scope.input.type = $scope.qtypes[0]

            //todo - load path from server - or set Id. Really need to use query  on HealthCareService
            $scope.pathologistOrg = {resourceType:"Organization",id:'org100',name:"Path-R-Us"}
            $scope.requester = {resourceType:"Practitioner",id:"prac-ss", name:{family:"Surgeon",first:["Steve"],text:"Steve Surgeon"}}
            $scope.patient = {resourceType:"Patient",id:"8479",name:{text:"Levi Hay"}}
            $scope.specimen = {resourceType:"Specimen",id:"spec-100",
                subject:{reference:"Patient/" + $scope.patient.id},
                type:{text:"Biopsy",coding:[{code:"BX",system:"http://terminology.hl7.org/CodeSystem/v2-0487"}]}}


            //select patient - make NHI call
            $scope.selectPatient = function (nhi) {
                $scope.selectedPatient = {name:"John Doe"}
            }

            //tab 3 - get all the orders where the report has been generated
            $scope.getReportedOrders = function() {
                QBuilderSvc.getReportedOrders($scope.dataServer).then(
                    function(data) {
                        $scope.reportedOrders = data;
                    }, function (err) {
                        alert(angular.toJson(err.data))
                    }
                )
            }

            //tab 1 - place the order/request. Only called when orderTransactio is there
            $scope.placeOrder = function() {
                let url = $scope.dataServer //it's a transaction
                $http.post(url,$scope.orderTransaction).then(
                    function(){
                        alert("Order submitted")
                    }, function (err) {
                        alert(angular.toJson(err.data))
                    }
                )
            }

            //step 2 retrieve new orders that have been made
            $scope.getOrders = function() {
                QBuilderSvc.getNewOrders($scope.dataServer).then(
                    function(data) {
                        $scope.pathOrdersList = data
                    }, function(err) {
                        alert(angular.toJson(err.data))
                    }
                )
            }

            //step 2 - when the pathologist views the request
            $scope.selectPathRequest = function(item) {
                delete $scope.selectedPathOrderQR
                delete $scope.selectedPathOrderQRTable
                $scope.selectedPathOrder = item
              //  let siRef = item.sr.supportingInfo[0]
              //  let ar = siRef.split('/')
               // let siId = ar[1]
                let url = $scope.dataServer + '/' + item.sr.supportingInfo[0].reference
                $http.get(url).then(
                    function(data){
                        $scope.selectedPathOrderQR = data.data

                        //make display table
                        let ar = []
                        $scope.selectedPathOrderQR.item.forEach(function (parent) {
                            ar.push({col1:parent.text})
                            if (parent.item) {
                                parent.item.forEach(function (child) {
                                    let text = ""
                                    child.answer.forEach(function (ans) {
                                        if (ans.valueString) {
                                            text +=ans.valueString
                                        }

                                        if (ans.valueBoolean) {
                                            text += ans.valueBoolean
                                        }

                                        if (ans.valueCoding) {
                                            ans.valueCoding.forEach(function(c){
                                                text += c.code
                                            })
                                        }

                                    })
                                    ar.push({col2:child.text,col3:text})
                                })
                            }

                        })
                        $scope.selectedPathOrderQRTable = ar


                    }, function (err) {
                        alert(angular.toJson(err.data))
                    }
                )



            }

            //select the task with the report
            $scope.selectReport = function(item) {
                //need to retrieve the DiagnosticReport

                $scope.selectedPathReport = item
                if (item.task.output) {
                    let ref = item.task.output[0].valueReference.reference
                    console.log(ref)

                }


            }

            //when the pathologist creates the report...
            //Just have a DR for now, do need to update task
            $scope.sendReport = function(task,text) {
                QBuilderSvc.sendReport(task,text,$scope.dataServer).then(
                    function(){
                        $scope.getOrders()
                        alert("Report saved on server and task updated")
                    },function(err) {
                        alert(angular.toJson(err.data))
                    }
                )


            }

            //load the Q's from the server
            QBuilderSvc.getQFromServer().then(
                function (bundle) {
                    $scope.bundleQ = bundle
                    console.log($scope.bundleQ)

                    $scope.input.QEntry = $scope.bundleQ.entry[0]

                    $scope.selectQ()

                    $timeout(function(){
                    //    $scope.input.QEntry = $scope.bundleQ.entry[0]
                    },2000)

                },
                function(err) {
                    console.log(err)
                    alert('Error getting Questionnaires from server')
                }
            )

            //select Q from the server
            $scope.selectQ = function(){
                $scope.form = {}
                console.log($scope.input.QEntry)

                let Q = $scope.input.QEntry.resource
                $scope.QFromServer = Q

                //generate the tree and item hash
                let vo = QBuilderSvc.importQ(angular.toJson(Q))
                $scope.treeData = vo.treeData
                $scope.hashItem = vo.hash

                // $scope.treeData = QBuilderSvc.importQ(text)
                updateModelRepresentations()


            }

            //get tree from Q
            //let vo = QBuilderSvc.importQ()
            //$scope.treeData = vo.treeData
            //$scope.hashItem = vo.hash

            //import the Q from the textual representation of the json...
            $scope.importQ = function (text) {
               // let Q = angular.fromJson(text)
                let vo = QBuilderSvc.importQ(text)
                $scope.treeData = vo.treeData
                $scope.hashItem = vo.hash

               // $scope.treeData = QBuilderSvc.importQ(text)
                updateModelRepresentations()
            }




            //construct the QuestionnaireResponse from the form
            $scope.makeQR = function(key){

                //this is an example of specific functionality set for a linkId
                //
                if (key == 'nhi') {
                    //in reality we'd do a lookup on the nhi here
                    alert("Pretending to lookup the NHI here...")
                    $scope.form['fname'] = "John"
                    $scope.form['lname'] = "Doe"
                }


                //todo - load path from server - or set Id. Really need to use query  on HealthCareService
                $scope.pathologistOrg = {resourceType:"Organization",id:'org100',name:"Path-R-Us"}

                $scope.patient = {resourceType:"Patient",id:"8479",name:{family:"Hay",first:["Levi"],text:"Levi Hay"}}

                $scope.QR = QBuilderSvc.makeQR($scope.qResource,$scope.form,$scope.hashItem)

                $scope.QR.subject = {reference:"Patient/" + $scope.patient.id}

                //let requester = {resourceType:"Practitioner",id:"prac-ss", name:{family:"Surgeon",first:["Steve"],text:"Steve Surgeon"}}

                let serviceRequest = {resourceType: "ServiceRequest", id:'sr'+ new Date().getTime(),status:'active',
                    performer:{reference:"Organization/" + $scope.pathologistOrg.id},
                    requester:{reference:"Practitioner/" + $scope.requester.id},
                    supportingInfo:[{reference:"QuestionnaireResponse/" + $scope.QR.id}],
                    subject:{reference:"Patient/" + $scope.patient.id},
                    specimen:{reference:"Specimen/" + $scope.specimen.id}}

                let task = {resourceType: "Task", id:'tsk'+ new Date().getTime(), status:'requested',intent:"order",
                    code : {coding:{system:'http://clinfhir.com',code:'pathrequest'},text:'Path request'},
                    businessStatus :{coding:[{system:'http://clinfhir.com',code:"requestmade"}]},
                    owner:{reference:"Organization/"+$scope.pathologistOrg.id},
                    focus:{reference:"ServiceRequest/" + serviceRequest.id},
                    input: [{type:{text:"new request"},valueReference:{reference:"ServiceRequest/"+serviceRequest.id}}],
                    for:{reference:"Patient/" + $scope.patient.id}}

                let bundle = {resourceType : "Bundle",type:'transaction',entry:[]}

                bundle.entry.push({resource:$scope.QR,request:{method:'PUT',
                        url:"QuestionnaireResponse/"+$scope.QR.id}})

                bundle.entry.push({resource:task,request:{method:'POST',url:"Task"}})

                bundle.entry.push({resource:serviceRequest,request:{method:'PUT',url:"ServiceRequest/"+serviceRequest.id}})

                bundle.entry.push({resource:$scope.pathologistOrg,request:{method:'PUT',url:"Organization/"+$scope.pathologistOrg.id}})

                bundle.entry.push({resource:$scope.requester,request:{
                    method:'POST',
                    url:"Practitioner",
                    ifNoneExist:"_id="+$scope.requester.id
                    }}
                )

                bundle.entry.push({resource:$scope.patient,request:{
                        method:'POST',
                        url:"ServiceRequest",
                        ifNoneExist:"_id="+$scope.patient.id
                    }}
                )

                bundle.entry.push({resource:$scope.specimen,request:{
                        method:'POST',
                        url:"Specimen"
                    }}
                )

                $scope.orderTransaction = bundle

                //temp
                let options = {bundle:bundle,hashErrors: {},serverRoot:{}}
                drawGraph(options)


            }


            let updateModelRepresentations = function() {
                $scope.drawTree()
                makeFormDef()
                $scope.qResource =  QBuilderSvc.makeQ($scope.treeData)      //this is a cut down version of the Q
                $scope.LM = QBuilderSvc.makeLM($scope.treeData)
            }
/*
            $timeout(function(){
                updateModelRepresentations()
            },1000)

*/


            //function findPos

            //make a decorated copy for the form preview
            function makeFormDef() {
                $scope.formDef = angular.copy($scope.treeData)
                $scope.formDef.splice(0,1)      //remove the root

                //expand the valueset into the form def
                $scope.formDef.forEach(function (def) {

                    //QBuilderSvc.setItemDescription(def)


                    if (def.data && def.data.type == 'choice' && def.data.vsName) {
                        //find the valueset by name and copy into the model

                        $scope.QVS.forEach(function (vs) {
                            if (vs.name == def.data.vsName) {
                                def.data.vs = angular.copy(vs)      // here are the contents for the form preview
                            }
                        })

                    }
                })

            }



            //defined valuesets
            if ($localStorage.QVS) {
                $scope.QVS = $localStorage.QVS
            } else {
                $scope.QVS = []
                let vs = {name:'Gender',concepts:[]}
                vs.concepts.push({code:'male',system:'http://hl7.org/fhir/administrative-gender',display:'Male'})
                vs.concepts.push({code:'female',system:'http://hl7.org/fhir/administrative-gender',display:'Female'})
                vs.concepts.push({code:'other',system:'http://hl7.org/fhir/administrative-gender',display:'Other'})
                vs.concepts.push({code:'unknown',system:'http://hl7.org/fhir/administrative-gender',display:'Unknown'})

                $scope.QVS.push(vs)
                $localStorage.QVS = $scope.QVS
            }

            /*
            makeFormDef()       //formDef is an enhanced copy of treeData
            $scope.qResource =  QBuilderSvc.makeQ($scope.treeData)  //The Q resource
*/


            $scope.drawTree = function(){
                if (! $scope.treeData) {
                    return
                }

                expandAll()
                deSelectExcept()
                $('#designTree').jstree('destroy');
                let x = $('#designTree').jstree(
                    {'core': {'multiple': false, 'data': $scope.treeData, 'themes': {name: 'proton', responsive: true}}}
                ).on('changed.jstree', function (e, data) {
                    //seems to be the node selection event...

                    if (data.node) {
                        $scope.selectedNode = data.node;
                        console.log(data.node)
                    }

                    $scope.$digest();       //as the event occurred outside of angular...
                })
                console.log($scope.treeData)

            }


            function drawGraph(options) {
                let vo = v2ToFhirSvc.makeGraph(options)

                var container = document.getElementById('bundleGraph');
                var graphOptions = {
                    physics: {
                        enabled: true,
                        barnesHut: {
                            gravitationalConstant: -10000,
                        }
                    }
                };
                $scope.chart = new vis.Network(container, vo.graphData, graphOptions);

                //https://stackoverflow.com/questions/32403578/stop-vis-js-physics-after-nodes-load-but-allow-drag-able-nodes
                $scope.chart.on("stabilizationIterationsDone", function () {
                    $scope.chart.setOptions( { physics: false } );
                });

                $scope.chart.on("click", function (obj) {

                    var nodeId = obj.nodes[0];  //get the first node
                    var node = vo.graphData.nodes.get(nodeId);
                   console.log(node)
                    $scope.$digest();
                });
            }


            $scope.fitGraph = function(){
                $timeout(function(){
                    if ($scope.chart) {
                        $scope.chart.fit();
                    }
                },1000)
            };




            let deSelectExcept = function() {
                $scope.treeData.forEach(function (item) {
                    if ($scope.selectedNode && $scope.selectedNode.id && item.id == $scope.selectedNode.id) {
                        item.state.selected = true;
                    } else {
                        item.state.selected = false;
                    }

                })
            }

            let expandAll = function() {
                $scope.treeData.forEach(function (item) {
                    item.state.opened = true;
                })

            }


            function findById(id) {
                let pos = -1, node = {}
                $scope.treeData.forEach(function (item,inx) {
                    if (item.id == id) {
                        pos = inx
                        node = item
                    }
                })
                return {inx:pos,node:node}
            }



            //move nod up one
            //todo needs bounds checking - plus children too?
            $scope.moveUp = function () {
                let pos = findById($scope.selectedNode.id).inx
                if (pos > 0) {
                    $scope.treeData.splice(pos,1)
                    $scope.treeData.splice(pos-1,0,$scope.selectedNode)
                    updateModelRepresentations()
                }
            }

            $scope.moveDn = function () {
                let nodeToMove = $scope.selectedNode
                let pos = findById(nodeToMove.id).inx
                if (pos > -1 && pos < $scope.treeData.length -1) {
                    //not at bottom, so can move
                    let countOfMove = 1;    //how many nodes to move (including any children). Assume all are sequential

                    countOfMove += nodeToMove.children.length
                    /*
                    let arChildren = []     //contains the child nodes
                    if (nodeToMove.children.length > 0 ) {
                        countOfMove += nodeToMove.children.length
                        nodeToMove.children.forEach(function (childId) {
                            arChildren.push(findById(childId).node)
                        })
                    }
*/
                    //remove the node and all children
                    let ar = $scope.treeData.splice(pos,countOfMove)

                    for (var j=countOfMove-1; j > -1; j--) {
                        var nodeToInsert= ar[j];
                        $scope.treeData.splice(pos+1,0,nodeToInsert)
                    }

                    updateModelRepresentations()
                }
            }

            //move the selectedNode to the right
            $scope.moveRight = function() {
                let pos = findPosById($scope.selectedNode)

                //check the item immediatly above - it must be a group
                if (pos > 0) {
                    let parent = $scope.treeData[pos-1]
                    if (parent.data.type !== 'group') {
                        alert("The item above this one must be a group")
                        return
                    }
                    // change the parent to be the id of the parent
                    $scope.treeData[pos].parent = parent.id
                    updateModelRepresentations()

                } else {
                    alert("Item can't be at the top")
                    return
                }

            }

            $scope.addVS = function() {
                editVS()
            }

            //if VS is null, then add
            function editVS(existingVS) {

                $uibModal.open({
                    templateUrl: 'modalTemplates/q-editVS.html',
                    backdrop: 'static',
                    size:'lg',
                    controller: 'q-editVSCtrl',
                    resolve: {

                        VS : function(){
                            return existingVS
                        }
                    }
                }).result.then(
                    function(vs) {
                        //this will return the new/updates VS
                        if (vs) {
                            if (existingVS) {
                                //this is editing
                            } else {
                                //this is new
                                $scope.QVS.push(vs)
                            }
                        }
                    })

            }


            //add an item to the selected node. The datatype of the parent becomes group
            $scope.addItem = function () {

                if ($scope.input.type == 'group') {

                }

                let item = {id: "id-" + new Date().getTime(),state:{},data:{}}
                item.text = $scope.input.text;
                item.parent = $scope.selectedNode.id;
                item.data = {type:$scope.input.type,text:$scope.input.displayText};
                item.data.mult = $scope.input.mult
                if ($scope.input.type == 'choice'  && $scope.input.choiceVS){
                    item.data.vsName = $scope.input.choiceVS.name   //todo should this be the url?
                }
                $scope.treeData.push(item)


                //now set the parent to group & clear anu non=group attributes
                let ar = $scope.treeData.filter(item => item.id == $scope.selectedNode.id)

                if (ar.length == 1) {
                    ar[0].data.type = 'group'
                    delete ar[0].data.vsName
                }

                $scope.selectedNode = item

                delete $scope.input.text
                updateModelRepresentations()
                //$scope.drawTree()
                //makeFormDef()
            }

            //edit the current item
            $scope.editItem = function () {

                $uibModal.open({
                    templateUrl: 'modalTemplates/q-editItem.html',
                    backdrop: 'static',
                    //size:'lg',
                    controller: 'q-editItemCtrl',
                    resolve: {

                        item : function(){
                            return $scope.selectedNode
                        },
                        qtypes : function() {
                            return $scope.qtypes
                        },
                        multiplicities : function() {
                            return $scope.multiplicities
                        },
                        QVS : function() {
                            return $scope.QVS
                        }
                    }
                }).result.then(
                    function(item) {
                        //this will return the updated item
                        if (item) {
                            //replace it in tree data array at the same place
                            let pos = -1
                            $scope.treeData.forEach(function (line,inx) {
                                if (line.id == item.id) {
                                    pos = inx
                                }

                            })
                            if (pos > -1) {
                                $scope.treeData.splice(pos,1,item)
                                $scope.selectedNode = item
                                //makeFormDef()
                                updateModelRepresentations()
                                //$scope.drawTree()
                                //makeFormDef()
                            }



                        }
                    })




            }

            $scope.selectVS = function (vs){
                $scope.selectedVS = vs
            }

            //delete the selected item
            function deleteItem(id) {
                let pos = -1
                $scope.treeData.forEach(function (item,inx) {
                    if (item.id == id) {
                        pos = inx
                    }
                })
                if (pos > -1) {
                    $scope.treeData.splice(pos,1)
                }

            }


            $scope.deleteItem = function(){
                if (confirm("Are you sure you wish to remove this item (and any children)")) {
                    let idToDelete = $scope.selectedNode.id

                    deleteItem(idToDelete)      //delete the current node

                    //delete all the child nodes (if any)
                    //let ar = []
                    let ar = $scope.treeData.filter(item => item.parent == idToDelete)   //items where this is the parent
                    /*
                    $scope.treeData.forEach(function (item) {
                        if (item.parent == idToDelete) {
                            ar.push(item.id)
                        }
                    })
                    */
                    ar.forEach(function (item){
                        deleteItem(item.id)      //delete the child
                    })

                    //makeFormDef()
                    updateModelRepresentations()
                    //$scope.drawTree()
                    //makeFormDef()
                }

            }




        }
    );
angular.module("sampleApp")
    .controller('exampleScenarioCtrl',
        function ($scope,$localStorage) {

            $scope.input = {};

            var scenarios = $localStorage.builderBundles;
            console.log(scenarios);

            var actors = [];
            actors.push({id:'Nurse',type:'person',name:'Nurse',description:'The Nurse'});
            actors.push({id:'MAP',type:'entity',name:"Nurse's tablet",description:'The entity that receives the Administration Requests to show the nurse to perform them'});
            actors.push({id:'OP',type:'entity',name:'MAR / Scheduler',description:'The Medication Administration Order Placer'});
            actors.push({id:'MAC',type:'entity',name:'MAR / EHR',description:'The entity that receives the Medication Administration reports'});


            var entities = [];
            entities.push({id:'iherx001',type:'MedicationRequest',name:'Initial Prescription',description:"The initial prescription which describes 'medication X, 3 times per day' - the exact scheduling is not   in the initial prescription (it is left for the care teams to decide on the schedule)."})
            entities.push({id:'iherx001.001',type:'MedicationRequest',name:'Request for day 1, morning',description:'The administration request for day 1, morning'})
            entities.push({id:'iherx001.002',type:'MedicationRequest',name:'Request for day 1, lunch',description:'The administration request for day 1, lunch'})
            entities.push({id:'iherx001.003',type:'MedicationRequest',name:'Request for day 1, evening',description:'Request for day 1, evenin'})

            $scope.actors = actors;
            $scope.entities = entities;



            var example = {actor:[],instance:[],process:[]};

            $scope.treeData = makeTree();

            drawTree();

            $scope.addProcess = function(){
                var node = {id:'t'+new Date().getTime(),parent:'procParent',text:$scope.input.processName,
                    data:{myState:'proc',steps:[]}};
                $scope.treeData.push(node);
                delete $scope.selectedNode;
                drawTree();
            };

            $scope.addStep = function(){
                var step = {}
            };


            function makeTree() {
                var tree = []
                var topNode = {id:'root',parent:'#',text:'Example',data:{},state:{opened:true}};
                tree.push(topNode);

                var processParentNode = {id:'actorParent',parent:'root',text:'Actors',data:{myState:'actorParent'},state:{opened:true}}
                tree.push(processParentNode);

                actors.forEach(function (actor) {
                    var node = {id:'t'+new Date().getTime() + Math.random(),parent:'actorParent',text:actor.name,
                        data:{myState:'actor',actor:actor}};
                    tree.push(node);
                });


                var processParentNode = {id:'instParent',parent:'root',text:'Instances',data:{myState:'instanceParent'},state:{opened:true}}
                tree.push(processParentNode);

                entities.forEach(function (entity) {
                    var node = {id:'t'+new Date().getTime() + Math.random(),parent:'instParent',text:entity.name,
                        data:{myState:'entity',entity:entity}};
                    tree.push(node);
                });



                var processParentNode = {id:'procParent',parent:'root',text:'Processes',data:{myState:'procParent'},state:{opened:true}}
                tree.push(processParentNode);

                return tree;
            }



            function drawTree() {

                console.log($scope.treeData)

                //not sure about this...  logicalModelSvc.resetTreeState($scope.treeData);    //reset the opened/closed status to the most recent saved...

                $('#exTreeView').jstree('destroy');
                $('#exTreeView').jstree(
                    {'core': {'multiple': false, 'data': $scope.treeData, 'themes': {name: 'proton', responsive: true}}}
                ).on('changed.jstree', function (e, data) {
                    //seems to be the node selection event...

                    if (data.node) {
                        $scope.selectedNode = data.node;
                        console.log($scope.selectedNode.id)

                    }

                    $scope.$digest();       //as the event occurred outside of angular...

                }).on('redraw.jstree', function (e, data) {


                }).on('open_node.jstree',function(e,data){

                    //$scope.selectedNode = data.node;

/*
                    //set the opened status of the scope property to the same as the tree node so we can remember the state...
                    $scope.treeData.forEach(function(node){
                        if (node.id == data.node.id){
                            node.state.opened = data.node.state.opened;
                        }
                    });
                    $scope.$digest();
                    */
                }).on('close_node.jstree',function(e,data){

                    //set the opened status of the scope propert to the same as the tree node so we can remember the state...
                    $scope.treeData.forEach(function(node){
                        if (node.id == data.node.id){
                            node.state.opened = data.node.state.opened;
                        }
                    })
                    $scope.$digest();
                });


            }
        }
    );
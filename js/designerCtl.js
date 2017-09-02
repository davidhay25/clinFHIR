

angular.module("sampleApp")
    .controller('designerCtrl',
        function ($scope,RenderProfileSvc,designerSvc) {

            var $$ = go.GraphObject.make;  // for conciseness in defining templates

            $scope.input={}

            // define several shared Brushes
            var bluegrad = $$(go.Brush, "Linear", { 0: "rgb(150, 150, 250)", 0.5: "rgb(86, 86, 186)", 1: "rgb(86, 86, 186)" });
            var greengrad = $$(go.Brush, "Linear", { 0: "rgb(158, 209, 159)", 1: "rgb(67, 101, 56)" });
            var redgrad = $$(go.Brush, "Linear", { 0: "rgb(206, 106, 100)", 1: "rgb(180, 56, 50)" });
            var yellowgrad = $$(go.Brush, "Linear", { 0: "rgb(254, 221, 50)", 1: "rgb(254, 182, 50)" });
            var lightgrad = $$(go.Brush, "Linear", { 1: "#E6E6FA", 0: "#FFFAF0" });

            var itemsHash = {};

            RenderProfileSvc.getAllStandardResourceTypes().then(
                function(lst) {
                    $scope.resources = lst

                }
            );


            $scope.showType = function(type){
                console.log(type)
                var url = "http://hl7.org/fhir/StructureDefinition/"+type.name;
                $scope.profileUrl = url;
                designerSvc.getProfileElements(url).then(
                    function(data) {
                        $scope.input.elements = data.elements;
                        $scope.input.label = type.name;
                        console.log(data)
                    }, function(err) {
                        console.log(err)
                    }
                )
            }


            $scope.addElementDEP = function(text){
                var key = $scope.selectedItem.key;

                var node = myDiagram.findNodeForKey(key);

                console.log(node.part.data)

                var model = myDiagram.model;
                model.startTransaction("Add line");
                node.part.data.items.push({name:text, iskey:false, myData:{type:"Reference"}})

                model.commitTransaction("Add line");
                myDiagram.model = new go.GraphLinksModel($scope.nodeDataArray, $scope.linkDataArray);

            };

            $scope.updateNode = function () {


                var key = $scope.selectedItem.key;

                var node = myDiagram.findNodeForKey(key);

                console.log(node.part.data)

                var model = myDiagram.model;
                model.startTransaction("Update Model");

                node.part.data.items.length = 0;

                $scope.selectedItem.elements.forEach(function (ed) {
                    if (ed.meta.include) {
                        node.part.data.items.push({name:ed.meta.displayPath, iskey:false, myData: ed})
                    }
                });

                model.commitTransaction("Update Model");
                myDiagram.model = new go.GraphLinksModel($scope.nodeDataArray, $scope.linkDataArray);

                delete $scope.input.displayMode;

            }

            $scope.addNode = function() {

                var data = {url:$scope.profileUrl,elements:$scope.input.elements}

                var newNode = designerSvc.newNode($scope.input.label,data);
                $scope.nodeDataArray.push(angular.copy(newNode));

                /*
                var key = "NewNode" + new Date().getTime();

               // var item = {key:key,resourceType:'Condition'};
                var newNode = {key:key,items:[]}
                newNode.myData = {element:$scope.input.elements,key:key};
                newNode.myTitle = $scope.input.label;
                $scope.input.elements.forEach(function (ed) {
                   if (ed.meta.include) {
                       newNode.items.push({name:ed.meta.displayPath, iskey:false, myData: ed})
                   }
                });
                //newNode.items.push({name:"newNodeID", iskey:true, figure:"lineH", font:"18px serif",myData:"test" })
                //newNode.items.push({name:"subject", iskey:false, myData:{type:"Reference"} })
                itemsHash[key] = newNode;
                $scope.nodeDataArray.push(angular.copy(newNode))
                console.log(newNode);
                var link = { from: key, to: "Suppliers", text: "author", toText: "1"};
                $scope.linkDataArray.push(link)


                */
                var link = { from: newNode.myData.key, to: "Suppliers", text: "author", toText: "1"};
                $scope.linkDataArray.push(link)

                myDiagram.model = new go.GraphLinksModel($scope.nodeDataArray, $scope.linkDataArray);

                delete $scope.input.displayMode;



            }

            $scope.nodeDataArray = [
                { key: "Products",
                    items: [ { name: "ProductID", iskey: true, figure: "Decision", color: yellowgrad },
                        { name: "ProductName", iskey: false, figure: "Cube1", color: bluegrad },
                        { name: "SupplierID", iskey: false, figure: "Decision", color: "purple" },
                        { name: "CategoryID", iskey: false, figure: "Decision", color: "purple" } ] },
                { key: "Suppliers",
                    items: [ { name: "SupplierID", iskey: true, figure: "Decision", color: yellowgrad },
                        { name: "CompanyName", iskey: false, figure: "Cube1", color: bluegrad },
                        { name: "ContactName", iskey: false, figure: "Cube1", color: bluegrad },
                        { name: "Address", iskey: false, figure: "Cube1", color: bluegrad } ] },
                { key: "Categories",
                    items: [ { name: "CategoryID", iskey: true, figure: "Decision", color: yellowgrad },
                        { name: "CategoryName", iskey: false, figure: "Cube1", color: bluegrad },
                        { name: "Description", iskey: false, figure: "Cube1", color: bluegrad },
                        { name: "Picture", iskey: false, figure: "TriangleUp", color: redgrad } ] },
                { key: "Order Details",
                    items: [ { name: "OrderID", iskey: true, figure: "Decision", color: yellowgrad },
                        { name: "ProductID", iskey: true, figure: "Decision", color: yellowgrad },
                        { name: "UnitPrice", iskey: false, figure: "MagneticData", color: greengrad },
                        { name: "Quantity", iskey: false, figure: "MagneticData", color: greengrad },
                        { name: "Discount", iskey: false, figure: "MagneticData", color: greengrad } ] },
            ];
            $scope.linkDataArray = [
                { from: "Products", to: "Suppliers", text: "0..N", toText: "1" },
                { from: "Products", to: "Categories", text: "0..N", toText: "1" },
                { from: "Order Details", to: "Products", text: "0..N", toText: "1" }
            ];

            var myDiagram =
                $$(go.Diagram, "myDiagramDiv",  // must name or refer to the DIV HTML element
                    {
                        initialContentAlignment: go.Spot.Center,
                        allowDelete: false,
                        allowCopy: false,

                        layout: $$(go.ForceDirectedLayout),
                        "undoManager.isEnabled": true
                    });

            myDiagram.animationManager.isEnabled = false;

            function init() {

                // the template for each attribute in a node's array of item data
                var itemTempl =
                    $$(go.Panel, "Horizontal",
                        /*$$(go.Shape, - hide the picture
                            { desiredSize: new go.Size(10, 10) },
                            new go.Binding("figure", "figure"),
                            new go.Binding("fill", "color")),
*/
                        $$(go.TextBlock,
                            { stroke: "#333333",
                                font: "14px sans-serif" },
                            new go.Binding("text", "name"))
                    );

                // define the Node template, representing an entity
                myDiagram.nodeTemplate =
                    $$(go.Node, "Auto",  // the whole node panel
                        { selectionAdorned: true,
                            resizable: true,
                            layoutConditions: go.Part.LayoutStandard & ~go.Part.LayoutNodeSized,
                            fromSpot: go.Spot.AllSides,
                            toSpot: go.Spot.AllSides,
                            isShadowed: true,
                            shadowColor: "#C5C1AA" },
                        new go.Binding("location", "location").makeTwoWay(),
                        // whenever the PanelExpanderButton changes the visible property of the "LIST" panel,
                        // clear out any desiredSize set by the ResizingTool.
                        new go.Binding("desiredSize", "visible", function(v) { return new go.Size(NaN, NaN); }).ofObject("LIST"),
                        // define the node's outer shape, which will surround the Table
                        $$(go.Shape, "Rectangle",
                            { fill: lightgrad, stroke: "#756875", strokeWidth: 3 }),
                        $$(go.Panel, "Table",
                            { margin: 8, stretch: go.GraphObject.Fill },
                            $$(go.RowColumnDefinition, { row: 0, sizing: go.RowColumnDefinition.None }),
                            // the table header
                            $$(go.TextBlock,
                                {
                                    row: 0, alignment: go.Spot.Center,
                                    margin: new go.Margin(0, 14, 0, 2),  // leave room for Button
                                    font: "bold 16px sans-serif"
                                },
                                new go.Binding("text", "myTitle")),  //was key
                            // the collapse/expand button
                            $$("PanelExpanderButton", "LIST",  // the name of the element whose visibility this button toggles
                                { row: 0, alignment: go.Spot.TopRight }),
                            // the list of Panels, each showing an attribute
                            $$(go.Panel, "Vertical",
                                {
                                    name: "LIST",
                                    row: 1,
                                    padding: 3,
                                    alignment: go.Spot.TopLeft,
                                    defaultAlignment: go.Spot.Left,
                                    stretch: go.GraphObject.Horizontal,
                                    itemTemplate: itemTempl
                                },
                                new go.Binding("itemArray", "items"))
                        )  // end Table Panel
                    );  // end Node

                // define the Link template, representing a relationship
                myDiagram.linkTemplate =
                    $$(go.Link,  // the whole link panel
                        {
                            selectionAdorned: true,
                            layerName: "Foreground",
                            reshapable: true,
                            routing: go.Link.AvoidsNodes,
                            corner: 5,
                            curve: go.Link.JumpOver
                        },
                        $$(go.Shape,  // the link shape
                            { stroke: "#303B45", strokeWidth: 2.5 }),
                        $$(go.TextBlock,  // the "from" label
                            {
                                textAlign: "center",
                                font: "bold 14px sans-serif",
                                stroke: "#1967B3",
                                segmentIndex: 0,
                                segmentOffset: new go.Point(NaN, NaN),
                                segmentOrientation: go.Link.OrientUpright
                            },
                            new go.Binding("text", "text")),
                        $$(go.TextBlock,  // the "to" label
                            {
                                textAlign: "center",
                                font: "bold 14px sans-serif",
                                stroke: "#1967B3",
                                segmentIndex: -1,
                                segmentOffset: new go.Point(NaN, NaN),
                                segmentOrientation: go.Link.OrientUpright
                            },
                            new go.Binding("text", "toText"))
                    );

                myDiagram.model = new go.GraphLinksModel($scope.nodeDataArray, $scope.linkDataArray);
            }

            init();
            myDiagram.addDiagramListener("ObjectSingleClicked",function(ev){
                $scope.input.displayMode='edit'
                console.log(ev.subject.part.data)
                delete $scope.selectedItem;
                var key = ev.subject.part.data.key


                var node = myDiagram.findNodeForKey(key);


                $scope.selectedItem = ev.subject.part.data.myData ;// itemyDatasHash[key];


                console.log($scope.selectedItem)

                $scope.$digest()
            })



        })




/*
var $$ = go.GraphObject.make;
var myDiagram =
    $$(go.Diagram, "myDiagramDiv",
        {
            initialContentAlignment: go.Spot.Center, // center Diagram contents
            "undoManager.isEnabled": true // enable Ctrl-Z to undo and Ctrl-Y to redo
        });

var myModel = $$(go.Model);
// in the model data, each node is represented by a JavaScript object:
myModel.nodeDataArray = [
    { key: "Alpha" },
    { key: "Beta" },
    { key: "Gamma" }
];
myDiagram.model = myModel;

*/
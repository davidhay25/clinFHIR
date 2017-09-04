

angular.module("sampleApp")
    .controller('designerCtrl',
        function ($scope,RenderProfileSvc,designerSvc) {

            var $$ = go.GraphObject.make;  // for conciseness in defining templates

            $scope.input={}
            $scope.input.showAllFields = true;      //show all the possible fields from the SD

            $scope.nodeDataArray = [];
            $scope.linkDataArray = [];

            var lightgrad = $$(go.Brush, "Linear", { 1: "#E6E6FA", 0: "#FFFAF0" });

            $scope.createLink = function(item,ed,toKey) {


                var fromKey = item.key;
                var path = ed.path;     //where from
                var link = designerSvc.addReference($scope.nodeDataArray,fromKey,path,toKey);
                $scope.linkDataArray.push(link)
                myDiagram.model = new go.GraphLinksModel($scope.nodeDataArray, $scope.linkDataArray);

            };

            $scope.deleteLink = function(references,inx,ref){

                console.log(ref);

                for (var i=0; i<  $scope.linkDataArray.length-1;i++){
                    var link = $scope.linkDataArray[i];
                    if (link.from == ref.from && link.to ==ref.to && link.path == ref.path) {

                        var key = link.key;


                        myDiagram.startTransaction("Update Model");

                        var obj = myDiagram.model.getKeyForLinkData(key);
                        myDiagram.model.removeLinkData(obj);
                        myDiagram.commitTransaction("Update Model");





/*
                        references.splice(inx,1)
                        console.log('del ' + i);
                        $scope.linkDataArray.splice(i,1);
                        myDiagram.model = new go.GraphLinksModel($scope.nodeDataArray, $scope.linkDataArray);
                        */
                        break;
                    }
                }


                return





            };

            RenderProfileSvc.getAllStandardResourceTypes().then(
                function(lst) {
                    $scope.resources = lst
                }
            );


            $scope.showType = function(type){

                var url = "http://hl7.org/fhir/StructureDefinition/"+type.name;
                $scope.profileUrl = url;
                designerSvc.getProfileElements(url).then(
                    function(data) {
                        $scope.input.elements = data.elements;
                        $scope.input.label = type.name;


                        //create a node as the 'possible references' function required a node. we don't do anything with it...
                        var item = {url:url,elements:data.elements};     //my data about this node
                        var tempNode = designerSvc.newNode(type,item);

                        designerSvc.possibleReferences(tempNode,$scope.nodeDataArray);


                    }, function(err) {
                        console.log(err)
                    }
                )
            }




            $scope.updateNode = function () {
                var key = $scope.selectedItem.key;
                var node = myDiagram.findNodeForKey(key);
                var myData = node.part.data;
                var model = myDiagram.model;
                model.startTransaction("Update Model");
                myData.items.length = 0;

                $scope.selectedItem.elements.forEach(function (ed) {
                    if (ed.meta.include) {
                        myData.items.push({name:ed.meta.displayPath, iskey:false, myData: ed})
                    }
                });

                model.commitTransaction("Update Model");
                myDiagram.model = new go.GraphLinksModel($scope.nodeDataArray, $scope.linkDataArray);
                delete $scope.input.displayMode;
            }

            $scope.addNode = function() {

                var item = {url:$scope.profileUrl,elements:$scope.input.elements};     //my data about this node
                var newNode = designerSvc.newNode($scope.input.label,item);             //the new node

                $scope.nodeDataArray.push(angular.copy(newNode));                       //add to the array of nodes

                var link = { from: newNode.myData.key, to: "Suppliers", text: "author", toText: "1"};
                $scope.linkDataArray.push(link)

                myDiagram.model = new go.GraphLinksModel($scope.nodeDataArray, $scope.linkDataArray);   //rebuild diagram

                delete $scope.input.displayMode;

            };




            /*
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
*/
            var myDiagram =
                $$(go.Diagram, "myDiagramDiv",  // must name or refer to the DIV HTML element
                    {
                        initialContentAlignment: go.Spot.Center,
                        allowDelete: false,
                        allowCopy: false,

                        layout: $$(go.ForceDirectedLayout),
                        "undoManager.isEnabled": false
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
                        $$(go.Shape,   // the arrowhead
                            { toArrow: "Triangle", fill: '#303B45' }),
                        $$(go.Shape, "RoundedRectangle",  { height:18,fill: "yellow", stroke: "gray" }),
                        $$(go.TextBlock,                        // this is a Link label
                            new go.Binding("text", "text"))

                       /* $$(go.TextBlock,  // the "from" label
                            {
                                textAlign: "center",
                                font: "bold 14px sans-serif",
                                stroke: "#303B45",
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
                            new go.Binding("text", "toText"))*/
                    );

               // myDiagram.model = new go.GraphLinksModel($scope.nodeDataArray, $scope.linkDataArray);
            }

            init();
            designerSvc.initGraph($scope.nodeDataArray, $scope.linkDataArray).then(
                function(data) {
                    $scope.nodeDataArray = $scope.nodeDataArray.concat(data.nodes)
                    $scope.linkDataArray = $scope.linkDataArray.concat(data.links)
                    myDiagram.model = new go.GraphLinksModel($scope.nodeDataArray, $scope.linkDataArray);

                },
                function (err) {
                    console.log(err)
                }
            );



            myDiagram.addDiagramListener("ObjectSingleClicked",function(ev){
                $scope.input.displayMode='edit';
                console.log(ev.subject.part.data)
                delete $scope.selectedItem;

                designerSvc.possibleReferences(ev.subject.part.data,$scope.nodeDataArray);


                //This is my data tyep
                $scope.selectedItem = ev.subject.part.data.myData ;


                console.log($scope.selectedItem)

                $scope.$digest()
            })



        });




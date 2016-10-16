angular.module("sampleApp")
    //this returns config options. At the moment it is for servers...
    //also holds the current patient and all their resources...
    //note that the current profile is maintained by resourceCreatorSvc

    .service('logicalModelSvc', function($http,$q,appConfigSvc) {

        return {
            getModelHistory : function(id){
                var url = appConfigSvc.getCurrentConformanceServer().url + "StructureDefinition/" + id + "/_history";
                return $http.get(url);
            },
            createTreeArrayFromSD : function(sd) {
                //generate the array that the tree uses from the StructureDefinition
                var arTree = []
                if (sd && sd.snapshot && sd.snapshot.element) {

                    sd.snapshot.element.forEach(function(ed){
                        var path = ed.path;     //this is always unique in a logical model...
                        var arPath = path.split('.');
                        var item = {}
                        item.id = path;
                        item.text = arPath[arPath.length -1];   //the text will be the last entry in the path...
                        item.data = {};
                        if (arPath.length == 1) {
                            //this is the root node
                            item.parent = '#';
                            item.data.isRoot = true;
                            //now set the header data...
                            item.data.header = {};
                            
                            item.data.header.name = sd.name;
                            item.data.header.title = sd.title;
                            item.data.header.purpose = sd.purpose;

                        } else {
                            //otherwise the parent can be inferred from the path
                            arPath.pop();//
                            item.parent = arPath.join('.');
                        }
                        item.state = {opened:true};     //default to fully expanded

                        item.data.path = path;
                        item.data.name = item.text;
                        item.data.short = ed.short;
                        item.data.description = ed.definition;
                        item.data.type = ed.type;
                        item.data.min = ed.min;
                        item.data.max = ed.max;

                        item.data.comments = ed.comments;

                        //note that we don't retrieve the complete valueset...
                        if (ed.binding) {
                            item.data.selectedValueSet = {strength:ed.binding.strength};
                            item.data.selectedValueSet.vs = {url:ed.binding.valueSetUri};
                            item.data.selectedValueSet.vs.name = ed.binding.description;
                        }
                        /*
                        if (data.selectedValueSet) {
                            ed.binding = {strength:data.selectedValueSet.strength};
                            ed.binding.valueSetUri = data.selectedValueSet.vs.url;
                            ed.binding.description = 'The bound valueset'

                        }
                        */


                        arTree.push(item);
                    });


                }
                return arTree;
            },
            makeSD : function(scope,treeData) {
                var header = treeData[0].data.header || {}      //the first node has the header informatiion

                var sd = {resourceType:'StructureDefinition'};
                sd.id = scope.rootName;
                sd.url = "http://fhir.hl7.org.nz/test";
                sd.name = header.name;
                sd.title = header.title;
                sd.status='draft';
                sd.date = moment().format();
                sd.purpose = header.purpose;
                sd.description = header.description;

                sd.publisher = scope.input.publisher;
                //at the time of writing (Oct 12), the implementaton of stu3 varies wrt 'code' & 'keyword'. Remove this eventually...
                sd.identifier = [{system:"http://clinfhir.com",value:"author"}]
                sd.keyword = [{system:'http://fhir.hl7.org.nz/NamingSystem/application',code:'clinfhir'}]


                sd.kind='logical';
                sd.abstract=false;
                sd.baseDefinition ="http://hl7.org/fhir/StructureDefinition/Element";
                sd.type = scope.rootName;
                sd.derivation = 'specialization';

                //newResource.type = type;
                //newResource.derivation = 'constraint';
                //newResource.baseDefinition = "http://hl7.org/fhir/StructureDefinition/"+type;
                //newResource.keyword = [{system:'http://fhir.hl7.org.nz/NamingSystem/application',code:'clinfhir'}]


                sd.snapshot = {element:[]};

                treeData.forEach(function(item){
                    var data = item.data;
                    // console.log(data);
                    var ed = {}
                    ed.id = data.path;
                    ed.path = data.path;
                    ed.short = data.short;
                    ed.definition = data.description || 'definition';
                    ed.min=data.min;
                    ed.max = data.max;
                    ed.comments = data.comments;

                    if (data.type) {
                        ed.type = [];
                        data.type.forEach(function(typ) {
                            ed.type.push({code:typ.code});
                        })
                    }

                    ed.base = {
                        path : ed.path, min:0,max:'1'
                    };

                    if (data.selectedValueSet) {
                        ed.binding = {strength:data.selectedValueSet.strength};
                        ed.binding.valueSetUri = data.selectedValueSet.vs.url;
                        ed.binding.description = data.selectedValueSet.vs.name;

                    }

                    sd.snapshot.element.push(ed)
                });

                return sd;
            },
            reOrderTree : function(treeData) {
                //ensure the elements in the tree array are sorted by parent / child
                var arTree = [treeData[0]];

                findChildren(treeData[0].data.path,treeData[0].id,arTree);
                return arTree;


                function findChildren(parentPath,parentId,arTree) {
                    treeData.forEach(function(node){
                        if (node.parent == parentId) {
                            arTree.push(node);
                            var childPath = parentPath + '.' + node.data.name;
                            //console.log(childPath);
                           // node.data.path = childPath;
                            findChildren(childPath,node.id,arTree)
                        }
                    })

                }

            }

            }
        });
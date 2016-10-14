angular.module("sampleApp")
    //this returns config options. At the moment it is for servers...
    //also holds the current patient and all their resources...
    //note that the current profile is maintained by resourceCreatorSvc

    .service('logicalModelSvc', function($http,$q) {

        return {
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
                            item.data.header.short = sd.short;
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
                    ed.min=0;
                    ed.max = '1';
                    if (data.type) {
                        ed.type = [];
                        data.type.forEach(function(typ) {
                            ed.type.push({code:typ.code});
                        })
                    }

                    ed.base = {
                        path : ed.path, min:0,max:'1'
                    };

                    sd.snapshot.element.push(ed)
                });

                return sd;
            }

            }
        })
angular.module("sampleApp")
    //this returns config options. At the moment it is for servers...
    //also holds the current patient and all their resources...
    //note that the current profile is maintained by resourceCreatorSvc

    .service('logicalModelSvc', function($http,$q,appConfigSvc,GetDataFromServer,Utilities,$filter,
                                         $localStorage) {

        var currentUser;
        var elementsToIgnore =['id','meta','implicitRules','language','text','contained','extension','modifierExtension'];
        var hashTreeState = {};   //save the state of the tree wrt expanded nodes so it can be restored after editing

        //VS that are too large to expand in full...
        var expansionBlacklist = [];
        expansionBlacklist.push('http://hl7.org/fhir/ValueSet/observation-codes');

        //the url to the extension in an element...
        var simpleExtensionUrl = appConfigSvc.config().standardExtensionUrl.simpleExtensionUrl

        var dataTypes = [];
        $http.get("artifacts/dt.json").then(
            function(data) {
                dataTypes = data.data;
            }
        );

        //logical models (like Dosage). Might extend to complex datatypes for expanding logical models later on...
        var fhirLM = {};
        $http.get("artifacts/fhirLM.json").then(
            function(data) {
                fhirLM = data.data;

            }
        );

        if (!String.prototype.startsWith) {
            String.prototype.startsWith = function(search, pos) {
                return this.substr(!pos || pos < 0 ? 0 : +pos, search.length) === search;
            };
        }

        //set the first segment of a path to the supplied value. Used when determining differneces from the base type
        String.prototype.setFirstSegment = function(firstSegment) {
            var ar = this.split('.');
            ar[0] = firstSegment;
            return ar.join('.')
        };
        String.prototype.getLastSegment = function() {
            var ar = this.split('.');
            return ar[ar.length-1]
        };

        //get the mapping for this logicam model element to FHIR...
        var getFhirMapping = function(map) {
            var fhirPath;
            if (map) {
                map.forEach(function (mp) {
                    if (mp.identity == 'fhir') {
                        fhirPath =  mp.map;
                    }
                })
            }
            return fhirPath;
        };

        //common function for decorating various properties of the treeview when building form an SD. Used when creating a new one & editing
        function decorateTreeView(item,ed) {
            //decorate the type elements...
            if (item.data.type) {
                item.data.type.forEach(function(typ){
                    if (typ.code) {
                        var first = typ.code.substr(0,1);
                        if (first == first.toUpperCase()) {
                            typ.isComplexDT = true;
                        }
                    }
                })

            }
            var ar = ed.path.split('.')
            //don't set for the first element (oterwise the colour cascades down....

            let li_attr;

            if (ed.min == 1 && ar.length > 1) {
                item['li_attr'] = {class: 'elementRequired'};
                li_attr += " elementRequired"
            } else {
                li_attr += " elementOptional"
                item['li_attr'] = {class: 'elementOptional'};
            }

            if (ed.fixedString) {
                li_attr += " elementFixed"
                item['li_attr'] = {class: 'elementFixed'};
            }


            if (item.data.edStatus == 'excluded') {
                item['a_attr'] = { "style": "text-decoration: line-through" }
            } else if (item.data.edStatus !== 'included') {
                item['a_attr'] = { "style": "text-decoration: underline dotted red" }
            } else {
                item['a_attr'] = {};
            }


            if (li_attr) {
                item['li_attr'] = {class: li_attr};
            }

        }

        //a cache of patient references by type. todo may need to enhance this when supporting profiles...
        var patientReferenceCache = {};
        var multiple = {}       //todo hack!!!  multiple paths...
        multiple['Composition.section.entry'] = "*";



        return {

            createDataModel : function(treeData) {
                //determine type (Heading, group, item for each id
                let hash = {}
                treeData.forEach(function(item){
                    //console.log(item)
                    let id = item.id
                    hash[id] = {path:item.id,type:'element',item:item};   //by default, assume it's an element...
                    //if (item.data && item.data.ed && item.data.ed.type && item.data.ed.type.length > 0) {
                       // let dt = item.data.ed.type[0].code
                    if (item.data && item.data.type && item.data.type.length > 0) {
                        let dt = item.data.type[0].code
                        if (dt == "Heading") {
                            hash[id].type = "heading"
                        } else {
                            //OK, so it's not a heading. check to see if its parent is a grouper
                            let ar = id.split('.')
                            ar.splice(-1,1)
                            let parentPath = ar.join('.')
                            let parent = hash[parentPath]
                            if (parent) {
                                if (parent.type !== 'heading') {
                                    parent.type = 'grouper'
                                }
                            }
                        }
                    }
                });

                let ar = [];
                Object.keys(hash).forEach(function (key) {
                    //let element = {path:key,type:}
                    ar.push(hash[key])
                    // iteration code
                });
                return (ar)

                //console.log(hash)

            },
            insertReferencedLM : function(tree) {
                let deferred = $q.defer()

                let arQuery = [], hashResults = {}
                tree.forEach(function (item,inx) {

                    let path = item.item.id;

                    var data = item.item.data;
                    if (data.type) {
                        let  type = data.type[0]
                        console.log(type);
                        if (type.code == 'Reference') {
                           // console.log()
                            if (type.targetProfile && type.targetProfile.length > 0) {
                                let url = type.targetProfile[0];
                                if (url.indexOf('://hl7.org/fhir') == -1 ) {
                                    //don't try to retrrieve core profiles
                                    arQuery.push(
                                        $http.get(url).then(
                                            function(data) {
                                                //hashResults[url] = {path: path, SD: data.data};
                                                hashResults[inx] = {path: path, SD: data.data};
                                            },
                                            function(err){
                                                console.log('error loading SD ' +url)
                                            })
                                    )
                                }

                            }
                        }

                    }


                });

                $q.all(arQuery).then(
                    function(data){

                        console.log(hashResults)


                        Object.keys(hashResults).forEach(function(k) {
                            let SD = hashResults[k].SD
                            let path = hashResults[k].path;     //this is the insert point on the original
                            let insertRoot = path;


                            //locate the insert point in the array
                            let insertIndex = tree.length;      //default to the end of the tree
                            for (var i =0; i < tree.length; i++) {
                                if (tree[i].path == path ) {
                                    insertIndex = i;
                                    console.log('inserting at ' + insertIndex)
                                    break;
                                }
                            }


                            console.log(SD)

                            SD.snapshot.element.forEach(function (element, inx) {

                                //ignore the first element of the inserted LM
                                if (inx > 0) {
                                    //this is a minimal object to insert - just that info needed for the document...
                                    //need to create a compatible path
                                    let pathFromInsert = element.path;
                                    //now make the 'root' of this path the same as the insert point in the host
                                    let ar = pathFromInsert.split('.')
                                    ar[0] = insertRoot

                                    let newPath =  ar.join('.')
                                    //now make the parent...
                                    ar.pop();
                                    let parentPath = ar.join('.')

                                    let data = {}
                                    data.description = element.definition;
                                    data.short = element.short;
                                    data.path = newPath;// element.path;
                                    data.type = element.type;
                                    let insrt = {item : {parent:parentPath, data: data}}
                                    insrt.path = newPath;
                                    insrt.id = newPath; //element.path;
                                    insrt.item.id = newPath; //path;

                                    insertIndex ++
                                    tree.splice(insertIndex,0,insrt)

                                   // tree.push(insrt)
                                }


                            })


                        });

/*
                        tree.sort(function(a,b){
                            if (a.number > b.number) {
                                return -1
                            } else {
                                return 1
                            }
                        })
*/


                        deferred.resolve(tree)





                    }
                )



                return deferred.promise;

            },
            makeDDNumbers : function(tree) {

                let hashChildren = {}
                let hashId = {}
                let rootId;
                tree.forEach(function (item,ctr) {
                    hashId[item.item.id] = item;
                    if (ctr == 0) {
                        rootId = item.item.id
                    }

                    hashChildren[item.item.parent] = hashChildren[item.item.parent] || []

                    let p = hashChildren[item.item.parent]
                    p.push(item.item.id)
                });


                //will set the numbers
                process(rootId,"",1);

                //copy the numbers to the item
                tree.forEach(function (item,ctr) {
                    let id = item.item.id
                    let ele = hashId[id]
                    if (ele) {
                        if (ctr > 0) {
                            if (ele.number) {
                                item.item.data = item.item.data || {}
                                item.item.data.number = ele.number.substr(2)
                            } else {
                                console.log("element " + id + " has no number",ele)
                            }

                        }
                    } else {
                        console.log("Cant't find "+ id + " in the element cache")
                    }
                   // console.log(id,ele)


                });
/*
                tree.sort(function(a,b){
                    if (a.number > b.number) {
                        return 1
                    } else {
                        return -1
                    }
                })
*/

                return;



                function process(id,base,ctr) {

                    //set the number on the item
                    let item = hashId[id];
                    let thisNumber;
                    if (base) {
                        thisNumber = base + '.' + ctr;
                    } else {
                        thisNumber = ctr
                    }


                    item.number = thisNumber


                    //does this element have children?
                    if (hashChildren[id]) {
                        //yes - process each child
                        hashChildren[id].forEach(function (childId,ctr) {
                            process(childId,thisNumber,ctr+1)
                        })
                    }


                }

            },
            generateDDHTML : function(inTree) {
                let deferred = $q.defer()
                let that = this;

                let tree = angular.copy(inTree)     //we may wind up changing the tree...

                this.insertReferencedLM(tree).then(
                    function(data) {
                        console.log(tree)
                        that.makeDDNumbers(tree);   //adds hierarchical numbering to the tree items...
                        console.log(tree)
                       // let deferred = $q.defer();
                        let arDoc = [];
                        tree.forEach(function (item) {
                            let branch = item.item;
                            var data = branch.data;

                            var path = data.path;     //this is the
                            var arPath = path.split('.');
                            if (arPath.length == 1) {
                                //this is the first node. Has 'model level' data so don't display......

                            } else {


                                //this is an 'ordinary node
                                arPath.splice(0, 1);     //ar is the path as an array...
                                let ddPath = arPath[arPath.length - 1]; //arPath.join('.');

                                let ddType = item.type;

                                let displayNumbering = data.number + " ";

                                let headingDisplay = data.short; // not ddPath
                                switch (ddType) {
                                    case 'heading' :
                                        arDoc.push(addTaggedLine("h2", displayNumbering + headingDisplay));
                                        // arDoc.push(addTaggedLine("p", data.description));


                                        break;
                                    case 'grouper' :
                                        arDoc.push(addTaggedLine("h2", displayNumbering + headingDisplay));
                                        //arDoc.push(addTaggedLine("p", data.description));
                                        break;
                                }

                                if (data.description == "No description"){
                                    data.description = "There was no detailed description in the model"
                                }


                                // default:
                                if (data.description !== "No description"){
                                    //arDoc.push(addTaggedLine("h3", data.name));

                                    if (ddType !== 'heading' && ddType !== 'grouper') {
                                        arDoc.push(addTaggedLine("h3", displayNumbering + headingDisplay));
                                    }


                                    arDoc.push("<table class='dTable'>");

                                    //addRowIfNotEmpty(arDoc,'Name',data.name);
                                    //addRowIfNotEmpty(arDoc,'Short description',data.short);
                                    addRowIfNotEmpty(arDoc, 'Description', data.description);
                                    addRowIfNotEmpty(arDoc, 'Comments', data.comments);

                                    addRowIfNotEmpty(arDoc, 'Use', data.usageGuide);

                                    if (data.alias) {
                                        let alias = "";
                                        data.alias.forEach(function (al) {
                                            alias += "<div>" + al + "</div>";

                                        });
                                        //alias = alias.substring(0,alias.length -2);
                                        addRowIfNotEmpty(arDoc, 'Aliases', alias)
                                    }


                                    let mult = data.min + ".." + data.max;

                                    let multDisplay = "";
                                    switch (mult) {
                                        case "0..1" :
                                            multDisplay = "Optional, single occurrence"
                                            break
                                        case "0..*" :
                                            multDisplay = "Optional, multiple occurrences"
                                            break;
                                        case "1..1" :
                                            multDisplay = "Required, single occurrence"
                                            break;
                                        case "1..*" :
                                            multDisplay = "Multiple occurrences, at least one"
                                    }


                                    addRowIfNotEmpty(arDoc, 'Occurrence', multDisplay);


                                    if (data.examples) {

                                        let ar = data.examples.split('\n')
                                        let exampleDisplay = ""
                                        ar.forEach(function (lne) {
                                            exampleDisplay += "<div>" + lne + "</div>"
                                        })


                                        addRowIfNotEmpty(arDoc, 'Examples', exampleDisplay);
                                    }


                                    //addRowIfNotEmpty(arDoc,'Examples',data.examples);


                                    addRowIfNotEmpty(arDoc, 'References', data.references);

                                    let type = "";
                                    data.type.forEach(function (typ) {
                                        let targ = ""
                                        if (typ.code == 'Reference') {
                                            if (typ.targetProfile) {
                                                targ = " --> " + $filter('referenceType')(typ.targetProfile[0])
                                            }


                                        }

                                        type += "<div>" + typ.code + targ + "</div>";

                                    });

                                    addRowIfNotEmpty(arDoc, 'Data type', type)

                                    if (data.selectedValueSet && data.selectedValueSet.valueSet) {
                                        let binding = data.selectedValueSet.valueSet;
                                        if (data.selectedValueSet.strength) {
                                            binding += " (" + data.selectedValueSet.strength + ")"
                                        }
                                        addRowIfNotEmpty(arDoc, 'Binding', binding)


                                    }


                                    arDoc.push("</table><br/>");
                                    //break;


                                    // }
                                }

                            }
                        });


                        const header = `   
                    <html><head>
                    <style>
                    
                        h1, h2, h3, h4 {
                         font-family: Arial, Helvetica, sans-serif;
                        }
                    
                        tr, td {
                            border: 1px solid black;
                            padding : 8px;
                        }
                    
                        .dTable {
                            font-family: Arial, Helvetica, sans-serif;
                            width:100%;
                            border: 1px solid black;
                            border-collapse: collapse;
                        }
                        
                        .col1 {
                            background-color:Gainsboro;
                        }
                                   
                    </style>
                    </head>
                    <body style="padding: 8px;">
                    
                `;

                        const footer = "</body></html>"


                        let html = header + arDoc.join("\n") + footer;
                        //console.log(html)






                        deferred.resolve(html)
                        //return deferred.promise;



                    }


                )

                return deferred.promise;



                function addRowIfNotEmpty(ar,description,data) {
                    if (data) {


                        let display = data;

                        let arData =  data.split('\n')
                        if (arData.length > 1)  {
                            display = ""
                            arData.forEach(function (lne) {
                                display += "<div>" + lne + "</div><br/>"
                            })
                        }


                        ar.push('<tr>');
                        ar.push('<td valign="top" width="20%" class="col1">' + description + "</td>");

                        if (data && data.toLowerCase() == 'no description') {
                            ar.push('<td></td>');
                        } else {
                            ar.push('<td>' + display + "</td>");
                        }


                        ar.push('</tr>');
                    }
                }

                function addTaggedLine(tag,data) {

                    if (data && data.toLowerCase() == 'no description') {
                        return "<"+tag + "></"+tag+">"
                    } else {
                        return "<"+tag + ">"+data+"</"+tag+">"
                    }




                }


            },
            decorateTreeItem : function(item,ed) {
                decorateTreeView(item,ed);
            },
            checkValueSetsOnServer : function(treeData){
                var deferred = $q.defer();
                var arQuery=[], arResult = []
                if (treeData) {
                    treeData.forEach(function(row){
                        //item.data.selectedValueSet.valueSet
                        if (row.data && row.data.isCoded && row.data.selectedValueSet && row.data.selectedValueSet.valueSet) {
                            //if (row.data && row.data.isCoded && row.data.selectedValueSet && row.data.selectedValueSet.vs) {
                            arQuery.push(checkVS(row.data.selectedValueSet.valueSet,row));
                        }
                    });

                    $q.all(arQuery).then(
                        function(data){
                            deferred.resolve(arResult)
                        }
                    )

                }
                return deferred.promise;

                function checkVS(url,row) {
                    var deferred1 = $q.defer()

                    let path;
                    if (row.data && row.data.path) {
                        path = row.data.path;
                    }

                    var termServer = appConfigSvc.getCurrentTerminologyServer().url;
                    var srch = termServer + 'ValueSet?url='+ url;
                    console.log(srch)
                    $http.get(srch).then(
                        function(data) {
                            if (data.data && data.data.entry &&  data.data.entry.length > 0) {

                                console.log(data.data.entry[0])
                                let vs = data.data.entry[0].resource;
                                let cs = [];        //code systems
                                if (vs.compose && vs.compose.include) {
                                    vs.compose.include.forEach(function(inc) {
                                        cs.push(inc.system)
                                    })
                                }

                                arResult.push({url:url,outcome:'present',present:true,cs:cs,vs:vs,path:path,row:row})
                                //hash[url] = 'present'
                            } else {
                                arResult.push({url:url,outcome:'absent',absent:true,path:path,row:row})   //makes the display simpler
                                //hash[url] = 'absent'
                            }
                            deferred1.resolve()
                        },
                        function(){
                            deferred1.resolve()
                        }
                    )

                    return deferred1.promise;
                }

            },
            makeIG : function(tree){
                var deferred = $q.defer();
                //construct an Implementation Guide based on the model...
                var hash = {};      //track urls to avoid duplication...
                var IG = {resourceType:'ImplementationGuide',status:'draft',package:[{name:'complete',resource:[]}]};
                IG.id = 'cf-artifacts-cc3';
                IG.description = "Logical Model Profiles";
                IG.extension = [{url: "http://clinfhir.com/fhir/StructureDefinition/cfAuthor",valueBoolean:true}]

                tree.forEach(function (node,inx) {
                    if (inx === 0) {
                      /*  var ext = Utilities.getSingleExtensionValue(node.data.header,
                            appConfigSvc.config().standardExtensionUrl.baseTypeForModel)
                        if (ext && ext.valueString) {
                            var resource = {resourceType: ext.valueString, id: node.id}
                            hash[node.id] = resource;
                            bundle.entry.push({resource: resource})
                        }
                        */
                    } else {
                        if (node.data && node.data.referenceUrl) {
                            //this is a reference to a resource. Eventually this will be a profile - for now add the base type as well...
                            var resourceType = $filter('referenceType')(node.data.referenceUrl)
                            var resource = {resourceType: resourceType, id: node.id}
                            var description = node.data.short;
                            if (node.data.short) {
                                resource.text = {div: node.data.short}
                            }
                            if (! hash[node.data.referenceUrl]) {
                                //create an entry for this

                                var IGEntry = {description:description,sourceReference:{reference:node.data.referenceUrl}};
                                addExtension(IGEntry,'profile')

                                IG.package[0].resource.push(IGEntry);

                                hash[node.data.referenceUrl] = 'x'
                            }


                        }
                    }
                });

                deferred.resolve(IG);


                return deferred.promise;


                function addExtension(entry,term) {
                    entry.extension = [];
                    var extension = {url:'http://clinfhir.com/StructureDefinition/igEntryType'}
                    extension.valueCode = term;
                }


            },
            makeMappingDownload : function(SD) {
                var download = "Path,Type,Binding,Multiplicity,Definition,Comment,Mapping,Fixed Value,Extension Url,Usage Notes,Misuse,Legacy,ReviewReason,Link,Status\n";

                if (SD && SD.snapshot && SD.snapshot.element) {
                    SD.snapshot.element.forEach(function (ed) {
                        //don't add the first element
                        var ar = ed.path.split('.')
                        if (ar.length > 1) {
                            ar.splice(0,1)
                            var lne = ar.join('.') + ',';

                            //the type - first one only ATM
                            if (ed.type) {

                                ed.type.forEach(function(typ){
                                    lne += typ.code;

                                    if (typ.code == 'Reference') {
                                        var resourceType = $filter('referenceType')(ed.type[0].targetProfile)
                                        lne += ' -> '+ resourceType
                                    }



                                });



                                lne += ','
                            } else {
                                lne += ','
                            }

                            //add a binding (if any)
                            if (ed.binding) {
                                if (ed.binding.valueSet) {
                                    //this is R4
                                    lne +=  ed.binding.valueSet
                                } else {
                                    //this is R3
                                    var ref = ed.binding.valueSetReference;
                                    if (ref) {
                                        lne += ref.reference;

                                    }
                                }
                                lne += ','

                            } else {
                                lne += ','
                            }
                            //lne += ',';

                            lne += ed.min + '..'+ed.max + ',';
                            lne += makeSafe(ed.definition) + ",";
                            lne += makeSafe(ed.comment) + ",";

                            if (ed.mapping) {
                                ed.mapping.forEach(function(map){
                                    lne += map.identity + ':' +  $filter('showMapOnly')(map.map)
                                })
                            };
                            lne += ',';
                            if (ed.fixedString) {
                                lne += ed.fixedString
                            }
                            lne += ',';

                            var ext = Utilities.getSingleExtensionValue(ed,simpleExtensionUrl); //in case this is an extension
                            if (ext && ext.valueString) {
                                lne += makeSafe(ed.valueString)
                            }
                            lne += ',';
                            lne += makeSafe(getStringExtensionValue(ed,appConfigSvc.config().standardExtensionUrl.usageGuide)) +',';
                            lne += makeSafe(getStringExtensionValue(ed,appConfigSvc.config().standardExtensionUrl.misuse)) +',';
                            lne += makeSafe(getStringExtensionValue(ed,appConfigSvc.config().standardExtensionUrl.legacy)) +',';
                            lne += makeSafe(getStringExtensionValue(ed,appConfigSvc.config().standardExtensionUrl.lmReviewReason)) +',';
                            lne += makeSafe(getStringExtensionValue(ed,appConfigSvc.config().standardExtensionUrl.lmElementLink)) +',';
                            lne += makeSafe(getStringExtensionValue(ed,appConfigSvc.config().standardExtensionUrl.edStatus)) +',';

                            //var edStatusUrl = appConfigSvc.config().standardExtensionUrl.edStatus;


                            download += lne + "\n";
                        }

                    })

                }
                return download;




                function getStringExtensionValue(ed,url) {
                    var ext = Utilities.getSingleExtensionValue(ed,url); //in case this is an extension
                    if (ext && ext.valueString) {
                        return ext.valueString
                    } else {
                        return "";
                    }
                }

                //remove comma's and convert " -> '
                function makeSafe(s) {
                    if (s) {
                        //the string 'definition' is inserted if no comment is entered (it is mandatory in the ED)
                        if (s == 'definition' || s == 'No description') {
                            return ""
                        }

                        s = s.replace(/"/g, "'");
                        s = s.replace(/,/g, "-");

                        return '"' + s + '"';
                    } else {
                        return "";
                    }


                }


            },
            saveScenarioDEP : function(bundle,modelName) {
                //save a bundle as a scenario. Make the name of the scenario the same as the model name,

                //create the container...
                var container = {name:modelName,bundle:bundle};
                //container.tracker = [];
                //container.history = [];
                //container.index = 0;
                container.server = {data:appConfigSvc.getCurrentDataServer()};

                $localStorage.builderBundles = $localStorage.builderBundles || []
                var pos = -1;
                $localStorage.builderBundles.forEach(function(container,inx){
                    if (container.name == modelName) {
                        pos = inx
                    }
                });

                if (pos > -1) {
                    //replace
                    $localStorage.builderBundles[pos] = container;
                } else {
                    //new
                    $localStorage.builderBundles.push(container);
                }


                if ($localStorage.builderBundles.length == 0) {

                }

            },
            getSampleDEP : function(ed) {
                //return a sample based on an ed.
                var dt;
                if (ed && ed.type) {
                    dt = ed.type[0].code;
                }

                var sample;
                //look for fixed values - always stored as a string
                var fixed = ed.fixedString;
                if (fixed) {
                    console.log(fixed)

                    if (fixed.indexOf('{') > -1) {
                        try {


                            return angular.fromJson(fixed);
                        } catch (ex){
                            console.log('error parsing '+fixed);
                        }
                    } else {
                        return fixed;
                    }



                }


/*
                for (var key in ed) {
                    if (ed.substr(0,5)== 'fixed') {
                        sample = ed[key]
                    }
                }
             */


                sample = "sample";      //default to a string
                switch (dt) {
                    case 'Identifier' :
                        sample = {'system':'http://moh.govt.nz/nhi','value':'WER4568'};
                        break;
                    case 'CodeableConcept' :
                        sample = {text:'Sample Data',coding:[{'system':'http://snomed.info/sct','code':'12234556'}]};
                        break;
                    case 'dateTime' :
                        sample= '1955-12-16T12:30';
                        break;
                    case 'HumanName' :
                        sample = {use:'official',family:'Doe',given:['John'],text:'John Doe'};
                        break;
                    case 'code' :
                        sample = 'm';
                        break;
                    case 'Address' :
                        sample = {"use": "home","type": "both","text": "534 Erewhon St PeasantVille, Rainbow, Vic  3999","line": ["534 Erewhon St"],"city": "PleasantVille"}
                        break;
                    case 'ContactPoint' :
                        sample = {"system": "email",value:"here@there.com",use:"home"};
                        break;
                    case 'Period' :
                        sample = {start:"1974-11-25T14:35",end:"1974-12-25T14:35"};
                        break;
                    case 'boolean' :
                        sample = true;
                        break;
                    case 'Dosage' :
                        sample = {text:"1 tab twice a day",route:{text:'oral'}}
                        break;
                    case 'Reference' :
                        sample = null;
                        break;
                }

                return sample;
            },
            isMultipleDEP : function(path) {
                //true if a given path is multiple. todo - need to read from the SD...
                if (multiple[path]) {
                    return true
                } else {
                    return false;
                }
            },
            makeScenarioDEP : function(tree) {
                var deferred = $q.defer();
                var that = this;
                //generate a scenario from the model (as a tree)
                var bundle = {resourceType:'Bundle',entry:[],type:'collection'};
                var patient = null;   //if there's a patient resource in the model...
                var hash = {};
                var arQuery = [];

                //function to put in a sample value for all direct children of a resource...
                function populateElements(resource) {
                    var id = resource.id;   //the node (&resource) id
                    //find all the nodes on the tree that are direct children of this node
                    tree.forEach(function (node) {
                        if (node.parent == id) {
                            //console.log(node.id)

                            var mappingPath = getMapValueForIdentity(node.data.ed,'fhir')
                            //console.log(mappingPath)
                            if (mappingPath) {
                                var ar = mappingPath.split('.')
                                var eleName = ar[1];
                                var sampleData = that.getSample(node.data.ed) ;
                                if (sampleData) {
                                    if (node.data.ed.max == 1) {
                                        resource[eleName] = sampleData;
                                    } else {
                                        resource[eleName] = [sampleData];
                                    }
                                }

                            }
                        }
                    })
                }

                tree.forEach(function (node,inx) {
                    if (inx === 0) {
                        //this is the root
                        var ext = Utilities.getSingleExtensionValue(node.data.header,
                            appConfigSvc.config().standardExtensionUrl.baseTypeForModel)
                        if (ext && ext.valueString) {
                            //the model has a base resource (like a Document)
                            var resource = {resourceType:ext.valueString,id:node.id};
                            resource.text = {div:"test"}
                            populateElements(resource)
                            hash[node.id] = resource;

                            bundle.entry.push({resource:resource})

                            if (ext.valueString == 'Composition') {
                                //this is a Document...
                                bundle.type='document';
                            }
                        }
                    } else {
                        if (node.data && node.data.referenceUrl) {
                            var resourceType = $filter('referenceType')(node.data.referenceUrl);
                            var resource = {resourceType:resourceType,id:node.id};
                            populateElements(resource);
                            var fullUrl = appConfigSvc.getCurrentDataServer().url+resourceType + "/" + node.id;

                            if (node.data.short) {
                                resource.text = {div:node.data.short}
                            }

                            if (resourceType == 'Patient') {
                                if (patient) {
                                    //if there's already a patient, then don't add another..
                                    hash[node.id] = patient
                                } else {
                                    //otherwise add it...
                                    patient = resource;
                                    hash[node.id] = resource
                                    bundle.entry.push({fullUrl:fullUrl,resource:resource})


                                }
                            } else {
                                //any resource other than a patient...
                                hash[node.id] = resource;
                                bundle.entry.push({fullUrl:fullUrl,resource:resource})
                                arQuery.push(getPatientReference(resourceType));
                            }
                        }
                    }
                });

                //set up any references that can be done by referring to a parent...
                for (var i=1; i< tree.length;i++) {

                    var node = tree[i];

                    var ed;
                    if (node.data) {
                        ed = node.data.ed;
                    }


                    //the hash contains  nodes which have an associated resource(reference) in it...
                    if (hash[node.id]) {
                        //yes, this node has an associated resource (only nodes with a resource are in the hash)...
                        var thisResource = hash[node.id];       //this resource - the one that the psrent will reference
                        var parentNodeResource = hash[node.parent];
                        //console.log(parentNodeResource)

                        if (parentNodeResource) {
                            var mappingPath = getMapValueForIdentity(node.data.ed,'fhir')
                            //and the parent is also a resource - create a reference...
                            if (mappingPath) {
                                //console.log(mappingPath);
                                var ar = mappingPath.split('.');
                                switch (ar.length) {
                                    case 2 :
                                        //eg Composition.subject
                                        //assume the source is always multiple as the logical model may have more than one reference...
                                        var elementName = ar[1];


                                        console.log(mappingPath,parentNodeResource[elementName])

                                        //see if the mapping path is multiple...
                                        //note that a consequence of this is that if a singular mappingpath (like Composition.author) is present more than once, only the last one will be in the sample...
                                        if (that.isMultiple(mappingPath)) {
                                            parentNodeResource[elementName] = parentNodeResource[elementName] || [] ;//<<<<<<<<<<<<<
                                            parentNodeResource[elementName].push({reference: thisResource.resourceType + "/"+ thisResource.id})
                                        } else {
                                           // parentNodeResource[elementName] = parentNodeResource[elementName] || [] ;//<<<<<<<<<<<<<
                                            parentNodeResource[elementName] = {reference: thisResource.resourceType + "/"+ thisResource.id}

                                        }




                                       // parentNodeResource[elementName] = {reference: thisResource.resourceType + "/"+ thisResource.id}
                                        //console.log(parentNodeResource)
                                        break;
                                    case 3 :
                                        //eg Composition.section.entry
                                        //assume for now that the parent is always multiple (todo - not true for careplan, likely need to look this up)
                                        var parentElementName = ar[1];
                                        var elementName = ar[2];
                                        //var reference = thisResource.resourceType + "/"+ thisResource.id;

                                        parentNodeResource[parentElementName] = parentNodeResource[parentElementName] || [];
                                        var arParentElement = parentNodeResource[parentElementName];    //eg Composition.section
                                        var elementToAdd = {}
                                        //elementToAdd[elementName] = {reference: thisResource.resourceType + "/"+ thisResource.id};


                                        //console.log(mappingPath,ed.max)
                                        if (that.isMultiple(mappingPath)) {     //true if there can be multiple elements at this path...
                                            elementToAdd[elementName] = [{reference: thisResource.resourceType + "/"+ thisResource.id}];
                                        } else {
                                            elementToAdd[elementName] = {reference: thisResource.resourceType + "/"+ thisResource.id};
                                        }


                                        arParentElement.push(elementToAdd)


                                        //console.log(parentNodeResource)
                                        break;
                                }



                            }




                        }

                    }

                }



                //if there's a patient, then set all the patient references for all resources.
                //***** note **** this will only work for references off the resource root - like Condition.patient
                if (patient) {
                    if (arQuery.length > 0) {


                        $q.all(arQuery).then(
                            function(data){
                                //all the SDs have been collected and analysed. patientReferenceCache has the pateint refernecs by type......
                                //console.log(patientReferenceCache)

                                //now go through the bundle, setting the patient reference for all
                                bundle.entry.forEach(function (entry) {
                                    var resource = entry.resource;
                                    var pp = patientReferenceCache[resource.resourceType];
                                    if (pp) {
                                        var ar = pp.split('.');
                                        if (ar.length == 2) {
                                            //assume an entry like Conditon.patient
                                            var elementName = ar[1];
                                            resource[elementName] = {reference:'Patient/'+patient.id};
                                        }
                                    }

                                });

                                //now set up references based on the parent...


                                deferred.resolve(bundle)

                            })


                        } else {
                        //no other types in the model yet

                            deferred.resolve(bundle)

                        }



                } else {
                    //no patient so can't create any references...

                    deferred.resolve(bundle)
                }



                return deferred.promise;

                function getMapValueForIdentity(ed,identity){
                    //get the path for a given identity - fhir in this case
                    if (ed && ed.mapping) {
                        for (var i =0; i < ed.mapping.length; i++) {
                            var map =  ed.mapping[i];
                            if (map.identity == identity) {
                                var fhirPath = map.map;
                                if (fhirPath) {
                                    var ar = fhirPath.split('|');   //because the comment is in the same element (should have used an extension)
                                    return ar[0];
                                    break;
                                }

                            }
                        }
                    }

                }


                function getPatientReference(type) {
                    //find the patient reference path for this type (if it exists)
                    var deferred = $q.defer();


                    if (patientReferenceCache[type]) {

                        deferred.resolve(patientReferenceCache[type])
                    } else {
                        var url = 'http://hl7.org/fhir/StructureDefinition/'+type;  //right now, assume core types only
                        GetDataFromServer.findConformanceResourceByUri(url).then(
                            function(SD){

                                var patRef = gpr(SD);
                                if (patRef) {
                                    patientReferenceCache[type] = gpr(SD)
                                    deferred.resolve(patientReferenceCache[type])
                                } else {
                                    deferred.resolve();
                                }

                            },
                            function(err){
                                deferred.reject(err)
                            })
                    }


                    return deferred.promise


                }
                function gpr(SD) {
                    //find any patient reference in the SD..
                    var patRef;
                    if (SD.snapshot && SD.snapshot.element) {
                        for (var i=0; i< SD.snapshot.element.length; i++) {
                            var path = SD.snapshot.element[i].path;
                            var ar = path.split('.');
                            var seg = ar[ar.length-1]
                            if (seg == 'patient' || seg == 'subject') {
                                return path;
                                break;
                            }
                        }

                    }



                    return
                }


            },

            getMappingFile : function(url) {
                url = url || "http://fhir.hl7.org.nz/baseDstu2/StructureDefinition/OhEncounter";    //testing
                var deferred = $q.defer();
                var that = this;
                GetDataFromServer.findConformanceResourceByUri(url).then(
                    function(LM){
                        //create a v2 -> fhir mapping file for a given logical model. Used by the message comparer...
                        var treeData = that.createTreeArrayFromSD(LM)
                        var relativeMappings = that.getRelativeMappings(treeData); //items with both v2 & fhir mappings

                        var map = []
                        relativeMappings.forEach(function(m) {

                            map.push({description: m.branch.data.path,v2:m.sourceMap,fhir:m.targetMap,fhirPath:m.fhirPath})
                        });


                        deferred.resolve(map)

                    },
                    function(err) {
                        deferred.reject(err);
                    }
                )

                return deferred.promise;


            },

            getRelativeMappings : function(tree) {
                //find elements in the model that have mappings to both source and target

                var source="hl7V2";
                var target = "fhir";
                var arRelative = []
                tree.forEach(function (branch) {
                    var fhirPath = null;
                    var data = branch.data;
                    //see if there's a mapping for both source and target
                    if (data.mappingFromED) {
                        var sourceMap = "", targetMap = ""
                        data.mappingFromED.forEach(function (map) {
                            if (map.identity == source) {
                                sourceMap = map.map;
                            }
                            if (map.identity == target) {
                                targetMap = map.map;
                            }

                            if (map.identity == 'fhirpath') {
                                fhirPath = map.map
                            }

                        });
                        if (sourceMap && targetMap) {
                            var item = {source:source,sourceMap:sourceMap,target:target, targetMap:targetMap, branch:branch};
                            item.fhirPath = fhirPath;
                            item.type = data.type;



                            arRelative.push(item)
                        }



                    }
                })
                return arRelative;

            },
            getConceptMapMappings : function(url) {
                var deferred = $q.defer();
                if (url) {
                    $http.get(url).then(
                        function (data) {
                            if (data && data.data) {
                                var vo = {element:[]}
                                var group = data.data.group[0];
                                vo.sourceCS = group.source;
                                vo.targetCS = group.target;
                                if (group.element) {
                                    group.element.forEach(function(element){
                                        if (element.target) {
                                            element.target.forEach(function (target) {
                                                var map = {source:element.code,target:target.code,comment:target.comment,eq:target.equivalence}
                                                vo.element.push(map)

                                            })
                                        }
                                    })
                                    deferred.resolve(vo)
                                }
                            }
                            deferred.reject();

                        },function () {
                            deferred.reject();
                        }
                    )
                }
                return deferred.promise;

            },
            getEDForPath : function(SD,node){
                //return the ElementDefinition that corresponds to the mapped FHIR element..
                var path = node.data.path;
                /*
                if (node && node.data && node.data.mappingFromED) {
                    node.data.mappingFromED.forEach(function (map) {
                        if (map.identity == 'fhir') {
                            path = map.map;
                        }
                    })
                }
*/

                if (path && SD && SD.snapshot && SD.snapshot.element) {
                    for (var i=0;i < SD.snapshot.element.length;i++) {
                        var ed = SD.snapshot.element[i];
                        if (ed.path == path) {
                            return ed;
                            break;
                        }
                    }
                }

            },
            openTopLevelOnly : function(tree) {
                tree.forEach(function (node,inx) {
                    node.state = node.state || {}
                    if (inx ==0) {
                        node.state.opened=true;
                    } else {
                        node.state.opened=false;
                    }
                })
                this.saveTreeState(tree);
            },
            saveTreeState : function(tree) {
                //save the current state of the tree...
                hashTreeState= {}
                if (tree) {
                    tree.forEach(function(node){
                        var opened = false;
                        if (node.state && node.state.opened) {
                            opened = true;
                        }
                        hashTreeState[node.id] = {opened:opened}
                    })
                }

            },
            resetTreeState : function(tree) {
                //reset the tree state wrt opened/closed nodes
                if (tree) {
                    tree.forEach(function(node){
                        node.state = node.state || {}
                        node.state.opened = false;
                        if (hashTreeState[node.id]) {
                            node.state.opened = hashTreeState[node.id].opened;
                        }
                    })
                }
            },
            setAsDiscriminator : function(selectedNode,treeData){
                //set the FHIR path for this node to be the discriminator for all nodes which have the same FHIR path...
                if (selectedNode.data && selectedNode.data.mappingFromED)
                var discriminator = getFhirMapping(selectedNode.data.mappingFromED);    //the fhir path for this element will be the discriminator for
                var ar = discriminator.split('.')
                var rootPath = ar[0]+'.'+ar[1];     //assume that the element that is duplicated is always attached to the root  NOT TRUE
                //now check all the other nodes in the tree...
                treeData.forEach(function (node) {
                    if (node.data) {
                        var map = node.data.mappingFromED;
                        if (map) {
                            var fmp = getFhirMapping(map)   //this is the FHIR path. If it starts with the same path as rootPath, then set the discriminator
                            if (fmp.substr(rootPath) === rootPath){
                                node.data.discriminator = discriminator;
                            }

                        }

                    }

                })


            },
            isDiscriminatorRequiredDEP : function(node,treeData){
                var discriminatorReq = false;
                if (node.data && node.data.mappingFromED) {
                    var fhirPath = getFhirMapping(node.data.mappingFromED);     //the map for this element
                    //there is a mapping
                    var cnt = 0;
                    treeData.forEach(function (node) {
                        if (node.data) {
                            var map = node.data.mappingFromED;
                            if (map) {
                                var fmp = getFhirMapping(map)
                                if (fmp == fhirPath){
                                    cnt ++
                                }

                            }

                        }

                    })
                    if (cnt > 1) {
                        discriminatorReq = true;
                    }
                }
                return discriminatorReq;

                function getFhirMappingDEP(map) {
                    var fhirPath;
                    if (map) {
                        map.forEach(function (mp) {
                            if (mp.identity == 'fhir') {
                                fhirPath =  mp.map;
                            }
                        })
                    }
                    return fhirPath;
                }


            },

            explodeResource : function(treeData,node,url) {
                //get all teh child nodes for a resource...\\

                //todo need to exlute text if path length is 2...
                var arExclude=['id','extension','meta','implicitRules','modifierExtension','contained','language','text'];
                var deferred = $q.defer();

                var parentId = node.id;
                var parentPath = node.data.path;        //the path of the element that is being expanded...
                var lmRoot = treeData[0].data.path;     //the root of this model... (eg OhEncounter)
                var baseType = 'unknown';
                if (treeData[0] && treeData[0].data && treeData[0].data.header) {
                    baseType = treeData[0].data.header.baseType;    //base type
                }




                //var url = appConfigSvc.getCurrentConformanceServer().url + 'StructureDefinition/'+dt;

                GetDataFromServer.findConformanceResourceByUri(url).then( //     .adHocFHIRQuery(url).then(
                    function(dtSD) {
                        //var dtSD = data.data;
                        if (dtSD.snapshot && dtSD.snapshot.element) {

                            dtSD.snapshot.element.forEach(function (ele,inx) {

                                var originalPath = ele.path;        //used for the FHIR mapping in the 'imported' resource...
                                //the first letter needs to be lowercase, as it will be part of a path...
                                ele.path = ele.path.charAt(0).toLowerCase() + ele.path.slice(1);


                                var ar = ele.path.split('.')

                                if (ar.length == 2 && arExclude.indexOf(ar[1]) == -1) {

                                    ar.splice(0,1);     //remove the first part of the path (the dt name eg CodeableConcept)
                                    var pathForThisElement = parentPath + '.'+  ar.join('.');

                                    var newId = pathForThisElement; ///'t' + new Date().getTime()+inx;
                                    var newNode = {
                                        "id": newId,
                                        "parent": parentId,
                                        "text": ar[0],
                                        state: {opened: true},
                                        data : {}
                                    };


                                    newNode.data.name = ar[0];
                                    newNode.data.short = ele.short;



                                    newNode.data.path = pathForThisElement;///parentPath + '.'+  ar.join('.')
                                    newNode.data.min = ele.min;
                                    newNode.data.max = ele.max;



                                    //newNode.data.mappingFromED = [{identity:'fhir',map:baseType + '.'+ ele.path}]
                                    //the path is that of the resource being 'imported'
                                    newNode.data.mappingFromED = [{identity:'fhir',map: originalPath}]
                                    newNode.data.type = ele.type;
                                    newNode.data.type.forEach(function(typ){
                                        var first = typ.code.substr(0,1);
                                        if (first == first.toUpperCase()) {
                                            typ.isComplexDT = true;
                                        }
                                    })

                                    treeData.push(newNode);
                                }

                            })

                        }




                        deferred.resolve();

                    },function (err) {
                        deferred.reject(err)
                    }
                )
                return deferred.promise;
            },
            explodeDataType : function(treeData,node,dt) {
                var arExclude=['id','extension','modifierExtension'];
                var deferred = $q.defer();

                var parentId = node.id;
                var parentPath = node.data.path;            //the path of the element that is being expanded...
                var suffix = generateSuffix(treeData,node); //new Date().getTime();      //a prefix for the path to support multiple expands
                var lmRoot = treeData[0].data.path;         //the root of this model... (eg OhEncounter)
                var baseType = 'unknown';                   //base FHIR type for this node
                if (treeData[0] && treeData[0].data && treeData[0].data.header) {
                    baseType = treeData[0].data.header.baseType;    //base type
                }

                //if the parent node has a FHIR mapping, then we can create FHIR mappings for the children also...
                var fhirParentPath;
                if (node.data && node.data.mappingFromED) {
                    node.data.mappingFromED.forEach(function (map) {
                        if (map.identity == 'fhir') {
                            fhirParentPath = map.map;
                        }
                    })
                }


                var url = appConfigSvc.getCurrentConformanceServer().url + 'StructureDefinition/'+dt;
                GetDataFromServer.adHocFHIRQuery(url).then(
                    function(data) {
                        var dtSD = data.data;
                        if (dtSD.snapshot && dtSD.snapshot.element) {

                            dtSD.snapshot.element.forEach(function (ele,inx) {

                                //the first letter needs to be lowercase, as it will be part of a path...
                                ele.path = ele.path.charAt(0).toLowerCase() + ele.path.slice(1);    //this will be a codeableconcept


                                var ar = ele.path.split('.')

                                if (ar.length ==2 && arExclude.indexOf(ar[1]) == -1) {

                                    ar.splice(0,1);     //remove the first part of the path (the dt name eg CodeableConcept)

                                    //pathSegment used when adding a datatype to th emodel...
                                    var pathSegment = ar.join('.') + "_"+suffix;
                                    var pathForThisElement = parentPath + '.'+  pathSegment;

                                    var newId = pathForThisElement + 't' + new Date().getTime()+inx;
                                    var newNode = {
                                        "id": newId,
                                        "parent": parentId,
                                        "text": ar[0],
                                        state: {opened: true},
                                        data : {}
                                    };


                                    newNode.data.pathSegment = pathSegment;
                                    newNode.data.name = ar[0];
                                    newNode.data.short = ele.short;


                                    newNode.data.path = pathForThisElement;///parentPath + '.'+  ar.join('.')
                                    newNode.data.min = ele.min;
                                    newNode.data.max = ele.max;

                                    if (fhirParentPath) {

                                       // var fhirPath = baseType + '.'+ ele.path
                                        var fhirPath = fhirParentPath + '.' + ar.join('.')

                                        newNode.data.mappingFromED = [{identity:'fhir',map:fhirPath}]
                                    }




                                    newNode.data.type = ele.type;
                                    newNode.data.type.forEach(function(typ){
                                        var first = typ.code.substr(0,1);
                                        if (first == first.toUpperCase()) {
                                            typ.isComplexDT = true;
                                        }
                                    })

                                    treeData.push(newNode);
                                }

                            })

                        }




                        deferred.resolve();

                    },function (err) {
                        deferred.reject(err)
                    }
                )
                return deferred.promise;

                function generateSuffix(treeData,node){
                    //create a suffix which is the count of the number of child nodes +1
                    var nodeId = node.id;
                    ctr = 1;
                    treeData.forEach(function (node) {
                        if (node.parent == nodeId) {
                            ctr++;
                        }
                    })
                    return ctr;
                }

            },
            generateDoc : function(tree) {
                var deferred = $q.defer();
                //var simpleExtensionUrl = appConfigSvc.config().standardExtensionUrl.simpleExtensionUrl;
                var arDoc = [];

                var arQueries = [];




                        tree.forEach(function (branch) {
                    var data = branch.data;

                    var path = data.path;     //this is the
                    var ar = path.split('.');
                    if (ar.length == 1) {
                        //this is the first node. Has 'model level' data...
                        if (data.header) {
                            var title = data.header.title || data.header.name;

                            arDoc.push("# "+title);
                            arDoc.push("");

                            addTextIfNotEmpty(arDoc,data.header.purpose);

                            if (data.header.baseType){
                                arDoc.push("**Base type is " + data.header.baseType+"**");
                                arDoc.push("");
                            }

                        }


                    } else {
                        //this is an 'ordinary node
                        ar.splice(0,1);     //ar is the path as an array...


                        var hdr = "## "+ar.join(".")    //the name of the element in the model

                        if (data.fhirMappingExtensionUrl) {

                            //This is an extension...
                            hdr += " (Extension)";

                        } else if (data.type) {
                            hdr += " (";
                            data.type.forEach(function(typ,inx){
                                if (inx > 0) {
                                    hdr += " ";
                                }
                                hdr += typ.code;
                            });
                            hdr += ")"

                            hdr += " ["+ data.min + '..' + data.max+']';

                        }

                        //the header...
                        arDoc.push("");
                        arDoc.push(hdr)
                        arDoc.push("");

                        //todo - not sure about this... addTextIfNotEmpty(arDoc,data.short);
                        addTextIfNotEmpty(arDoc,data.description);
                        addTextIfNotEmpty(arDoc,data.comments);

                        if (data.fhirMappingExtensionUrl) {
                            arDoc.push("Extension Url: "+data.fhirMappingExtensionUrl);
                        }

                        if (data.selectedValueSet && data.selectedValueSet.vs) {
                            var vs = "ValueSet: " + data.selectedValueSet.vs.url;
                            if (data.selectedValueSet.strength) {
                                vs += " ("+data.selectedValueSet.strength + ")"
                            }
                            vs = "**"+vs+"**";
                            addTextIfNotEmpty(arDoc,vs);

                        }

                        //show the fhir mapings
                        if (data.mappingFromED) {
                            //arDoc.push("### FHIPath and Mappings")
                            data.mappingFromED.forEach(function(map){
                                if (map.identity == 'fhir') {
                                    //note that this is a bit hacky as the comment element is only in R3...
                                    arDoc.push("");
                                    var m = map.map;
                                    var c = map.comment;
                                    var ar1 = m.split('|');
                                    m = ar1[0];
                                    if (ar1.length > 1 && ! c) {
                                        c = ar1[1]
                                    }

                                    m = m.replace('|',"");
                                   // arDoc.push("###FHIR mapping:"+m)
                                    arDoc.push("**FHIR path:** " + m)
                                    if (c) {
                                        arDoc.push("")
                                        arDoc.push(c)
                                    }
                                } else {
                                    if (1==3) {
                                        arDoc.push("");
                                        var m = map.map;
                                        if (m) {
                                            var c = map.comment;
                                            var ar1 = m.split('|');
                                            m = ar1[0];
                                            if (ar1.length > 1 && ! c) {
                                                c = ar1[1]
                                            }

                                            m = m.replace('|',"");
                                            //arDoc.push("###"+map.identity+ " mapping:"+m)
                                            arDoc.push('**'+ map.identity + ":** " + m)
                                            if (c) {
                                                arDoc.push("")
                                                arDoc.push(c)
                                            }
                                        }
                                    }


                                }
                            })

                        }

                    }

                });

                //note - not using any queries yet - thinking is to support looking up extensions...
                if (arQueries.length > 0) {
                    $q.all(queries).then(
                        function () {

                            deferred.resolve(treeData)
                        },
                        function (err) {
                            console.log('ERROR: ', err)
                            deferred.reject(err)
                        }
                    );
                } else {
                    deferred.resolve(arDoc.join('\n'));
                }


                return deferred.promise;

                function addTextIfNotEmpty(ar,txt) {
                    if (txt) {
                        ar.push(txt);
                        ar.push("")
                    }
                }
            },
            generateHTML : function(tree) {
                var deferred = $q.defer();
                var arDoc = []

                //arDoc.push('<style> ')



                tree.forEach(function (branch) {
                    var data = branch.data;

                    var path = data.path;     //this is the
                    var arPath = path.split('.');
                    if (arPath.length == 1) {
                        //this is the first node. Has 'model level' data...
                        if (data.header) {
                            var title = data.header.title || data.header.name;

                            arDoc.push("<h1>" + title) + "<h1>";


                            if (data.header.purpose) {
                                let tmp = $filter('markDown')(data.header.purpose)
                                arDoc.push("<h2>Purpose of model</h2>");
                                arDoc.push(tmp);

                            }

/*
                            addTextIfNotEmpty(arDoc, data.header.purpose);

                            if (data.header.baseType) {
                                arDoc.push("**Base type is " + data.header.baseType + "**");
                                arDoc.push("");
                            }
                            */

                        }

                        arDoc.push("<h1>Structured content</h1>");


                    } else {
                        //this is an 'ordinary node
                        arPath.splice(0, 1);     //ar is the path as an array...

                        //if this is a backbone element, create a new section
                        if (data.type) {
                            if (data.type[0].code == 'BackboneElement' ){
                                arDoc.push("<br/><br/><hr/>")
                                arDoc.push(addTaggedLine("h2",arPath.join('.')));
                                arDoc.push(addTaggedLine("p",data.description))

                            } else {


                                //arDoc.push(addTaggedLine("h3",arPath.join('.')));
                                arDoc.push(addTaggedLine("h3",arPath[arPath.length -1]));
                                arDoc.push("<table class='dTable'>");

                                addRowIfNotEmpty(arDoc,'Name',data.name);

                                if (data.alias) {
                                    let alias = "";
                                    data.alias.forEach(function (al) {
                                        alias += "<div>" + al + "</div>";

                                    })
                                    //alias = alias.substring(0,alias.length -2);
                                    addRowIfNotEmpty(arDoc,'Aliases',alias)
                                }

                                //console.log(data.alias)

                                addRowIfNotEmpty(arDoc,'Short description',data.short);
                                addRowIfNotEmpty(arDoc,'Full description',data.description);
                                addRowIfNotEmpty(arDoc,'Comments',data.comments);

                                let mult = data.min + ".." + data.max;
                                addRowIfNotEmpty(arDoc,'Multiplicity',mult);

                                let type = "";
                                data.type.forEach(function(typ){
                                    let targ = ""
                                    if (typ.code == 'Reference') {
                                        if (typ.targetProfile) {
                                            targ = " --> " + $filter('referenceType')(typ.targetProfile[0])
                                        }


                                        //console.log(typ)

                                    }

                                    type += "<div>" + typ.code + targ +  "</div>";



                                });

                                addRowIfNotEmpty(arDoc,'Datatype/s',type)

                                if (data.selectedValueSet && data.selectedValueSet.valueSet) {
                                    let binding = data.selectedValueSet.valueSet;
                                    if (data.selectedValueSet.strength) {
                                        binding += " (" + data.selectedValueSet.strength + ")"
                                    }
                                    addRowIfNotEmpty(arDoc,'Binding',binding)
                                    //type +=  "<i>"+ data.selectedValueSet.valueSet + "</i> ("+ data.selectedValueSet.strength + ")"


                                }

                                //type = type.substring(0,type.length -2);

                                let display = type;     //default to just type name
/*
                                console.log(data)
                                if (data.selectedValueSet) {
                                    let binding = "<div>" + data.selectedValueSet.valueSet;
                                    if (data.selectedValueSet.strength) {
                                        binding += " (" + data.selectedValueSet.strength + ")"
                                    }
                                    binding += "</div>"
                                    display += binding;
                                }
*/

                                //addRowIfNotEmpty(arDoc,'Datatype/s',display)



                                addRowIfNotEmpty(arDoc,'Usage Guide',data.usageGuide);
                                addRowIfNotEmpty(arDoc,'Misuse',data.misuse);
                                let fhirMapping;
                                if (data.mappingFromED) {
                                    data.mappingFromED.forEach(function (map) {
                                        if (map.identity=='fhir') {
                                            fhirMapping = map.map;
                                        }
                                    })
                                }
                                if (fhirMapping) {
                                    addRowIfNotEmpty(arDoc,'Profile mapping',fhirMapping);
                                }

                                arDoc.push("</table>");
                            }
                        }





                    }
                });


                const header = `   
                    <html><head>
                    <style>
                    
                        h1, h2, h3, h4 {
                         font-family: Arial, Helvetica, sans-serif;
                        }
                    
                        tr, td {
                            border: 1px solid black;
                            padding : 8px;
                        }
                    
                        .dTable {
                            font-family: Arial, Helvetica, sans-serif;
                            width:100%;
                            border: 1px solid black;
                            border-collapse: collapse;
                        }
                        
                        .col1 {
                            background-color:Gainsboro;
                        }
                                   
                    </style>
                    </head>
                    <body style="padding: 8px;">
                    
                `;

                const footer = "</body></html>"


                let html = header + arDoc.join("\n") + footer;
                //console.log(html)

                deferred.resolve(html)
                return deferred.promise;

                function addRowIfNotEmpty(ar,description,data) {
                    if (data) {
                        ar.push('<tr>');
                        ar.push('<td width="20%" class="col1">' + description + "</td>");
                        ar.push('<td>' + data + "</td>");
                        ar.push('</tr>');

                    }

                }

                function addTaggedLine(tag,line) {
                    return "<"+tag + ">"+line+"</"+tag+">"
                }


            },

            makeDocBundle : function(lst){
                //lst {src:, targ:, path:, type} = from getModelReferences function()
                //make a bundle that has an instance of all the referenced models (and their paths). suitable for Scenario Builder
                //For each reference, create a new instance of the target resource...
                var bundle = {resourceType:'Bundle',type:'document',entry:[]};
                var composition = {resourceType:'Composition',status:'preliminary',type:{text:'unknown'},title:'Autogenerated doc from Logical Modeller'}
                composition.date = moment().format();
                composition.section=[];
                bundle.entry.push({resource:composition});

                //
                lst.forEach(function (item,inx) {
                    var resource ={resourceType:item.type};
                    bundle.entry.push({resource:resource});
                    resource.id = 'auto'+inx;
                    if (item.type == 'Patient') {
                        composition.subject = {reference:'Patient/'+resource.id}
                    } else {
                        //for now, every references resource (other than the Patient) is in a separate section...

                        var ar = item.path.split('.');
                        ar.splice(0,1);
                        var display = ar.join('.')


                        var sect = {title:display}
                        sect.entry = [{reference:resource.resourceType + "/"+ resource.id}]
                        composition.section.push(sect);
                    }

                });
                return bundle;
            },
            importFromProfile: function () {
                var that = this;
                var deferred = $q.defer();
                var serverUrl = "http://fhir.hl7.org.nz/dstu2/";
                var url = serverUrl + "StructureDefinition/ohAllergyIntolerance";
                var queries = []

                GetDataFromServer.adHocFHIRQuery(url).then(
                    function (data) {
                        var profile = data.data;

                        var treeData = that.createTreeArrayFromSD(profile);

                        //now, pull out all the extensions and resolve the name and datatypes...

                        treeData.forEach(function (item) {
                            if (item.text.substr(0, 9) == 'extension') {
                                if (item.data) {
                                    var uri = item.data.referenceUri;
                                    if (uri) {
                                        //now retrieve the SD that describes this extension and update the tree. Assume it is on the same server...
                                        queries.push(checkExtensionDef(uri, item));
                                    }

                                }
                            }

                        });

                        $q.all(queries).then(
                            function () {

                                deferred.resolve(treeData)
                            },
                            function (err) {
                                console.log('ERROR: ', err)
                            }
                        );


                        function checkExtensionDef(extUrl, item) {
                            var deferred = $q.defer();
                            var url = serverUrl + "StructureDefinition?url=" + extUrl;
                            GetDataFromServer.adHocFHIRQuery(url).then(
                                function (data) {
                                    var bundle = data.data;
                                    if (bundle && bundle.entry) {
                                        var extensionDef = bundle.entry[0].resource;     //should really only be one...
                                        var analysis = Utilities.analyseExtensionDefinition3(extensionDef);

                                        if (analysis.name) {
                                            item.text = analysis.name;

                                        }
                                        item.data.analysis = analysis;
                                    }

                                    deferred.resolve();
                                },
                                function (err) {
                                    deferred.reject();
                                }
                            );
                            return deferred.promise;
                        };


                    }, function (err) {
                        console.log(err)
                    }
                )


                return deferred.promise;
            },
            mergeModel: function (targetModel, pathToInsertAt, modelToMerge) {



                //var pathToInsertAt = $scope.selectedNode.id;

                //find the position in the current SD where this path is...
                var posToInsertAt = -1;
                for (var i = 0; i < targetModel.snapshot.element.length; i++) {
                    var ed = targetModel.snapshot.element[i];
                    if (ed.path == pathToInsertAt) {
                        posToInsertAt = i + 1;
                    }
                }


                if (posToInsertAt > -1) {
                    //posToInsertAt
                    //right. here is where we are ready to insert. Start from the second one...
                    //var arInsert = [];      //the array of ed's to insert
                    for (var j = modelToMerge.snapshot.element.length - 1; j > 0; j--) {     //needs to be descending, due the inset at the same point

                        //for (var j = 1; j < modelToMerge.snapshot.element.length; j++) {
                        var edToInsert = angular.copy(modelToMerge.snapshot.element[j]);
                        //now, change the path in the edToInsert to it's consistent with the parent...
                        var ar = edToInsert.path.split('.');
                        ar.shift();     //remove the root
                        edToInsert.path = pathToInsertAt + '.' + ar.join('.');
                        edToInsert.id = edToInsert.path;

                        targetModel.snapshot.element.splice(posToInsertAt, 0, edToInsert)
                        //arInsert.push(edToInsert);
                    }

                    return true;


                } else {
                    return false;
                }
            },

            getModelFromBundle: function (bundle, url) {
                if (bundle) {
                    for (var i = 0; i < bundle.entry.length; i++) {
                    var resource = bundle.entry[i].resource;
                    if (resource.url == url) {
                        return resource
                        break;
                    }
                }
                }
            },

            mapToFHIRBundle: function (input, model) {
                //map an incomming message to a FHIR bundle (using v2 input)
                //assume v2 message is in JSON format
                //strategy: locate patient first (as most resources have a reference to patient)
                //then process each entry in turn assuming a 1:1 mapping from segment -> resource (todo may need to revisit this)
                // use the mapping in the model to construct the resource.


            },
            generateSample: function (treeObject) {


                function processNode(resource, node) {


                    if (node.children && node.children.length > 0) {
                        node.children.forEach(function (lnode) {


                            if (lnode.children && lnode.children.length > 0) {
                                var obj = {};
                                resource[lnode.text] = obj;
                                processNode(obj, lnode)
                            } else {
                                resource[lnode.text] = 'sample value';
                            }


                        })
                    } else {
                        //resource.value = "ValueForNode";
                    }

                }

                var sample = {};
                processNode(sample, treeObject[0])


                return sample;
            },

            getOptionsFromValueSetV2: function (element) {
                //return the expanded set of options from the ValueSet
                var deferred = $q.defer();
                if (element && element.selectedValueSet) {
                    let url = appConfigSvc.getCurrentTerminologyServer().url + "ValueSet/$expand";
                    url += "?url="+element.selectedValueSet.valueSet;
                    $http.get(url).then(
                        function(data) {
                            let vs = data.data;
                            console.log(vs)
                            if (vs && vs.expansion && vs.expansion.contains) {
                                deferred.resolve(vs.expansion.contains)
                            }
                        },
                        function(err) {
                            deferred.reject(err)
                        }
                    )

                } else {
                    deferred.reject()
                }
                return deferred.promise;
            },

            getOptionsFromValueSet: function (element) {
                //return the expanded set of options from the ValueSet
                var deferred = $q.defer();

                if (element && element.selectedValueSet && element.selectedValueSet.vs && element.selectedValueSet.vs.url) {

                    if (expansionBlacklist.indexOf(element.selectedValueSet.vs.url) > -1) {
                        deferred.resolve([{display:'Not expanded - list too long'}]);
                        return deferred.promise;
                    }

                    GetDataFromServer.getValueSet(element.selectedValueSet.vs.url).then(
                        function (vs) {


                            //the extension that indicates the vs (authored by CF) has direct concepts that are not snomed so can't be expanded
                            var extensionUrl = appConfigSvc.config().standardExtensionUrl.vsDirectConcept;
                            var ext = Utilities.getSingleExtensionValue(vs, extensionUrl);
                            if (ext && ext.valueBoolean) {
                                //first, create an array with all of the composed concepts...
                                var ar = [];
                                vs.compose.include.forEach(function (inc) {
                                    ar = ar.concat(inc.concept)
                                });

                                //now create a filtered return array
                                var returnArray = []
                                if (ar && ar.length > 0) {
                                    ar.forEach(function (item) {
                                        returnArray.push(item)
                                    });
                                }

                                deferred.resolve(returnArray);

                            } else {
                                var id = vs.id;

                                //return only 100
                                GetDataFromServer.getExpandedValueSet(id,100).then(
                                    function (data) {
                                        if (data.expansion && data.expansion.contains) {
                                            deferred.resolve(data.expansion.contains);

                                        } else {
                                            deferred.resolve()
                                        }
                                    }, function (err) {
                                        deferred.reject(err)
                                    }
                                )
                            }

                        },
                        function (err) {
                            deferred.reject(err);
                        }
                    )
                } else {
                    deferred.resolve();
                }

                return deferred.promise;


            },
            insertModel: function (element, insertModel) {

            },
            addSimpleExtension: function (sd, url, value) {
                //add a simple extension as a string;
                sd.extension = sd.extension || []
                sd.extension.push({url: url, valueString: value})
            },
            setCurrentUser: function (user) {
                currentUser = user;
            },
            getCurrentUser: function () {
                return currentUser;
            },
            getAllPathsForType: function (typeName,explode) {
                //return all the possible paths for a base type...
                //if explode true then add 'child nodes' for some complex elements


                var deferred = $q.defer();
                var url = "http://hl7.org/fhir/StructureDefinition/" + typeName;

                console.log('getting resource...')

                GetDataFromServer.findConformanceResourceByUri(url).then(
                    function (SD) {
                        if (SD && SD.snapshot && SD.snapshot.element) {
                            var lst = [], hash={}, dtDef = {}, edHash={};
                            SD.snapshot.element.forEach(function (ed) {
                                var path = ed.path;
                                edHash[path]=ed

                                //expand the [x] element. Todo - this might muck up the profile generation... ?could just look for multiple types
                                if (path.indexOf('[x]')> -1 && ed.type) {
                                    var pathRoot = path.substr(0,path.length-3);
                                    ed.type.forEach(function(typ){
                                        if (typ.code) {
                                            var cd = typ.code[0].toUpperCase()+typ.code.substr([1]);
                                            var newPath = pathRoot + cd;
                                            lst.push(newPath)
                                            hash[newPath] = ed;
                                            //dtDef[newPath] =
                                        }
                                    })

                                } else {
                                    lst.push(path)
                                    hash[path] = ed;
                                    if (ed.type && explode) {
                                        //see if this is a FHIR logical model (like dosage). If so, add the child nodes
                                        //may want to do this for codeableconcept and others as well...
                                        var typ = ed.type[0].code;
                                        if (fhirLM[typ]) {
                                            fhirLM[typ].forEach(function(child){
                                                lst.push(path + "." + child.name)
                                                hash[path] = ed;
                                            })
                                        }
                                    }
                                }

                            });
                            deferred.resolve({list:lst,hash:hash,dtDef:fhirLM,edHash:edHash});
                        }

                    }, function (err) {
                        alert("error qith query: " + url + "\n" + angular.toJson(err));
                        deferred.reject();
                    }
                ).finally(
                    function(){
                        console.log('call complete...')
                    }
                )
                return deferred.promise;


            },
            clone: function (baseSD, rootName) {
                //make a copy of the SD changing the rootName in the path...
                var newSD = angular.copy(baseSD);
                newSD.id = rootName;
                var arUrl = newSD.url.split('/');
                arUrl[arUrl.length - 1] = rootName;
                newSD.url = arUrl.join('/');
                newSD.name = rootName;
                newSD.status = 'draft';
                newSD.date = moment().format()


                newSD.snapshot.element.forEach(function (ed) {
                    var path = ed.path;
                    var arPath = path.split('.');
                    arPath[0] = rootName;
                    ed.path = arPath.join('.')
                })
                return newSD;

            },
            createFromBaseType: function (treeData, typeName, rootName) {
                var fhirVersion = appConfigSvc.getCurrentConformanceServer().version;

                //create a model from the base type, only bringing across stuff we want.
                //todo - very similar to the logic in createTreeArrayFromSD() - ?call out to separate function...
                var deferred = $q.defer();
                var elementsToIgnore = ['id', 'meta', 'implicitRules', 'language', 'contained', 'extension', 'modifierExtension'];
                var url = "http://hl7.org/fhir/StructureDefinition/" + typeName;

                var serverUrl;  //set this for STU-2 - will default to the current one if not set...



                GetDataFromServer.findConformanceResourceByUri(url, serverUrl).then(
                    function (SD) {
                        try {
                            makeTreeData(SD, treeData);



                            deferred.resolve(treeData);
                        } catch (ex) {
                            //can't just throw the exception object back...
                            let err= {};
                            err.message = ex.message;
                            err.stack = ex.stack;

                            deferred.reject(err)
                        }


                    },
                    function (err) {
                        alert(angular.toJson(err))
                        deferred.reject(err)
                    }
                );

                return deferred.promise;

                function makeTreeData(SD, treeData) {

                    //The hAPI server is missing the snapshot element for some reason.
                    // Hopefully the differential is complete... - this was an issue with the SD ? todo needto d this
                    var elements = SD.snapshot || SD.differential;

                    elements.element.forEach(function (ed) {
                        var path = ed.path;
                        var arPath = path.split('.');

                        if (arPath.length > 1) { //skip the first one

                            arPath[0] = rootName;           //use the rootname of the Logical Model
                            var include = true;
                            //don't include the main text element
                            if (arPath.length == 2) {
                                if (arPath[1] == 'text') {
                                    include = false;
                                }
                            }

                            var idThisElement = arPath.join('.')
                            var treeText = arPath.pop();//

                            if ((elementsToIgnore.indexOf(treeText) > -1) && (arPath.length == 1)) { //note that the first segment of the path has been popped off...
                                include = false;
                            }

                            if (treeText == 'extension' || treeText == 'modifierExtension' || treeText == 'id') {
                                include = false;
                            }

                            if (include) {

                                var parentId = arPath.join('.');
                                var item = {};

                                item.id = idThisElement;
                                item.text = treeText;
                                item.data = {};
                                item.parent = parentId;


                                //test that the parent exists
                                var found = false;

                                for (let item of treeData) {
                                    if (item.id == parentId) {
                                        found = true;
                                        break
                                    }
                                }



                                if (!found) {
                                    console.log('Missing parent element ' + parentId)
                                    throw 'Missing parent element ' + parentId + '. This is because the model definition is incorrect, so I cannot use it.';
                                    return;
                                }


                                item.state = {opened: true};     //default to fully expanded

                                item.data.path = idThisElement;     //is the same as the path...
                                item.data.name = item.text;
                                item.data.short = ed.short;
                                item.data.description = ed.definition;

                                //if this is stu2, then the 'profile' array becomes a single 'targetType' on each type
                                //in stu3 targetProfile is single, in R4 it is multiple. in the tree array, we'll make it multiple
                                if (ed.type) {
                                    switch (fhirVersion) {
                                        case 2 :
                                            //need to walk through each type in the type array and set the 'targetProfile' property...
                                            item.data.type = [];

                                            ed.type.forEach(function (typ) {
                                                if (typ.profile) {
                                                    //if there's a profile, then this is a refrence.. todo - what about quantity???
                                                    typ.targetProfile = [typ.profile[0]];
                                                    delete typ.profile;
                                                    item.data.type.push(typ)
                                                } else {
                                                    //Other data types
                                                    item.data.type.push(typ)
                                                }
                                            })
                                            break;
                                        case 3 :
                                            item.data.type = [];
                                            //targetprofile is single - make it multiple
                                            ed.type.forEach(function (typ) {
                                                if (typ.targetProfile) {
                                                    typ.targetProfile = [typ.targetProfile]
                                                }
                                                item.data.type.push(typ)
                                            });

                                            //item.data.type = ed.type;
                                            break;
                                        case 4 :
                                            item.data.type = ed.type;
                                            break;
                                        default :
                                            alert('unknown FHIR version: '+fhirVersion)

                                    }

                                }



                                if (item.data.type) {
                                    item.data.type.forEach(function(typ) {
                                        if (['CodeableConcept', 'Coding', 'code'].indexOf(typ.code) > -1) {
                                            item.data.isCoded = true;
                                        }
                                    })
                                } else {
                                    //the Composition.section.section has no type. Make it a BBE todo - investigate further

                                    item.data.type = [{code:'BackboneElement'}]
                                }



                                //item.data.type = ed.type;
                                item.data.min = ed.min;
                                item.data.max = ed.max;
                                item.data.comments = ed.comments;

                                //set the mapping
                                item.data.mappingFromED = [{identity: 'fhir', map: path}];
                                //decorate the type elements...

                                decorateTreeView(item,ed);     //common decorator functions like isComplex

                                if (ed.binding) {
                                    if (fhirVersion == 4) {
                                        //{strength:, description:, valueSet:}
                                        item.data.selectedValueSet = ed.binding;
                                    } else {
                                        item.data.selectedValueSet = {strength: ed.binding.strength};



                                        //  12/2/2018  change to using vsReference, but need to preserve the old stuff...
                                        if (ed.binding.valueSetUri) {
                                            item.data.selectedValueSet.valueSet = ed.binding.valueSetUri;   //todo - not sure of this..
                                        }

                                        if (ed.binding.valueSetReference && ed.binding.valueSetReference.reference) {
                                            item.data.selectedValueSet.valueSet = ed.binding.valueSetReference.reference;
                                            //item.data.selectedValueSet.vs = {url: ed.binding.valueSetReference.reference};
                                        }

                                        if (item.data.selectedValueSet.vs) {
                                            //item.data.selectedValueSet.vs.name = ed.binding.description;
                                            item.data.selectedValueSet.description = ed.binding.description;
                                        }

                                    }
                                }

/*
                                //note that we don't retrieve the complete valueset...
                                if (ed.binding) {
                                    item.data.selectedValueSet = {strength: ed.binding.strength};
                                    item.data.selectedValueSet.vs = {url: ed.binding.valueSetUri};
                                    item.data.selectedValueSet.vs.name = ed.binding.description;


                                    //this is a reference not a name - make up a uri (todo - load the reference to get the URL
                                    if (ed.binding.valueSetReference) {
                                        //todo - this is safe ONLY when loading one of the base types in the spec...
                                        item.data.selectedValueSet.vs.url = ed.binding.valueSetReference.reference;
                                    }

                                }
*/

                                treeData.push(item);
                            }


                        }
                    })


                }


            },
            getModelHistory: function (id) {


                var url = appConfigSvc.getCurrentConformanceServer().url + "StructureDefinition/" + id + "/_history";
                return GetDataFromServer.adHocFHIRQueryFollowingPaging(url)

                //return $http.get(url);
            },
            createTreeArrayFromSD: function (sd) {
                //generate the array that the tree uses from the StructureDefinition
                var fhirVersion = appConfigSvc.getCurrentConformanceServer().version;
                var mappingCommentUrl = appConfigSvc.config().standardExtensionUrl.edMappingComment;
                var mapToModelExtensionUrl = appConfigSvc.config().standardExtensionUrl.mapToModel;
                var baseTypeForModel = appConfigSvc.config().standardExtensionUrl.baseTypeForModel;
                var simpleExtensionUrl = appConfigSvc.config().standardExtensionUrl.simpleExtensionUrl;
                var discriminatorUrl = appConfigSvc.config().standardExtensionUrl.discriminatorUrl;
                var conceptMapUrl = appConfigSvc.config().standardExtensionUrl.conceptMapUrl;
                var editorUrl = appConfigSvc.config().standardExtensionUrl.editor;
                var usageGuideUrl = appConfigSvc.config().standardExtensionUrl.usageGuide;
                var legacyUrl = appConfigSvc.config().standardExtensionUrl.legacy;

                var examplesUrl = appConfigSvc.config().standardExtensionUrl.examples;
                var referencesUrl = appConfigSvc.config().standardExtensionUrl.references;

                var lmReviewReasonUrl = appConfigSvc.config().standardExtensionUrl.lmReviewReason;
                var misuseUrl = appConfigSvc.config().standardExtensionUrl.misuse;
                var edStatusUrl = appConfigSvc.config().standardExtensionUrl.edStatus;
                var lmElementLinkUrl = appConfigSvc.config().standardExtensionUrl.lmElementLink;
                var autoExpandUrl = appConfigSvc.config().standardExtensionUrl.autoExpand;

                var enableCommentsUrl = appConfigSvc.config().standardExtensionUrl.enableComments;

                if (!lmElementLinkUrl) {
                    alert("You must restart clinFHIR (clinfhir.com) then reload Logical Modeller to reset updated config")
                    return [];
                }

                var cntExtension = 0;
                var arTree = [];
                if (sd && sd.snapshot && sd.snapshot.element) {
                    sd.snapshot.element.forEach(function (ed,inx) {
                        var include = true;

                        var path = ed.path;     //this is always unique in a logical model...
                        var arPath = path.split('.');
                        var item = {data:{}};

                        item.id = path;

                        item.data.idFromSD = ed.id;   //retain the original id - won't change even of the path changes...

                        var text = arPath[arPath.length - 1];   //the text will be the last entry in the path...

                        //if the text has an underscore, then remove it...
                        var ar = text.split('_');
                        item.text = ar[0];
                        item.data.pathSegment = text;    //this is the actual path segment (possibly with _n). Needed for the setpath() finction in the controller

                        //give a unique name if an extension...
                        if (item.text === 'extension') {
                            item.text = 'extension_' + cntExtension;
                            item.id = path += "_" + cntExtension;

                            cntExtension++;

                            //see if this extension points to an extension definition
                            if (ed.type && (ed.type[0].profile || ed.type[0].targetProfile) ) {

                            } else {
                                include = false;
                            }

                        }


                        //show if an element is multiple...
                        if (ed.max == '*') {
                            //    item.text += " *"
                        }

                       // item.data = {};
                        if (arPath.length == 1) {
                            //this is the root node
                            item.parent = '#';
                            item.data.isRoot = true;
                            //now set the header data...
                            item.data.header = {};
                            item.data.header.SDID = sd.id;
                            item.data.header.name = sd.name;
                            item.data.header.SDUrl = sd.url;

                            //the name of the next 2 elements changed after baltimore, so look in both places until the other stu3 servrs catch up...
                            item.data.header.purpose = sd.purpose || sd.requirements;
                            item.data.header.title = sd.title || sd.display;
                            item.data.header.publisher = sd.publisher;
                            item.data.header.extension = sd.extension;     //save any resource level extensions...

                            //see if this model has a base type
                            var ext1 = Utilities.getSingleExtensionValue(sd, baseTypeForModel);
                            if (ext1 && ext1.valueString) {
                                item.data.header.baseType = ext1.valueString;
                            }

                            //see if this model has an editor
                            var ext1 = Utilities.getSingleExtensionValue(sd, editorUrl);
                            if (ext1 && ext1.valueString) {
                                item.data.header.editor = ext1.valueString;
                            }

                            //see if this model enables comments
                            var ext1 = Utilities.getSingleExtensionValue(sd, enableCommentsUrl);
                            if (ext1 && ext1.valueBoolean) {
                                item.data.header.enableComments = ext1.valueBoolean;
                            }



                            //note that mapping node is different in the SD and the ED - but in the same place in the treeData
                            if (sd.mapping && sd.mapping.length > 0) {

                                item.data.header.mapping = sd.mapping[0].comments;
                                item.data.mapping = sd.mapping[0].comments;     //for the report & summary view...
                            }
                            if (sd.useContext) {
                                item.header = {type: sd.useContext[0].valueCodeableConcept.code};
                            }

                        } else {
                            //otherwise the parent can be inferred from the path
                            arPath.pop();//
                            item.parent = arPath.join('.');


                        }
                        item.state = {opened: true};     //default to fully expanded

                        //look for usageGuide
                        var ext1 = Utilities.getSingleExtensionValue(ed, usageGuideUrl);
                        if (ext1 && ext1.valueString) {
                            item.data.usageGuide = ext1.valueString;
                        }
                        //look for misuse note
                        var ext1 = Utilities.getSingleExtensionValue(ed, misuseUrl);
                        if (ext1 && ext1.valueString) {
                            item.data.misuse = ext1.valueString;
                        }
                        //look for legacy note

                        var ext1 = Utilities.getSingleExtensionValue(ed, legacyUrl);
                        if (ext1 && ext1.valueString) {
                            item.data.legacy = ext1.valueString;
                        }

                        var ext1 = Utilities.getSingleExtensionValue(ed, examplesUrl);
                        if (ext1 && ext1.valueString) {
                            item.data.examples = ext1.valueString;
                        }

                        var ext1 = Utilities.getSingleExtensionValue(ed, referencesUrl);
                        if (ext1 && ext1.valueString) {
                            item.data.references = ext1.valueString;
                        }

                        //look for autoexpand
                        var ext1 = Utilities.getSingleExtensionValue(ed, autoExpandUrl);
                        if (ext1 && ext1.valueBoolean) {
                            item.data.autoExpand = ext1.valueBoolean;
                        }

                        //look for review reason
                        var ext1 = Utilities.getSingleExtensionValue(ed, lmReviewReasonUrl);
                        if (ext1 && ext1.valueString) {
                            item.data.lmReviewReason = ext1.valueString;
                        }

                        //look for review reason
                        var ext1 = Utilities.getSingleExtensionValue(ed, lmElementLinkUrl);
                        if (ext1 && ext1.valueString) {
                            item.data.lmElementLink = ext1.valueString;
                        }

                        //look for ed Status
                        var ext1 = Utilities.getSingleExtensionValue(ed, edStatusUrl);
                        if (ext1 && ext1.valueString) {
                            item.data.edStatus = ext1.valueString;
                        } else {
                            item.data.edStatus = 'included';
                        }


                        item.data.fixedString = ed.fixedString;      //todo, this should probably be a type compatible with this element
                        item.data.path = path;
                        item.data.name = item.text;
                        item.data.short = ed.short;
                        item.data.description = ed.definition;
                        item.data.ed = ed;  //added for profileDiff
                        //item.data.type = ed.type;

                        item.data.mustSupport = ed.mustSupport;


                        //decorate the type elements...
                        decorateTreeView(item,ed);

                        var extSimpleExt = Utilities.getSingleExtensionValue(ed, simpleExtensionUrl);
                        if (extSimpleExt) {
                            item.data.fhirMappingExtensionUrl = extSimpleExt.valueString;
                        }

                        var extDiscriminator = Utilities.getSingleExtensionValue(ed, discriminatorUrl);
                        if (extDiscriminator) {
                            item.data.discriminator = extDiscriminator.valueString;
                        }

                        var extConceptMap = Utilities.getSingleExtensionValue(ed, conceptMapUrl);
                        if (extConceptMap) {
                            item.data.conceptMap = extConceptMap.valueString;
                        }

                        //format of type prpfile changed between 2 & 3
                        if (ed.type) {
                            var tvType = []

                            ed.type.forEach(function(typ){

                                if (typ.code) {
                                    var newTyp = {code:typ.code}
                                    switch (fhirVersion) {
                                        case 2 :
                                            //the profile is multiple
                                            if (typ.profile) {
                                                newTyp.targetProfile = typ.profile
                                            }
                                            break;
                                        case 3 :
                                            //targetProfile is single - make it multi
                                            if (typ.targetProfile) {
                                                newTyp.targetProfile = [typ.targetProfile];
                                            }

                                            break;
                                        case 4 :
                                            //targetProfile is multiple
                                            if (typ.targetProfile) {
                                                newTyp.targetProfile = typ.targetProfile;
                                            }

                                            break;
                                        default:
                                            alert('unknown FHIR version: '+fhirVersion)
                                    }

                                    //is this a coded type
                                    if (['CodeableConcept', 'Coding', 'code'].indexOf(typ.code) > -1) {
                                        item.data.isCoded = true;
                                    }

                                    //is this a reference
                                    if (typ.code == 'Reference') {
                                        item.data.isReference = true;   //used to populate the 'is reference' table...

                                        //todo = referenceUrl will need to become multiple when the tool supports that..
                                        switch (fhirVersion) {
                                            case 2 :
                                                //the profile is multiple
                                                if (typ.profile) {
                                                    item.data.referenceUrl = typ.profile[0];
                                                }

                                                break;
                                            case 3 :
                                                //targetProfile is single
                                                item.data.referenceUrl = typ.targetProfile;
                                                break;
                                            case 4 :
                                                //targetProfile is multiple
                                                item.data.referenceUrl = typ.targetProfile[0];
                                                break;
                                            default:
                                                alert('unknown FHIR version: '+fhirVersion)
                                        }


                                    }

                                    //is this a complex DT
                                    var first = newTyp.code.substr(0,1);
                                    if (first == first.toUpperCase()) {
                                        newTyp.isComplexDT = true;
                                    }

                                    tvType.push(newTyp)
                                } else {
                                    //todo - not sure of the significane of this, so don't show an alert...
                                    //alert('The Path '+ ed.path + ' has a type with no code')
                                    console.log(ed)
                                }

                            });



                            item.data.type = tvType;

                        }

                        item.data.min = ed.min;
                        item.data.max = ed.max;
                        item.data.alias = ed.alias;

                        if (ed.mapping) {           //the mapping path in the target resource...
                            item.data.mappingFromED = []; //ed.mapping;       //save all the mappings in an array...

                            //this is a horrible hack to cover the fact that hapi doesn't yet support the final R3...

                            ed.mapping.forEach(function(map){
                                var internalMap = {identity:map.identity}
                                var ar = map.map.split('|');        //the 'map' will always include the comment separated by '|'
                                internalMap.map = ar[0];            //the first entry is the actual map

                                //is this an extensiom - 2019-11-9 = was missing modifier extensions!
                                if (internalMap.map.indexOf('xtension') > -1) {
                                    item.data.isExtension = true;
                                }

                                //this just appears in the tree view
                                if (internalMap.map.indexOf('odifierExtension') > -1) {
                                    item.data.isModifierExtension = true;
                                }


                                if (map.comment) {
                                    internalMap.comment = map.comment
                                } else {
                                    internalMap.comment = ar[1];
                                }

                                item.data.mappingFromED.push(internalMap);

                            });
                        }

                        if (fhirVersion == 2) {
                            item.data.comments = ed.comments;
                        } else {
                            item.data.comments = ed.comment;
                        }

                        //note that we don't retrieve the complete valueset...
                        if (ed.binding) {


                            if (fhirVersion == 4) {
                                //{strength:, description:, valueSet:}
                                item.data.selectedValueSet = ed.binding;
                            } else {
                                item.data.selectedValueSet = {strength: ed.binding.strength};
                                item.data.selectedValueSet.description = ed.binding.description;


                                //  12/2/2018  change to using vsReference, but need to preserve the old stuff...
                                if (ed.binding.valueSetUri) {
                                    //what to do? This is not a reference...
                                    //item.data.selectedValueSet.vs = {url: ed.binding.valueSetUri};
                                  //  alert("There's a valueSet Uri binding on " + path + " which will be lost when you save this model.")\
                                    item.data.selectedValueSet.valueSet =  ed.binding.valueSetUri;  //was saving these as uri at one point...
                                }

                                if (ed.binding.valueSetReference && ed.binding.valueSetReference.reference) {
                                    //item.data.selectedValueSet.vs = {url: ed.binding.valueSetReference.reference};
                                    item.data.selectedValueSet.valueSet =  ed.binding.valueSetReference.reference;
                                }
/*
                                if (item.data.selectedValueSet.vs) {
                                    //also what to do??

                                    item.data.selectedValueSet.vs.name = ed.binding.description;
                                }
*/
                            }
                            /*
                            item.data.selectedValueSet = {strength: ed.binding.strength};



                            //  12/2/2018  change to using vsReference, but need to preserve the old stuff...
                            if (ed.binding.valueSetUri) {
                                item.data.selectedValueSet.vs = {url: ed.binding.valueSetUri};
                            }

                            if (ed.binding.valueSetReference && ed.binding.valueSetReference.reference) {
                                item.data.selectedValueSet.vs = {url: ed.binding.valueSetReference.reference};
                            }

                            if (item.data.selectedValueSet.vs) {
                                item.data.selectedValueSet.vs.name = ed.binding.description;
                            }
*/

                        }

                        if (include) {
                            arTree.push(item);
                        }

                    });


                }

                return arTree;
            },
            makeSD: function (scope, treeData) {
                var fhirVersion = appConfigSvc.getCurrentConformanceServer().version;


                //create a StructureDefinition from the treeData //todo - don't pass in scope...
                var header = treeData[0].data.header || {};     //the first node has the header information

                var mappingCommentUrl = appConfigSvc.config().standardExtensionUrl.edMappingComment;
                var mapToModelExtensionUrl = appConfigSvc.config().standardExtensionUrl.mapToModel;
                var baseTypeForModelUrl = appConfigSvc.config().standardExtensionUrl.baseTypeForModel;
                var simpleExtensionUrl = appConfigSvc.config().standardExtensionUrl.simpleExtensionUrl;
                var discriminatorUrl = appConfigSvc.config().standardExtensionUrl.discriminatorUrl;
                var conceptMapUrl = appConfigSvc.config().standardExtensionUrl.conceptMapUrl;
                var editorUrl = appConfigSvc.config().standardExtensionUrl.editor;
                var usageGuideUrl = appConfigSvc.config().standardExtensionUrl.usageGuide;
                var legacyUrl = appConfigSvc.config().standardExtensionUrl.legacy;

                var examplesUrl = appConfigSvc.config().standardExtensionUrl.examples;
                var referencesUrl = appConfigSvc.config().standardExtensionUrl.references;

                var autoExpandUrl = appConfigSvc.config().standardExtensionUrl.autoExpand;
                var lmReviewReasonUrl = appConfigSvc.config().standardExtensionUrl.lmReviewReason;
                var misuseUrl = appConfigSvc.config().standardExtensionUrl.misuse;
                var edStatusUrl = appConfigSvc.config().standardExtensionUrl.edStatus;
                var lmElementLinkUrl = appConfigSvc.config().standardExtensionUrl.lmElementLink;

                let enableCommentsUrl = appConfigSvc.config().standardExtensionUrl.enableComments;
                //todo - should use Utile.addExtension...
                var sd = {resourceType: 'StructureDefinition'};
                if (currentUser) {
                    this.addSimpleExtension(sd, appConfigSvc.config().standardExtensionUrl.userEmail, currentUser.email)
                }

                if (header.baseType) {
                    Utilities.addExtensionOnce(sd, baseTypeForModelUrl, {valueString: header.baseType})
                }

                if (header.editor) {
                    Utilities.addExtensionOnce(sd, editorUrl, {valueString: header.editor})
                }

                if (header.enableComments) {
                    Utilities.addExtensionOnce(sd, enableCommentsUrl, {valueBoolean: header.enableComments})
                }

                sd.id = scope.rootName;
                sd.url = appConfigSvc.getCurrentConformanceServer().url + "StructureDefinition/" + sd.id;
                sd.name = header.name;

                //these are some of the fhir version changes...
                if (fhirVersion ==2) {
                    sd.display = header.title;
                    sd.requirements = header.purpose;
                } else {
                    sd.title = header.title;
                    sd.purpose = header.purpose;
                }

                sd.publisher = header.publisher;
                sd.status = 'draft';
                sd.date = moment().format();

                sd.purpose = header.purpose;
                sd.description = header.description;

                //sd.publisher = scope.input.publisher;
                //at the time of writing (Oct 12), the implementaton of stu3 varies wrt 'code' & 'keyword'. Remove this eventually...
                sd.identifier = [{system: "http://clinfhir.com", value: "author"}]
                sd.keyword = [{system: 'http://fhir.hl7.org.nz/NamingSystem/application', code: 'clinfhir'}]

                if (header.mapping) {
                    //mapping comments for the target resource as a whole...
                    sd.mapping = [{identity: 'fhir', name: 'Model Mapping', comments: header.mapping}]
                }

                if (header.type) {
                    var uc = {
                        code: {
                            code: 'logicalType',
                            system: 'http:www.hl7.org.nz/NamingSystem/logicalModelContext'
                        }
                    };
                    uc.valueCodeableConcept = {
                        coding: [{
                            code: header.type,
                            'system': 'http:www.hl7.org.nz/NamingSystem/logicalModelContextType'
                        }]
                    };
                    sd.useContext = [uc]
                }

                sd.kind = 'logical';
                sd.abstract = false;
                sd.baseDefinition = "http://hl7.org/fhir/StructureDefinition/Element";
                sd.type = scope.rootName;
                sd.derivation = 'specialization';

                sd.snapshot = {element: []};

                treeData.forEach(function (item) {
                    var data = item.data;

                    var ed = {}
                    //this element is mapped to a simple extension. Do this first so the extensions are at the top...
                    if (data.fhirMappingExtensionUrl) {
                        Utilities.addExtensionOnce(ed, simpleExtensionUrl, {valueString: data.fhirMappingExtensionUrl})
                    }

                    //the 'name'(stu2) or 'label'(r3) is used for the display in the logical model generated from the profile
                    if (fhirVersion == 2) {
                        ed.name = item.text;
                        ed.comments = data.comments;
                    } else {
                        ed.label = item.text;
                        ed.comment = data.comments;
                    }

                    ed.id = data.idFromSD || data.path;  //gets assigned to the original path when the element is created
                    ed.path = data.path;
                    ed.short = data.short;
                    ed.definition = data.description || 'No description';
                    ed.min = data.min;
                    ed.max = data.max;

                    ed.mustSupport = data.mustSupport;

                    ed.alias = data.alias;



                    //a conceptMap associated with this element
                    if (data.conceptMap) {
                        Utilities.addExtensionOnce(ed, conceptMapUrl, {valueString: data.conceptMap})
                    }

                    //so all the mapping data for ED is in the 'mappingFromED' array...  {identity:, map:, comment:}
                    if (data.mappingFromED ) {
                        ed.mapping =  [];

                        //this will always have data as {identity:, map:, comment: }
                        data.mappingFromED.forEach(function(map){
                            if (map.identity && map.map) {

                                var savedMap = {identity:map.identity}
                                if (map.comment) {
                                    savedMap.map = map.map + "|" + map.comment
                                } else {
                                    savedMap.map = map.map + "|"
                                }
                                ed.mapping.push(savedMap);
                                /*
                                map.comment = map.comment || "";
                                //a horrible hack as hapi doesn't yet support comments. Always add the comments to the map.

                                var ar = map.map.split('|')
                                map.map = ar[0]+ "|"+map.comment;
                                ed.mapping.push({identity:map.identity, map: map.map, comment: map.comment});
                                */
                            }

                        })
                    }



                    //todo - not sure about this..
                    if (data.mapToModelUrl) {
                        //this element will actually be mapped to another model (eventually another profile)
                        //also added as an extension to the first mapping node mapping
                        var mapToModelNode = {}
                        if (ed.mapping) {
                            mapToModelNode = ed.mapping[0]
                        } else {
                            ed.mapping = []
                        }

                        //adds an extension of this url once only to the specified node
                        Utilities.addExtensionOnce(mapToModelNode, mapToModelExtensionUrl, {valueUri: data.mapToModelUrl})
                        ed.mapping = ed.mapping || []
                        ed.mapping[0] = mapToModelNode;


                    }


                    //the format and name of the 'profile' property changed between 2 & 3...
                    if (data.type) {
                        ed.type = [];
                        data.type.forEach(function (typ) {
                            var newTyp;
                            // {code:, targetProfile} - actually, there will only ever be one type at the moment...

                            if (typ.code == 'Reference') {
                                newTyp = {code:'Reference'}
                                //in the treeview, the profile is always named targetProfile and is single



                                switch (fhirVersion) {
                                    case 2 :
                                        //the profile is multiple
                                        newTyp.profile = typ.targetProfile;
                                        break;
                                    case 3 :
                                        //targetProfile is single
                                        newTyp.targetProfile = typ.targetProfile[0];
                                        break;
                                    case 4 :
                                        //targetProfile is multiple
                                        newTyp.targetProfile = typ.targetProfile;
                                        break;
                                    default:
                                        alert('unknown FHIR version: '+fhirVersion)
                                }


                                /*
                                if (fhirVersion == 2) {
                                    newTyp.profile = [typ.targetProfile]
                                } else {
                                    newTyp.targetProfile = typ.targetProfile;
                                }
                                */
                            } else {
                                newTyp = typ;
                            }
                            ed.type.push(newTyp);
                        })
                    }
//todo - wrong!
                    ed.base = {
                        path: ed.path, min: 0, max: '1'
                    };

                    if (data.selectedValueSet) {


                        if (fhirVersion == 4) {
                            ed.binding = data.selectedValueSet;     //this is now the default format

                        } else {
                            ed.binding = {strength: data.selectedValueSet.strength};

                            //  12/2/2018 - change to a reference...
                            //ed.binding.valueSetUri = data.selectedValueSet.vs.url;

                            ed.binding.valueSetReference = {reference: data.selectedValueSet.valueSet};
                            ed.binding.description = data.selectedValueSet.description;
                        }

                        /*
                        ed.binding = {strength: data.selectedValueSet.strength};

                        //  12/2/2018 - change to a reference...
                        //ed.binding.valueSetUri = data.selectedValueSet.vs.url;

                        ed.binding.valueSetReference = {reference: data.selectedValueSet.vs.url};
                        ed.binding.description = data.selectedValueSet.vs.name;
*/
                    }

                    ed.fixedString = data.fixedString;  //todo needs to be a compatible type

                    //used for slicing...
                    if (data.discriminator) {
                        Utilities.addExtensionOnce(ed, discriminatorUrl, {valueString: data.discriminator})
                    }

                    if (data.usageGuide) {
                        Utilities.addExtensionOnce(ed, usageGuideUrl, {valueString: data.usageGuide})
                    }

                    if (data.misuse) {
                        Utilities.addExtensionOnce(ed, misuseUrl, {valueString: data.misuse})
                    }
                    if (data.lmReviewReason) {
                        Utilities.addExtensionOnce(ed, lmReviewReasonUrl, {valueString: data.lmReviewReason})
                    }

                    if (data.lmElementLink) {
                        Utilities.addExtensionOnce(ed, lmElementLinkUrl, {valueString: data.lmElementLink})
                    }
                    if (data.edStatus) {
                        Utilities.addExtensionOnce(ed, edStatusUrl, {valueString: data.edStatus})
                    }

                    if (data.legacy) {
                        Utilities.addExtensionOnce(ed, legacyUrl, {valueString: data.legacy})
                    }

                    if (data.examples) {
                        Utilities.addExtensionOnce(ed, examplesUrl, {valueString: data.examples})
                    }

                    if (data.references) {
                        Utilities.addExtensionOnce(ed, referencesUrl, {valueString: data.references})
                    }

                    if (data.autoExpand) {
                        Utilities.addExtensionOnce(ed, autoExpandUrl, {valueBoolean: data.autoExpand})
                    }

                    sd.snapshot.element.push(ed)
                });

                return sd;

            },
            reOrderTree: function (treeData) {
                //ensure the elements in the tree array are sorted by parent / child
                var arTree = [treeData[0]];

                findChildren(treeData[0].data.path, treeData[0].id, arTree);
                return arTree;


                function findChildren(parentPath, parentId, arTree) {
                    treeData.forEach(function (node) {
                        if (node.parent == parentId) {
                            arTree.push(node);
                            var childPath = parentPath + '.' + node.data.name;

                            findChildren(childPath, node.id, arTree)
                        }
                    })

                }

            },
            generateChatDisplay: function (chatFromServer) {


                var ar = [];    //a list of all comments in display order

                function parseComment(ar, lvl, comment, levelKey) {
                    //lvl- display level, comment - the chat being examined

                    if (lvl == 1) {
                        levelKey = comment.id;
                    }

                    var displayComment = {level: lvl, comment: comment, levelKey: levelKey}
                    ar.push(displayComment);
                    //console.log(displayComment)
                    if (comment.children) {
                        lvl++;
                        comment.children.forEach(function (childComment) {
                            parseComment(ar, lvl, childComment, levelKey)
                        })
                    }

                }

                parseComment(ar, 0, chatFromServer);



                return ar


            },
            resolveProfileDEP: function (url) {
                //return a SD as a logical model from a profile that resolves extensions....
                var deferred = $q.defer();
                GetDataFromServer.findConformanceResourceByUri(url).then(
                    function (SD) {


                        if (SD && SD.snapshot && SD.snapshot.element) {
                            SD.snapshot.element.forEach(function (ed) {

                            })

                        }

                    }
                )
                return deferred.promise;

            },
            loadAllModels: function (conformanceServerUrl) {
                //$scope.conformanceServer
                var deferred = $q.defer();
                var url = conformanceServerUrl + "StructureDefinition?kind=logical&identifier=http://clinfhir.com|author";

                //var url="http://fhir3.healthintersections.com.au/open/StructureDefinition?kind=logical&identifier=http://clinfhir.com|author";
                GetDataFromServer.adHocFHIRQueryFollowingPaging(url).then(
                    // $http.get(url).then(
                    function (data) {
                        var bundleModels = data.data
                        bundleModels.entry = bundleModels.entry || [];    //in case there are no models
                        bundleModels.entry.sort(function (ent1, ent2) {
                            if (ent1.resource.id > ent2.resource.id) {
                                return 1
                            } else {
                                return -1
                            }
                        });
                        deferred.resolve(bundleModels);


                    },
                    function (err) {
                        deferred.reject('Error loading models: ' + angular.toJson(err));
                    }
                )
                return deferred.promise;
            },

            differenceFromBase : function(lm) {
               // var elementsToIgnore = ['id', 'meta', 'implicitRules', 'language', 'text', 'contained', 'extension', 'modifierExtension'];
                var that = this;
                var deferred = $q.defer();

                var lmBaseType = lm.snapshot.element[0].path;       //always the first in the list...

                //generate the differences between the Logical model and any base model defined
                var baseTypeForModel = appConfigSvc.config().standardExtensionUrl.baseTypeForModel;
                var extensionValue = Utilities.getSingleExtensionValue(lm,baseTypeForModel);
                if (extensionValue && extensionValue.valueString) {
                    var baseType = extensionValue.valueString;      //the type name of the core resource this one is based on.
                    baseProfileUrl = "http://hl7.org/fhir/StructureDefinition/"+baseType
                    var lmHash = getSDHash(lm);     //a hash keyed by path

                    GetDataFromServer.findConformanceResourceByUri(baseProfileUrl).then(
                        function(SD) {
                            var baseTypeHash = getSDHash(SD)

                            var analysis = {removed:[],added:[],changed:[]}
                            //first, move through all the elements in the lm. If there is not a corresponding path in the base profile (allowing for name changes) then it was added...
                            lm.snapshot.element.forEach(function(ed){
                                var adjustedPath = ed.path.setFirstSegment(baseType)    //note the setFirstSegment function was added to the string prototype at the top of this service

                                if (! baseTypeHash[adjustedPath]) {
                                    analysis.added.push(ed);
                                } else {
                                    //so the element is still present, was it changed?
                                    var lst = getDifferenceBetweenED(baseTypeHash[adjustedPath],ed)
                                    if (lst.length > 0) {
                                        analysis.changed.push({ed:ed,list:lst})
                                    }
                                }

                            });

                            //now move through the base profile. Any ed's not in the lm have been removed
                            SD.snapshot.element.forEach(function(ed){
                                var adjustedPath = ed.path.setFirstSegment(lmBaseType)    //note the setFirstSegment function was added to the string prototype at the top of this service

                                if (! lmHash[adjustedPath]) {
                                    //nope, gone. Do we care?
                                    if (elementsToIgnore.indexOf(adjustedPath.getLastSegment()) == -1 ) {
                                        //yes, we do...
                                        analysis.removed.push(ed);
                                    }
                                }

                            });





                            deferred.resolve(analysis)

                        },
                        function(err) {
                            deferred.reject(err)
                        }
                    )



                } else {
                    //this is not based on a single core resource type
                }
                return deferred.promise;

                function getDifferenceBetweenED(EDSource,EDTarg) {
                    var lst = []
                    if (EDSource.min !== EDTarg.min) {
                        lst.push({code:'minChanged',display: 'Minimum changed from '+ EDSource.min + ' to ' + EDTarg.min})
                    }
                    if (EDSource.max !== EDTarg.max) {
                        lst.push({code:'maxChanged',display: 'Maximum changed from '+ EDSource.min + ' to ' + EDTarg.min})
                    }

                    //todo check for both url and reference
                    if (EDSource.binding) {
                        if (EDTarg.binding) {
                            //the target has a binding - is it the same?
                            if (EDSource.binding.valueUri !== EDTarg.binding.valueUri) {
                                lst.push({code:'bindingUriChanged',display: 'ValueSet changed from '+ EDSource.binding.valueUri + ' to ' + EDTarg.binding.valueUri})
                            }
                        } else {
                            lst.push({code:'bindingUriChanged',display: 'Source Binding removed.'})
                        }

                    } else {
                        //the source has no binding, has the target?
                        if (EDTarg.binding) {

                        }
                    }


                    return lst;
                }

                function getSDHash(SD) {
                    var hash = {};
                    if (SD && SD.snapshot && SD.snapshot.element){
                        SD.snapshot.element.forEach(function(ed){
                            hash[ed.path] = ed;
                        })

                    }
                    return hash;
                }

            }

        }
    });
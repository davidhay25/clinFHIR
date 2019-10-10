angular.module("sampleApp")
//this performs marking services


    .service('taskSvc', function(appConfigSvc,moment) {



        let pathExtUrl = appConfigSvc.config().standardExtensionUrl.path;  //the extension for recording the model path for a comment
        let editorExtUrl = appConfigSvc.config().standardExtensionUrl.editor;
        let instanceAuthor = appConfigSvc.config().standardExtensionUrl.instanceAuthor;


        function getSingleExtensionValue(resource,url) {
            //return the value of an extension assuming there is only 1 (or get the last 1)...
            var extension;
            if (resource) {
                resource.extension = resource.extension || []
                resource.extension.forEach(function (ext) {
                    if (ext.url == url) {
                        extension = ext
                    }
                });
            }
            return extension;
        }


        return {
            makeHTMLFile : function(treedata,hashComments,model,stateHash) {

                var ctr = 0;
                let arReport = [];
                treedata.forEach(function (element) {

                    let id = element.id;
                    if (element.data && element.data.idFromSD) {
                        id = element.data.idFromSD
                    }

                    //let arComments = hashComments[element.id]
                    let arComments = hashComments[id]
                    if (arComments) {
                        arReport.push(addTaggedLine('h2',element.id))

                        arComments.forEach(function (comment) {
                            console.log(ctr++)

                            arReport.push("<table width='100%'>")
                            //arReport.push("<col style='width:50%'>")
                            //arReport.push("<col width='50%'>")
                            arReport.push("<tr>")

                            arReport.push("<td valign='top'  width='40%'>")
                            arReport.push(addTaggedLine('div',comment.description))
                            arReport.push(addTaggedLine('i',comment.requesterDisplay))
                            arReport.push("</td>")

                            arReport.push("<td width='40%'>")
                            if (comment.notes){
                                comment.notes.forEach(function (note) {
                                    arReport.push(addTaggedLine('div',note.text))
                                    arReport.push(addTaggedLine('i',note.authorString))
                                    arReport.push("<br/><br/>")
                                })
                            }

                            arReport.push("</td>")
                            arReport.push("<td valign='top' width='20%'>");
                            arReport.push(stateHash[comment.status])
                            arReport.push("</td>")
                            arReport.push("</tr>")
                            arReport.push("</table>")
                        })

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


                let html = header + arReport.join("\n") + footer;


                return html;

                function addTaggedLine(tag,line) {
                    return "<"+tag + ">"+line+"</"+tag+">"
                }

            },

            logError : function(obj) {

            },
            //return an internal task object from a FHIR resource
            getModelEditor : function(model) {
                let extSimpleExt = getSingleExtensionValue(model, editorExtUrl);
                if (extSimpleExt) {
                    return extSimpleExt.valueString;
                }

            },
            makeTaskListload : function(taskList) {
                let download = "Path,Comment,Email,Notes\n";

                taskList.forEach(function(task) {
                    let lne = task.path + ",";
                    lne += makeSafe(task.description) + ",";
                    lne += makeSafe(task.requesterDisplay) + ",";
                    let notes = "";

                    if (task.notes) {
                        task.notes.forEach(function (note) {
                            let n = note.text + ' ('+ note.authorString + ')\n';
                            n = n.replace(/"/g, "'");
                            n = n.replace(/,/g, "-");
                            //let s = makeSafe(n);

                            notes += '"'+n +'"'
                        })
                    }

                    lne += notes;
                    download += lne + "\n";

                });


                return download;

                //remove comma's and convert " -> '
                function makeSafe(s) {
                    if (s) {
                        s = s.replace(/"/g, "'");
                        s = s.replace(/,/g, "-");
                        return '"' + s + '"';
                    } else {
                        return "";
                    }


                }},
            getInternalTaskFromResource: function (resource,fhirVersion) {
                let iTask = {}       //internal task
                fhirVersion = fhirVersion || 3;     //default version
                //task.resource = resource;       //for degugging...
                iTask.id = resource.id;
                iTask.description = resource.description;
                iTask.statusReason = resource.statusReason;
                if (resource.note) {
                    iTask.notes = []
                    resource.note.forEach(function (note) {
                        let newNote = angular.copy(note);
                        if (note.time) {
                            let m = moment(note.time);
                            note.age = moment().diff(m,'hours');
                        }
                        iTask.notes.push(note)
                    })
                }

                //iTask.notes = resource.note;


                iTask.authoredOn = resource.authoredOn;

                let m = moment(iTask.authoredOn);
                iTask.age = moment().diff(m,'hours');
                //console.log(iTask.age)


                iTask.meta = resource.meta;

                iTask.status = resource.status || 'requested';

                if (resource.requester) {
                    switch (fhirVersion) {
                        case 3 :
                            if (resource.requester.agent) {
                                iTask.requesterReference = resource.requester.agent;      //this is a reference
                                iTask.requesterDisplay = resource.requester.agent.display;
                            }

                            break;
                        default :
                            iTask.requesterReference = resource.requester
                            iTask.requesterDisplay = resource.requester.display;
                            break;

                    }
                }

                let extSimpleExt = getSingleExtensionValue(resource, pathExtUrl);
                if (extSimpleExt) {
                    iTask.path = extSimpleExt.valueString;
                }

                let extSimpleExt1 = getSingleExtensionValue(resource, instanceAuthor);
                if (extSimpleExt1) {
                    iTask.instanceAuthor = extSimpleExt1.valueReference;
                }



                iTask.resource = resource;       //for degugging...

                return iTask

            }
        }
    })
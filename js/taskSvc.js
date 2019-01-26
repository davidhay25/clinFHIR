angular.module("sampleApp")
//this performs marking services


    .service('taskSvc', function(appConfigSvc) {


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
                iTask.notes = resource.note;
                iTask.authoredOn = resource.authoredOn;
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
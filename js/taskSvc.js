angular.module("sampleApp")
//this performs marking services


    .service('taskSvc', function(appConfigSvc) {


        var pathExtUrl = appConfigSvc.config().standardExtensionUrl.path;  //the extension for recording the model path for a comment


        function getSingleExtensionValue(resource,url) {
            //return the value of an extension assuming there is only 1...
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
                    let task = {}       //internal task
                    //task.resource = resource;       //for degugging...
                    task.id = resource.id;
                    task.description = resource.description;
                    task.notes = resource.note;
                    task.authoredOn = resource.authoredOn;

                    task.status = resource.status || 'requested';

                    if (resource.requester) {
                        switch (fhirVersion) {
                            case 3 :
                                if (resource.requester.agent) {
                                    task.requesterReference = resource.requester.agent;      //this is a reference
                                    task.requesterDisplay = resource.requester.agent.display;
                                }

                                break;
                            default :
                                task.requesterReference = resource.requester
                                task.requesterDisplay = resource.requester.display;
                                break;

                        }
                    }

                let extSimpleExt = getSingleExtensionValue(resource, pathExtUrl);
                if (extSimpleExt) {
                    task.path = extSimpleExt.valueString;
                }

                task.resource = resource;       //for degugging...

                return task

            }
        }
    })
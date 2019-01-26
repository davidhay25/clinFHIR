//endpoints for Task functionity

var request  = require('request');



function setup(app) {
    app.post('/myTask/addNote/:taskId',function(req,res){
        var body = "";
        req.on('data', function (data) {
            body += data;
        });
        req.on('end', function (data) {
            let obj;
            try {
                obj = JSON.parse(body);
                //{note: fhirServer:}
            } catch (ex) {
                res.status(500).send({msg:'Unable to parse input'})
                return
            }

            //console.log(obj.note,req.params.taskId,obj.fhirServer)
            let vo = {};
            vo.res = res;
            vo.data = obj.note;
            vo.fhirServer =  obj.fhirServer;
            vo.taskId = req.params.taskId

            //console.log(obj.note,req.params.taskId,obj.fhirServer)
            let url = obj.fhirServer + "Task/"+req.params.taskId;

            //function to actually apply the task update

            vo.updateFunction =  function(task,obj) {
                task.note = task.note || [];
                task.note.push(obj.note);

            };

            updateTask(vo)
        })

    });

    app.post('/myTask/changeStatus/:taskId',function(req,res){
        var body = "";
        req.on('data', function (data) {
            body += data;
        });
        req.on('end', function (data) {

            try {
                var obj = JSON.parse(body);
                //{note:, fhirServer:, status:, email:, who:}
            } catch (ex) {
                res.status(500).send({msg:'Unable to parse input'})
                return
            }

            //console.log(obj.note,req.params.taskId,obj.fhirServer)
            let vo = {};
            vo.res = res;
            vo.data = {status: obj.status, note:obj.note, who: obj.who};
            vo.fhirServer =  obj.fhirServer;
            vo.taskId = req.params.taskId;
            vo.createProvenance = false;
            vo.email = obj.email;

            let url = obj.fhirServer + "Task/"+req.params.taskId;

            vo.updateFunction = function(task,obj) {
                //obj = {note:, status:}
                task.status = obj.status;       //the new status
                if (obj.who) {
                    //this is an extension   {url:, valueReference: }
                    task.extension = task.extension || []
                    //remove any existing with this url
                    let found = false;
                    for (var ext in task.extension) {
                        if (ext.url == obj.who.url) {
                            ext.valueReference = obj.who.valueReference;
                            found = true;
                            break;
                        }
                    }
                    if (! found) {
                        task.extension.push(obj.who)
                    }

                    //task.extension.push
                }
                if (obj.note) {
                    task.statusReason = {text:obj.note.text};       //is a CC
                    task.note = task.note || [];
                    task.note.push(obj.note);

                }
            };

            updateTask(vo)
        })

    });


}

//function updateTask(taskId, fhirServer, updateFn,res) {
function updateTask(vo) {
    try {

        console.log (vo)

        let url = vo.fhirServer + "Task/"+vo.taskId;
        let options = {
            method:'GET',
            rejectUnauthorized: false,
            uri : url,
            headers: {
                'Accept': 'application/json+fhir'
            }
        };

        request(options,function(error,response,body){

            if (body) {
                console.log(body)
                try {
                    let task = JSON.parse(body)
                    vo.updateFunction(task,vo.data);

                    options.method = 'PUT';
                    options.body = JSON.stringify(task);
                    request(options,function(error,response,body){
                        if (response && response.statusCode == '200' ) {

                            //Create provenance. needs to be version specific...
                            if (vo.createProvenance && vo.email) {
                                let provenance = {resourceType:'Provenance',target:[],agent:[]}
                                provenance.recorded = new Date().toISOString();
                                provenance.target.push({reference:response.headers.location});  //from the previous call
                               // provenance.target.push({reference:'Task/'+task.id});  //from the previous call
                               // provenance.target.push('Task/'+task.id);
                                provenance.agent.push({whoReference : {display:vo.email}});
                                options.method = 'POST';
                                options.body = JSON.stringify(provenance);
                                options.uri = vo.fhirServer + "Provenance/";
                                request(options,function(error,response,body) {
                                    if (response && response.statusCode == '201') {
                                        vo.res.send();
                                    } else {
                                        vo.res.status(500).send({
                                            msg: 'Error creating Provenance ' + ex.message,
                                            oo: body
                                        })
                                    }
                                })


                            } else {
                                vo.res.send();
                            }




                        } else {
                            vo.res.status(500).send({msg:'Unable to PUT updated task. ',oo:body})
                        }
                    })
                } catch (ex) {
                    vo.res.status(500).send({msg:ex.message})
                }


            } else {
                vo.res.status(500).send({})
            }

        });

    } catch (ex) {
        vo.res.status(500).send({msg:'Unexpected error: ' + ex.message})
    }
}


module.exports = {
    setup : setup
};


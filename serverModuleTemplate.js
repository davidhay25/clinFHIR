//endpoints for Task functionity

let request  = require('request');

let wss,WebSocket;


function setup(app,iwss,iWebSocket) {
    wss = iwss
    WebSocket = iWebSocket


    //receive a bundle,
    app.post('/myTemplate',function(req,res){
        var body = "";
        req.on('data', function (data) {
            body += data;
        });
        req.on('end', function (data) {
            if (data) {
                body += data;
            }
        })



    });



    app.post('/myTask/addTask/:taskId',function(req,res){
        var body = "";
        req.on('data', function (data) {
            body += data;
        });
        req.on('end', function (data) {
            if (data) {
                body += data;
            }


            let vo;
            try {
                vo = JSON.parse(body);
            } catch (ex) {
                res.status(500).send({msg: 'Unable to parse input'})
                return
            }

            let task = vo.task;
           // let ip = req.connection.remoteAddress;
           // sendSocketBroadcast(task, ip);

            let url = vo.fhirServer + "Task/"+task.id;
            let options = {
                method:'PUT',
                body: JSON.stringify(task),
                rejectUnauthorized: false,
                uri : url,
                headers: {
                    'Content-Type': 'application/fhir+json'
                }
            };

            request(options,function(error,response,body){

                if (response && (response.statusCode == '200' || response.statusCode == '201') ) {      //should always be 201...

                    let tsk = vo.task;
                    tsk.ip = req.connection.remoteAddress;
                    sendSocketBroadcast(tsk);
                    res.send()
                } else {
                    res.status(500).send({msg:'Unable to save task'})
                }
            })


        })

    });

    app.post('/myTask/addNote/:taskId',function(req,res){
        var body = "";
        req.on('data', function (data) {
            body += data;
        });
        req.on('end', function (data) {



            let obj;
            try {
                obj = JSON.parse(body);
            } catch (ex) {
                res.status(500).send({msg:'Unable to parse input'})
                return
            }

            //let ip = req.connection.remoteAddress;
            //sendSocketBroadcast(obj,ip);


            //console.log(obj.note,req.params.taskId,obj.fhirServer)
            let vo = {};
            vo.res = res;
            vo.data = obj.note;
            vo.fhirServer =  obj.fhirServer;
            vo.taskId = req.params.taskId
            vo.socketObj = obj;
            vo.socketObj.ip = req.connection.remoteAddress;





            //console.log(obj.note,req.params.taskId,obj.fhirServer)
            //let url = obj.fhirServer + "Task/"+req.params.taskId;

            //function to actually apply the task update

            vo.updateFunction =  function(task,note) {
                task.note = task.note || [];
                task.note.push(note);

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

            //let ip = req.connection.remoteAddress;
            //sendSocketBroadcast(obj,ip);

            //console.log(obj.note,req.params.taskId,obj.fhirServer)
            let vo = {};
            vo.res = res;
            vo.data = {status: obj.status, note:obj.note, who: obj.who};
            vo.fhirServer =  obj.fhirServer;
            vo.taskId = req.params.taskId;
            vo.createProvenance = false;
            vo.email = obj.email;

            vo.socketObj = obj;
            vo.socketObj.ip = req.connection.remoteAddress;


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



module.exports = {
    setup : setup
};


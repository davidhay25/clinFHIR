//endpoints for patient corrections Task functionity

let request  = require('request');

let serverUrl =  "http://home.clinfhir.com:8054/baseR4/"


function setup(app) {

    app.get('/fhir/Task',function(req,res){
        let qry = req.query;
        if (qry.reasonReference) {
            //used to find the subtasks that refer to this one...

            //get the Task - to get the patient

            //get all the tasks for the patient

            //iterate through them to get the references tasks
        }

        //what to do if this is a different query? Should it only be this one - other queries can go directly to the server
        console.log(qry);
        res.send(qry)
    })


    //get a single Communication by id
    app.get('/fhir/Communication/:id',function(req,res){
        let id = req.params.id
        let url = serverUrl + "Communication/" + id
        executeQuery(url,function (resource) {
            if (resource) {
                res.json(resource)



            } else {
                res.status(404)
            }
        })

    })


    //a simple implementation of an 'about' SP
    app.get('/fhir/Communication',function(req,res){
        let qry = req.query;
        if (qry.about) {
            //there is a query on about. This will return all the Communications which have an 'about link to the supplied one (a token)
            //assume the about only has the ie - eg [host]/Communication?about={communication id}

            let resultBundle = {resourceType:'Bundle',type:'searchset',entry:[]} //the bundle of matching resources
            //get the Communication that the 'about' references - then get the patient from that and the task - which can be added to the list
            let url = serverUrl + "Communication/"+qry.about;   //todo check for type in query
            //todo - add _include for patient...
            executeQuery(url,function(resource){
                if (resource) {
                    //got the target communication resource
                    let patientId = resource.subject.reference;     //eg Patient/patient2
                    console.log('patientid',patientId)
                    //get all communication resources for this patient
                    url =  serverUrl + "Communication?subject="+ patientId

                    executeQuery(url,function(set){
                        //then go through eack one, looking for those that have an 'about' reference to the primary
                        set.entry.forEach(function (entry){
                            console.log(entry.resource.about)
                            if (entry.resource.about) {
                                entry.resource.about.forEach(function (ref) {
                                    if (ref.reference == qry.about) {
                                        //yep - this resources references the target one
                                        resultBundle.entry.push(entry.resource)
                                    }

                                })
                            }
                        })
                    })

                    //at this point we should have all Communications that have an 'about' reference to the target
                    res.json(resultBundle);


                } else {
                    //the 'about' resource doesn't exist on the server
                    res.json(resultBundle);     //this will be a bundle with no contents...
                }
            })
            //collect all the communication resources which are for that patient and check the 'about' element, adding them to the list

            //iterate throuh them
        } else {
            //proxy to the server
        }


        //what to do if this is a different query? Should it only be this one - other queries can go directly to the server
       // console.log(qry);
       // res.send(qry)
    })

    //return a single resource
    function executeQuery(url,cb) {
        console.log(url)
        let options = {
            method: 'GET',
            uri: url,
            headers: {
                'Accept': 'application/fhir+json'
            }
        };

        request(options, function (error, response, body) {

            if (body) {      //should always be 201...

                try {
                    cb(JSON.parse(body))
                } catch(ex) {
                    cb(null)
                }

            } else {
                cb(null)
            }

        })
    }

    function getBundle(url,cb) {
        console.log(url)
        let options = {
            method: 'GET',
            uri: url,
            headers: {
                'Accept': 'application/fhir+json'
            }
        };

        request(options, function (error, response, body) {

            if (body) {      //should always be 201...

                try {
                    cb(JSON.parse(body))
                } catch(ex) {
                    cb(null)
                }

            } else {
                cb(null)
            }

        })


        cb()
    }

    //receive a Communication resource. If the about is empty, then create a new task as well...
    app.post('/fhir/Communication',function(req,res) {
        var body = "";
        req.on('data', function (data) {
            body += data;
        });
        req.on('end', function (data) {
            if (data) {
                body += data;
            }
            let communication;
            try {
                communication = JSON.parse(body)
            } catch (ex) {
                res.status(400).json(makeOO('Unable to parse as JSON'))
                return
            }

                //todo - validate that the communication has the reqired fields to create a Task...

                console.log('communication',communication)

                //set the Id's so we can create the references...
                let taskId = 'cf-' + new Date().getTime() + "t"
                let communicationId = 'cf-' + new Date().getTime() + "c"


                communication.id = communicationId;
                console.log('communication.about',communication.about)

                if (communication.about) {
                    console.log('saving communication that has an about of '+ communication.about)
                    //This is a communication about an existing task. Just save it...
                    saveCommunication(communication,function(vo1){
                        if (vo1.status == 200) {
                            res.json(vo1.response)
                        } else {
                            res.status(vo1.status).json(vo1.response)
                        }

                    })

                } else {
                    //This is a new request, so make a task
                    console.log('Creating as task...')

                    //need to update the communication so it refers to the task
                    communication.about = {reference:"Task/"+taskId }

                    let task = {resourceType:'Task',id:taskId}
                    task.code = {coding:[{system:"https://www.maxmddirect.com/fhir/us/mmdtempterminology/6qlB89NQ/CodeSystem/FHIRPatientCorrectionTemp",code:"medRecCxReq"}]}
                    task.status = "received"
                    task.intent = "proposal"

                    if (communication.payload && communication.payload.length > 0 && communication.payload[0].contentString) {
                        task.description = communication.payload[0].contentString
                    } else {
                        task.description = "No description in Communication.payload[0].contentString"
                    }

                    task.for = communication.subject; //{reference:"Patient/"+$scope.input.patientId }
                    task.requester = communication.subject; // {reference:"Patient/"+$scope.input.patientId }     //assume requested by the patient
                    if (communication.recipient) {
                        task.owner = communication.recipient
                    }

                    let inp = {}
                    inp.type = {text:"Original communication"}
                    inp.valueReference = {reference:"Communication/"+communicationId }
                    task.input = [inp]

                    console.log('about to save task...')
                    saveTask(task,function(vo){
                        console.log("Return from save Task: " + vo.status)
                        if (vo.status == '201') {
                            //insert succeeded - now update the communication.about, save & return response
                            saveCommunication(communication,function(vo1){
                                console.log("Return from save Communication: " + vo.status)
                                if (vo1.status == '201') {
                                    //insert of Communication done as well.
                                    res.status(201).json(vo1.response)
                                } else {
                                    //Communication insert failed. bummer. todo - ideally in a transaction, but dies that limit servers that can be used?
                                    res.status(400).json(vo.response);      //the server should have returned an OO
                                    return
                                }
                            })

                        } else {
                            //task insert failed. return the response from the server
                            //res.status(400).json(makeOO('Unable to create task. Operation cancelled.'))
                            res.status(400).json(vo.response);      //the server should have returned an OO
                            return
                        }
                    })

                }






        })

        function saveTask(task,cb) {
            let options = {
                method:'PUT',
                uri : serverUrl + "Task/"+ task.id,
                body : JSON.stringify(task),
                headers: {
                    'Accept': 'application/json+fhir',
                    'Content-type': 'application/json+fhir'
                }
            };

            request(options,function(error,response,body){
                cb({status: response.statusCode, response:JSON.parse(body)})
            })
        }

        function saveCommunication(communication,cb) {
            let options = {
                method:'PUT',
                uri : serverUrl + "Communication/"+ communication.id,
                body : JSON.stringify(communication),
                headers: {
                    'Accept': 'application/json+fhir',
                    'Content-type': 'application/json+fhir'
                }
            };

            request(options,function(error,response,body){
                console.log(response.statusCode)
                cb({status: response.statusCode, response:JSON.parse(body)})

            })
        }

        function makeOO(text) {
            let oo = {resourceType:'OperationOutcome',issue:[{severity:'fatal',code:'',details:{text:text}}]}
            return oo
        }

    })

    app.get('/ctOpenTasks',function(req,res){

        let url = serverUrl + "Task?status:not=completed&&code=medRecCxReq";

        console.log(url)
        let options = {
            method:'GET',
            rejectUnauthorized: false,
            uri : url,
            headers: {
                'Accept': 'application/json+fhir'
            }
        };

        request(options,function(error,response,body){

            res.json(JSON.parse(body))
        })

    })


    /*
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

*/
}

//function updateTask(taskId, fhirServer, updateFn, res) {
function updateTaskDEP(vo) {
    try {

        //console.log (vo)

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
                //console.log(body)
                try {
                    let task = JSON.parse(body)
                    vo.updateFunction(task,vo.data);

                    options.method = 'PUT';
                    options.body = JSON.stringify(task);
                    request(options,function(error,response,body){
                        if (response && response.statusCode == '200' ) {

                            //Create provenance. needs to be version specific...
                            if (1==2 && vo.createProvenance && vo.email) {
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
                                if (vo.socketObj) {
                                    sendSocketBroadcast(vo.socketObj);
                                }
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


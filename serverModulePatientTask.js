//endpoints for patient corrections Task functionality

let request  = require('request');
let serverUrl =  "http://home.clinfhir.com:8054/baseR4/"


function setup(app) {


    app.get('/fhir/metadata',function(req,res){
        let cs = {'resourceType': 'CapabilityStatement', status:'active',date:'2021-09-14',kind:'instance'}
        cs.fhirVersion = '4.0.1'
        cs.format = ['application/fhir+json']
        cs.rest = [{mode:'server',documentation:'To support patient corrections',resource:[]}]
        let resource1 = {type:'Communication',interaction:[],searchParam:[]}
        resource1.interaction.push([{code:'read'}])
        resource1.interaction.push([{code:'create'}])
        resource1.interaction.push([{code:'search-type'}])
        resource1.searchParam.push({name:'about',type:'token'})
        cs.rest[0].resource.push(resource1)

        let resource2 = {type:'Task',interaction:[]}
        resource2.interaction.push([{code:'history-instance'}])
        resource2.interaction.push([{code:'update'}])
        cs.rest[0].resource.push(resource2)

        res.json(cs)

    })

    //get a
    app.get('/fhir/Task/:id/_history',function(req,res){
        let qry = serverUrl + "Task/" + req.params.id + "/_history?_count=50";
        executeQuery(qry,function(vo){
            if (vo.status == 200) {
                res.json(vo.response)
            } else {
                res.json(vo.status).json(vo.response)
            }
        })

    })


    //the implementation of Task?reasonReference
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
        executeQuery(url,function (vo) {
            if (vo) {
                res.json(vo.response)



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
            let url = serverUrl + "Communication?_id="+qry.about;   //todo check for type in query

            //add an _include for the patient and sender...
            url += "&_include=Communication:patient&_include=Communication:sender"

            getBundle(url,function(bundle1){

                if (bundle1) {
                    //console.log('first call', bundle1.resourceType)
                    //add all the resources into the returned bundle
                    let patientId;
                    bundle1.entry.forEach(function (entry) {
                        //console.log(entry.resource.resourceType)
                        resultBundle.entry.push(entry)
                        if (entry.resource.resourceType == 'Communication') {
                            if (entry.resource.subject) {
                                patientId = entry.resource.subject.reference;     //includes type
                            }

                        }
                    })

                    //got the target communication resource

                    //let patientId = resource.subject.reference;     //eg Patient/patient2

                    console.log('patientid',patientId)
                    //get all communication resources for this patient
                    url =  serverUrl + "Communication?subject="+ patientId
                    url += "&_count=50"

                    //console.log(url)
                    getBundle(url,function(set){
                        //console.log(set.resourceType)
                        //then go through each one, looking for those that have an 'about' reference to the primary
                        let searchReference = 'Communication/' + qry.about;
                        //console.log('looking for ' + searchReference)
                        set.entry.forEach(function (entry){
                            //console.log(entry.resource.about)
                            if ( entry.resource.about) {
                                //about is an array
                                entry.resource.about.forEach(function (ref) {
                                    //console.log(ref)
                                    if (ref.reference == searchReference) {
                                        //yep - this resources references the target one
                                        //console.log('match ' + entry.resource.id)
                                        resultBundle.entry.push({resource:entry.resource})
                                    }

                                })
                            }

                        })
                        console.log('done')

                        //at this point we should have all Communications that have an 'about' reference to the target
                        res.json(resultBundle);
                    })




                } else {
                    //the 'about' resource doesn't exist on the server
                    console.log("The 'about' resource was not found")
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

    //execute the given query
    function executeQuery(url,cb) {
        let log = {query:url}
        console.log(url)
        let options = {
            method: 'GET',
            uri: url,
            headers: {
                'Accept': 'application/fhir+json'
            }
        };

        request(options, function (error, response, body) {
//console.log(body)
            if (body) {
                try {
                    let json = JSON.parse(body)
console.log(response.statusCode)
                    cb({response:json, status:response.statusCode})
                    return;
                } catch(ex) {
                    console.log('invalid json', ex)
                    cb(null)
                }

            } else {
                console.log('no body')
                cb(null)
            }

        })
    }

    //retrieve the task that is associated with the primaryCommunication
    function getTaskForPrimaryCommunication(commId,cb) {
        //first, get the Communication
        let qry = serverUrl +commId ;//  id has type "Communication/"+ commId
        executeQuery(qry,function(vo){
            if (vo && vo.response) {
                //now get the Task from communication.about
                let communication = vo.response
                console.log(communication.id)
                if (communication.about) {
                    let t = communication.about[0].reference;
                    console.log(t)

                    let ar = t.split('/')
                    let qry1 = serverUrl + "Task/" + ar[1]
                    console.log(qry1)
                    executeQuery(qry1,function(vo1){
                        if (vo1) {
                            cb(vo1.response)
                        } else {
                            cb()
                        }

                    })
                } else {
                    cb()
                }
            } else {
                cb()
            }
        })

    }

    //todo same as execute query
    function getBundle(url,cb) {
        //console.log(url)
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
                    let json = JSON.parse(body)
                    cb(json)
                } catch(ex) {
                    cb(null)
                }

            } else {
                console.log('getBundle '+ url + 'has empty body' )
                cb(null)
            }

        })



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

            communication.sent = new Date().toISOString();      //server side, so all the same...

            //validate that the communication has the reqired fields to create a Task...
            let oo = validateCommunication(communication);
            if (oo.issue.length > 0) {
                res.status(400).json(oo)
                return
            }

            //always create an id for this communication
            let communicationId = 'cf-' + new Date().getTime() + "c"
            communication.id = communicationId;

            console.log('communication.about',communication.about)

            if (communication.about) {
                //This communication is on an existing trail (ie it won't create a task)
                console.log('saving communication that has an about of ', communication.about)
                //This is a communication about an existing task. Just save it...

                //first, get the task as we're going to need to update it
                // we forst have to get the primary Communication (what the .about refers to)
                //then the primary will have an .about reference to the task


                let ref = communication.about.reference;
                //let qry = serverUrl + "Task?focus=" + ref;      //has the type, but still seems to work OK

                //will return the task
                getTaskForPrimaryCommunication(ref,function(task){
                    if (task) {

                        console.log(task.id)
                        //need to look at the Communication.inResponseTo to determine the business status.
                        //if it exists, then it is a reply to a question...
                        if (communication.inResponseTo) {
                            task.businessStatus = {coding:[{code:'reply-received',system:'http://clinfhir.com/cs/corrections'}]}
                        } else {
                            task.businessStatus = {coding:[{code:'waiting-for-info',system:'http://clinfhir.com/cs/corrections'}]}
                            console.log(task.businessStatus)
                        }

                        task.status = "in-progress"
                        task.focus = {reference:'Communication/'+ communication.id}
                        //now create the update bundle

                        let bundle = {resourceType:'Bundle',type:'transaction',entry:[]}
                        let comEntry = {resource:communication,request:{method:'PUT',url:'Communication/' + communication.id}}
                        bundle.entry.push(comEntry)
                        let taskEntry = {resource:task,request:{method:'PUT',url:'Task/' + task.id}}
                        bundle.entry.push(taskEntry)

                        console.log('about to post transaction...')

                        POSTBundle(bundle,function(vo) {
                            console.log('posted update transaction')
                            let status = vo.status
                            let response = vo.response
                            if (status == 200) {
                                res.json(communication)
                            } else {
                                res.status(status).json(response)
                            }

                        })

                    } else {
                        //there was an error getting the Task
                        res.status(500).json(makeOO('There was no Task that had a focus reference to ' + ref))
                    }

                })

/*
                saveCommunication(communication,function(vo1){
                    if (vo1.status == 200) {
                        res.json(vo1.response)
                    } else {
                        res.status(vo1.status).json(vo1.response)
                    }
                })
                */

            } else {
                //This is a new request, so make a task
                console.log('Creating a new task...')

                //set the Id's so we can create the references...
                let taskId = 'cf-' + new Date().getTime() + "t"

                //need to update the communication so it refers to the task
                communication.about = {reference:"Task/"+taskId }

                let task = {resourceType:'Task',id:taskId}
                task.code = {coding:[{system:"http://hl7.org/fhir/uv/patient-corrections/CodeSystem/PatientCorrectionTaskTypes",
                        code:"medRecCxReq"}]}
                task.status = "ready"
                task.businessStatus = {Coding:[{code:"for-initial-review", system:"http://clinfhir.com/cs/corrections"}]}
                task.intent = "order"
                task.focus = {reference:"Communication/"+communicationId}
                //task.input = {reference:"Communication/"+communicationId}

                if (communication.topic) {
                    task.description = communication.topic
                } else {
                    if (communication.payload && communication.payload.length > 0 && communication.payload[0].contentString) {
                        task.description = communication.payload[0].contentString
                    } else {
                        task.description = "No description in Communication.payload[0].contentString"
                    }
                }

                task.for = communication.subject; //{reference:"Patient/"+$scope.input.patientId }
                if (communication.requestor) {
                    task.requestor = communication.requestor; // {reference:"Patient/"+$scope.input.patientId }     //assume requested by the patient
                } else {
                    task.requestor = communication.subject; // {reference:"Patient/"+$scope.input.patientId }     //assume requested by the patient
                }

                if (communication.recipient) {
                    task.owner = communication.recipient
                }

                let inp = {}
                inp.type = {text:"Original communication"}
                inp.valueReference = {reference:"Communication/"+communication.id }
                task.input = [inp]


                //create a bundle which will be POSTed to the server root...
                let bundle = {resourceType:'Bundle',type:'transaction',entry:[]}
                let comEntry = {resource:communication,request:{method:'PUT',url:'Communication/' + communication.id}}
                bundle.entry.push(comEntry)
                let taskEntry = {resource:task,request:{method:'PUT',url:'Task/' + task.id}}
                bundle.entry.push(taskEntry)

                console.log('about to post transaction...')

                POSTBundle(bundle,function(vo){
                    let status = vo.status
                    let response = vo.response
                    if (status == 200) {
                        res.json(communication)     //as this is a call to the Communication EP
                    } else {
                        res.status(400).json(response)
                    }
                })



            }
        })
/*
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

        //todo - could this be putResource?
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
*/
    })

    function validateCommunication(comm) {
        let oo = {resourceType : 'OperationOutcome',issue:[]}
        if (! comm.status || comm.status !== 'completed') {
            oo.issue.push({severity:'fatal',code:'invalid',details:{text:".status must be present with a value of 'completed'"}})
        }

        checkCCCodeFixedValue(comm.category, 'medRecCxReq',"Category must be present with a value of 'medRecCxReq'")
        checkCCCodeFixedValue(comm.statusReason, 'medRecCxReq',"Category must be present with a value of 'statusReason'")
        checkReferencePresent(comm.subject,"There must be a subject reference to the Patient")
        checkReferencePresent(comm.sender,"There must be a sender reference")
        checkReferencePresent(comm.recipient,"There must be a recipient reference")

        function checkReferencePresent(ref,msg) {
            if (! ref  || ! ref.reference) {
                oo.issue.push({severity:'fatal',code:'invalid',details:{text:msg}})
                return;
            }

        }

        //check that a cc element is present, with a fixed value
        function checkCCCodeFixedValue(cc,code,msg) {
            //if an array, get the first element
            if (! cc ) {
                oo.issue.push({severity:'fatal',code:'invalid',details:{text:msg}})
                return;
            }
            let ccValue;
            if (cc.isArray()) {
                if (cc.length < 1) {
                    oo.issue.push({severity:'fatal',code:'invalid',details:{text:msg}})
                    return;
                } else {
                    ccValue = cc[0]
                }

            } else {
                ccValue = cc
            }

            if (!ccValue.coding || (ccValue.coding.length < 1) || (ccValue.coding[0].code !== code)) {
                oo.issue.push({severity:'fatal',code:'invalid',details:{text:msg}})
            }
        }

    }

    app.get('/ctOpenTasks',function(req,res){

        let url = serverUrl + "Task?status:not=completed&code=medRecCxReq";

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

    app.get('/ctAllTasks',function(req,res){

        let url = serverUrl + "Task?code=medRecCxReq";

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


    function makeOO(text) {
        let oo = {resourceType:'OperationOutcome',issue:[{severity:'fatal',code:'invalid',details:{text:text}}]}
        return oo
    }

    function putResource(resource,cb) {
        let options = {
            method:'PUT',
            uri : serverUrl + resource.resourceType + "/"+ resource.id,
            body : JSON.stringify(resource),
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

    function POSTBundle(bundle,cb) {
        let options = {
            method:'POST',
            uri : serverUrl,        //ie the transaction root
            body : JSON.stringify(bundle),
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

    //============= proxy endpoints

    //update a resource - eg a task
    app.put('/fhir/:type/:id',function(req,res){
        var body = "";
        req.on('data', function (data) {
            body += data;
        });
        req.on('end', function (data) {
            if (data) {
                body += data;
            }
        let resource;
        try {
            resource = JSON.parse(body)
            putResource(resource,function(vo){
                if (vo.status == 200 || vo.status == 201) {
                    res.json(vo.response)
                } else {
                    res.status(400).json(vo.response)
                }
            })
        }  catch (ex) {
            res.status(400).json(makeOO('Invalid Json' ))
        }


        })
    })


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


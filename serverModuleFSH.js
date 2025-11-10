

const gofshClient = require('gofsh').gofshClient;


function setup(app) {

//transform json -> fsh using goFsh - single resource only. very slow...
    app.post('/fsh/transformJsonToFsh',async function(req,res) {

        //console.log(req.body)
        let body = req.body
        if (body) {
            try {
                let resourceId = body.id
                let json = JSON.stringify(body)

                let config = {logLevel:'silent'}
                console.time("goFsh");
                gofshClient
                    .fhirToFsh([json],config)
                    .then((result) => {
                        // handle results
                        console.timeEnd("goFsh");
                        result.resourceId = resourceId
                        res.json(result)
                    })
                    .catch((ex) => {
                        // handle thrown errors
                        res.status(400).json({msg:ex.message})
                    });

/*
                console.time("goFsh");
                let result = await gofshClient.fhirToFsh([json],{style:'map',dependencies: ['hl7.fhir.r4.core#4.0.1'],logLevel:'error'})
                console.timeEnd("goFsh");
                //console.log(result)
                result.resourceId = resourceId
                res.json(result)

                */

            } catch (ex) {
                res.status(400).json({msg:ex.message})
            }

        } else {
            res.json({})
        }

        

        return


       // let body = '';
        req.on('data', function (data) {
            body += data;
        });

        req.on('end', function () {

            void async function() {
                let results;
                console.log(body)
                let result = await gofshClient.fhirToFsh([body],{style:'map',dependencies: ['hl7.fhir.r4.core#4.0.1'],logLevel:'error'})

                //result.dhInstances = Object.fromEntries(result.fsh.instances);

                res.json(result)
            }()

        })
    })
}


module.exports= {
    setup : setup
}
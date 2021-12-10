

const gofshClient = require('gofsh').gofshClient;//.gofshClient


function setup(app) {


//transform json -> fsh using goFsh - single resource only
    app.post('/fsh/transformJsonToFsh',function(req,res) {
        let body = '';
        req.on('data', function (data) {
            body += data;
        });

        req.on('end', function () {

            void async function() {
                let results;
                console.log(body)
                let result = await gofshClient.fhirToFsh([body],{style:'map',dependencies: ['hl7.fhir.r4.core#4.0.1'],logLevel:'debug'})

                //result.dhInstances = Object.fromEntries(result.fsh.instances);

                res.json(result)
            }()

        })
    })
}


module.exports= {
    setup : setup
}
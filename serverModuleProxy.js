//========= proxy endpoints. Used by the connectathon UI to query a server, and by CDS-hooks function =======

const request = require('request');     //todo deprecate request
const axios = require('axios')

//assume a local hapi server (in a container) listening on port 8080 - todo environment var
//and don't change the service name in the compose file!!!

const validationServer = process.env.HAPISERVER || "http://localhost:9090/fhir"


//const validationServer = "http://hapi-fhir:8080/fhir"
//const validationServer = "http://localhost:9090/fhir"

function setup(app,indb) {


    //a new proxy.
    app.get('/proxyRequest', async function(req,res){
        let query =  req.query.qry
        if (query) {
            console.log(query)

            try {
                let response = await axios.get(query)
                //console.log(resource)
                res.json(response.data)
            } catch (ex) {
                res.status(500).json({msg:ex.message})
            }
        } else {
            res.status(300).json({msg:"Must include a 'qry' parameter"})
        }


    })



    //validation option

    app.post('/validate',async function(req,res){
        let resource = req.body
        let resourceType = resource.resourceType

        let qry = `${validationServer}/${resourceType}/$validate`
        console.log('validate' + qry)
        try {
            let response = await axios.post(qry,resource)
            //console.log(resource)
            res.json(response.data)
        } catch (ex) {
            res.status(500).json({msg:ex.message})
        }

    })


    //modern express doesn't recognize /* syntax
    app.get(/^\/proxyfhir(.*)/, function (req, res) {
    //app.get('/proxyfhir*', function (req, res) {
        //app.get('/proxyfhir/*', function (req, res) {

        const fhirPath = req.params[0] || ''; // everything after /proxyfhir
        const fhirQuery = fhirPath.startsWith('/') ? fhirPath.slice(1) : fhirPath;


       // var fhirQuery = req.originalUrl.substr(11); //strip off /proxyfhir
        //console.log('proxying: '+ fhirQuery)
        var options = {
            method: 'GET',
            uri: fhirQuery,
            encoding: null
        };

        //options.headers = {accept: 'application/fhir+json'};
        options.headers = {accept: 'application/fhir+json, application/json','content-type':'application/json}'};
        //options.headers[{'content-type':'application/json}']
        request(options, function (error, response, body) {
            if (error) {
                console.log('error:', error)
                var err = error || body;
                res.send(err, 500)
            } else if (response && response.statusCode !== 200) {
                console.log(response.statusCode)
                res.send(body, response.statusCode);//,'binary')
            } else {
                res.send(body);//,'binary')
            }
        })
    });

    //app.post('/proxyfhir/*', function (req, res) {
        //var fhirQuery = req.originalUrl.substr(11); //strip off /proxyfhir

    app.post(/^\/proxyfhir(.*)/, function (req, res) {
        const fhirPath = req.params[0] || '';
        const fhirQuery = fhirPath.startsWith('/') ? fhirPath.slice(1) : fhirPath;

        console.log('Proxying POST to: ' + fhirQuery);

        let payload= "";
        req.on('data', function (data) {
            payload += data;
        });

        req.on('end', function () {


        //console.log('payload',payload)
            let options = {
                method: 'POST',
                uri: fhirQuery,
                body: payload,
                headers: {'content-type': 'application/json'},
                encoding: null
            };

            request(options, function (error, response, body) {
                if (error) {
                    console.log('error:', error)
                    var err = error || body;
                    res.send(err, 500)
                } else if (response && response.statusCode !== 200) {
                    console.log('---------------');
                    console.log(response.statusCode);
                    console.log(body.toString());
                    console.log('---------------');
                    res.send(body, response.statusCode);//,'binary')
                } else {

                    res.send(body);//,'binary')

                }
            })

        })

    });
}

module.exports= {
    setup : setup
}
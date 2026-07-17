//========= proxy endpoints. Used by the connectathon UI to query a server, and by CDS-hooks function =======

//const request = require('request');     //todo deprecate request
const axios = require('axios')

//assume a local hapi server (in a container) listening on port 8080 - todo environment var
//and don't change the service name in the compose file!!!

//temp const validationServer = process.env.HAPISERVER || "http://localhost:8080/fhir"

let validationServer = "https://r4.ontoserver.csiro.au/fhir"


//const validationServer = "http://hapi-fhir:8080/fhir"
//const validationServer = "http://localhost:9090/fhir"

//docker run -p 9090:8080 hapiproject/hapi:latest

function setup(app,indb) {

    //proxy a GET call - returns whatever is returned in the query.
    //todo - is this function used any more?
    app.get('/proxyGet', async function(req,res){
        let query =  req.query.qry
        if (query) {
            query = decodeURIComponent(query)

            console.log(query)

            try {
                const response = await axios.get(query);

                res.json(response.data)
            } catch (ex) {
                res.status(400).json({msg:ex.message})
            }

        } else {
            res.status(400).json({msg:"Must include a 'qry' parameter"})
        }


    })


    //a new proxy. Assumes a FHIR query where there may be paging - get GET [host]/Patient
    app.get('/proxyRequest', async function(req,res){
        let query =  req.query.qry
        if (query) {

            console.log(query)

            let firstRun = true
            let returnBundle

            try {
                //let bundleType
                //let allEntries = [];
                let nextUrl = query
                while (nextUrl) {
                    const response = await axios.get(nextUrl);




                    if (firstRun) {
                        //get the bundle level data - everything but the entry. Needed for bundles like document...
                        returnBundle = response.data
                        firstRun = false
                        const nextLink = returnBundle.link?.find(link => link.relation === 'next');
                        nextUrl = nextLink ? nextLink.url : null;
                    } else {
                        //this is a subsequent run (after paging). We just add the new entries to the returnBundle
                        let bundle = response.data
                        if (bundle.entry) {
                            returnBundle.entry.push(...bundle.entry);
                        }
                        const nextLink = bundle.link?.find(link => link.relation === 'next');
                        nextUrl = nextLink ? nextLink.url : null;
                    }

                }


                res.json( returnBundle)
                //res.json( {resourceType:'Bundle',type:bundleType, entry:allEntries})

            } catch (ex) {
                console.log(ex.response?.data)
                res.status(400).json({msg:ex.message})
            }
        } else {
            res.status(400).json({msg:"Must include a 'qry' parameter"})
        }


    })



    //validation option

    app.post('/validate',async function(req,res){
        //pass in the resorce to be validated (usually a Bundle) and an optional validation server
        let obj = req.body

        let resource = obj.resource
        let resourceType = resource.resourceType

        let userValidationServer = obj.validationServer //what VS the user supplied

        let serverToUse = userValidationServer || validationServer

        serverToUse = serverToUse.endsWith('/') ? serverToUse : serverToUse + '/'

        let qry = `${serverToUse}${resourceType}/$validate`

        //console.log(qry)

        try {
            let response = await axios.post(qry,resource)
            res.json(response.data)
        } catch (ex) {

            if (ex.response) {
                res.json(ex.response.data)
            } else {
                res.status(500).json({msg:ex.message})
            }

        }

    })

}

module.exports= {
    setup : setup
}
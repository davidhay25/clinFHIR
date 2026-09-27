
//functions to support specific BundleVisualizer options

//const axios = require('axios')

const { ObjectId } = require('mongodb');

let database;

function setup(app,client) {

    database = client.db("clinfhir");


    //------------- REST queries against bundle

    //the /bqry route is exposed by the clinfhir stack (nginx)
    //only tested against bundle produced by $extract - and not sure if we want to support more generally anyway...
    //assume that all resources have uuid as fullUrl and references are to the uuid
    //assume that has a Patient and may have a QR as well as the extracted resourcs

    // ---------  supported API
    //{type}?patient={patientId}
    //{type}?subject={patientId}
    //{type}/{resourceid}


    /*
    * If the references aren't to the fullUrl (like PJ ones) could we adapt the bindle (during the search). ie
    *   find the patient and store the id and full url
    *   examine all other resource and update reference to the fullUrl of the patient
    *   ? a pre-process step of some sort
    *       actually is this about face? Should I convert an extract bundle into a format that better suits the rest query. ie
    *           iterate over bundle
    *               set id as fullUrl (assume to be uuid)
    *               if theres a reference
    *                   change to {type}/id

    *
    *           (need to check for references I create in the bundle - like IPS)
    *           but how do i know when to apply? should I apply it when saving a bundle from $extract??
    * */


    //{type}/{resourceid}
    app.get('/bqry/:bundleId/:type/:id', async (req, res) => {
        const bundleId = req.params.bundleId;
        const type = req.params.type;
        const id = req.params.id;


       // console.log(bundleId,type,id)

        let bundleEntry = await getBundleEntry(bundleId)

        if (! bundleEntry) {
            res.status(404).json(makeOO("not-found",`The bundle id ${bundleId} was not found`))
            return
        }
        //now we have the bundle we can do a simple query on it
        //the identity of a resource comes from the fullUrl. eg if the identity is a uuid (like from $extract)
        //then the fullUrl will be something like urn:uuid:e6851f4f-10a2-4b11-98a2-c79cf355e3cf and a resource will be
        //the same. So when we're looking for the resourceId we look in the fullUrl - not the .id on the resource



        //let ar = bundleEntry.bundle?.entry?.filter(entry => entry.fullUrl == id && entry.resource?.resourceType == type)
        //match either on fullUrl or id. Will work for $extract bundles as well as 'ordinary' ones
        let ar = bundleEntry.bundle?.entry?.filter(entry => (entry.fullUrl == id || entry.fullUrl == `urn:uuid:${id}`
            || entry.resource?.id == id)  && entry.resource?.resourceType == type)


       // const ar = bundleEntry.bundle?.entry?.find(
       //     entry => entry.fullUrl === id && entry.resource?.resourceType === type
      //  );

        switch (ar.length) {
            case 0 :
                res.status(404).json(makeOO("not-found",`The resource ${type}/${id} was not found`))
                break
            case 1 :
                let resource = ar[0].resource
                resource.id = resource.id || ar[0].fullUrl  //if no id then set it to the fullUrl
                res.json(resource)
                break
            default :
                res.status(500).json(makeOO("duplicate",`There were ${ar.length} instances of ${type}/${bundleId}.`))    //todo - check correct response code
                break

        }

    })

    //{type}?patient={patientId}
    //{type}
    app.get('/bqry/:bundleId/:type', async (req, res) => {
        const bundleId = req.params.bundleId;
        const type = req.params.type;
        let patientId = req.query.patient;
        let prefixedPatientId = `Patient/${patientId}`
        let urnPrefixedPatientId = `urn:uuid:${patientId}`

        //If no patient will return all resources of that type

        let bundleEntry = await getBundleEntry(bundleId)
        if (! bundleEntry) {
            res.status(404).json((makeOO("not-found",`The bundle id ${bundleId} was not found`)))
            return
        }

        //now we have the bundle we can do a simple query on it

        let responseBundle = {resourceType:'Bundle',type:'searchset',total:0,entry:[]}
        for (const entry of bundleEntry.bundle?.entry || []) {
            let resource = entry.resource
            let fullUrl = entry.fullUrl
            if (resource.resourceType == type) {
                let patRef = resource.subject || resource.patient   //eg Patient/xxx
                if (patRef) {
                    //could be {type}/id or uuid
                    let ref = patRef.reference  //this will either be the fullUrl (uuid) of the patient or the Patient/patientid


                    if (!patientId || ref == patientId || ref == prefixedPatientId || ref == urnPrefixedPatientId) {
                        responseBundle.entry.push({resource:resource})
                    }
                }
            }
        }
        responseBundle.total = responseBundle.entry.length
        res.json(responseBundle)
    });

    async function getBundleEntry(bundleId) {
        let query = {id:bundleId}
        //console.log(query)
        let result = await database.collection("bvBundles").findOne(query)
        //console.log(JSON.stringify(result),null,2)
        return result
    }

    function makeOO(code,msg) {
        let OO = {resourceType:"OperationOutcome",issue:[]}
        OO.issue.push( {severity:'error',code:code,diagnostics:msg})
        return OO

    }

    //------------ Lists ---------------
    //get all lists. Returns the entire list as it's unlikely to be large.

    //this endpoint (bqry) is routed through NGINX externally.
    //it returns a summary of lists
    app.get('/bqry/lists', async (req, res) => {
        let filter = { status: { $ne: "hide" }}     //I don't believe this is implemented yet!

        try {
            const result = await database.collection("bvList").find(filter).toArray()
            res.json(result);
        } catch (err) {
            console.error(err);
            res.status(500).send(err);
        }

    })

    app.get('/bv/lists', async function(req, res) {
        let filter = { status: { $ne: "hide" }}     //I don't believe this is implemented yet!

        try {
            const result = await database.collection("bvList").aggregate([
                { $match: filter },

                {
                    $addFields: {
                        queryCount: {
                            $size: {
                                $filter: {
                                    input: {$ifNull: ["$entries", []]},
                                    as: "entry",
                                    cond: {$eq: ["$$entry.type", "query"]}
                                }
                            }
                        },

                        bundleCount: {
                            $size: {
                                $filter: {
                                    input: {$ifNull: ["$entries", []]},
                                    as: "entry",
                                    cond: {$eq: ["$$entry.type", "bundle"]}
                                }
                            }
                        }
                    }
                }
            ]).toArray();

            res.json(result);

        } catch (err) {
            console.error(err);
            res.status(500).send(err);
        }
    });

    // add a new list
    app.post('/bv/list',async function(req,res){
        let list =  req.body
        list.id = new Date().getTime()
        try {
            await database.collection("bvList").insertOne(list)
            res.json(list)
        } catch(ex) {
            console.error(ex)
            res.status(500).json(ex.message)
        }
    })

    //update a list
    app.put('/bv/list',async function(req,res){
        let list =  req.body
        delete list['_id']
        delete list.queryCount
        delete list.bundleCount

        try {
            await database.collection("bvList").replaceOne(
                { id: list.id },
                list,
                { upsert: true }
            )
            res.json(list)
        } catch(ex) {
            console.error(ex)
            res.status(500).json(ex.message)
        }
    })

    // ----------------------------


    //use a transaction to add the contents of the supplied bundle to the local FHIR server
    //
    app.post('/bv/applyBundleToServer',async function(req,res){
        let fhirServerBase = "https://clinfhir.com/fhir/"
        let bundle = req.body

        if (!bundle || ! bundle.entry || bundle.entry.length ==0) {
            res.status(400).json("Empty or missing bundle")
            return
        }

        //convert to a transaction bundle
        //use a post for now. does mean that if a bundle is applied > once there will be duplication
        //could use a put - but could get duplicate Id's across bundles
        let err = []
        bundle.type = 'transaction'
        for (let entry of bundle.entry) {
            let resource = entry.resource
            delete resource.id
            delete entry.id
            entry.request = {method:"POST",url:resource.resourceType}
        }

        console.log(JSON.stringify(bundle,null,2))




        try {
            //let qry = fhirServerBase

            const response = await fetch(`${fhirServerBase}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/fhir+json'
                },
                body: JSON.stringify(bundle)
            });


            const text = await response.text();

            console.log("FHIR server status:", response.status);
            console.log("FHIR server response:", text);

            if (!response.ok) {
                res.status(response.status).send(text);
                return;
            }

            if (text) {
                res.json(JSON.parse(text));
            } else {
                res.status(response.status).send();
            }
        } catch(ex) {
            console.error(ex)
            res.status(400).json(ex.message)
        }
    });

    app.get('/bv/documentBundles', async function(req,res){


        try {

            let filter = {
                "bundle.entry": {
                    "$elemMatch": {
                        "resource.resourceType": "Composition"
                    }
                }
            }

           // const results = await database.collection("bvBundles").find(
            const result = await database.collection("bvBundles")
                .aggregate([
                    { $match: filter },
                    {
                        $project: {
                            id: 1,
                            description: 1,
                            date: 1,
                            name: 1,
                            author: 1,
                            showInPV: 1,
                            entryCount: {
                                $size: {
                                    $ifNull: ["$bundle.entry", []]
                                }
                            }
                        }
                    }
                ])
                .toArray();

            res.json(result);

        } catch (err) {
            console.error(err);
            res.status(500).send(err);
        }

    })

    //create a list of all tags currently defined in the library
    app.get("/bv/getAllTags",async function (req,res){


        try {
            const tagsA = await database.collection("bvBundles").distinct("tags");
            const tagsB = await database.collection("bvLibrary").distinct("tags");
            const allTags = [...new Set([...tagsA, ...tagsB])];
            res.json(allTags);

        } catch (err) {
            console.error(err);
            res.status(500).send(err);
        }
    })

    //--------------- bundles

    //Note that these are actually bundle entries - the actual bundle is one of the elements...
    //retrieve all the bundles saved in the library
    //todo - exclude those send in from other apps (eg GB)
    app.get("/bv/getAllBundles",async function (req,res){

        let filter = { active: true }
        if (req.query['showInPV']) {
            filter.showInPV = true      //note that the actual value of the query is ignored
        }

        try {
            const result = await database.collection("bvBundles")
                .aggregate([
                    { $match: filter },
                    {
                        $project: {
                            id: 1,
                            description: 1,
                            date: 1,
                            name: 1,
                            author: 1,
                            showInPV: 1,
                            entryCount: {
                                $size: {
                                    $ifNull: ["$bundle.entry", []]
                                }
                            }
                        }
                    }
                ])
                .toArray();

            res.json(result);
        } catch (err) {
            console.error(err);
            res.status(500).send(err);
        }



    })


    //update a bundle entry (which includes the bundle as an element
    app.put('/bv/bundle/:id',async function(req,res){
        let bundleEntry = req.body
        let id = req.params.id;
        let query = {id:id}

        try {
            await database.collection("bvBundles").replaceOne(
                query,
                bundleEntry,
                { upsert: true }
            )
            res.json(bundleEntry)
        } catch(ex) {
            console.error(ex)
            res.status(500).json(ex.message)
        }
    })




    //delete (hide) a bundle
    app.delete("/bv/bundle/:id",async function (req,res){

        let id = req.params.id;
        let query = {id:id}
        //console.log('bv',query)
        try {
            const result = await database.collection("bvBundles").updateOne(
                { id: id },            // filter
                { $set: { active: "false" } }  // update
            );

           // const result = await database.collection("bvBundles").findOne(query)
            //  console.log('bv',result)
            res.json(result);
        } catch (err) {
            console.error(err);
            res.status(500).send(err);
        }
    })

    //retrieve a single stored bundle by id. Bundles can be stored from within BV - and also saved
    //into the db by other apps (eg GtaphBuilder) when 'exporting' bundles to BV for viewing
    app.get("/bv/bundle/:id",async function (req,res){

        let id = req.params.id;
        let query = {id:id}
        //console.log('bv',query)
        try {
            const result = await database.collection("bvBundles").findOne(query)
            if (! result) {
                res.status(404).send({msg :`${id} not found`});
            } else {
                res.json(result);
            }

        } catch (err) {
            console.error(err);
            res.status(500).send(err);
        }
    })

    //a version for external access that only returns the bundle
    app.get("/api/Bundle/:id",async function (req,res){

        let id = req.params.id;
        let query = {"id":id}


        try {
            const result = await database.collection("bvBundles").findOne(query)
            if (result) {
                let bundle = result.bundle
                bundle.id = id

                res.json(bundle);
            } else {
                res.status(404).send()
            }

        } catch (err) {
            console.error(err);
            res.status(500).send(err);
        }
    })



    //add a bundle to the bundle library (bvBundles)
    app.post('/bv/saveBundle',async function(req,res){
        let BundleEntry = req.body
        try {
            await database.collection("bvBundles").insertOne(BundleEntry)
            res.json(BundleEntry)
        } catch(ex) {
            console.error(ex)
            res.status(500).json(ex.message)
        }
    });


    //add a Library entry. These are queries
    app.post('/bvLibrary',async function(req,res){
        let libraryEntry = req.body
        try {
            await database.collection("bvLibrary").insertOne(libraryEntry)
            res.json(libraryEntry)
        } catch(ex) {
            console.error(ex)
            res.status(500).json(ex.message)
        }
    });

    //get a list of test set.
    app.get('/bvLibrary',async function(req,res){

        //todo - can add params for filtering...
       //console.log('bv')
        let filter = { status: { $ne: "hide" }}

        try {
            const result = await database.collection("bvLibrary").find( filter,
                { projection: { _id: 1, name: 1, description: 1, qry: 1,tags:1 } }).toArray();
            res.json(result);
        } catch (err) {
            console.error(err);
            res.status(500).send(err);
        }
    });

    app.delete('/bvLibrary/:id', async function(req,res){
        const id = req.params.id;
        try {
            const result = await database.collection('bvLibrary').updateOne(
                { _id: new ObjectId(id) },
                { $set: { status: "hide", setAt: new Date() } }
            );
            if (result.matchedCount === 0) {
                return res.status(404).send({ error: 'Item not found' });
            }
            res.sendStatus(204);
        } catch (err) {
            console.error(err);
            res.status(400).send({ error: 'Invalid id' });
        }
    });

}



module.exports= {
    setup : setup
}
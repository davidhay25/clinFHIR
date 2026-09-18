
//functions to support specific BundleVisualizer options

//const axios = require('axios')

const { ObjectId } = require('mongodb');

let database;

function setup(app,client) {

    database = client.db("clinfhir");


    //------------ Lists ---------------
    //get all lists. Retuens the entire list as it's unlikely to be large.
    app.get('/bv/lists', async function(req, res) {
        let filter = { status: { $ne: "hide" }}

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
/*
                // Don't return the entries array
                {
                    $project: {
                        entries: 0
                    }
                }
*/
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

    //retrieve all the bundles saved in the library
    //todo - exclude those send in from other apps (eg GB)
    app.get("/bv/getAllBundles",async function (req,res){

        let filter = { active: true }
        if (req.query['showInPV']) {
            filter.showInPV = true      //note that the actual value of the query is ignored
        }
/* original
//console.log(filter)
        try {
            const result = await database.collection("bvBundles")
                .find(filter, { projection: { id: 1, description: 1, date: 1, name:1,author:1,showInPV:1 } })
                .toArray()
            res.json(result);
        } catch (err) {
            console.error(err);
            res.status(500).send(err);
        }

*/
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



    //delete (hide) a nundle
    app.delete("/bv/getBundle/:id",async function (req,res){

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
    app.get("/bv/getBundle/:id",async function (req,res){

        let id = req.params.id;
        let query = {id:id}
        //console.log('bv',query)
        try {
            const result = await database.collection("bvBundles").findOne(query)
            res.json(result);
        } catch (err) {
            console.error(err);
            res.status(500).send(err);
        }
    })

    //a version for external access that only returns the bindle
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
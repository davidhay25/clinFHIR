
//functions to support specific BundleVisualizer options

//const axios = require('axios')

let database;

function setup(app,client) {

    database = client.db("clinfhir");



    //retrieve all the bundles saved in the library
    //todo - exclude those send in from other apps (eg GB)
    app.get("/bv/getAllBundles",async function (req,res){

        let filter = { active: true }
        if (req.query['showInPV']) {
            filter.showInPV = true      //note that the actual value of the query is ignored
        }
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
    })

    //retrieve a single stored bundle by id. Bundles can be stored from within BV - and also saved
    //into the db by other apps (eg GtaphBuilder) when 'exporting' bundles to BV for viewing
    app.get("/bv/getBundle/:id",async function (req,res){

        let id = req.params.id;
        let query = {id:id}
        //console.log('bv',query)
        try {
            const result = await database.collection("bvBundles").findOne(query)
          //  console.log('bv',result)
            res.json(result);
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
                { projection: { _id: 1, name: 1, description: 1, qry: 1 } }).toArray();
            res.json(result);
        } catch (err) {
            console.error(err);
            res.status(500).send(err);
        }


    });
}



module.exports= {
    setup : setup
}
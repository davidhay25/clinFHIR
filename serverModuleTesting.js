
//functions to support server testing via serverQuery app
let db;


function setup(app,indb) {

    db = indb;

    //get a list of all test sets

    //get a specific test set.
    app.get('/testing/testSet/:id',function(req,res){
        let id = req.params.id

        db.collection("apitest").find({id:id}).toArray(function (err, result) {
            if (err) {
                res.send(err, 500)
            } else {
                if (result.length == 1) {
                    res.json(result[0])
                } else {
                    res.send({msg:"id not found"}, 500)
                }

            }
        })




    });

    //get a list of test set.
    app.get('/testing/testSet',function(req,res){
        db.collection("apitest").find({},{id:1,name:1}).toArray(function (err, result) {
            if (err) {
                res.send(err, 500)
            } else {

                res.json(result)
            }
        })

    });



}



module.exports= {
    setup : setup
}
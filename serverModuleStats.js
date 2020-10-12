
function setup(app,db) {

    app.get('/survey/results',function(req,res) {

        let query = {};
        db.collection("survey").find({$query: query}).toArray(function (err, doc) {
            if (err) {
                res.status(500);
                res.json({err: err});
            } else {
               let summary = {};

                doc.forEach(function (survey, inx) {
                    survey.resources.forEach(function (resource) {
                        let type = resource.name;
                        summary[type] = summary[type] || {count:0,dev:0,prod:0,notes:[]};
                        summary[type].count ++
                        summary[type].type = type
                        if (resource.deployType == 'dev') {summary[type].dev ++}
                        if (resource.deployType == 'prod') {summary[type].prod ++}
                        if (resource.notes) {
                            summary[type].notes.push(resource.notes)
                        }
                    })

                });

                //convert to array as easier for client
                let rtn = [];
                for (var item in summary) {


                    rtn.push(summary[item])
                }

                res.json(rtn)
            }



        })
    })

    app.post('/survey',function(req,res){

        var body = '';
        req.on('data', function (data) {
            body += data;
        });

        req.on('end', function () {
            var jsonBody = {};
            //just swallow errors for now
            try {
                jsonBody = JSON.parse(body);

                db.collection("survey").insert(jsonBody, function (err, result) {
                    if (err) {
                        console.log('Error inserrting survey result ')
                        res.status(500);
                        res.json({err:err});
                    } else {
                        res.end();
                    }
                });


            } catch (ex) {}


            res.end();
        });

    });


}

module.exports= {
    setup : setup
}
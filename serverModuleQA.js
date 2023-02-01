
//const qaindex = require('./artifacts/qaindex.json');

const fs = require("fs")
function setup(app) {

    app.get('/qa/pages',function(req,res) {
        let index = fs.readFileSync('./artifacts/qaindex.json').toString()
        console.log(index)
        res.json(JSON.parse(index))

    })

    //claim a page to edit
    app.post('/qa/claim',function(req,res){
        let body = '';
        req.on('data', function (data) {
            body += data;
        });

        req.on('end', function () {

            console.log('body',body)
            let index = JSON.parse(fs.readFileSync('./artifacts/qaindex.json'))
            let entry = index[body.id]
            if (entry) {
                entry.name = body.name
                fs.writeFileSync('./artifacts/qaindex.json',JSON.stringify(index))

            }
            res.json(index)
        })







    })
}


module.exports= {
    setup : setup
}
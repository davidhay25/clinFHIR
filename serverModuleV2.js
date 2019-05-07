let fs = require('fs');


function setup(app,) {


    app.get('/v2/message/:name',function(req,res){
        console.log(req.params.name)
        const fileName = __dirname + '/artifacts/v2messages/'+req.params.name;

        fs.readFile(fileName, function(err,file)  {
            res.send(file)
        })


    });

    app.get('/v2/messages', function (req, res) {

        const msgFolder = __dirname + '/artifacts/v2messages';
        //console.log(msgFolder)


        let ar = []


        fs.readdir(msgFolder,function(err,files) {
            res.json(files)
        })


    })
}

module.exports= {
    setup : setup
}
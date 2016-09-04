//simple server to serve static files...

var static = require('node-static');
var fileServer = new static.Server({ indexFile: "resourceCreator.html" });
var request  = require('request');

var db;
var port = process.env.port;
if (! port) {
    port=80;
}

var MongoClient = require('mongodb').MongoClient;
MongoClient.connect('mongodb://127.0.0.1:27017/clinfhir', function(err, ldb) {
    if(err) {
        //throw err;
        console.log('>>> Mongo server not running')
    } else {
        db = ldb;
    }
});


function recordAccess(req) {
    var clientIp = req.headers['x-forwarded-for'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connection.socket.remoteAddress;

    if (db) {
        var audit = {ip:clientIp,date:new Date().getTime()};
        db.collection("accessAudit").insert(audit, function (err, result) {
            if (err) {
                console.log('Error logging access ',audit)
            } else {

                if (result && result.length) {
                    console.log('logged ',err)
                    updateLocation(result[0],clientIp);

                }

            }
        });

    }
}


require('http').createServer(function (request, response) {
    request.addListener('end', function () {

        //console.log(request.method, request.url)

        if (request.method == 'POST') {
            if (request.url == '/stats/login') {
                console.log('access')
                recordAccess(request);
                response.end();

            }

        } else {
            fileServer.serve(request, response, function (err, result) {
                if (err) { // There was an error serving the file
                    console.error("Error serving " + request.url + " - " + err.message);

                    // Respond to the client
                    response.writeHead(err.status, err.headers);
                    response.end();
                } else {

                }

            });
        }



    }).resume();
}).listen(port);


var updateLocation = function(doc,ip) {


    //doc.ip="198.102.235.144"
    var url = "http://freegeoip.net/json/"+doc.ip;

    var options = {
        method:'GET',
        uri : "http://freegeoip.net/json/"+doc.ip

    };

    request(options,function(error,response,body){

        if (body) {
            var loc;
            try {
                loc = JSON.parse(body);
            } catch (ex) {}
            if (loc) {
                db.collection("accessAudit").update({_id:doc._id},{$set:{location:loc}},function(err,doc){
                    if (err) {
                        console.log('Error setting location',err)
                    } else {

                        chatModule.addActivity({display:"login from "+loc['country_name'],data:loc,ip:ip});
                    }

                })
            }

        }
    });


};

console.log('listening on port '+port)
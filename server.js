//simple server to serve static files...

var request  = require('request');
var moment = require('moment');
let http = require('http');

//var httpProxy = require('http-proxy')

//  remove for proxy var myParser = require("body-parser");
var Cookies = require( "cookies" )

var express = require('express');
var app = express();

//var orionModule = require("./serverModuleOrion.js")
var smartModule = require("./serverModuleSMART.js")

let surveyModule = require("./serverModuleSurvey.js")


//var iphoneModule = require("./serverModuleIphone.js")
//iphoneModule.setup(app)

process.on('uncaughtException', function(err) {
    console.log('>>>>>>>>>>>>>>> Caught exception: ' + err);
});

var db;
var port = process.env.port;
if (! port) {
    port=80;
}

let server = http.createServer(app).listen(port);

const WebSocket = require('ws');
const wss = new WebSocket.Server({server:server});

var taskModule = require("./serverModuleTask");
taskModule.setup(app,wss,WebSocket)     // need WebSocket for the constants

//for v2 processing
//console.log('including server modele');
//let v2Module = require("./serverModuleV2");
//v2Module.setup(app);
//console.log('included server modele');

wss.on('connection', function connection(ws) {
    ws.on('message', function incoming(message) {
        console.log('received: %s', message);
    });

    ws.send('Socket connection made');
});


//if the port was passed in on a command line
process.argv.forEach(function (val, index) {
    if (val == '-p') {
        port = process.argv[index+1];
    }
});

var MongoClient = require('mongodb').MongoClient;
MongoClient.connect('mongodb://127.0.0.1:27017/clinfhir', function(err, ldb) {
    if(err) {
        //throw err;
        console.log('>>> Mongo server not running')
    } else {
        db = ldb;
      //  orionModule.setup(app,db);
        smartModule.setup(app,db);
        surveyModule.setup(app,db);
    }
});

function recordAccess(req,data) {
    var clientIp = req.headers['x-forwarded-for'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connection.socket.remoteAddress;

    if (db) {
        var audit = {ip:clientIp,date:new Date().getTime()};
        audit.data = data;


        db.collection("accessAudit").insert(audit, function (err, result) {
            if (err) {
                console.log('Error logging access ',audit)
            } else {

                if (result && result.length) {
                    updateLocation(result[0],clientIp);

                }
            }
        });

    }
}


//allow the use of custom domains - like csiro.clinfhir.com
//need to create the domain in digitalocean as well...
//a hash of supported domains and the default page.
let domains = {}
domains['csiro.clinfhir.com'] = '/csiroProject.html';
domains['nz.clinfhir.com'] = '/nzProject.html';

app.use('/',function(req,res,next){

    if (req.originalUrl.length == 1) {
        console.log('call to root. Domain='+req.headers.host);
        if (domains[req.headers.host]) {
            console.log('returning file ' + domains[req.headers.host]);

            res.sendFile(__dirname + domains[req.headers.host])


           // res.redirect(domains[req.headers.host])
        } else {
            next();
        }
    } else {
        next();
    }
});


app.use('/', express.static(__dirname,{index:'/launcher.html'}));


//this is used for the re-direct from simplifier
app.get('/createExample',function(req,res){
    var cookies = new Cookies( req, res )
    var profile = req.query['profile'];
    cookies.set('myProfile',profile,{httpOnly:false});
    //res.sendFile("builder.html", { root: __dirname  })
    res.sendFile("resourceCreator.html", { root: __dirname  })
});



//when a user navigates to cf
app.post('/stats/login',function(req,res){

    var body = '';
    req.on('data', function (data) {
        body += data;

    });

    req.on('end', function () {
        var jsonBody = {};
        //just swallow errors for now
        try {
            jsonBody = JSON.parse(body);
        } catch (ex) {}

        recordAccess(req,jsonBody);
        res.end('ok');
    });

});


//get a summary of the access stats. This code is rather crude - mongo has better ways of doing this...
//probably want to be able to specify a date range and number of detailed items  as well...
app.get('/stats/summary',function(req,res){
    if(! db) {
        //check that the mongo server is running...
        res.json({});
        return;
    }

    var query = {};

    var min = req.query.min;
    var max = req.query.max;

    if (min) {

        query.date = {$gte : parseInt(min),$lte:parseInt(max)}
    }

    db.collection("accessAudit").find({$query: query}).toArray(function(err,doc){
        if (err) {
            res.status(500);
            res.json({err:err});
        } else {
            var rtn = {cnt:doc.length,item:[],country:{},lastAccess : {date:0},module:{}};
            var daySum = {};



            doc.forEach(function(d,inx){

                if (d.data) {
                    if (d.data.module) {
                        var m = d.data.module;
                        var dataServer,confServer,termServer;
                        if (d.data.servers) {
                            dataServer = d.data.servers.data;
                            termServer = d.data.servers.terminology;
                            confServer = d.data.servers.conformance;
                        }

                        if (rtn.module[m]) {
                            rtn.module[m].cnt++;

                            updateServerCount(dataServer,'data',rtn.module[m])
                            updateServerCount(termServer,'term',rtn.module[m])
                            updateServerCount(confServer,'conf',rtn.module[m])

                        } else {
                            rtn.module[m] = {cnt:1};
                            updateServerCount(dataServer,'data',rtn.module[m])
                            updateServerCount(termServer,'term',rtn.module[m])
                            updateServerCount(confServer,'conf',rtn.module[m])

                        }

                    }
                }

                if (d.date > rtn.lastAccess.date) {
                    rtn.lastAccess = d;
                }


                if (d.location) {
                    var c = d.location['country_code'];
                    if (c) {
                        if (!rtn.country[c]) {
                            rtn.country[c] = {name: d.location['country_name'], cnt: 0}
                        }
                        rtn.country[c].cnt++;
                    }
                }

                var day = moment(d.date).startOf('day').valueOf();
                if (! daySum[day]) {
                    daySum[day] = 0;
                }
                daySum[day] ++;


            });

            rtn.daySum = [];

            for (var day in daySum) {
                rtn.daySum.push([parseInt(day),daySum[day]]);
            }

            rtn.daySum.sort(function(a,b){
                if (a[0] > b[0]){
                    return 1
                } else {
                    return -1;
                }
            });

            //now create an array of countries - easier for sorting
            rtn.countryList = [];
            for (var c in rtn.country) {
                rtn.countryList.push(rtn.country[c])

            }

            //and sort it...
            rtn.countryList.sort(function(a,b){
                if (a.cnt < b.cnt) {
                    return 1
                } else {
                    return -1
                }
            });

            rtn.moduleList = []
            for (var m in rtn.module) {



                rtn.moduleList.push({name:m,cnt : rtn.module[m].cnt,detail:rtn.module[m]})
            }
            rtn.moduleList.sort(function(a,b){
                if (a.cnt < b.cnt) {
                    return 1
                } else {
                    return -1
                }
            });


            res.json(rtn);


        }
    })



});

function updateServerCount(serverName,type,obj) {
    if (serverName) {
        var key = type+'Server'
        obj[key] = obj[key] || {};
        var o = obj[key];
        o[serverName] = o[serverName] || {cnt:0}
        o[serverName].cnt++


    }
}

/*
//old clients trying to access server...
app.use('/socket.io',function(req,res){
    res.end();
});

*/

app.post('/errorReport',function(req,res){
    if(! db) {
        //check that the mongo server is running...
        res.json({});
        return;
    }
    var clientIp = req.headers['x-forwarded-for'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connection.socket.remoteAddress;

    var body = '';
    req.on('data', function (data) {
        body += data;
        console.log("Partial body: " + body);
    });
    
    req.on('end', function () {

       var jsonBody = JSON.parse(body);

        jsonBody.ip = clientIp;
        jsonBody.date = new Date().getTime();
        db.collection("errorLog").insert(jsonBody, function (err, result) {
            if (err) {
                console.log('Error logging error ',audit)
                res.end();
            } else {

                res.end();

            }
        });
    });
});


//distinct resourceTypes: db.getCollection('errorLog').distinct("resource.resourceType")

//return all results
app.get('/errorReport/distinct',function(req,res){
    if(! db) {
        //check that the mongo server is running...
        res.json({});
        return;
    }
    
    db.collection("errorLog").distinct("resource.resourceType",function(err,doc){
        if (err) {
            console.log('Error logging error ',audit)
            res.end();
        } else {
            res.json(doc)

        }
    });
});



//return all results
app.get('/errorReport/:type?',function(req,res){


    var qry = {};
    if (req.params.type) {
        qry = {"resource.resourceType":req.params.type}
    }

    if (db) {
        db.collection("errorLog").find(qry).sort({date:-1}).toArray(function(err,doc){
            if (err) {
                console.log('Error logging error ',audit)
                res.end();
            } else {
                res.json(doc)

            }
        });
    } else {
        res.json({})
    }

});


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

console.log('listening on port '+port);


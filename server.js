//simple server to serve static files...

var request  = require('request');
var moment = require('moment');

var httpProxy = require('http-proxy')

//  remove for proxy var myParser = require("body-parser");
var Cookies = require( "cookies" )

var express = require('express');
var app = express();
//remove for proxy app.use(myParser.json({extended : true}));



var orionModule = require("./serverModuleOrion.js")
var smartModule = require("./serverModuleSMART.js")

//var connect = require('connect');
var http = require('http');


process.on('uncaughtException', function(err) {
    console.log('>>>>>>>>>>>>>>> Caught exception: ' + err);
});

var db;
var port = process.env.port;
if (! port) {
    port=80;
}

//if the port was passed in on a command line
process.argv.forEach(function (val, index) {
    //console.log(index + ': ' + val);
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
        orionModule.setup(app,db);
        smartModule.setup(app,db);

    }
});


// proxy - for servers not implementing CORS
var proxy = httpProxy.createProxyServer({});
proxy.on('error', function (err, req, res) {
    console.log('proxy error',err)
    res.writeHead(500, {
        'Content-Type': 'text/plain'
    });
    res.end('Something went wrong. And we are reporting a custom error message.');
});

proxy.on('proxyRes', function (proxyRes, req, res) {
    console.log('RAW Response from the target', JSON.stringify(proxyRes.headers, true, 2));
});
proxy.on('proxyReq', function (proxyRes, req, res) {
    console.log('sending');
});



function recordAccess(req,data) {
    console.log(data)
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
                    console.log('logged ',err)
                    updateLocation(result[0],clientIp);

                }
            }
        });

    }
}


//return status pages, index is resourceCeator.html
//app.use('/', express.static(__dirname,{index:'/resourceCreator.html'}));
app.use('/', express.static(__dirname,{index:'/launcher.html'}));


app.all('/proxy/*',function(req,res){
    console.log(req.url)
    req.url = req.url.replace('proxy/','')
    console.log('-->'+req.url)
    proxy.web(req, res, { target: 'http://snapp.clinfhir.com:8081/baseDstu3/' });
});



/*
//--- proxies for Grahames server. Could generalize this using - eg - headers,but will need to update allservices making $http calls...
app.all('/grahamv3/*',function(req,res){
    //console.log(req.url)
    req.url = req.url.replace('grahamv3/','')
    proxy.web(req, res, { target: 'http://fhir3.healthintersections.com.au/open/' });
});

app.all('/grahamv2/*',function(req,res){
    //console.log(req.url)
    req.url = req.url.replace('grahamv2/','')
    proxy.web(req, res, { target: 'http://fhir2.healthintersections.com.au/open/' });
});


*/


//this is used for the re-direct from simplifier
app.get('/createExample',function(req,res){
    var cookies = new Cookies( req, res )
    var profile = req.query['profile'];
    cookies.set('myProfile',profile,{httpOnly:false});
    //res.sendFile("builder.html", { root: __dirname  })
    res.sendFile("resourceCreator.html", { root: __dirname  })
});


//======== temp ======= for Orion calling the medication dispense endpoint
app.get('/orion/:nhi',function(req,res){
    var nhi = req.params['nhi'];

    //var url = "https://frontend1.solution-nzmoh-dataset-leahr-graviton-jump-host-auckland.graviton.odl.io/fhir/1.0/MedicationDispense?patient.identifier=SYS_A|"+nhi
    //var url = "https://52.41.169.101/fhir/1.0/MedicationDispense?patient.identifier=SYS_A|"+nhi


    var url = "http://fhir.hl7.org.nz/baseDstu2/MedicationDispense?patient.identifier="+nhi


    if (nhi) {
        var options = {
            method:'GET',
            rejectUnauthorized: false,
            uri : url,
            auth : {
                'user':'level1.sys_a',
                'password':'Orionsy5!?'
            },headers: {
                'Accept': 'application/json+fhir'
            }
        };

        request(options,function(error,response,body){

            //console.log('error:', error); // Print the error if one occurred
            //console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
            //console.log('body:', body); // Print the HTML for the Google homepage.

            if (body) {
                if (response) {
                    res.status(response.statusCode)
                }
                res.end(body);
            }

            if (error) {
                if (response) {
                    res.status(response.statusCode)
                }
                res.end(error);
            }

        });
    } else {
        res.end({"error":"No NHI"});
    }

});


//when a user navigates to cf
app.post('/stats/login',function(req,res){
    console.log('access')

    var body = '';
    req.on('data', function (data) {
        body += data;
        console.log("Partial body: " + body);
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

    //recordAccess(req);
    //res.end();
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
        console.log('min=',min)
        //var minDate = new Date(parseFloat(min))
        console.log(new Date(parseFloat(max)))
        query.date = {$gte : parseInt(min),$lte:parseInt(max)}
    }





    db.collection("accessAudit").find({$query: query}).toArray(function(err,doc){
        if (err) {
            res.status(500);
            res.json({err:err});
        } else {
            var rtn = {cnt:doc.length,item:[],country:{},lastAccess : {date:0},module:{}};
            var daySum = {};

            //console.log(doc.length)

            doc.forEach(function(d,inx){

                //console.log(d.date,rtn.lastAccess.date)

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



        //return obj;


    }
}


//old clients trying to access server...
app.use('/socket.io',function(req,res){
    res.end();
});

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

    console.log(req.params.type);
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

/*
app.get('/',function(req,res){
    //console.log('d')
    res.sendFile(__dirname+'/resourceCreator.html');
});
*/


//app.use('/', express.static(__dirname,{index:'/resourceCreator.html'}));


var sendEmail = function(recipient,message) {

}


app.listen(port);


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

//========== not currently used ===========

//which profiles are being used...
function getProfileUsage(summary,cb) {
    db.collection("profileAudit").find().toArray(function(err,doc){

            if (err) {
                cb();
            } else {
                summary.profileAccess = [];


                var profiles = {};
                doc.forEach(function(item,inx){

                    if (item.profile) {
                        var profile = item.profile;
                        if (! profiles[profile]) {
                            profiles[profile] = {profile:profile,cnt:0}
                        }
                        profiles[profile].cnt++;

                    }
                });

                for (var p in profiles) {
                    summary.profileAccess.push(profiles[p])

                }

                summary.profileAccess.sort(function(a,b){
                    if (a.cnt < b.cnt) {
                        return 1
                    } else {
                        return -1
                    }
                });



                cb();
            }
        }
    )};



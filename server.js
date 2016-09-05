//simple server to serve static files...

var static = require('node-static');
var fileServer = new static.Server({ indexFile: "resourceCreator.html" });
var request  = require('request');
var moment = require('moment');


var express = require('express');
var app = express();


//var connect = require('connect');
var http = require('http');

//var app = connect();



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

//when a user navigates to cf
app.post('/stats/login',function(req,res){
    console.log('access')
    recordAccess(req);
    res.end();
});


//get a summary of the access stats. This code is rather crude - mongo has better ways of doing this...
//probably want to be able to specify a date range and number of detailed items  as well...
app.get('/stats/summary',function(req,res){
    db.collection("accessAudit").find({$query: {}}).toArray(function(err,doc){
    //db.collection("accessAudit").find({$query: {},$orderby: { date : 1 }}).toArray(function(err,doc){
        if (err) {
            res.status(500);
            res.json({err:err});
        } else {
            var rtn = {cnt:doc.length,item:[],country:{}};
          //  if (doc && doc.length > 0) {
            //    rtn.lastAccess = doc[doc.length-2];
           // }

            var daySum = {};

            doc.forEach(function(d,inx){
              //  if (inx > (doc.length - 30)) {
                //    rtn.item.push(d);
                    //rtn.item.splice(0,0,d);   //last 30 accessss
               // }

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

            rtn.item = rtn.item.reverse();


            rtn.daySum = [];



            for (var day in daySum) {
                rtn.daySum.push([parseInt(day),daySum[day]]);
            }



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

            //add the number of profiles being accesses...
          //  getProfileUsage(rtn,function(){
                res.json(rtn);
           // })

        }
    })
});


//try to serve static file for any request not yet handled...
app.use('/',function(req,res){

    fileServer.serve(req, res, function (err, result) {
        if (err) { // There was an error serving the file
            console.error("Error serving " + req.url + " - " + err.message);

            // Respond to the client
            res.writeHead(err.status, err.headers);
            res.end();
        } else {

        }

    });
});


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


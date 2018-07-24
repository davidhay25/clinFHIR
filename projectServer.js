//A server to support the project (eg CSIRO) app

var request  = require('request');
var moment = require('moment');
var Cookies = require( "cookies" );
var express = require('express');
var app = express();
var session = require('express-session');
var jwt = require('jsonwebtoken');
var fs = require('fs');

//https://aghassi.github.io/ssl-using-express-4/
var https = require('https');
var sslOptions = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem'),
    passphrase:'ne11ieh@y'
};

https.createServer(sslOptions, app).listen(8553)
console.log('server listening via TLS on port 8553');

app.use(session({
    secret: 'dhClinFhir',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));
var http = require('http');
var showLog = true;

process.on('uncaughtException', function(err) {
    console.log('>>>>>>>>>>>>>>> Caught exception: ' + err);
});

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
    }
});

app.use('/', express.static(__dirname,{index:'/project.html'}));

//stub for the logical modeler
app.post('/stats/login',function(req,res){
    res.json({})
});


//initialize the current session. Get the auth endpoints
app.get('/init',function(req,res){
    var options = {
        method: 'GET',
        uri: "https://hof.smilecdr.com:8000/metadata",
        agentOptions: {         //allows self signed certificates to be used...
            rejectUnauthorized: false
        },
        headers: {accept:'application/json+fhir'}       //todo - may need to set this according to the fhir version...
    };

    request(options, function (error, response, body) {
        if (response && response.statusCode == 200) {

            var capStmt = JSON.parse(body);
            req.session["config"] = {};
            req.session["serverData"] = {};

            req.session["page"] = "project.html"
            var config = req.session["config"];

            getSMARTEndpoints(config, capStmt);
            
            config.callback =  "https://localhost:8553/callback";// "http://localhost:8082/callback";
            config.clientId = "clinfhir-test";
            config.secret = "mySecret";

            res.json(config)
           // return;
        }
    })


});


//The first step in authentication. The browser will load this 'page' and receive a redirect to the login page
app.get('/auth', function(req, res)  {
    if (showLog) {
        console.log('/auth')
    }

    var config = req.session["config"];
    if (!config) {
        req.statusCode(400).json({err:'No config. Need to re-initialize.'})
        return;
    }

    //generate the uri to re-direct the browser to. This will be the login page for the system
    var authorizationUri = config.authorize;
    authorizationUri += "?redirect_uri=" + encodeURIComponent(config.callback);
    authorizationUri += "&response_type=code";
    authorizationUri += "&client_id="+config.clientId;
    authorizationUri += "&scope=openid patient/*.read";
    if (showLog) {console.log('authUri=',authorizationUri)};
    res.redirect(authorizationUri);

});


//after authentication the browser will be redirected by the auth server to this endpoint
app.get('/callback', function(req, res) {
    if (showLog) {
        console.log('/callback')
    }
    //If authentication was successful, the Authorization Server will return a code which can be exchanged for an
    //access token. If there is no code, then authorization failed, and a redirect to an error page is returned.
    var code = req.query.code;
    if (showLog) {
        console.log('/callback, query=', req.query);
        console.log('/callback, code=' + code);
    }

    if (! code) {
        //no code, redirect to error
        req.session.error = req.query;  //any error message will be in the querystring...
        res.redirect('smartError.html')
        return;
    }

    var config = req.session["config"];     //retrieve the configuration from the session. This was set in /auth.

    //request an access token from the Auth server.
    var options = {
        method: 'POST',
        uri: config.token,
        agentOptions: {         //allows self signed certificates to be used...
            rejectUnauthorized: false
        },
        body: 'code=' + code + "&grant_type=authorization_code&redirect_uri=" + encodeURIComponent(config.callback),
        headers: {'content-type': 'application/x-www-form-urlencoded'}
    };


    // headers: {'authorization': 'Bearer ' + access_token,'accept':'application/fhir+json'}
    if (config.public) {
        //a public client includes the client if, but no auth header
        options.body += '&client_id='+ config.clientId;
    } else {
        //a confidential client creates an Authorization header
        var buff = new Buffer(config.clientId + ':' + config.secret);
        options.headers.Authorization = 'Basic ' + buff.toString('base64')
    }


    //perform the request to get the auth token...
    request(options, function (error, response, body) {
        if (showLog) {
            console.log(' ----- after token call -------');
            console.log('body ', body);
            console.log('error ', error);
        }
        if (response && response.statusCode == 200) {
            //save the access token in the session cache. Note that this is NOT sent to the client
            var token = JSON.parse(body);

            if (showLog) {
                console.log('token=', token);
            }

            req.session['accessToken'] = token['access_token']
            req.session.serverData.scope = token.scope;
            req.session.serverData.fullToken = token;

            req.session.serverData.config = req.session["config"];


            //an id token was returned
            if (token['id_token']) {



                var id_token = jwt.decode(token['id_token'], {complete: true});
                req.session.serverData['idToken'] = id_token;
                console.log(id_token)

                //req.session.serverData.idToken = id_token;

                //this for DXE

                res.redirect(req.session["page"]);



            } else {
                res.redirect(req.session["page"]);
            }



        } else {
            req.session.error = body;
            res.redirect('smartError.html')
        }
    })
});




//retrieve the server endpoints from the capability statement
var getSMARTEndpoints = function(config,capstmt) {
    var smartUrl = "http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris";
    try {
        var extensions = capstmt.rest[0].security.extension;
        console.log(extensions);

        extensions.forEach(function(ext) {
            if (ext.url == smartUrl) {
                ext.extension.forEach(function(child){
                    switch (child.url) {
                        case 'authorize' :
                            config.authorize = child.valueUri;
                            break;
                        case 'token' :
                            config.token = child.valueUri;
                            break;
                        case 'register' :
                            config.register = child.valueUri;
                            break;


                    }
                })
            }
        })


    } catch(ex) {
        return ex
    }



}


//app.listen(port);
//console.log('listening on port '+port);

//A server to support the project (eg CSIRO) app
//https://smilecdr.com/docs/current/security/smart_on_fhir_introduction.html#the-smart-launch-sequence
var request  = require('request');
var moment = require('moment');
//var Cookies = require( "cookies" );
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
    cookie: { secure: true }
}));
var http = require('http');
var showLog = true;
/* - not sure about this...
process.on('uncaughtException', function(err) {
    console.log('>>>>>>>>>>>>>>> Caught exception: ' + err);
});
*/
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
    if (showLog) {
        console.log('/init')
    }
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

            req.session["page"] = "project.html";
            var config = req.session["config"];

            getSMARTEndpoints(config, capStmt);

            config.callback =  "https://localhost:8553/callback";
            config.clientId = "clinfhir-test";
            config.secret = "mySecret";
            config.baseUrl = "https://hof.smilecdr.com:8000/";

            res.json(config)

        }
    })


});



//========= proxy endpoints - goes to the SMART server.

app.get('proxyfhir/*',function(req,res) {
    var config = req.session['config'];
    var fhirQuery = config.baseUrl + req.originalUrl.substr(11); //strip off proxyfhir/
    var options = {
        method: 'GET',
        uri: fhirQuery,
        encoding : null
    };

    options.headers={accept:'fhir+json','authorization': 'Bearer ' + req.session['accessToken']};

    //console.log(options);
    request(options, function (error, response, body) {
        var statusCode = 500;
        if (response) {
            statusCode = response.statusCode;
        }
        if (showLog) {
            console.log(statusCode)
        }


        if (error) {
            console.log('error:',error)
            console.log('response:',response)

            var err = error || body;
            //res.send(err,500)
            res.status(statusCode).send(err);
        } else if (statusCode !== 200) {


            res.status(statusCode).send(body);
        } else {
            res.send(body);
        }
    })
});



// ========================  admin and SMART endpoints

//return the status of the client - eg whether logged in or not
app.get('/status',function(req,res){
    if (showLog) {
        console.log('/status')
    }

    if (req.session["serverData"] ) {
        var tmp = req.session["serverData"]
        var response = {};
        response.status = 'loggedin';
        response.accessToken = tmp.fullToken["access_token"];
        response.user = tmp.user;
        response.expires = req.session['expires'];

        response.serverData = tmp;

        res.json(response)        //todo data only returned for development...
    } else {
        res.json({status:'notloggedin'})
    }
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
    authorizationUri += "&scope=openid profile offline_access patient/*.read patient/*.write";
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
        res.redirect('smartError.html');
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

    var buff = new Buffer(config.clientId + ':' + config.secret);
    options.headers.Authorization = 'Basic ' + buff.toString('base64')

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

            req.session['accessToken'] = token['access_token'];
            var expiry = token['expires_in'];
            if (expiry) {
                req.session['expires'] = moment().add('days',expiry)
            }
            req.session['refreshToken'] = token['refresh_token'];

            req.session.serverData.scope = token.scope;
            req.session.serverData.fullToken = token;

            req.session.serverData.config = req.session["config"];


            //an id token was returned
            if (token['id_token']) {

                var id_token = jwt.decode(token['id_token'], {complete: true});
                req.session.serverData['idToken'] = id_token;
                console.log('id_token=',id_token)

                var user = {};  //construct a user object
                user.uid = id_token.payload.sub;
                user.name = id_token.payload.name;
                user.profile = id_token.payload.profile;
                req.session.serverData.user = user;

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

//retrieve a refresh token
app.get('/refresh', function(req, res)  {
    if (showLog) {
        console.log('/refresh')
    }

    //var tmp = req.session["serverData"]
    var refreshToken = req.session['refreshToken'];
    //if (req.session['refreshToken']) {
    if (! refreshToken) {       //no refresh code - return 403
        res.status(403).json({err:'No refresh token'});
        return;
    }
    //}

    var config = req.session["config"];
    console.log('config',config)
    if (!config ) {
        req.statusCode(400).json({err:'No config. Need to re-initialize.'})
        return;
    }

    if (! config.refresh) {
        req.statusCode(400).json({err:'Not configured for refresh'})
        return;
    }


    var options = {
        method: 'POST',
        uri: config.refresh,
        agentOptions: {         //allows self signed certificates to be used...
            rejectUnauthorized: false
        },
        //body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(refreshToken),
        body: 'grant_type=refresh_token&refresh_token=' + refreshToken,
        headers: {'content-type': 'application/x-www-form-urlencoded'}
    };



    var buff = new Buffer(config.clientId + ':' + config.secret);
    options.headers.Authorization = 'Basic ' + buff.toString('base64')
    //options.headers={accept:'fhir+json','authorization': 'Bearer ' + req.session['accessToken']};

    console.log(options)

//perform the request to get the auth token...
    request(options, function (error, response, body) {
        if (showLog) {
            console.log(' ----- after refresh token call -------');
            console.log('body ', body);
            console.log('error ', error);
        }
        if (response && response.statusCode == 200) {
            //save the access token in the session cache. Note that this is NOT sent to the client
            var token = JSON.parse(body);

            if (showLog) {
                console.log('token=', token);
            }

            req.session['accessToken'] = token['access_token'];
            req.session['refreshToken'] = token['refresh_token']
            //config.refresh = token['refresh_token'];        //because the refresh token can change
            res.json({accessToken:token['access_token']})

        } else {

            res.status(500).json({err:body})
        }
    })

});


//retrieve the server endpoints from the capability statement
var getSMARTEndpoints = function(config,capstmt) {
    var smartUrl = "http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris";
    try {
        var extensions = capstmt.rest[0].security.extension;

        extensions.forEach(function(ext) {
            if (ext.url == smartUrl) {
                ext.extension.forEach(function(child){
                    switch (child.url) {
                        case 'authorize' :
                            config.authorize = child.valueUri;
                            break;
                        case 'token' :
                            config.token = child.valueUri;
                            config.refresh = child.valueUri;    //this is for
                            break;
                        case 'register' :
                            config.register = child.valueUri;
                            break;
                        case 'manage' :
                            config.manage = child.valueUri;
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

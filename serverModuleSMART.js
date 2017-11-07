var mongoDb;

var request  = require('request');
var session = require('express-session');
var showLog = true;

// ORION|AAAA-0124-8 - charles dodson
// ORION|AAAA-0104-3 - cicilia silver
// ORION|AAAA-0200-7 - ann taylor
// ORION|AAAA-0111-6 - barbara gordon

var serverConfig = require("./artifacts/smart.json");   //all the config for the authentication

function setup(app,db) {
    mongoDb = db;

    app.use(session({
        secret: 'ohClinFhir',
        resave: false,
        saveUninitialized: true,
        cookie: { secure: false }
    }));


    //A proxy for talking to the Orion platform. Needed until CORS is supported..
    app.get('/orionProxy/:type',function(req,res){
        var type = req.params.type;
        var token = req.session['accessToken'];
        var hash = req.session.patientHash || {};



        //console.log(token);
        //console.log(type,req.query);

        var url = "https://orionhealth-sandbox-bellatrix.apigee.net/fhir/1.0/"+type + "?";
        var keys = Object.keys(req.query);
        //remove the _count parameter...

        keys.forEach(function(propName){
            if (propName !== '_count') {

                if (propName == 'patient') {
                    var id = req.query.patient;
                    url += "patient.identifier = ORION|" + hash[id]+ "&"
                } else if (propName == 'subject') {
                    var id = req.query.subject;
                    url += "subject.identifier = ORION|" + hash[id]+ "&"
                } else {
                    url += propName + "=" + req.query[propName] + "&"
                }

            }
        });
        url = url.slice(0,-1);
        url = url.replace(/ /g,'');     //get rid of all spaces...



        //console.log(url)

        var options = {
            uri : url,
            headers: {'accept': 'application/json+fhir','authorization': 'Bearer ' + token}

        };

        request(options, function (error, response, body) {
            //console.log(body)
            try {
                var json = JSON.parse(body);

                //assemble a hash of id / identifier so we can alter the query above...
                req.session.patientHash = req.session.patientHash || {};
                //var hash = {}
                if (json.resourceType == 'Bundle' && json.entry && json.entry.length) {
                    json.entry.forEach(function (entry) {
                        var resource = entry.resource;
                        if (resource.resourceType == 'Patient') {
                            if (resource.identifier) {
                                for (var i=0; i < resource.identifier.length; i++) {
                                    var ident = resource.identifier[i];
                                    if (ident.system == 'ORION') {
                                        req.session.patientHash[resource.id] = ident.value
                                        break;
                                    }
                                }
                            }
                        }

                    })
                }


                //console.log('hash', req.session.patientHash)

                res.json(json)
            } catch (ex) {
                res.json({msg:'invalid response',content:body})
            }
        })

    });


    //todo - this should be SSL...
    app.get('/smartAuth/getToken', function (req, res) {
        var token = req.session['accessToken'];
        console.log(token)
        if (token) {
            res.json({token:token})
        } else {
            res.status(400);
            res.json({err :"There is no token"})
        }

    });

    //allows the server to retrieve the auth stuff
    app.get('/smartAuth/:serverName', function (req, res) {
        req.session['accessToken'] = null;
        var config = serverConfig[req.params.serverName];
        if (config) {
            req.session["config"] = config;

            var authorizationUri = config.authorize;       //the base auth endpoint
            authorizationUri += "?redirect_uri=" + encodeURIComponent(config.callback);
            authorizationUri += "&scope=notifications";      //todo required in SMART
            //authorizationUri += "&state=" + encodeURIComponent("3(#0/!~");        //todo required in SMART
            authorizationUri += "&response_type=code";
            authorizationUri += "&client_id="+config.clientId;
            res.json({authUrl : authorizationUri})
        } else {
            res.status(403);
            res.json({err :req.params.serverName + " is not set up for SMART"})
        }
    });

    app.get('/smartCallback', function (req, res) {
        console.log('callback')
        var code = req.query.code;      //the code passed back from the auth server...
        var config = req.session["config"];

        if (! code) {
            res.redirect('error.html')
            return;
        }

       // var config = req.session["config"];     //retrieve the configuration from the session...

        //call the token endpoint directly as the library is placing key data in both headers & body, causing a failure
        var options = {
            method: 'POST',
            uri: config.token,
            body: 'code=' + code + "&grant_type=authorization_code&redirect_uri=" + config.callback + "&client_id=" + config.clientId + "&client_secret=" + config.secret,
            headers: {'content-type': 'application/x-www-form-urlencoded'}
        };
        var start = new Date().getTime();

        console.log(options)
        request(options, function (error, response, body) {


            if (showLog) {
                console.log(' ----- after token call -------');
                console.log('body ', body);
            }
            if (response && response.statusCode == 200) {


                req.session['accessToken'] = JSON.parse(body)['access_token'];
                console.log('access token: ' + req.session['accessToken']);

                res.redirect("patientViewer.html");
                /*
                var options = {
                    uri : config.baseUrl + "/fhir/1.0/metadata",
                    headers: {'content-type': 'application/json+fhir','authorization': 'Bearer ' + req.session['accessToken']}

                };

                console.log(options);

                request(options, function (error, response, body) {
                    console.log(body)
                    res.redirect("patientViewer.html");
                })
                */

            } else {
                res.redirect('error.html')
            }


        })

    });



}


module.exports= {
    setup : setup
}

//'use strict';

const express = require('express');
const simpleOauthModule = require('simple-oauth2');

var request = require('request');

var config = {};

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

/*
//sandpit...
config.clientId = 'MKCc2K0oH801KotKrh7ooVk2tvJavJAj';
config.secret = 'skqfIkZNEf1uZADe';
config.callback = 'http://localhost:3000/callback'
config.baseUrl = 'https://orionhealth-sandbox-bellatrix.apigee.net';

*/
//MOH
config.clientId = 'C5Ay3GjNHXh5UL4uKqBZCGFgIAeAd9fi';
config.secret = 'N8ma3zIa7erpARG6';
config.callback = 'http://localhost:3000/callback'
config.baseUrl = 'https://auth.moh.orionhealth.io';
config.tokenEndPoint = '/oauth2/token';


const app = express();
const oauth2 = simpleOauthModule.create({
    client: {
        id: config.clientId,
        secret: config.secret
    },
    auth: {
        tokenHost: config.baseUrl,
        tokenPath: '/oauth2/token',
        authorizePath: '/oauth2/authorize'
    }
});

// Authorization uri definition
const authorizationUri = oauth2.authorizationCode.authorizeURL({
    redirect_uri: config.callback,
    scope: 'notifications',
    state: '3(#0/!~'
});

// Initial page redirecting to Github
app.get('/auth', function(req, res)  {
    console.log(authorizationUri);
    res.redirect(authorizationUri);

    });

// Callback service parsing the authorization token and asking for the access token
app.get('/callback', function(req, res) {
    var code = req.query.code;


    console.log('code='+code);

    //call the token endpoint directly as the library is placing key data in both headers & body, causing a failure
    var options = {
        method:'POST',
        uri : config.baseUrl+config.tokenEndPoint,
        body : 'code='+code + "&grant_type=authorization_code&redirect_uri="+config.callback+"&client_id="+config.clientId+"&client_secret="+config.secret,
        headers: {'content-type':'application/x-www-form-urlencoded'}
    };

    console.log(options)

    request(options,function(error,response,body){
        console.log(error)
        if (response) {
            console.log(response.statusCode)
        }
        console.log(body);
    })

/*
    oauth2.authorizationCode.getToken(tokenConfig, function(error, result)  {
        if (error) {
            console.error('Access Token Error', error.message);
            return res.json('Authentication failed');
        }


    console.log('The resulting token: ', result);
    const token = oauth2.accessToken.create(result);

    return res
         .status(200)
        .json(token);
    });

    */
});

app.get('/success', function(req, res)  {
    res.send('');
});

app.get('/', function(req, res) {
    res.send('Hello<br><a href="/auth">Login</a>');
});

app.listen(3000, function() {
    console.log('Express server started on port 3000'); // eslint-disable-line
});



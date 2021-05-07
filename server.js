//simple server to serve static files...

var request  = require('request');

let http = require('http');
const https = require('https');

let cors = require('cors'); //https://www.npmjs.com/package/cors

var Fhir = require('fhir').Fhir;

var express = require('express');
var app = express();
app.use(cors());

let statsModule = require("./serverModuleStats")
var smartModule = require("./serverModuleSMART.js")

let registryModule = require('./serverModuleRegistry.js');

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

registryModule.setup(app)

wss.on('connection', function connection(ws) {
    ws.on('message', function incoming(message) {
        //console.log('received: %s', message);
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
        console.log('>>> Mongo server not running')
    } else {
        db = ldb;
      //  orionModule.setup(app,db);
        smartModule.setup(app,db);
        statsModule.setup(app,db);
    }
});

//allow the use of custom domains - like csiro.clinfhir.com
//need to create the domain in digitalocean as well...
//a hash of supported domains and the default page.
let domains = {}
domains['csiro.clinfhir.com'] = '/csiroProject.html';
domains['nz.clinfhir.com'] = '/nzProject.html';

app.use('/',function(req,res,next){

    if (req.originalUrl.length == 1) {

        if (domains[req.headers.host]) {
            res.sendFile(__dirname + domains[req.headers.host])
        } else {
            next();
        }
    } else {
        next();
    }
});

app.use('/', express.static(__dirname,{index:'/launcher.html'}));

console.log('listening on port '+port);


// ---------- for the server query - to strt with
app.post("/transformXML",function (req,res){
    //transform from Json to Xml
    let body= "";
    req.on('data', function (data) {
        body += data;
    });

    req.on('end', function () {
        let resource = JSON.parse(body)
        var fhir = new Fhir();
        var xml = fhir.objToXml(resource);
        //console.log(body,xml)
        res.send(xml)
    })
})


//attempt to start the SSL server...
try {
    // Certificate - https://itnext.io/node-express-letsencrypt-generate-a-free-ssl-certificate-and-run-an-https-server-in-5-minutes-a730fbe528ca
    const privateKey = fs.readFileSync('/etc/letsencrypt/live/clinfhir.com/privkey.pem', 'utf8');
    const certificate = fs.readFileSync('/etc/letsencrypt/live/clinfhir.com/cert.pem', 'utf8');
    const ca = fs.readFileSync('/etc/letsencrypt/live/clinfhir.com/chain.pem', 'utf8');

    const credentials = {
        key: privateKey,
        cert: certificate,
        ca: ca
    };

    const httpsServer = https.createServer(credentials, app);
    httpsServer.listen(443, () => {
        console.log('HTTPS Server running on port 443');
    });

} catch (ex) {
    console.log("SSL not enabled.")


}


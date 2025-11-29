
require("./instrument.js");

let fs = require('fs')

let http = require('http');
const https = require('https');
const bodyParser = require('body-parser')

let cors = require('cors'); //https://www.npmjs.com/package/cors

//var Fhir = require('fhir').Fhir;

var express = require('express');
var app = express();
app.use(cors());


const Sentry = require("@sentry/node");
Sentry.captureMessage(`Server startup`, 'info');
/*
try {
    foo();
} catch (e) {
    console.log(e)
    Sentry.captureException(e);
}
*/
app.use(bodyParser.json({limit:'50mb',type:['application/json+fhir','application/fhir+json','application/json']}))


app.post('/telemetry', async function(req,res) {

    const err = new Error("clinFHIR unhandled error");
    err.details = req.body
    Sentry.captureException(err);

    res.json({})


})


//let statsModule = require("./serverModuleStats")
let lantanaModule = require("./serverModuleLantana")
//var smartModule = require("./serverModuleSMART.js")
//let testingModule = require("./serverModuleTesting.js")
const proxyModule = require("./serverModuleProxy.js")
const bvModule = require("./serverModuleBV.js")

const fshModule = require("./serverModuleFSH.js")
const qaModule = require("./serverModuleQA.js")
qaModule.setup(app)

let registryModule = require('./serverModuleRegistry.js');
registryModule.setup(app)

//const patientCorectionsModule = require("./serverModulePatientTask.js")


/* temp*/
process.on('uncaughtException', function(err) {
    console.log('>>>>>>>>>>>>>>> Caught exception: ' + err);
    Sentry.captureException(err);
});

//var db;
var port = process.env.port;
if (! port) {
    port=8080;
}

let server = http.createServer(app).listen(port);

console.log(`listening on port ${port}`);


const { connect } = require("./serverModuleDb");

(async () => {
    const client = await connect();

    bvModule.setup(app,client)
    console.log('connected to mongoDb')
})();



/*
//set up the mongo connection
const mongoUrl = process.env.MONGO_URL || "mongodb://localhost:27017/clinfhir"

console.log(mongoUrl)

const { MongoClient } = require("mongodb");
const client = new MongoClient(mongoUrl, {
    connectTimeoutMS: 5000,
    socketTimeoutMS: 5000
});

// Wrap connect() in a timeout
function connectWithTimeout(client, timeoutMs) {
    return Promise.race([
        client.connect(), // attempt to connect
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error("MongoDB connection timed out")), timeoutMs)
        )
    ]);
}

// Usage
connectWithTimeout(client, 7000) // overall timeout of 7 seconds
    .then(() => {
        console.log("✅ Connected to MongoDB");
        const db = client.db("mydatabase");
        // do something with db
    })
    .catch(err => {
        console.error("❌ Connection failed:", err);
    });

*/


//not using WS now - was for logical modeller
/*
const WebSocket = require('ws');
const wss = new WebSocket.Server({server:server});
var taskModule = require("./serverModuleTask");
taskModule.setup(app,wss,WebSocket)     // need WebSocket for the constants

wss.on('connection', function connection(ws) {
    ws.on('message', function incoming(message) {
        //console.log('received: %s', message);
    });

    ws.send('Socket connection made');
});

*/

//if the port was passed in on a command line
process.argv.forEach(function (val, index) {
    if (val == '-p') {
        port = process.argv[index+1];
    }
});


fshModule.setup(app)
lantanaModule.setup(app)
proxyModule.setup(app);




//const { MongoClient } = require('mongodb');


/*
MongoClient.connect('mongodb://127.0.0.1:27017', { })
    .then(client => {
        const db = client.db('clinfhir'); // ✅ get the database here
        console.log('Connected to MongoDB');
       // statsModule.setup(app,db);


        // use db.collection('...') here
    })
    .catch(err => console.error(err));

*/




//allow the use of custom domains - like csiro.clinfhir.com
//need to create the domain in digitalocean as well...
//a hash of supported domains and the default page.
/*
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

*/
app.use('/', express.static(__dirname,{index:'/launcher.html'}));


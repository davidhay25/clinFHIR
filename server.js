
require("./instrument.js");
const Sentry = require("@sentry/node");
Sentry.captureMessage(`Server startup`, 'info');

let fs = require('fs')
let path = require('path');

let http = require('http');
const bodyParser = require('body-parser')

let cors = require('cors'); //https://www.npmjs.com/package/cors

var express = require('express');
var app = express();
app.use(cors());

//make the artifacts directly accessible
app.use('/artifacts', express.static(path.join(__dirname, 'artifacts')));

app.use(bodyParser.json({limit:'10mb',type:['application/json+fhir','application/fhir+json','application/json']}))


app.post('/telemetry', async function(req,res) {

    const err = new Error("clinFHIR unhandled error");
    err.details = req.body
    Sentry.captureException(err);

    res.json({})


})



let lantanaModule = require("./serverModuleLantana")
const proxyModule = require("./serverModuleProxy.js")
const bvModule = require("./serverModuleBV.js")
const fshModule = require("./serverModuleFSH.js")


process.on('uncaughtException', async (err) => {
    console.error(`[${new Date().toISOString()}] Uncaught exception:`, err.stack || err);
    Sentry.captureException(err);
    await Sentry.flush(2000);       // give Sentry up to 2s to actually send it
    server.close(() => process.exit(1));
    setTimeout(() => process.exit(1), 5000).unref();  // failsafe if close() hangs
});

process.on('unhandledRejection', async (reason) => {
    console.error(`[${new Date().toISOString()}] Unhandled rejection:`, reason);
    Sentry.captureException(reason instanceof Error ? reason : new Error(String(reason)));
    await Sentry.flush(2000);
    server.close(() => process.exit(2));
    setTimeout(() => process.exit(2), 5000).unref();
});

//var db;
var port = process.env.port;
if (! port) {
    port=8080;
}

let server = http.createServer(app).listen(port);
/* - monitor memory usage
setInterval(() => {
    const m = process.memoryUsage();
    const fmt = (n) => (n / 1024 / 1024).toFixed(1) + 'MB';
    console.log(`[MEMmain ${new Date().toISOString()}] rss=${fmt(m.rss)} heapUsed=${fmt(m.heapUsed)} external=${fmt(m.external)}`);
}, 60000).unref();
*/
console.log(`listening on port ${port}`);
const { connect } = require("./serverModuleDb");

(async () => {
    const client = await connect();

    bvModule.setup(app,client)
    console.log('connected to mongoDb')
})();



//if the port was passed in on a command line
process.argv.forEach(function (val, index) {
    if (val == '-p') {
        port = process.argv[index+1];
    }
});


fshModule.setup(app)
lantanaModule.setup(app)
proxyModule.setup(app);



app.use('/', express.static(__dirname,{index:'/launcher.html'}));


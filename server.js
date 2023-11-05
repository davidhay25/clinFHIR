let http = require('http');
let cors = require('cors');
var express = require('express');
var app = express();
app.use(cors());
const fshModule = require("./serverModuleFSH.js")

process.on('uncaughtException', function(err) {
    console.log('Caught exception: ' + err);
});

var port = process.env.port || 8000;
let server = http.createServer(app).listen(port);
console.log(`listening on port ${port}`);

fshModule.setup(app)

app.use('/', express.static(__dirname,{index:'/query.html'}));
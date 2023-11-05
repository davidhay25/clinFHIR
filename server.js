let fs = require('fs')
let http = require('http');
const https = require('https');
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

process.argv.forEach(function (val, index) {
    if (val == '-p') {
        port = process.argv[index+1];
    }
});

fshModule.setup(app)


app.use('/', express.static(__dirname,{index:'/query.html'}));
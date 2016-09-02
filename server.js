//simple server to serve static files...

var static = require('node-static');
var fileServer = new static.Server({ indexFile: "resourceCreator.html" });

var port = process.env.port;
if (! port) {
    port=80;
}

require('http').createServer(function (request, response) {
    request.addListener('end', function () {

        fileServer.serve(request, response, function (err, result) {
            if (err) { // There was an error serving the file
                console.error("Error serving " + request.url + " - " + err.message);

                // Respond to the client
                response.writeHead(err.status, err.headers);
                response.end();
            } else {
                console.log(request.url)
            }

        });
    }).resume();
}).listen(port);

console.log('listening on port '+port)
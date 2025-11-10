
//https://github.com/nodejitsu/node-http-proxy


httpProxy = require('http-proxy');

var proxy = httpProxy.createProxyServer({target:'http://fhir3.healthintersections.com.au/open/'});

proxy.listen(8010); 

proxy.on('proxyRes', function (proxyRes, req, res) {
    console.log('RAW Response from the target', JSON.stringify(proxyRes.headers, true, 2));
});

proxy.on('error', function (err, req, res) {
    res.writeHead(500, {
        'Content-Type': 'text/plain'
    });

    res.end('Something went wrong. And we are reporting a custom error message.');
});



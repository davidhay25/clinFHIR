const { fork } = require('child_process');
const path = require('path');

function setup(app) {

    app.post('/fsh/transformJsonToFsh', async function(req, res) {
        let body = req.body;
        if (!body) {
            return res.json({});
        }

        let resourceId = body.id;
        let json = JSON.stringify(body);

        const before = process.memoryUsage();
        const fmt = (n) => (n / 1024 / 1024).toFixed(1) + 'MB';

        const child = fork(path.join(__dirname, 'serverModuleFshWorker.js'));

        // failsafe: kill the child if it hangs, so requests can't pile up forever
        const timeout = setTimeout(() => {
            child.kill('SIGKILL');
            if (!res.headersSent) {
                res.status(504).json({ msg: 'FSH conversion timed out' });
            }
        }, 30000);

        child.once('message', (msg) => {
            clearTimeout(timeout);
            if (!res.headersSent) {
                if (msg.ok) {
                    res.json(msg.result);
                } else {
                    res.status(400).json({ msg: msg.error });
                }
            }
            child.kill(); // make sure it's gone even though it should self-exit
        });

        child.once('error', (err) => {
            clearTimeout(timeout);
            if (!res.headersSent) {
                res.status(500).json({ msg: 'Worker process error: ' + err.message });
            }
        });

        child.once('exit', (code) => {
            clearTimeout(timeout);
            const after = process.memoryUsage();
           // console.log(`[MEM fsh-parent] rss ${fmt(before.rss)} -> ${fmt(after.rss)} | heap ${fmt(before.heapUsed)} -> ${fmt(after.heapUsed)} | external ${fmt(before.external)} -> ${fmt(after.external)} | worker exit code ${code}`);


            if (!res.headersSent) {
                res.status(500).json({ msg: `Worker exited unexpectedly (code ${code})` });
            }
        });

        child.send({ json, resourceId });
    });
}

module.exports = { setup };
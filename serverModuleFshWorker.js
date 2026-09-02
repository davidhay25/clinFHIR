// serverModuleFshWorker.js
// Runs a single FHIR->FSH conversion, sends the result back via IPC, then exits.
// Isolating this in its own process means any memory gofsh/fsh-sushi leaks
// dies with the process instead of accumulating in the main app.

const gofshClient = require('gofsh').gofshClient;

process.on('message', async (msg) => {
    const { json, resourceId } = msg;

    try {
        const config = { logLevel: 'silent', dependencies: ['hl7.fhir.r4.core#4.0.1'] };
        const result = await gofshClient.fhirToFsh([json], config);
        result.resourceId = resourceId;
        process.send({ ok: true, result });
    } catch (ex) {
        process.send({ ok: false, error: ex.message });
    } finally {
        process.exit(0); // always exit — this is what actually reclaims the leaked memory
    }
});
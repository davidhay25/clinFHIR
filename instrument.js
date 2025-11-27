// Import with `import * as Sentry from "@sentry/node"` if you are using ESM
const Sentry = require("@sentry/node");

Sentry.init({
    dsn: "https://189149f7b4e0e9d0314a9f1235b715c4@o4510411005558784.ingest.de.sentry.io/4510411009884240",
    // Setting this option to true will send default PII data to Sentry.
    // For example, automatic IP address collection on events
    sendDefaultPii: true,
});
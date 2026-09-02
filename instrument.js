const Sentry = require("@sentry/node");

Sentry.init({
    dsn: process.env.SENTRY_DSN || "https://189149f7b4e0e9d0314a9f1235b715c4@o4510411005558784.ingest.de.sentry.io/4510411009884240",
    environment: process.env.NODE_ENV || "production",

    sendDefaultPii: false,        // stop auto-collecting IP/cookies/headers
    tracesSampleRate: 0.1,        // light performance tracing, not required but cheap

    beforeSend(event) {
        // guard against any oversized payload ever reaching Sentry
        if (event.extra?.details) {
            delete event.extra.details;
        }
        return event;
    },
});

module.exports = Sentry;
// db.js
const { MongoClient } = require("mongodb");

const mongoUrl = process.env.MONGO_URL || "mongodb://localhost:27017/clinfhir";
const client = new MongoClient(mongoUrl, {
    connectTimeoutMS: 5000,
    socketTimeoutMS: 30000,
    maxPoolSize: 20
});

async function connect() {
    await client.connect();
    console.log("✅ Connected to MongoDB: "+ mongoUrl);
    return client// return the client

}

module.exports = { connect };

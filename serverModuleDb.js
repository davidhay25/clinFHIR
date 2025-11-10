// db.js
const { MongoClient } = require("mongodb");

const mongoUrl = process.env.MONGO_URL || "mongodb://localhost:27017/clinfhir";
const client = new MongoClient(mongoUrl, {
    connectTimeoutMS: 5000,
    socketTimeoutMS: 5000
});

async function connect() {
    await client.connect();
    console.log("✅ Connected to MongoDB: "+ mongoUrl);
    return client// return the client

    //return client.db("clinfhir"); // return the DB instance
}

module.exports = { connect };

const express = require('express')
const app = express();
require('dotenv').config();
const cors = require('cors');
const port = process.env.PORT || 5000;

// Middlewires
app.use(cors());
app.use(express.json());



const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_ADMIN}:${process.env.DB_PASSWORD}@cluster0.4qal0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

        const usersCollection = client.db("taskHiveDB").collection("users");



        // -------  User related API -------


        // Get a User Information
        app.get("/user", async (req, res)=> {
            const query = {email: req?.query?.email};
            const result = await usersCollection.findOne(query);
            res.send(result);
        })


        // Insert New Useronly into DataBase
        app.put("/users", async (req, res) => {
            let coinValue;
            if (req?.body?.role ==="buyer") {
                coinValue = 50;
            }
            else {
                coinValue = 10;
            }
            const filter = { email: req?.body?.email };
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    displayName: req?.body?.displayName,
                    email: req?.body?.email,
                    photoURL: req?.body?.photoURL,
                    role: req?.body?.role,
                    coin: coinValue,
                },
            };
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.send(result);
        })
        





    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}

run().catch(console.dir);


app.get('/', (req, res) => {
    res.send("TaskHive is on operation");
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
const express = require('express')
const app = express();
require('dotenv').config();
const cors = require('cors');
const port = process.env.PORT || 5000;

// Middlewires
app.use(cors());
app.use(express.json());



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
        const tasksCollection = client.db("taskHiveDB").collection("tasks");



        // -------  User related API -------


        // Get a User Information
        app.get("/user", async (req, res) => {
            const query = { email: req?.query?.email };
            const result = await usersCollection.findOne(query);
            res.send(result);
        })


        // Insert New Useronly into DataBase
        app.put("/users", async (req, res) => {
            let coinValue;
            if (req?.body?.role === "buyer") {
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


        // ---------Tasks Collections---------

        // Posting a Task
        app.post("/tasks", async (req, res) => {
            const reduceCoin = req?.body?.requiredWorkers * req?.body?.payableAmount;

            const reduceCoinFilter = { email: req?.body?.postedBy };

            const reduceCoinDoc = {
                $inc: {
                    coin: -reduceCoin,
                },
            };
            const reduceCoinResult = await usersCollection.updateOne(reduceCoinFilter, reduceCoinDoc);

            // After cuting coin from the account
            if (reduceCoinResult?.modifiedCount) {

                const taskDoc = {

                    taskTitle: req?.body?.taskTitle,
                    taskDetails: req?.body?.taskDetails,
                    requiredWorkers: parseInt(req?.body?.requiredWorkers),
                    payableAmount: parseInt(req?.body?.payableAmount),
                    completionDate: req?.body?.completionDate,
                    submissionInfo: req?.body?.submissionInfo,
                    taskImage: req?.body?.taskImage,
                    postedBy: req?.body?.postedBy,

                }


                const taskPostingResult = await tasksCollection.insertOne(taskDoc);
                res.send({ taskPostingResult, reduceCoinResult });
            }
        })


        // Update a Task
        app.patch("/updateTask", async (req, res) => {
            const filter = {_id: new ObjectId(req?.body?._id)}
            const updateTaskDoc = {
                $set: {
                    taskTitle: req?.body?.taskTitle,
                    submissionInfo: req?.body?.submissionInfo,
                    taskDetails: req?.body?.taskDetails,
                }
            }
            const result = await tasksCollection.updateOne(filter, updateTaskDoc);
            res.send(result);

        })


        // Get All tasks of a Spacific User sort by date
        app.get("/myTask", async (req, res) => {
            const query = { postedBy: req?.query?.email }
            const option = {
                sort: { "completionDate": -1 }
            }
            const result = await tasksCollection.find(query, option).toArray();
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
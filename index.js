const express = require('express')
const app = express();
require('dotenv').config();
const cors = require('cors');
const stripe = require("stripe")(process.env.STRIPE_SK);
const port = process.env.PORT || 5000;

// Middlewires
app.use(cors());
app.use(express.json());


// Const Custom Function for convert USD to Coins
const usdToCoin = (usd) => {

    if (usd === 1) {
        return 10;
    }

    else if (usd === 10) {
        return 150;
    }

    else if (usd === 20) {
        return 500;
    }

    else if (usd === 35) {
        return 1000;
    }

    else {
        return 0;
    }


}


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
        const paymentsCollection = client.db("taskHiveDB").collection("payments");



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


            if (taskPostingResult?.insertedId) {
                const reduceCoinResult = await usersCollection.updateOne(reduceCoinFilter, reduceCoinDoc);
                res.send({ taskPostingResult, reduceCoinResult });
            }


        })


        // Update a Task
        app.patch("/updateTask", async (req, res) => {
            const filter = { _id: new ObjectId(req?.body?._id) }
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

        // Delete a Task
        app.delete("/deleteTask", async (req, res) => {
            const query = { _id: new ObjectId(req?.query?.id) }

            const findTaskDetails = await tasksCollection.findOne(query);
            const refillAmount = findTaskDetails?.requiredWorkers * findTaskDetails?.payableAmount;

            console.log(findTaskDetails, refillAmount)
            const refillFilter = { email: findTaskDetails?.postedBy }
            const refillCoinDoc = {
                $inc: { coin: refillAmount }
            }

            const deleteResult = await tasksCollection.deleteOne(query);

            if (deleteResult?.deletedCount) {
                const refillResult = await usersCollection.updateOne(refillFilter, refillCoinDoc);

                res.send(refillResult)
            }
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






        // Get Payment By Buyer
        app.post("/create-payment-intent", async (req, res) => {
            const { fee } = req.body;
            const amount = parseInt(fee * 100);

            console.log(amount);

            try {
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: amount,
                    currency: "usd",
                    payment_method_types: ["card"]
                })

                res.send({
                    clientSecret: paymentIntent.client_secret,
                });
            }

            catch {
                res.send({ message: "error" });
            }




        })

        // Saved Payment Information To MongoDB and Add Coins to Users
        app.post("/payment", async (req, res) => {

            const paymentDoc = {
                transactionId: req?.body?.transactionId,
                amount: req?.body?.amount,
                email: req?.body?.email,
                displayName: req?.body?.displayName,
                date: req?.body?.date,
                coin: usdToCoin(parseInt(req?.body?.amount)),
            }

            const incCoinDoc = {
                $inc: { coin: paymentDoc.coin }
            }

            const filter = { email: req?.body?.email };

            const incrementCoinResult = await usersCollection.updateOne(filter, incCoinDoc);

            if (incrementCoinResult?.modifiedCount) {
                const paymentResult = await paymentsCollection.insertOne(paymentDoc);
                res.send (paymentResult);
            }

            else {
                res.send ({error: "Error while storing payment data"})
            }
        })

        // Get all paymentdetails from a specific Buyer
        app.get ("/payment", async (req, res)=> {
            const query = {email: req?.query?.email};
            const result = await paymentsCollection.find(query).toArray();
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
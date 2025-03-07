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
        // await client.connect();
        // // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");

        const usersCollection = client.db("taskHiveDB").collection("users");
        const tasksCollection = client.db("taskHiveDB").collection("tasks");
        const paymentsCollection = client.db("taskHiveDB").collection("payments");

        const submissionCollection = client.db("taskHiveDB").collection("submission");
        const withdrawCollection = client.db("taskHiveDB").collection("withdraw");


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



        // ---Buyer related apis

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
        
        
        // Get all submission for approve action : Buyer Related
        app.get("/getSubmission", async (req, res)=> {
            const query =  {buyerEmail: req?.query?.email, status: "pending"}
            const result = await submissionCollection.find(query).toArray();
            res.send(result);
        })

        // Approve Submission by Buyer
        app.patch ("/approveSubmission", async (req, res)=> {
            const approveFilter = {_id: new ObjectId(req?.query?.id)};
            const approveDoc = {$set: {status: "approved"}}
            const approveResult = await submissionCollection.updateOne(approveFilter, approveDoc);

            if (approveResult?.modifiedCount) {
                const incCoinDoc = {
                    $inc: { coin: parseInt(req?.body?.payableCoin)}
                }

                const incFilter = {email: req?.body?.workerEmail}

                const incrementCoinResult = await usersCollection.updateOne(incFilter, incCoinDoc);

                res.send (incrementCoinResult);
            }
        })

        // Reject Submission by Buyer
        app.patch ("/rejectSubmission", async (req, res)=> {
            const rejectedFilter = {_id: new ObjectId(req?.query?.id)};
            const rejectedDoc = {$set: {status: "rejected"}}
            const rejectedResult = await submissionCollection.updateOne(rejectedFilter, rejectedDoc);

            if (rejectedResult?.modifiedCount) {
                const incReqWorkerDoc = {
                    $inc: { requiredWorkers: 1}
                }

                const incFilter = {_id: new ObjectId(req?.body?.taskId)}

                const incReqWorkerDocResult = await tasksCollection.updateOne(incFilter, incReqWorkerDoc);

                res.send (incReqWorkerDocResult);
            }
        })

        
        
        //   worker related APIS

        //    Get All Task For Worker
        app.get("/task", async (req, res) => {
            const result = await tasksCollection.aggregate([

                {
                    $match: {
                        requiredWorkers: { $gt: 0 }
                    }
                },

                {
                    $lookup: {
                        from: 'users',
                        localField: 'postedBy',
                        foreignField: 'email',
                        as: 'userInfo'
                    }
                },
                {
                    $unwind: "$userInfo"
                },
                {
                    $project: {
                        _id: 1,
                        taskTitle: 1,
                        taskDetails: 1,
                        requiredWorkers: 1,
                        payableAmount: 1,
                        completionDate: 1,
                        submissionInfo: 1,
                        taskImage: 1,
                        buyerEmail: "$postedBy",
                        buyerName: "$userInfo.displayName",
                        buyerPhoto: "$userInfo.photoURL",
                    }
                }

            ]).toArray();
            res.send(result);
        })


        // Get a specific task details by task _id for Worker
        app.get("/taskDetails", async (req, res) => {
            try {
                const cursor = tasksCollection.aggregate([

                    {
                        $match: {
                            _id: new ObjectId(req.query.id),
                        }
                    },

                    {
                        $lookup: {
                            from: 'users',
                            localField: 'postedBy',
                            foreignField: 'email',
                            as: 'userInfo'
                        }
                    },
                    {
                        $unwind: "$userInfo"
                    },
                    {
                        $project: {
                            _id: 1,
                            taskTitle: 1,
                            taskDetails: 1,
                            requiredWorkers: 1,
                            payableAmount: 1,
                            completionDate: 1,
                            submissionInfo: 1,
                            taskImage: 1,
                            buyerEmail: "$postedBy",
                            buyerName: "$userInfo.displayName",
                            buyerPhoto: "$userInfo.photoURL",
                        }
                    }

                ]);

                const result = await cursor.next();
                res.send(result);
            }

            catch {
                res.status(404).send({ message: "No task found for Query ID" });
            }
        })


        // Post a Submission by Worker
        app.post("/submission", async (req, res) => {
            const submissionDoc = {
                taskId: req?.body?.taskId,
                taskTitle: req?.body?.taskTitle,
                payableAmount: parseInt(req?.body?.payableAmount),
                buyerEmail: req?.body?.buyerEmail,
                buyerName: req?.body?.buyerName,
                buyerPhoto: req?.body?.buyerPhoto,
                workerEmail: req?.body?.workerEmail,
                workerName: req?.body?.workerName,
                workerPhoto: req?.body?.workerPhoto,
                submissionDetails: req?.body?.submissionDetails,
                currentDate: req?.body?.currentDate,
                status: req?.body?.status,
            }

            const result = await submissionCollection.insertOne(submissionDoc);

            res.send(result);
        })

        // Get My Submission by The Email of Woker
        app.get("/mySubmission", async (req, res) => {
            const query = { workerEmail: req?.query?.email };
            const options = { $sort: { currentDate: 1 } }
            const result = await submissionCollection.find(query).toArray();

            res.send(result);

        })

        // Withdraw by Worker
        app.post("/withdraw", async (req, res) => {
            const withdrawDoc = {
                paymentMethod: req?.body?.paymentMethod,
                accountNo: req?.body?.accountNo,
                usdAmount: parseInt(req?.body?.usdAmount),
                coinAmount: parseInt(req?.body?.coinAmount),
                currentDate: req?.body?.currentDate,
                status: req?.body?.status,
                workerEmail: req?.body?.workerEmail,
                workerName: req?.body?.workerName,
                workerPhoto: req?.body?.workerPhoto,
            }

            const result = await withdrawCollection.insertOne(withdrawDoc);

            res.send(result);
        })

        // Worker Stats API
        app.get("/workerStats", async (req, res) => {
            const workerEmail = req?.query?.email;
            const workerStats = await submissionCollection.aggregate([
                {
                    $facet: {
                        allSubmission: [{ $match: { workerEmail: workerEmail } }, { $count: "submissions" }],
                        pendingSubmission: [{ $match: { workerEmail: workerEmail, status: "pending" } }, { $count: "pendingSubmissions" }],
                        earnings: [{ $match: { workerEmail: workerEmail, status: "approved" } }, { $group: { _id: null, totalEarnings: { $sum: "$payableAmount" } } }],
                    }
                }
            ]).toArray();

            const result = {

                totalSubmission: workerStats[0]?.allSubmission[0]?.submissions || 0,
                totalPendingSubmission: workerStats[0]?.pendingSubmission[0]?.pendingSubmissions || 0,
                totalEarnings: workerStats[0]?.earnings[0]?.totalEarnings || 0,

            };

            res.send(result)
        })


        // Approve submission for view only by worker
        app.get("/approvedSubmission", async (req, res) => {
            const query = { workerEmail: req?.query?.email, status: "approved" }
            const result = await submissionCollection.find(query).toArray();
            res.send(result);
        })




        // Buyer related APIs

        // Get Payment By Buyer
        app.post("/create-payment-intent", async (req, res) => {
            const { fee } = req.body;
            const amount = parseInt(fee * 100);

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
                res.send(paymentResult);
            }

            else {
                res.send({ error: "Error while storing payment data" })
            }
        })

        // Get all paymentdetails from a specific Buyer
        app.get("/payment", async (req, res) => {
            const query = { email: req?.query?.email };
            options = {
                sort: { date: -1 }
            }
            const result = await paymentsCollection.find(query, options).toArray();
            res.send(result);
        })

        // Buyer stats have to work not completed
        app.get("/buyerStats", async (req, res) => {
            const buyerEmail = req?.query?.email;
            const buyerStats = await tasksCollection.aggregate([
                {
                    $facet: {
                        alltasks: [{ $match: { postedBy: buyerEmail } }, { $count: "tasks" }],
                        allPendingTasks: [{ $match: { postedBy: buyerEmail } }, { $group: { _id: null, pendingTasks: { $sum: "$requiredWorkers" } } }],
                    }
                }
            ]).toArray();

            const paymentStats = await paymentsCollection.aggregate([
                { $match: { email: buyerEmail } }, { $group: { _id: null, allpayment: { $sum: "$amount" } } }
            ]).toArray();

            const result = {

                totalTasks: buyerStats[0]?.alltasks[0]?.tasks || 0,
                totalPendingTask: buyerStats[0]?.allPendingTasks[0]?.pendingTasks || 0,
                totalPayments: paymentStats[0]?.allpayment || 0,

            };

            res.send(result)
        })





        //-----Admin APIS------

        // For admin stats
        app.get("/adminStats", async (req, res) => {
            const userStats = await usersCollection.aggregate([
                {
                    $facet: {
                        buyers: [{ $match: { role: "buyer" } }, { $count: "buyerNumber" }],
                        workers: [{ $match: { role: "worker" } }, { $count: "workerNumber" }],
                        totalCoins: [{ $group: { _id: null, totalCoinBalance: { $sum: "$coin" } } }]
                    }
                }
            ]).toArray();

            const paymentStats = await paymentsCollection.aggregate([
                {
                    $group: { _id: null, totalPayment: { $sum: "$amount" } }
                }
            ]).toArray();

            const result = {
                buyerNumber: userStats[0].buyers[0]?.buyerNumber || 0,
                workerNumber: userStats[0].workers[0]?.workerNumber || 0,
                totalCoinBalance: userStats[0].totalCoins[0]?.totalCoinBalance || 0,
                totalPayment: paymentStats[0]?.totalPayment || 0,

            };

            res.send(result)
        })

        // Get all withdraw request
        app.get("/pendingWithdraw", async (req, res) => {
            const query = { status: "pending" }
            const result = await withdrawCollection.find(query).toArray();
            res.send(result);
        })

        // Approve Withdraw Status
        app.patch("/approveWithdraw", async (req, res) => {
            const filter = { _id: new ObjectId(req?.body?.id) }
            const approveDoc = {
                $set: { status: "approved" }
            }
            const approveResult = await withdrawCollection.updateOne(filter, approveDoc);

            const reduceFilter = { email: req?.body?.workerEmail }

            const coinAmount = parseInt(req?.body?.coinAmount)

            const reduceCoinDoc = {
                $inc: { coin: -coinAmount }
            }

            if (approveResult?.modifiedCount) {
                const reduceResult = await usersCollection.updateOne(reduceFilter, reduceCoinDoc);

                res.send(reduceResult)
            }

        })


        // Get All users Info
        app.get("/allUsers", async (req, res) => {

            const result = await usersCollection.find().toArray();
            res.send(result);
        })


        // Get All Tasks
        app.get("/allTask", async (req, res) => {
            const result = await tasksCollection.find().toArray();
            res.send(result);
        })

        // Delete Task By Admin
        app.delete("/deleteTaskByAdmin", async (req, res) => {
            const query = { _id: new ObjectId(req?.query?.id) }

            const findTaskDetails = await tasksCollection.findOne(query);



            const refillAmount = findTaskDetails?.requiredWorkers * findTaskDetails?.payableAmount;
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

        // Chnage user role
        app.patch("/changeRole", async (req, res) => {
            const filter = { _id: new ObjectId(req?.body?.userId) }
            const roleDoc = { $set: { role: req?.body?.newRole } };

            const result = await usersCollection.updateOne(filter, roleDoc);

            res.send(result)
        })

        // Delete User Role
        app.delete("/deleteUserByAdmin", async (req, res) => {
            const filter = { _id: new ObjectId(req?.query?.id) }
            const result = await usersCollection.deleteOne(filter);
            res.send(result)
        })




        // API for PUblic
        app.get("/bestWorkers", async (req, res)=> {
            const result = await usersCollection.aggregate([
                { $match: { role: 'worker' } }, 
                { $sort: { coin: -1 } },
                { $limit: 8 }
              ]).toArray();

              res.send(result);
        })

        app.get("/featuredTask", async (req, res) => {
            const result = await tasksCollection.aggregate([

                {
                    $match: {
                        requiredWorkers: { $gt: 0 }
                    },
                    
                },

                { $sort: { payableAmount: -1 } },
                { $limit: 8 },

                {
                    $lookup: {
                        from: 'users',
                        localField: 'postedBy',
                        foreignField: 'email',
                        as: 'userInfo'
                    }
                },
                {
                    $unwind: "$userInfo"
                },
                {
                    $project: {
                        _id: 1,
                        taskTitle: 1,
                        taskDetails: 1,
                        requiredWorkers: 1,
                        payableAmount: 1,
                        completionDate: 1,
                        submissionInfo: 1,
                        taskImage: 1,
                        buyerEmail: "$postedBy",
                        buyerName: "$userInfo.displayName",
                        buyerPhoto: "$userInfo.photoURL",
                    }
                }

            ]).toArray();
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
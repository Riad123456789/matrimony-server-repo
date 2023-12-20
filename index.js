const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const stripe = require("stripe")(process.env.PEYMENT_KEY)
const jwt = require('jsonwebtoken')
const morgan = require('morgan')
const port = process.env.PORT || 5000


const corsOptions = {
    origin: ["https://assignment-12-project.web.app",'http://localhost:5174'],
    credentials: true,
    optionSuccessStatus: 200,
}
app.use(cors(corsOptions))
app.use(express.json())
app.use(cookieParser())
app.use(morgan('dev'))
const verifyToken = async (req, res, next) => {
    const token = req.cookies?.token
    if (!token) {
        return res.status(401).send({ message: 'unauthorized access' })
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {

        if (err) {
            return res.status(401).send({ message: 'unauthorized access' })
        }
        req.user = decoded
        next()
    })
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.vifd4px.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
})
async function run() {
    try {

        const userCollection = client.db("MatrimonyDB").collection("users");
        const dataCollection = client.db("MatrimonyDB").collection("data");
        const favoriteBiodataCollection = client.db("MatrimonyDB").collection("favoriteData");
        const requestBiodataCollection = client.db("MatrimonyDB").collection("requestData");


        app.post('/jwt', async (req, res) => {
            const user = req.body
            const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
                expiresIn: '365d',
            })
            res
                .cookie('token', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                })
                .send({ success: true })
        })



        app.get('/logout', async (req, res) => {
            try {
                res
                    .clearCookie('token', {
                        maxAge: 0,
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                    })
                    .send({ success: true })
            } catch (err) {
                res.status(500).send(err)
            }
        })



        app.put('/users/:email', async (req, res) => {
            const email = req.params.email
            const user = req.body
            const query = { email: email }
            const options = { upsert: true }
            const isExist = await userCollection.findOne(query)
            if (isExist) return res.send(isExist)
            const result = await userCollection.updateOne(
                query,
                {
                    $set: { ...user, timestamp: Date.now() },
                },
                options
            )
            res.send(result)
        })


        app.patch('/AllBiodataUpdate/:id', async (req, res) => {

            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const update = req.body;
            const updateDoc = {
                $set: {
                    BiodataStatas: update.BiodataStatas,
                }
            }
            const result = await dataCollection.updateOne(filter, updateDoc)
            res.send(result)

        })



        app.patch('/MakeAdmin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const update = req.body;
            const updateDoc = {
                $set: {
                    role: update.role,
                }
            }
            const result = await userCollection.updateOne(filter, updateDoc)
            res.send(result)

        })


        app.patch('/approvedrequest/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const update = req.body;
            const updateDoc = {
                $set: {
                    statas: update.statas,
                }
            }
            const result = await requestBiodataCollection.updateOne(filter, updateDoc)
            res.send(result)

        })




        app.get('/users', async (req, res) => {
            const result = await userCollection.find().toArray()
            res.send(result)
        })



        app.get('/user/:email', async (req, res) => {
            const email = req.params.email
            const result = await userCollection.findOne({ email })
            res.send(result)
        })




        app.post('/Biodata', async (req, res) => {

            const BiodataId = await dataCollection.find().toArray()
            const data = req.body;
            // console.log(BiodataId.length + 1)

            await dataCollection.insertOne(data);
            const options = { upsert: true }
            const result = await dataCollection.updateOne(
                data,
                {
                    $set: { Biodataid: BiodataId.length + 1 },
                },
                options
            )
            res.send(result)

        })



        app.post('/favoriteData', async (req, res) => {
            const data = req.body
            const result = await favoriteBiodataCollection.insertOne(data)
            res.send(result)
        })



        app.get('/Allfavorite', async (req, res) => {
            const result = await favoriteBiodataCollection.find().toArray()
            res.send(result)
        })


        app.get('/AllfavoriteBiodata/:email', async (req, res) => {
            const email = req.params.email
            const query = { Email: email }
            const result = await favoriteBiodataCollection.find(query).toArray()
            res.send(result)
        })



        app.delete("/deletefavoriteBiodata/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await favoriteBiodataCollection.deleteOne(query);
            res.send(result);
        })


        app.delete("/deleteRequestBiodata/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await requestBiodataCollection.deleteOne(query);
            res.send(result);
        })




        app.post('/requestdata', async (req, res) => {
            const data = req.body
            const result = await requestBiodataCollection.insertOne(data)
            res.send(result)
        })


        app.get('/Allrequestdata', async (req, res) => {
            const data = req.body
            const result = await requestBiodataCollection.find(data).toArray()
            res.send(result)
        })


        // paymeny

        app.post('/create-payment-intent', async (req, res) => {

            const { price } = req.body;

            console.log(price)
            const amount = parseInt(price * 100)
            if (!price || amount < 1) return res.send('aaa')
            const { client_secret } = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ['card'],
            });
            res.send({
                clientSecret: client_secret,
            });
        })





        app.get('/AllBiodata', async (req, res) => {
            const result = await dataCollection.find().toArray()
            res.send(result)

        })



        app.get('/AllBiodataa', async (req, res) => {
            let query = {};
            const Type = req.query.Type
            const Permanent_Division = req.query.Permanent_Division
            const Age = req.query.Age
            if (Type) {
                query.Type = Type;
            }
            if (Permanent_Division) {
                query.Permanent_Division = Permanent_Division;
            }
            if (Age) {
                query.Age = Age;
            }
            const cursor = dataCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);

        })







        app.get('/AllBiodata/:email', verifyToken, async (req, res) => {
            const email = req.params.email
            const query = { Email: email }
            const result = await dataCollection.find(query).toArray()
            res.send(result)

        })



        app.get('/SingleBiodata/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await dataCollection.findOne(query)
            res.send(result)
        })











        // await client.db('admin').command({ ping: 1 })
        console.log(
            'Pinged your deployment. You successfully connected to MongoDB!'
        )
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir)

app.get('/', (req, res) => {
    res.send('server is running')
})

app.listen(port, () => {
    console.log(`Server is running on port ${port}`)
})

const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const jwt = require('jsonwebtoken')
const morgan = require('morgan')
const port = process.env.PORT || 5000


const corsOptions = {
    origin: ['http://localhost:5173'],
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


        await client.db('admin').command({ ping: 1 })
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

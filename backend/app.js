const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const multer = require('multer');
require('dotenv').config()

const feedRoutes = require('./routes/feed');
const authRoutes = require('./routes/auth');

const app = express();

const storage = multer.diskStorage({
    destination: (req, file, callback) => {
        callback(null, 'images');
    },
    filename: (req, file, callback) => {
        callback(null, new Date().toISOString() + '-' + file.originalname);
    }
})

const fileFilter = (req, file, callback) => {
    if (
        file.mimetype === 'image/png' ||
        file.mimetype === 'image/jpg' ||
        file.mimetype === 'image/jpeg'
    ) {
        callback(null, true);
    }
    else {
        callback(null, false);
    }
}

app.use(bodyParser.json());
app.use(multer({storage, fileFilter}).single('image'));

app.use('/images', express.static(path.join(__dirname, 'images')));
app.use(cors());

app.use('/feed', feedRoutes);
app.use('/auth', authRoutes);

app.use((error, req, res, next) => {
    console.log(error);
    const statusCode = error.statusCode || 500;
    const {message, data} = error;
    res.status(statusCode).json({message, data});
})

mongoose.connect(process.env.MONGODB_URI)
.then(result => {
    const server = app.listen(8080);
    const io = require('./socket').init(server);
    // setup websocket connection
    io.on('connection', socket => {
        console.log('Client connected');
    });
})
.catch(err => {
    console.log(err);
})

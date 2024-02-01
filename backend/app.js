const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const multer = require('multer');
const {graphqlHTTP} = require('express-graphql');
const {clearImage} = require('./util/clearImage');

const graphqlSchema = require('./graphql/schema');
const graphqlResolver = require('./graphql/resolvers');
const auth = require('./middleware/auth');

require('dotenv').config()

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

app.use(auth);

app.put('/post-image', (req, res, next) => {
    if (!req.isAuth){
        throw new Error('Not Authenticated!');
    }
    if (!req.file) {
        return res.status(200).json({message: 'No file provided!'});
    }
    if (req.body.oldPath) {
        clearImage(req.body.oldPath);
    }
    return res.status(200).json({message: 'File stored.', filePath: req.file.path})
})


app.use('/graphql', graphqlHTTP({
    schema: graphqlSchema,
    rootValue: graphqlResolver,
    graphiql: true,
    formatError(err) {
        if (!err.originalError) {
            return err;
        }
        const data = err.originalError.data;
        const message = err.message || 'An error occured.';
        return {message, data};
    }
}));

app.use((error, req, res, next) => {
    console.log(error);
    const statusCode = error.statusCode || 500;
    const {message, data} = error;
    res.status(statusCode).json({message, data});
})

mongoose.connect(process.env.MONGODB_URI)
.then(result => {
    app.listen(8080);
})
.catch(err => {
    console.log(err);
})

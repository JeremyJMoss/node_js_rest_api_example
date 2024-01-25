const User = require('../models/user');
const { validationResult } = require('express-validator');
const brcypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

exports.signup = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()){
        const error = new Error('Validation failed.');
        error.statusCode = 422;
        error.data = errors.array();
        throw error;
    }
    const {email, name, password} = req.body;
    brcypt
        .hash(password, 12)
        .then(hashedPassword => {
            const user = new User({
                email,
                password: hashedPassword,
                name
            });
            return user.save();
        })
        .then(result => {
            res.status(201).json({
                message: "User created!",
                userId: result._id
            })
        })
        .catch(err => {
            if (!err.statusCode) {
                err.statusCode = 500;
            }
            next(err);
        })
}

exports.login = (req, res, next) => {
    const {email, password} = req.body;
    let loadedUser;

    User.findOne({email})
    .then(user => {
        if (!user){
            const error = new Error('A user with this email could not be found');
            error.statusCode = 401;
            throw error;
        }
        loadedUser = user;
        return brcypt.compare(password, user.password);
    })
    .then(isEqual => {
        if (!isEqual){
            const error = new Error('Wrong password!');
            error.statusCode = 401;
            throw error;
        }
        const token = jwt.sign({
            email: loadedUser.email,
            userId: loadedUser._id.toString()
        }, process.env.JWT_TOKEN, {
            expiresIn: '1h'
        });

        res.status(200).json({
            token,
            userId: loadedUser._id.toString()
        })
    })
    .catch(err => {
        if (!err.statusCode){
            err.statusCode = 500;
        }
        next(err);
    })
}
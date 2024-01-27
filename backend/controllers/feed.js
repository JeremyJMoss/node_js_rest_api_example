const {validationResult} = require('express-validator');
const fs = require('fs');
const path = require('path');
const io = require('../socket');

const Post = require('../models/post');
const User = require('../models/user');

const clearImage = filePath => {
    filePath = path.join(__dirname, '..', filePath);
    fs.unlink(filePath, err => {
        if (err) {
            console.log(err);
        }
    });
}

exports.getPosts = async (req, res, next) => {
    const currentPage = req.query.page || 1;
    const perPage = 2;
    try{
        const count = await Post.find().countDocuments();
        const posts = await Post.find().populate('creator').skip((currentPage - 1) * perPage).limit(perPage);
        res.status(200).json({
            message: 'Fetched posts successfully',
            posts,
            totalItems: count
        });
    }
    catch(err) {
        if (!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    }
}

exports.createPost = async (req, res, next) => {
    const errors = validationResult(req);
    try {
        if (!errors.isEmpty()){
            const error = new Error('Validation failed, entered data is incorrect');
            error.statusCode = 422;
            throw error;
        }
        if (!req.file) {
            const error = new Error('No image provide');
            error.statusCode = 422;
            throw error;
        }
        const imageUrl = req.file.path;
        const title = req.body.title;
        const content = req.body.content;
        const post = new Post({
            title,
            content,
            imageUrl,
            creator: req.userId
        })
        const result = await post.save();
        const user = await User.findById(req.userId);
        user.posts.push(post);
        await user.save();
        io.getIo().emit('posts', {
            action: 'create',
            post: {
                ...post._doc, creator: {
                    _id: req.userId, 
                    name: user.name
                }
            }
        })
        res.status(201).json({
            message: 'Post created successfully',
            post,
            creator: {
                _id: user._id,
                name: user.name
            }
        })
    }
    catch(err) {
        if (!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    }
}

exports.getPost = async (req, res, next) => {
    const postId = req.params.postId;
    try {
        const post = await Post.findById(postId);
        if (!post){
            const error = new Error('Could not find post.');
            error.statusCode = 404;
            throw error;
        }
        res.status(200).json({
            message: "Post fetched.",
            post
        })
    }
    catch(err) {
        if (!err.statusCode){
            err.statusCode = 500;
        }
        next(err);
    }
}

exports.updatePost = async (req, res, next) => {
    const postId = req.params.postId;
    const errors = validationResult(req);
    try {
        if (!errors.isEmpty()){
            const error = new Error('Validation failed, entered data is incorrect');
            error.statusCode = 422;
            throw error;
        }
        const {title, content} = req.body;
        let imageUrl = req.body.image;
        if (req.file) {
            imageUrl = req.file.path;
        }
        if (!imageUrl) {
            const error = new Error('No file picked');
            error.statusCode = 422;
            throw error;
        }
        const post = await Post.findById(postId).populate('creator');
        if (!post) {
            const error = new Error('Could not find post.');
            error.statusCode = 404;
            throw error;
        }
        if (!post.creator._id.toString() === req.userId){
            const error = new Error('Not Authorized');
            error.statusCode = 403;
            throw error;
        }
        if (imageUrl !== post.imageUrl) {
            clearImage(post.imageUrl);
        }
        post.title = title;
        post.imageUrl = imageUrl;
        post.content = content;
        const result = await post.save();
        io.getIo().emit('posts', {
            action: 'update',
            post: result
        })
        res.status(200).json({
            message: 'Post updated!',
            post: result
        })
    }
    catch(err) {
        if (!err.statusCode){
            err.statusCode = 500;
        }
        next(err);
    }
}

exports.deletePost = async (req, res, next) => {
    const {postId} = req.params;
    try {
        const post = await Post.findById(postId);
        if (!post) {
            const error = new Error('Could not find post.');
            error.statusCode = 404;
            throw error;
        }
        if (!post.creator.toString() === req.userId){
            const error = new Error('Not Authorized');
            error.statusCode = 401;
            throw error;
        }
        clearImage(post.imageUrl);
        await Post.findByIdAndDelete(postId);
        const user = await User.findById(req.userId);
        user.posts.pull();
        await user.save();
        io.getIo().emit('posts', {
            action: 'delete',
            post: postId
        })
        res.status(200).json({
            message: 'Deleted Post'
        })
    }
    catch(err) {
        if (!err.statusCode){
            err.statusCode = 500;
        }
        next(err);
    };
}

exports.getStatus = async (req, res, next) => {
    try {
        const user = await User.findById(req.userId);
        if (!user){
            const error = new Error('Could not find user');
            error.statusCode = 404;
            throw error;
        }
        res.status(200).json({
            message: 'User status fetched',
            status: user.status
        })
    }
    catch(err) {
        if (!err.statusCode){
            err.statusCode = 500
        }
        next(err);
    }
}

exports.updateStatus = async (req, res, next) => {
    const status = req.body.status;
    try {
        if (!status){
            const error = new Error('No status to update with');
            error.statusCode = 422;
            throw error;
        }
        const user = User.findById(req.userId);
        if (!user){
            const error = new Error('User does not exist');
            error.statusCode = 404;
            throw error;
        }
        user.status = status;
        await user.save();
        res.status(200).json({
            message: 'Status updated successfully',
        })
    }
    catch(err) {
        if (!err.statusCode){
            err.statusCode = 500;
        }
        next(err);
    }
}
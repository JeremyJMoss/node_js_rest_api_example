const User = require('../models/user');
const Post = require('../models/post');
const bcrypt = require('bcrypt');
const validator = require('validator');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const {clearImage} = require('../util/clearImage');


module.exports = {
    // mutations
    createUser: async function ({userInput}, req) {
        const {email, password, name} = userInput;
        const errors = [];
        if (!validator.isEmail(email)){
            errors.push( { 
                message: 'E-Mail is invalid.'
            } );
        }
        if (validator.isEmpty(password) || !validator.isLength(password, { min: 5 })){
            errors.push({ 
                message: 'Password too short!'
            });
        }
        if (errors.length > 0) {
            const error = new Error('Invalid input.');
            error.data = errors;
            error.code = 422;
            throw error;
        }
        const existingUser = await User.findOne({email});
        if (existingUser){
            const error = new Error('User exists already');
            error.code = 403;
            throw error;
        }
        const hashedPassword = await bcrypt.hash(password, 12);
        const user = new User({
            email,
            name,
            password: hashedPassword
        });
        const createdUser = await user.save();
        return { 
            ...createdUser._doc, 
            _id: createdUser._id.toString()
        }
    },
    createPost: async function ({postInput}, req){
        const errors = [];
        if (!req.isAuth){
            const error = new Error('Not authenticated.');
            error.code = 401;
            throw error;
        }
        const {imageUrl, title, content} = postInput;
        if (validator.isEmpty(title) || !validator.isLength(title, {min: 5})){
            errors.push({
                message: 'Title is invalid'
            });
        }
        if (validator.isEmpty(content) || !validator.isLength(content, {min: 5})){
            errors.push({
                message: 'Content is invalid'
            });
        }
        if (errors.length > 0) {
            const error = new Error('Invalid input.');
            error.code = 422;
            error.data = errors;
            throw error;
        }
        const user = await User.findById(req.userId);
        if (!user) {
            const error = new Error('Invalid user.');
            error.code = 401;
            throw error;
        }
        const post = new Post({
            title,
            content,
            imageUrl,
            creator: user
        });
        const createdPost = await post.save();
        user.posts.push(createdPost);
        await user.save();
        return {
            ...createdPost._doc, 
            _id: createdPost._id.toString(), 
            createdAt: createdPost.createdAt.toISOString(),
            updatedAt: createdPost.updatedAt.toISOString()
        }
    },
    updatePost: async function({id, postInput}, req){
        const errors = [];
        if (!req.isAuth){
            const error = new Error('Not authenticated.');
            error.code = 401;
            throw error;
        }
        const {imageUrl, title, content} = postInput;
        if (validator.isEmpty(title) || !validator.isLength(title, {min: 5})){
            errors.push({
                message: 'Title is invalid'
            });
        }
        if (validator.isEmpty(content) || !validator.isLength(content, {min: 5})){
            errors.push({
                message: 'Content is invalid'
            });
        }
        if (errors.length > 0) {
            const error = new Error('Invalid input.');
            error.code = 422;
            error.data = errors;
            throw error;
        }
        const post = await Post.findById(id).populate('creator');
        if (!post){
            const error = new Error('No post found!');
            error.code = 404;
            throw error;
        }
        if (post.creator._id.toString() !== req.userId.toString()) {
            const error = new Error('Not authorized!');
            error.code = 403;
            throw error;
        }
        post.title = title;
        post.content = content;
        if (postInput.imageUrl !== 'undefined') {
            post.imageUrl = postInput.imageUrl;
        }
        const updatedPost = await post.save();
        return {
            ...updatedPost._doc,
            _id: updatedPost._id.toString(),
            createdAt: updatedPost.createdAt.toISOString(),
            updatedAt: updatedPost.updatedAt.toISOString()
        }
    },
    deletePost: async function({id}, req) {
        if (!req.isAuth) {
            const error = new Error('Not authenticated.');
            error.code = 401;
            throw error;
        }
        const post = await Post.findById(id);
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
        const deletedDoc = await Post.findByIdAndDelete(id);
    
        if (deletedDoc){
            const user = await User.findById(req.userId);
            user.posts.pull();
            await user.save();
            return true;
        } else {
            return false;
        }

        
    },
    updateStatus: async function({status}, req){
        if (!req.isAuth){
            const error = new Error('Not authenticated.');
            error.code = 401;
            throw error;
        }
        if (!status){
            const error = new Error('No status to update with');
            error.code = 422;
            throw error;
        }
        const user = await User.findById(req.userId);
        if (!user){
            const error = new Error('User does not exist');
            error.code = 404;
            throw error;
        }
        user.status = status;
        await user.save();
        return user.status;
    },
    // queries
    login: async function ({email, password}) {
        const user = await User.findOne({email});
        if (!user){
            const error = new Error('User not found.')
            error.code = 401;
            throw error;
        }
        const isEqual = await bcrypt.compare(password, user.password);
        if (!isEqual) {
            const error = new Error('Password is incorrect.');
            error.code = 401;
            throw error;
        }
        const token = jwt.sign({
            userId: user._id.toString(),
            email: user.email
        }, process.env.JWT_TOKEN, {
            expiresIn: '1h'
        });
        return {token, userId: user._id};
    },
    posts: async function({page}, req){
        if (!req.isAuth){
            const error = new Error('Not authenticated.');
            error.code = 401;
            throw error;
        }
        if ( !page ){
            page = 1;
        }
        const perPage = 2;
        const totalPosts = await Post.find().countDocuments();
        const posts = await Post.find()
        .sort({createdAt: -1})
        .skip((page - 1) * perPage)
        .limit(perPage)
        .populate('creator');
        return {
            posts: posts.map(post => {
                return {
                    ...post._doc,
                    _id: post._id.toString(),
                    createdAt: post.createdAt.toISOString(),
                    updatedAt: post.updatedAt.toISOString()
                };
            }),
            totalPosts
        };
    },
    post: async function({id}, req){
        if (!req.isAuth){
            const error = new Error('Not authenticated.');
            error.code = 401;
            throw error;
        }
        const post = await Post.findById(id).populate('creator');
        if (!post) {
            const error = new Error('No post found!');
            error.code = 404;
            throw error;
        }
        return {
            ...post._doc,
            _id: post._id.toString(),
            createdAt: post.createdAt.toISOString(),
            updatedAt: post.updatedAt.toISOString()
        };
    },
    user: async function(args, req){
        if (!req.isAuth){
            const error = new Error('Not Authenticated');
            error.code = 401;
            throw error
        }
        const user = await User.findById(req.userId);
        if (!user){
            const error = new Error('Could not find user');
            error.code = 404;
            throw error;
        }
        return {
            ...user._doc,
            _id: user._id.toString()
        }

    }
}
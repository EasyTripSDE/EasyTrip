'use strict';

var mongoose = require('mongoose');
const dotenv = require("dotenv").config();

const DB_CONNECTION_STRING = process.env.DB_URL;

module.exports.initDB = () => {

    return new Promise((resolve, reject) => {
        mongoose.connect(DB_CONNECTION_STRING, /*{
            authSource: "admin",
            user: DB_USER,
            pass: DB_PASS,
            useNewUrlParser: true
        },*/ (err) => {
            if (err) {
                console.log(err);
                reject("DB can't connect");
            }
            resolve("DB connected");
        });
    }) 
} 
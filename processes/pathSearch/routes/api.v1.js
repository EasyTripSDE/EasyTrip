'use strict';

const express = require('express');
const apiV1 = express.Router();

const pathRouter = require('./apiV1/path');

// middleware that tracks request
apiV1.use(function timeLog(req, res, next) {
  console.log(`Requested ${req.originalUrl} From ${req.headers['x-forwarded-for']} Time: ${Date.now()}`);
	next();
});

apiV1.use('/path', pathRouter);

module.exports = apiV1;
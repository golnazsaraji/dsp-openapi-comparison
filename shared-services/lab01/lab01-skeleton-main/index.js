'use strict';

var path = require('path');
var http = require('http');
var cors = require('cors');
var fs = require('fs');
var oas3Tools = require('oas3-tools');
var { Validator, ValidationError } = require('express-json-validator-middleware');
var serverPort = 3001;
var passport = require('passport');
require('./passport-config');
var session = require('express-session');

// Swagger configuration

var expressAppConfig = oas3Tools.expressAppConfig(path.join(__dirname, 'api/openapi.yaml'));
var app = expressAppConfig.getApp();

// Creating the session

app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true,
}));
app.use(session({
    secret: "shhhhh... it's a secret!",
    resave: false,
    saveUninitialized: false,
}));
app.use(passport.authenticate('session'));

// Defining authentication verification middleware 

const isLoggedIn = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    return res.status(401).json({ error: 'Not authorized' });
}

/*** JSON Validator Setup ***/
// TODO: Set up your JSON validator here
// You can use 'express-json-validator-middleware' (https://www.npmjs.com/package/express-json-validator-middleware),
// which is based on the 'ajv' module (https://www.npmjs.com/package/ajv).


/*** Route Definitions ***/
// TODO: Define your API routes here
// Hint: Use app.get(), app.post(), app.put(), app.delete() to create your endpoints
// Hint: Protect routes that require authentication with your middleware (e.g., isLoggedIn)
// Hint: You can apply your validator to routes that expect JSON input
// Example:
// app.post('/api/films', isLoggedIn, validate({ body: filmSchema }), yourController.createFilm);


// Initialize the Swagger middleware

http.createServer(app).listen(serverPort, function () {
    console.log('Your server is listening on port %d (http://localhost:%d)', serverPort, serverPort);
    console.log('Swagger-ui is available on http://localhost:%d/docs', serverPort);
});
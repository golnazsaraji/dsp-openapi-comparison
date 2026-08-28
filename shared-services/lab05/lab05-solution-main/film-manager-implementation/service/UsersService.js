'use strict';
const serviceUtils = require('../utils/serviceUtils.js');
const db = require('../components/db');
const utils = require('../utils/writer.js');
var passport = require('passport');
const User = require('../components/user.js');

var WebSocket = require('../components/websocket');
const WSMessage = require('../components/ws_message');

/**
 * Logs a user in
 * The user who wants to log in sends the user data to the authenticator which performs the operation. If the request for the login of a new user comes from an already authenticated user, the previous user is first logged out.
 *
 * body User The data of the user who wants to perform log in. The data structure must contain email and password.
 * no response value expected for this operation
 **/
exports.authenticateUser = function(req, res, next) {
  return new Promise((resolve, reject) => {
      passport.authenticate('local', (err, user, info) => {
        if (err) return reject(err);
        if (!user) return reject('NO_USER');
        req.login(user, (err) => {
          if (err) return reject(err);
          // Notify all the clients that a user has logged in
          console.log("User asking for log in: " + user.name);
          serviceUtils.getActiveFilmUser(user.id)
            .then((film) => {
              console.log("WebSocket login notification");
              var loginMessage;
              if(film == undefined) loginMessage = new WSMessage('login', user.id, user.name, undefined, undefined);
              else loginMessage = new WSMessage('login', user.id, user.name, film.id, film.title);
              WebSocket.sendAllClients(loginMessage);
              WebSocket.saveMessage(user.id, loginMessage);
            }).catch((err) => {
              console.log("Error retrieving active film for user " + user.name + ": " + err);
            });
          return resolve(new User( user.id, user.name, req.body.email));
        });
      })(req, res, next);
    });
}

/**
 * Logs the current user out
 * Invalidates the current user session. Removes the authentication cookie if present.
 *
 * no response value expected for this operation
 **/
exports.logoutUser = function(res, req) {
  return new Promise(function(resolve, reject) {
      const email = req.user.email;
      serviceUtils.getUserByEmail(email)
        .then((user) => {
          if (user === undefined) {
            reject("NO_USER");
          } else {
            req.logout(() => {
              // Notify all the clients that a user has logged out
              console.log("WebSocket logout notification");
              var logoutMessage = new WSMessage('logout', user.id, user.name);
              WebSocket.sendAllClients(logoutMessage);
              WebSocket.deleteMessage(user.id);
              resolve()
            });
          }
        })
  });
}


/**
 * Get information about the users
 * The available information (passwords excluded) about all the users is retrieved. This operation is available only to authenticated users.
 *
 * returns Users
 **/
exports.getUsers = function () {
  return new Promise((resolve, reject) => {
    const sql = "SELECT id, name, email FROM users";
    db.all(sql, [], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        if (rows.length === 0)
          resolve(undefined);
        else {
          let users = rows.map((row) => serviceUtils.createUser(row));
          resolve(users);
        }
      }
    });
  });
}



/**
 * Get information about a user
 * The available information (password excluded) about the user specified by userId is retrieved. This operation requires authentication.
 *
 * userId Long ID of the user to get
 * returns User
 **/
exports.getUserById = function (id) {
  return new Promise((resolve, reject) => {
    const sql = "SELECT id, name, email FROM users WHERE id = ?"
    db.all(sql, [id], (err, rows) => {
      if (err)
        reject(err);
      else if (rows.length === 0)
        resolve(undefined);
      else {
        const user = serviceUtils.createUser(rows[0]);
        resolve(user);
      }
    });
  });
};


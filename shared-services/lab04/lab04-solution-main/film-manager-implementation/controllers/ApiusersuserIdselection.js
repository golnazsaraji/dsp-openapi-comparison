'use strict';

var utils = require('../utils/writer.js');
const reviewService = require('../service/ReviewsService.js');

module.exports.selectActiveFilm = function selectActiveFilm (req, res, next) {
  var userId = req.params.userId;
  var filmId = req.body.id;
  console.log("selectActiveFilm called with request body: " + JSON.stringify(req.body));
  console.log("User " + userId + " selecting active film " + filmId);
  if(filmId === undefined){
    utils.writeJson(res, {errors: [{ 'param': 'filmId', 'msg': "filmId is required." }],}, 400);
    return;
  }
  reviewService.selectActiveFilm(userId, filmId)
    .then(function (response) {
      utils.writeJson(res, response, 204);
    })
    .catch(function(response) {
      if(response == 403){
        utils.writeJson(res, { errors: [{ 'param': 'Server', 'msg': 'The user is not a reviewer of the film' }], }, 403);
      }
      else if (response == 409){
        utils.writeJson(res, { errors: [{ 'param': 'Server', 'msg': 'The film does not exist.' }], }, 409);
      } 
      else {
        utils.writeJson(res, {errors: [{ 'param': 'Server', 'msg': response }],}, 500);
      }
    });
};


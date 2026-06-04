/**
 * The ReviewsController file is a very simple one, which does not need to be changed manually,
 * unless there's a case where business logic routes the request to an entity which is not
 * the service.
 * The heavy lifting of the Controller item is done in Request.js - that is where request
 * parameters are extracted and sent to the service, and where response is handled.
 */

const Controller = require('./Controller');
const service = require('../services/ReviewsService');
const filmsFilmIdReviewsCurrentPUT = async (request, response) => {
  await Controller.handleRequest(request, response, service.filmsFilmIdReviewsCurrentPUT);
};

const filmsFilmIdReviewsPOST = async (request, response) => {
  await Controller.handleRequest(request, response, service.filmsFilmIdReviewsPOST);
};

const filmsFilmIdReviewsReviewerIdDELETE = async (request, response) => {
  await Controller.handleRequest(request, response, service.filmsFilmIdReviewsReviewerIdDELETE);
};

const filmsPublicFilmIdReviewsGET = async (request, response) => {
  await Controller.handleRequest(request, response, service.filmsPublicFilmIdReviewsGET);
};

const filmsPublicFilmIdReviewsReviewerIdGET = async (request, response) => {
  await Controller.handleRequest(request, response, service.filmsPublicFilmIdReviewsReviewerIdGET);
};

const filmsToReviewGET = async (request, response) => {
  await Controller.handleRequest(request, response, service.filmsToReviewGET);
};


module.exports = {
  filmsFilmIdReviewsCurrentPUT,
  filmsFilmIdReviewsPOST,
  filmsFilmIdReviewsReviewerIdDELETE,
  filmsPublicFilmIdReviewsGET,
  filmsPublicFilmIdReviewsReviewerIdGET,
  filmsToReviewGET,
};

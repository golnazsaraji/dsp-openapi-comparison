/**
 * The FilmsController file is a very simple one, which does not need to be changed manually,
 * unless there's a case where business logic routes the request to an entity which is not
 * the service.
 * The heavy lifting of the Controller item is done in Request.js - that is where request
 * parameters are extracted and sent to the service, and where response is handled.
 */

const Controller = require('./Controller');
const service = require('../services/FilmsService');
const filmsFilmIdActivePUT = async (request, response) => {
  await Controller.handleRequest(request, response, service.filmsFilmIdActivePUT);
};

const filmsFilmIdDELETE = async (request, response) => {
  await Controller.handleRequest(request, response, service.filmsFilmIdDELETE);
};

const filmsFilmIdGET = async (request, response) => {
  await Controller.handleRequest(request, response, service.filmsFilmIdGET);
};

const filmsFilmIdPUT = async (request, response) => {
  await Controller.handleRequest(request, response, service.filmsFilmIdPUT);
};

const filmsGET = async (request, response) => {
  await Controller.handleRequest(request, response, service.filmsGET);
};

const filmsPOST = async (request, response) => {
  await Controller.handleRequest(request, response, service.filmsPOST);
};

const filmsToReviewGET = async (request, response) => {
  await Controller.handleRequest(request, response, service.filmsToReviewGET);
};

const usersCurrentActiveFilmDELETE = async (request, response) => {
  await Controller.handleRequest(request, response, service.usersCurrentActiveFilmDELETE);
};


module.exports = {
  filmsFilmIdActivePUT,
  filmsFilmIdDELETE,
  filmsFilmIdGET,
  filmsFilmIdPUT,
  filmsGET,
  filmsPOST,
  filmsToReviewGET,
  usersCurrentActiveFilmDELETE,
};

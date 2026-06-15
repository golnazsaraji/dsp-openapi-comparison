/**
 * The DefaultController file is a very simple one, which does not need to be changed manually,
 * unless there's a case where business logic routes the request to an entity which is not
 * the service.
 * The heavy lifting of the Controller item is done in Request.js - that is where request
 * parameters are extracted and sent to the service, and where response is handled.
 */

const Controller = require('./Controller');
const service = require('../services/DefaultService');
const filmsGET = async (request, response) => {
  await Controller.handleRequest(request, response, service.filmsGET);
};

const filmsIdDELETE = async (request, response) => {
  await Controller.handleRequest(request, response, service.filmsIdDELETE);
};

const filmsIdGET = async (request, response) => {
  await Controller.handleRequest(request, response, service.filmsIdGET);
};

const filmsPOST = async (request, response) => {
  await Controller.handleRequest(request, response, service.filmsPOST);
};

const statusGET = async (request, response) => {
  await Controller.handleRequest(request, response, service.statusGET);
};


module.exports = {
  filmsGET,
  filmsIdDELETE,
  filmsIdGET,
  filmsPOST,
  statusGET,
};

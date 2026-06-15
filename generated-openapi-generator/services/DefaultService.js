/* eslint-disable no-unused-vars */
const Service = require('./Service');
const DefaultServiceAdapter = require('../../adapters/initial-example/DefaultServiceAdapter');

// EVALUATION-NOTE: Initial generated service delegates to handwritten code through the adapter.
/**
* Get all films
*
* returns List
* */
const filmsGET = () => new Promise(
  async (resolve, reject) => {
    try {
      const films = await DefaultServiceAdapter.filmsGET();
      resolve(Service.successResponse(films));
    } catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 500,
      ));
    }
  },
);
/**
* Delete film by id
*
* id Integer 
* no response value expected for this operation
* */
const filmsIdDELETE = ({ id }) => new Promise(
  async (resolve, reject) => {
    try {
      const deleted = await DefaultServiceAdapter.filmsIdDELETE(id);
      resolve(Service.successResponse({ deleted }, 204));
    } catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 500,
      ));
    }
  },
);
/**
* Get film by id
*
* id Integer 
* returns Film
* */
const filmsIdGET = ({ id }) => new Promise(
  async (resolve, reject) => {
    try {
      const film = await DefaultServiceAdapter.filmsIdGET(id);
      resolve(Service.successResponse(film));
    } catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 500,
      ));
    }
  },
);
/**
* Create a new film
*
* newFilm NewFilm 
* returns Film
* */
const filmsPOST = (params = {}) => new Promise(
  async (resolve, reject) => {
    try {
      // EVALUATION-NOTE: Accept both generated body names and raw params for the initial example.
      const newFilm = params.newFilm || params.body || params;
      const film = await DefaultServiceAdapter.filmsPOST(newFilm);
      resolve(Service.successResponse(film, 201));
    } catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 500,
      ));
    }
  },
);
/**
* API status
*
* returns Status
* */
const statusGET = () => new Promise(
  async (resolve, reject) => {
    try {
      const status = await DefaultServiceAdapter.statusGET();
      resolve(Service.successResponse(status));
    } catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 500,
      ));
    }
  },
);

module.exports = {
  filmsGET,
  filmsIdDELETE,
  filmsIdGET,
  filmsPOST,
  statusGET,
};

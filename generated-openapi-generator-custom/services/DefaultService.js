/* eslint-disable no-unused-vars */
const Service = require('./Service');
const DefaultServiceAdapter = require('../../adapters/openapi-generator/DefaultServiceAdapter');

/**
* Get all films
*
* returns List
* */
const filmsGET = (params = {}) => new Promise(
  async (resolve, reject) => {
    try {

       const result = await DefaultServiceAdapter.filmsGET(
      );

      resolve(Service.successResponse(result));
} catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 405,
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
const filmsIdDELETE = (params = {}) => new Promise(
  async (resolve, reject) => {
    try {

       const result = await DefaultServiceAdapter.filmsIdDELETE(
          params.id,
      );

      resolve(Service.successResponse(result));
} catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 405,
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
const filmsIdGET = (params = {}) => new Promise(
  async (resolve, reject) => {
    try {

       const result = await DefaultServiceAdapter.filmsIdGET(
          params.id,
      );

      resolve(Service.successResponse(result));
} catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 405,
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

       const result = await DefaultServiceAdapter.filmsPOST(
          params.newFilm || params.body || params,
      );

      resolve(Service.successResponse(result));
} catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 405,
      ));
    }
  },
);
/**
* API status
*
* returns Status
* */
const statusGET = (params = {}) => new Promise(
  async (resolve, reject) => {
    try {

       const result = await DefaultServiceAdapter.statusGET(
      );

      resolve(Service.successResponse(result));
} catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 405,
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

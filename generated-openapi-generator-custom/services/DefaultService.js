/* eslint-disable no-unused-vars */
const Service = require('./Service');
const DefaultServiceAdapter = require('../../adapters/openapi-generator/DefaultServiceAdapter');

/**
* Get all films
*
* returns List
* */
const filmsGET = () => new Promise(
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
const filmsIdDELETE = ({ id }) => new Promise(
  async (resolve, reject) => {
    try {
      const result = await DefaultServiceAdapter.filmsIdDELETE(
          id,
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
const filmsIdGET = ({ id }) => new Promise(
  async (resolve, reject) => {
    try {
      const result = await DefaultServiceAdapter.filmsIdGET(
          id,
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
const filmsPOST = ({ newFilm }) => new Promise(
  async (resolve, reject) => {
    try {
      const result = await DefaultServiceAdapter.filmsPOST(
          newFilm,
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
const statusGET = () => new Promise(
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

/* eslint-disable no-unused-vars */
const Service = require('./Service');
const DefaultServiceAdapter = require('../../adapters/openapi-generator/DefaultServiceAdapter');

/**
* Select a public review film as active
*
* filmId Integer 
* returns Review
* */
const filmsFilmIdActivePUT = (params = {}) => new Promise(
  async (resolve, reject) => {
    try {
      const result = await DefaultServiceAdapter.filmsFilmIdActivePUT(
          params.filmId,
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
* Delete an owned film
*
* filmId Integer 
* no response value expected for this operation
* */
const filmsFilmIdDELETE = (params = {}) => new Promise(
  async (resolve, reject) => {
    try {
      const result = await DefaultServiceAdapter.filmsFilmIdDELETE(
          params.filmId,
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
* Get an accessible film
*
* filmId Integer 
* returns Film
* */
const filmsFilmIdGET = (params = {}) => new Promise(
  async (resolve, reject) => {
    try {
      const result = await DefaultServiceAdapter.filmsFilmIdGET(
          params.filmId,
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
* Update an owned film without changing visibility
*
* filmId Integer 
* filmInput FilmInput 
* returns Film
* */
const filmsFilmIdPUT = (params = {}) => new Promise(
  async (resolve, reject) => {
    try {
      const result = await DefaultServiceAdapter.filmsFilmIdPUT(
          params.filmId,
          params.filmInput || params.body || params,
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
* List films owned by the current user
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
* Create a film
*
* filmInput FilmInput 
* returns Film
* */
const filmsPOST = (params = {}) => new Promise(
  async (resolve, reject) => {
    try {
      const result = await DefaultServiceAdapter.filmsPOST(
          params.filmInput || params.body || params,
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
* List films assigned to the current reviewer
*
* returns List
* */
const filmsToReviewGET = (params = {}) => new Promise(
  async (resolve, reject) => {
    try {
      const result = await DefaultServiceAdapter.filmsToReviewGET(
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
* Clear the current user's active film
*
* no response value expected for this operation
* */
const usersCurrentActiveFilmDELETE = (params = {}) => new Promise(
  async (resolve, reject) => {
    try {
      const result = await DefaultServiceAdapter.usersCurrentActiveFilmDELETE(
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
  filmsFilmIdActivePUT,
  filmsFilmIdDELETE,
  filmsFilmIdGET,
  filmsFilmIdPUT,
  filmsGET,
  filmsPOST,
  filmsToReviewGET,
  usersCurrentActiveFilmDELETE,
};

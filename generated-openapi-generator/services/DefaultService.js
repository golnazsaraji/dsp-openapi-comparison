/* eslint-disable no-unused-vars */
const Service = require('./Service');
const DefaultServiceAdapter = require('../../adapters/openapi-generator/DefaultServiceAdapter');

// EVALUATION-NOTE: Template makes regenerated final services delegate to handwritten logic.
const successStatusByOperation = {
  sessionsPOST: 201,
  sessionsCurrentDELETE: 204,
  filmsPOST: 201,
  reviewsAutoInvitationsPOST: 201,
  filmsFilmIdDELETE: 204,
  filmsFilmIdReviewsPOST: 201,
  filmsFilmIdReviewsReviewerIdDELETE: 204,
  usersCurrentActiveFilmDELETE: 204,
  filmsFilmIdImagesPOST: 201,
  filmsFilmIdImagesImageIdDELETE: 204,
};

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

      resolve(Service.successResponse(result, successStatusByOperation.filmsGET || 200));
} catch (e) {
      // EVALUATION-NOTE: Preserve explicit business status codes; unknown failures are 500.
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
const filmsIdDELETE = (params = {}) => new Promise(
  async (resolve, reject) => {
    try {
      const result = await DefaultServiceAdapter.filmsIdDELETE(
          params.id,
      );

      resolve(Service.successResponse(result, successStatusByOperation.filmsIdDELETE || 200));
} catch (e) {
      // EVALUATION-NOTE: Preserve explicit business status codes; unknown failures are 500.
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
const filmsIdGET = (params = {}) => new Promise(
  async (resolve, reject) => {
    try {
      const result = await DefaultServiceAdapter.filmsIdGET(
          params.id,
      );

      resolve(Service.successResponse(result, successStatusByOperation.filmsIdGET || 200));
} catch (e) {
      // EVALUATION-NOTE: Preserve explicit business status codes; unknown failures are 500.
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
      const result = await DefaultServiceAdapter.filmsPOST(
          params.newFilm || params.body || params,
      );

      resolve(Service.successResponse(result, successStatusByOperation.filmsPOST || 200));
} catch (e) {
      // EVALUATION-NOTE: Preserve explicit business status codes; unknown failures are 500.
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
const statusGET = (params = {}) => new Promise(
  async (resolve, reject) => {
    try {
      const result = await DefaultServiceAdapter.statusGET(
      );

      resolve(Service.successResponse(result, successStatusByOperation.statusGET || 200));
} catch (e) {
      // EVALUATION-NOTE: Preserve explicit business status codes; unknown failures are 500.
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

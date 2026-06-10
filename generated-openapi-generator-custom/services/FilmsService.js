/* eslint-disable no-unused-vars */
const Service = require('./Service');
const DefaultServiceAdapter = require('../../adapters/openapi-generator/DefaultServiceAdapter');

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

      resolve(Service.successResponse(result, successStatusByOperation.filmsFilmIdActivePUT || 200));
} catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 500,
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

      resolve(Service.successResponse(result, successStatusByOperation.filmsFilmIdDELETE || 200));
} catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 500,
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

      resolve(Service.successResponse(result, successStatusByOperation.filmsFilmIdGET || 200));
} catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 500,
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

      resolve(Service.successResponse(result, successStatusByOperation.filmsFilmIdPUT || 200));
} catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 500,
      ));
    }
  },
);
/**
* List films owned by the current user
*
* page Integer One-based page number. (optional)
* limit Integer Maximum number of resources returned in one page. (optional)
* returns FilmPage
* */
const filmsGET = (params = {}) => new Promise(
  async (resolve, reject) => {
    try {
      const result = await DefaultServiceAdapter.filmsGET(
          params.page,
          params.limit,
      );

      resolve(Service.successResponse(result, successStatusByOperation.filmsGET || 200));
} catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 500,
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

      resolve(Service.successResponse(result, successStatusByOperation.filmsPOST || 200));
} catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 500,
      ));
    }
  },
);
/**
* List films assigned to the current reviewer
*
* page Integer One-based page number. (optional)
* limit Integer Maximum number of resources returned in one page. (optional)
* returns FilmPage
* */
const filmsToReviewGET = (params = {}) => new Promise(
  async (resolve, reject) => {
    try {
      const result = await DefaultServiceAdapter.filmsToReviewGET(
          params.page,
          params.limit,
      );

      resolve(Service.successResponse(result, successStatusByOperation.filmsToReviewGET || 200));
} catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 500,
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

      resolve(Service.successResponse(result, successStatusByOperation.usersCurrentActiveFilmDELETE || 200));
} catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 500,
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

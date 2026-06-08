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

      resolve(Service.successResponse(result, successStatusByOperation.usersCurrentActiveFilmDELETE || 200));
} catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 405,
      ));
    }
  },
);
/**
* Get current WebSocket online snapshot
*
* returns List
* */
const usersOnlineGET = (params = {}) => new Promise(
  async (resolve, reject) => {
    try {
      const result = await DefaultServiceAdapter.usersOnlineGET(
      );

      resolve(Service.successResponse(result, successStatusByOperation.usersOnlineGET || 200));
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
  usersCurrentActiveFilmDELETE,
  usersOnlineGET,
};

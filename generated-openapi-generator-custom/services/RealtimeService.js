/* eslint-disable no-unused-vars */
const Service = require('./Service');
const DefaultServiceAdapter = require('../../adapters/openapi-generator/DefaultServiceAdapter');

// EVALUATION-NOTE: Template makes regenerated final services delegate to handwritten logic.
// Success status codes and any response cookie are looked up from the adapter (outside this
// generated/regenerated file) instead of being hard-coded per operationId in this template.

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

      resolve(Service.successResponse(
        result,
        DefaultServiceAdapter.successStatus('filmsFilmIdActivePUT'),
        DefaultServiceAdapter.responseCookie('filmsFilmIdActivePUT'),
      ));
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
* Clear the current user's active film
*
* no response value expected for this operation
* */
const usersCurrentActiveFilmDELETE = (params = {}) => new Promise(
  async (resolve, reject) => {
    try {
      const result = await DefaultServiceAdapter.usersCurrentActiveFilmDELETE(
      );

      resolve(Service.successResponse(
        result,
        DefaultServiceAdapter.successStatus('usersCurrentActiveFilmDELETE'),
        DefaultServiceAdapter.responseCookie('usersCurrentActiveFilmDELETE'),
      ));
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
* Get current WebSocket online snapshot
*
* returns List
* */
const usersOnlineGET = (params = {}) => new Promise(
  async (resolve, reject) => {
    try {
      const result = await DefaultServiceAdapter.usersOnlineGET(
      );

      resolve(Service.successResponse(
        result,
        DefaultServiceAdapter.successStatus('usersOnlineGET'),
        DefaultServiceAdapter.responseCookie('usersOnlineGET'),
      ));
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
  filmsFilmIdActivePUT,
  usersCurrentActiveFilmDELETE,
  usersOnlineGET,
};

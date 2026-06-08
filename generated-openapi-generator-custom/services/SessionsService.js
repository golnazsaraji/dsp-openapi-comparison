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
* Logout
*
* no response value expected for this operation
* */
const sessionsCurrentDELETE = (params = {}) => new Promise(
  async (resolve, reject) => {
    try {
      const result = await DefaultServiceAdapter.sessionsCurrentDELETE(
      );

      resolve(Service.successResponse(result, successStatusByOperation.sessionsCurrentDELETE || 200));
} catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 405,
      ));
    }
  },
);
/**
* Get current authenticated user
*
* returns User
* */
const sessionsCurrentGET = (params = {}) => new Promise(
  async (resolve, reject) => {
    try {
      const result = await DefaultServiceAdapter.sessionsCurrentGET(
      );

      resolve(Service.successResponse(result, successStatusByOperation.sessionsCurrentGET || 200));
} catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 405,
      ));
    }
  },
);
/**
* Login with email and password
*
* loginRequest LoginRequest 
* returns User
* */
const sessionsPOST = (params = {}) => new Promise(
  async (resolve, reject) => {
    try {
      const result = await DefaultServiceAdapter.sessionsPOST(
          params.loginRequest || params.body || params,
      );

      resolve(Service.successResponse(result, successStatusByOperation.sessionsPOST || 200));
} catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 405,
      ));
    }
  },
);

module.exports = {
  sessionsCurrentDELETE,
  sessionsCurrentGET,
  sessionsPOST,
};

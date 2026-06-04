/* eslint-disable no-unused-vars */
const Service = require('./Service');
const DefaultServiceAdapter = require('../../adapters/openapi-generator/DefaultServiceAdapter');

/**
* Complete the current user's review
*
* filmId Integer 
* reviewCompletion ReviewCompletion 
* returns Review
* */
const filmsFilmIdReviewsCurrentPUT = (params = {}) => new Promise(
  async (resolve, reject) => {
    try {
      const result = await DefaultServiceAdapter.filmsFilmIdReviewsCurrentPUT(
          params.filmId,
          params.reviewCompletion || params.body || params,
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
* Invite a reviewer to a public owned film
*
* filmId Integer 
* reviewInvitation ReviewInvitation 
* returns Review
* */
const filmsFilmIdReviewsPOST = (params = {}) => new Promise(
  async (resolve, reject) => {
    try {
      const result = await DefaultServiceAdapter.filmsFilmIdReviewsPOST(
          params.filmId,
          params.reviewInvitation || params.body || params,
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
* Remove an incomplete review invitation
*
* filmId Integer 
* reviewerId Integer 
* no response value expected for this operation
* */
const filmsFilmIdReviewsReviewerIdDELETE = (params = {}) => new Promise(
  async (resolve, reject) => {
    try {
      const result = await DefaultServiceAdapter.filmsFilmIdReviewsReviewerIdDELETE(
          params.filmId,
          params.reviewerId,
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
* List reviews for a public film
*
* filmId Integer 
* returns List
* */
const filmsPublicFilmIdReviewsGET = (params = {}) => new Promise(
  async (resolve, reject) => {
    try {
      const result = await DefaultServiceAdapter.filmsPublicFilmIdReviewsGET(
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
* Get one public review
*
* filmId Integer 
* reviewerId Integer 
* returns Review
* */
const filmsPublicFilmIdReviewsReviewerIdGET = (params = {}) => new Promise(
  async (resolve, reject) => {
    try {
      const result = await DefaultServiceAdapter.filmsPublicFilmIdReviewsReviewerIdGET(
          params.filmId,
          params.reviewerId,
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

module.exports = {
  filmsFilmIdReviewsCurrentPUT,
  filmsFilmIdReviewsPOST,
  filmsFilmIdReviewsReviewerIdDELETE,
  filmsPublicFilmIdReviewsGET,
  filmsPublicFilmIdReviewsReviewerIdGET,
  filmsToReviewGET,
};

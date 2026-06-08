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

      resolve(Service.successResponse(result, successStatusByOperation.filmsFilmIdReviewsCurrentPUT || 200));
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

      resolve(Service.successResponse(result, successStatusByOperation.filmsFilmIdReviewsPOST || 200));
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

      resolve(Service.successResponse(result, successStatusByOperation.filmsFilmIdReviewsReviewerIdDELETE || 200));
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
* page Integer One-based page number. (optional)
* limit Integer Maximum number of resources returned in one page. (optional)
* returns ReviewPage
* */
const filmsPublicFilmIdReviewsGET = (params = {}) => new Promise(
  async (resolve, reject) => {
    try {
      const result = await DefaultServiceAdapter.filmsPublicFilmIdReviewsGET(
          params.filmId,
          params.page,
          params.limit,
      );

      resolve(Service.successResponse(result, successStatusByOperation.filmsPublicFilmIdReviewsGET || 200));
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

      resolve(Service.successResponse(result, successStatusByOperation.filmsPublicFilmIdReviewsReviewerIdGET || 200));
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
        e.status || 405,
      ));
    }
  },
);
/**
* Automatically issue review invitations for public films without invitations
*
* returns ReviewInvitationBatch
* */
const reviewsAutoInvitationsPOST = (params = {}) => new Promise(
  async (resolve, reject) => {
    try {
      const result = await DefaultServiceAdapter.reviewsAutoInvitationsPOST(
      );

      resolve(Service.successResponse(result, successStatusByOperation.reviewsAutoInvitationsPOST || 200));
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
  reviewsAutoInvitationsPOST,
};

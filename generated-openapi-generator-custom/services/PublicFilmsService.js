/* eslint-disable no-unused-vars */
const Service = require('./Service');
const DefaultServiceAdapter = require('../../adapters/openapi-generator/DefaultServiceAdapter');

/**
* Get a public film
*
* filmId Integer 
* returns Film
* */
const filmsPublicFilmIdGET = (params = {}) => new Promise(
  async (resolve, reject) => {
    try {
      const result = await DefaultServiceAdapter.filmsPublicFilmIdGET(
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
* List public films
*
* page Integer One-based page number. (optional)
* limit Integer Maximum number of resources returned in one page. (optional)
* returns FilmPage
* */
const filmsPublicGET = (params = {}) => new Promise(
  async (resolve, reject) => {
    try {
      const result = await DefaultServiceAdapter.filmsPublicGET(
          params.page,
          params.limit,
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
  filmsPublicFilmIdGET,
  filmsPublicFilmIdReviewsGET,
  filmsPublicFilmIdReviewsReviewerIdGET,
  filmsPublicGET,
};

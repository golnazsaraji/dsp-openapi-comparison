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
* List images for a public owned/review film
*
* filmId Integer 
* returns List
* */
const filmsFilmIdImagesGET = (params = {}) => new Promise(
  async (resolve, reject) => {
    try {
      const result = await DefaultServiceAdapter.filmsFilmIdImagesGET(
          params.filmId,
      );

      resolve(Service.successResponse(result, successStatusByOperation.filmsFilmIdImagesGET || 200));
} catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 405,
      ));
    }
  },
);
/**
* Delete an image from a public owned film
*
* filmId Integer 
* imageId Integer 
* no response value expected for this operation
* */
const filmsFilmIdImagesImageIdDELETE = (params = {}) => new Promise(
  async (resolve, reject) => {
    try {
      const result = await DefaultServiceAdapter.filmsFilmIdImagesImageIdDELETE(
          params.filmId,
          params.imageId,
      );

      resolve(Service.successResponse(result, successStatusByOperation.filmsFilmIdImagesImageIdDELETE || 200));
} catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 405,
      ));
    }
  },
);
/**
* Get image metadata or bytes using content negotiation
*
* filmId Integer 
* imageId Integer 
* accept String Requested representation for a single image. (optional)
* returns Image
* */
const filmsFilmIdImagesImageIdGET = (params = {}) => new Promise(
  async (resolve, reject) => {
    try {
      const result = await DefaultServiceAdapter.filmsFilmIdImagesImageIdGET(
          params.filmId,
          params.imageId,
          params.accept,
      );

      resolve(Service.successResponse(result, successStatusByOperation.filmsFilmIdImagesImageIdGET || 200));
} catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 405,
      ));
    }
  },
);
/**
* Upload an image for a public owned film
*
* filmId Integer 
* image File 
* returns Image
* */
const filmsFilmIdImagesPOST = (params = {}) => new Promise(
  async (resolve, reject) => {
    try {
      const result = await DefaultServiceAdapter.filmsFilmIdImagesPOST(
          params.filmId,
          params.image,
      );

      resolve(Service.successResponse(result, successStatusByOperation.filmsFilmIdImagesPOST || 200));
} catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 405,
      ));
    }
  },
);

module.exports = {
  filmsFilmIdImagesGET,
  filmsFilmIdImagesImageIdDELETE,
  filmsFilmIdImagesImageIdGET,
  filmsFilmIdImagesPOST,
};

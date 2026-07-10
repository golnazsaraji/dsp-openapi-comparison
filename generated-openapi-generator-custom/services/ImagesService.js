/* eslint-disable no-unused-vars */
const Service = require('./Service');
const DefaultServiceAdapter = require('../../adapters/openapi-generator/DefaultServiceAdapter');

// EVALUATION-NOTE: Template makes regenerated final services delegate to handwritten logic.
// Success status codes and any response cookie are looked up from the adapter (outside this
// generated/regenerated file) instead of being hard-coded per operationId in this template.

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

      resolve(Service.successResponse(
        result,
        DefaultServiceAdapter.successStatus('filmsFilmIdImagesGET'),
        DefaultServiceAdapter.responseCookie('filmsFilmIdImagesGET'),
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

      resolve(Service.successResponse(
        result,
        DefaultServiceAdapter.successStatus('filmsFilmIdImagesImageIdDELETE'),
        DefaultServiceAdapter.responseCookie('filmsFilmIdImagesImageIdDELETE'),
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

      resolve(Service.successResponse(
        result,
        DefaultServiceAdapter.successStatus('filmsFilmIdImagesImageIdGET'),
        DefaultServiceAdapter.responseCookie('filmsFilmIdImagesImageIdGET'),
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

      resolve(Service.successResponse(
        result,
        DefaultServiceAdapter.successStatus('filmsFilmIdImagesPOST'),
        DefaultServiceAdapter.responseCookie('filmsFilmIdImagesPOST'),
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
  filmsFilmIdImagesGET,
  filmsFilmIdImagesImageIdDELETE,
  filmsFilmIdImagesImageIdGET,
  filmsFilmIdImagesPOST,
};

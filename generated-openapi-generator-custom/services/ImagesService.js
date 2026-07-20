/* eslint-disable no-unused-vars */
const Service = require('./Service');
const DefaultServiceAdapter = require('../../adapters/openapi-generator/DefaultServiceAdapter');

// EVALUATION-NOTE: Template makes regenerated final services delegate to handwritten logic.
// Success status codes and any response cookie are looked up from the adapter (outside this
// generated/regenerated file) instead of being hard-coded per operationId in this template.

/**
* List image metadata for a public film
* Returns all image metadata without pagination or file bytes. Available only to the film owner or an assigned reviewer.
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
* Only the authenticated film owner may delete an image. Metadata and all registered physical representations are removed.
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
* Returns metadata or an existing source image representation. Access is limited to the public film's owner or a reviewer assigned to that exact film. image/jpg is accepted as a request alias for image/jpeg; JPEG responses use the canonical image/jpeg type. A supported representation which is not locally stored may be created by the configured Converter and cached for later requests. Unsupported Accept media ranges return 406.
*
* filmId Integer 
* imageId Integer 
* accept String Standard Accept negotiation for application/json, image/png, image/jpeg (image/jpg alias), and image/gif. Missing Accept and *_/_* default deterministically to application/json. Comma-separated ranges, quality values, and optional parameters are supported. q=0 excludes a representation; highest quality then highest specificity wins, followed by the stable preference application/json, image/png, image/jpeg, image/gif. Unsupported or currently Unsupported representations receive 406. A supported missing representation may trigger conversion and persistent caching. (optional)
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
* The authenticated film owner may upload one valid PNG, JPEG/JPG, or GIF file of at most 5 MiB. Filename extension, multipart media type, and file bytes must agree.
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

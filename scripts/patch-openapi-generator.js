const fs = require('fs');
const path = require('path');

// EVALUATION-NOTE: Historical helper for reconnecting the initial generated service to its adapter.
const targetFile = path.join(
  __dirname,
  '..',
  'generated-openapi-generator',
  'services',
  'DefaultService.js'
);

const patchedContent = `/* eslint-disable no-unused-vars */
const Service = require('./Service');

const DefaultServiceAdapter = require('../../adapters/initial-example/DefaultServiceAdapter');

// EVALUATION-NOTE: Initial generated service delegates to handwritten code through the adapter.
/**
* Get all films
*
* returns List
* */
const filmsGET = () => new Promise(
  async (resolve, reject) => {
    try {
      const films = await DefaultServiceAdapter.filmsGET();
      resolve(Service.successResponse(films));
    } catch (e) {
      reject(Service.rejectResponse(e.message || 'Invalid input', e.status || 500));
    }
  },
);

const filmsIdDELETE = ({ id }) => new Promise(
  async (resolve, reject) => {
    try {
      const deleted = await DefaultServiceAdapter.filmsIdDELETE(id);
      resolve(Service.successResponse({ deleted }, 204));
    } catch (e) {
      reject(Service.rejectResponse(e.message || 'Invalid input', e.status || 500));
    }
  },
);

const filmsIdGET = ({ id }) => new Promise(
  async (resolve, reject) => {
    try {
      const film = await DefaultServiceAdapter.filmsIdGET(id);
      resolve(Service.successResponse(film));
    } catch (e) {
      reject(Service.rejectResponse(e.message || 'Invalid input', e.status || 500));
    }
  },
);

const filmsPOST = (params = {}) => new Promise(
  async (resolve, reject) => {
    try {
      // EVALUATION-NOTE: Accept both generated body names and raw params for the initial example.
      const newFilm = params.newFilm || params.body || params;
      const createdFilm = await DefaultServiceAdapter.filmsPOST(newFilm);
      resolve(Service.successResponse(createdFilm, 201));
    } catch (e) {
      reject(Service.rejectResponse(e.message || 'Invalid input', e.status || 500));
    }
  },
);

const statusGET = () => new Promise(
  async (resolve, reject) => {
    try {
      const status = await DefaultServiceAdapter.statusGET();
      resolve(Service.successResponse(status));
    } catch (e) {
      reject(Service.rejectResponse(e.message || 'Invalid input', e.status || 500));
    }
  },
);

module.exports = {
  filmsGET,
  filmsIdDELETE,
  filmsIdGET,
  filmsPOST,
  statusGET,
};
`;

fs.writeFileSync(targetFile, patchedContent);
console.log('OpenAPI Generator service file patched successfully.');

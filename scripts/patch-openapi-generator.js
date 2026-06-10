const fs = require('fs');
const path = require('path');

const targetFile = path.join(
  __dirname,
  '..',
  'generated-openapi-generator',
  'services',
  'DefaultService.js'
);

const patchedContent = `/* eslint-disable no-unused-vars */
const Service = require('./Service');

const DefaultServiceAdapter = require('../../adapters/openapi-generator/DefaultServiceAdapter');

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
      const deleted = await DefaultServiceAdapter.filmsIdDELETE({ id });
      resolve(Service.successResponse({ deleted }));
    } catch (e) {
      reject(Service.rejectResponse(e.message || 'Invalid input', e.status || 500));
    }
  },
);

const filmsIdGET = ({ id }) => new Promise(
  async (resolve, reject) => {
    try {
      const film = await DefaultServiceAdapter.filmsIdGET({ id });
      resolve(Service.successResponse(film));
    } catch (e) {
      reject(Service.rejectResponse(e.message || 'Invalid input', e.status || 500));
    }
  },
);

const filmsPOST = ({ newFilm }) => new Promise(
  async (resolve, reject) => {
    try {
      const createdFilm = await DefaultServiceAdapter.filmsPOST({ newFilm });
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
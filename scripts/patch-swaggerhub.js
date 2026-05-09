const fs = require('fs');
const path = require('path');

const targetFile = path.join(
    __dirname,
    '..',
    'generated-swaggerhub',
    'service',
    'DefaultService.js'
);

const patchedContent = `'use strict';

const DefaultServiceAdapter = require('../../adapters/swaggerhub/DefaultServiceAdapter');

exports.filmsGET = function() {
  return new Promise(async function(resolve, reject) {
    try {
      const films = await DefaultServiceAdapter.filmsGET();
      resolve(films);
    } catch (e) {
      reject(e);
    }
  });
};

exports.filmsIdGET = function(id) {
  return new Promise(async function(resolve, reject) {
    try {
      const film = await DefaultServiceAdapter.filmsIdGET(id);
      resolve(film);
    } catch (e) {
      reject(e);
    }
  });
};

exports.filmsPOST = function(newFilm) {
  return new Promise(async function(resolve, reject) {
    try {
      const createdFilm = await DefaultServiceAdapter.filmsPOST(newFilm);
      resolve(createdFilm);
    } catch (e) {
      reject(e);
    }
  });
};

exports.filmsIdDELETE = function(id) {
  return new Promise(async function(resolve, reject) {
    try {
      const deleted = await DefaultServiceAdapter.filmsIdDELETE(id);
      resolve({ deleted });
    } catch (e) {
      reject(e);
    }
  });
};

exports.statusGET = function() {
  return new Promise(async function(resolve, reject) {
    try {
      const status = await DefaultServiceAdapter.statusGET();
      resolve(status);
    } catch (e) {
      reject(e);
    }
  });
};
`;

fs.writeFileSync(targetFile, patchedContent);
console.log('SwaggerHub service file patched successfully.');
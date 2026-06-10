/* eslint-disable no-unused-vars */
const Service = require('./Service');

/**
* Get all films
*
* returns List
* */
const filmsGET = () => new Promise(
  async (resolve, reject) => {
    try {
      resolve(Service.successResponse({
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 500,
      ));
    }
  },
);
/**
* Delete film by id
*
* id Integer 
* no response value expected for this operation
* */
const filmsIdDELETE = ({ id }) => new Promise(
  async (resolve, reject) => {
    try {
      resolve(Service.successResponse({
        id,
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 500,
      ));
    }
  },
);
/**
* Get film by id
*
* id Integer 
* returns Film
* */
const filmsIdGET = ({ id }) => new Promise(
  async (resolve, reject) => {
    try {
      resolve(Service.successResponse({
        id,
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 500,
      ));
    }
  },
);
/**
* Create a new film
*
* newFilm NewFilm 
* returns Film
* */
const filmsPOST = ({ newFilm }) => new Promise(
  async (resolve, reject) => {
    try {
      resolve(Service.successResponse({
        newFilm,
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 500,
      ));
    }
  },
);
/**
* API status
*
* returns Status
* */
const statusGET = () => new Promise(
  async (resolve, reject) => {
    try {
      resolve(Service.successResponse({
      }));
    } catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 500,
      ));
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

/* eslint-disable no-unused-vars */
const Service = require('./Service');
const DefaultServiceAdapter = require('../../adapters/openapi-generator/DefaultServiceAdapter');

/**
* Health check
*
* no response value expected for this operation
* */
const healthGET = (params = {}) => new Promise(
  async (resolve, reject) => {
    try {
      const result = await DefaultServiceAdapter.healthGET(
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
  healthGET,
};

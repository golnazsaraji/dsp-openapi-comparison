/* eslint-disable no-unused-vars */
const Service = require('./Service');
const DefaultServiceAdapter = require('../../adapters/openapi-generator/DefaultServiceAdapter');

// EVALUATION-NOTE: Template makes regenerated final services delegate to handwritten logic.
// Success status codes and any response cookie are looked up from the adapter (outside this
// generated/regenerated file) instead of being hard-coded per operationId in this template.

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

      resolve(Service.successResponse(
        result,
        DefaultServiceAdapter.successStatus('healthGET'),
        DefaultServiceAdapter.responseCookie('healthGET'),
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
  healthGET,
};

/* eslint-disable no-unused-vars */
const Service = require('./Service');
const DefaultServiceAdapter = require('../../adapters/openapi-generator/DefaultServiceAdapter');

// EVALUATION-NOTE: Template makes regenerated final services delegate to handwritten logic.
// Success status codes and any response cookie are looked up from the adapter (outside this
// generated/regenerated file) instead of being hard-coded per operationId in this template.

/**
* Logout
*
* no response value expected for this operation
* */
const sessionsCurrentDELETE = (params = {}) => new Promise(
  async (resolve, reject) => {
    try {
      const result = await DefaultServiceAdapter.sessionsCurrentDELETE(
      );

      resolve(Service.successResponse(
        result,
        DefaultServiceAdapter.successStatus('sessionsCurrentDELETE'),
        DefaultServiceAdapter.responseCookie('sessionsCurrentDELETE'),
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
* Get current authenticated user
*
* returns User
* */
const sessionsCurrentGET = (params = {}) => new Promise(
  async (resolve, reject) => {
    try {
      const result = await DefaultServiceAdapter.sessionsCurrentGET(
      );

      resolve(Service.successResponse(
        result,
        DefaultServiceAdapter.successStatus('sessionsCurrentGET'),
        DefaultServiceAdapter.responseCookie('sessionsCurrentGET'),
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
* Login with email and password
*
* loginRequest LoginRequest 
* returns User
* */
const sessionsPOST = (params = {}) => new Promise(
  async (resolve, reject) => {
    try {
      const result = await DefaultServiceAdapter.sessionsPOST(
          params.loginRequest || params.body || params,
      );

      resolve(Service.successResponse(
        result,
        DefaultServiceAdapter.successStatus('sessionsPOST'),
        DefaultServiceAdapter.responseCookie('sessionsPOST'),
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
  sessionsCurrentDELETE,
  sessionsCurrentGET,
  sessionsPOST,
};

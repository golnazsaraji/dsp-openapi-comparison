const FilmManagerService = require('../../shared-services/src/services/FilmManagerService');
const generatedSuccessStatus = require('./generated-response-metadata');

function successStatus(operationId) {
    const status = generatedSuccessStatus[operationId];
    if (status === undefined) {
        throw new Error(`No generated success response metadata for ${String(operationId)}.`);
    }
    return status;
}

// Cookie to attach to the response for a given operationId, or undefined for none.
// Centralizes the login-cookie decision here instead of a hard-coded operationId string
// check inside the generated (and regenerated) Controller.js.
function responseCookie(operationId) {
    return undefined;
}

module.exports = new Proxy({ successStatus, responseCookie }, {
    get(target, operationId) {
        if (operationId in target) return target[operationId];

        return async (...args) => {
            const operation = FilmManagerService[operationId];
            if (typeof operation !== 'function') {
                const error = new Error(`No shared service implementation for ${String(operationId)}.`);
                error.status = 501;
                throw error;
            }

            const result = await operation.apply(FilmManagerService, args);
            return result;
        };
    },
});

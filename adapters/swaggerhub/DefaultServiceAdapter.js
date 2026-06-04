const FilmManagerService = require('../../shared-services/src/services/FilmManagerService');

module.exports = new Proxy({}, {
    get(target, operationId) {
        if (operationId in target) return target[operationId];

        return async (...args) => {
            const operation = FilmManagerService[operationId];
            if (typeof operation !== 'function') {
                const error = new Error(`No shared service implementation for ${String(operationId)}.`);
                error.status = 501;
                throw error;
            }

            return operation.apply(FilmManagerService, args);
        };
    },
});

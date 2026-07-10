const FilmManagerService = require('../../shared-services/src/services/FilmManagerService');

// Success status codes per operationId. Regeneration-safe home for a value that used to be
// hard-coded inside out/service.mustache: editing openapi.yaml's response code alone did not
// change runtime behavior because the template never read the spec at generation time, so a
// manual edit made anywhere else was silently lost on the next `npm run generate:final`.
const successStatusByOperation = {
    sessionsPOST: 201,
    sessionsCurrentDELETE: 204,
    filmsPOST: 201,
    reviewsAutoInvitationsPOST: 201,
    filmsFilmIdDELETE: 204,
    filmsFilmIdReviewsPOST: 201,
    filmsFilmIdReviewsReviewerIdDELETE: 204,
    usersCurrentActiveFilmDELETE: 204,
    filmsFilmIdImagesPOST: 201,
    filmsFilmIdImagesImageIdDELETE: 204,
};

function successStatus(operationId) {
    return successStatusByOperation[operationId] || 200;
}

// Cookie to attach to the response for a given operationId, or undefined for none.
// Centralizes the login-cookie decision here instead of a hard-coded operationId string
// check inside the generated (and regenerated) Controller.js.
function responseCookie(operationId) {
    if (operationId === 'sessionsPOST') {
        return { name: 'connect-sid', value: 'generated-session', options: { httpOnly: true, sameSite: 'lax' } };
    }
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

            return operation.apply(FilmManagerService, args);
        };
    },
});

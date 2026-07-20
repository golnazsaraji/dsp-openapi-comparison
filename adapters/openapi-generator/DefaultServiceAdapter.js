const FilmManagerService = require('../../shared-services/src/services/FilmManagerService');
const fs = require('fs');
const path = require('path');

// Success status codes per operationId. Regeneration-safe home for a value that used to be
// hard-coded inside out/service.mustache: editing openapi.yaml's response code alone did not
// change runtime behavior because the template never read the spec at generation time, so a
// manual edit made anywhere else was silently lost on the next `npm run generate:final`.


// TODO: Replace this manually maintained successStatusByOperation map with
// automatic generation or validation based on openapi/openapi.yaml.
//
// Desired behavior:
// - Read every operationId from the OpenAPI specification.
// - Detect the declared successful 2xx response code for each operation.
// - Use 200 as the default only when 200 is explicitly declared or when no
//   more specific successful status is defined.
// - Support non-default success codes such as 201, 202, and 204.
// - Fail generation or verification when the specification and runtime status
//   mapping diverge.
// - Keep openapi/openapi.yaml as the single source of truth.
//
// This map is currently regeneration-safe because it lives outside the
// generated output directory, but it must still be updated manually whenever
// an API operation with a non-200 success response is added or changed.
const successStatusByOperation = {
    filmsFilmIdPUT: 204,
    sessionsCurrentDELETE: 204,
    filmsPOST: 201,
    reviewsAutoInvitationsPOST: 201,
    filmsFilmIdDELETE: 204,
    filmsFilmIdReviewsPOST: 201,
    filmsFilmIdReviewsCurrentPUT: 204,
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
    return undefined;
}

const uploadDirectory = path.resolve(
    process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'runtime-data', 'uploaded_files'),
);

function removeStoredImages(images) {
    images.forEach((image) => {
        if (!image?.name) return;
        const storedPath = path.join(uploadDirectory, path.basename(image.name));
        try {
            fs.unlinkSync(storedPath);
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
        }
    });
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

            const deletedImages = operationId === 'filmsFilmIdDELETE'
                ? FilmManagerService.images.filter((image) => image.filmId === Number(args[0]))
                : operationId === 'filmsFilmIdImagesImageIdDELETE'
                    ? FilmManagerService.images.filter((image) => image.filmId === Number(args[0]) && image.id === Number(args[1]))
                    : [];
            const result = await operation.apply(FilmManagerService, args);
            removeStoredImages(deletedImages);
            return result;
        };
    },
});

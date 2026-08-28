const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const yaml = require('js-yaml');
const {
    deriveSuccessStatuses,
    generateMetadata,
} = require('./generate-openapi-response-metadata');

const root = path.join(__dirname, '..');
const specificationPath = path.join(root, 'openapi', 'openapi.yaml');
const metadataPath = path.join(root, 'adapters', 'openapi-generator', 'generated-response-metadata.js');
const specification = yaml.load(fs.readFileSync(specificationPath, 'utf8'));
const derived = deriveSuccessStatuses(specification, specificationPath);
const generated = require(metadataPath);

assert.deepStrictEqual({ ...generated }, derived, 'generated response metadata must exactly match OpenAPI');
assert.strictEqual(generated.filmsGET, 200, 'filmsGET must use its declared 200 response');
assert.strictEqual(generated.filmsPOST, 201, 'filmsPOST must use its declared 201 response');
assert.strictEqual(generated.filmsFilmIdDELETE, 204, 'filmsFilmIdDELETE must use its declared 204 response');

const operationCount = Object.values(specification.paths).reduce(
    (count, pathItem) => count + Object.keys(pathItem).filter((key) => /^(get|put|post|delete|options|head|patch|trace)$/i.test(key)).length,
    0,
);
assert.strictEqual(Object.keys(generated).length, operationCount, 'every OpenAPI operation must have generated success metadata');

const synthetic = {
    paths: {
        '/future': {
            post: { operationId: 'futurePOST', responses: { 202: { description: 'Accepted' } } },
        },
    },
};
assert.deepStrictEqual(deriveSuccessStatuses(synthetic), { futurePOST: 202 }, 'a new non-200 operation needs no adapter/template edit');
assert.throws(
    () => deriveSuccessStatuses({ paths: { '/missing': { get: { operationId: 'missingGET', responses: { 400: {} } } } } }),
    /no numeric 2xx response/,
);
assert.throws(
    () => deriveSuccessStatuses({ paths: { '/ambiguous': { get: { operationId: 'ambiguousGET', responses: { 200: {}, 202: {} } } } } }),
    /ambiguous 2xx responses: 200, 202/,
);

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'dsp-response-metadata-'));
const temporaryInput = path.join(temporaryDirectory, 'openapi.yaml');
const temporaryOutput = path.join(temporaryDirectory, 'metadata.js');
fs.writeFileSync(temporaryInput, yaml.dump(synthetic));
generateMetadata(temporaryInput, temporaryOutput);
const firstGeneration = fs.readFileSync(temporaryOutput, 'utf8');
generateMetadata(temporaryInput, temporaryOutput);
assert.strictEqual(fs.readFileSync(temporaryOutput, 'utf8'), firstGeneration, 'metadata generation must be deterministic');

const adapterSource = fs.readFileSync(path.join(root, 'adapters', 'openapi-generator', 'DefaultServiceAdapter.js'), 'utf8');
const templateSource = fs.readFileSync(path.join(root, 'out', 'service.mustache'), 'utf8');
assert.doesNotMatch(adapterSource, /successStatusByOperation/, 'adapter must not contain a handwritten status map');
assert.doesNotMatch(templateSource, /filmsPOST|filmsFilmIdDELETE|successStatusByOperation/, 'service template must not contain operation-specific statuses');

const adapter = require('../adapters/openapi-generator/DefaultServiceAdapter');
assert.strictEqual(adapter.successStatus('filmsGET'), 200);
assert.strictEqual(adapter.successStatus('filmsPOST'), 201);
assert.strictEqual(adapter.successStatus('filmsFilmIdDELETE'), 204);
assert.throws(() => adapter.successStatus('notInOpenApi'), /No generated success response metadata/);

async function verifyErrorPropagation() {
    await assert.rejects(() => adapter.notImplementedInSharedServices(), (error) => error.status === 501);

    const filmManagerService = require('../shared-services/src/services/FilmManagerService');
    const filmsService = require('../generated-openapi-generator-custom/services/FilmsService');
    const originalFilmsGET = filmManagerService.filmsGET;
    try {
        filmManagerService.filmsGET = () => {
            const error = new Error('Explicit business error');
            error.status = 400;
            throw error;
        };
        await assert.rejects(() => filmsService.filmsGET(), (error) => error.code === 400);

        filmManagerService.filmsGET = () => { throw new Error('Unexpected error'); };
        await assert.rejects(() => filmsService.filmsGET(), (error) => error.code === 500);
    } finally {
        filmManagerService.filmsGET = originalFilmsGET;
    }
}

verifyErrorPropagation()
    .then(() => console.log('OpenAPI response metadata tests passed.'))
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });

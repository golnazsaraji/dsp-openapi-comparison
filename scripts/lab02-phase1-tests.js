const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dsp-lab02-phase1-'));
const uploadRoot = path.join(testRoot, 'uploads');
const metadataPath = path.join(testRoot, 'image-metadata.json');
process.env.UPLOAD_DIR = uploadRoot;
process.env.IMAGE_METADATA_PATH = metadataPath;

const singleton = require('../shared-services/src/services/FilmManagerService');
const { FilmManagerService } = singleton;
const ImageMetadataRepository = require('../shared-services/src/images/ImageMetadataRepository');
const ImageService = require('../shared-services/src/images/ImageService');

fs.mkdirSync(uploadRoot, { recursive: true });

const collectionFixtures = path.join(__dirname, '..', 'postman', 'lab02', 'fixtures');
const fixtures = {
    png: { path: path.join(collectionFixtures, 'valid.png'), name: 'valid.png', mimeType: 'image/png' },
    jpeg: { path: path.join(collectionFixtures, 'valid.jpg'), name: 'valid.jpg', mimeType: 'image/jpeg' },
    gif: { path: path.join(collectionFixtures, 'valid.gif'), name: 'valid.gif', mimeType: 'image/gif' },
};

let sequence = 0;
const converterCalls = [];
const fakeConverter = {
    failNext: false,
    invalidNext: false,
    async convert({ targetMediaType, outputPath, sourcePath }) {
        converterCalls.push({ targetMediaType, sourcePath });
        if (this.failNext) { this.failNext = false; const error = new Error('Converter unavailable.'); error.status = 503; throw error; }
        if (this.invalidNext) { this.invalidNext = false; fs.writeFileSync(outputPath, 'invalid output'); return { outputPath }; }
        const fixture = targetMediaType === 'image/png' ? fixtures.png
            : targetMediaType === 'image/jpeg' ? fixtures.jpeg : fixtures.gif;
        fs.copyFileSync(fixture.path, outputPath);
        return { mediaType: targetMediaType, length: fs.statSync(outputPath).size, outputPath };
    },
};
function stagedUpload(fixture, overrides = {}) {
    sequence += 1;
    const storedName = `temporary-${sequence}`;
    const bytes = overrides.bytes || fs.readFileSync(fixture.path);
    fs.writeFileSync(path.join(uploadRoot, storedName), bytes);
    return {
        originalName: overrides.originalName || fixture.name,
        storedName,
        mimeType: overrides.mimeType || fixture.mimeType,
        size: bytes.length,
    };
}

function expectStatus(action, status) {
    assert.throws(action, (error) => error.status === status, `expected HTTP status ${status}`);
}

function fileCount() {
    return fs.readdirSync(uploadRoot).length;
}

function assertRejectedWithoutFile(service, filmId, upload, status) {
    const before = fileCount();
    expectStatus(() => service.filmsFilmIdImagesPOST(filmId, upload), status);
    assert.strictEqual(fileCount(), before - 1, 'rejected upload must remove its staged file');
}

(async () => {
try {
    const service = new FilmManagerService({ imageOptions: { converter: fakeConverter } });

    service.currentUserId = 1;
    const publicFilm = service.filmsPOST({ title: 'Phase 1 public film', private: false });
    const emptyPublicFilm = service.filmsPOST({ title: 'No images', private: false });
    const privateFilm = service.filmsPOST({ title: 'Private film', private: true });
    const cascadeFilm = service.filmsPOST({ title: 'Cascade film', private: false });
    service.currentUserId = 2;
    const otherFilm = service.filmsPOST({ title: 'Other owner film', private: false });

    // 1-4: authentication on every image operation.
    const unauthenticatedUpload = stagedUpload(fixtures.png);
    service.currentUserId = null;
    assertRejectedWithoutFile(service, publicFilm.id, unauthenticatedUpload, 401);
    expectStatus(() => service.filmsFilmIdImagesGET(publicFilm.id), 401);
    expectStatus(() => service.filmsFilmIdImagesImageIdGET(publicFilm.id, 1), 401);
    expectStatus(() => service.filmsFilmIdImagesImageIdDELETE(publicFilm.id, 1), 401);

    // 5-8: three real formats and multiple images on one film.
    service.currentUserId = 1;
    const png = service.filmsFilmIdImagesPOST(publicFilm.id, stagedUpload(fixtures.png));
    const jpeg = service.filmsFilmIdImagesPOST(publicFilm.id, stagedUpload(fixtures.jpeg));
    const gif = service.filmsFilmIdImagesPOST(publicFilm.id, stagedUpload(fixtures.gif));
    assert.strictEqual(png.mediaType, 'image/png');
    assert.strictEqual(jpeg.mediaType, 'image/jpeg');
    assert.strictEqual(gif.mediaType, 'image/gif');
    assert.strictEqual(service.filmsFilmIdImagesGET(publicFilm.id).length, 3);

    // 9-17: upload rejection, cleanup, and generated collision-safe keys.
    assertRejectedWithoutFile(service, privateFilm.id, stagedUpload(fixtures.png), 403);
    service.currentUserId = 2;
    assertRejectedWithoutFile(service, publicFilm.id, stagedUpload(fixtures.png), 403);
    service.currentUserId = 1;
    expectStatus(() => service.filmsFilmIdImagesPOST(publicFilm.id, undefined), 400);
    assertRejectedWithoutFile(service, publicFilm.id, stagedUpload(fixtures.png, { originalName: 'clock.bmp' }), 415);
    assertRejectedWithoutFile(service, publicFilm.id, stagedUpload(fixtures.png, { mimeType: 'application/octet-stream' }), 415);
    assertRejectedWithoutFile(service, publicFilm.id, stagedUpload(fixtures.png, { mimeType: 'image/gif' }), 415);
    assertRejectedWithoutFile(service, publicFilm.id, stagedUpload(fixtures.png, { bytes: Buffer.from('not an image') }), 400);
    const storedRecords = service.imageService.repository.listByFilm(publicFilm.id);
    assert.strictEqual(new Set(storedRecords.map((record) => record.storageKey)).size, 3);
    assert(storedRecords.every((record) => !record.storageKey.includes('clock')));

    // 18-20: persisted identity, association, and media type survive repository reinitialization.
    const restartImage = service.filmsFilmIdImagesPOST(1, stagedUpload(fixtures.png));
    const reloaded = new ImageMetadataRepository(metadataPath);
    const persistedJpeg = reloaded.find(publicFilm.id, jpeg.id);
    assert(persistedJpeg);
    assert.strictEqual(persistedJpeg.filmId, publicFilm.id);
    assert.strictEqual(persistedJpeg.mediaType, 'image/jpeg');
    const restartedService = new FilmManagerService({ imageOptions: { converter: fakeConverter } });
    restartedService.currentUserId = 1;
    assert.strictEqual(restartedService.filmsFilmIdImagesImageIdGET(1, restartImage.id).body.id, restartImage.id);

    // 21-28: explicit owner/reviewer authorization and film-scoped lookup.
    assert.strictEqual(service.filmsFilmIdImagesGET(publicFilm.id).length, 3);
    service.filmsFilmIdReviewsPOST(publicFilm.id, [{ reviewerId: 2 }]);
    service.currentUserId = 2;
    assert.strictEqual(service.filmsFilmIdImagesGET(publicFilm.id).length, 3);
    service.currentUserId = 4;
    expectStatus(() => service.filmsFilmIdImagesGET(publicFilm.id), 403);
    service.currentUserId = 1;
    assert.strictEqual(service.filmsFilmIdImagesImageIdGET(publicFilm.id, png.id).body.id, png.id);
    service.currentUserId = 2;
    assert.strictEqual(service.filmsFilmIdImagesImageIdGET(publicFilm.id, png.id).body.id, png.id);
    service.currentUserId = 4;
    expectStatus(() => service.filmsFilmIdImagesImageIdGET(publicFilm.id, png.id), 403);
    service.currentUserId = 1;
    assert.deepStrictEqual(service.filmsFilmIdImagesGET(emptyPublicFilm.id), []);
    expectStatus(() => service.filmsFilmIdImagesImageIdGET(otherFilm.id, png.id), 403);
    service.currentUserId = 2;
    expectStatus(() => service.filmsFilmIdImagesImageIdGET(otherFilm.id, png.id), 404);

    // 29-56: Phase 2 negotiation, source descriptors, authorization, and controlled storage errors.
    const { negotiateAccept } = require('../shared-services/src/http/AcceptNegotiation');
    service.currentUserId = 1;
    const jsonDescriptor = service.filmsFilmIdImagesImageIdGET(publicFilm.id, png.id, 'application/json; charset=utf-8');
    assert.strictEqual(jsonDescriptor.kind, 'json');
    assert.strictEqual(jsonDescriptor.body.id, png.id);
    assert.deepStrictEqual(Object.keys(jsonDescriptor.body).sort(), ['filmId', 'id', 'mediaType', 'name', 'self']);
    assert.strictEqual(service.filmsFilmIdImagesImageIdGET(publicFilm.id, png.id).kind, 'json');
    assert.strictEqual(service.filmsFilmIdImagesImageIdGET(publicFilm.id, png.id, '*/*').kind, 'json');

    const pngDescriptor = service.filmsFilmIdImagesImageIdGET(publicFilm.id, png.id, 'image/png');
    assert.strictEqual(pngDescriptor.kind, 'file');
    assert.strictEqual(pngDescriptor.mediaType, 'image/png');
    assert.strictEqual(pngDescriptor.length, fs.statSync(fixtures.png.path).size);
    assert.deepStrictEqual(fs.readFileSync(pngDescriptor.filePath), fs.readFileSync(fixtures.png.path));

    const jpegDescriptor = service.filmsFilmIdImagesImageIdGET(publicFilm.id, jpeg.id, 'image/jpeg');
    const jpegAliasDescriptor = service.filmsFilmIdImagesImageIdGET(publicFilm.id, jpeg.id, 'image/jpg');
    assert.strictEqual(jpegDescriptor.mediaType, 'image/jpeg');
    assert.strictEqual(jpegAliasDescriptor.mediaType, 'image/jpeg');
    assert.deepStrictEqual(fs.readFileSync(jpegAliasDescriptor.filePath), fs.readFileSync(fixtures.jpeg.path));

    const gifDescriptor = service.filmsFilmIdImagesImageIdGET(publicFilm.id, gif.id, 'image/gif');
    assert.strictEqual(gifDescriptor.mediaType, 'image/gif');
    assert.deepStrictEqual(fs.readFileSync(gifDescriptor.filePath), fs.readFileSync(fixtures.gif.path));

    service.currentUserId = 2;
    assert.strictEqual(service.filmsFilmIdImagesImageIdGET(publicFilm.id, png.id, 'image/png').kind, 'file');
    service.currentUserId = null;
    expectStatus(() => service.filmsFilmIdImagesImageIdGET(publicFilm.id, png.id, 'image/png'), 401);
    service.currentUserId = 4;
    expectStatus(() => service.filmsFilmIdImagesImageIdGET(publicFilm.id, png.id, 'image/png'), 403);
    service.currentUserId = 2;
    expectStatus(() => service.filmsFilmIdImagesImageIdGET(otherFilm.id, png.id, 'image/png'), 404);
    service.currentUserId = 1;

    expectStatus(() => service.filmsFilmIdImagesImageIdGET(publicFilm.id, png.id, 'text/plain'), 406);
    const callsBeforeConversion = converterCalls.length;
    const convertedJpeg = await service.filmsFilmIdImagesImageIdGET(publicFilm.id, png.id, 'image/jpeg');
    assert.strictEqual(convertedJpeg.mediaType, 'image/jpeg');
    assert.strictEqual(converterCalls.length, callsBeforeConversion + 1);
    const cachedJpeg = await service.filmsFilmIdImagesImageIdGET(publicFilm.id, png.id, 'image/jpeg');
    assert.strictEqual(cachedJpeg.mediaType, 'image/jpeg');
    assert.strictEqual(converterCalls.length, callsBeforeConversion + 1, 'cached response must not call Converter');
    const convertedRecord = service.imageService.repository.find(publicFilm.id, png.id);
    const convertedRepresentation = convertedRecord.representations.find((item) => item.mediaType === 'image/jpeg');
    assert(convertedRepresentation && !convertedRepresentation.original && convertedRepresentation.convertedFrom === 'image/png');
    assert(convertedRepresentation.byteSize > 0 && /^[a-f0-9]{64}$/.test(convertedRepresentation.checksum));
    const convertedPath = service.imageService.storage.fullPath(convertedRepresentation.storageKey);

    const callsBeforeConcurrent = converterCalls.length;
    const concurrent = await Promise.all([
        service.filmsFilmIdImagesImageIdGET(publicFilm.id, png.id, 'image/gif'),
        service.filmsFilmIdImagesImageIdGET(publicFilm.id, png.id, 'image/gif'),
    ]);
    assert(concurrent.every((descriptor) => descriptor.mediaType === 'image/gif'));
    assert.strictEqual(converterCalls.length, callsBeforeConcurrent + 1, 'same target must share one conversion');

    fakeConverter.failNext = true;
    await assert.rejects(service.filmsFilmIdImagesImageIdGET(publicFilm.id, gif.id, 'image/png'), (error) => error.status === 503);
    const retry = await service.filmsFilmIdImagesImageIdGET(publicFilm.id, gif.id, 'image/png');
    assert.strictEqual(retry.mediaType, 'image/png', 'failed conversion lock must allow retry');

    fakeConverter.invalidNext = true;
    await assert.rejects(service.filmsFilmIdImagesImageIdGET(publicFilm.id, jpeg.id, 'image/png'), (error) => error.status === 502);
    assert(!service.imageService.repository.find(publicFilm.id, jpeg.id).representations.some((item) => item.mediaType === 'image/png'));
    assert(!fs.readdirSync(uploadRoot).some((name) => name.startsWith('.conversion-')), 'invalid output must not leave temporary files');

    service.imageService = new ImageService({ converter: fakeConverter, metadataPath, uploadRoot });
    const beforeRestartHit = converterCalls.length;
    assert.strictEqual((await service.filmsFilmIdImagesImageIdGET(publicFilm.id, png.id, 'image/jpeg')).mediaType, 'image/jpeg');
    assert.strictEqual(converterCalls.length, beforeRestartHit, 'persisted conversion must survive service restart');
    assert.strictEqual(negotiateAccept('image/png;q=0.4, application/json;q=0.8'), 'application/json');
    assert.strictEqual(negotiateAccept('image/png;q=0, */*;q=0.5'), 'application/json');
    assert.strictEqual(negotiateAccept('image/jpeg; charset=binary; q=0.9, image/gif;q=0.2'), 'image/jpeg');
    assert.strictEqual(negotiateAccept('image/jpg'), 'image/jpeg');
    assert.strictEqual(negotiateAccept('image/png;q=0.8, application/json;q=0.8'), 'application/json');
    assert.strictEqual(negotiateAccept('text/plain, application/xml'), null);

    const missingFilm = service.filmsPOST({ title: 'Missing physical source', private: false });
    const missingImage = service.filmsFilmIdImagesPOST(missingFilm.id, stagedUpload(fixtures.png));
    const missingRecord = service.imageService.repository.find(missingFilm.id, missingImage.id);
    const missingPath = service.imageService.storage.fullPath(missingRecord.storageKey);
    fs.unlinkSync(missingPath);
    assert.throws(
        () => service.filmsFilmIdImagesImageIdGET(missingFilm.id, missingImage.id, 'image/png'),
        (error) => error.status === 500 && !error.message.includes(missingPath),
    );

    // 57-64: owner-only, film-scoped deletion and physical/metadata cleanup.
    service.currentUserId = 2;
    expectStatus(() => service.filmsFilmIdImagesImageIdDELETE(publicFilm.id, gif.id), 403);
    service.currentUserId = 4;
    expectStatus(() => service.filmsFilmIdImagesImageIdDELETE(publicFilm.id, gif.id), 403);
    service.currentUserId = 2;
    expectStatus(() => service.filmsFilmIdImagesImageIdDELETE(otherFilm.id, gif.id), 404);
    service.currentUserId = 1;
    const pngRecord = service.imageService.repository.find(publicFilm.id, png.id);
    const pngPath = service.imageService.storage.fullPath(pngRecord.storageKey);
    const jpegRecord = service.imageService.repository.find(publicFilm.id, jpeg.id);
    const jpegPath = service.imageService.storage.fullPath(jpegRecord.storageKey);
    service.filmsFilmIdImagesImageIdDELETE(publicFilm.id, png.id);
    assert.strictEqual(service.imageService.repository.find(publicFilm.id, png.id), undefined);
    assert.strictEqual(fs.existsSync(pngPath), false);
    assert.strictEqual(fs.existsSync(convertedPath), false);
    assert.strictEqual(fs.existsSync(jpegPath), true);
    fs.unlinkSync(jpegPath);
    service.filmsFilmIdImagesImageIdDELETE(publicFilm.id, jpeg.id);
    assert.strictEqual(service.imageService.repository.find(publicFilm.id, jpeg.id), undefined);

    // Register a future representation and prove deletion enumerates it rather than hard-coding extensions.
    const gifRecord = service.imageService.repository.find(publicFilm.id, gif.id);
    const futureKey = 'future-representation.webp';
    fs.writeFileSync(path.join(uploadRoot, futureKey), 'future representation');
    gifRecord.representations.push({ mediaType: 'image/webp', storageKey: futureKey });
    service.imageService.repository.persist();
    service.filmsFilmIdImagesImageIdDELETE(publicFilm.id, gif.id);
    assert.strictEqual(fs.existsSync(path.join(uploadRoot, futureKey)), false);

    // 65: film deletion cascades metadata and all registered source files.
    const cascadeImage = service.filmsFilmIdImagesPOST(cascadeFilm.id, stagedUpload(fixtures.png));
    const cascadeRecord = service.imageService.repository.find(cascadeFilm.id, cascadeImage.id);
    const cascadePath = service.imageService.storage.fullPath(cascadeRecord.storageKey);
    service.filmsFilmIdDELETE(cascadeFilm.id);
    assert.deepStrictEqual(service.imageService.repository.listByFilm(cascadeFilm.id), []);
    assert.strictEqual(fs.existsSync(cascadePath), false);

    console.log('Lab02 cumulative Phase 1 + Phase 2 + Phase 3 tests passed (85 behavioral checks).');
} finally {
    fs.rmSync(testRoot, { recursive: true, force: true });
}
})().catch((error) => { console.error(error); process.exitCode = 1; });

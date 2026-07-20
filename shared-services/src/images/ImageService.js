const fs = require('fs');
const path = require('path');
const ImageMetadataRepository = require('./ImageMetadataRepository');
const ImageStorage = require('./ImageStorage');
const ResponseDescriptor = require('../http/ResponseDescriptor');
const ConverterClient = require('./ConverterClient');

class ImageService {
    constructor(options = {}) {
        this.repository = options.repository || new ImageMetadataRepository(options.metadataPath);
        this.storage = options.storage || new ImageStorage(options.uploadRoot);
        this.converter = options.converter || new ConverterClient(options.converterOptions);
        this.conversions = new Map();
    }

    error(message, status) {
        const error = new Error(message);
        error.status = status;
        return error;
    }

    resolvePublicFilm(filmId, filmResolver) {
        const film = filmResolver(filmId);
        if (!film) throw this.error('Film not found.', 404);
        if (!film.public) throw this.error('Images are only available for public films.', 403);
        return film;
    }

    authorizeRead(filmId, userId, filmResolver, reviewerCheck) {
        const film = this.resolvePublicFilm(filmId, filmResolver);
        if (film.ownerId !== Number(userId) && !reviewerCheck(userId, film.id)) {
            throw this.error('Only the owner or an assigned reviewer can access film images.', 403);
        }
        return film;
    }

    upload(filmId, userId, upload, filmResolver) {
        let committed;
        try {
            const film = this.resolvePublicFilm(filmId, filmResolver);
            if (film.ownerId !== Number(userId)) throw this.error('Only the owner can add images to this film.', 403);
            committed = this.storage.validateAndCommit(upload);
            let record;
            try {
                record = this.repository.create({
                    filmId: film.id,
                    name: path.basename(upload.originalName),
                    mediaType: committed.mediaType,
                    storageKey: committed.storageKey,
                    byteSize: committed.byteSize,
                });
            } catch (error) {
                this.storage.removeRepresentations({ storageKey: committed.storageKey });
                throw error;
            }
            return this.repository.publicMetadata(record);
        } finally {
            if (!committed) this.storage.discardUpload(upload);
        }
    }

    list(filmId, userId, filmResolver, reviewerCheck) {
        this.authorizeRead(filmId, userId, filmResolver, reviewerCheck);
        return this.repository.listByFilm(filmId).map((record) => this.repository.publicMetadata(record));
    }

    get(filmId, imageId, userId, mediaType, filmResolver, reviewerCheck) {
        this.authorizeRead(filmId, userId, filmResolver, reviewerCheck);
        const record = this.repository.find(filmId, imageId);
        if (!record) throw this.error('Image not found.', 404);
        if (mediaType === 'application/json') {
            return ResponseDescriptor.json(this.repository.publicMetadata(record));
        }
        const representation = this.storage.resolveRepresentation(record, mediaType);
        if (!representation) return this.convertAndResolve(record, mediaType);
        return ResponseDescriptor.file(
            representation.filePath,
            representation.mediaType,
            representation.length,
        );
    }

    chooseSource(record) {
        const representations = Array.isArray(record.representations) ? record.representations : [];
        return representations.find((item) => item.original)
            || representations.find((item) => item.mediaType === record.mediaType)
            || representations[0];
    }

    convertAndResolve(record, targetMediaType) {
        const key = `${record.id}:${targetMediaType}`;
        if (this.conversions.has(key)) return this.conversions.get(key);
        const conversion = this.performConversion(record, targetMediaType)
            .finally(() => this.conversions.delete(key));
        this.conversions.set(key, conversion);
        return conversion;
    }

    async performConversion(record, targetMediaType) {
        const source = this.chooseSource(record);
        if (!source) throw this.error('No local source representation is available for conversion.', 500);
        const sourceDescriptor = this.storage.resolveRepresentation(record, source.mediaType);
        const temporaryPath = this.storage.conversionTemporaryPath(record.id, targetMediaType);
        let committed;
        try {
            await this.converter.convert({
                sourcePath: sourceDescriptor.filePath,
                sourceMediaType: source.mediaType,
                targetMediaType,
                outputPath: temporaryPath,
            });
            try {
                committed = this.storage.validateAndCommitConversion(temporaryPath, targetMediaType);
            } catch (error) {
                if (error.status === 400 || error.status === 415) {
                    throw this.error('Converter returned invalid image bytes.', 502);
                }
                throw error;
            }
            try {
                this.repository.addRepresentation(record.filmId, record.id, {
                    mediaType: committed.mediaType,
                    storageKey: committed.storageKey,
                    byteSize: committed.byteSize,
                    checksum: committed.checksum,
                    createdAt: new Date().toISOString(),
                    original: false,
                    convertedFrom: source.mediaType,
                });
            } catch (error) {
                this.storage.removeRepresentations({ storageKey: committed.storageKey });
                throw error;
            }
            const descriptor = this.storage.resolveRepresentation(record, targetMediaType);
            return ResponseDescriptor.file(descriptor.filePath, descriptor.mediaType, descriptor.length);
        } catch (error) {
            try { fs.unlinkSync(temporaryPath); } catch (unlinkError) { if (unlinkError.code !== 'ENOENT') error.cleanupError = true; }
            throw error;
        }
    }

    delete(filmId, imageId, userId, filmResolver) {
        const film = this.resolvePublicFilm(filmId, filmResolver);
        if (film.ownerId !== Number(userId)) throw this.error('Only the owner can delete images from this film.', 403);
        const record = this.repository.find(filmId, imageId);
        if (!record) throw this.error('Image not found.', 404);
        this.storage.removeRepresentations(record);
        this.repository.delete(filmId, imageId);
        return true;
    }

    deleteByFilm(filmId) {
        const records = this.repository.listByFilm(filmId);
        for (const record of records) this.storage.removeRepresentations(record);
        this.repository.deleteByFilm(filmId);
        return records;
    }
}

module.exports = ImageService;

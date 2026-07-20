const fs = require('fs');
const path = require('path');

class ImageMetadataRepository {
    constructor(filePath = process.env.IMAGE_METADATA_PATH || path.join(__dirname, '..', '..', '..', 'runtime-data', 'image-metadata.json')) {
        this.filePath = path.resolve(filePath);
        fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
        this.state = this.load();
    }

    emptyState() {
        return { version: 1, nextId: 1, images: [] };
    }

    load() {
        if (!fs.existsSync(this.filePath)) return this.emptyState();
        const raw = fs.readFileSync(this.filePath, 'utf8');
        if (!raw.trim()) return this.emptyState();
        const parsed = JSON.parse(raw);
        if (parsed.version !== 1 || !Number.isInteger(parsed.nextId) || !Array.isArray(parsed.images)) {
            throw new Error(`Unsupported image metadata format in ${this.filePath}.`);
        }
        return parsed;
    }

    persist() {
        const temporaryPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
        fs.writeFileSync(temporaryPath, `${JSON.stringify(this.state, null, 2)}\n`, { mode: 0o600 });
        fs.renameSync(temporaryPath, this.filePath);
    }

    publicMetadata(record) {
        return {
            id: record.id,
            filmId: record.filmId,
            name: record.name,
            mediaType: record.mediaType,
            self: `/api/films/${record.filmId}/images/${record.id}`,
        };
    }

    create(input) {
        const record = {
            id: this.state.nextId,
            filmId: Number(input.filmId),
            name: input.name,
            mediaType: input.mediaType,
            storageKey: input.storageKey,
            createdAt: input.createdAt || new Date().toISOString(),
            representations: input.representations || [{
                mediaType: input.mediaType,
                storageKey: input.storageKey,
                byteSize: input.byteSize,
                createdAt: input.createdAt || new Date().toISOString(),
                original: true,
            }],
        };
        this.state.nextId += 1;
        this.state.images.push(record);
        this.persist();
        return record;
    }

    listByFilm(filmId) {
        return this.state.images.filter((record) => record.filmId === Number(filmId));
    }

    find(filmId, imageId) {
        return this.state.images.find((record) => record.filmId === Number(filmId) && record.id === Number(imageId));
    }

    addRepresentation(filmId, imageId, representation) {
        const record = this.find(filmId, imageId);
        if (!record) return null;
        if (record.representations.some((item) => item.mediaType === representation.mediaType)) return record;
        record.representations.push(representation);
        this.persist();
        return record;
    }

    delete(filmId, imageId) {
        const record = this.find(filmId, imageId);
        if (!record) return null;
        this.state.images = this.state.images.filter((candidate) => candidate !== record);
        this.persist();
        return record;
    }

    deleteByFilm(filmId) {
        const records = this.listByFilm(filmId);
        if (records.length === 0) return [];
        this.state.images = this.state.images.filter((record) => record.filmId !== Number(filmId));
        this.persist();
        return records;
    }
}

module.exports = ImageMetadataRepository;

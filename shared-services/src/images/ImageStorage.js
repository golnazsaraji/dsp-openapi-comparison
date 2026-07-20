const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { validateUpload } = require('./ImageValidation');

class ImageStorage {
    constructor(root = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', '..', 'runtime-data', 'uploaded_files')) {
        this.root = path.resolve(root);
        fs.mkdirSync(this.root, { recursive: true });
    }

    fullPath(storageKey) {
        return path.join(this.root, path.basename(storageKey));
    }

    discardUpload(upload) {
        if (!upload?.storedName) return;
        try {
            fs.unlinkSync(this.fullPath(upload.storedName));
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
        }
    }

    validateAndCommit(upload) {
        if (!upload?.storedName) {
            const error = new Error('Image file is required.');
            error.status = 400;
            throw error;
        }
        const temporaryPath = this.fullPath(upload.storedName);
        const buffer = fs.readFileSync(temporaryPath);
        const format = validateUpload({
            originalName: upload.originalName,
            mimeType: upload.mimeType,
            buffer,
        });
        const storageKey = `${crypto.randomUUID()}${format.extension}`;
        fs.renameSync(temporaryPath, this.fullPath(storageKey));
        return { storageKey, mediaType: format.mediaType, byteSize: buffer.length };
    }

    conversionTemporaryPath(imageId, mediaType) {
        const extension = mediaType === 'image/png' ? '.png' : mediaType === 'image/jpeg' ? '.jpg' : '.gif';
        return this.fullPath(`.conversion-${Number(imageId)}-${crypto.randomUUID()}${extension}.tmp`);
    }

    validateAndCommitConversion(temporaryPath, mediaType) {
        const extension = mediaType === 'image/png' ? '.png' : mediaType === 'image/jpeg' ? '.jpg' : '.gif';
        const buffer = fs.readFileSync(temporaryPath);
        validateUpload({ originalName: `converted${extension}`, mimeType: mediaType, buffer });
        const descriptor = fs.openSync(temporaryPath, 'r');
        try { fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
        const storageKey = `${crypto.randomUUID()}${extension}`;
        const finalPath = this.fullPath(storageKey);
        fs.renameSync(temporaryPath, finalPath);
        return {
            storageKey,
            mediaType,
            byteSize: buffer.length,
            checksum: crypto.createHash('sha256').update(buffer).digest('hex'),
        };
    }

    resolveRepresentation(record, mediaType) {
        const representations = Array.isArray(record?.representations) ? record.representations : [];
        const representation = representations.find((item) => item?.mediaType === mediaType);
        if (!representation?.storageKey) return null;
        const filePath = this.fullPath(representation.storageKey);
        let stats;
        try {
            stats = fs.statSync(filePath);
        } catch (error) {
            if (error.code === 'ENOENT') {
                const storageError = new Error('Stored image representation is unavailable.');
                storageError.status = 500;
                throw storageError;
            }
            throw error;
        }
        if (!stats.isFile()) {
            const storageError = new Error('Stored image representation is unavailable.');
            storageError.status = 500;
            throw storageError;
        }
        return { filePath, mediaType, length: stats.size };
    }

    removeRepresentations(record) {
        const representations = Array.isArray(record?.representations) && record.representations.length > 0
            ? record.representations : [{ storageKey: record?.storageKey }];
        const keys = new Set(representations.map((item) => item?.storageKey).filter(Boolean));
        for (const storageKey of keys) {
            try {
                fs.unlinkSync(this.fullPath(storageKey));
            } catch (error) {
                if (error.code !== 'ENOENT') throw error;
            }
        }
    }
}

module.exports = ImageStorage;

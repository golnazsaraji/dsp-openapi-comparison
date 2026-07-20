const path = require('path');

const FORMATS = {
    '.png': { mediaType: 'image/png', extension: '.png' },
    '.jpg': { mediaType: 'image/jpeg', extension: '.jpg' },
    '.jpeg': { mediaType: 'image/jpeg', extension: '.jpg' },
    '.gif': { mediaType: 'image/gif', extension: '.gif' },
};

const MIME_ALIASES = new Map([
    ['image/png', 'image/png'],
    ['image/jpeg', 'image/jpeg'],
    ['image/jpg', 'image/jpeg'],
    ['image/gif', 'image/gif'],
]);

function validationError(message, status = 400) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function validatePng(buffer) {
    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (buffer.length < 33 || !buffer.subarray(0, 8).equals(signature)) return false;
    if (buffer.toString('ascii', 12, 16) !== 'IHDR') return false;
    let offset = 8;
    let sawIend = false;
    while (offset + 12 <= buffer.length) {
        const length = buffer.readUInt32BE(offset);
        const end = offset + 12 + length;
        if (end > buffer.length) return false;
        const type = buffer.toString('ascii', offset + 4, offset + 8);
        offset = end;
        if (type === 'IEND') {
            sawIend = length === 0 && offset === buffer.length;
            break;
        }
    }
    return sawIend;
}

function validateJpeg(buffer) {
    if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return false;
    if (buffer[buffer.length - 2] !== 0xff || buffer[buffer.length - 1] !== 0xd9) return false;
    let offset = 2;
    let sawFrame = false;
    while (offset < buffer.length - 2) {
        if (buffer[offset] !== 0xff) {
            offset += 1;
            continue;
        }
        const marker = buffer[offset + 1];
        offset += 2;
        if (marker === 0xd9) break;
        if (marker === 0xda) return sawFrame;
        if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
        if (offset + 2 > buffer.length) return false;
        const length = buffer.readUInt16BE(offset);
        if (length < 2 || offset + length > buffer.length) return false;
        if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7)
            || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) sawFrame = true;
        offset += length;
    }
    return sawFrame;
}

function validateGif(buffer) {
    if (buffer.length < 14) return false;
    const header = buffer.toString('ascii', 0, 6);
    return (header === 'GIF87a' || header === 'GIF89a') && buffer[buffer.length - 1] === 0x3b;
}

function validateUpload({ originalName, mimeType, buffer }) {
    if (!originalName || typeof originalName !== 'string') throw validationError('An original image filename is required.');
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw validationError('The uploaded image is empty.');
    const extensionFormat = FORMATS[path.extname(path.basename(originalName)).toLowerCase()];
    if (!extensionFormat) throw validationError('Unsupported image filename extension.', 415);
    const canonicalMime = MIME_ALIASES.get(String(mimeType || '').toLowerCase());
    if (!canonicalMime) throw validationError('Unsupported multipart image media type.', 415);
    if (canonicalMime !== extensionFormat.mediaType) throw validationError('Image filename extension and media type do not match.', 415);
    const valid = canonicalMime === 'image/png' ? validatePng(buffer)
        : canonicalMime === 'image/jpeg' ? validateJpeg(buffer) : validateGif(buffer);
    if (!valid) throw validationError('Uploaded bytes are not a valid image of the declared type.');
    return { mediaType: canonicalMime, extension: extensionFormat.extension };
}

module.exports = { validateUpload, validationError, MAX_UPLOAD_BYTES: 5 * 1024 * 1024 };

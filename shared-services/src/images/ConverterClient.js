const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const PROTO_PATH = path.join(__dirname, '..', '..', 'lab02', 'proto', 'converter.proto');
const CANONICAL = new Map([
    ['image/png', 'image/png'],
    ['image/jpeg', 'image/jpeg'],
    ['image/jpg', 'image/jpeg'],
    ['image/gif', 'image/gif'],
]);

function conversionError(message, status, code) {
    const error = new Error(message);
    error.status = status;
    error.converterCode = code;
    return error;
}

class ConverterClient {
    constructor(options = {}) {
        this.address = options.address || process.env.CONVERTER_GRPC_ADDRESS || 'localhost:50051';
        this.deadlineMs = Number(options.deadlineMs || process.env.CONVERTER_GRPC_DEADLINE_MS || 10000);
        this.chunkSize = Number(options.chunkSize || process.env.IMAGE_CONVERSION_CHUNK_SIZE || 64 * 1024);
        this.maxOutputBytes = Number(options.maxOutputBytes || process.env.IMAGE_MAX_CONVERTED_BYTES || 10 * 1024 * 1024);
        const definition = protoLoader.loadSync(PROTO_PATH, {
            keepCase: false, longs: Number, enums: String, defaults: true, oneofs: true,
        });
        const Converter = grpc.loadPackageDefinition(definition).converter.Converter;
        this.client = options.client || new Converter(this.address, grpc.credentials.createInsecure());
    }

    static canonical(mediaType) {
        return CANONICAL.get(String(mediaType || '').toLowerCase()) || null;
    }

    convert({ sourcePath, sourceMediaType, targetMediaType, outputPath, requestId = crypto.randomUUID() }) {
        const source = ConverterClient.canonical(sourceMediaType);
        const target = ConverterClient.canonical(targetMediaType);
        if (!source || !target || source === target) {
            return Promise.reject(conversionError('Invalid conversion media types.', 422, 'INVALID_MEDIA'));
        }
        return new Promise((resolve, reject) => {
            let settled = false;
            let sawResult = false;
            let outputBytes = 0;
            const deadline = new Date(Date.now() + this.deadlineMs);
            const call = this.client.convert({ deadline });
            const input = fs.createReadStream(sourcePath, { highWaterMark: this.chunkSize });
            const output = fs.createWriteStream(outputPath, { flags: 'wx', mode: 0o600 });

            const cleanup = (error) => {
                if (settled) return;
                settled = true;
                input.destroy();
                output.destroy();
                call.cancel();
                try { fs.unlinkSync(outputPath); } catch (unlinkError) { if (unlinkError.code !== 'ENOENT') error.cleanupError = true; }
                reject(error);
            };
            const succeed = () => {
                if (settled) return;
                settled = true;
                output.end(() => resolve({ requestId, mediaType: target, length: outputBytes, outputPath }));
            };

            output.on('error', (error) => cleanup(conversionError('Unable to persist converted output.', 500, 'LOCAL_WRITE')));
            call.on('data', (message) => {
                if (settled) return;
                if (message.failure) {
                    cleanup(conversionError(message.failure.message || 'Converter rejected the image.', 422, message.failure.code));
                    return;
                }
                if (message.result) {
                    if (sawResult || message.result.requestId !== requestId || message.result.mediaType !== target
                        || Number(message.result.byteLength) !== outputBytes) {
                        cleanup(conversionError('Converter returned malformed terminal metadata.', 502, 'MALFORMED_RESPONSE'));
                        return;
                    }
                    sawResult = true;
                    return;
                }
                if (!message.chunk || sawResult) {
                    cleanup(conversionError('Converter returned malformed response ordering.', 502, 'MALFORMED_RESPONSE'));
                    return;
                }
                outputBytes += message.chunk.length;
                if (outputBytes > this.maxOutputBytes) {
                    cleanup(conversionError('Converted output exceeds the configured limit.', 502, 'OUTPUT_TOO_LARGE'));
                    return;
                }
                if (!output.write(message.chunk)) call.pause();
            });
            output.on('drain', () => call.resume());
            call.on('error', (error) => {
                if (settled || error.code === grpc.status.CANCELLED) return;
                const status = error.code === grpc.status.DEADLINE_EXCEEDED ? 504
                    : error.code === grpc.status.UNAVAILABLE ? 503 : 502;
                cleanup(conversionError(status === 504 ? 'Converter deadline exceeded.'
                    : status === 503 ? 'Converter service is unavailable.' : 'Converter transport failed.', status, 'TRANSPORT'));
            });
            call.on('end', () => {
                if (!settled) {
                    if (!sawResult || outputBytes === 0) cleanup(conversionError('Converter response ended without success metadata.', 502, 'MALFORMED_RESPONSE'));
                    else succeed();
                }
            });
            input.on('error', () => cleanup(conversionError('Stored source representation is unavailable.', 500, 'LOCAL_READ')));
            input.on('data', (chunk) => {
                input.pause();
                if (call.write({ chunk })) input.resume();
                else call.once('drain', () => input.resume());
            });
            input.on('end', () => call.end());
            call.write({ metadata: { sourceMediaType: source, targetMediaType: target, requestId } });
        });
    }
}

module.exports = ConverterClient;

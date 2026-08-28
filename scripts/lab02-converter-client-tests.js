const assert = require('assert');
const { EventEmitter } = require('events');
const fs = require('fs');
const os = require('os');
const path = require('path');
const grpc = require('@grpc/grpc-js');
const ConverterClient = require('../shared-services/src/images/ConverterClient');

class FakeCall extends EventEmitter {
    constructor(mode = 'success') {
        super(); this.mode = mode; this.writes = []; this.paused = false;
    }
    write(message) {
        this.writes.push(message);
        if (message.chunk && this.writes.length === 2) {
            setImmediate(() => this.emit('drain'));
            return false;
        }
        return true;
    }
    pause() { this.paused = true; }
    resume() { this.paused = false; }
    cancel() {}
    end() {
        setImmediate(() => {
            const metadata = this.writes[0].metadata;
            if (this.mode === 'transport') { this.emit('error', { code: grpc.status.UNAVAILABLE }); return; }
            if (this.mode === 'timeout') { this.emit('error', { code: grpc.status.DEADLINE_EXCEEDED }); return; }
            if (this.mode === 'failure') {
                this.emit('data', { failure: { requestId: metadata.requestId, code: 'DECODE', message: 'Cannot decode.' } });
                return;
            }
            const output = this.mode === 'large' ? Buffer.alloc(4096) : Buffer.from('converted-output');
            if (this.mode === 'malformed') {
                this.emit('data', { result: { requestId: metadata.requestId, mediaType: metadata.targetMediaType, byteLength: 0 } });
                this.emit('data', { chunk: output });
            } else {
                this.emit('data', { chunk: output });
                this.emit('data', { result: { requestId: metadata.requestId, mediaType: metadata.targetMediaType, byteLength: output.length } });
            }
            this.emit('end');
        });
    }
}

async function run(mode, options = {}) {
    const call = new FakeCall(mode);
    const client = new ConverterClient({
        client: { convert: () => call },
        chunkSize: options.chunkSize || 1024,
        maxOutputBytes: options.maxOutputBytes || 8192,
        deadlineMs: 50,
    });
    return { call, promise: client.convert(options.request) };
}

(async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsp-converter-client-'));
    const source = path.join(root, 'source.png');
    fs.writeFileSync(source, Buffer.alloc(2500, 7));
    const request = (name) => ({
        sourcePath: source, sourceMediaType: 'image/png', targetMediaType: 'image/jpeg',
        outputPath: path.join(root, name), requestId: name,
    });
    try {
        const success = await run('success', { chunkSize: 1024, request: request('success.jpg') });
        await success.promise;
        assert(success.call.writes[0].metadata, 'metadata must be first');
        const chunks = success.call.writes.slice(1).map((message) => message.chunk);
        assert.deepStrictEqual(chunks.map((chunk) => chunk.length), [1024, 1024, 452]);
        assert.strictEqual(fs.readFileSync(path.join(root, 'success.jpg'), 'utf8'), 'converted-output');

        for (const [mode, status] of [['transport', 503], ['timeout', 504], ['failure', 422], ['malformed', 502]]) {
            const outputPath = path.join(root, `${mode}.jpg`);
            const attempt = await run(mode, { request: { ...request(`${mode}.jpg`), outputPath } });
            await assert.rejects(attempt.promise, (error) => error.status === status);
            assert.strictEqual(fs.existsSync(outputPath), false, `${mode} must remove partial output`);
        }
        const large = await run('large', { maxOutputBytes: 10, request: request('large.jpg') });
        await assert.rejects(large.promise, (error) => error.status === 502);
        assert.strictEqual(fs.existsSync(path.join(root, 'large.jpg')), false);
        console.log('Node Converter client tests passed (metadata-first, chunking, backpressure, errors, limits, cleanup).');
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
})().catch((error) => { console.error(error); process.exitCode = 1; });

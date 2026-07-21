const assert = require('assert');
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const javaRoot = path.join(root, 'shared-services', 'lab03');
const binDir = path.join(javaRoot, 'bin');
const fixtureRoot = path.join(root, 'postman', 'lab02', 'fixtures');
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dsp-lab03-protocol-'));

const NORMAL_PORT = 21001;
const FORCED_INTERNAL_ERROR_PORT = 21002;
const ROGUE_STATUS_PORT = 21003;

const READY_BANNER = 'Converter TCP server listening on port';

function buildServer() {
    fs.rmSync(binDir, { recursive: true, force: true });
    const sources = fs.readdirSync(path.join(javaRoot, 'src', 'main', 'java', 'it', 'polito', 'dsp', 'lab03'))
        .filter((name) => name.endsWith('.java'))
        .map((name) => path.join('src', 'main', 'java', 'it', 'polito', 'dsp', 'lab03', name));
    const build = spawnSync('javac', ['-d', 'bin', ...sources], { cwd: javaRoot, stdio: 'inherit' });
    if (build.error?.code === 'ENOENT') throw new Error('javac is required for npm run test:lab03.');
    assert.strictEqual(build.status, 0, 'Lab03 Java build failed');
}

function waitForServer(proc, label) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`${label} did not start in time.`)), 15000);
        const inspect = (chunk) => {
            if (String(chunk).includes(READY_BANNER)) {
                clearTimeout(timeout);
                resolve();
            }
        };
        proc.stdout.on('data', inspect);
        proc.stderr.on('data', inspect);
        proc.once('exit', (code) => reject(new Error(`${label} exited before startup (code ${code}).`)));
    });
}

function startServer(port, { forceInternalError = false } = {}) {
    const args = [];
    if (forceInternalError) args.push('-Dlab03.forceInternalError=true');
    args.push('-cp', 'bin', 'it.polito.dsp.lab03.ConverterServer', String(port));
    const proc = spawn('java', args, { cwd: javaRoot, stdio: ['ignore', 'pipe', 'pipe'] });
    return proc;
}

function buildRequestHeader(sourceType, targetType, length) {
    const header = Buffer.alloc(10);
    header.write(sourceType, 0, 3, 'ascii');
    header.write(targetType, 3, 3, 'ascii');
    header.writeInt32BE(length, 6);
    return header;
}

// Sends `header` (and optionally `body`) then half-closes the write side, and
// collects everything the peer writes back until it closes the connection —
// this mirrors the protocol's "server closes when it is done" contract.
function sendRaw(port, chunks) {
    return new Promise((resolve, reject) => {
        const socket = net.connect(port, '127.0.0.1');
        const received = [];
        socket.on('data', (chunk) => received.push(chunk));
        socket.on('error', reject);
        socket.on('close', () => resolve(Buffer.concat(received)));
        socket.on('connect', () => {
            for (const chunk of chunks) socket.write(chunk);
            socket.end();
        });
    });
}

function parseResponse(buf) {
    assert(buf.length >= 5, `response too short to contain a valid header (${buf.length} bytes)`);
    const status = String.fromCharCode(buf[0]);
    const length = buf.readInt32BE(1);
    assert.strictEqual(buf.length, 5 + length, 'response length field does not match actual payload size');
    const payload = buf.subarray(5, 5 + length);
    return { status, length, payload };
}

function assertAsciiErrorFraming(response, expectedStatus) {
    assert.strictEqual(response.status, expectedStatus, `expected status '${expectedStatus}', got '${response.status}' (payload: ${response.payload.toString('ascii')})`);
    assert(response.length > 0, 'error message must not be empty');
    assert.strictEqual(response.payload.length, response.length, 'error payload byte length must equal the declared length field');
    for (const byte of response.payload) {
        assert(byte < 128, 'error message must be pure ASCII');
    }
}

function magicMatches(mediaType, bytes) {
    if (mediaType === 'PNG') return bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    if (mediaType === 'JPG') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
    return bytes.subarray(0, 3).toString('ascii') === 'GIF';
}

async function testValidConversion(port, file, sourceType, targetType) {
    const body = fs.readFileSync(path.join(fixtureRoot, file));
    const header = buildRequestHeader(sourceType, targetType, body.length);
    const response = parseResponse(await sendRaw(port, [header, body]));
    assert.strictEqual(response.status, '0', `${sourceType}->${targetType} expected success status`);
    assert.strictEqual(response.payload.length, response.length, `${sourceType}->${targetType} payload length must match framing`);
    assert(response.payload.length > 0, `${sourceType}->${targetType} payload must not be empty`);
    assert(magicMatches(targetType, response.payload), `${sourceType}->${targetType} output must decode as ${targetType}`);
}

async function testWrongRequest(port, description, chunks) {
    const response = parseResponse(await sendRaw(port, chunks));
    assertAsciiErrorFraming(response, '1');
    return response;
}

async function runClientAgainstRogueServer() {
    // A minimal, non-Java TCP peer that speaks just enough of the protocol to
    // let the real ConversionRequestClient send a full request, then replies
    // with a status byte outside {'0','1','2'} to prove the client rejects it.
    const server = net.createServer((socket) => {
        const chunks = [];
        socket.on('data', (chunk) => {
            chunks.push(chunk);
            const total = Buffer.concat(chunks);
            if (total.length >= 10) {
                const declaredLength = total.readInt32BE(6);
                if (total.length >= 10 + declaredLength) {
                    const response = Buffer.alloc(5);
                    response.write('9', 0, 1, 'ascii'); // not 0, 1, or 2
                    response.writeInt32BE(0, 1);
                    socket.end(response);
                }
            }
        });
    });
    await new Promise((resolve) => server.listen(ROGUE_STATUS_PORT, '127.0.0.1', resolve));
    try {
        const sourceImage = path.join(fixtureRoot, 'valid.png');
        // Must use async spawn, not spawnSync: spawnSync blocks Node's event
        // loop for the whole child-process lifetime, which would starve the
        // rogue server's own socket callbacks (self-deadlock) while the
        // client sits waiting for a response.
        const child = spawn('java', [
            '-cp', 'bin', 'it.polito.dsp.lab03.ConversionRequestClient',
            'PNG', 'JPG', sourceImage, '127.0.0.1', String(ROGUE_STATUS_PORT),
        ], { cwd: javaRoot });
        let stderr = '';
        child.stderr.on('data', (chunk) => { stderr += chunk; });
        const exitCode = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('client against rogue server did not exit in time')), 15000);
            child.once('exit', (code) => { clearTimeout(timeout); resolve(code); });
            child.once('error', reject);
        });
        assert.notStrictEqual(exitCode, 0, 'client must exit non-zero for an unknown status byte');
        assert(/malformed/i.test(stderr), `client stderr should report a malformed response, got: ${stderr}`);
    } finally {
        server.close();
    }
}

(async () => {
    buildServer();
    const normalServer = startServer(NORMAL_PORT);
    const forcedErrorServer = startServer(FORCED_INTERNAL_ERROR_PORT, { forceInternalError: true });
    try {
        await Promise.all([
            waitForServer(normalServer, 'Lab03 normal server'),
            waitForServer(forcedErrorServer, 'Lab03 forced-internal-error server'),
        ]);

        // --- valid conversions + success framing (R1/R10/R13 happy path) ---
        await testValidConversion(NORMAL_PORT, 'valid.png', 'PNG', 'JPG');
        await testValidConversion(NORMAL_PORT, 'valid.jpg', 'JPG', 'GIF');
        await testValidConversion(NORMAL_PORT, 'valid.gif', 'GIF', 'PNG');

        // --- wrong-request taxonomy: all must be status '1' with correct ASCII framing ---
        const pngBody = fs.readFileSync(path.join(fixtureRoot, 'valid.png'));
        const jpgBody = fs.readFileSync(path.join(fixtureRoot, 'valid.jpg'));

        await testWrongRequest(NORMAL_PORT, 'unsupported source type', [
            buildRequestHeader('BMP', 'PNG', pngBody.length), pngBody,
        ]);
        await testWrongRequest(NORMAL_PORT, 'unsupported target type', [
            buildRequestHeader('PNG', 'BMP', pngBody.length), pngBody,
        ]);
        await testWrongRequest(NORMAL_PORT, 'declared type does not match actual content', [
            buildRequestHeader('PNG', 'JPG', jpgBody.length), jpgBody,
        ]);
        await testWrongRequest(NORMAL_PORT, 'malformed image bytes', [
            buildRequestHeader('PNG', 'JPG', 13), Buffer.from('not an image'),
        ]);
        await testWrongRequest(NORMAL_PORT, 'empty image payload', [
            buildRequestHeader('PNG', 'JPG', 0),
        ]);
        await testWrongRequest(NORMAL_PORT, 'zero length', [
            buildRequestHeader('PNG', 'JPG', 0),
        ]);
        await testWrongRequest(NORMAL_PORT, 'negative length', [
            buildRequestHeader('PNG', 'JPG', -5),
        ]);
        await testWrongRequest(NORMAL_PORT, 'oversized length', [
            buildRequestHeader('PNG', 'JPG', 100 * 1024 * 1024),
        ]);
        await testWrongRequest(NORMAL_PORT, 'truncated body', [
            buildRequestHeader('PNG', 'JPG', pngBody.length), pngBody.subarray(0, 10),
        ]);
        await testWrongRequest(NORMAL_PORT, 'truncated metadata', [
            Buffer.from('PN', 'ascii'),
        ]);

        // --- server remains usable after every wrong request above ---
        await testValidConversion(NORMAL_PORT, 'valid.png', 'PNG', 'GIF');

        // --- status '2' framing via the deterministic forced-failure seam (R13) ---
        const forcedResponse = parseResponse(await sendRaw(FORCED_INTERNAL_ERROR_PORT, [
            buildRequestHeader('PNG', 'JPG', pngBody.length), pngBody,
        ]));
        assertAsciiErrorFraming(forcedResponse, '2');

        // --- client rejects unknown status bytes (R15) ---
        await runClientAgainstRogueServer();

        console.log('Lab03 protocol tests passed (framing, error taxonomy, content-type validation, forced status-2, client status rejection).');
    } finally {
        normalServer.kill('SIGTERM');
        forcedErrorServer.kill('SIGTERM');
        fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
})().catch((error) => { console.error(error); process.exitCode = 1; });

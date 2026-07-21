const assert = require('assert');
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const javaRoot = path.join(root, 'shared-services', 'lab03');
const binDir = path.join(javaRoot, 'bin');
const binTestDir = path.join(javaRoot, 'bin-test');
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dsp-lab03-matrix-'));

// Must track ConversionProtocol.MAX_IMAGE_BYTES (shared-services/lab03/src/main/java/it/polito/dsp/lab03/ConversionProtocol.java).
const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const TEN_MEBIBYTES = 10 * 1024 * 1024;

const READY_PATTERN = /listening on port (\d+)/;
const runningServers = [];

function buildMain() {
    fs.rmSync(binDir, { recursive: true, force: true });
    const sources = fs.readdirSync(path.join(javaRoot, 'src', 'main', 'java', 'it', 'polito', 'dsp', 'lab03'))
        .filter((name) => name.endsWith('.java'))
        .map((name) => path.join('src', 'main', 'java', 'it', 'polito', 'dsp', 'lab03', name));
    const build = spawnSync('javac', ['-d', 'bin', ...sources], { cwd: javaRoot, stdio: 'inherit' });
    if (build.error?.code === 'ENOENT') throw new Error('javac is required for npm run test:lab03.');
    assert.strictEqual(build.status, 0, 'Lab03 Java build failed');
}

function buildTestTools() {
    fs.rmSync(binTestDir, { recursive: true, force: true });
    const sources = fs.readdirSync(path.join(javaRoot, 'src', 'test', 'java', 'it', 'polito', 'dsp', 'lab03'))
        .filter((name) => name.endsWith('.java'))
        .map((name) => path.join('src', 'test', 'java', 'it', 'polito', 'dsp', 'lab03', name));
    const build = spawnSync('javac', ['-d', 'bin-test', ...sources], { cwd: javaRoot, stdio: 'inherit' });
    assert.strictEqual(build.status, 0, 'Lab03 test-tool build failed');
}

function generateFixture(format, width, height, fileName) {
    const outputPath = path.join(temporaryRoot, fileName);
    const result = spawnSync('java', ['-cp', 'bin-test', 'it.polito.dsp.lab03.FixtureGenerator', format, String(width), String(height), outputPath], {
        cwd: javaRoot, encoding: 'utf8',
    });
    assert.strictEqual(result.status, 0, `fixture generation failed for ${fileName}: ${result.stderr}`);
    return outputPath;
}

function inspectImage(filePath) {
    const result = spawnSync('java', ['-cp', 'bin-test', 'it.polito.dsp.lab03.ImageInspector', filePath], {
        cwd: javaRoot, encoding: 'utf8',
    });
    assert.strictEqual(result.status, 0, `image inspection failed for ${filePath}: ${result.stderr}`);
    const fields = {};
    for (const match of result.stdout.matchAll(/(\w+)=(\S+)/g)) {
        fields[match[1]] = match[2];
    }
    return {
        format: fields.format,
        width: fields.width ? Number(fields.width) : undefined,
        height: fields.height ? Number(fields.height) : undefined,
        distinctColors: fields.distinctColors ? Number(fields.distinctColors) : undefined,
        bytes: fields.bytes ? Number(fields.bytes) : undefined,
    };
}

function normalizeType(rawFormat) {
    const upper = (rawFormat || '').toUpperCase();
    return upper === 'JPEG' ? 'JPG' : upper;
}

// Starts a server on an OS-assigned port by default (portArg="0"); pass
// portArg=null to omit the CLI port argument entirely (default-port test).
function startServer(javaOptions = [], portArg = '0') {
    const args = [...javaOptions, '-cp', 'bin', 'it.polito.dsp.lab03.ConverterServer'];
    if (portArg !== null) args.push(portArg);
    const proc = spawn('java', args, { cwd: javaRoot, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdoutBuffer = '';
    let stderrBuffer = '';
    proc.stdout.on('data', (chunk) => { stdoutBuffer += chunk; });
    proc.stderr.on('data', (chunk) => { stderrBuffer += chunk; });

    const portPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`server did not report readiness in time. stderr: ${stderrBuffer}`)), 15000);
        const check = () => {
            const match = stdoutBuffer.match(READY_PATTERN);
            if (match) {
                clearTimeout(timeout);
                resolve(Number(match[1]));
            }
        };
        proc.stdout.on('data', check);
        proc.once('exit', (code) => reject(new Error(`server exited before startup (code ${code}). stderr: ${stderrBuffer}`)));
    });

    const server = { proc, portPromise, getStderr: () => stderrBuffer, exited: false };
    proc.once('exit', () => { server.exited = true; });
    runningServers.push(server);
    return server;
}

function stopServerCleanly(server, { timeoutMs = 5000 } = {}) {
    return new Promise((resolve) => {
        if (server.exited) { resolve({ forced: false }); return; }
        let forced = false;
        const timeout = setTimeout(() => {
            forced = true;
            server.proc.kill('SIGKILL');
        }, timeoutMs);
        server.proc.once('exit', () => {
            clearTimeout(timeout);
            resolve({ forced });
        });
        server.proc.kill('SIGTERM');
    });
}

// Probes with no explicit host so the check binds the wildcard address, the
// same way ConverterServer's own `new ServerSocket(port)` does. Probing only
// '127.0.0.1' can miss a competing process already holding the wildcard bind
// (observed in practice: a dual-stack wildcard listener does not always
// prevent a *separate* 127.0.0.1-only bind from succeeding), which would
// wrongly report the port as free.
function isPortFree(port) {
    return new Promise((resolve) => {
        const probe = net.createServer();
        probe.once('error', () => resolve(false));
        probe.listen(port, () => probe.close(() => resolve(true)));
    });
}

function buildRequestHeader(sourceType, targetType, length) {
    const header = Buffer.alloc(10);
    header.write(sourceType, 0, 3, 'ascii');
    header.write(targetType, 3, 3, 'ascii');
    header.writeInt32BE(length, 6);
    return header;
}

function encodeBigEndianInt32(value) {
    return Buffer.from([(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]);
}

function decodeBigEndianInt32(bytes, offset) {
    return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

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
    assert.strictEqual(buf.length, 5 + length, 'declared response length must equal the exact received payload length');
    const payload = buf.subarray(5, 5 + length);
    return { status, length, payload };
}

async function convert(port, sourcePath, sourceType, targetType) {
    const body = fs.readFileSync(sourcePath);
    const header = buildRequestHeader(sourceType, targetType, body.length);
    const start = Date.now();
    const raw = await sendRaw(port, [header, body]);
    const elapsedMs = Date.now() - start;
    const response = parseResponse(raw);
    return { response, sourceBytes: body, elapsedMs };
}

async function assertServerRecovers(port, label) {
    const pngPath = generateFixture('png', 32, 24, `recovery-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);
    const { response } = await convert(port, pngPath, 'PNG', 'JPG');
    assert.strictEqual(response.status, '0', `server did not recover after ${label}`);
}

let checks = 0;
const conversionResults = [];

(async () => {
    buildMain();
    buildTestTools();

    const main = startServer([]);
    const mainPort = await main.portPromise;
    assert(Number.isInteger(mainPort) && mainPort > 0, 'server must report a valid bound port');
    checks++;

    try {
        // --- small, distinct source fixtures for the conversion matrix ---
        const pngSource = generateFixture('png', 64, 48, 'source.png');
        const jpgSource = generateFixture('jpg', 64, 48, 'source.jpg');
        const gifSource = generateFixture('gif', 64, 48, 'source.gif');
        const sourcesByType = { PNG: pngSource, JPG: jpgSource, GIF: gifSource };

        // --- full conversion matrix: 6 required cross-format pairs + 3 same-format pairs ---
        const pairs = [
            ['PNG', 'JPG'], ['PNG', 'GIF'],
            ['JPG', 'PNG'], ['JPG', 'GIF'],
            ['GIF', 'PNG'], ['GIF', 'JPG'],
            ['PNG', 'PNG'], ['JPG', 'JPG'], ['GIF', 'GIF'],
        ];
        for (const [sourceType, targetType] of pairs) {
            const { response, sourceBytes } = await convert(mainPort, sourcesByType[sourceType], sourceType, targetType);
            assert.strictEqual(response.status, '0', `${sourceType}->${targetType}: expected success status, got '${response.status}' (${response.payload.toString('ascii')})`);
            assert.strictEqual(response.payload.length, response.length, `${sourceType}->${targetType}: payload length must equal the declared response length`);
            assert(response.payload.length > 0, `${sourceType}->${targetType}: payload must not be empty`);

            const outputPath = path.join(temporaryRoot, `matrix-${sourceType}-to-${targetType}.bin`);
            fs.writeFileSync(outputPath, response.payload);
            const inspected = inspectImage(outputPath);
            assert.strictEqual(normalizeType(inspected.format), targetType, `${sourceType}->${targetType}: actual decoded format must be ${targetType}, got ${inspected.format}`);
            assert.strictEqual(inspected.width, 64, `${sourceType}->${targetType}: width must be preserved`);
            assert.strictEqual(inspected.height, 48, `${sourceType}->${targetType}: height must be preserved`);
            assert(inspected.distinctColors >= 20, `${sourceType}->${targetType}: output must have real (non-blank) content, got ${inspected.distinctColors} distinct sampled colors`);

            if (sourceType !== targetType) {
                assert(!response.payload.equals(sourceBytes), `${sourceType}->${targetType}: cross-format output must not be a copy of the source bytes`);
            }

            conversionResults.push({ sourceType, targetType, inputBytes: sourceBytes.length, outputBytes: response.payload.length, distinctColors: inspected.distinctColors });
            checks++;
        }

        // --- explicit big-endian framing assertion (R3) ---
        {
            const lengthBytes = encodeBigEndianInt32(300);
            assert.deepStrictEqual([...lengthBytes], [0x00, 0x00, 0x01, 0x2c], 'hand-rolled big-endian encoding of 300 must be 00 00 01 2C');

            const body = fs.readFileSync(pngSource);
            const header = Buffer.alloc(10);
            header.write('PNG', 0, 3, 'ascii');
            header.write('JPG', 3, 3, 'ascii');
            encodeBigEndianInt32(body.length).copy(header, 6);
            const raw = await sendRaw(mainPort, [header, body]);
            const status = String.fromCharCode(raw[0]);
            const decodedLength = decodeBigEndianInt32(raw, 1);
            assert.strictEqual(status, '0', 'hand-framed big-endian request must be accepted and converted');
            assert.strictEqual(decodedLength, raw.readInt32BE(1), 'hand-rolled big-endian decode must agree with Buffer.readInt32BE');
            assert.strictEqual(raw.length, 5 + decodedLength, 'response body must contain exactly the declared number of bytes, per the decoded big-endian length');
            checks++;
        }

        // --- ~10 MiB large-file transfer ---
        let largeInputBytes;
        let largeOutputBytes;
        let largeElapsedMs;
        {
            const largeSourcePath = generateFixture('png', 2000, 2000, 'large-source.png');
            largeInputBytes = fs.statSync(largeSourcePath).size;
            assert(largeInputBytes >= TEN_MEBIBYTES, `generated large fixture must measure at least 10 MiB, measured ${largeInputBytes} bytes`);
            assert(largeInputBytes < MAX_IMAGE_BYTES, `generated large fixture must stay below the configured maximum, measured ${largeInputBytes} bytes`);

            const { response, elapsedMs } = await convert(mainPort, largeSourcePath, 'PNG', 'JPG');
            largeElapsedMs = elapsedMs;
            assert.strictEqual(response.status, '0', `large-file conversion must succeed, got status '${response.status}'`);
            assert.strictEqual(response.payload.length, response.length, 'large-file response payload length must match the declared length exactly');
            largeOutputBytes = response.payload.length;

            const outputPath = path.join(temporaryRoot, 'large-output.jpg');
            fs.writeFileSync(outputPath, response.payload);
            const inspected = inspectImage(outputPath);
            assert.strictEqual(normalizeType(inspected.format), 'JPG', 'large-file output must actually decode as JPG');
            assert.strictEqual(inspected.width, 2000, 'large-file output width must be preserved');
            assert.strictEqual(inspected.height, 2000, 'large-file output height must be preserved');

            // Server must be immediately responsive after handling the large request.
            await assertServerRecovers(mainPort, 'the large-file transfer');
            checks++;
        }

        // --- maximum-size boundary: one byte above the max, rejected without transmitting a body ---
        {
            const header = buildRequestHeader('PNG', 'JPG', MAX_IMAGE_BYTES + 1);
            const raw = await sendRaw(mainPort, [header]); // header only: no body is ever sent or allocated
            const response = parseResponse(raw);
            assert.strictEqual(response.status, '1', 'a declared length one byte above the maximum must be rejected as a wrong request');
            await assertServerRecovers(mainPort, 'an oversized declared length');
            checks++;
        }

        // --- default port 2001 binding check (R1), environment-permitting ---
        {
            const free = await isPortFree(2001);
            if (free) {
                const defaultServer = startServer([], null); // no port arg -> must use ConversionProtocol.DEFAULT_PORT
                const boundPort = await defaultServer.portPromise;
                assert.strictEqual(boundPort, 2001, 'default CLI invocation (no port argument) must bind to port 2001');
                await assertServerRecovers(2001, 'the default-port server (sanity conversion)');
                await stopServerCleanly(defaultServer);
                console.log('Default port 2001 binding check: PASS (bound and converted successfully).');
                checks++;
            } else {
                console.log('Default port 2001 binding check: SKIPPED (port 2001 is already in use by an unrelated local process; not killed, not treated as a failure).');
            }
        }

        // --- final recovery check across the whole battery ---
        await assertServerRecovers(mainPort, 'the full Phase 4 battery');
        checks++;

        console.log(`Lab03 large-file and conversion-matrix tests passed (${checks} scenarios).`);
        console.log('Conversion matrix results:');
        for (const result of conversionResults) {
            console.log(`  ${result.sourceType} -> ${result.targetType}: input=${result.inputBytes}B output=${result.outputBytes}B distinctColors=${result.distinctColors}`);
        }
        console.log(`Large-file transfer: input=${largeInputBytes}B (${(largeInputBytes / 1024 / 1024).toFixed(2)} MiB), output=${largeOutputBytes}B, elapsed=${largeElapsedMs}ms (diagnostic only, no threshold asserted).`);
    } finally {
        for (const server of runningServers) {
            if (!server.exited) {
                await stopServerCleanly(server, { timeoutMs: 3000 });
            }
        }
        fs.rmSync(temporaryRoot, { recursive: true, force: true });
        fs.rmSync(binTestDir, { recursive: true, force: true });
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
    for (const server of runningServers) {
        if (!server.exited) server.proc.kill('SIGKILL');
    }
});

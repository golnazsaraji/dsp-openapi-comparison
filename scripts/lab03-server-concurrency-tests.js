const assert = require('assert');
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const javaRoot = path.join(root, 'shared-services', 'lab03');
const fixtureRoot = path.join(root, 'postman', 'lab02', 'fixtures');
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dsp-lab03-concurrency-'));

const READY_PATTERN = /listening on port (\d+)/;
const runningServers = [];

function buildServer() {
    const binDir = path.join(javaRoot, 'bin');
    fs.rmSync(binDir, { recursive: true, force: true });
    const sources = fs.readdirSync(path.join(javaRoot, 'src', 'main', 'java', 'it', 'polito', 'dsp', 'lab03'))
        .filter((name) => name.endsWith('.java'))
        .map((name) => path.join('src', 'main', 'java', 'it', 'polito', 'dsp', 'lab03', name));
    const build = spawnSync('javac', ['-d', 'bin', ...sources], { cwd: javaRoot, stdio: 'inherit' });
    if (build.error?.code === 'ENOENT') throw new Error('javac is required for npm run test:lab03.');
    assert.strictEqual(build.status, 0, 'Lab03 Java build failed');
}

// Starts a server on an OS-assigned port (arg "0"): the port is read back
// from the server's own readiness line, eliminating the probe-then-bind race
// a separately-discovered "free port" would have.
function startServer(javaOptions = []) {
    const proc = spawn('java', [...javaOptions, '-cp', 'bin', 'it.polito.dsp.lab03.ConverterServer', '0'], {
        cwd: javaRoot, stdio: ['ignore', 'pipe', 'pipe'],
    });
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

    function waitForMarkerCount(marker, targetCount, timeoutMs = 8000) {
        const needle = `[lab03] ${marker}`;
        const countNow = () => stdoutBuffer.split(needle).length - 1;
        if (countNow() >= targetCount) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(
                () => reject(new Error(`timed out waiting for ${targetCount}x "${marker}" (have ${countNow()})`)),
                timeoutMs,
            );
            const onData = () => {
                if (countNow() >= targetCount) {
                    clearTimeout(timeout);
                    proc.stdout.removeListener('data', onData);
                    resolve();
                }
            };
            proc.stdout.on('data', onData);
        });
    }

    const server = { proc, portPromise, waitForMarkerCount, getStderr: () => stderrBuffer, exited: false };
    proc.once('exit', () => { server.exited = true; });
    runningServers.push(server);
    return server;
}

// Sends SIGTERM and asserts the process exits cleanly on its own (via the
// server's shutdown hook) rather than needing a forced SIGKILL fallback.
function stopServerCleanly(server, { timeoutMs = 5000 } = {}) {
    return new Promise((resolve, reject) => {
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

function buildRequestHeader(sourceType, targetType, length) {
    const header = Buffer.alloc(10);
    header.write(sourceType, 0, 3, 'ascii');
    header.write(targetType, 3, 3, 'ascii');
    header.writeInt32BE(length, 6);
    return header;
}

function sendRaw(port, chunks, { holdOpenMs } = {}) {
    return new Promise((resolve, reject) => {
        const socket = net.connect(port, '127.0.0.1');
        const received = [];
        socket.on('data', (chunk) => received.push(chunk));
        socket.on('error', reject);
        socket.on('close', () => resolve(Buffer.concat(received)));
        socket.on('connect', () => {
            for (const chunk of chunks) socket.write(chunk);
            if (holdOpenMs) {
                setTimeout(() => socket.end(), holdOpenMs);
            } else {
                socket.end();
            }
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

function magicMatches(mediaType, bytes) {
    if (mediaType === 'PNG') return bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    if (mediaType === 'JPG') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
    return bytes.subarray(0, 3).toString('ascii') === 'GIF';
}

async function runValidConversion(port, fixture, sourceType, targetType) {
    const body = fs.readFileSync(path.join(fixtureRoot, fixture));
    const header = buildRequestHeader(sourceType, targetType, body.length);
    const response = parseResponse(await sendRaw(port, [header, body]));
    assert.strictEqual(response.status, '0', `${fixture} ${sourceType}->${targetType}: expected success, got status '${response.status}' (${response.payload.toString('ascii')})`);
    assert(magicMatches(targetType, response.payload), `${fixture} ${sourceType}->${targetType}: output must decode as ${targetType}`);
    return response;
}

async function assertServerRecovers(port, label) {
    await runValidConversion(port, 'valid.png', 'PNG', 'JPG').catch((error) => {
        throw new Error(`server did not recover after ${label}: ${error.message}`);
    });
}

// A raw socket that connects, writes some bytes (possibly none), and then
// disconnects immediately (FIN) — used for every disconnect-during-X scenario.
function openAndAbandon(port, bytesToSend) {
    return new Promise((resolve, reject) => {
        const socket = net.connect(port, '127.0.0.1');
        socket.on('error', reject);
        socket.on('connect', () => {
            if (bytesToSend && bytesToSend.length) socket.write(bytesToSend);
            socket.end();
            resolve();
        });
    });
}

// Connects and then does nothing at all — never writes, never ends — so the
// only way this connection ever closes is the server's own SO_TIMEOUT firing.
function stallUntilServerCloses(port) {
    return new Promise((resolve, reject) => {
        const socket = net.connect(port, '127.0.0.1');
        const chunks = [];
        socket.on('data', (chunk) => chunks.push(chunk));
        socket.on('error', reject);
        socket.on('close', () => resolve(Buffer.concat(chunks)));
    });
}

let checks = 0;

(async () => {
    buildServer();

    // --- server startup and readiness ---
    const main = startServer(['-Dlab03.socketTimeoutMs=1500', '-Dlab03.debugLogging=true']);
    const mainPort = await main.portPromise;
    assert(Number.isInteger(mainPort) && mainPort > 0, 'server must report a valid bound port');
    checks++;

    try {
        // --- 5+ simultaneous valid clients, distinct formats/payloads ---
        {
            const cases = [
                ['valid.png', 'PNG', 'JPG'],
                ['valid.jpg', 'JPG', 'GIF'],
                ['valid.gif', 'GIF', 'PNG'],
                ['valid.png', 'PNG', 'GIF'],
                ['valid.jpg', 'JPG', 'PNG'],
                ['valid.gif', 'GIF', 'JPG'],
            ];
            await Promise.all(cases.map(([fixture, source, target]) => runValidConversion(mainPort, fixture, source, target)));
            checks++;
        }

        // --- malformed client concurrent with valid clients ---
        {
            const malformed = sendRaw(mainPort, [buildRequestHeader('BMP', 'PNG', 4), Buffer.from('xxxx')])
                .then(parseResponse)
                .then((response) => assert.strictEqual(response.status, '1', 'malformed concurrent request must get status 1'));
            const valids = Promise.all([
                runValidConversion(mainPort, 'valid.png', 'PNG', 'JPG'),
                runValidConversion(mainPort, 'valid.jpg', 'JPG', 'GIF'),
                runValidConversion(mainPort, 'valid.gif', 'GIF', 'PNG'),
            ]);
            await Promise.all([malformed, valids]);
            checks++;
        }

        // --- stalled client does not block valid concurrent clients ---
        {
            const stalledSocket = net.connect(mainPort, '127.0.0.1');
            await new Promise((resolve, reject) => {
                stalledSocket.once('connect', resolve);
                stalledSocket.once('error', reject);
            });
            stalledSocket.write(Buffer.from('PN')); // partial metadata, then just holds the connection
            const valids = await Promise.all([
                runValidConversion(mainPort, 'valid.png', 'PNG', 'JPG'),
                runValidConversion(mainPort, 'valid.jpg', 'JPG', 'GIF'),
                runValidConversion(mainPort, 'valid.gif', 'GIF', 'PNG'),
            ]);
            assert.strictEqual(valids.length, 3, 'all concurrent valid requests must complete while one client is stalled');
            stalledSocket.destroy();
            checks++;
        }

        // --- interruption scenarios: each is followed by proof the server still accepts a valid request ---
        const interruptionScenarios = [
            ['disconnect before any bytes', Buffer.alloc(0)],
            ['disconnect after one byte of original type', Buffer.from('P')],
            ['disconnect after two bytes of original type', Buffer.from('PN')],
            ['disconnect after original type but before target type completes', Buffer.from('PNGJ')],
            ['disconnect after metadata but before length completes', Buffer.concat([Buffer.from('PNGJPG'), Buffer.from([0, 0])])],
            ['disconnect after declaring a body length but sending no body', buildRequestHeader('PNG', 'JPG', 100)],
            ['disconnect after sending only part of the body', Buffer.concat([buildRequestHeader('PNG', 'JPG', 1000), Buffer.alloc(20, 0x41)])],
        ];
        for (const [label, bytes] of interruptionScenarios) {
            await openAndAbandon(mainPort, bytes);
            await assertServerRecovers(mainPort, label);
            checks++;
        }

        // --- request stalls until server read timeout, then server recovers ---
        {
            const stallResponse = parseResponse(await stallUntilServerCloses(mainPort));
            assert.strictEqual(stallResponse.status, '1', 'a stalled request must time out as a wrong request, not hang forever');
            await assertServerRecovers(mainPort, 'read timeout');
            checks++;
        }

        // --- invalid request followed by a valid request ---
        {
            const badRequest = parseResponse(await sendRaw(mainPort, [buildRequestHeader('BMP', 'PNG', 4), Buffer.from('xxxx')]));
            assert.strictEqual(badRequest.status, '1');
            await assertServerRecovers(mainPort, 'invalid request');
            checks++;
        }

        // --- deterministic internal-error request followed by another, on a dedicated forced-failure server ---
        {
            const forcedErrorServer = startServer(['-Dlab03.forceInternalError=true', '-Dlab03.socketTimeoutMs=1500']);
            const forcedPort = await forcedErrorServer.portPromise;
            try {
                const pngBody = fs.readFileSync(path.join(fixtureRoot, 'valid.png'));
                const first = parseResponse(await sendRaw(forcedPort, [buildRequestHeader('PNG', 'JPG', pngBody.length), pngBody]));
                assert.strictEqual(first.status, '2', 'forced-failure server must report status 2');
                const second = parseResponse(await sendRaw(forcedPort, [buildRequestHeader('PNG', 'JPG', pngBody.length), pngBody]));
                assert.strictEqual(second.status, '2', 'forced-failure server must keep responding correctly after a prior internal error');
                checks++;
            } finally {
                await stopServerCleanly(forcedErrorServer);
            }
        }

        // --- bounded worker configuration + queue saturation + rejection + recovery ---
        {
            const bounded = startServer([
                '-Dlab03.workerThreads=1', '-Dlab03.queueCapacity=1',
                '-Dlab03.socketTimeoutMs=1200', '-Dlab03.debugLogging=true',
            ]);
            const boundedPort = await bounded.portPromise;
            try {
                // Client A: connects and stalls, occupying the sole worker thread.
                const stalledA = net.connect(boundedPort, '127.0.0.1');
                const stalledAResponse = new Promise((resolve, reject) => {
                    const chunks = [];
                    stalledA.on('data', (chunk) => chunks.push(chunk));
                    stalledA.on('close', () => resolve(Buffer.concat(chunks)));
                    stalledA.on('error', reject);
                });
                await new Promise((resolve, reject) => {
                    stalledA.once('connect', resolve);
                    stalledA.once('error', reject);
                });
                await bounded.waitForMarkerCount('worker-started', 1);

                // Client B: a full valid request, accepted into the bounded queue (capacity 1) behind A.
                const pngBody = fs.readFileSync(path.join(fixtureRoot, 'valid.png'));
                const bResponsePromise = sendRaw(boundedPort, [buildRequestHeader('PNG', 'JPG', pngBody.length), pngBody]).then(parseResponse);
                await bounded.waitForMarkerCount('worker-queued', 2);

                // Client C: pool full + queue full -> must be rejected and closed promptly.
                const cStart = Date.now();
                const cBytes = await sendRaw(boundedPort, [buildRequestHeader('PNG', 'JPG', pngBody.length), pngBody]);
                const cDurationMs = Date.now() - cStart;
                await bounded.waitForMarkerCount('worker-rejected', 1);
                assert.strictEqual(cBytes.length, 0, 'a rejected connection must receive no response bytes');
                assert(cDurationMs < 1000, `a rejected connection must close promptly, took ${cDurationMs}ms`);

                // A's stall times out server-side (socketTimeoutMs=1200ms), freeing the worker for the queued B request.
                const aResponse = parseResponse(await stalledAResponse);
                assert.strictEqual(aResponse.status, '1', 'the stalled client must eventually get a timeout wrong-request response');

                const bResponse = await bResponsePromise;
                assert.strictEqual(bResponse.status, '0', 'the queued request must succeed once capacity clears');
                assert(magicMatches('JPG', bResponse.payload), 'the queued request output must decode as JPG');

                // A brand-new client after the saturation episode must also succeed.
                await runValidConversion(boundedPort, 'valid.gif', 'GIF', 'PNG');
                checks++;
            } finally {
                await stopServerCleanly(bounded);
            }
        }

        // --- invalid worker/queue configuration fails clearly and quickly at startup ---
        {
            const start = Date.now();
            const badConfig = spawnSync('java', [
                '-Dlab03.workerThreads=notanumber', '-cp', 'bin', 'it.polito.dsp.lab03.ConverterServer', '0',
            ], { cwd: javaRoot, encoding: 'utf8', timeout: 8000 });
            const durationMs = Date.now() - start;
            assert.notStrictEqual(badConfig.status, 0, 'invalid worker-thread configuration must fail at startup');
            assert(/lab03\.workerThreads/.test(badConfig.stderr), `expected a clear config error, got: ${badConfig.stderr}`);
            assert(durationMs < 5000, `invalid configuration must fail fast, took ${durationMs}ms`);
            checks++;
        }

        // --- image/ path fallback: client resolves a bare name via ./image/<name> ---
        {
            const workDir = fs.mkdtempSync(path.join(temporaryRoot, 'image-fallback-'));
            const imageDir = path.join(workDir, 'image');
            fs.mkdirSync(imageDir);
            fs.copyFileSync(path.join(fixtureRoot, 'valid.png'), path.join(imageDir, 'fallback.png'));

            const clientResult = spawnSync('java', [
                '-cp', path.join(javaRoot, 'bin'), 'it.polito.dsp.lab03.ConversionRequestClient',
                'PNG', 'JPG', 'fallback.png', '127.0.0.1', String(mainPort),
            ], { cwd: workDir, encoding: 'utf8', timeout: 10000 });
            assert.strictEqual(clientResult.status, 0, `image/ fallback invocation must succeed: ${clientResult.stderr}`);
            const outputPath = path.join(imageDir, 'fallback_converted.jpg');
            assert(fs.existsSync(outputPath), 'image/ fallback must produce a converted output file inside image/');
            assert(magicMatches('JPG', fs.readFileSync(outputPath)), 'image/ fallback output must decode as JPG');
            checks++;
        }

        // --- server still usable after the entire battery of failures above ---
        await assertServerRecovers(mainPort, 'the full failure battery');
        checks++;

        console.log(`Lab03 server concurrency tests passed (${checks} scenarios: concurrency, isolation, interruption recovery, bounded executor, queue rejection, image/ fallback).`);
    } finally {
        // --- clean shutdown check (main server) ---
        const { forced } = await stopServerCleanly(main);
        assert.strictEqual(forced, false, 'main server must shut down cleanly on SIGTERM without needing SIGKILL');
        for (const server of runningServers) {
            if (!server.exited) {
                await stopServerCleanly(server, { timeoutMs: 3000 });
            }
        }
        fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
    for (const server of runningServers) {
        if (!server.exited) server.proc.kill('SIGKILL');
    }
});

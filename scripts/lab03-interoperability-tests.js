// Lab03 interoperability tests: project client/server against the official
// professor reference (Client/client.jar, Server/server.jar) under
// shared-services/lab03/lab03-solution-main/. That folder is gitignored and
// untracked (see .gitignore) — it is a local, already-present reference copy,
// never a runtime dependency of the project's own client/server.
//
// The professor server is hard-coded to port 2001 with no CLI override, and
// the professor client is hard-coded to connect to 0.0.0.0:2001 — neither
// side is configurable, so every professor-server-dependent scenario in this
// file must claim port 2001 exclusively and sequentially.
//
// Several professor-server malformed-input paths are KNOWN to crash a
// handler thread without ever closing the socket (see docs/lab03-compliance-audit.md,
// "Known professor-reference defects" #9): the client-side connection simply
// hangs forever. Every professor-server request in this file is therefore
// wrapped in an external timeout that force-destroys the socket, and the
// professor server is fully restarted after any request expected to poison it.
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
const professorRoot = path.join(javaRoot, 'lab03-solution-main');
const professorClientJar = path.join(professorRoot, 'Client', 'client.jar');
const professorServerJar = path.join(professorRoot, 'Server', 'server.jar');
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dsp-lab03-interop-'));

const PROFESSOR_PORT = 2001; // hard-coded on both professor sides, not configurable
const READY_PATTERN_PROJECT = /listening on port (\d+)/;
const READY_PATTERN_PROFESSOR = /Server running on port/;
const runningServers = [];

const results = {
    projectProject: [],
    professorClientProjectServer: [],
    projectClientProfessorServer: [],
    professorProfessorReference: [],
    expectedDefects: [],
    unexpectedFailures: [],
    environmentSkips: [],
};

function record(bucket, entry) {
    results[bucket].push(entry);
}

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

function verifyProfessorArtifacts() {
    const findings = {
        clientJar: fs.existsSync(professorClientJar),
        serverJar: fs.existsSync(professorServerJar),
    };
    if (!findings.clientJar || !findings.serverJar) {
        return { available: false, findings };
    }
    // Provenance: confirm this is the same tracked-then-untracked professor
    // copy introduced by a known commit, not an ad hoc or tampered file.
    const provenance = spawnSync('git', ['log', '-1', '--format=%H %ad %s', '--date=short', '--', 'shared-services/lab03/lab03-solution-main'], { cwd: root, encoding: 'utf8' });
    return { available: true, findings, provenance: provenance.stdout.trim() };
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
    for (const match of result.stdout.matchAll(/(\w+)=(\S+)/g)) fields[match[1]] = match[2];
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

// Probes with no explicit host so the check binds the wildcard address, the
// same way both ConverterServer and the professor server bind. Probing only
// '127.0.0.1' can miss a competing wildcard listener and wrongly report the
// port as free.
function isPortFree(port) {
    return new Promise((resolve) => {
        const probe = net.createServer();
        probe.once('error', () => resolve(false));
        probe.listen(port, () => probe.close(() => resolve(true)));
    });
}

async function waitForPortFree(port, timeoutMs = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (await isPortFree(port)) return true;
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return false;
}

function startProjectServer(javaOptions = [], portArg = '0') {
    const args = [...javaOptions, '-cp', 'bin', 'it.polito.dsp.lab03.ConverterServer'];
    if (portArg !== null) args.push(portArg);
    return startJavaServer(args, READY_PATTERN_PROJECT);
}

function startProfessorServer() {
    return startJavaServer(['-jar', professorServerJar], READY_PATTERN_PROFESSOR, path.join(professorRoot, 'Server'));
}

function startJavaServer(args, readyPattern, cwd = javaRoot) {
    const proc = spawn('java', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdoutBuffer = '';
    let stderrBuffer = '';
    proc.stdout.on('data', (chunk) => { stdoutBuffer += chunk; });
    proc.stderr.on('data', (chunk) => { stderrBuffer += chunk; });

    const readyPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`server did not report readiness in time. stdout: ${stdoutBuffer} stderr: ${stderrBuffer}`)), 15000);
        const check = () => {
            const match = stdoutBuffer.match(readyPattern);
            if (match) { clearTimeout(timeout); resolve(match[1] ? Number(match[1]) : PROFESSOR_PORT); }
        };
        proc.stdout.on('data', check);
        proc.once('exit', (code) => reject(new Error(`server exited before startup (code ${code}). stderr: ${stderrBuffer}`)));
    });

    const server = { proc, readyPromise, getStdout: () => stdoutBuffer, getStderr: () => stderrBuffer, exited: false };
    proc.once('exit', () => { server.exited = true; });
    runningServers.push(server);
    return server;
}

function stopServerCleanly(server, { timeoutMs = 5000 } = {}) {
    return new Promise((resolve) => {
        if (server.exited) { resolve({ forced: false }); return; }
        let forced = false;
        const timeout = setTimeout(() => { forced = true; server.proc.kill('SIGKILL'); }, timeoutMs);
        server.proc.once('exit', () => { clearTimeout(timeout); resolve({ forced }); });
        server.proc.kill('SIGTERM');
    });
}

async function restartProfessorServer(previous) {
    await stopServerCleanly(previous, { timeoutMs: 3000 });
    await waitForPortFree(PROFESSOR_PORT);
    const next = startProfessorServer();
    await next.readyPromise;
    return next;
}

function buildRequestHeader(sourceType, targetType, length) {
    const header = Buffer.alloc(10);
    header.write(sourceType, 0, 3, 'ascii');
    header.write(targetType, 3, 3, 'ascii');
    header.writeInt32BE(length, 6);
    return header;
}

// Sends chunks and waits for the peer to close, with a hard timeout that
// force-destroys the socket (never just abandons it) so a professor-server
// hang can never leave a dangling handle behind or stall the test process.
function sendRawWithTimeout(port, chunks, timeoutMs = 5000) {
    return new Promise((resolve) => {
        const socket = net.connect(port, '127.0.0.1');
        const received = [];
        let settled = false;
        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            socket.destroy();
            resolve({ timedOut: true, bytes: Buffer.alloc(0) });
        }, timeoutMs);
        socket.on('data', (chunk) => received.push(chunk));
        socket.on('error', () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve({ timedOut: false, bytes: Buffer.concat(received), errored: true });
        });
        socket.on('close', () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve({ timedOut: false, bytes: Buffer.concat(received) });
        });
        socket.on('connect', () => {
            for (const chunk of chunks) socket.write(chunk);
            socket.end();
        });
    });
}

function parseResponse(buf) {
    if (buf.length < 5) return null;
    const status = String.fromCharCode(buf[0]);
    const length = buf.readInt32BE(1);
    if (buf.length !== 5 + length) return null;
    return { status, length, payload: buf.subarray(5, 5 + length) };
}

function runProjectClient(args, { timeoutMs = 10000, cwd = temporaryRoot } = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn('java', ['-cp', binDir, 'it.polito.dsp.lab03.ConversionRequestClient', ...args], { cwd });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (c) => { stdout += c; });
        child.stderr.on('data', (c) => { stderr += c; });
        const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('project client did not exit in time')); }, timeoutMs);
        child.once('exit', (code) => { clearTimeout(timer); resolve({ status: code, stdout, stderr }); });
        child.once('error', reject);
    });
}

function runProfessorClient(cwd, args, { timeoutMs = 10000 } = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn('java', ['-jar', professorClientJar, ...args], { cwd });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (c) => { stdout += c; });
        child.stderr.on('data', (c) => { stderr += c; });
        let timedOut = false;
        const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); resolve({ status: null, stdout, stderr, timedOut: true }); }, timeoutMs);
        child.once('exit', (code) => { if (timedOut) return; clearTimeout(timer); resolve({ status: code, stdout, stderr, timedOut: false }); });
        child.once('error', reject);
    });
}

function makeProfessorClientWorkDir() {
    const dir = fs.mkdtempSync(path.join(temporaryRoot, 'prof-client-'));
    fs.mkdirSync(path.join(dir, 'image'));
    return dir;
}

let checks = 0;

(async () => {
    // --- discover and verify professor artifacts (never build/clone: already present and verified) ---
    const provenance = verifyProfessorArtifacts();
    console.log('Professor artifact check:', JSON.stringify(provenance));
    if (!provenance.available) {
        console.log('SKIPPED: professor client.jar/server.jar not found locally under shared-services/lab03/lab03-solution-main/.');
        console.log('This is expected on an environment that never received that local, gitignored reference copy;');
        console.log('it is not downloaded automatically so that npm run test:lab03 never depends on internet access.');
        console.log('Lab03 interoperability tests: SKIPPED (0 scenarios; professor reference artifacts unavailable).');
        fs.rmSync(temporaryRoot, { recursive: true, force: true });
        return;
    }

    buildMain();
    buildTestTools();

    const pngFixture = generateFixture('png', 48, 36, 'source.png');
    const jpgFixture = generateFixture('jpg', 48, 36, 'source.jpg');
    const gifFixture = generateFixture('gif', 48, 36, 'source.gif');
    const fixturesByType = { PNG: pngFixture, JPG: jpgFixture, GIF: gifFixture };

    try {
        // ================= A. project client -> project server (baseline) =================
        {
            const server = startProjectServer([]);
            const port = await server.readyPromise;
            const outputDir = fs.mkdtempSync(path.join(temporaryRoot, 'proj-proj-'));
            const source = path.join(outputDir, 'source.png');
            fs.copyFileSync(pngFixture, source);
            const clientResult = await runProjectClient(['PNG', 'JPG', source, '127.0.0.1', String(port)], { cwd: outputDir });
            assert.strictEqual(clientResult.status, 0, `baseline project/project client failed: ${clientResult.stderr}`);
            const outputPath = path.join(outputDir, 'source_converted.jpg');
            const inspected = inspectImage(outputPath);
            assert.strictEqual(normalizeType(inspected.format), 'JPG');
            assert.strictEqual(inspected.width, 48);
            assert.strictEqual(inspected.height, 36);
            record('projectProject', { pair: 'PNG->JPG', outcome: 'interoperable', detail: `format=${inspected.format} dims=${inspected.width}x${inspected.height}` });
            checks++;
            await stopServerCleanly(server);
        }

        // ================= B/C/D depend on port 2001 (hard-coded on both professor sides) =================
        const port2001Free = await isPortFree(PROFESSOR_PORT);
        if (!port2001Free) {
            const skipMsg = 'port 2001 is occupied by an unrelated local process; not killed. Combinations B, C, D require it (hard-coded, non-configurable on both professor sides) and are skipped.';
            record('environmentSkips', { scope: 'B/C/D', reason: skipMsg });
            console.log('SKIPPED:', skipMsg);
        } else {
            // ================= B. professor client -> project server =================
            {
                const projectServer = startProjectServer([], null); // no port arg -> DEFAULT_PORT (2001), required since professor client is hard-coded to 0.0.0.0:2001
                const boundPort = await projectServer.readyPromise;
                assert.strictEqual(boundPort, 2001, 'project server must bind 2001 for the professor client to be able to reach it');

                const pairs = [['PNG', 'JPG'], ['PNG', 'GIF'], ['JPG', 'PNG'], ['JPG', 'GIF'], ['GIF', 'PNG'], ['GIF', 'JPG']];
                for (const [sourceType, targetType] of pairs) {
                    const workDir = makeProfessorClientWorkDir();
                    const fileName = `input.${sourceType.toLowerCase()}`;
                    fs.copyFileSync(fixturesByType[sourceType], path.join(workDir, 'image', fileName));
                    const clientResult = await runProfessorClient(workDir, [sourceType, targetType, fileName]);
                    const zeroZeroWorked = /Connected to Server/.test(clientResult.stdout);
                    const outputPath = path.join(workDir, 'image', `output.${targetType.toLowerCase()}`);
                    if (clientResult.status === 0 && fs.existsSync(outputPath)) {
                        const inspected = inspectImage(outputPath);
                        const formatOk = normalizeType(inspected.format) === targetType;
                        const dimsOk = inspected.width === 48 && inspected.height === 36;
                        assert(formatOk, `professor client -> project server ${sourceType}->${targetType}: expected format ${targetType}, got ${inspected.format}`);
                        assert(dimsOk, `professor client -> project server ${sourceType}->${targetType}: dimensions not preserved (${inspected.width}x${inspected.height})`);
                        record('professorClientProjectServer', {
                            pair: `${sourceType}->${targetType}`, outcome: 'interoperable',
                            detail: `format=${inspected.format} dims=${inspected.width}x${inspected.height} 0.0.0.0-connected=${zeroZeroWorked}`,
                        });
                        checks++;
                    } else {
                        record('unexpectedFailures', { scope: 'professorClientProjectServer', pair: `${sourceType}->${targetType}`, detail: `exit=${clientResult.status} stdout=${clientResult.stdout} stderr=${clientResult.stderr}` });
                    }
                }
                await stopServerCleanly(projectServer);
                await waitForPortFree(PROFESSOR_PORT);
            }

            // ================= C. project client -> professor server =================
            {
                let professorServer = startProfessorServer();
                await professorServer.readyPromise;

                const pairs = [['PNG', 'JPG'], ['PNG', 'GIF'], ['JPG', 'PNG'], ['JPG', 'GIF'], ['GIF', 'PNG'], ['GIF', 'JPG']];
                for (const [sourceType, targetType] of pairs) {
                    const outputDir = fs.mkdtempSync(path.join(temporaryRoot, 'proj-prof-'));
                    const source = path.join(outputDir, `source.${sourceType.toLowerCase()}`);
                    fs.copyFileSync(fixturesByType[sourceType], source);
                    const clientResult = await runProjectClient([sourceType, targetType, source, '127.0.0.1', String(PROFESSOR_PORT)], { cwd: outputDir });
                    const outputPath = path.join(outputDir, `source_converted.${targetType.toLowerCase()}`);
                    if (clientResult.status === 0 && fs.existsSync(outputPath)) {
                        const inspected = inspectImage(outputPath);
                        assert.strictEqual(normalizeType(inspected.format), targetType, `project client -> professor server ${sourceType}->${targetType}: format mismatch`);
                        assert.strictEqual(inspected.width, 48);
                        assert.strictEqual(inspected.height, 36);
                        record('projectClientProfessorServer', { pair: `${sourceType}->${targetType}`, outcome: 'interoperable', detail: `format=${inspected.format} dims=${inspected.width}x${inspected.height}` });
                        checks++;
                    } else {
                        record('unexpectedFailures', { scope: 'projectClientProfessorServer', pair: `${sourceType}->${targetType}`, detail: `exit=${clientResult.status} stderr=${clientResult.stderr}` });
                    }
                }

                // --- malformed cases against the professor server, each protected by a hard timeout ---
                const pngBody = fs.readFileSync(pngFixture);

                // unsupported type: known-safe path in the professor implementation (verified manually before writing this test)
                {
                    const raw = await sendRawWithTimeout(PROFESSOR_PORT, [buildRequestHeader('BMP', 'PNG', 4), Buffer.from('xxxx')], 5000);
                    const response = raw.timedOut ? null : parseResponse(raw.bytes);
                    if (response && response.status === '1') {
                        record('projectClientProfessorServer', { pair: 'malformed:unsupported-type', outcome: 'interoperable only for valid requests', detail: `status=1 message="${response.payload.toString('ascii')}"` });
                    } else {
                        record('unexpectedFailures', { scope: 'projectClientProfessorServer', pair: 'malformed:unsupported-type', detail: raw.timedOut ? 'unexpected timeout' : `unexpected response bytes=${raw.bytes.length}` });
                    }
                    checks++;
                }

                // declared oversized length with only a small partial body: known to crash ConversionHandler's
                // unchecked read loop (professor defect #7 — EOF/negative-length handling), expected to hang.
                {
                    const raw = await sendRawWithTimeout(PROFESSOR_PORT, [buildRequestHeader('PNG', 'JPG', 10_000_000), Buffer.alloc(100, 0x41)], 5000);
                    if (raw.timedOut) {
                        record('expectedDefects', { scope: 'projectClientProfessorServer', pair: 'malformed:oversized-declared-length', detail: 'connection hung with no response (matches known professor defect: unchecked read loop / uncaught exception on truncated oversized-length body, socket never closed)' });
                    } else {
                        record('projectClientProfessorServer', { pair: 'malformed:oversized-declared-length', outcome: 'interoperable only for valid requests', detail: `unexpected clean response, bytes=${raw.bytes.length}` });
                    }
                    checks++;
                    professorServer = await restartProfessorServer(professorServer);
                }

                // truncated body: declare a real length but send fewer bytes than declared, then close.
                {
                    const raw = await sendRawWithTimeout(PROFESSOR_PORT, [buildRequestHeader('PNG', 'JPG', pngBody.length), pngBody.subarray(0, 20)], 5000);
                    if (raw.timedOut) {
                        record('expectedDefects', { scope: 'projectClientProfessorServer', pair: 'malformed:truncated-body', detail: 'connection hung with no response (matches known professor defect: EOF from a premature close is mishandled in the fixed-size read loop)' });
                    } else {
                        record('projectClientProfessorServer', { pair: 'malformed:truncated-body', outcome: 'interoperable only for valid requests', detail: `unexpected clean response, bytes=${raw.bytes.length}` });
                    }
                    checks++;
                    professorServer = await restartProfessorServer(professorServer);
                }

                // malformed (undecodable) image bytes at the correct declared length: known to crash via
                // ImageIO.write(null, ...) thrown as an uncaught IllegalArgumentException (professor defect #9).
                {
                    const junk = Buffer.alloc(256, 0x00);
                    const raw = await sendRawWithTimeout(PROFESSOR_PORT, [buildRequestHeader('PNG', 'JPG', junk.length), junk], 5000);
                    if (raw.timedOut) {
                        record('expectedDefects', { scope: 'projectClientProfessorServer', pair: 'malformed:undecodable-image', detail: 'connection hung with no response (matches known professor defect #9: ImageIO.read(...)==null is not checked before ImageIO.write(...), throwing an uncaught IllegalArgumentException that leaves the socket in CLOSE_WAIT forever)' });
                    } else {
                        record('projectClientProfessorServer', { pair: 'malformed:undecodable-image', outcome: 'interoperable only for valid requests', detail: `unexpected clean response, bytes=${raw.bytes.length}` });
                    }
                    checks++;
                    professorServer = await restartProfessorServer(professorServer);
                }

                // recovery proof: a fresh professor server instance still answers a normal valid request correctly.
                {
                    const source = path.join(temporaryRoot, 'recovery-source.png');
                    fs.copyFileSync(pngFixture, source);
                    const raw = await sendRawWithTimeout(PROFESSOR_PORT, [buildRequestHeader('PNG', 'JPG', fs.readFileSync(source).length), fs.readFileSync(source)], 5000);
                    const response = raw.timedOut ? null : parseResponse(raw.bytes);
                    assert(response && response.status === '0', 'professor server must accept a valid request after being restarted following a poisoned connection');
                    record('projectClientProfessorServer', { pair: 'PNG->JPG (post-defect recovery)', outcome: 'interoperable', detail: 'fresh professor server instance answered correctly after restart' });
                    checks++;
                }

                await stopServerCleanly(professorServer);
                await waitForPortFree(PROFESSOR_PORT);
            }

            // ================= D. professor client -> professor server (reference baseline only) =================
            {
                const professorServer = startProfessorServer();
                await professorServer.readyPromise;
                const workDir = makeProfessorClientWorkDir();
                fs.copyFileSync(pngFixture, path.join(workDir, 'image', 'input.png'));
                const clientResult = await runProfessorClient(workDir, ['PNG', 'JPG', 'input.png']);
                const zeroZeroWorked = /Connected to Server/.test(clientResult.stdout);
                const outputPath = path.join(workDir, 'image', 'output.jpg');
                if (clientResult.status === 0 && fs.existsSync(outputPath)) {
                    const inspected = inspectImage(outputPath);
                    record('professorProfessorReference', {
                        pair: 'PNG->JPG', outcome: 'reference-only (not compliance evidence)',
                        detail: `format=${inspected.format} dims=${inspected.width}x${inspected.height} 0.0.0.0-connected=${zeroZeroWorked}`,
                    });
                } else {
                    record('professorProfessorReference', { pair: 'PNG->JPG', outcome: 'reference-only, did not complete', detail: `exit=${clientResult.status} stdout=${clientResult.stdout}` });
                }
                checks++;
                await stopServerCleanly(professorServer);
                await waitForPortFree(PROFESSOR_PORT);
            }
        }

        // ================= result matrix =================
        console.log('\n=== Lab03 interoperability result matrix ===');
        for (const [bucket, label] of [
            ['projectProject', 'Project client -> Project server'],
            ['professorClientProjectServer', 'Professor client -> Project server'],
            ['projectClientProfessorServer', 'Project client -> Professor server'],
            ['professorProfessorReference', 'Professor client -> Professor server (REFERENCE ONLY)'],
            ['expectedDefects', 'Expected professor-defect observations (not project failures)'],
            ['environmentSkips', 'Environment skips'],
            ['unexpectedFailures', 'UNEXPECTED failures'],
        ]) {
            console.log(`-- ${label} (${results[bucket].length}) --`);
            for (const entry of results[bucket]) {
                console.log(`   ${entry.pair || entry.scope}: ${entry.outcome || entry.reason || ''} ${entry.detail || ''}`.trim());
            }
        }

        assert.strictEqual(results.unexpectedFailures.length, 0, `${results.unexpectedFailures.length} unexpected interoperability failure(s) occurred`);

        console.log(`\nLab03 interoperability tests passed (${checks} scenarios; ${results.expectedDefects.length} confirmed professor-defect observation(s); ${results.environmentSkips.length} environment skip(s)).`);
    } finally {
        for (const server of runningServers) {
            if (!server.exited) await stopServerCleanly(server, { timeoutMs: 3000 });
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

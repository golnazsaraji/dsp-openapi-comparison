const assert = require('assert');
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const javaRoot = path.join(root, 'shared-services', 'lab03');
const fixtureRoot = path.join(root, 'postman', 'lab02', 'fixtures');
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dsp-lab03-client-'));

const NORMAL_PORT = 21011;
const READY_BANNER = 'Converter TCP server listening on port';

function buildClient() {
    const binDir = path.join(javaRoot, 'bin');
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

function startServer(port) {
    return spawn('java', ['-cp', 'bin', 'it.polito.dsp.lab03.ConverterServer', String(port)], {
        cwd: javaRoot, stdio: ['ignore', 'pipe', 'pipe'],
    });
}

// Runs the compiled ConversionRequestClient as a real child process (async
// spawn, never spawnSync: a mock TCP peer in this same test file needs the
// event loop free to respond while the client is running).
function runClient(javaOptions, clientArgs, { timeoutMs = 10000 } = {}) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
        const child = spawn('java', [...javaOptions, '-cp', 'bin', 'it.polito.dsp.lab03.ConversionRequestClient', ...clientArgs], { cwd: javaRoot });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (chunk) => { stdout += chunk; });
        child.stderr.on('data', (chunk) => { stderr += chunk; });
        const timeout = setTimeout(() => {
            child.kill('SIGKILL');
            reject(new Error(`client did not exit in time (args: ${clientArgs.join(' ')})`));
        }, timeoutMs);
        child.once('exit', (code) => {
            clearTimeout(timeout);
            resolve({ status: code, stdout, stderr, durationMs: Date.now() - start });
        });
        child.once('error', reject);
    });
}

function assertNoStackTrace(stderr, label) {
    assert(!/^Exception in thread/m.test(stderr), `${label}: unexpected raw "Exception in thread" trace: ${stderr}`);
    assert(!/\tat [\w.$]+\(/.test(stderr), `${label}: unexpected raw stack frame in stderr: ${stderr}`);
}

function expectFailure(result, label, messageIncludes) {
    assert.notStrictEqual(result.status, 0, `${label}: expected non-zero exit, got ${result.status}. stderr: ${result.stderr}`);
    assertNoStackTrace(result.stderr, label);
    if (messageIncludes) {
        assert(result.stderr.includes(messageIncludes), `${label}: expected stderr to mention "${messageIncludes}", got: ${result.stderr}`);
    }
}

function expectedOutputPath(sourcePath, targetType) {
    const dir = path.dirname(sourcePath);
    const ext = path.extname(sourcePath);
    const base = path.basename(sourcePath, ext);
    return path.join(dir, `${base}_converted.${targetType.toLowerCase()}`);
}

function magicMatches(mediaType, bytes) {
    if (mediaType === 'PNG') return bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    if (mediaType === 'JPG') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
    return bytes.subarray(0, 3).toString('ascii') === 'GIF';
}

function freeLocalPort() {
    return new Promise((resolve, reject) => {
        const probe = net.createServer();
        probe.on('error', reject);
        probe.listen(0, '127.0.0.1', () => {
            const { port } = probe.address();
            probe.close(() => resolve(port));
        });
    });
}

// A raw TCP peer that reads a complete, well-formed request (so it behaves
// like a real server up to the point it decides to misbehave), then invokes
// `onRequestComplete(socket)` to send back a deliberately broken response.
function startMockServer(onRequestComplete) {
    const server = net.createServer((socket) => {
        const chunks = [];
        socket.on('data', (chunk) => {
            chunks.push(chunk);
            const total = Buffer.concat(chunks);
            if (total.length >= 10) {
                const declaredLength = total.readInt32BE(6);
                if (declaredLength >= 0 && total.length >= 10 + declaredLength) {
                    onRequestComplete(socket);
                }
            }
        });
    });
    return new Promise((resolve, reject) => {
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => resolve(server));
    });
}

async function withMockServer(onRequestComplete, testFn) {
    const server = await startMockServer(onRequestComplete);
    try {
        const port = server.address().port;
        await testFn(port);
    } finally {
        server.close();
    }
}

// Each test gets its own copy under a distinct name so that a converted
// sibling output file from one test case can never collide with another's.
let fixtureCopyCounter = 0;
function copyFixture(name) {
    fixtureCopyCounter += 1;
    const dest = path.join(temporaryRoot, `${fixtureCopyCounter}-${name}`);
    fs.copyFileSync(path.join(fixtureRoot, name), dest);
    return dest;
}

(async () => {
    buildClient();
    const normalServer = startServer(NORMAL_PORT);
    let checks = 0;
    try {
        await waitForServer(normalServer, 'Lab03 normal server (client robustness tests)');

        // --- 1. mandatory three-argument invocation succeeds ---
        {
            const source = copyFixture('valid.png');
            const result = await runClient([], ['PNG', 'JPG', source, '127.0.0.1', String(NORMAL_PORT)]);
            assert.strictEqual(result.status, 0, `mandatory invocation should succeed: ${result.stderr}`);
            assertNoStackTrace(result.stderr, 'mandatory invocation');
            const outputPath = expectedOutputPath(source, 'JPG');
            assert(fs.existsSync(outputPath), 'converted output file must exist');
            assert(magicMatches('JPG', fs.readFileSync(outputPath)), 'converted output must decode as JPG');
            checks++;
        }

        // --- 2. optional host/port invocation succeeds (redundant path, distinct from the 3-arg default-host/port case, exercised for completeness) ---
        {
            const source = copyFixture('valid.jpg');
            const result = await runClient([], ['JPG', 'GIF', source, '127.0.0.1', String(NORMAL_PORT)]);
            assert.strictEqual(result.status, 0, `optional host/port invocation should succeed: ${result.stderr}`);
            const outputPath = expectedOutputPath(source, 'GIF');
            assert(magicMatches('GIF', fs.readFileSync(outputPath)), 'converted output must decode as GIF');
            checks++;
        }

        // --- 3. too few arguments ---
        {
            const result = await runClient([], ['PNG', 'JPG']);
            expectFailure(result, 'too few arguments', 'Usage:');
            checks++;
        }

        // --- 4. too many arguments ---
        {
            const result = await runClient([], ['PNG', 'JPG', 'x', 'host', '2001', 'extra']);
            expectFailure(result, 'too many arguments', 'Usage:');
            checks++;
        }

        // --- 5. unsupported media type ---
        {
            const source = copyFixture('valid.png');
            const result = await runClient([], ['BMP', 'JPG', source]);
            expectFailure(result, 'unsupported media type', 'Unsupported media type');
            checks++;
        }

        // --- 6. invalid non-numeric port ---
        {
            const source = copyFixture('valid.png');
            const result = await runClient([], ['PNG', 'JPG', source, '127.0.0.1', 'notaport']);
            expectFailure(result, 'invalid non-numeric port', 'Invalid port');
            checks++;
        }

        // --- 7. port outside valid range ---
        {
            const source = copyFixture('valid.png');
            const result = await runClient([], ['PNG', 'JPG', source, '127.0.0.1', '70000']);
            expectFailure(result, 'invalid port range', 'Invalid port');
            checks++;
        }

        // --- 8. missing file ---
        {
            const missing = path.join(temporaryRoot, 'does-not-exist.png');
            const result = await runClient([], ['PNG', 'JPG', missing]);
            expectFailure(result, 'missing file', 'does not exist');
            checks++;
        }

        // --- 9. directory path ---
        {
            const dirPath = fs.mkdtempSync(path.join(temporaryRoot, 'a-directory-'));
            const result = await runClient([], ['PNG', 'JPG', dirPath]);
            expectFailure(result, 'directory path', 'directory');
            checks++;
        }

        // --- 10. local validation happens before connect (bad type + unreachable target must fail fast, with the *validation* message, not a network error) ---
        {
            const source = copyFixture('valid.png');
            const result = await runClient([], ['BMP', 'JPG', source, '192.0.2.1', '21099']);
            expectFailure(result, 'validation before connect', 'Unsupported media type');
            assert(!/onnect/.test(result.stderr), `validation before connect: stderr should not mention connecting, got: ${result.stderr}`);
            assert(result.durationMs < 5000, `validation before connect: should fail fast without attempting a connection, took ${result.durationMs}ms`);
            checks++;
        }

        // --- 11. connection refused ---
        {
            const source = copyFixture('valid.png');
            const refusedPort = await freeLocalPort();
            const result = await runClient([], ['PNG', 'JPG', source, '127.0.0.1', String(refusedPort)]);
            expectFailure(result, 'connection refused');
            const outputPath = expectedOutputPath(source, 'JPG');
            assert(!fs.existsSync(outputPath), 'no output file for a refused connection');
            checks++;
        }

        // --- 12. unreachable endpoint / controlled connect failure (reserved TEST-NET-1 address, short client-side timeout so the test stays fast and offline) ---
        {
            const source = copyFixture('valid.png');
            const result = await runClient(['-Dlab03.socketTimeoutMs=1000'], ['PNG', 'JPG', source, '192.0.2.1', '21099'], { timeoutMs: 8000 });
            expectFailure(result, 'unreachable endpoint');
            checks++;
        }

        // --- 13. server closes before status ---
        await withMockServer((socket) => socket.end(), async (port) => {
            const source = copyFixture('valid.png');
            const result = await runClient([], ['PNG', 'JPG', source, '127.0.0.1', String(port)]);
            expectFailure(result, 'server closes before status', 'before sending a response status');
            const outputPath = expectedOutputPath(source, 'JPG');
            assert(!fs.existsSync(outputPath), 'no output file when server closes before status');
            assert(!fs.existsSync(`${outputPath}.tmp`), 'no temp file when server closes before status');
            checks++;
        });

        // --- 14. server closes before length ---
        await withMockServer((socket) => {
            const partial = Buffer.from('0', 'ascii');
            socket.end(partial);
        }, async (port) => {
            const source = copyFixture('valid.png');
            const result = await runClient([], ['PNG', 'JPG', source, '127.0.0.1', String(port)]);
            expectFailure(result, 'server closes before length', 'before sending the response length');
            checks++;
        });

        // --- 15. server sends truncated payload ---
        await withMockServer((socket) => {
            const header = Buffer.alloc(5);
            header.write('0', 0, 1, 'ascii');
            header.writeInt32BE(1000, 1);
            socket.end(Buffer.concat([header, Buffer.alloc(20, 0x41)])); // declares 1000 bytes, sends only 20
        }, async (port) => {
            const source = copyFixture('valid.png');
            const result = await runClient([], ['PNG', 'JPG', source, '127.0.0.1', String(port)]);
            expectFailure(result, 'server sends truncated payload', 'before receiving the expected bytes');
            const outputPath = expectedOutputPath(source, 'JPG');
            assert(!fs.existsSync(outputPath), 'truncated payload must not produce a final output file');
            assert(!fs.existsSync(`${outputPath}.tmp`), 'truncated payload must not leave a temp file');
            checks++;
        });

        // --- 16. server read timeout (server accepts and reads the request, then never responds) ---
        await withMockServer(() => { /* accepted the full request; deliberately never responds */ }, async (port) => {
            const source = copyFixture('valid.png');
            const result = await runClient(['-Dlab03.socketTimeoutMs=800'], ['PNG', 'JPG', source, '127.0.0.1', String(port)], { timeoutMs: 8000 });
            expectFailure(result, 'server read timeout');
            assert(result.durationMs < 8000, `read timeout should fire well under the test harness ceiling, took ${result.durationMs}ms`);
            checks++;
        });

        // --- 17. status 1 produces no output file ---
        await withMockServer((socket) => {
            const message = Buffer.from('Wrong request: simulated.', 'ascii');
            const header = Buffer.alloc(5);
            header.write('1', 0, 1, 'ascii');
            header.writeInt32BE(message.length, 1);
            socket.end(Buffer.concat([header, message]));
        }, async (port) => {
            const source = copyFixture('valid.png');
            const result = await runClient([], ['PNG', 'JPG', source, '127.0.0.1', String(port)]);
            expectFailure(result, 'status 1 response', 'Converter returned error 1');
            const outputPath = expectedOutputPath(source, 'JPG');
            assert(!fs.existsSync(outputPath), 'status 1 must not produce an output file');
            checks++;
        });

        // --- 18. status 2 produces no output file ---
        await withMockServer((socket) => {
            const message = Buffer.from('Internal server error: simulated.', 'ascii');
            const header = Buffer.alloc(5);
            header.write('2', 0, 1, 'ascii');
            header.writeInt32BE(message.length, 1);
            socket.end(Buffer.concat([header, message]));
        }, async (port) => {
            const source = copyFixture('valid.png');
            const result = await runClient([], ['PNG', 'JPG', source, '127.0.0.1', String(port)]);
            expectFailure(result, 'status 2 response', 'Converter returned error 2');
            const outputPath = expectedOutputPath(source, 'JPG');
            assert(!fs.existsSync(outputPath), 'status 2 must not produce an output file');
            checks++;
        });

        // --- 19. unknown status produces no output file ---
        await withMockServer((socket) => {
            const header = Buffer.alloc(5);
            header.write('9', 0, 1, 'ascii');
            header.writeInt32BE(0, 1);
            socket.end(header);
        }, async (port) => {
            const source = copyFixture('valid.png');
            const result = await runClient([], ['PNG', 'JPG', source, '127.0.0.1', String(port)]);
            expectFailure(result, 'unknown status', 'Malformed server response');
            const outputPath = expectedOutputPath(source, 'JPG');
            assert(!fs.existsSync(outputPath), 'unknown status must not produce an output file');
            checks++;
        });

        console.log(`Lab03 client robustness tests passed (${checks} scenarios: CLI validation, connection failures, output-file safety, no raw stack traces).`);
    } finally {
        normalServer.kill('SIGTERM');
        fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
})().catch((error) => { console.error(error); process.exitCode = 1; });

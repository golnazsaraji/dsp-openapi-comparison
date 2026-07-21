// Full end-to-end Lab04 realtime integration tests: a real generated Film
// Manager server (spawned fresh, PORT=0) driven over real HTTP requests and
// real `ws` WebSocket connections. Covers: initial snapshot, login/update/logout
// broadcasts, multiple concurrent clients, multiple sessions for one user,
// a client disconnecting before a broadcast, a client attempting to spoof
// server state, failed REST operations emitting nothing, and clean shutdown.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const { spawn } = require('child_process');
const Ajv = require('ajv');

const root = path.join(__dirname, '..');
const appRoot = path.join(root, 'generated-openapi-generator-custom');
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dsp-lab04-realtime-'));

const ajv = new Ajv({ allErrors: true, strict: true, strictRequired: false });
const schema = JSON.parse(fs.readFileSync(path.join(root, 'specifications', 'lab04', 'schemas', 'ws_message_schema.json')));
const validateMessage = ajv.compile(schema);

function startServer() {
    const proc = spawn('node', ['index.js'], {
        cwd: appRoot,
        env: {
            ...process.env,
            PORT: '0',
            UPLOAD_DIR: path.join(temporaryRoot, 'uploads'),
            IMAGE_METADATA_PATH: path.join(temporaryRoot, 'image-metadata.json'),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk) => { stdout += chunk; });
    proc.stderr.on('data', (chunk) => { stderr += chunk; });
    const portPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`server did not start in time. stderr: ${stderr}`)), 15000);
        const check = () => {
            const match = stdout.match(/Listening on port (\d+)/);
            if (match) { clearTimeout(timeout); resolve(Number(match[1])); }
        };
        proc.stdout.on('data', check);
        proc.once('exit', (code) => reject(new Error(`server exited before startup (code ${code}). stderr: ${stderr}`)));
    });
    const server = { proc, portPromise, exited: false, getStderr: () => stderr };
    proc.once('exit', () => { server.exited = true; });
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

// Minimal per-session HTTP client with its own cookie jar, so several
// concurrently "logged in" users/sessions can be driven independently.
function makeSession(port) {
    const cookieJar = new Map();
    function request(method, requestPath, body) {
        const payload = body === undefined ? null : JSON.stringify(body);
        const headers = {};
        if (payload) {
            headers['Content-Type'] = 'application/json';
            headers['Content-Length'] = Buffer.byteLength(payload);
        }
        if (cookieJar.size > 0) headers.Cookie = [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
        return new Promise((resolve, reject) => {
            const req = http.request({ hostname: '127.0.0.1', port, path: requestPath, method, headers }, (res) => {
                for (const cookie of res.headers['set-cookie'] || []) {
                    const [pair] = cookie.split(';');
                    const [key, value] = pair.split('=');
                    cookieJar.set(key, value);
                }
                let raw = '';
                res.on('data', (chunk) => { raw += chunk; });
                res.on('end', () => {
                    let data = raw;
                    try { data = raw ? JSON.parse(raw) : null; } catch (error) { /* leave as raw text */ }
                    resolve({ status: res.statusCode, data });
                });
            });
            req.on('error', reject);
            if (payload) req.write(payload);
            req.end();
        });
    }
    return {
        login: (email, password) => request('POST', '/api/sessions', { email, password }),
        logout: () => request('DELETE', '/api/sessions/current'),
        onlineUsers: () => request('GET', '/api/users/online'),
        selectActive: (filmId) => request('PUT', `/api/films/${filmId}/active`),
        clearActive: () => request('DELETE', '/api/users/current/active-film'),
    };
}

function connectClient(port) {
    return new Promise((resolve, reject) => {
        const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
        const messages = [];
        socket.on('message', (data) => {
            const parsed = JSON.parse(data);
            assert.strictEqual(validateMessage(parsed), true, `every received message must be schema-valid: ${JSON.stringify(parsed)} ${ajv.errorsText(validateMessage.errors)}`);
            messages.push(parsed);
        });
        socket.once('open', () => resolve({ socket, messages }));
        socket.once('error', reject);
    });
}

function waitForCount(messages, targetLength, timeoutMs = 3000) {
    return new Promise((resolve, reject) => {
        if (messages.length >= targetLength) { resolve(); return; }
        const start = Date.now();
        const interval = setInterval(() => {
            if (messages.length >= targetLength) {
                clearInterval(interval);
                resolve();
            } else if (Date.now() - start > timeoutMs) {
                clearInterval(interval);
                reject(new Error(`timed out waiting for ${targetLength} messages (have ${messages.length}: ${JSON.stringify(messages)})`));
            }
        }, 25);
    });
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

let checks = 0;

// --- shutdown robustness: close() must attempt BOTH resources even if one
// throws, and must still surface a rejection so index.js's shutdown handler
// can log it and exit non-zero (rather than skip the HTTP server close, or
// silently exit 0 on a failed shutdown). Constructed directly (no launch()),
// so this is a pure in-process check of the generated expressServer.js —
// unmodified by hand, only reproduced from out/expressServer.mustache.
(async () => {
    const ExpressServer = require(path.join(appRoot, 'expressServer.js'));
    const instance = new ExpressServer(0, path.join(root, 'openapi', 'openapi.yaml'));

    let gatewayCloseCalled = false;
    let serverCloseCalled = false;
    instance.realtimeGateway = { close: async () => { gatewayCloseCalled = true; throw new Error('simulated gateway close failure'); } };
    instance.server = { close: (callback) => { serverCloseCalled = true; callback(); } };

    await assert.rejects(() => instance.close(), /simulated gateway close failure/, 'close() must surface a resource-close failure, not swallow it');
    assert.strictEqual(gatewayCloseCalled, true, 'the failing resource close must have been attempted');
    assert.strictEqual(serverCloseCalled, true, 'the HTTP server close must still be attempted even though the gateway close failed first');
    assert.strictEqual(instance.server, undefined, 'the server reference must still be cleared after close(), even on failure');
    assert.strictEqual(instance.realtimeGateway, undefined, 'the gateway reference must still be cleared after close(), even on failure');
    checks++;
    console.log('Shutdown-robustness check passed: close() attempts both resources and surfaces a failure instead of hanging or silently succeeding.');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

(async () => {
    const server = startServer();
    const port = await server.portPromise;

    try {
        // --- initial snapshot: login Frank BEFORE any client connects, then connect and check the snapshot ---
        const frank1 = makeSession(port);
        const frankLogin = await frank1.login('frank@example.com', 'password');
        assert.strictEqual(frankLogin.status, 200);

        const clientA = await connectClient(port);
        await waitForCount(clientA.messages, 1);
        assert.deepStrictEqual(clientA.messages[0], {
            typeMessage: 'login', userId: 2, userName: 'Frank', filmId: 1, filmTitle: 'The Matrix',
        }, 'initial snapshot must report Frank already online with his seed-active film, as a login-shaped message');
        checks++;

        // --- login broadcast ---
        const karen1 = makeSession(port);
        const karenLogin = await karen1.login('karen@example.com', 'password');
        assert.strictEqual(karenLogin.status, 200);
        await waitForCount(clientA.messages, 2);
        assert.deepStrictEqual(clientA.messages[1], { typeMessage: 'login', userId: 3, userName: 'Karen' });
        checks++;

        // --- update broadcast (active-film selection) ---
        const karenActive = await karen1.selectActive(2);
        assert.strictEqual(karenActive.status, 200);
        await waitForCount(clientA.messages, 3);
        assert.deepStrictEqual(clientA.messages[2], { typeMessage: 'update', userId: 3, userName: 'Karen', filmId: 2, filmTitle: 'Arrival' });
        checks++;

        // --- multiple clients: a second client's initial snapshot reflects current state, sorted by userId ---
        const clientB = await connectClient(port);
        await waitForCount(clientB.messages, 2);
        assert.deepStrictEqual(clientB.messages.map((m) => m.userId), [2, 3], 'snapshot must be sorted by ascending userId');
        checks++;

        // --- multiple clients: both already-connected clients receive the same new broadcast ---
        const rene1 = makeSession(port);
        await rene1.login('rene@example.com', 'password');
        await waitForCount(clientA.messages, 4);
        await waitForCount(clientB.messages, 3);
        assert.deepStrictEqual(clientA.messages[3], { typeMessage: 'login', userId: 4, userName: 'Rene' });
        assert.deepStrictEqual(clientB.messages[2], { typeMessage: 'login', userId: 4, userName: 'Rene' });
        checks++;

        const reneActive = await rene1.selectActive(4);
        assert.strictEqual(reneActive.status, 200);
        await waitForCount(clientA.messages, 5);
        await waitForCount(clientB.messages, 4);
        assert.deepStrictEqual(clientA.messages[4], { typeMessage: 'update', userId: 4, userName: 'Rene', filmId: 4, filmTitle: 'Spirited Away' });
        checks++;

        // --- multiple sessions for one user: a second Frank session must not re-broadcast login ---
        const frank2 = makeSession(port);
        const frankSecondLogin = await frank2.login('frank@example.com', 'password');
        assert.strictEqual(frankSecondLogin.status, 200);
        await wait(300);
        assert.strictEqual(clientA.messages.length, 5, 'a second session for an already-online user must not broadcast another login');
        assert.strictEqual(clientB.messages.length, 4, 'a second client must also see no broadcast for a second session login');
        checks++;

        // Closing one of Frank's two sessions must not broadcast logout.
        const frankFirstLogout = await frank1.logout();
        assert.strictEqual(frankFirstLogout.status, 204);
        await wait(300);
        assert.strictEqual(clientA.messages.length, 5, 'closing one of two sessions for the same user must not broadcast logout');
        assert.strictEqual(clientB.messages.length, 4, 'a second client must also see no broadcast when only one of two sessions closes');
        checks++;

        // Closing Frank's final remaining session must broadcast logout exactly once, to every connected client.
        const frankFinalLogout = await frank2.logout();
        assert.strictEqual(frankFinalLogout.status, 204);
        await waitForCount(clientA.messages, 6);
        await waitForCount(clientB.messages, 5);
        assert.deepStrictEqual(clientA.messages[5], { typeMessage: 'logout', userId: 2 });
        assert.deepStrictEqual(clientB.messages[4], { typeMessage: 'logout', userId: 2 });
        checks++;

        // --- closed clients: a client that disconnects must not disrupt delivery to the remaining clients ---
        const clientC = await connectClient(port);
        clientC.socket.close();
        await wait(200); // let the server observe the close before the next broadcast
        const karenLogout = await karen1.logout();
        assert.strictEqual(karenLogout.status, 204);
        await waitForCount(clientA.messages, 7);
        // clientB connected later than clientA (2-message snapshot instead of
        // 1), but received every live broadcast since then identically,
        // including Frank's final-session logout above — so its index for
        // this same logout is 5, not 4.
        await waitForCount(clientB.messages, 6);
        assert.deepStrictEqual(clientA.messages[6], { typeMessage: 'logout', userId: 3 });
        assert.deepStrictEqual(clientB.messages[5], { typeMessage: 'logout', userId: 3 });
        checks++;

        // --- spoofed client messages: a client-sent message must never be treated as authoritative state ---
        clientA.socket.send(JSON.stringify({ typeMessage: 'logout', userId: 4 })); // pretends Rene logged out
        await wait(300);
        const stillOnline = await rene1.onlineUsers();
        assert.strictEqual(stillOnline.status, 200);
        assert(stillOnline.data.some((user) => user.userId === 4), 'a client-sent message must not change real server-side presence state');
        assert.strictEqual(clientB.messages.length, 6, "a spoofed client message must not trigger any broadcast to other clients");
        checks++;

        // --- failed operations emit nothing ---
        const beforeFailures = clientB.messages.length;
        const badLogin = await makeSession(port).login('frank@example.com', 'not-the-password');
        assert.strictEqual(badLogin.status, 401);
        const badActive = await rene1.selectActive(999999); // film does not exist
        assert.strictEqual(badActive.status, 404);
        const alice = makeSession(port);
        await alice.login('alice@example.com', 'password'); // Alice is not invited to review any seed film
        await waitForCount(clientB.messages, beforeFailures + 1); // exactly one login broadcast for Alice's successful login
        const aliceUnauthorized = await alice.selectActive(1);
        assert.strictEqual(aliceUnauthorized.status, 403);
        await wait(300);
        assert.strictEqual(clientB.messages.length, beforeFailures + 1, 'a failed login, a 404 selection, and a 403 selection must together broadcast nothing beyond the one successful login');
        checks++;

        // --- real session-identity tracking, end-to-end over real HTTP sessions ---
        // Uses its own client (D) and Karen — confirmed fully logged out
        // earlier in this file (the "closed clients" section) — so this is
        // an unambiguous fresh login, not a second session for an
        // already-online user; none of the message-index assertions above
        // are disturbed.
        {
            const clientD = await connectClient(port);
            await wait(150); // let clientD's initial snapshot fully arrive before measuring its length
            const base = clientD.messages.length;

            const karenSession = makeSession(port);
            const firstLogin = await karenSession.login('karen@example.com', 'password');
            assert.strictEqual(firstLogin.status, 200);
            await waitForCount(clientD.messages, base + 1);
            // Karen still has film 2 ("Arrival") active from the earlier
            // update-broadcast scenario in this file (never cleared), so her
            // login message carries it.
            assert.deepStrictEqual(clientD.messages[base], {
                typeMessage: 'login', userId: 3, userName: 'Karen', filmId: 2, filmTitle: 'Arrival',
            });

            // Repeated login using the SAME session/cookie jar must be idempotent.
            const repeatLogin = await karenSession.login('karen@example.com', 'password');
            assert.strictEqual(repeatLogin.status, 200);
            await wait(250);
            assert.strictEqual(clientD.messages.length, base + 1, 'repeated login from the same session must not re-broadcast login');
            const onlineAfterRepeat = await karenSession.onlineUsers();
            assert.strictEqual(
                onlineAfterRepeat.data.filter((user) => user.userId === 3).length,
                1,
                'repeated same-session login must not double-list the user in the online snapshot',
            );
            checks++;

            // Logging out that one (repeatedly-logged-in) session must mark the user offline correctly.
            const karenLogoutAfterRepeat = await karenSession.logout();
            assert.strictEqual(karenLogoutAfterRepeat.status, 204);
            await waitForCount(clientD.messages, base + 2);
            assert.deepStrictEqual(clientD.messages[base + 1], { typeMessage: 'logout', userId: 3 });
            checks++;

            // Two independent sessions (cookie jars) for one user remain multi-session-safe end-to-end.
            const karenSessionA = makeSession(port);
            const karenSessionB = makeSession(port);
            await karenSessionA.login('karen@example.com', 'password');
            await waitForCount(clientD.messages, base + 3);
            await karenSessionB.login('karen@example.com', 'password');
            await wait(250);
            assert.strictEqual(clientD.messages.length, base + 3, 'a second independent session for an already-online user must not broadcast another login');
            await karenSessionA.logout();
            await wait(250);
            assert.strictEqual(clientD.messages.length, base + 3, 'closing one of two independent sessions must not broadcast logout');
            const stillOnline = await karenSessionB.onlineUsers();
            assert(stillOnline.data.some((user) => user.userId === 3), 'user must remain online while the second independent session is still open');
            await karenSessionB.logout();
            await waitForCount(clientD.messages, base + 4);
            assert.deepStrictEqual(clientD.messages[base + 3], { typeMessage: 'logout', userId: 3 });
            checks++;

            // A failed login must never register a session or appear online.
            const failedLogin = await makeSession(port).login('karen@example.com', 'wrong-password');
            assert.strictEqual(failedLogin.status, 401);
            await wait(250);
            assert.strictEqual(clientD.messages.length, base + 4, 'a failed login must not broadcast anything or register a session');
            const onlineAfterFailedLogin = await rene1.onlineUsers(); // rene1 is still an authenticated session throughout this file
            assert.strictEqual(onlineAfterFailedLogin.status, 200);
            assert(!onlineAfterFailedLogin.data.some((user) => user.userId === 3), 'a failed login must not appear in the online snapshot');
            checks++;

            clientD.socket.close();
        }

        clientA.socket.close();
        clientB.socket.close();

        console.log(`Lab04 realtime integration tests passed (${checks} scenarios: initial snapshot, login/update/logout broadcasts, multiple clients, multiple sessions, closed clients, spoofed messages, failed-operation silence, session-identity correctness).`);
    } finally {
        const { forced } = await stopServerCleanly(server);
        assert.strictEqual(forced, false, 'the server must shut down cleanly on SIGTERM without needing SIGKILL');
        fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

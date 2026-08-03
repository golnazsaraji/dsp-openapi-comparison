// Full end-to-end Lab05 integration tests: a real generated Film Manager
// server (spawned fresh, PORT=0), driven over real HTTP, with MQTT_URL
// pointed at a deliberately unreachable broker. Covers: broker-unavailable
// startup never hangs, the REST 409 conflict end-to-end (generated
// controller/service correctly propagates the domain layer's 409), that a
// failed selection leaves both users' state unchanged over real HTTP, and
// that clean shutdown still closes the (never-connected) MQTT client without
// hanging. Mirrors the spawn/HTTP-session helpers in scripts/lab04-realtime-tests.js.
// A real Mosquitto broker integration test is deferred to Phase 2, per the
// Phase 1 scope note in the task brief.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const root = path.join(__dirname, '..');
const appRoot = path.join(root, 'generated-openapi-generator-custom');
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dsp-lab05-integration-'));

function startServer() {
    const proc = spawn('node', ['index.js'], {
        cwd: appRoot,
        env: {
            ...process.env,
            PORT: '0',
            UPLOAD_DIR: path.join(temporaryRoot, 'uploads'),
            IMAGE_METADATA_PATH: path.join(temporaryRoot, 'image-metadata.json'),
            // Deliberately unreachable: proves startup and shutdown never
            // block on broker availability (see decision #14/#15 in the task brief).
            MQTT_URL: 'mqtt://127.0.0.1:1',
            MQTT_CLIENT_ID: `dsp-lab05-integration-${process.pid}`,
            MQTT_CONNECT_TIMEOUT: '500',
            MQTT_RECONNECT_PERIOD: '60000',
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
        selectActive: (filmId) => request('PUT', `/api/films/${filmId}/active`),
        publicReviews: (filmId) => request('GET', `/api/films/public/${filmId}/reviews`),
        health: () => request('GET', '/health'),
    };
}

let checks = 0;

(async () => {
    const server = startServer();

    try {
        // --- broker-unavailable startup must not hang: portPromise (and the
        // subsequent health check) must resolve well within the 15s startup timeout above ---
        const port = await server.portPromise;
        const anonymous = makeSession(port);
        const health = await anonymous.health();
        assert.strictEqual(health.status, 200, 'the HTTP server must serve requests immediately, even though MQTT_URL is unreachable');
        checks++;

        // --- 409 exists end-to-end: generated controller/service must propagate the domain 409 ---
        const frank = makeSession(port);
        const frankLogin = await frank.login('frank@example.com', 'password');
        assert.strictEqual(frankLogin.status, 200);
        const frankSelection = await frank.selectActive(2);
        assert.strictEqual(frankSelection.status, 200, 'Frank selects film 2 successfully');

        const karen = makeSession(port);
        const karenLogin = await karen.login('karen@example.com', 'password');
        assert.strictEqual(karenLogin.status, 200);
        const karenSelection = await karen.selectActive(2);
        assert.strictEqual(karenSelection.status, 409, 'Karen selecting the same already-active public film must receive 409 end-to-end');
        assert.strictEqual(typeof karenSelection.data?.error, 'string', 'the 409 body must use the project error schema ({ error: string })');
        checks++;

        // --- failed selection leaves both users' prior state unchanged, observed over real HTTP ---
        const reviewsAfterConflict = await frank.publicReviews(2);
        assert.strictEqual(reviewsAfterConflict.status, 200);
        const frankReview = reviewsAfterConflict.data.reviews.find((r) => r.reviewerId === 2);
        const karenReview = reviewsAfterConflict.data.reviews.find((r) => r.reviewerId === 3);
        assert.strictEqual(frankReview?.active, true, "Frank's active selection must be unaffected by Karen's failed conflicting request");
        assert.strictEqual(karenReview?.active, false, "Karen's own state must remain unchanged (still inactive) after her failed request");
        checks++;

        console.log(`Lab05 integration tests passed (${checks} scenarios: broker-unavailable startup, end-to-end 409 conflict, unchanged state after failed selection).`);
    } finally {
        const { forced } = await stopServerCleanly(server);
        assert.strictEqual(forced, false, 'the server (including its never-connected MQTT client) must shut down cleanly on SIGTERM without needing SIGKILL');
        fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

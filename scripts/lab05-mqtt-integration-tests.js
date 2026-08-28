// Real-broker Lab05 MQTT integration tests: spawns an actual local Mosquitto
// process (not a fake client, not an in-memory EventEmitter) against an
// isolated, temporary, loopback-only, dynamically-ported test configuration,
// and drives shared-services/src/mqtt/attachMqttGateway.js plus a real
// FilmManagerService instance and real mqtt.js client connections against it.
//
// If a mosquitto executable cannot be located deterministically, this suite
// reports the exact search performed and exits non-zero WITHOUT silently
// substituting a mock — real-broker MQTT integration is then NOT verified,
// and the caller (npm run test:lab05:integration) must report that honestly.
const assert = require('assert');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawnSync, spawn } = require('child_process');
const mqtt = require('mqtt');

const root = path.join(__dirname, '..');
const { FilmManagerService } = require(path.join(root, 'shared-services', 'src', 'services', 'FilmManagerService'));
const { attachMqttGateway } = require(path.join(root, 'shared-services', 'src', 'mqtt', 'attachMqttGateway'));

// ---------------------------------------------------------------------------
// 1. Deterministic mosquitto executable location.
// ---------------------------------------------------------------------------
function locateMosquitto() {
    const candidates = [];
    const whichResult = spawnSync('which', ['mosquitto'], { encoding: 'utf8' });
    if (whichResult.status === 0 && whichResult.stdout.trim()) candidates.push(whichResult.stdout.trim());
    candidates.push(
        '/usr/local/sbin/mosquitto',
        '/opt/homebrew/sbin/mosquitto',
        '/usr/sbin/mosquitto',
        '/usr/local/bin/mosquitto',
        '/opt/homebrew/bin/mosquitto',
    );
    const tried = [];
    for (const candidate of candidates) {
        tried.push(candidate);
        if (fs.existsSync(candidate)) {
            const versionCheck = spawnSync(candidate, ['-h'], { encoding: 'utf8', timeout: 5000 });
            if (versionCheck.status === 0 || /mosquitto version/i.test(versionCheck.stdout || '')) {
                return { executable: candidate, tried };
            }
        }
    }
    return { executable: null, tried };
}

// ---------------------------------------------------------------------------
// 2. Isolated free-port allocation (best-effort; a TOCTOU race against an
//    unrelated process binding the same port between allocation and
//    mosquitto startup is a known, inherent limitation of this technique —
//    see docs/lab05-compliance-audit.md, "Real-broker integration results").
// ---------------------------------------------------------------------------
function getFreePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.unref();
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            server.close(() => resolve(port));
        });
    });
}

// ---------------------------------------------------------------------------
// 3. Readiness detection via a real TCP connection attempt/retry, never a
//    fixed sleep. Also captures stdout/stderr for failure diagnostics.
// ---------------------------------------------------------------------------
function waitForPortOpen(port, host, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    return new Promise((resolve, reject) => {
        function attempt() {
            const socket = net.connect({ port, host }, () => {
                socket.end();
                resolve();
            });
            socket.on('error', () => {
                socket.destroy();
                if (Date.now() > deadline) {
                    reject(new Error(`port ${port} on ${host} did not open within ${timeoutMs}ms`));
                } else {
                    setTimeout(attempt, 30);
                }
            });
        }
        attempt();
    });
}

function startMosquitto(executable, configPath) {
    const proc = spawn(executable, ['-c', configPath], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk) => { stdout += chunk; });
    proc.stderr.on('data', (chunk) => { stderr += chunk; });
    let exited = false;
    proc.once('exit', () => { exited = true; });
    return {
        proc,
        get exited() { return exited; },
        getOutput: () => `stdout:\n${stdout}\nstderr:\n${stderr}`,
    };
}

function stopProcessCleanly(handle, { timeoutMs = 5000 } = {}) {
    return new Promise((resolve) => {
        if (!handle || handle.exited) { resolve({ forced: false }); return; }
        let forced = false;
        const timeout = setTimeout(() => { forced = true; handle.proc.kill('SIGKILL'); }, timeoutMs);
        handle.proc.once('exit', () => { clearTimeout(timeout); resolve({ forced }); });
        handle.proc.kill('SIGTERM');
    });
}

// Records every message this client ever receives, keyed by topic, in
// arrival order — registered at connect time, BEFORE any subscribe call, so
// a retained message delivered the instant a subscription is acknowledged
// can never be lost to a listener that was attached too late (the bug this
// replaced: a one-shot `client.once('message', ...)` added AFTER awaiting
// `subscribeAsync()` can miss a retained PUBLISH that arrives in the same
// network round-trip as the SUBACK).
function connectRecordingClient(url, clientId) {
    return new Promise((resolve, reject) => {
        const client = mqtt.connect(url, { clientId, connectTimeout: 5000, reconnectPeriod: 200 });
        const messagesByTopic = new Map();
        client.on('message', (topic, payload) => {
            const list = messagesByTopic.get(topic) || [];
            list.push(JSON.parse(payload.toString()));
            messagesByTopic.set(topic, list);
        });
        const onError = (error) => { client.removeListener('connect', onConnect); reject(error); };
        const onConnect = () => {
            client.removeListener('error', onError);
            resolve({
                client,
                messagesFor: (topic) => messagesByTopic.get(topic) || [],
                waitForCount: (topic, count, timeoutMs = 5000) => new Promise((res, rej) => {
                    const start = Date.now();
                    (function poll() {
                        const list = messagesByTopic.get(topic) || [];
                        if (list.length >= count) { res(list); return; }
                        if (Date.now() - start > timeoutMs) {
                            rej(new Error(`timed out waiting for ${count} message(s) on topic "${topic}" (have ${list.length}: ${JSON.stringify(list)})`));
                            return;
                        }
                        setTimeout(poll, 25);
                    }());
                }),
                confirmNoMoreMessages: (topic, sinceCount, waitMs = 500) => new Promise((res, rej) => {
                    setTimeout(() => {
                        const list = messagesByTopic.get(topic) || [];
                        if (list.length > sinceCount) rej(new Error(`unexpectedly received an extra message on topic "${topic}": ${JSON.stringify(list)}`));
                        else res();
                    }, waitMs);
                }),
            });
        };
        client.once('connect', onConnect);
        client.once('error', onError);
    });
}

(async () => {
    const { executable, tried } = locateMosquitto();
    if (!executable) {
        console.error('Real Mosquitto integration: NOT RUN.');
        console.error('Searched (in order):');
        tried.forEach((candidate) => console.error(`  - ${candidate}`));
        console.error('None of these resolved to a working mosquitto executable ("which mosquitto" and the common');
        console.error('Homebrew/system install paths were all checked). Per Phase 2 scope, this suite does NOT');
        console.error('silently substitute a mock broker, and does NOT install system packages automatically.');
        console.error('Phase 2 cannot claim complete real-broker MQTT integration verification without Mosquitto installed.');
        process.exitCode = 1;
        return;
    }
    console.log(`Located mosquitto executable: ${executable}`);

    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dsp-lab05-mosquitto-'));
    const persistenceDir = path.join(tempRoot, 'persistence');
    fs.mkdirSync(persistenceDir, { recursive: true });
    const configPath = path.join(tempRoot, 'test-mosquitto.conf');
    const mqttPort = await getFreePort();

    // Isolated test-only configuration: loopback binding, a dynamically
    // allocated port (never the canonical 1883, so it never conflicts with a
    // developer's own running broker), anonymous local access (matching the
    // canonical shared-services/lab05/broker/mosquitto.conf academic
    // policy), and persistence confined to this test's own temp directory
    // (so no real broker state/database is touched or left behind). No
    // WebSocket listener: this suite only exercises the Node-side gateway
    // over plain MQTT, matching "explicit WebSocket listener only if client
    // integration requires it" (the React client's WS integration is
    // covered separately with a fake client — see
    // shared-services/lab04/client-app/src/test/connectFilmSelectionMqtt.test.js).
    fs.writeFileSync(configPath, [
        `listener ${mqttPort} 127.0.0.1`,
        'protocol mqtt',
        'allow_anonymous true',
        `persistence_location ${persistenceDir}/`,
        'persistence true',
        'log_dest stdout',
    ].join('\n'));

    const brokerUrl = `mqtt://127.0.0.1:${mqttPort}`;
    let broker = startMosquitto(executable, configPath);
    const rawClients = [];
    let gateway;
    let gatewayClient;
    let checks = 0;

    try {
        await waitForPortOpen(mqttPort, '127.0.0.1', 8000).catch((error) => {
            throw new Error(`mosquitto did not open its listener in time. ${error.message}\n${broker.getOutput()}`);
        });

        const service = new FilmManagerService();
        service.currentUserId = 1;
        const privateFilm = service.filmsPOST({ title: 'Integration Private', private: true });

        // --- 1. gateway connects ---
        gatewayClient = mqtt.connect(brokerUrl, { clientId: 'dsp-lab05-it-gateway', connectTimeout: 5000, reconnectPeriod: 200 });
        rawClients.push(gatewayClient);
        gateway = attachMqttGateway(gatewayClient, service, { logger: { error: (...args) => console.error('[gateway]', ...args) } });
        await new Promise((resolve, reject) => {
            gatewayClient.once('connect', resolve);
            gatewayClient.once('error', reject);
        });
        checks++;

        // Subscribe to every topic this suite will ever assert on, up
        // front, before any further mutation — so the recorder can never
        // race a retained-delivery-on-subscribe against a later assertion.
        const sub = await connectRecordingClient(brokerUrl, 'dsp-lab05-it-subscriber');
        rawClients.push(sub.client);
        await sub.client.subscribeAsync(['1', '2', '4', String(privateFilm.id)]);

        // --- 2. bootstrap publishes retained state (seed films 1,2,4 are public) ---
        const [film1Msgs, film2Msgs, film4Msgs] = await Promise.all([
            sub.waitForCount('1', 1),
            sub.waitForCount('2', 1),
            sub.waitForCount('4', 1),
        ]);
        assert.deepStrictEqual(film1Msgs[0], { status: 'active', userId: 2, userName: 'Frank' }, 'bootstrap must reflect seed film 1 (active for Frank)');
        assert.deepStrictEqual(film2Msgs[0], { status: 'inactive' }, 'bootstrap must reflect seed film 2 (inactive)');
        assert.deepStrictEqual(film4Msgs[0], { status: 'inactive' }, 'bootstrap must reflect seed film 4 (inactive)');
        checks++;

        // --- 3. late subscriber immediately receives current retained messages ---
        const late = await connectRecordingClient(brokerUrl, 'dsp-lab05-it-late-subscriber');
        rawClients.push(late.client);
        await late.client.subscribeAsync(['2']);
        const lateMsgs = await late.waitForCount('2', 1);
        assert.deepStrictEqual(lateMsgs[0], { status: 'inactive' }, 'a late subscriber must immediately receive the current retained message via MQTT retain, not a fresh republish');
        checks++;

        // --- 4. private films absent ---
        await sub.confirmNoMoreMessages(String(privateFilm.id), 0, 500);
        checks++;

        // --- 5. active selection updates retained state ---
        service.currentUserId = 2; // Frank: reviewer for film 2 (seed data)
        service.filmsFilmIdActivePUT(2);
        const film2After = await sub.waitForCount('2', 2);
        assert.deepStrictEqual(film2After[1], { status: 'active', userId: 2, userName: 'Frank' });
        checks++;

        // --- 6. replacement updates both old and new topics ---
        service.currentUserId = 3; // Karen owns film 4 (seed data) — only the owner can invite reviewers
        service.filmsFilmIdReviewsPOST(4, { reviewerId: 2 }); // give Frank a second film to switch to
        service.currentUserId = 2;
        service.filmsFilmIdActivePUT(4); // Frank replaces film 2 with film 4
        const film2AfterReplace = await sub.waitForCount('2', 3);
        const film4AfterReplace = await sub.waitForCount('4', 2);
        assert.deepStrictEqual(film2AfterReplace[2], { status: 'inactive' }, 'the replaced film must retain inactive');
        assert.deepStrictEqual(film4AfterReplace[1], { status: 'active', userId: 2, userName: 'Frank' }, 'the newly selected film must retain active');
        checks++;

        // --- 7. clearing changes retained state to inactive ---
        service.usersCurrentActiveFilmDELETE();
        const film4AfterClear = await sub.waitForCount('4', 3);
        assert.deepStrictEqual(film4AfterClear[2], { status: 'inactive' });
        checks++;

        // --- 8. public creation publishes retained inactive ---
        service.currentUserId = 1;
        const createdTopic = String(service.nextFilmId);
        await sub.client.subscribeAsync([createdTopic]);
        const createdFilm = service.filmsPOST({ title: 'IT Created Film', private: false });
        assert.strictEqual(String(createdFilm.id), createdTopic);
        const createdMsgs = await sub.waitForCount(createdTopic, 1);
        assert.deepStrictEqual(createdMsgs[0], { status: 'inactive' });
        checks++;

        // --- 9. deletion leaves retained deleted payload ---
        service.filmsFilmIdDELETE(createdFilm.id);
        const deletedMsgs = await sub.waitForCount(createdTopic, 2);
        assert.deepStrictEqual(deletedMsgs[1], { status: 'deleted' });
        checks++;

        // --- 10/11/12/13. broker stop -> disconnect; mutation while broker is down;
        // broker restart on the same port -> reconnect -> resync -> final state matches domain state ---
        const disconnectPromise = new Promise((resolve) => gatewayClient.once('close', resolve));
        await stopProcessCleanly(broker);
        await disconnectPromise;
        checks++; // (10) disconnect detected

        // Mutate domain state while the broker is completely unavailable —
        // this must succeed purely in-memory (REST/domain layer never blocks
        // on broker availability) and must be visible once the broker returns.
        service.currentUserId = 4; // Rene: reviewer for film 4 (seed data)
        service.filmsFilmIdActivePUT(4);

        broker = startMosquitto(executable, configPath); // simulated broker restart, same port, empty persistence
        await waitForPortOpen(mqttPort, '127.0.0.1', 8000).catch((error) => {
            throw new Error(`restarted mosquitto did not open its listener in time. ${error.message}\n${broker.getOutput()}`);
        });

        const reconnectPromise = new Promise((resolve) => gatewayClient.once('connect', resolve));
        await reconnectPromise; // (11) gateway reconnected
        checks++;

        const resync = await connectRecordingClient(brokerUrl, 'dsp-lab05-it-resubscriber');
        rawClients.push(resync.client);
        await resync.client.subscribeAsync(['4']);
        const resyncMsgs = await resync.waitForCount('4', 1, 8000); // (12)/(13)
        assert.deepStrictEqual(resyncMsgs[0], { status: 'active', userId: 4, userName: 'Rene' }, 'reconnect bootstrap must republish the state as it stands NOW, including mutations made while the broker was unavailable');
        checks++;

        console.log(`Lab05 real Mosquitto integration tests passed (${checks} scenarios against a real, locally-spawned Mosquitto ${executable} broker on an isolated port).`);
    } finally {
        // --- 14. clean, deterministic shutdown: every client, the gateway, and the broker process ---
        if (gateway) await gateway.close().catch(() => {});
        await Promise.all(rawClients.map((client) => new Promise((resolve) => client.end(true, {}, resolve))));
        await stopProcessCleanly(broker);
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

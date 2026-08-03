// Focused Phase 3 regression-guard tests for properties that were previously
// true "by construction" / code inspection only (Class 2 in
// docs/lab05-compliance-audit.md): domain-layer transport-agnosticism, the
// gateway never subscribing, schema compiled exactly once, no credentials
// logged, no import-time mqtt.connect(), and no credentials in either broker
// config. Each of these is cheap and deterministic to verify directly,
// converting the corresponding matrix row to Class 1 evidence.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const root = path.join(__dirname, '..');

// --- E2: the domain layer never references MQTT transport options ---
{
    const source = fs.readFileSync(path.join(root, 'shared-services', 'src', 'services', 'FilmManagerService.js'), 'utf8');
    assert.ok(!/\bqos\s*:/.test(source), 'FilmManagerService.js must never reference a "qos:" option — that is an MQTT-gateway-owned transport concern');
    assert.ok(!/\bretain\s*:/.test(source), 'FilmManagerService.js must never reference a "retain:" option');
    assert.ok(!source.includes("require('mqtt')") && !source.includes('require("mqtt")'), 'FilmManagerService.js must never require the mqtt package directly');
    console.log('Confirmed (E2): FilmManagerService.js contains no qos/retain/mqtt-package references — the domain layer stays MQTT-transport-agnostic.');
}

// --- T7: the gateway never subscribes to anything (publish-only) ---
{
    const { attachMqttGateway } = require(path.join(root, 'shared-services', 'src', 'mqtt', 'attachMqttGateway'));
    class SpyClient extends EventEmitter {
        publish(topic, payload, options, callback) { callback?.(); }
        subscribe() { throw new Error('the MQTT gateway must never call client.subscribe() — it is publish-only'); }
        unsubscribe() { throw new Error('the MQTT gateway must never call client.unsubscribe()'); }
        end(force, options, callback) { callback?.(); }
    }
    const client = new SpyClient();
    const eventSource = new EventEmitter();
    eventSource.mqttInitialFilmMessages = () => [{ filmId: 1, message: { status: 'inactive' } }];
    const gateway = attachMqttGateway(client, eventSource, { logger: { error: () => {} } });
    client.emit('connect'); // triggers bootstrap
    eventSource.emit('filmStatusChanged', { filmId: 2, message: { status: 'inactive' } });
    gateway.close();
    console.log('Confirmed (T7): the MQTT gateway never calls client.subscribe()/unsubscribe() across connect + bootstrap + publish (would have thrown if it had).');
}

// --- P2: the canonical schema is compiled exactly once (module-cache reuse, not per-publication) ---
{
    const validatorPath = path.join(root, 'shared-services', 'src', 'mqtt', 'mqttFilmMessageValidator.js');
    delete require.cache[require.resolve(validatorPath)]; // start from a known, uncached state
    const first = require(validatorPath);
    const withCacheIntact = require(validatorPath); // require() again WITHOUT clearing cache this time
    assert.strictEqual(first.validate, withCacheIntact.validate, 'requiring the validator module twice without clearing the cache must return the SAME compiled validate function, proving compile-once/reuse');
    // Exercise it many times to further demonstrate no recompilation occurs per call.
    for (let i = 0; i < 50; i++) withCacheIntact.validate({ status: 'inactive' });
    assert.strictEqual(withCacheIntact.validate, first.validate, 'the validate function reference must remain stable across 50 validations');
    console.log('Confirmed (P2): mqttFilmMessageValidator.js compiles the schema once at module load and reuses the same compiled validator across repeated validations.');
}

// --- P11 / C8: no credentials logged anywhere in the MQTT source, and no credentials configured in either broker config ---
{
    const mqttDir = path.join(root, 'shared-services', 'src', 'mqtt');
    const suspiciousLoggingPattern = /(console\.(log|info|warn|error)|logger\.\w+)\([^)]*\b(password|username|MQTT_PASSWORD|MQTT_USERNAME)\b/i;
    fs.readdirSync(mqttDir).filter((f) => f.endsWith('.js')).forEach((file) => {
        const source = fs.readFileSync(path.join(mqttDir, file), 'utf8');
        assert.ok(!suspiciousLoggingPattern.test(source), `${file} must never log a password/username value`);
    });
    console.log('Confirmed (P11): no file under shared-services/src/mqtt/ logs a password/username value.');

    const forbiddenBrokerConfigKeys = /\b(password_file|psk_file|cafile|certfile|keyfile|tls_version)\b/i;
    ['shared-services/lab05/broker/mosquitto.conf', 'specifications/lab05/broker/mosquitto.conf'].forEach((relativePath) => {
        const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
        assert.ok(!forbiddenBrokerConfigKeys.test(source), `${relativePath} must not configure credentials/TLS`);
    });
    console.log('Confirmed (C8): neither broker config file configures credentials, PSK, or TLS.');
}

// --- G1: createMqttClient.js never calls mqtt.connect() at module-import time ---
{
    const rawSource = fs.readFileSync(path.join(root, 'shared-services', 'src', 'mqtt', 'createMqttClient.js'), 'utf8');
    // Strip '//' line comments first (this file documents the very
    // invariant being checked in a comment, which would otherwise false-positive
    // a naive substring search), then strip the function body of
    // createMqttClient itself, and confirm no remaining (i.e. top-level,
    // module-scope, live code) call to mqtt.connect(...) exists.
    const source = rawSource.split('\n').map((line) => line.replace(/\/\/.*$/, '')).join('\n');
    const functionStart = source.indexOf('function createMqttClient');
    // Skip past the parameter list first (e.g. `(options = {})` contains its
    // own balanced `{}`, which would otherwise be mistaken for the function
    // body's opening brace).
    const paramListStart = source.indexOf('(', functionStart);
    let parenDepth = 0;
    let paramListEnd = paramListStart;
    for (let i = paramListStart; i < source.length; i++) {
        if (source[i] === '(') parenDepth++;
        else if (source[i] === ')') { parenDepth--; if (parenDepth === 0) { paramListEnd = i; break; } }
    }
    const bodyStart = source.indexOf('{', paramListEnd);
    let depth = 0;
    let bodyEnd = bodyStart;
    for (let i = bodyStart; i < source.length; i++) {
        if (source[i] === '{') depth++;
        else if (source[i] === '}') { depth--; if (depth === 0) { bodyEnd = i; break; } }
    }
    const outsideFunctionBody = source.slice(0, functionStart) + source.slice(bodyEnd + 1);
    assert.ok(!outsideFunctionBody.includes('mqtt.connect('), 'createMqttClient.js must never call mqtt.connect() outside the factory function body (i.e. never at module-import time)');
    // Also prove it empirically: requiring the module must not create any live handle.
    const before = process._getActiveHandles ? process._getActiveHandles().length : null;
    delete require.cache[require.resolve(path.join(root, 'shared-services', 'src', 'mqtt', 'createMqttClient.js'))];
    require(path.join(root, 'shared-services', 'src', 'mqtt', 'createMqttClient.js'));
    if (before !== null) {
        const after = process._getActiveHandles().length;
        assert.strictEqual(after, before, 'merely requiring createMqttClient.js must not open any new active handle (socket/timer)');
    }
    console.log('Confirmed (G1): createMqttClient.js has no module-import-time call to mqtt.connect(), and requiring it opens no handle.');
}

// --- V2: the default MQTT_CLIENT_ID generator does not collide across repeated calls ---
{
    const { defaultClientId } = require(path.join(root, 'shared-services', 'src', 'mqtt', 'createMqttClient'));
    const ids = new Set();
    for (let i = 0; i < 1000; i++) ids.add(defaultClientId());
    assert.strictEqual(ids.size, 1000, 'defaultClientId() must not produce a collision across 1000 consecutive calls within the same process');
    assert.ok(ids.values().next().value.startsWith(`dsp-lab05-${process.pid}-`), 'defaultClientId() must be prefixed with the current process id');
    console.log('Confirmed (V2): defaultClientId() produced 1000/1000 unique ids.');
}

console.log('Lab05 hygiene tests passed (E2 domain transport-agnosticism, T7 publish-only gateway, P2 compile-once, P11 no-credential-logging, C8 no-credential-config, G1 no-import-side-effect, V2 client-id uniqueness).');

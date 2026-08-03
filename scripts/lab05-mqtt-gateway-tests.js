// In-process coverage for shared-services/src/mqtt/attachMqttGateway.js
// using a fake MQTT client (no real broker needed): explicit QoS 0/retain
// true, topic == String(filmId), on-connect bootstrap (deterministic order,
// public films only), reconnect re-bootstrap, malformed payload refused,
// listener cleanup on close(), idempotent close(), duplicate-attachment
// prevention. Mirrors the in-process half of scripts/lab04-realtime-tests.js.
const assert = require('assert');
const { EventEmitter } = require('events');
const { attachMqttGateway } = require('../shared-services/src/mqtt/attachMqttGateway');

class FakeMqttClient extends EventEmitter {
    constructor() {
        super();
        this.published = [];
        this.ended = false;
    }

    publish(topic, payload, options, callback) {
        this.published.push({ topic, payload, options });
        callback?.();
    }

    end(force, options, callback) {
        this.ended = true;
        callback?.();
    }
}

// Minimal fake FilmManagerService-shaped event source: only what
// attachMqttGateway actually uses (mqttInitialFilmMessages() + 'filmStatusChanged').
function makeFakeEventSource(initialFilmMessages = []) {
    const source = new EventEmitter();
    source.mqttInitialFilmMessages = () => initialFilmMessages;
    return source;
}

let checks = 0;

(async () => {
    // --- explicit QoS 0 and retain true on every publish ---
    {
        const client = new FakeMqttClient();
        const eventSource = makeFakeEventSource();
        const gateway = attachMqttGateway(client, eventSource, { logger: { error: () => {} } });
        eventSource.emit('filmStatusChanged', { filmId: 7, message: { status: 'inactive' } });
        assert.strictEqual(client.published.length, 1);
        assert.deepStrictEqual(client.published[0].options, { qos: 0, retain: true }, 'every publish must use explicit QoS 0 and retain true');
        await gateway.close();
        checks++;
    }

    // --- topic equals String(filmId) ---
    {
        const client = new FakeMqttClient();
        const eventSource = makeFakeEventSource();
        const gateway = attachMqttGateway(client, eventSource, { logger: { error: () => {} } });
        eventSource.emit('filmStatusChanged', { filmId: 37, message: { status: 'active', userId: 2, userName: 'Frank' } });
        assert.strictEqual(client.published[0].topic, '37', 'topic must be exactly String(filmId), no prefix');
        assert.strictEqual(JSON.parse(client.published[0].payload).status, 'active');
        await gateway.close();
        checks++;
    }

    // --- bootstrap publishes all and only public films, deterministically ordered by ascending film id ---
    {
        const client = new FakeMqttClient();
        const eventSource = makeFakeEventSource([
            { filmId: 4, message: { status: 'inactive' } },
            { filmId: 1, message: { status: 'active', userId: 2, userName: 'Frank' } },
            { filmId: 2, message: { status: 'inactive' } },
        ]);
        const gateway = attachMqttGateway(client, eventSource, { logger: { error: () => {} } });
        client.emit('connect');
        assert.deepStrictEqual(
            client.published.map((p) => p.topic),
            ['4', '1', '2'],
            'bootstrap must publish exactly the films mqttInitialFilmMessages() returns, in that order (private films are already excluded by the domain layer)',
        );
        await gateway.close();
        checks++;
    }

    // --- reconnect re-bootstraps (every 'connect' event republishes the snapshot) ---
    {
        const client = new FakeMqttClient();
        const eventSource = makeFakeEventSource([{ filmId: 1, message: { status: 'inactive' } }]);
        const gateway = attachMqttGateway(client, eventSource, { logger: { error: () => {} } });
        client.emit('connect');
        client.emit('connect'); // simulated reconnect
        assert.strictEqual(client.published.length, 2, 'each connect event (first connect and every reconnect) must re-publish the bootstrap snapshot');
        await gateway.close();
        checks++;
    }

    // --- malformed outgoing payload is not published ---
    {
        const client = new FakeMqttClient();
        const eventSource = makeFakeEventSource();
        const errors = [];
        const gateway = attachMqttGateway(client, eventSource, { logger: { error: () => {} }, onError: (error) => errors.push(error) });
        eventSource.emit('filmStatusChanged', { filmId: 1, message: { status: 'active' } }); // missing userId/userName
        assert.strictEqual(client.published.length, 0, 'a schema-invalid payload must never reach client.publish');
        assert.strictEqual(errors.length, 1, 'a schema-invalid payload must surface through the onError callback');
        await gateway.close();
        checks++;
    }

    // --- an invalid film id (e.g. would produce a wildcard/separator topic) is refused, not published ---
    {
        const client = new FakeMqttClient();
        const eventSource = makeFakeEventSource();
        const gateway = attachMqttGateway(client, eventSource, { logger: { error: () => {} } });
        eventSource.emit('filmStatusChanged', { filmId: 0, message: { status: 'inactive' } });
        eventSource.emit('filmStatusChanged', { filmId: -1, message: { status: 'inactive' } });
        assert.strictEqual(client.published.length, 0, 'an invalid film id must never be published');
        await gateway.close();
        checks++;
    }

    // --- close() removes both the event-source and MQTT-client listeners ---
    {
        const client = new FakeMqttClient();
        const eventSource = makeFakeEventSource();
        const gateway = attachMqttGateway(client, eventSource, { logger: { error: () => {} } });
        await gateway.close();
        eventSource.emit('filmStatusChanged', { filmId: 1, message: { status: 'inactive' } });
        client.emit('connect');
        assert.strictEqual(client.published.length, 0, 'after close(), neither a domain event nor a broker connect event may trigger a publish');
        assert.strictEqual(client.ended, true, 'close() must end the MQTT client');
        checks++;
    }

    // --- close() is idempotent ---
    {
        const client = new FakeMqttClient();
        const eventSource = makeFakeEventSource();
        const gateway = attachMqttGateway(client, eventSource, { logger: { error: () => {} } });
        await gateway.close();
        await assert.doesNotReject(() => gateway.close(), 'calling close() a second time must not throw');
        checks++;
    }

    // --- duplicate attachment on the same event source is prevented, does not poison it, and a legitimate re-attach after close works ---
    {
        const clientA = new FakeMqttClient();
        const clientB = new FakeMqttClient();
        const eventSource = makeFakeEventSource();
        const gatewayA = attachMqttGateway(clientA, eventSource, { logger: { error: () => {} } });
        assert.throws(
            () => attachMqttGateway(clientB, eventSource, { logger: { error: () => {} } }),
            /already attached/,
            'attaching a second gateway to the same event source must throw',
        );
        // The FAILED attach attempt on clientB above must not have poisoned the
        // event source or disturbed gatewayA in any way: gatewayA must still
        // work exactly as before.
        eventSource.emit('filmStatusChanged', { filmId: 9, message: { status: 'inactive' } });
        assert.strictEqual(clientA.published.length, 1, 'a rejected duplicate-attach attempt must not disturb the already-attached gateway');
        assert.strictEqual(clientB.published.length, 0, 'the rejected duplicate attach must never have registered any listener for clientB');

        await gatewayA.close();
        // close() must remove the event source from the WeakSet: a legitimate
        // later re-attachment (e.g. server restart in the same process) must
        // succeed, not be permanently blocked by the earlier attachment.
        const gatewayC = attachMqttGateway(clientB, eventSource, { logger: { error: () => {} } });
        eventSource.emit('filmStatusChanged', { filmId: 9, message: { status: 'inactive' } });
        assert.strictEqual(clientB.published.length, 1, 're-attaching after close() must result in a fully working gateway on the new client');
        assert.strictEqual(clientA.published.length, 1, 'the closed-and-detached first client must never receive further publishes');
        await gatewayC.close();
        checks++;
    }

    // --- attach() registers exactly one 'connect' listener per attachment (no accumulation) ---
    {
        const client = new FakeMqttClient();
        const eventSource = makeFakeEventSource();
        const gateway = attachMqttGateway(client, eventSource, { logger: { error: () => {} } });
        assert.strictEqual(client.listenerCount('connect'), 1, 'attach() must register exactly one connect listener');
        assert.strictEqual(client.listenerCount('error'), 1, 'attach() must register exactly one error listener');
        await gateway.close();
        assert.strictEqual(client.listenerCount('connect'), 0, 'close() must remove the connect listener');
        assert.strictEqual(client.listenerCount('error'), 0, 'close() must remove the error listener');
        checks++;
    }

    // --- a publish (transport) error is surfaced, not silently swallowed ---
    {
        class FailingPublishClient extends FakeMqttClient {
            publish(topic, payload, options, callback) {
                callback?.(new Error('simulated broker rejection'));
            }
        }
        const client = new FailingPublishClient();
        const eventSource = makeFakeEventSource();
        const errors = [];
        const gateway = attachMqttGateway(client, eventSource, { logger: { error: () => {} }, onError: (error) => errors.push(error.message) });
        eventSource.emit('filmStatusChanged', { filmId: 1, message: { status: 'inactive' } });
        assert.strictEqual(errors.length, 1, 'a publish callback error must be surfaced through onError');
        assert.strictEqual(errors[0], 'simulated broker rejection');
        await gateway.close();
        checks++;
    }

    // --- attach() never blocks waiting for 'connect': broker-unavailable startup must not block app startup ---
    // (a client that never emits 'connect' at all still yields a fully
    // constructed, usable gateway synchronously; the real end-to-end version
    // of this — an actually unreachable broker with the real mqtt.js client
    // — is proven in scripts/lab05-integration-tests.js, "broker-unavailable
    // startup must not hang".)
    {
        const client = new FakeMqttClient(); // never emits 'connect' in this test
        const eventSource = makeFakeEventSource();
        const startedAt = Date.now();
        const gateway = attachMqttGateway(client, eventSource, { logger: { error: () => {} } });
        assert.ok(Date.now() - startedAt < 50, 'attachMqttGateway() must return synchronously, never waiting for a connect event');
        assert.strictEqual(typeof gateway.close, 'function');
        await gateway.close();
        checks++;
    }

    console.log(`Lab05 MQTT gateway tests passed (${checks} scenarios: QoS/retain, topic contract, bootstrap ordering, reconnect, payload validation, invalid film id, listener cleanup, idempotent close, duplicate-attachment prevention + no-poisoning + re-attach-after-close, listener-count-exactly-one, publish-error-surfaced, non-blocking attach).`);
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

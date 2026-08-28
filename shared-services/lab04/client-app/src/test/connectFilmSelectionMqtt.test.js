import { describe, it, expect } from 'vitest';
import { connectFilmSelectionMqtt } from '../mqtt/connectFilmSelectionMqtt';

// A minimal fake mqtt.js client: enough surface for connectFilmSelectionMqtt
// to drive (on/emit for connect/close/message, subscribe/unsubscribe, end()),
// with call logs the tests assert against. Mirrors the FakeWebSocket pattern
// in ../test/onlineStatusSocket.test.js.
class FakeMqttClient {
    constructor() {
        this.handlers = {};
        this.subscribeCalls = [];
        this.unsubscribeCalls = [];
        this.ended = false;
    }

    on(event, handler) {
        (this.handlers[event] ||= []).push(handler);
        return this;
    }

    emit(event, ...args) {
        (this.handlers[event] || []).forEach((handler) => handler(...args));
    }

    subscribe(topics) {
        this.subscribeCalls.push([...topics].sort());
    }

    unsubscribe(topics) {
        this.unsubscribeCalls.push([...topics].sort());
    }

    end(force) {
        this.ended = true;
        this.endedForce = force;
    }
}

function factoryFor(client) {
    return () => client;
}

describe('connectFilmSelectionMqtt', () => {
    it('resubscribes to the full known set exactly once on connect', () => {
        const client = new FakeMqttClient();
        const connection = connectFilmSelectionMqtt({ mqttFactory: factoryFor(client) });
        connection.setFilmIds([2, 4]); // before first connect: only updates the desired set
        expect(client.subscribeCalls).toEqual([]); // no subscribe call yet — still disconnected
        client.emit('connect');
        expect(client.subscribeCalls).toEqual([['2', '4']]);
        connection.close();
    });

    it('resubscribes to the full set again exactly once after a reconnect', () => {
        const client = new FakeMqttClient();
        const connection = connectFilmSelectionMqtt({ mqttFactory: factoryFor(client) });
        connection.setFilmIds([2]);
        client.emit('connect');
        client.emit('close');
        client.emit('connect'); // simulated reconnect
        expect(client.subscribeCalls).toEqual([['2'], ['2']]);
        connection.close();
    });

    it('subscribes only to newly-added film ids and unsubscribes removed ones while connected', () => {
        const client = new FakeMqttClient();
        const connection = connectFilmSelectionMqtt({ mqttFactory: factoryFor(client) });
        client.emit('connect');
        connection.setFilmIds([1, 2]);
        expect(client.subscribeCalls).toEqual([['1', '2']]);
        connection.setFilmIds([2, 3]); // 1 removed, 3 added, 2 unchanged
        expect(client.subscribeCalls).toEqual([['1', '2'], ['3']]);
        expect(client.unsubscribeCalls).toEqual([['1']]);
        connection.close();
    });

    it('does not duplicate a subscribe call for a film id already subscribed', () => {
        const client = new FakeMqttClient();
        const connection = connectFilmSelectionMqtt({ mqttFactory: factoryFor(client) });
        client.emit('connect');
        connection.setFilmIds([1]);
        connection.setFilmIds([1]); // unchanged set
        expect(client.subscribeCalls).toEqual([['1']]); // only the first call actually subscribed
        connection.close();
    });

    it('parses valid JSON messages and forwards (topic, message) to onMessage', () => {
        const client = new FakeMqttClient();
        const received = [];
        const connection = connectFilmSelectionMqtt({
            mqttFactory: factoryFor(client),
            onMessage: (topic, message) => received.push([topic, message]),
        });
        client.emit('message', '2', Buffer.from(JSON.stringify({ status: 'inactive' })));
        expect(received).toEqual([['2', { status: 'inactive' }]]);
        connection.close();
    });

    it('safely ignores malformed JSON instead of throwing', () => {
        const client = new FakeMqttClient();
        const received = [];
        const connection = connectFilmSelectionMqtt({
            mqttFactory: factoryFor(client),
            onMessage: (topic, message) => received.push([topic, message]),
        });
        expect(() => client.emit('message', '2', Buffer.from('{not valid json'))).not.toThrow();
        expect(received).toEqual([]);
        connection.close();
    });

    it('close() ends the underlying MQTT client and is idempotent', () => {
        const client = new FakeMqttClient();
        const connection = connectFilmSelectionMqtt({ mqttFactory: factoryFor(client) });
        connection.close();
        expect(client.ended).toBe(true);
        expect(() => connection.close()).not.toThrow();
        expect(client.endedForce).toBe(true); // force-close, does not wait for in-flight packets on unmount
    });
});

import { describe, it, expect, vi } from 'vitest';
import { deriveWebSocketUrl, connectOnlineStatusSocket } from '../realtime/onlineStatusSocket';

describe('deriveWebSocketUrl', () => {
    it('derives ws:// from an http location', () => {
        expect(deriveWebSocketUrl('/ws', { protocol: 'http:', host: 'example.com:3000' })).toBe('ws://example.com:3000/ws');
    });

    it('derives wss:// from an https location', () => {
        expect(deriveWebSocketUrl('/ws', { protocol: 'https:', host: 'example.com' })).toBe('wss://example.com/ws');
    });

    it('never hard-codes localhost or port 5000', () => {
        const url = deriveWebSocketUrl('/ws', { protocol: 'http:', host: 'films.example.org:8080' });
        expect(url).not.toContain('localhost');
        expect(url).not.toContain(':5000');
        expect(url).toBe('ws://films.example.org:8080/ws');
    });
});

// A minimal fake WebSocket: enough surface for connectOnlineStatusSocket to
// drive (onopen/onmessage/onclose/onerror + close()), with hooks the tests
// use to simulate server messages and disconnects.
class FakeWebSocket {
    constructor(url) {
        this.url = url;
        this.closedByClient = false;
        FakeWebSocket.instances.push(this);
        queueMicrotask(() => this.onopen?.());
    }

    send() {}

    close() {
        this.closedByClient = true;
        this.onclose?.();
    }

    emitMessage(data) {
        this.onmessage?.({ data });
    }

    emitServerClose() {
        this.onclose?.();
    }
}
FakeWebSocket.instances = [];

describe('connectOnlineStatusSocket', () => {
    it('parses valid JSON messages and forwards them to onMessage', async () => {
        FakeWebSocket.instances = [];
        const received = [];
        const connection = connectOnlineStatusSocket({
            location: { protocol: 'http:', host: 'example.com' },
            WebSocketImpl: FakeWebSocket,
            onMessage: (message) => received.push(message),
        });
        const socket = FakeWebSocket.instances[0];
        socket.emitMessage(JSON.stringify({ typeMessage: 'login', userId: 1, userName: 'Alice' }));
        expect(received).toEqual([{ typeMessage: 'login', userId: 1, userName: 'Alice' }]);
        connection.close();
    });

    it('safely ignores malformed JSON instead of throwing', async () => {
        FakeWebSocket.instances = [];
        const received = [];
        const connection = connectOnlineStatusSocket({
            location: { protocol: 'http:', host: 'example.com' },
            WebSocketImpl: FakeWebSocket,
            onMessage: (message) => received.push(message),
        });
        const socket = FakeWebSocket.instances[0];
        expect(() => socket.emitMessage('{not valid json')).not.toThrow();
        expect(received).toEqual([]);
        connection.close();
    });

    it('reconnects with a new socket after the server closes the connection', async () => {
        vi.useFakeTimers();
        FakeWebSocket.instances = [];
        const connection = connectOnlineStatusSocket({
            location: { protocol: 'http:', host: 'example.com' },
            WebSocketImpl: FakeWebSocket,
        });
        expect(FakeWebSocket.instances).toHaveLength(1);
        FakeWebSocket.instances[0].emitServerClose();
        await vi.advanceTimersByTimeAsync(600); // just past the initial backoff
        expect(FakeWebSocket.instances).toHaveLength(2);
        connection.close();
        vi.useRealTimers();
    });

    it('does not reconnect after close() has been called', async () => {
        vi.useFakeTimers();
        FakeWebSocket.instances = [];
        const connection = connectOnlineStatusSocket({
            location: { protocol: 'http:', host: 'example.com' },
            WebSocketImpl: FakeWebSocket,
        });
        connection.close();
        expect(FakeWebSocket.instances[0].closedByClient).toBe(true);
        await vi.advanceTimersByTimeAsync(10000); // well past any backoff window
        expect(FakeWebSocket.instances).toHaveLength(1); // still just the original — no reconnect attempted
        vi.useRealTimers();
    });
});

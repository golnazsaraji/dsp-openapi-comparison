const { assertValidMessage } = require('./wsMessageSchema');

const OPEN = 1; // WebSocket.OPEN, avoids an extra require('ws') just for the constant.

/**
 * Manages the set of connected WebSocket clients for the Lab04 realtime
 * status channel. One-way (server -> client) by design: any message a
 * client sends is intentionally discarded, never interpreted as a state
 * change, so the WebSocket connection can never be used to spoof server
 * state — the only way to change presence/active-film state is through the
 * authenticated REST API.
 */
class PresenceWebSocketHub {
    constructor() {
        this.clients = new Set();
    }

    addClient(client, snapshotMessages = []) {
        this.clients.add(client);
        client.on('message', () => {
            // Intentionally a no-op: this channel is server -> client only.
        });
        client.on('close', () => this.clients.delete(client));
        client.on('error', () => this.clients.delete(client));
        snapshotMessages.forEach((message) => this.sendTo(client, message));
    }

    broadcast(message) {
        this.clients.forEach((client) => this.sendTo(client, message));
    }

    sendTo(client, message) {
        if (client.readyState !== OPEN) return;
        assertValidMessage(message);
        try {
            client.send(JSON.stringify(message));
        } catch (error) {
            // Isolate a single client's send failure: it must never prevent
            // delivery to the remaining connected clients.
            this.clients.delete(client);
        }
    }

    get size() {
        return this.clients.size;
    }

    closeAll() {
        this.clients.forEach((client) => {
            try {
                if (typeof client.terminate === 'function') client.terminate();
                else client.close();
            } catch (error) {
                // Best-effort cleanup; the client is being discarded either way.
            }
        });
        this.clients.clear();
    }
}

module.exports = PresenceWebSocketHub;

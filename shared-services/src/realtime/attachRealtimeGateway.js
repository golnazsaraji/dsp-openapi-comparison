const WebSocket = require('ws');
const PresenceWebSocketHub = require('./PresenceWebSocketHub');

/**
 * Attaches a Lab04 realtime WebSocket gateway to an existing HTTP server
 * (never starts a separate, unrelated server) and wires it to a
 * FilmManagerService-like event source that emits 'login' / 'update' /
 * 'logout' events carrying schema-shaped payloads (see FilmManagerService).
 *
 * Returns { hub, wss, close }. close() removes the event listeners this call
 * added, closes every connected client, and closes the WebSocketServer, so
 * repeated attach/close cycles (e.g. across tests, or server restarts) never
 * accumulate duplicate listeners or leave a stray WebSocketServer bound to a
 * closed HTTP server.
 */
function attachRealtimeGateway(httpServer, eventSource, { path = '/ws' } = {}) {
    const hub = new PresenceWebSocketHub();
    const wss = new WebSocket.Server({ server: httpServer, path });

    const onConnection = (client) => {
        hub.addClient(client, eventSource.webSocketSnapshot());
    };

    // A broadcast/schema failure must never surface as a REST-call failure:
    // FilmManagerService emits synchronously from inside its own request
    // handlers, so an uncaught error here would propagate back through
    // emit() into the very REST operation whose success already committed.
    // Broadcast correctness and REST success are deliberately decoupled.
    const safeBroadcast = (message) => {
        try {
            hub.broadcast(message);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Lab04 realtime broadcast failed:', error.message);
        }
    };

    wss.on('connection', onConnection);
    eventSource.on('login', safeBroadcast);
    eventSource.on('update', safeBroadcast);
    eventSource.on('logout', safeBroadcast);

    async function close() {
        eventSource.off('login', safeBroadcast);
        eventSource.off('update', safeBroadcast);
        eventSource.off('logout', safeBroadcast);
        wss.off('connection', onConnection);
        hub.closeAll();
        await new Promise((resolve) => wss.close(() => resolve()));
    }

    return { hub, wss, close };
}

module.exports = { attachRealtimeGateway };

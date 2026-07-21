// Derives the WebSocket URL from window.location (never a hard-coded host or
// port — the professor reference's `ws://localhost:5000` does not work once
// the app is served from anywhere else). `location` is an injectable
// parameter purely so this function is unit-testable without a real browser
// (see src/test/onlineStatusSocket.test.js); callers in the app never pass it.
export function deriveWebSocketUrl(path = '/ws', location = (typeof window !== 'undefined' ? window.location : undefined)) {
    if (!location) throw new Error('deriveWebSocketUrl requires a location to derive the URL from.');
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${location.host}${path}`;
}

const INITIAL_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 8000;

/**
 * Opens one WebSocket connection to the Lab04 realtime status endpoint and
 * reconnects with bounded exponential backoff if the connection drops,
 * until close() is called. Malformed frames are parsed defensively (a
 * `JSON.parse` failure is dropped, never thrown into the caller).
 *
 * Returns { close() } — close() is idempotent, cancels any pending reconnect
 * timer, detaches all handlers, and closes the live socket if one is open.
 * Intended to be called exactly once per component mount and closed exactly
 * once on unmount.
 */
export function connectOnlineStatusSocket({
    path = '/ws',
    location,
    onMessage,
    WebSocketImpl = (typeof window !== 'undefined' ? window.WebSocket : undefined),
} = {}) {
    if (!WebSocketImpl) throw new Error('connectOnlineStatusSocket requires a WebSocket implementation.');

    let closed = false;
    let socket = null;
    let reconnectTimer = null;
    let backoffMs = INITIAL_BACKOFF_MS;

    function safeParse(raw) {
        try {
            return JSON.parse(raw);
        } catch (error) {
            return null; // Malformed frame: ignore rather than crash the app.
        }
    }

    function detach(target) {
        if (!target) return;
        target.onopen = null;
        target.onmessage = null;
        target.onclose = null;
        target.onerror = null;
    }

    function scheduleReconnect() {
        if (closed || reconnectTimer) return;
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
            open();
        }, backoffMs);
    }

    function open() {
        if (closed) return;
        const url = deriveWebSocketUrl(path, location);
        socket = new WebSocketImpl(url);
        socket.onopen = () => { backoffMs = INITIAL_BACKOFF_MS; };
        socket.onmessage = (event) => {
            const message = safeParse(event.data);
            if (message) onMessage?.(message);
        };
        socket.onclose = () => { if (!closed) scheduleReconnect(); };
        socket.onerror = () => { /* onclose always follows and triggers the reconnect */ };
    }

    open();

    return {
        close() {
            if (closed) return;
            closed = true;
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
            if (socket) {
                detach(socket);
                socket.close();
                socket = null;
            }
        },
    };
}

import mqtt from 'mqtt';

/**
 * Opens one MQTT-over-WebSockets connection to the Lab05 broker and keeps its
 * subscriptions in sync with a caller-controlled set of film ids. Mirrors the
 * lifecycle shape of ../realtime/onlineStatusSocket.js: reconnect/backoff is
 * left to mqtt.js itself (mqttFactory's client already reconnects
 * automatically), and this module resubscribes to the full current film-id
 * set exactly once per 'connect' event (both the first connect and every
 * automatic reconnect), so a dropped connection never loses subscriptions.
 *
 * Returns { setFilmIds(filmIds), close() }. setFilmIds replaces the whole
 * subscribed set (subscribing to newly-added ids, unsubscribing removed
 * ones) and is safe to call before the first 'connect' fires. close() is
 * idempotent and ends the underlying MQTT client.
 */
export function connectFilmSelectionMqtt({
    url,
    onMessage,
    mqttFactory = mqtt.connect,
} = {}) {
    const client = mqttFactory(url);
    let subscribedFilmIds = new Set(); // the desired set, tracked whether connected or not
    let connected = false;
    let closed = false;

    function safeParse(raw) {
        try {
            return JSON.parse(raw);
        } catch (error) {
            return null; // Malformed frame: ignore rather than crash the app.
        }
    }

    client.on('connect', () => {
        connected = true;
        // Resubscribe exactly once per connect to the full known set — first
        // connect and every reconnect both go through this same path. Any
        // setFilmIds() call made while disconnected only updated the desired
        // set below (it never subscribes directly), so this is the only
        // subscribe call for those ids — never a duplicate.
        if (subscribedFilmIds.size > 0) client.subscribe([...subscribedFilmIds]);
    });
    client.on('close', () => { connected = false; });

    client.on('message', (topic, payload) => {
        const message = safeParse(payload.toString());
        if (message) onMessage?.(topic, message);
    });

    function setFilmIds(filmIds) {
        const nextIds = new Set((filmIds || []).map(String));
        const toSubscribe = [...nextIds].filter((id) => !subscribedFilmIds.has(id));
        const toUnsubscribe = [...subscribedFilmIds].filter((id) => !nextIds.has(id));
        // While disconnected, only the desired set is updated; the pending
        // 'connect' handler above subscribes to all of it in one call.
        if (connected) {
            if (toSubscribe.length > 0) client.subscribe(toSubscribe);
            if (toUnsubscribe.length > 0) client.unsubscribe(toUnsubscribe);
        }
        subscribedFilmIds = nextIds;
    }

    return {
        setFilmIds,
        close() {
            if (closed) return;
            closed = true;
            client.end(true);
        },
    };
}

const { topicForFilm } = require('./mqttTopics');
const { assertValidMessage } = require('./mqttFilmMessageValidator');

// QoS/retain are explicit MQTT-transport decisions owned by this gateway, not
// the domain layer (see FilmManagerService#emitFilmStatusChanged, which emits
// only a semantic { filmId, message } event and knows nothing about MQTT).
const PUBLISH_OPTIONS = { qos: 0, retain: true };

// Tracks which event sources already have a gateway attached, without
// mutating the event source itself (FilmManagerService stays MQTT-agnostic).
const attachedEventSources = new WeakSet();

/**
 * Attaches a Lab05 MQTT gateway to an already-connecting/connected MQTT
 * client (see createMqttClient.js), wired to a FilmManagerService-like event
 * source that emits 'filmStatusChanged' events shaped as
 * { filmId, message } (see FilmManagerService#emitFilmStatusChanged) and
 * exposes mqttInitialFilmMessages() for the on-connect bootstrap snapshot.
 *
 * Mirrors shared-services/src/realtime/attachRealtimeGateway.js: a transport
 * failure here must never surface as a REST-call failure, so every publish is
 * best-effort and errors are only logged/reported, never thrown back into the
 * domain layer that triggered the emit.
 *
 * Returns { close }. close() is idempotent, removes every listener this call
 * added, and ends the MQTT client, so repeated attach/close cycles (tests,
 * server restarts) never accumulate duplicate listeners or leave a dangling
 * client connection.
 */
function attachMqttGateway(mqttClient, eventSource, { logger = console, onError } = {}) {
    if (attachedEventSources.has(eventSource)) {
        throw new Error('MQTT gateway is already attached to this event source.');
    }
    attachedEventSources.add(eventSource);

    const reportError = (message, error) => {
        logger.error?.(message, error.message);
        onError?.(error, message);
    };

    function publish(filmId, message) {
        let topic;
        try {
            topic = topicForFilm(filmId);
            assertValidMessage(message);
        } catch (error) {
            // A malformed internal payload must never reach the broker.
            reportError('Refusing to publish malformed MQTT film message:', error);
            return;
        }
        mqttClient.publish(topic, JSON.stringify(message), PUBLISH_OPTIONS, (error) => {
            if (error) reportError('MQTT publish failed:', error);
        });
    }

    // Reconnect repairs broker state: every successful connect (first
    // connect and every automatic reconnect) recomputes and republishes one
    // retained message per public film, deterministically ordered by
    // ascending film id (see FilmManagerService#mqttInitialFilmMessages).
    let clientErrorReported = false;
    const onConnect = () => {
        clientErrorReported = false;
        try {
            eventSource.mqttInitialFilmMessages().forEach(({ filmId, message }) => publish(filmId, message));
        } catch (error) {
            reportError('MQTT on-connect bootstrap publication failed:', error);
        }
    };
    const onFilmStatusChanged = ({ filmId, message }) => publish(filmId, message);
    const onClientError = (error) => {
        if (clientErrorReported) return;
        clientErrorReported = true;
        reportError('MQTT client error (broker unavailable; retrying in the background):', error);
    };

    mqttClient.on('connect', onConnect);
    mqttClient.on('error', onClientError);
    eventSource.on('filmStatusChanged', onFilmStatusChanged);

    let closed = false;
    async function close() {
        if (closed) return;
        closed = true;
        eventSource.off('filmStatusChanged', onFilmStatusChanged);
        mqttClient.off('connect', onConnect);
        mqttClient.off('error', onClientError);
        attachedEventSources.delete(eventSource);
        await new Promise((resolve) => mqttClient.end(false, {}, () => resolve()));
    }

    return { close };
}

module.exports = { attachMqttGateway };

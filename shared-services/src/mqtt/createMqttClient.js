const mqtt = require('mqtt');

// No module-import side effects: mqtt.connect() is only ever called from
// inside this factory function, never merely by requiring this module.
function createMqttClient(options = {}) {
    const url = options.url || process.env.MQTT_URL || 'mqtt://127.0.0.1:1883';
    // Unique per process by default so concurrent test runs (or repeated
    // in-process attach/close cycles) never collide on a shared broker.
    const clientId = options.clientId || process.env.MQTT_CLIENT_ID || defaultClientId();
    const connectTimeout = options.connectTimeout ?? envInt('MQTT_CONNECT_TIMEOUT');
    const reconnectPeriod = options.reconnectPeriod ?? envInt('MQTT_RECONNECT_PERIOD');
    const username = options.username ?? process.env.MQTT_USERNAME;
    const password = options.password ?? process.env.MQTT_PASSWORD;

    return mqtt.connect(url, {
        clientId,
        ...(connectTimeout !== undefined ? { connectTimeout } : {}),
        ...(reconnectPeriod !== undefined ? { reconnectPeriod } : {}),
        ...(username !== undefined ? { username } : {}),
        ...(password !== undefined ? { password } : {}),
    });
}

function envInt(name) {
    const raw = process.env[name];
    if (raw === undefined) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
}

// Extracted so its collision-avoidance (pid + random suffix) is directly
// unit-testable without constructing a real mqtt client (which would
// otherwise attempt a real network connection).
function defaultClientId() {
    return `dsp-lab05-${process.pid}-${Math.random().toString(16).slice(2)}`;
}

module.exports = { createMqttClient, defaultClientId };

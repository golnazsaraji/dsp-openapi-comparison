// Centralized MQTT-over-WebSockets broker URL. Unlike the Lab04 WebSocket
// endpoint (same-origin, derived from window.location — see
// ../realtime/onlineStatusSocket.js), the Mosquitto broker is a separate
// process/port (see shared-services/lab05/broker/mosquitto.conf), so it
// cannot be derived the same way and needs its own configurable value.
// Production deployments override it with VITE_MQTT_WS_URL at build time.
export const MQTT_WS_URL = import.meta.env.VITE_MQTT_WS_URL || 'ws://127.0.0.1:8080';

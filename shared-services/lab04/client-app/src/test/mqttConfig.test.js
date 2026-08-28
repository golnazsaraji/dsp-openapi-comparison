import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// mqttConfig.js reads import.meta.env.VITE_MQTT_WS_URL at module-evaluation
// time, so overriding it requires resetting the module registry and
// re-importing between assertions (vi.stubEnv alone would not be observed
// by an already-evaluated module).
describe('MQTT_WS_URL', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.unstubAllEnvs();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('defaults to ws://127.0.0.1:8080 when VITE_MQTT_WS_URL is unset', async () => {
        vi.stubEnv('VITE_MQTT_WS_URL', '');
        const { MQTT_WS_URL } = await import('../mqtt/mqttConfig');
        expect(MQTT_WS_URL).toBe('ws://127.0.0.1:8080');
    });

    it('honors a production override of VITE_MQTT_WS_URL', async () => {
        vi.stubEnv('VITE_MQTT_WS_URL', 'wss://broker.example.com:8080');
        const { MQTT_WS_URL } = await import('../mqtt/mqttConfig');
        expect(MQTT_WS_URL).toBe('wss://broker.example.com:8080');
    });
});

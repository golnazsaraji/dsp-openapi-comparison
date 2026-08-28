const FilmManagerService = require('../../shared-services/src/services/FilmManagerService');
const { attachMqttGateway } = require('../../shared-services/src/mqtt/attachMqttGateway');
const { createMqttClient } = require('../../shared-services/src/mqtt/createMqttClient');

// Configurable MQTT broker URL (never hard-coded); defaults to the local
// Mosquitto TCP listener. See shared-services/lab05/broker/mosquitto.conf.
// `client` lets tests inject a fake/mock MQTT client instead of connecting
// to a real broker; `clientOptions` (url/clientId/...) are only used when no
// client is injected. `gatewayOptions` (logger/onError) pass straight through.
function attach({ client, clientOptions = {}, gatewayOptions = {} } = {}) {
  const mqttClient = client || createMqttClient(clientOptions);
  const gateway = attachMqttGateway(mqttClient, FilmManagerService, gatewayOptions);
  return { client: mqttClient, close: () => gateway.close() };
}

module.exports = { attach };

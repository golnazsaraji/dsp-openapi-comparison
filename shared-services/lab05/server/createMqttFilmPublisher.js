const mqtt = require('mqtt');
const MqttFilmPublisher = require('./MqttFilmPublisher');

function createMqttFilmPublisher(brokerUrl = 'mqtt://127.0.0.1:1883') {
  const client = mqtt.connect(brokerUrl);
  return {
    client,
    publisher: new MqttFilmPublisher(client),
  };
}

module.exports = { createMqttFilmPublisher };

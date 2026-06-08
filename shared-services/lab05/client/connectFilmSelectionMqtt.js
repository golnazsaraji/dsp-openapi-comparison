const mqtt = require('mqtt');

function connectFilmSelectionMqtt({
  brokerUrl = 'ws://127.0.0.1:8080',
  filmIds = [],
  displayFilmSelection,
}) {
  const client = mqtt.connect(brokerUrl);

  client.on('connect', () => {
    filmIds.forEach((filmId) => client.subscribe(String(filmId)));
  });

  client.on('message', (topic, payload) => {
    const parsedMessage = JSON.parse(payload.toString());
    displayFilmSelection(topic, parsedMessage);
  });

  return client;
}

module.exports = { connectFilmSelectionMqtt };

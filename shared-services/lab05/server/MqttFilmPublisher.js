class MqttFilmPublisher {
  constructor(client, topicForFilm = (filmId) => String(filmId)) {
    this.client = client;
    this.topicForFilm = topicForFilm;
  }

  publishFilmStatus(filmId, message) {
    this.client.publish(
      this.topicForFilm(filmId),
      JSON.stringify(message),
      { retain: true },
    );
  }

  publishInitialSnapshot(snapshot) {
    snapshot.forEach(({ filmId, message }) => {
      this.publishFilmStatus(filmId, message);
    });
  }
}

module.exports = MqttFilmPublisher;

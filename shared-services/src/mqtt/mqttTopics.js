// Lab05 topic contract: the canonical topic for a film is String(filmId) —
// no prefix (films/, film/, status/, dsp/) and no wildcard publication. See
// specifications/lab05/README.md.
const WILDCARD_OR_SEPARATOR = /[#+/]/;

function topicForFilm(filmId) {
    const numericId = Number(filmId);
    if (!Number.isInteger(numericId) || numericId <= 0) {
        throw new Error(`Invalid film id for MQTT topic: ${filmId}`);
    }
    const topic = String(numericId);
    if (WILDCARD_OR_SEPARATOR.test(topic)) {
        throw new Error(`MQTT topic must not contain wildcard/separator characters: ${topic}`);
    }
    return topic;
}

module.exports = { topicForFilm };

// Dedicated coverage for shared-services/src/mqtt/mqttTopics.js (server side)
// and shared-services/lab04/client-app/src/mqtt/filmSelectionReducer.js's
// topic-to-film-id parsing (client side): the Lab05 topic contract is
// String(filmId), with no prefix and no wildcard/separator characters.
const assert = require('assert');
const path = require('path');
const { topicForFilm } = require('../shared-services/src/mqtt/mqttTopics');

function expectTopic(filmId, expected, label) {
    assert.strictEqual(topicForFilm(filmId), expected, label);
}

function expectRejected(filmId, label) {
    assert.throws(() => topicForFilm(filmId), Error, label);
}

// --- canonical integer IDs ---
expectTopic(1, '1', 'film id 1 -> topic "1"');
expectTopic(2, '2', 'film id 2 -> topic "2"');
expectTopic(37, '37', 'film id 37 -> topic "37" (multi-digit)');

// --- canonical string conversion (a string that already looks like an integer) ---
expectTopic('1', '1', 'string "1" -> topic "1"');
expectTopic('37', '37', 'string "37" -> topic "37"');

// --- zero/negative behavior: this project's film ids start at 1 (see FilmManagerService seed data,
// nextFilmId starts at 5), so 0 and negative values are never valid film ids and must be rejected ---
expectRejected(0, 'film id 0 must be rejected');
expectRejected(-1, 'negative film id must be rejected');
expectRejected('-1', 'negative film id string must be rejected');

// --- empty / whitespace ---
expectRejected('', 'empty string film id must be rejected');
expectRejected('   ', 'whitespace-only film id must be rejected');

// --- decimal / non-integer ---
expectRejected(1.5, 'non-integer numeric film id must be rejected');
expectRejected('1.5', 'non-integer string film id must be rejected');
expectRejected('abc', 'non-numeric film id must be rejected');
expectRejected(NaN, 'NaN film id must be rejected');
expectRejected(null, 'null film id must be rejected');
expectRejected(undefined, 'undefined film id must be rejected');

// --- MQTT wildcard / separator characters: rejected outright even if somehow reached ---
// (topicForFilm builds the topic from a validated positive integer, so these
// can only arise from a caller bypassing the integer check with a crafted
// value; the wildcard/separator guard is defense-in-depth for that case.)
['#', '+', '/', '1/2', '1#', '1+', 'films/1'].forEach((value) => {
    expectRejected(value, `value containing a wildcard/separator character must be rejected: ${JSON.stringify(value)}`);
});

(async () => {
    // filmSelectionReducer.js is an ES module (the client-app package sets
    // "type": "module"), so it is loaded here via dynamic import() rather
    // than require() — this script itself stays CommonJS, consistent with
    // every other scripts/*.js file in the project.
    const reducerPath = path.join(__dirname, '..', 'shared-services', 'lab04', 'client-app', 'src', 'mqtt', 'filmSelectionReducer.js');
    const { applyFilmStatusMessage } = await import(`file://${reducerPath}`);

    // --- topic-to-visible-film matching (client-side reducer topic parsing) ---
    // applyFilmStatusMessage treats the MQTT topic string as the canonical film
    // id, per specifications/lab05/README.md ("the film ID is represented by the
    // MQTT topic"); this proves the client-side half of the same contract.
    assert.deepStrictEqual(
        applyFilmStatusMessage({}, '2', { status: 'inactive' }),
        { 2: { status: 'inactive' } },
        'client must interpret topic "2" as film id 2',
    );
    assert.deepStrictEqual(
        applyFilmStatusMessage({}, '037', { status: 'inactive' }),
        { 37: { status: 'inactive' } },
        'client must numerically normalize a topic with a leading zero to film id 37',
    );

    // --- unknown/malformed topic ignored by client ---
    const unchangedBase = { 2: { status: 'inactive' } };
    [
        'not-a-film-id', '', ' ', '1.5', '#', '+', '1/2', '-1', '0', null, undefined,
    ].forEach((topic) => {
        const result = applyFilmStatusMessage(unchangedBase, topic, { status: 'active', userId: 2, userName: 'Frank' });
        assert.strictEqual(result, unchangedBase, `client must ignore an unrecognized/malformed topic and return the same reference unchanged: ${JSON.stringify(topic)}`);
    });

    console.log('Lab05 topic contract tests passed (server-side topicForFilm validation, client-side topic-to-film-id parsing, wildcard/separator rejection, unknown-topic handling).');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

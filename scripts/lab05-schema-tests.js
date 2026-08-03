// Validates the canonical Lab05 MQTT film-message schema
// (specifications/lab05/schemas/mqtt_film_message_schema.json) directly, and
// proves (as a regression guard, not production behavior) that the
// professor's reference schema copy is broken and must never be used for
// validation. Mirrors scripts/lab04-schema-tests.js.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const { validate, assertValidMessage } = require('../shared-services/src/mqtt/mqttFilmMessageValidator');

const ajv = new Ajv({ allErrors: true, strict: true, strictRequired: false });

function expectValid(message, label) {
    const ok = validate(message);
    assert.strictEqual(ok, true, `${label}: expected valid, got errors: ${ajv.errorsText(validate.errors)}`);
}

function expectInvalid(message, label) {
    const ok = validate(message);
    assert.strictEqual(ok, false, `${label}: expected invalid, but schema accepted it`);
}

// --- valid cases, including the authoritative example fixtures ---
const examplesDir = path.join(__dirname, '..', 'specifications', 'lab05', 'examples');
expectValid(JSON.parse(fs.readFileSync(path.join(examplesDir, 'active-message.valid.json'))), 'authoritative active example');
expectValid(JSON.parse(fs.readFileSync(path.join(examplesDir, 'inactive-message.valid.json'))), 'authoritative inactive example');
expectValid(JSON.parse(fs.readFileSync(path.join(examplesDir, 'deleted-message.valid.json'))), 'authoritative deleted example');

expectValid({ status: 'active', userId: 2, userName: 'Frank' }, 'active with userId and userName');
expectValid({ status: 'inactive' }, 'minimal inactive');
expectValid({ status: 'deleted' }, 'minimal deleted');

// --- invalid cases ---
expectInvalid({ status: 'active' }, 'active requires userId and userName');
expectInvalid({ status: 'active', userId: 2 }, 'active missing userName is rejected');
expectInvalid({ status: 'active', userName: 'Frank' }, 'active missing userId is rejected');
expectInvalid({ status: 'inactive', userId: 2, userName: 'Frank' }, 'inactive must not carry user fields');
expectInvalid({ status: 'deleted', userId: 2 }, 'deleted must not carry userId');
expectInvalid({ status: 'deleted', userName: 'Frank' }, 'deleted must not carry userName');
expectInvalid({ status: 'bogus' }, 'status must be one of active/inactive/deleted');
expectInvalid({ status: 'active', userId: 0, userName: 'Frank' }, 'userId must be >= 1');
expectInvalid({ status: 'active', userId: 'two', userName: 'Frank' }, 'userId must be an integer, not a string');
expectInvalid({ status: 'active', userId: 2, userName: '' }, 'userName must not be empty');
expectInvalid({ userId: 2, userName: 'Frank' }, 'status is required');
expectInvalid(
    { status: 'active', userId: 2, userName: 'Frank', extra: true },
    'additional properties are rejected',
);
expectInvalid({ status: 'active', userId: 2.5, userName: 'Frank' }, 'userId must be an integer (canonical project user-id type), not a float');
expectInvalid(null, 'a null payload must be rejected (schema requires type: object)');
expectInvalid([{ status: 'inactive' }], 'an array payload must be rejected (schema requires type: object, not array)');
expectInvalid('inactive', 'a bare string payload must be rejected');
expectInvalid(42, 'a bare number payload must be rejected');

// assertValidMessage: throws on invalid, returns the message unchanged on valid.
assert.throws(() => assertValidMessage({ status: 'bogus' }), /schema validation/);
assert.deepStrictEqual(assertValidMessage({ status: 'inactive' }), { status: 'inactive' });

// "Malformed JSON at the client boundary" (JSON.parse failing on a raw MQTT
// payload string, before this schema is ever consulted) is a client-side
// transport concern, not a schema concern — it is covered directly in
// shared-services/lab04/client-app/src/test/connectFilmSelectionMqtt.test.js
// ("safely ignores malformed JSON instead of throwing").

// --- regression guard: the professor's reference schema is broken and must never be used ---
// The schema's `if` condition checks a `typeMessage` property that is never
// defined anywhere in the schema (the real property is `status`). Per JSON
// Schema semantics, `properties` imposes no constraint on a property that is
// absent from the instance, so `if: { properties: { typeMessage: ... } }`
// trivially MATCHES every canonical message (none of which carry
// `typeMessage`) — not just active ones. The `then` branch (require
// userId/userName) therefore applies unconditionally, incorrectly rejecting
// even a canonical, correctly-shaped inactive/deleted message.
const professorSchemaPath = path.join(__dirname, '..', 'shared-services', 'lab05', 'lab05-solution-main', 'mqtt_film_message_schema.json');
if (fs.existsSync(professorSchemaPath)) {
    const professorAjv = new Ajv({ allErrors: true, strict: false });
    const professorValidate = professorAjv.compile(JSON.parse(fs.readFileSync(professorSchemaPath)));
    const canonicalInactive = { status: 'inactive' };
    assert.strictEqual(
        professorValidate(canonicalInactive),
        false,
        'the professor schema uses an undefined "typeMessage" property instead of "status" and must incorrectly reject a canonical, correctly-shaped inactive message',
    );
    console.log('Confirmed: professor reference schema (typeMessage defect) rejects a canonical inactive message, as expected — never used for production validation.');
} else {
    console.log('Professor reference schema not present locally; skipped the regression-guard comparison (not required for this test to pass).');
}

// --- canonical-schema-duplicate consistency guard ---
// shared-services/lab05/schemas/mqtt_film_message_schema.json is a
// pre-existing, project-owned reference copy (part of the original Lab05
// design-artifact scaffolding) that is NOT loaded by the running server —
// only specifications/lab05/schemas/mqtt_film_message_schema.json is (see
// shared-services/src/mqtt/mqttFilmMessageValidator.js). Rather than deleting
// a pre-existing tracked file outside this task's scope, this asserts the two
// stay byte-for-byte identical, so any future edit to one without the other
// fails the suite immediately instead of silently drifting.
const canonicalSchemaPath = path.join(__dirname, '..', 'specifications', 'lab05', 'schemas', 'mqtt_film_message_schema.json');
const duplicateSchemaPath = path.join(__dirname, '..', 'shared-services', 'lab05', 'schemas', 'mqtt_film_message_schema.json');
assert.strictEqual(
    fs.readFileSync(duplicateSchemaPath, 'utf8'),
    fs.readFileSync(canonicalSchemaPath, 'utf8'),
    `shared-services/lab05/schemas/mqtt_film_message_schema.json has drifted from the canonical ` +
    `specifications/lab05/schemas/mqtt_film_message_schema.json — keep them byte-identical or remove the duplicate`,
);
console.log('Confirmed: the unused shared-services/lab05/schemas/mqtt_film_message_schema.json reference copy is byte-identical to the canonical schema (no silent drift).');

console.log('Lab05 MQTT film message schema tests passed (valid/invalid cases incl. null/array/scalar payloads, canonical user-id type, canonical examples, professor-schema regression guard, canonical-schema-duplicate consistency guard).');

// Validates the canonical Lab04 WebSocket message schema
// (specifications/lab04/schemas/ws_message_schema.json) directly, and proves
// (as a regression guard, not production behavior) that the professor's
// reference schema copy is broken and must never be used for validation.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const { validate, assertValidMessage } = require('../shared-services/src/realtime/wsMessageSchema');

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
const examplesDir = path.join(__dirname, '..', 'specifications', 'lab04', 'examples');
expectValid(JSON.parse(fs.readFileSync(path.join(examplesDir, 'login-message.valid.json'))), 'authoritative login example');
expectValid(JSON.parse(fs.readFileSync(path.join(examplesDir, 'update-message.valid.json'))), 'authoritative update example');
expectValid(JSON.parse(fs.readFileSync(path.join(examplesDir, 'logout-message.valid.json'))), 'authoritative logout example');

expectValid({ typeMessage: 'login', userId: 1, userName: 'Alice' }, 'login without an active film');
expectValid({ typeMessage: 'update', userId: 2, userName: 'Frank', filmId: 3, filmTitle: 'X' }, 'update with an active film');
expectValid({ typeMessage: 'update', userId: 2, userName: 'Frank' }, 'update with no active film (cleared state)');
expectValid({ typeMessage: 'logout', userId: 5 }, 'minimal logout');

// --- invalid cases ---
expectInvalid({ typeMessage: 'logout', userId: 5, userName: 'Should not be here' }, 'logout must not carry userName');
expectInvalid({ typeMessage: 'login', userId: 1 }, 'non-logout messages require userName');
expectInvalid({ typeMessage: 'login', userId: 1, userName: 'Alice', filmId: 1 }, 'filmId without filmTitle is invalid');
expectInvalid({ typeMessage: 'login', userId: 1, userName: 'Alice', filmTitle: 'X' }, 'filmTitle without filmId is invalid');
expectInvalid({ typeMessage: 'bogus', userId: 1, userName: 'Alice' }, 'typeMessage must be one of login/update/logout');
expectInvalid({ typeMessage: 'login', userId: 0, userName: 'Alice' }, 'userId must be >= 1');
expectInvalid({ typeMessage: 'login', userId: 'two', userName: 'Alice' }, 'userId must be an integer, not a string');
expectInvalid({ typeMessage: 'login', userId: 1, userName: '' }, 'userName must not be empty');
expectInvalid({ userId: 1, userName: 'Alice' }, 'typeMessage is required');
expectInvalid({ typeMessage: 'login' }, 'userId is required');
expectInvalid(
    { typeMessage: 'login', userId: 1, userName: 'Alice', filmId: 1, filmTitle: 'X', extra: true },
    'additional properties are rejected',
);

// assertValidMessage: throws on invalid, returns the message unchanged on valid.
assert.throws(() => assertValidMessage({ typeMessage: 'bogus', userId: 1 }), /schema validation/);
assert.deepStrictEqual(
    assertValidMessage({ typeMessage: 'logout', userId: 1 }),
    { typeMessage: 'logout', userId: 1 },
);

// --- regression guard: the professor's reference schema is broken and must never be used ---
const professorSchemaPath = path.join(__dirname, '..', 'shared-services', 'lab04', 'lab04-solution-main', 'ws_message_schema.json');
if (fs.existsSync(professorSchemaPath)) {
    const professorAjv = new Ajv({ allErrors: true, strict: false });
    const professorValidate = professorAjv.compile(JSON.parse(fs.readFileSync(professorSchemaPath)));
    const canonicalUpdate = { typeMessage: 'update', userId: 2, userName: 'Frank', filmId: 3, filmTitle: 'X' };
    assert.strictEqual(
        professorValidate(canonicalUpdate),
        false,
        'the professor schema uses "taskName" instead of "filmTitle" and must reject a canonical, correctly-shaped message',
    );
    console.log('Confirmed: professor reference schema (taskName defect) rejects a canonical message, as expected — never used for production validation.');
} else {
    console.log('Professor reference schema not present locally; skipped the regression-guard comparison (not required for this test to pass).');
}

// --- canonical-schema-duplicate consistency guard ---
// shared-services/lab04/schemas/ws_message_schema.json is a pre-existing,
// project-owned reference copy (part of the original Lab04 design-artifact
// scaffolding) that is NOT loaded by the running server — only
// specifications/lab04/schemas/ws_message_schema.json is (see
// shared-services/src/realtime/wsMessageSchema.js). Rather than deleting a
// pre-existing tracked file outside this task's scope, this asserts the two
// stay byte-for-byte identical, so any future edit to one without the other
// fails the suite immediately instead of silently drifting.
const canonicalSchemaPath = path.join(__dirname, '..', 'specifications', 'lab04', 'schemas', 'ws_message_schema.json');
const duplicateSchemaPath = path.join(__dirname, '..', 'shared-services', 'lab04', 'schemas', 'ws_message_schema.json');
assert.strictEqual(
    fs.readFileSync(duplicateSchemaPath, 'utf8'),
    fs.readFileSync(canonicalSchemaPath, 'utf8'),
    `shared-services/lab04/schemas/ws_message_schema.json has drifted from the canonical ` +
    `specifications/lab04/schemas/ws_message_schema.json — keep them byte-identical or remove the duplicate`,
);
console.log('Confirmed: the unused shared-services/lab04/schemas/ws_message_schema.json reference copy is byte-identical to the canonical schema (no silent drift).');

console.log('Lab04 WebSocket message schema tests passed (valid/invalid cases, canonical examples, professor-schema regression guard, canonical-schema-duplicate consistency guard).');

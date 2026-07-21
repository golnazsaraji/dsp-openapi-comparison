const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

// Canonical Lab04 schema ONLY. The professor reference copy under
// shared-services/lab04/lab04-solution-main/ws_message_schema.json uses
// "taskName" instead of "filmTitle" (an apparent copy/paste artifact from a
// different assignment) and is missing several of the allOf constraints this
// schema declares — it must never be used for outgoing message validation.
const schemaPath = path.join(__dirname, '..', '..', '..', 'specifications', 'lab04', 'schemas', 'ws_message_schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

// Compiled once at module load, matching the project's existing AJV
// convention (scripts/lab01-schema-tests.js).
const ajv = new Ajv({ allErrors: true, strict: true, strictRequired: false });
const validate = ajv.compile(schema);

function assertValidMessage(message) {
    const valid = validate(message);
    if (!valid) {
        throw new Error(`WebSocket message failed schema validation: ${ajv.errorsText(validate.errors)}`);
    }
    return message;
}

module.exports = { validate, assertValidMessage, schema, schemaPath };

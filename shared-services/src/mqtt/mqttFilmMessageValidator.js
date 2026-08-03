const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

// Canonical Lab05 schema ONLY. The professor reference copy under
// shared-services/lab05/lab05-solution-main/mqtt_film_message_schema.json
// conditions its `active` requirement on a `typeMessage` property that the
// schema never defines (an apparent copy/paste artifact — the real property
// is `status`), so its conditional requirement never actually triggers. It
// must never be used for outgoing message validation.
const schemaPath = path.join(__dirname, '..', '..', '..', 'specifications', 'lab05', 'schemas', 'mqtt_film_message_schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

// Compiled once at module load (process-lifetime cache), matching the
// project's existing AJV convention (shared-services/src/realtime/wsMessageSchema.js).
const ajv = new Ajv({ allErrors: true, strict: true, strictRequired: false });
const validate = ajv.compile(schema);

function assertValidMessage(message) {
    const valid = validate(message);
    if (!valid) {
        throw new Error(`MQTT film message failed schema validation: ${ajv.errorsText(validate.errors)}`);
    }
    return message;
}

module.exports = { validate, assertValidMessage, schema, schemaPath };

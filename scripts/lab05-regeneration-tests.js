// Proves that the Lab05 MQTT gateway hook is regeneration-safe: it lives in
// the reusable template (out/expressServer.mustache), survives a real
// `npm run generate:final` run unchanged, the Lab04 realtime gateway remains
// attached alongside it, both gateways are closed on shutdown, and
// regeneration produces no unexplained diff outside the files this Lab05
// work is known to have changed. No handwritten patch is applied to, or
// required in, the generated output at any point.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const templatePath = path.join(root, 'out', 'expressServer.mustache');
const generatedPath = path.join(root, 'generated-openapi-generator-custom', 'expressServer.js');

function read(filePath) {
    return fs.readFileSync(filePath, 'utf8');
}

// --- 1. the source template contains the MQTT adapter hook ---
const templateSource = read(templatePath);
assert.match(templateSource, /require\(['"]\.\.\/adapters\/openapi-generator\/mqttGateway['"]\)/, 'out/expressServer.mustache must require the MQTT adapter hook');
assert.match(templateSource, /mqttGateway\.attach\(/, 'out/expressServer.mustache must call mqttGateway.attach()');
assert.match(templateSource, /this\.mqttGateway\.close\(\)/, 'out/expressServer.mustache must call this.mqttGateway.close() during shutdown');
// --- Lab04 realtime gateway remains attached alongside it, in the template ---
assert.match(templateSource, /require\(['"]\.\.\/adapters\/openapi-generator\/realtimeGateway['"]\)/, 'out/expressServer.mustache must still require the Lab04 realtime gateway hook');
assert.match(templateSource, /realtimeGateway\.attach\(/, 'out/expressServer.mustache must still call realtimeGateway.attach()');
assert.match(templateSource, /this\.realtimeGateway\.close\(\)/, 'out/expressServer.mustache must still call this.realtimeGateway.close() during shutdown');
console.log('Confirmed: out/expressServer.mustache (source template) contains both the Lab04 realtime and Lab05 MQTT adapter hooks, attach and close.');

// --- 2. run a real regeneration ---
const genResult = spawnSync('npm', ['run', 'generate:final'], { cwd: root, encoding: 'utf8', timeout: 120000 });
assert.strictEqual(genResult.status, 0, `npm run generate:final must exit 0. stdout:\n${genResult.stdout}\nstderr:\n${genResult.stderr}`);

// --- 3. the generated server contains the corresponding generated hook ---
const generatedSource = read(generatedPath);
assert.match(generatedSource, /require\(['"]\.\.\/adapters\/openapi-generator\/mqttGateway['"]\)/, 'generated expressServer.js must require the MQTT adapter hook');
assert.match(generatedSource, /mqttGateway\.attach\(/, 'generated expressServer.js must call mqttGateway.attach()');
assert.match(generatedSource, /this\.mqttGateway\.close\(\)/, 'generated expressServer.js must call this.mqttGateway.close() during shutdown');
// --- Lab04 realtime gateway remains attached in the generated output too ---
assert.match(generatedSource, /require\(['"]\.\.\/adapters\/openapi-generator\/realtimeGateway['"]\)/, 'generated expressServer.js must still require the Lab04 realtime gateway hook');
assert.match(generatedSource, /realtimeGateway\.attach\(/, 'generated expressServer.js must still call realtimeGateway.attach()');
assert.match(generatedSource, /this\.realtimeGateway\.close\(\)/, 'generated expressServer.js must still call this.realtimeGateway.close() during shutdown');
console.log('Confirmed: the generated server (generated-openapi-generator-custom/expressServer.js) contains both the Lab04 realtime and Lab05 MQTT gateway attach/close calls.');

// --- 4. no handwritten patch is required in generated output: the generated file
// is byte-identical to the reusable template (this project's expressServer.mustache
// uses no {{mustache}} substitution — it is a static passthrough — so the generated
// copy and the template must match exactly; any divergence would mean either a stray
// hand-edit of the generated file, or a template feature this test needs updating for) ---
assert.strictEqual(generatedSource, templateSource, 'generated expressServer.js must be byte-identical to out/expressServer.mustache — any difference indicates either a hand-patch in the generated (regeneration-unsafe) file, or an undocumented templating feature');
console.log('Confirmed: generated expressServer.js is byte-identical to the source template — no handwritten patch exists in, or is required by, the generated output.');

// --- 5. regeneration produces no unexplained diff: only the files this Lab05 work
// is known to touch may show up in `git diff` against the last commit ---
const expectedChangedFiles = new Set([
    'generated-openapi-generator-custom/api/openapi.yaml',
    'generated-openapi-generator-custom/expressServer.js',
]);
const diffResult = execFileSync('git', ['diff', '--name-only', '--', 'generated-openapi-generator-custom/'], { cwd: root, encoding: 'utf8' });
const changedFiles = diffResult.split('\n').map((line) => line.trim()).filter(Boolean);
const unexpected = changedFiles.filter((file) => !expectedChangedFiles.has(file));
assert.deepStrictEqual(unexpected, [], `regeneration must not produce changes outside the expected Lab05 files; unexpected changed file(s): ${JSON.stringify(unexpected)}`);
console.log(`Confirmed: regeneration touched only the expected file(s) under generated-openapi-generator-custom/: ${changedFiles.join(', ') || '(none — already up to date)'}.`);

// --- 6. regeneration is idempotent: running it again produces byte-identical output ---
const secondGenResult = spawnSync('npm', ['run', 'generate:final'], { cwd: root, encoding: 'utf8', timeout: 120000 });
assert.strictEqual(secondGenResult.status, 0, 'a second npm run generate:final must also exit 0');
const afterSecondRun = read(generatedPath);
assert.strictEqual(afterSecondRun, generatedSource, 'a second regeneration run must produce byte-identical output to the first (deterministic generation)');
console.log('Confirmed: regeneration is idempotent — a second run produces byte-identical generated output.');

console.log('Lab05 regeneration tests passed (template hook present, generated hook present, Lab04+Lab05 gateways both attach/close, no hand-patch, no unexplained diff, idempotent).');

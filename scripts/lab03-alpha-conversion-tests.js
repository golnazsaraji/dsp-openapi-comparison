// Regression coverage for two real defects found during manual execution,
// both boiling down to "ImageIO.write(decodedImage, 'jpeg', ...) returns
// false for a BufferedImage color model the baseline JPEG writer can't
// encode" — which the server used to misreport as "No ImageIO writer
// available for JPG" (or later "Image conversion to JPG failed") when a JPEG
// writer does exist, it just can't encode *that particular* color model:
//   1. An alpha channel (ARGB/TYPE_INT_ARGB) — JPEG has no transparency.
//   2. A 16-bit-per-channel raster (TYPE_CUSTOM, hasAlpha=false) — confirmed
//      via macOS `file` on the real reported fixture ("16-bit/color RGB");
//      an alpha-only check does not catch this at all.
// Root cause both times: every prior test fixture used TYPE_INT_RGB (8-bit,
// no alpha), so neither JPEG-incompatible path was ever exercised. Fixed in
// ConversionProtocol.prepareForTarget(): every JPG target now unconditionally
// normalizes the decoded source to an 8-bit opaque TYPE_INT_RGB image
// (composited onto white) before encoding — not just when hasAlpha() is true.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const javaRoot = path.join(root, 'shared-services', 'lab03');
const binDir = path.join(javaRoot, 'bin');
const binTestDir = path.join(javaRoot, 'bin-test');
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dsp-lab03-alpha-'));

const READY_PATTERN = /listening on port (\d+)/;
const runningServers = [];

function buildMain() {
    fs.rmSync(binDir, { recursive: true, force: true });
    const sources = fs.readdirSync(path.join(javaRoot, 'src', 'main', 'java', 'it', 'polito', 'dsp', 'lab03'))
        .filter((name) => name.endsWith('.java'))
        .map((name) => path.join('src', 'main', 'java', 'it', 'polito', 'dsp', 'lab03', name));
    const build = spawnSync('javac', ['-d', 'bin', ...sources], { cwd: javaRoot, stdio: 'inherit' });
    if (build.error?.code === 'ENOENT') throw new Error('javac is required for npm run test:lab03.');
    assert.strictEqual(build.status, 0, 'Lab03 Java build failed');
}

function buildTestTools() {
    fs.rmSync(binTestDir, { recursive: true, force: true });
    const sources = fs.readdirSync(path.join(javaRoot, 'src', 'test', 'java', 'it', 'polito', 'dsp', 'lab03'))
        .filter((name) => name.endsWith('.java'))
        .map((name) => path.join('src', 'test', 'java', 'it', 'polito', 'dsp', 'lab03', name));
    const build = spawnSync('javac', ['-d', 'bin-test', ...sources], { cwd: javaRoot, stdio: 'inherit' });
    assert.strictEqual(build.status, 0, 'Lab03 test-tool build failed');
}

function generateFixture(format, width, height, fileName) {
    const outputPath = path.join(temporaryRoot, fileName);
    const result = spawnSync('java', ['-cp', 'bin-test', 'it.polito.dsp.lab03.FixtureGenerator', format, String(width), String(height), outputPath], {
        cwd: javaRoot, encoding: 'utf8',
    });
    assert.strictEqual(result.status, 0, `fixture generation failed for ${fileName}: ${result.stderr}`);
    return outputPath;
}

function inspectImage(filePath, sample) {
    const args = ['-cp', 'bin-test', 'it.polito.dsp.lab03.ImageInspector', filePath];
    if (sample) args.push(String(sample.x), String(sample.y));
    const result = spawnSync('java', args, { cwd: javaRoot, encoding: 'utf8' });
    assert.strictEqual(result.status, 0, `image inspection failed for ${filePath}: ${result.stderr}`);
    const fields = {};
    for (const match of result.stdout.matchAll(/(\w+)=(\S+)/g)) fields[match[1]] = match[2];
    return {
        format: fields.format,
        width: fields.width ? Number(fields.width) : undefined,
        height: fields.height ? Number(fields.height) : undefined,
        distinctColors: fields.distinctColors ? Number(fields.distinctColors) : undefined,
        hasAlpha: fields.hasAlpha === 'true',
        bytes: fields.bytes ? Number(fields.bytes) : undefined,
        pixelR: fields.pixelR !== undefined ? Number(fields.pixelR) : undefined,
        pixelG: fields.pixelG !== undefined ? Number(fields.pixelG) : undefined,
        pixelB: fields.pixelB !== undefined ? Number(fields.pixelB) : undefined,
    };
}

function normalizeType(rawFormat) {
    const upper = (rawFormat || '').toUpperCase();
    return upper === 'JPEG' ? 'JPG' : upper;
}

function startServer(javaOptions = []) {
    const proc = spawn('java', [...javaOptions, '-cp', 'bin', 'it.polito.dsp.lab03.ConverterServer', '0'], {
        cwd: javaRoot, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdoutBuffer = '';
    let stderrBuffer = '';
    proc.stdout.on('data', (chunk) => { stdoutBuffer += chunk; });
    proc.stderr.on('data', (chunk) => { stderrBuffer += chunk; });
    const portPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`server did not start in time. stderr: ${stderrBuffer}`)), 15000);
        const check = () => {
            const match = stdoutBuffer.match(READY_PATTERN);
            if (match) { clearTimeout(timeout); resolve(Number(match[1])); }
        };
        proc.stdout.on('data', check);
        proc.once('exit', (code) => reject(new Error(`server exited before startup (code ${code}). stderr: ${stderrBuffer}`)));
    });
    const server = { proc, portPromise, exited: false };
    proc.once('exit', () => { server.exited = true; });
    runningServers.push(server);
    return server;
}

function stopServerCleanly(server, { timeoutMs = 5000 } = {}) {
    return new Promise((resolve) => {
        if (server.exited) { resolve(); return; }
        const timeout = setTimeout(() => server.proc.kill('SIGKILL'), timeoutMs);
        server.proc.once('exit', () => { clearTimeout(timeout); resolve(); });
        server.proc.kill('SIGTERM');
    });
}

function buildRequestHeader(sourceType, targetType, length) {
    const header = Buffer.alloc(10);
    header.write(sourceType, 0, 3, 'ascii');
    header.write(targetType, 3, 3, 'ascii');
    header.writeInt32BE(length, 6);
    return header;
}

function sendRaw(port, chunks) {
    return new Promise((resolve, reject) => {
        const socket = net.connect(port, '127.0.0.1');
        const received = [];
        socket.on('data', (chunk) => received.push(chunk));
        socket.on('error', reject);
        socket.on('close', () => resolve(Buffer.concat(received)));
        socket.on('connect', () => {
            for (const chunk of chunks) socket.write(chunk);
            socket.end();
        });
    });
}

function parseResponse(buf) {
    assert(buf.length >= 5, `response too short (${buf.length} bytes)`);
    const status = String.fromCharCode(buf[0]);
    const length = buf.readInt32BE(1);
    assert.strictEqual(buf.length, 5 + length, 'declared response length must equal the exact received payload length');
    const payload = buf.subarray(5, 5 + length);
    return { status, length, payload };
}

async function convert(port, sourcePath, sourceType, targetType) {
    const body = fs.readFileSync(sourcePath);
    const header = buildRequestHeader(sourceType, targetType, body.length);
    const raw = await sendRaw(port, [header, body]);
    return parseResponse(raw);
}

// Tolerant, semantic pixel checks only — JPEG is lossy, so exact pixel
// equality is never asserted, per the task's own instruction.
function assertNearWhite(pixel, label) {
    assert(pixel.pixelR > 235 && pixel.pixelG > 235 && pixel.pixelB > 235,
        `${label}: expected a transparent region composited onto white, got rgb(${pixel.pixelR},${pixel.pixelG},${pixel.pixelB})`);
}
function assertPinkish(pixel, label) {
    // 50%-alpha red over white should land near (255, ~127, ~127): red channel high, green/blue mid-range, not black.
    assert(pixel.pixelR > 200, `${label}: red channel should stay high, got ${pixel.pixelR}`);
    assert(pixel.pixelG > 70 && pixel.pixelG < 190, `${label}: green channel should be mid-range (blended toward white), got ${pixel.pixelG}`);
    assert(pixel.pixelB > 70 && pixel.pixelB < 190, `${label}: blue channel should be mid-range (blended toward white), got ${pixel.pixelB}`);
}
function assertGreenish(pixel, label) {
    assert(pixel.pixelG > 150, `${label}: green channel should dominate, got ${pixel.pixelG}`);
    assert(pixel.pixelG > pixel.pixelR + 30, `${label}: green should exceed red by a clear margin, got r=${pixel.pixelR} g=${pixel.pixelG}`);
    assert(pixel.pixelG > pixel.pixelB + 30, `${label}: green should exceed blue by a clear margin, got g=${pixel.pixelG} b=${pixel.pixelB}`);
}

let checks = 0;

(async () => {
    buildMain();
    buildTestTools();

    const server = startServer([]);
    const port = await server.portPromise;

    try {
        // Bands: rows [0,10) fully transparent, [10,20) 50%-alpha red, [20,30) fully opaque green.
        const alphaPng = generateFixture('png-alpha', 20, 30, 'alpha-bands.png');
        const alphaGif = generateFixture('gif-alpha', 20, 30, 'alpha-bands.gif');
        const opaqueAlphaPng = generateFixture('png-opaque-alpha', 20, 15, 'opaque-alpha.png');
        const sixteenBitRgbPng = generateFixture('png-16bit', 20, 15, 'sixteen-bit.png');
        const plainRgbPng = generateFixture('png', 20, 15, 'plain-rgb.png');

        // Confirm the 16-bit fixture truly decodes with a JPEG-incompatible,
        // non-8-bit raster before relying on it — not merely assumed.
        {
            const info = inspectImage(sixteenBitRgbPng);
            assert.strictEqual(normalizeType(info.format), 'PNG', '16-bit fixture must be a real PNG');
            assert.strictEqual(info.hasAlpha, false, '16-bit fixture must have no alpha (this defect is not an alpha problem)');
            assert(info.distinctColors > 20, '16-bit fixture must have real (non-blank) content');
        }

        // --- A. transparent PNG -> JPG succeeds, composited correctly, no alpha in output ---
        {
            const response = await convert(port, alphaPng, 'PNG', 'JPG');
            assert.strictEqual(response.status, '0', `alpha PNG -> JPG should succeed, got status '${response.status}' (${response.payload.toString('ascii')})`);
            const outputPath = path.join(temporaryRoot, 'a-output.jpg');
            fs.writeFileSync(outputPath, response.payload);
            const info = inspectImage(outputPath);
            assert.strictEqual(normalizeType(info.format), 'JPG', 'output must actually be a JPEG');
            assert.strictEqual(info.width, 20, 'width must be preserved');
            assert.strictEqual(info.height, 30, 'height must be preserved');
            assert.strictEqual(info.hasAlpha, false, 'JPEG output must never have an alpha channel');
            assertNearWhite(inspectImage(outputPath, { x: 10, y: 5 }), 'transparent band (row 5)');
            assertPinkish(inspectImage(outputPath, { x: 10, y: 15 }), 'translucent red band (row 15)');
            assertGreenish(inspectImage(outputPath, { x: 10, y: 25 }), 'opaque green band (row 25)');
            checks++;
        }

        // --- B. fully opaque PNG stored with an alpha channel -> JPG succeeds (the exact originally-reported defect) ---
        {
            const response = await convert(port, opaqueAlphaPng, 'PNG', 'JPG');
            assert.strictEqual(response.status, '0', `fully-opaque alpha-bearing PNG -> JPG should succeed, got status '${response.status}' (${response.payload.toString('ascii')})`);
            const outputPath = path.join(temporaryRoot, 'b-output.jpg');
            fs.writeFileSync(outputPath, response.payload);
            const info = inspectImage(outputPath);
            assert.strictEqual(normalizeType(info.format), 'JPG');
            assert.strictEqual(info.width, 20);
            assert.strictEqual(info.height, 15);
            assert.strictEqual(info.hasAlpha, false);
            assert(info.distinctColors > 20, `output must have real (non-blank) content, got ${info.distinctColors} distinct colors`);
            checks++;
        }

        // --- C. transparent GIF -> JPG succeeds where ImageIO preserves transparency ---
        {
            // GIF only supports binary (fully-on/fully-off) transparency via one
            // palette index, so the 50%-alpha band is not meaningfully distinct
            // from full transparency here — only the fully-transparent and
            // fully-opaque bands are asserted for GIF.
            const response = await convert(port, alphaGif, 'GIF', 'JPG');
            assert.strictEqual(response.status, '0', `alpha GIF -> JPG should succeed, got status '${response.status}' (${response.payload.toString('ascii')})`);
            const outputPath = path.join(temporaryRoot, 'c-output.jpg');
            fs.writeFileSync(outputPath, response.payload);
            const info = inspectImage(outputPath);
            assert.strictEqual(normalizeType(info.format), 'JPG');
            assert.strictEqual(info.width, 20);
            assert.strictEqual(info.height, 30);
            assert.strictEqual(info.hasAlpha, false);
            assertNearWhite(inspectImage(outputPath, { x: 10, y: 5 }), 'GIF transparent band (row 5)');
            assertGreenish(inspectImage(outputPath, { x: 10, y: 25 }), 'GIF opaque green band (row 25)');
            checks++;
        }

        // --- D. PNG -> PNG preserves alpha (must not be flattened; only a JPG target is) ---
        {
            const response = await convert(port, alphaPng, 'PNG', 'PNG');
            assert.strictEqual(response.status, '0', 'alpha PNG -> PNG should succeed');
            const outputPath = path.join(temporaryRoot, 'd-output.png');
            fs.writeFileSync(outputPath, response.payload);
            const info = inspectImage(outputPath);
            assert.strictEqual(normalizeType(info.format), 'PNG');
            assert.strictEqual(info.width, 20);
            assert.strictEqual(info.height, 30);
            assert.strictEqual(info.hasAlpha, true, 'PNG target must preserve the alpha channel untouched');
            checks++;
        }

        // --- E. PNG -> GIF behavior remains unchanged (not touched by the JPG-only fix) ---
        {
            const response = await convert(port, alphaPng, 'PNG', 'GIF');
            assert.strictEqual(response.status, '0', 'alpha PNG -> GIF should succeed exactly as before the fix');
            const outputPath = path.join(temporaryRoot, 'e-output.gif');
            fs.writeFileSync(outputPath, response.payload);
            const info = inspectImage(outputPath);
            assert.strictEqual(normalizeType(info.format), 'GIF');
            assert.strictEqual(info.width, 20);
            assert.strictEqual(info.height, 30);
            checks++;
        }

        // --- F. existing plain RGB PNG -> JPG still succeeds (no regression for the common non-alpha case) ---
        {
            const response = await convert(port, plainRgbPng, 'PNG', 'JPG');
            assert.strictEqual(response.status, '0', 'plain RGB PNG -> JPG must still succeed exactly as before the fix');
            const outputPath = path.join(temporaryRoot, 'f-output.jpg');
            fs.writeFileSync(outputPath, response.payload);
            const info = inspectImage(outputPath);
            assert.strictEqual(normalizeType(info.format), 'JPG');
            assert.strictEqual(info.width, 20);
            assert.strictEqual(info.height, 15);
            assert.strictEqual(info.hasAlpha, false);
            checks++;
        }

        // --- G. 16-bit-per-channel RGB PNG -> JPG succeeds (the follow-up defect: not an alpha problem at all) ---
        {
            const response = await convert(port, sixteenBitRgbPng, 'PNG', 'JPG');
            assert.strictEqual(response.status, '0', `16-bit RGB PNG -> JPG should succeed, got status '${response.status}' (${response.payload.toString('ascii')})`);
            const outputPath = path.join(temporaryRoot, 'g-output.jpg');
            fs.writeFileSync(outputPath, response.payload);
            const info = inspectImage(outputPath);
            assert.strictEqual(normalizeType(info.format), 'JPG', 'output must actually be a JPEG');
            assert.strictEqual(info.width, 20, 'width must be preserved');
            assert.strictEqual(info.height, 15, 'height must be preserved');
            assert.strictEqual(info.hasAlpha, false, 'JPEG output must never have an alpha channel');
            assert(info.distinctColors > 20, `output must have real (non-blank) content, got ${info.distinctColors} distinct colors`);
            checks++;
        }

        console.log(`Lab03 alpha-channel conversion tests passed (${checks} scenarios: transparent PNG/GIF -> JPG, fully-opaque alpha-bearing PNG -> JPG, 16-bit RGB PNG -> JPG (both original + follow-up defects), PNG/GIF alpha preserved on non-JPG targets, RGB regression).`);
    } finally {
        for (const s of runningServers) {
            if (!s.exited) await stopServerCleanly(s, { timeoutMs: 3000 });
        }
        fs.rmSync(temporaryRoot, { recursive: true, force: true });
        fs.rmSync(binTestDir, { recursive: true, force: true });
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
    for (const s of runningServers) {
        if (!s.exited) s.proc.kill('SIGKILL');
    }
});

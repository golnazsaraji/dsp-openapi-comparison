const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const ConverterClient = require('../shared-services/src/images/ConverterClient');

const root = path.join(__dirname, '..');
const javaRoot = path.join(root, 'shared-services', 'lab02', 'converter-java');
const fixtureRoot = path.join(root, 'postman', 'lab02', 'fixtures');
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dsp-lab02-grpc-'));
const port = 50061;
const maven = process.env.MAVEN_BIN || path.join(javaRoot, 'mvnw');

function waitForServer(process) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Converter did not start in time.')), 30000);
        const inspect = (chunk) => {
            if (String(chunk).includes('Lab02 Converter listening')) {
                clearTimeout(timeout); resolve();
            }
        };
        process.stdout.on('data', inspect);
        process.stderr.on('data', inspect);
        process.once('exit', (code) => reject(new Error(`Converter exited before startup (code ${code}).`)));
    });
}

function validMagic(mediaType, bytes) {
    if (mediaType === 'image/png') return bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    if (mediaType === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
    return bytes.subarray(0, 3).toString('ascii') === 'GIF';
}

(async () => {
    const build = spawnSync(maven, ['-q', 'test', 'package'], { cwd: javaRoot, stdio: 'inherit' });
    if (build.error?.code === 'ENOENT') throw new Error('Maven is required for npm run test:lab02:integration.');
    assert.strictEqual(build.status, 0, 'Java Converter build/tests failed');
    const server = spawn(maven, ['-q', 'exec:java'], {
        cwd: javaRoot,
        env: { ...process.env, CONVERTER_GRPC_PORT: String(port) },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    try {
        await waitForServer(server);
        const client = new ConverterClient({ address: `localhost:${port}`, deadlineMs: 10000, chunkSize: 1024 });
        const cases = [
            ['valid.png', 'image/png', 'image/jpeg'],
            ['valid.png', 'image/png', 'image/gif'],
            ['valid.jpg', 'image/jpeg', 'image/png'],
            ['valid.jpg', 'image/jpeg', 'image/gif'],
            ['valid.gif', 'image/gif', 'image/png'],
            ['valid.gif', 'image/gif', 'image/jpeg'],
        ];
        for (const [file, sourceMediaType, targetMediaType] of cases) {
            const outputPath = path.join(temporaryRoot, `${file}-${targetMediaType.replace('/', '-')}`);
            await client.convert({ sourcePath: path.join(fixtureRoot, file), sourceMediaType, targetMediaType, outputPath });
            assert(validMagic(targetMediaType, fs.readFileSync(outputPath)), `${sourceMediaType} -> ${targetMediaType} magic bytes`);
        }
        const corrupt = path.join(temporaryRoot, 'corrupt.png');
        fs.writeFileSync(corrupt, 'not an image');
        await assert.rejects(
            client.convert({ sourcePath: corrupt, sourceMediaType: 'image/png', targetMediaType: 'image/jpeg', outputPath: path.join(temporaryRoot, 'bad.jpg') }),
            (error) => error.status === 422,
        );
        const recovery = path.join(temporaryRoot, 'recovery.jpg');
        await client.convert({ sourcePath: path.join(fixtureRoot, 'valid.png'), sourceMediaType: 'image/png', targetMediaType: 'image/jpeg', outputPath: recovery });
        assert(validMagic('image/jpeg', fs.readFileSync(recovery)));
        console.log('Real Java gRPC integration passed: six conversion directions plus failure recovery.');
    } finally {
        server.kill('SIGTERM');
        fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
})().catch((error) => { console.error(error); process.exitCode = 1; });

const http = require('http');
const https = require('https');

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

function request(method, pathname, body) {
  const url = new URL(pathname, baseUrl);
  const payload = body === undefined ? null : JSON.stringify(body);
  const transport = url.protocol === 'https:' ? https : http;
  const headers = {};

  if (payload) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = Buffer.byteLength(payload);
  }

  return new Promise((resolve, reject) => {
    const req = transport.request(url, { method, headers }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        raw += chunk;
      });
      res.on('end', () => {
        let data = raw;
        try {
          data = raw ? JSON.parse(raw) : null;
        } catch (error) {
          data = raw;
        }
        resolve({ status: res.statusCode, data });
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertStatus(response, expected, label) {
  assert(
    response.status === expected,
    `${label}: expected status ${expected}, received ${response.status} with ${JSON.stringify(response.data)}`,
  );
}

async function step(label, fn) {
  process.stdout.write(`- ${label}... `);
  const result = await fn();
  console.log('ok');
  return result;
}

async function main() {
  console.log(`Smoke testing initial example server at ${baseUrl}`);

  await step('status', async () => {
    const response = await request('GET', '/status');
    assertStatus(response, 200, 'GET /status');
    assert(response.data.status === 'ok', 'status response should be ok');
  });

  await step('list films', async () => {
    const response = await request('GET', '/films');
    assertStatus(response, 200, 'GET /films');
    assert(Array.isArray(response.data), 'films response should be an array');
    assert(response.data.length > 0, 'films response should not be empty');
  });

  await step('get film by id', async () => {
    const response = await request('GET', '/films/1');
    assertStatus(response, 200, 'GET /films/1');
    assert(response.data.id === 1, 'film id should be 1');
  });

  const createdFilm = await step('create film', async () => {
    const response = await request('POST', '/films', { title: 'Initial Smoke Film' });
    assertStatus(response, 201, 'POST /films');
    assert(response.data.title === 'Initial Smoke Film', 'created film title should match');
    return response.data;
  });

  await step('delete created film', async () => {
    const response = await request('DELETE', `/films/${createdFilm.id}`);
    assertStatus(response, 204, `DELETE /films/${createdFilm.id}`);
  });

  console.log('Initial example smoke test passed.');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Initial example smoke test failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { main };

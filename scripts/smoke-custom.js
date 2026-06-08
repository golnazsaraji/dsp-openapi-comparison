const http = require('http');
const https = require('https');

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const cookieJar = new Map();

function request(method, pathname, body) {
  const url = new URL(pathname, baseUrl);
  const payload = body === undefined ? null : JSON.stringify(body);
  const transport = url.protocol === 'https:' ? https : http;
  const headers = {};

  if (payload) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = Buffer.byteLength(payload);
  }

  if (cookieJar.size > 0) {
    headers.Cookie = [...cookieJar.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
  }

  return new Promise((resolve, reject) => {
    const req = transport.request(url, { method, headers }, (res) => {
      let raw = '';

      for (const cookie of res.headers['set-cookie'] || []) {
        const [pair] = cookie.split(';');
        const [key, value] = pair.split('=');
        cookieJar.set(key, value);
      }

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

function assertStatus(response, statuses, label) {
  const accepted = Array.isArray(statuses) ? statuses : [statuses];
  assert(
    accepted.includes(response.status),
    `${label}: expected status ${accepted.join(' or ')}, received ${response.status} with ${JSON.stringify(response.data)}`,
  );
}

async function step(label, fn) {
  process.stdout.write(`- ${label}... `);
  const result = await fn();
  console.log('ok');
  return result;
}

async function main() {
  console.log(`Smoke testing generated custom server at ${baseUrl}`);

  await step('health check', async () => {
    const response = await request('GET', '/health');
    assertStatus(response, 200, 'GET /health');
    assert(response.data.status === 'ok', 'health response should be ok');
  });

  await step('list public films', async () => {
    const response = await request('GET', '/api/films/public');
    assertStatus(response, 200, 'GET /api/films/public');
    assert(Array.isArray(response.data.items), 'public films response should contain an items array');
    assert(response.data.items.length > 0, 'public films response should not be empty');
    assert(response.data.pagination.page === 1, 'public films response should include pagination');
  });

  await step('login as Frank', async () => {
    const response = await request('POST', '/api/sessions', {
      email: 'frank@example.com',
      password: 'password',
    });
    assertStatus(response, [200, 201], 'POST /api/sessions');
    assert(response.data.id === 2, 'Frank should have id 2');
    assert(cookieJar.has('connect-sid'), 'login should set connect-sid cookie');
  });

  await step('read current session', async () => {
    const response = await request('GET', '/api/sessions/current');
    assertStatus(response, 200, 'GET /api/sessions/current');
    assert(response.data.email === 'frank@example.com', 'current session should be Frank');
  });

  await step('read online users snapshot', async () => {
    const response = await request('GET', '/api/users/online');
    assertStatus(response, 200, 'GET /api/users/online');
    assert(Array.isArray(response.data), 'online users snapshot should be an array');
    assert(response.data.some((user) => user.userId === 2), 'online users should include Frank after login');
  });

  await step('list films to review', async () => {
    const response = await request('GET', '/api/films/to-review');
    assertStatus(response, 200, 'GET /api/films/to-review');
    assert(Array.isArray(response.data.items), 'films to review should contain an items array');
    assert(response.data.pagination.page === 1, 'films to review should include pagination');
  });

  await step('select active film', async () => {
    const response = await request('PUT', '/api/films/2/active');
    assertStatus(response, 200, 'PUT /api/films/2/active');
    assert(response.data.active === true, 'selected review should be active');
    assert(Array.isArray(response.data.mqtt), 'selected review should include MQTT status messages');
    assert(response.data.mqtt.some((item) => item.filmId === 2 && item.message.status === 'active'), 'MQTT messages should mark film 2 active');
  });

  const createdFilm = await step('create public film', async () => {
    const response = await request('POST', '/api/films', {
      title: 'Smoke Test Film',
      private: false,
      watchDate: '2026-06-03',
      rating: 8,
      favorite: false,
    });
    assertStatus(response, [200, 201], 'POST /api/films');
    assert(response.data.title === 'Smoke Test Film', 'created film title should match');
    return response.data;
  });

  await step('update created film', async () => {
    const response = await request('PUT', `/api/films/${createdFilm.id}`, {
      title: 'Smoke Test Film Updated',
      private: false,
      watchDate: '2026-06-03',
      rating: 9,
      favorite: true,
    });
    assertStatus(response, 200, `PUT /api/films/${createdFilm.id}`);
    assert(response.data.title === 'Smoke Test Film Updated', 'updated film title should match');
  });

  await step('invite reviewer to created film', async () => {
    const response = await request('POST', `/api/films/${createdFilm.id}/reviews`, {
      reviewerId: 3,
    });
    assertStatus(response, [200, 201], `POST /api/films/${createdFilm.id}/reviews`);
    assert(response.data.reviewerId === 3, 'review invitation should target Karen');
  });

  await step('remove review invitation', async () => {
    const response = await request('DELETE', `/api/films/${createdFilm.id}/reviews/3`);
    assertStatus(response, [200, 204], `DELETE /api/films/${createdFilm.id}/reviews/3`);
  });

  await step('delete created film', async () => {
    const response = await request('DELETE', `/api/films/${createdFilm.id}`);
    assertStatus(response, [200, 204], `DELETE /api/films/${createdFilm.id}`);
  });

  await step('conflict when Karen selects Frank active film', async () => {
    const login = await request('POST', '/api/sessions', {
      email: 'karen@example.com',
      password: 'password',
    });
    assertStatus(login, [200, 201], 'POST /api/sessions as Karen');

    const conflict = await request('PUT', '/api/films/2/active');
    assertStatus(conflict, 409, 'PUT /api/films/2/active as Karen');
  });

  console.log('Smoke test passed.');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Smoke test failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { main };

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

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
        resolve({ status: res.statusCode, headers: res.headers, data });
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function uploadImage(pathname) {
  const url = new URL(pathname, baseUrl);
  const transport = url.protocol === 'https:' ? https : http;
  const boundary = `----dsp-smoke-${Date.now()}`;
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  const payload = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="smoke-upload.png"\r\nContent-Type: image/png\r\n\r\n`),
    image,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const headers = {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': payload.length,
  };

  if (cookieJar.size > 0) {
    headers.Cookie = [...cookieJar.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
  }

  return new Promise((resolve, reject) => {
    const req = transport.request(url, { method: 'POST', headers }, (res) => {
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
        resolve({ status: res.statusCode, headers: res.headers, data });
      });
    });

    req.on('error', reject);
    req.write(payload);
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

  await step('discover API links', async () => {
    const response = await request('GET', '/api');
    assertStatus(response, 200, 'GET /api');
    assert(response.data.publicFilms === '/api/films/public', 'API entry point should link to public films');
  });

  await step('list public films', async () => {
    const response = await request('GET', '/api/films/public');
    assertStatus(response, 200, 'GET /api/films/public');
    assert(Array.isArray(response.data.films), 'public films response should contain a films array');
    assert(response.data.films.length > 0, 'public films response should not be empty');
    assert(response.data.currentPage === 1, 'public films response should include currentPage');
  });

  await step('reject protected request without a session', async () => {
    const response = await request('GET', '/api/films');
    assertStatus(response, 401, 'GET /api/films without session');
  });

  await step('reject invalid credentials', async () => {
    const response = await request('POST', '/api/sessions', {
      email: 'frank@example.com',
      password: 'incorrect',
    });
    assertStatus(response, 401, 'POST /api/sessions with invalid credentials');
  });

  await step('login as Frank', async () => {
    const response = await request('POST', '/api/sessions', {
      email: 'frank@example.com',
      password: 'password',
    });
    assertStatus(response, 200, 'POST /api/sessions');
    assert(response.data.id === 2, 'Frank should have id 2');
    assert(cookieJar.has('connect.sid'), 'login should set connect.sid cookie');
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

  await step('list users without authentication data', async () => {
    const response = await request('GET', '/api/users');
    assertStatus(response, 200, 'GET /api/users');
    assert(response.data.some((user) => user.id === 2), 'user list should include Frank');
    assert(response.data.every((user) => user.password === undefined && user.passwordHash === undefined), 'user responses must not expose password data');
  });

  await step('list films to review', async () => {
    const response = await request('GET', '/api/films/to-review');
    assertStatus(response, 200, 'GET /api/films/to-review');
    assert(Array.isArray(response.data.films), 'films to review should contain a films array');
    assert(response.data.currentPage === 1, 'films to review should include pagination');
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
    });
    assertStatus(response, [200, 201], 'POST /api/films');
    assert(response.data.title === 'Smoke Test Film', 'created film title should match');
    return response.data;
  });

  let uploadedFile;

  await step('update created film', async () => {
    const response = await request('PUT', `/api/films/${createdFilm.id}`, {
      title: 'Smoke Test Film Updated',
      private: false,
    });
    assertStatus(response, 204, `PUT /api/films/${createdFilm.id}`);
  });

  await step('invite reviewer to created film', async () => {
    const response = await request('POST', `/api/films/${createdFilm.id}/reviews`, [{
      filmId: createdFilm.id,
      reviewerId: 3,
    }]);
    assertStatus(response, 201, `POST /api/films/${createdFilm.id}/reviews`);
    assert(response.data[0].reviewerId === 3, 'review invitation should target Karen');
  });

  await step('upload image to configured runtime storage', async () => {
    const response = await uploadImage(`/api/films/${createdFilm.id}/images`);
    assertStatus(response, 201, `POST /api/films/${createdFilm.id}/images`);
    assert(
      /^application\/json(?:;|$)/i.test(response.headers['content-type'] || ''),
      'upload response Content-Type should be application/json',
    );
    assert(response.data && typeof response.data === 'object', 'upload response should be an Image object');
    ['id', 'filmId', 'name', 'mediaType', 'self'].forEach((field) => {
      assert(response.data[field] !== undefined, `upload response should include ${field}`);
    });
    assert(response.data.filmId === createdFilm.id, 'uploaded image filmId should match the target film');
    assert(response.data.self === `/api/films/${createdFilm.id}/images/${response.data.id}`, 'uploaded image self link should be correct');
    const uploadDirectory = path.resolve(
      process.env.UPLOAD_DIR || path.join(__dirname, '..', 'runtime-data', 'uploaded_files'),
    );
    const metadataPath = path.resolve(
      process.env.IMAGE_METADATA_PATH || path.join(__dirname, '..', 'runtime-data', 'image-metadata.json'),
    );
    const persistedMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    const persistedImage = persistedMetadata.images.find((image) => image.id === response.data.id && image.filmId === createdFilm.id);
    assert(persistedImage, 'uploaded image metadata should be persisted');
    uploadedFile = path.join(uploadDirectory, persistedImage.storageKey);
    assert(
      fs.existsSync(uploadedFile),
      `uploaded image should exist in ${uploadDirectory}`,
    );
    const metadata = await request('GET', response.data.self);
    assertStatus(metadata, 200, `GET ${response.data.self}`);
    assert(/^application\/json(?:;|$)/i.test(metadata.headers['content-type'] || ''), 'image metadata should be JSON');
    ['id', 'filmId', 'name', 'mediaType', 'self'].forEach((field) => {
      assert(metadata.data[field] === response.data[field], `image metadata ${field} should match upload response`);
    });
  });

  await step('remove review invitation', async () => {
    const response = await request('DELETE', `/api/films/${createdFilm.id}/reviews/3`);
    assertStatus(response, [200, 204], `DELETE /api/films/${createdFilm.id}/reviews/3`);
  });

  await step('delete created film', async () => {
    const response = await request('DELETE', `/api/films/${createdFilm.id}`);
    assertStatus(response, [200, 204], `DELETE /api/films/${createdFilm.id}`);
    assert(!fs.existsSync(uploadedFile), 'deleting a film should remove its stored image file');
    const deletedFilm = await request('GET', `/api/films/public/${createdFilm.id}`);
    assertStatus(deletedFilm, 404, `GET deleted film ${createdFilm.id}`);
    const deletedImages = await request('GET', `/api/films/${createdFilm.id}/images`);
    assertStatus(deletedImages, 404, `GET images for deleted film ${createdFilm.id}`);
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

  await step('logout invalidates the session', async () => {
    const logout = await request('DELETE', '/api/sessions/current');
    assertStatus(logout, 204, 'DELETE /api/sessions/current');
    const current = await request('GET', '/api/sessions/current');
    assertStatus(current, 401, 'GET /api/sessions/current after logout');
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

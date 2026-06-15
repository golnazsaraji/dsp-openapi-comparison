# Service URL Reference

This document lists the Film Manager services exposed by the generated servers.

The same URLs are expected after regeneration because they come from the canonical
OpenAPI contract:

```text
openapi/openapi.yaml
```

## Running The Custom OpenAPI Generator Server

From the project root:

```bash
npm start
```

This regenerates `generated-openapi-generator-custom`, installs its dependencies, and
leaves the generated server running.

Base URL:

```text
http://localhost:3000
```

Useful browser pages:

| URL | Purpose |
|---|---|
| `http://localhost:3000/api-docs` | Swagger UI for browsing and testing the API |
| `http://localhost:3000/openapi` | Generated OpenAPI YAML served by the server |
| `http://localhost:3000/health` | Quick health check |

`GET /` is not an API route, so `http://localhost:3000/` returns `404 not found`.
That is expected for the generated API server.

The OpenAPI `servers` URL is relative (`/`), so Swagger UI sends requests to the
same host and port where it is opened. For example, if Swagger UI is opened from
`http://localhost:3000/api-docs`, the requests also go to `localhost:3000`.

If port `3000` is already busy, you can temporarily run the same generated server on
another port:

```bash
PORT=3101 npm start
```

Then run the smoke test with:

```bash
BASE_URL=http://localhost:3101 npm test
```

## Public Services

These endpoints do not require login.

| Method | URL | Operation ID | Purpose |
|---|---|---|---|
| `GET` | `/health` | `healthGET` | Check that the server is running |
| `POST` | `/api/sessions` | `sessionsPOST` | Login with email and password |
| `GET` | `/api/films/public` | `filmsPublicGET` | List all public films |
| `GET` | `/api/films/public/{filmId}` | `filmsPublicFilmIdGET` | Get one public film |
| `GET` | `/api/films/public/{filmId}/reviews` | `filmsPublicFilmIdReviewsGET` | List reviews for one public film |
| `GET` | `/api/films/public/{filmId}/reviews/{reviewerId}` | `filmsPublicFilmIdReviewsReviewerIdGET` | Get one public review |

Example:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/films/public
```

## Authenticated Services

These endpoints require the `connect-sid` cookie. In the generated custom server, the
login operation sets this cookie so the old check-regenerate-rerun workflow can be tested.

| Method | URL | Operation ID | Purpose |
|---|---|---|---|
| `GET` | `/api/sessions/current` | `sessionsCurrentGET` | Get current user |
| `DELETE` | `/api/sessions/current` | `sessionsCurrentDELETE` | Logout |
| `GET` | `/api/users/online` | `usersOnlineGET` | Get online/active-film snapshot |
| `GET` | `/api/films` | `filmsGET` | List films owned by current user |
| `POST` | `/api/films` | `filmsPOST` | Create a film |
| `GET` | `/api/films/to-review` | `filmsToReviewGET` | List films assigned to current reviewer |
| `GET` | `/api/films/{filmId}` | `filmsFilmIdGET` | Get an accessible film |
| `PUT` | `/api/films/{filmId}` | `filmsFilmIdPUT` | Update an owned film |
| `DELETE` | `/api/films/{filmId}` | `filmsFilmIdDELETE` | Delete an owned film |
| `POST` | `/api/films/{filmId}/reviews` | `filmsFilmIdReviewsPOST` | Invite a reviewer |
| `DELETE` | `/api/films/{filmId}/reviews/{reviewerId}` | `filmsFilmIdReviewsReviewerIdDELETE` | Remove an incomplete review invitation |
| `PUT` | `/api/films/{filmId}/reviews/current` | `filmsFilmIdReviewsCurrentPUT` | Complete current user's review |
| `PUT` | `/api/films/{filmId}/active` | `filmsFilmIdActivePUT` | Select a film as active |
| `DELETE` | `/api/users/current/active-film` | `usersCurrentActiveFilmDELETE` | Clear current user's active film |
| `GET` | `/api/films/{filmId}/images` | `filmsFilmIdImagesGET` | List image metadata |
| `POST` | `/api/films/{filmId}/images` | `filmsFilmIdImagesPOST` | Upload image |
| `GET` | `/api/films/{filmId}/images/{imageId}` | `filmsFilmIdImagesImageIdGET` | Get image metadata or bytes |
| `DELETE` | `/api/films/{filmId}/images/{imageId}` | `filmsFilmIdImagesImageIdDELETE` | Delete image |

## Smoke Test Sequence

Use this sequence after starting the generated custom server and again after regeneration.

```bash
curl http://localhost:3000/health

curl http://localhost:3000/api/films/public

curl -c /tmp/dsp-cookies.txt \
  -H 'Content-Type: application/json' \
  -d '{"email":"frank@example.com","password":"password"}' \
  http://localhost:3000/api/sessions

curl -b /tmp/dsp-cookies.txt \
  http://localhost:3000/api/films/to-review

curl -b /tmp/dsp-cookies.txt \
  -X PUT \
  http://localhost:3000/api/films/2/active
```

Expected result:

- `GET /health` returns `{"status":"ok"}`
- `GET /api/films/public` returns public films
- `POST /api/sessions` returns the logged-in user and sets `connect-sid`
- `GET /api/films/to-review` returns Frank's review films
- `PUT /api/films/2/active` returns the active review

## Automated Smoke Test

The same check is also available as a script from the project root. It expects the
generated custom server to already be running:

```bash
npm test
```

The script tests representative calls across the generated API layer, adapter layer, and
shared service layer:

| Method | URL | Purpose |
|---|---|---|
| `GET` | `/health` | Verifies the generated server is running |
| `GET` | `/api/films/public` | Verifies public read operations |
| `POST` | `/api/sessions` | Verifies login and cookie creation |
| `GET` | `/api/sessions/current` | Verifies authenticated session state |
| `GET` | `/api/films/to-review` | Verifies authenticated review listing |
| `PUT` | `/api/films/2/active` | Verifies active film selection |
| `POST` | `/api/films` | Verifies film creation |
| `PUT` | `/api/films/{filmId}` | Verifies film update |
| `POST` | `/api/films/{filmId}/reviews` | Verifies reviewer invitation |
| `DELETE` | `/api/films/{filmId}/reviews/{reviewerId}` | Verifies invitation removal |
| `DELETE` | `/api/films/{filmId}` | Verifies film deletion |
| `PUT` | `/api/films/2/active` as Karen | Verifies conflict detection with `409` |

After regeneration/startup, use this workflow:

```bash
npm start
```

Then, in a second terminal:

```bash
npm test
```

If the generated custom server is running on a different port:

```bash
BASE_URL=http://localhost:3101 npm test
```

## Postman Collection

A Postman collection is available at:

```text
postman/film-manager-api.postman_collection.json
```

It contains grouped requests for sessions, public films, owned films, reviews, images,
realtime status, and the active-film conflict scenario.

The collection uses this variable:

```text
baseUrl = http://localhost:3000
```

If the generated server runs on another port, update `baseUrl` in Postman before running
the collection.

The collection Runner order is designed to keep temporary data alive until each dependent
request has used it:

```text
login as Frank -> create/update film -> invite/remove reviewer -> conflict as Karen -> cleanup as Frank
```

If Postman was already showing an older imported copy, remove that copy and import
`postman/film-manager-api.postman_collection.json` again.

Image upload is skipped by default because Postman needs a real local file selected in
the file picker. To test image upload manually, set:

```text
runImageUpload = true
```

Then select a local PNG, JPG, or GIF file in `Images / Upload image` before running the
image requests.

## One-Command Regeneration And Startup

For the normal project workflow from the root:

```bash
npm start
```

This command:

- regenerates `generated-openapi-generator-custom`
- installs dependencies for the generated custom server
- starts the generated custom server
- leaves the generated custom server running for Postman, Swagger UI, curl, or the smoke test

By default it uses port `3000`. To run the server on another port:

```bash
PORT=3101 BASE_URL=http://localhost:3101 npm start
```

## Why This Simplifies Testing

The previous testing process was manual. After regeneration, each service had to be
checked through Swagger UI or individual curl commands. That made it easy to forget a
step, use the wrong HTTP method, miss the login cookie, or only test GET endpoints while
POST, PUT, and DELETE routes were broken.

The new scripts keep the normal workflow small:

| Script | What it does |
|---|---|
| `npm start` | Regenerates, installs, and starts the generated custom server |
| `npm test` | Runs API checks against an already running generated server |
| `npm run smoke` | Same smoke test command used by `npm test` |

The smoke test verifies the important integration path:

```text
OpenAPI contract
    -> generated routes/controllers/services
    -> adapter layer
    -> shared-services/src/services/FilmManagerService.js
```

This is useful after every regeneration because it checks not only that the server starts,
but also that generated operations still reach the shared handwritten service logic.

## Seed Users

All seed users use password:

```text
password
```

| Email | Name |
|---|---|
| `alice@example.com` | Alice |
| `frank@example.com` | Frank |
| `karen@example.com` | Karen |
| `rene@example.com` | Rene |

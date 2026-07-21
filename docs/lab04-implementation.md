# Lab04 implementation

Lab04 adds a real-time WebSocket layer to the existing Film Manager: an authenticated reviewer can
select one assigned public film as their active film, and every connected client is notified
immediately of login, active-film updates, and logout for every user, on top of Labs 01–03 without
regressing any of them.

## Architecture

- `openapi/openapi.yaml` already declared the Lab04 REST surface (`sessionsPOST`/`sessionsCurrentDELETE`
  for login/logout, `usersOnlineGET`, `filmsFilmIdActivePUT`, `usersCurrentActiveFilmDELETE`) before this
  work began; no new REST paths were added.
- `shared-services/src/services/FilmManagerService.js` now extends Node's `EventEmitter` and emits
  `'login'` / `'update'` / `'logout'` domain events with ready-to-broadcast, schema-shaped payloads
  immediately after a mutation commits — and only then, so a WebSocket client can never observe an
  update that was not actually applied. The service itself never imports `ws` or knows about sockets.
- `shared-services/src/realtime/` is the new handwritten transport layer:
  - `wsMessageSchema.js` compiles `specifications/lab04/schemas/ws_message_schema.json` once with AJV.
  - `PresenceWebSocketHub.js` tracks connected clients, validates every outgoing message against that
    schema, sends only to `OPEN` clients, isolates a single client's send failure, and ignores any
    message a client sends (the channel is server→client only, so a client can never spoof state).
  - `attachRealtimeGateway.js` wires a `ws.Server` to an existing `http.Server` and to a
    FilmManagerService-like event source; `close()` removes its own listeners and closes every client,
    so repeated attach/close cycles never accumulate duplicate listeners or WebSocketServer instances.
- `adapters/openapi-generator/realtimeGateway.js` is the thin, project-specific binding: it picks the
  real `FilmManagerService` singleton and a configurable path (`WS_PATH` env var, default `/ws`).
- `out/expressServer.mustache` (and `out/index.mustache`) — the regeneration-safe templates — were
  extended to store the real HTTP server instance, attach the realtime gateway to it (sharing the same
  port, never a second/unrelated server), and close both deterministically on `close()` or on
  `SIGTERM`/`SIGINT`. Running `npm run generate:final` reproduces this from the templates; the generated
  output itself is disposable.
- `shared-services/lab04/client-app/` is the project-owned React client (Vite + React 18 +
  react-router-dom), adapted from — never copied from — the read-only professor reference under
  `shared-services/lab04/lab04-solution-main/client/`. It implements a login form, a sidebar and an
  Online page both driven by one shared WebSocket-derived state, and a Films-to-Review page that lets a
  reviewer select an active film.
- `shared-services/lab04/lab04-solution-main/` (professor reference) is local-only, gitignored, and
  untracked, matching the Lab02/Lab03 precedent.

## Architectural limitation: process-local presence

Online presence is stored **in memory inside one Node.js process**. `userIdBySessionId` and
`sessionIdsByUserId` (`shared-services/src/services/FilmManagerService.js`) are plain JavaScript `Map`s
local to that process — they are not shared across multiple server instances, and all presence state
resets whenever the process restarts. Running more than one Film Manager instance (e.g. behind a load
balancer) would require a shared external presence/session store so every instance sees the same
logged-in users and can broadcast to WebSocket clients connected to a different instance. Redis or any
other distributed infrastructure was **intentionally not introduced**: it is outside the Lab04
requirements and outside this project's scope, which targets a single Film Manager process. This is a
known, accepted scope boundary of the current single-process academic deployment, not a defect.

## Corrected defects (project code, not the professor's)

- **Exclusivity rule.** The project's own prior implementation rejected selecting a film already active
  for a *different* reviewer. The Lab04 requirement is only "at most one active film per user"; the
  cross-user conflict check was removed. Two reviewers may now independently have the same film active.
- **Missing auth checks.** `usersOnlineGET`, `filmsFilmIdActivePUT`, and `usersCurrentActiveFilmDELETE`
  relied only on the OpenAPI-level `cookieAuth` security declaration; they now also call `requireUser()`
  directly, consistent with every other authenticated service method.
- **Boolean/count-based online tracking.** A `Set` of logged-in user IDs could not distinguish "no
  sessions" from "one session" from "two sessions" for the same user, and a first count-based fix still
  could not distinguish "the same session logging in twice" from "a second, different session" — either
  could over-count presence. Replaced with real session-identity tracking:
  `userIdBySessionId: Map<sessionId, userId>` (the real Express `request.sessionID`) plus a derived
  `sessionIdsByUserId: Map<userId, Set<sessionId>>`. This also accounts for Passport regenerating the
  session id on every successful login (session-fixation protection): a repeat login arriving with an
  already-tracked cookie is recognized via the id it arrived *with*, not just the newly-regenerated one,
  so it is treated as a continuation rather than a second session. Session ids are never exposed over REST
  or WebSocket.
- **Non-deterministic snapshot order.** The initial WebSocket snapshot is now sorted by ascending numeric
  `userId`, independent of login/session-Map order.
- **`expressServer.js` never stored the HTTP server instance**, so `close()` silently did nothing.
  `index.js` also never handled `SIGTERM`/`SIGINT`. Both were fixed at the template level.
- **Professor reference schema defect** (`shared-services/lab04/lab04-solution-main/ws_message_schema.json`)
  uses `"taskName"` instead of `"filmTitle"` and is missing several `allOf` constraints. The project uses
  only the authoritative `specifications/lab04/schemas/ws_message_schema.json`; a regression test proves
  the professor copy rejects a canonical message.
- **Active-state invalidation.** An owner removing an active review invitation, or deleting a public film
  that has an active reviewer, previously left already-connected clients with stale state. Both paths now
  emit a corrective `update` for the affected reviewer.

## Run

```bash
npm start                 # Film Manager + WebSocket gateway on the same port (default 3000, path /ws)
```

```bash
cd shared-services/lab04/client-app
npm install
npm run dev                # dev server with /api and /ws proxied to localhost:3000
```

## Validate

```bash
npm run test:lab01
npm run test:lab02
npm run test:lab02:integration
npm run test:lab03
npm run test:lab04
npm run test:lab04:client   # React unit tests + production build
npm run smoke
npm run generate:final
npx newman run postman/lab04/lab04.postman_collection.json   # manual REST verification (supplemental)
```

See `docs/lab04-compliance-audit.md` for the full requirement-by-requirement evidence trail, including
§14's record of the six corrections applied after an independent verification pass (session identity,
Postman collection, dead OpenAPI response, audit classification accuracy, schema duplication, shutdown
robustness).

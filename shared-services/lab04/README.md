# Lab04 WebSocket Artifacts

This directory contains the Lab04 WebSocket reference schemas/examples, the
project-owned React client app, and early design-phase draft files. The
actual server-side and client-side realtime code that is wired into the
running application lives elsewhere — see **Current implementation** below.

## Current implementation

| Requirement | Project location |
|---|---|
| Select one active public review film for the authenticated user. | `../../openapi/openapi.yaml`, `../src/services/FilmManagerService.js` |
| Provide a snapshot of currently logged-in users and their active films. | `../../openapi/openapi.yaml`, `../src/services/FilmManagerService.js` |
| Define WebSocket status messages for login, active-film updates, and logout. | `specifications/lab04/schemas/ws_message_schema.json` (canonical); `schemas/ws_message_schema.json` in this directory (synchronized reference copy, see note below) |
| Keep valid examples of login, update, and logout messages. | `examples/` (reference copy; canonical examples are under `specifications/lab04/`) |
| Server-side WebSocket hub: track connected clients, validate outgoing messages against the schema, broadcast only to `OPEN` clients. | `../src/realtime/PresenceWebSocketHub.js` |
| Attach a `ws.Server` to the existing HTTP server and to `FilmManagerService`'s `login`/`update`/`logout` events. | `../src/realtime/attachRealtimeGateway.js` |
| Project-specific binding: picks the real `FilmManagerService` singleton and the configurable mount path. | `../../adapters/openapi-generator/realtimeGateway.js` |
| Maintain the React `onlineList` state from received WebSocket messages. | `client-app/src/realtime/onlineListReducer.js` |
| Open a browser WebSocket (with reconnect/backoff) and apply incoming messages to `onlineList`. | `client-app/src/realtime/onlineStatusSocket.js`, `client-app/src/realtime/useOnlineStatus.js` |

**Mount path:** the WebSocket gateway attaches at `/ws` by default (override with the
`WS_PATH` environment variable — see `../../docs/configuration.md`), on the same HTTP
server and port as the REST API. It attaches automatically whenever the generated
server starts — see `out/expressServer.mustache` — no manual wiring is required.

## Message behavior

When a WebSocket connection is established, the server sends one status message for each currently logged-in user.

After that:

- login sends `typeMessage: "login"` with user information and the active film if present
- active-film selection sends `typeMessage: "update"` with the user and selected film
- logout sends `typeMessage: "logout"` with the user id

The message shape is documented by `specifications/lab04/schemas/ws_message_schema.json`.

## Superseded design-phase files

`client/` and `server/` in this directory (`connectOnlineWebSocket.js`,
`onlineListReducer.js`, `WebSocketStatusHub.js`, `createStatusWebSocketServer.js`,
mounted at the design-phase path `/ws/status`) are early drafts from before the
realtime layer was wired into the actual server. They are **not used by the running
application** — the current implementation is the `../src/realtime/` and
`client-app/src/realtime/` code listed above. These draft files are kept only as
development history; do not build against them.

## Canonical schema note

The Lab04 realtime implementation actually wired into the running server
(`../src/realtime/`, `../../adapters/openapi-generator/realtimeGateway.js`) loads its schema from
`specifications/lab04/schemas/ws_message_schema.json`, **not** from `schemas/ws_message_schema.json` in
this directory. `schemas/ws_message_schema.json` here is kept only as a synchronized reference copy
alongside the rest of this directory's design artifacts (`client/`, `server/`, `examples/`), which are
themselves not wired into the running server (see `docs/lab04-compliance-audit.md` §1 for why). It is not
a second source of truth: `scripts/lab04-schema-tests.js` asserts the two files are byte-for-byte
identical on every `npm run test:lab04` run, so any drift between them fails the test suite immediately
rather than silently diverging.

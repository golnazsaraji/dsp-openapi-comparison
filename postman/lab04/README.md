# Lab04 Postman collection

`lab04.postman_collection.json` exercises the Lab04 REST surface: active-film
selection and the online-users snapshot. It does not open a WebSocket
connection — Postman/Newman only send HTTP requests, so the realtime
broadcast itself is verified by `npm run test:lab04` instead (see
"What this does not verify" below).

## Prerequisites

- The Film Manager server running (`npm start` from the repository root),
  default port `3000`.
- No Converter or Mosquitto broker needed — Lab04 has no gRPC or MQTT
  dependency.

## Collection variable

```text
baseUrl = http://localhost:3000
```

If the server runs on a different port, update `baseUrl` before running the
collection.

## Auth / session handling

Login sets the `connect.sid` session cookie; Postman's cookie jar carries it
automatically between requests in the same run. Do not copy the cookie into a
variable or add a manual Cookie header. **1. Setup and Session / Clear stale
Runner session** removes any leftover cookie from a previous run before
logging in.

## Execution order

Run the folders top to bottom — later folders depend on state created
earlier (an already-selected active film, an established session):

1. Setup and Session
2. Films to Review and Online Snapshot
3. Active Film Selection
4. Clear Active Film
5. Authorization and Validation

## Newman command

```bash
npx --yes newman run postman/lab04/lab04.postman_collection.json
```

## What this verifies

- Login, session retrieval, and the assigned-films-to-review listing.
- Active-film selection and replacement (`PUT /api/films/{filmId}/active`)
  and its effect on `GET /api/users/online`.
- Clearing the active film (`DELETE /api/users/current/active-film`).
- Rejections: unauthenticated selection, selection of an unassigned or
  private film, selection of a nonexistent film.

## What this does not verify

- The WebSocket broadcast itself (`login`/`update`/`logout` messages pushed
  to connected clients) — Postman cannot open a WebSocket connection. This is
  covered by `npm run test:lab04` (`scripts/lab04-realtime-tests.js`) against
  the real gateway, and by `npm run test:lab04:client` for the React client's
  handling of those messages.
- Cross-user active-film exclusivity — that behavior was introduced by Lab05
  and is covered by `postman/lab05/README.md` and `npm run test:lab05`
  instead.

## Cleanup / reset expectations

The collection logs out the sessions it creates in its own last requests
(Authorization and Validation folder). Restarting the Film Manager server
resets all in-memory state (films, sessions, active-film assignments); rerun
from folder 1 after a restart.

See `docs/lab04-implementation.md` for the underlying feature, architecture,
limitations, and automated verification commands.

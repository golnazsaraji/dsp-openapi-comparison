# Lab05 Postman collection

`lab05.postman_collection.json` exercises the Lab05 REST surface: exclusive
active-film selection, including the cross-user `409` conflict Lab05 added on
top of Lab04. It does not connect to Mosquitto or subscribe to any MQTT
topic — Postman/Newman only send HTTP requests, so the MQTT publication
itself is verified by `npm run test:lab05:integration` instead (see "What
this does not verify" below).

## Prerequisites

- The Film Manager server running (`npm start` from the repository root),
  default port `3000`.
- A Mosquitto broker is **not required** to run this collection — it
  exercises the REST API and the 409-conflict logic only. It is required for
  the MQTT-integration test suite and for observing live MQTT messages
  separately (see `docs/run-all-labs.md`).

## Collection variables

```text
baseUrl = http://localhost:3000
```

Seeded accounts used by this collection: `alice@example.com` (owner),
`frank@example.com` and `karen@example.com` (reviewers), all with password
`password`. Film IDs (`filmIdShared`, `filmIdFrankAndKaren`,
`filmIdKarensOwn`, `filmIdMissing`) refer to the project's seeded in-memory
data. If the server runs on a different port, update `baseUrl` before
running the collection.

## Auth / session handling

Same as Lab04: login sets the `connect.sid` cookie, carried automatically by
Postman's cookie jar. **1. Setup / Clear stale Runner session** removes any
leftover cookie before logging in.

## Execution order

Run the folders top to bottom; each folder depends on active-film state left
by the previous one:

1. Setup (owner/reviewer wiring)
2. Login and Films to Review (Frank)
3. Select Active Film and Idempotent Reselect (Frank)
4. Second-User Conflict (Karen)
5. Replace and Clear Active Film (Frank)
6. Authorization and Validation
7. Public/Private Film Creation and Deletion

The reviewer-invitation request in folder 1 is idempotent by design (`201` on
a fresh server, `409` if the collection has already been run once against
the same process) so the collection can be rerun without a server restart.

## Newman command

```bash
npx --yes newman run postman/lab05/lab05.postman_collection.json
```

## What this verifies

- Selecting, idempotently reselecting, and replacing an active film.
- The Lab05 cross-user conflict: a second reviewer selecting a film another
  reviewer already has active receives `409`, and the first reviewer's
  active film is unaffected.
- That clearing or replacing an active film frees it for another reviewer.
- Rejections: unauthenticated selection, selection of an unassigned or
  missing film.
- That creating and deleting public/private films does not affect unrelated
  seed data (isolated cleanup).

## What this does not verify

- The actual MQTT publication (retained message, QoS, topic per film ID) —
  Postman cannot open an MQTT connection. This is covered by
  `npm run test:lab05` (gateway/unit level, no broker needed) and
  `npm run test:lab05:integration` (real round-trip against a running
  Mosquitto broker).
- The browser client's live subscription to MQTT-over-WebSockets — covered by
  `npm run test:lab04:client` (React unit tests) and manual verification via
  `docs/run-all-labs.md`.

## Cleanup / reset expectations

Folders 4–7 each restore state so the next folder starts clean (clearing
active films, logging out, deleting only films the collection itself
created). Restarting the Film Manager server resets all in-memory state;
rerun from folder 1 after a restart.

See `docs/lab05-implementation.md` for how the underlying feature works and
`docs/lab05-compliance-audit.md` for the full requirement-by-requirement
evidence trail.

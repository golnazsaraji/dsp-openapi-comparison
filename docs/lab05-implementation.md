# Lab05 Implementation

Companion to `docs/lab05-compliance-audit.md` (which holds the atomic
requirement matrix and test-result evidence). This document explains *how*
the implementation works. Every subsection is tagged with its origin:

- **[PDF]** — mandated by `specifications/lab05/material/{Lab05,LaboratoryActivity05}.pdf`
- **[AD]** — an approved architectural decision (Phase 1/2 task briefs), where the PDF leaves the choice open
- **[DC]** — derived consistency behavior, required by the domain model's own invariants, not separately listed by the PDF
- **[DEV]** — non-production, local-development-only configuration

## 1. Architecture overview

```
FilmManagerService (domain, in-memory, single process)
    │ emits 'filmStatusChanged' { filmId, message }
    ▼
attachMqttGateway (shared-services/src/mqtt/)   ←→   attachRealtimeGateway (Lab04, unchanged)
    │ validates + builds topic + publishes (qos 0, retain true)
    ▼
adapters/openapi-generator/mqttGateway.js  (thin adapter, injectable client)
    │
    ▼
out/expressServer.mustache → generated-openapi-generator-custom/expressServer.js
    │ attaches/closes both gateways
    ▼
Mosquitto broker (local dev: shared-services/lab05/broker/mosquitto.conf)
    │
    ▼
React client: useFilmSelectionMqtt → connectFilmSelectionMqtt → filmSelectionReducer
    │
    ▼
FilmsToReviewPage.jsx
```

The domain layer never imports `mqtt`; the MQTT layer never imports
`FilmManagerService`'s internals — they communicate only through the
`filmStatusChanged` event and `mqttInitialFilmMessages()`, mirroring the
existing Lab04 `attachRealtimeGateway` pattern exactly. **[AD]**

## 2. Authoritative domain state

A single in-memory `FilmManagerService` instance
(`shared-services/src/services/FilmManagerService.js`) holds `users`,
`films`, and `reviews` arrays. `reviews[i].active` is the sole source of
truth for "who has what active" — both the Lab04 WebSocket projection
(`webSocketStatusMessage`) and the Lab05 MQTT projection (`mqttFilmMessage`)
are pure functions computed from this same state, never stored redundantly.
**[AD]**

## 3. REST conflict semantics

`PUT /api/films/{filmId}/active` (`filmsFilmIdActivePUT`) now enforces: a
public film may be active for **at most one user at a time**. **[PDF]** A
second user attempting to select an already-active film receives **HTTP
409**, using the project's existing `{error: string}` envelope (no parallel
error format). **[AD]** 403 remains reserved for authorization/assignment
failure and is checked strictly before the conflict check, so a non-reviewer
always gets 403, never 409, regardless of the film's current state. 404
remains for a missing/non-public film, checked first of all. The 409
message is deliberately generic ("This public film is already active for
another user.") and never names the current holder. **[AD]**

## 4. Exclusive active-film invariant

```js
const conflictingReview = this.reviews.find(
    (item) => item.filmId === film.id && item.active && item.reviewerId !== userId,
);
if (conflictingReview) throw this.error('...', 409);
```

This check runs **before any mutation**, so a failed selection can never
partially clear the requester's previous film. The atomicity is free: Node.js
is single-threaded and this method is fully synchronous — there is no
`await` anywhere inside it, so no other request can interleave mid-execution.
`scripts/lab05-service-tests.js` §2c proves the practical consequence with a
near-concurrent `Promise.allSettled` race: exactly one of two competing
selections wins, deterministically. **This is a process-local guarantee
only** — see §31/§32. **[AD]**

## 5. Domain event contract

```js
emitFilmStatusChanged(filmId) {
    const film = this.film(filmId);
    if (!film?.public) return;
    this.emit('filmStatusChanged', { filmId: film.id, message: this.mqttFilmMessage(film.id) });
}
```

The event payload is **exactly** `{ filmId, message }` — no QoS, retain,
broker URL, or client options. Those are transport concerns the MQTT gateway
layer owns exclusively (§6). Private-film deletion and public-film deletion
publish `deleted` directly at the call site (not through this helper)
because by the time deletion completes, `this.film(filmId)` can no longer
find the film to recompute state from. **[AD]**

## 6. MQTT gateway

`shared-services/src/mqtt/attachMqttGateway.js`, mirroring
`shared-services/src/realtime/attachRealtimeGateway.js`:

- Takes an already-constructed (or injected/fake) MQTT client and an
  event source (`FilmManagerService`-shaped: emits `filmStatusChanged`,
  exposes `mqttInitialFilmMessages()`).
- A `WeakSet` (module-scope, not a property on the event source — keeps
  `FilmManagerService` MQTT-agnostic) prevents double-attachment to the same
  event source; `close()` removes the entry so a legitimate later
  re-attachment (e.g., in-process server restart in a test) works.
- Every publish is validated (topic + schema) before being sent; a
  transport failure is logged/reported via an optional `onError` callback,
  **never thrown back into the domain layer** that triggered the emit —
  exactly like `attachRealtimeGateway`'s `safeBroadcast`.
- `close()` is idempotent, removes both the domain-event listener and the
  MQTT client's `connect`/`error` listeners, and calls `client.end()`.

**[AD]**

## 7. Topic contract

`shared-services/src/mqtt/mqttTopics.js#topicForFilm`: the topic is
**exactly `String(filmId)`** — no prefix (`films/`, `film/`, `status/`,
`dsp/`), no wildcard. **[PDF]** `filmId` is validated as a positive integer
before the topic is built; the resulting string is additionally checked
against `/[#+/]/` as defense-in-depth. Client-side, the reverse mapping
(`filmSelectionReducer.js`) treats the MQTT topic string as the film id via
`Number(topic)`, ignoring any topic that doesn't parse to a positive
integer. **[AD]**

## 8. Payload schema

Canonical: `specifications/lab05/schemas/mqtt_film_message_schema.json`.
**[PDF]**

```json
{"status": "active", "userId": <int>=1>, "userName": "<string, non-empty>"}
{"status": "inactive"}
{"status": "deleted"}
```

`additionalProperties: false`; `active` requires `userId`+`userName`
together; `inactive`/`deleted` forbid them. The film id is **never** in the
payload — it's the topic. This schema is loaded exclusively at
`shared-services/src/mqtt/mqttFilmMessageValidator.js`; the byte-identical
copies under `shared-services/lab05/schemas/` and `specifications/lab05/examples/`
are pre-existing reference artifacts, asserted to stay in sync by
`scripts/lab05-schema-tests.js` rather than deleted (matching the existing
Lab04 convention for its own duplicate schema copy).

## 9. AJV validation

Same convention as `shared-services/src/realtime/wsMessageSchema.js`:
compiled **once**, at module load (`shared-services/src/mqtt/mqttFilmMessageValidator.js`,
top-level `ajv.compile(schema)`), never per-publication. Every outgoing
`filmStatusChanged`-derived message is validated inside
`attachMqttGateway.js#publish` before `client.publish()` is called; a
validation failure is logged/reported and the publish is skipped entirely —
**a malformed internal payload is never sent to the broker.** **[AD]**

## 10. QoS and retained messages

```js
const PUBLISH_OPTIONS = { qos: 0, retain: true };
```

Set explicitly on every call, never left to mqtt.js's own defaults. **[AD]**
QoS 0 is an explicit choice (the PDFs don't mandate a level); `retain: true`
is required so a client that subscribes after a status change still
immediately receives the current state — proven against a real broker in
`scripts/lab05-mqtt-integration-tests.js` step 3 ("late subscriber"). A
deleted film publishes `{"status":"deleted"}` retained, never an empty
retained payload.

## 11. Bootstrap

On every successful MQTT `connect` event (first connect **and** every
automatic reconnect — no distinction is made), the gateway calls
`eventSource.mqttInitialFilmMessages()`, which recomputes the current status
of every public film, sorted by ascending film id, and publishes one
retained message per film. **[PDF]** Private films are excluded at the
domain layer (`.filter(film => film.public)`), never reaching the gateway.
**[PDF]**

## 12. Reconnect synchronization

Because bootstrap always recomputes from **live** domain state (never a
cached snapshot taken at some earlier point), a broker restart — which, with
this project's local, non-persistent test configuration, loses all retained
messages — is fully repaired by the next reconnect's bootstrap, including
any domain mutations that happened while the broker was completely
unreachable. Verified against a real, killed-and-restarted Mosquitto process
in `scripts/lab05-mqtt-integration-tests.js` steps 10–13. **[AD]**

## 13. Publication flows

Overview table (details in §14–19):

| Trigger | Publishes | Source |
|---|---|---|
| Public film created | `inactive` | [PDF] |
| Private film created | nothing | [PDF] |
| Selection (new film) | old `inactive` (if any), then new `active` | [PDF] |
| Selection (same film, same user) | nothing (idempotent) | [PDF]+[DC] |
| Clear | `inactive`, only if a film was active | [PDF] |
| Invitation withdrawal invalidating the active selection | `inactive`, only if it changed film-level state | [DC] |
| Public film deleted | `deleted`, exactly once | [PDF] |
| Private film deleted | nothing | [PDF] |

## 14. Creation

`filmsPOST` calls `this.emitFilmStatusChanged(film.id)` after pushing the
new film. A brand-new public film has no reviews yet, so
`mqttFilmMessage(filmId)` always computes `inactive`. Private films are
filtered out inside `emitFilmStatusChanged` itself (defense in depth — the
same guard exists at every call site).

## 15. Selection

`filmsFilmIdActivePUT`: conflict check (§4) → if the user's previous active
film differs from the target, deactivate it and activate the target,
**state fully committed before any event fires** → emit the previous film's
new (`inactive`) state, then the target's new (`active`) state, in that
order. If the target is already the user's active film, nothing is mutated
and nothing is emitted (§4, "idempotent reselect").

## 16. Replacement

Same code path as §15 — "replacement" is just selection where a different
film was previously active. Event order is always: domain state commits →
A `inactive` → B `active`, each exactly once, verified in
`lab05-service-tests.js` §3 and against a real broker in
`lab05-mqtt-integration-tests.js` step 6.

## 17. Clear

`usersCurrentActiveFilmDELETE`: if the user had an active review, deactivate
it and emit `inactive` for that one film; if the user had none, nothing is
emitted. **[PDF]**

## 18. Invitation withdrawal

`filmsFilmIdReviewsReviewerIdDELETE`: removing a review invitation always
clears that reviewer's Lab04 WebSocket presence if it was active (unchanged
Lab04 behavior). **Derived consistency [DC]**: because the exclusivity
invariant (§4) guarantees at most one active review per film, removing the
film's *one* active review always flips the film-level MQTT state from
`active` to `inactive` — so this republishes `inactive`, but **only** when
the removed review was actually active (never for an inactive invitation,
and never merely because the PDF happens to list a different trigger).

## 19. Deletion

`filmsFilmIdDELETE`: for a public film, publishes `{"status":"deleted"}`
directly (not through `emitFilmStatusChanged`, since the film and its
reviews no longer exist by the time this runs) exactly once, retained.
**[PDF]** Private-film deletion publishes nothing. Lab04 WebSocket
"corrective update" broadcasts for any reviewer who had this film active are
preserved unchanged.

## 20. Broker configuration

Canonical, unchanged: `shared-services/lab05/broker/mosquitto.conf` —
`listener 1883` (plain MQTT), `listener 8080` (`protocol websockets`),
`allow_anonymous true`. **[PDF]** **[DEV — local academic policy, not a
production configuration; no TLS, no credentials, no ACLs.]** For automated
real-broker integration tests, a **separate, isolated** temp configuration
is generated per test run (`scripts/lab05-mqtt-integration-tests.js`):
loopback binding, a dynamically allocated free port (never 1883, so it
never collides with a developer's own running broker), temp-directory
persistence, cleaned up in a `finally` block. The canonical file itself was
never modified for test convenience, per explicit instruction.

## 21. Environment variables

| Variable | Default | Used by |
|---|---|---|
| `MQTT_URL` | `mqtt://127.0.0.1:1883` | `createMqttClient.js` |
| `MQTT_CLIENT_ID` | `dsp-lab05-<pid>-<random>` | `createMqttClient.js` |
| `MQTT_CONNECT_TIMEOUT` | mqtt.js default | `createMqttClient.js` |
| `MQTT_RECONNECT_PERIOD` | mqtt.js default | `createMqttClient.js` |
| `MQTT_USERNAME` / `MQTT_PASSWORD` | unset | `createMqttClient.js` |
| `VITE_MQTT_WS_URL` (browser, build-time) | `ws://127.0.0.1:8080` | `shared-services/lab04/client-app/src/mqtt/mqttConfig.js` |

**[AD]** — the minimum surface genuinely used by the implementation; no
credentials are ever logged (no log/console call anywhere in
`shared-services/src/mqtt/` references `url`, `username`, or `password`).

## 22. Browser MQTT-over-WebSockets

The React client connects via `mqtt.connect(url)` where `url` defaults to
`ws://127.0.0.1:8080` (§21) — a **separate** connection from the Lab04
WebSocket (`/ws` on the same origin/port as the REST API), since the
Mosquitto broker is an independent process/port from the Express server.
**[PDF]** Centralized in `mqttConfig.js`, never hard-coded inside a
component.

## 23. React subscription lifecycle

`useFilmSelectionMqtt(filmIds)` (`shared-services/lab04/client-app/src/mqtt/`):
one `connectFilmSelectionMqtt()` call per mounted hook instance (`[]`-deps
effect), closed on unmount. A second effect, keyed on a stable
order-independent string derived from `filmIds`, calls
`connection.setFilmIds(filmIds)` whenever the visible set changes.
`connectFilmSelectionMqtt.js` tracks the *desired* subscription set even
while disconnected, and subscribes to the **entire** set exactly once on
every `connect` event (first connect and every reconnect) — while connected,
`setFilmIds` diffs against the previously-subscribed set and issues only
incremental `subscribe`/`unsubscribe` calls, so no topic is ever
double-subscribed. **[AD]**

`FilmsToReviewPage.jsx` prunes any film reported `deleted` out of its own
`films` state (not just out of what's rendered) — this shrinks the id set
passed to `useFilmSelectionMqtt`, so the next `setFilmIds` diff naturally
unsubscribes that film's topic, without any special-cased "unsubscribe on
delete" logic.

## 24. Error handling

`shared-services/lab04/client-app/src/mqtt/describeSelectionError.js`:
maps a failed selection's HTTP status to a user-facing message — a
conflict-specific message only for `409`, the raw server error message for
everything else (401/403/404/500), falling back to a generic message if
none is present. A separate pure guard, `canStartSelection(pendingFilmId)`,
blocks a new selection attempt while one is already in flight, for **any**
film (not just the same one). Both extracted as standalone functions
specifically so they're unit-testable without a component-rendering
harness (this project has no `@testing-library/react`).

## 25. Lab04 WebSocket coexistence

Unchanged in production behavior. The domain state remains authoritative;
WebSocket and MQTT are two independent transport projections of it. A
successful domain mutation may produce a Lab04 WebSocket update, a Lab05
MQTT update, both, or neither (e.g. private-film operations never touch
MQTT but may still touch WebSocket presence). Transport failure on either
side never rolls back an already-committed domain mutation — REST success
is fully decoupled from broadcast/publish success, exactly matching the
existing `attachRealtimeGateway`'s `safeBroadcast` philosophy.

## 26. Shutdown

`out/expressServer.mustache#close()`: closes the Lab04 realtime gateway,
then the Lab05 MQTT gateway, then the HTTP server — each independently, in
a try/catch, so a failure in one never skips closing the others; every
error is collected and the first one is re-thrown only after all three
close attempts have run. `mqtt.js`'s `client.end()` resolves even for a
client that was never actually connected (proven in
`scripts/lab05-integration-tests.js`: SIGTERM against a server whose
`MQTT_URL` points nowhere still shuts down cleanly, without a forced
SIGKILL).

## 27. Regeneration safety

The MQTT gateway hook lives in `out/expressServer.mustache` (the reusable
template), not hand-patched into the generated output. This template
contains no `{{mustache}}` substitution in the touched region, so the
generated `expressServer.js` is **byte-identical** to the template — proven
directly (string equality, not just "looks similar") in
`scripts/lab05-regeneration-tests.js`, which also proves regeneration is
idempotent (2 consecutive runs produce identical output) and touches no
file outside the two expected ones (`api/openapi.yaml`,
`expressServer.js`).

## 28. Testing commands

```bash
npm run test:lab05              # schema, topic, service, gateway (fake client),
                                 # hygiene (source-text/behavioral regression guards),
                                 # HTTP integration (no broker), regeneration
npm run test:lab05:integration  # real Mosquitto broker required
npm run test:lab04               # unaffected regression
npm run test:lab04:client        # unaffected regression + production build
npm run smoke                    # full REST smoke, including the 409 scenario
npx newman run postman/lab05/lab05.postman_collection.json
```

`test:lab05` runs, in order: `lab05-schema-tests.js`, `lab05-topic-tests.js`,
`lab05-service-tests.js`, `lab05-mqtt-gateway-tests.js`,
`lab05-hygiene-tests.js`, `lab05-integration-tests.js`, and
`lab05-regeneration-tests.js`.

`test:lab05` never requires a real broker (it uses an injected fake MQTT
client for gateway-lifecycle tests, and an unreachable-broker HTTP
integration test); `test:lab05:integration` is split out specifically
because it requires a locally installed Mosquitto executable, honestly
reported as NOT RUN (with the exact search performed) rather than silently
skipped or mocked if one isn't found.

## 29. Postman usage

`postman/lab05/lab05.postman_collection.json` follows the existing
`postman/lab04/lab04.postman_collection.json` conventions exactly: a single
shared cookie jar (login as one user, act, log out, log in as the next),
`pm.test`/`pm.expect` inline scripts, collection variables for
IDs/credentials. Covers owner/reviewer setup, login, films-to-review
listing, select/idempotent-reselect/replace/clear, the second-user 409
conflict with its body and both users' unaffected-state checks,
authorization/validation (401/403/404), and isolated public/private film
creation+deletion — **never** touching seed-data films for creation/deletion
(a fresh film is created and deleted within the same run). Does not, and
does not claim to, verify anything MQTT-transport-related (retained
delivery, QoS, reconnect, cross-transport delivery) — those remain the
automated Node suites' responsibility.

## 30. Troubleshooting

- **`test:lab05:integration` reports "NOT RUN"**: Mosquitto isn't
  installed/discoverable. Install it (e.g. `brew install mosquitto` on
  macOS) — this suite deliberately never substitutes a mock broker.
- **A local `mosquitto` is already running on 1883/8080 and you want to test
  against the canonical config manually**: `mosquitto -v -c
  shared-services/lab05/broker/mosquitto.conf`; the automated integration
  suite never touches this process (it always spawns its own, on a
  different, dynamically-chosen port).
- **The generated server won't start / MQTT never connects**: check
  `MQTT_URL`; the server itself still starts and serves REST traffic even
  if the broker is unreachable (§6, §26) — MQTT connectivity is never a
  hard startup dependency.
- **A 409 was expected but 403 was returned**: authorization is checked
  before the conflict — confirm the requesting user is actually an invited
  reviewer of the film first.

## 31. In-memory/process-local limitations

All domain state (`films`, `reviews`, active-selection flags) lives in a
single `FilmManagerService` instance's in-process arrays. It is lost on
process restart (no persistence layer exists, matching every prior lab in
this project). The exclusivity invariant (§4) and its atomicity guarantee
are provable and tested **only** within one Node.js process — see §32.

## 32. Horizontal-scaling requirements

None of the current implementation would work correctly if multiple Node
processes (e.g., behind a load balancer) each ran their own in-memory
`FilmManagerService` instance: each process would have its own independent
view of "who is active on which film," and the exclusivity invariant would
only hold *within* a single process, not across the fleet. Making this
horizontally scalable would require, at minimum: (a) moving `films`/`reviews`
state into a shared external store (database, Redis, etc.); (b) replacing
the synchronous in-memory conflict check with a transactional or
optimistic-locking check against that shared store, since JavaScript's
single-process run-to-completion guarantee (§4) no longer applies across
processes; (c) a single logical MQTT gateway (or a coordination mechanism
preventing every process from independently re-publishing bootstrap
snapshots on every one of their own reconnects). None of this is
implemented, and it is explicitly out of scope for Lab05/this project phase
— documented here rather than left as a silent gap.

## 33. Security and production limitations

This implementation is **local-development-only**, matching the project's
existing conventions for every prior lab:

- Mosquitto: `allow_anonymous true`, no TLS, no ACLs, no authentication.
- No MQTT credentials are configured or exercised anywhere in this Phase
  (the `MQTT_USERNAME`/`MQTT_PASSWORD` environment variables exist in
  `createMqttClient.js` but are never populated by any script, config, or
  test in this repository).
- Session cookies (`connect.sid`, from Lab04's existing Passport setup) are
  unchanged and were not hardened as part of Lab05.
- The REST 409 conflict is a correctness/UX feature, not a security
  boundary — it deliberately avoids leaking the current holder's identity
  (§3), but any authenticated reviewer of a film can already see who
  reviews it via existing endpoints; this is unchanged from Lab04.
- Deploying any part of this outside a trusted local development network
  would require, at minimum, MQTT TLS + authentication, REST session
  hardening, and the horizontal-scaling work in §32 — none of which are in
  scope here.

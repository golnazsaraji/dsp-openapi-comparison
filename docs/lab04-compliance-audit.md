# Lab04 Compliance Audit — Realtime WebSocket Layer

Branch: `review/lab04-compliance` (created via `git switch -c`, not committed — per the task's explicit
instruction not to commit, merge, push, or open a PR during this work).
Local-only document; not intended to remain tracked at final merge, consistent with the Lab02/Lab03
workflow (removal happens at final-merge time, not during implementation).

---

## 1. Executive conclusion

The pre-existing Lab04 scaffolding (`shared-services/lab04/server/*`, `shared-services/lab04/client/*`)
was real but entirely orphaned — zero references anywhere else in the codebase, confirmed by `grep`
before any code was written. `FilmManagerService` already had the right *shape* of helper methods
(`recordLogin`, `recordLogout`, `usersOnlineGET`, `webSocketStatusMessage`, `webSocketSnapshot`,
`filmsFilmIdActivePUT`) but no real WebSocket transport was ever attached to the HTTP server, the
active-film exclusivity rule was stricter than the authoritative requirement, three service methods were
missing explicit auth checks, presence tracking could not survive multiple sessions for one user, and the
initial snapshot had no deterministic ordering.

All of these were fixed. A real `ws`-based WebSocket gateway now shares the Film Manager's HTTP server
(regeneration-safe, via `out/expressServer.mustache`), broadcasts `login`/`update`/`logout` events that
are schema-validated against the authoritative
`specifications/lab04/schemas/ws_message_schema.json` (never the professor's broken `taskName` copy),
and a project-owned React client (`shared-services/lab04/client-app/`) consumes it with a bounded-backoff
reconnecting socket and a pure, unit-tested reducer. Automated coverage: 3 backend test files (schema,
service, full end-to-end realtime integration) plus 17 client-side Vitest tests, all passing, alongside
unmodified-behavior Lab01–03 regression suites.

**This document was revised after an independent verification pass** raised six focused findings, all of
which were corrected in this same branch (still uncommitted, per the standing instruction): (1) presence
tracking used a session *count*, not real session identity, and could over-count/strand a user online
across a duplicate login; (2) no Postman collection existed for Lab04, breaking the established per-lab
convention; (3) the OpenAPI `409` response on `PUT /api/films/{filmId}/active` was dead code left over
from the removed exclusivity rule; (4) this document had classified heartbeat/stale-connection detection
as implemented by conflating it with close/error cleanup, without verifying it against the authoritative
PDF; (5) a second, unused copy of the WebSocket schema existed with no drift protection; (6) the SIGTERM/
SIGINT shutdown handler could silently hang or exit 0 on a failed close. See §14 for the full account of
each fix and its evidence.

**Decision: GO.** See §15.

---

## 2. Authoritative requirement inventory

From `specifications/lab04/material/Lab04.pdf`, `LaboratoryActivity04.pdf`, and
`specifications/lab04/schemas/ws_message_schema.json` (the schema is authoritative over the professor's
own reference copy — see §9):

1. A REST operation lets an authenticated reviewer select one assigned public film as their active film.
2. At most one active film per user (the PDF does **not** say a film can be active for only one user).
3. A WebSocket server integrated with the Film Manager service.
4. A newly-connected WebSocket client receives an initial snapshot of all currently logged-in users and
   their active films.
5. Broadcast notifications for login, active-film selection/update, and logout.
6. JSON messages compliant with the authoritative schema: `typeMessage` ∈ {`login`,`update`,`logout`},
   `userId` required always; `userName` required for `login`/`update`; `filmId`/`filmTitle` optional but
   only together; `logout` carries no `userName`/`filmId`/`filmTitle`; no additional properties.
7. A WebSocket client integrated into the (project-owned, adapted) React client.
8. Immediate update of the Online page and the logged-in-user sidebar.
9. Complete automated tests.
10. No regression of Labs 01–03.

## 3. Architecture

See `docs/lab04-implementation.md` for the full architecture description and file map. In summary:
`FilmManagerService` (handwritten, `EventEmitter`-based) → `shared-services/src/realtime/` (handwritten
transport: schema validator, hub, gateway) → `adapters/openapi-generator/realtimeGateway.js` (thin
project binding) → `out/expressServer.mustache` / `out/index.mustache` (regeneration-safe templates that
attach the gateway to the real HTTP server and wire deterministic shutdown) →
`generated-openapi-generator-custom/` (disposable, reproduced by `npm run generate:final`). The React
client is a fully separate, project-owned Vite app under `shared-services/lab04/client-app/`.

---

## 4. Canonical requirement matrix

Classification key: **1** implemented & sufficiently tested · **2** implemented but insufficiently tested
· **3** partially implemented · **4** missing · **5** implemented but inconsistent with spec · **6**
spec/reference ambiguity or reference-solution defect.

| Req | Description | Class | Evidence |
|---|---|---|---|
| L1 | REST: select one assigned public film as active | **1** | `FilmManagerService.filmsFilmIdActivePUT` (auth → film exists → public → is-reviewer → mutate → single `update` emit). Test: `scripts/lab04-service-tests.js` §2–3, `scripts/lab04-realtime-tests.js` (real HTTP `PUT /api/films/:id/active`). |
| L2 | At most one active film per user (and *not* one user per film) | **1** | The incorrect cross-user conflict check was removed from `filmsFilmIdActivePUT`; the user's-own-previous-active-film deactivation loop was kept. The now-dead `409` response on `PUT /api/films/{filmId}/active` was also removed from `openapi/openapi.yaml` (no legitimate conflict remains — confirmed by grepping `FilmManagerService.js` for any remaining `409` throw in that method: none) and regenerated. Test: `scripts/lab04-service-tests.js` §3–4 (Frank and Karen both active on film 2 simultaneously); `scripts/smoke-custom.js` "two reviewers may independently select the same active film" (updated from the old, incorrect 409-expecting assertion); `postman/lab04/lab04.postman_collection.json` "3. Active Film Selection" (manual REST verification of select + replace). |
| L3 | WebSocket server integrated with the Film Manager | **1** | `attachRealtimeGateway` shares the real `http.Server` (`out/expressServer.mustache`); no second/unrelated server, no hard-coded port; path configurable via `WS_PATH` (default `/ws`). Test: `scripts/lab04-realtime-tests.js` connects real `ws` clients to the real spawned server. |
| L4 | Initial snapshot of all logged-in users + active films | **1** | `webSocketSnapshot()` returns one message per online user, sorted ascending by numeric `userId`; `PresenceWebSocketHub.addClient` sends each one individually (never as an array — the schema describes one object). Test: `scripts/lab04-realtime-tests.js` "initial snapshot" and "multiple clients" scenarios; `scripts/lab04-service-tests.js` §5. |
| L5 | Broadcast: login / update / logout | **1** | `FilmManagerService` emits after every committed mutation (`recordLogin`, `recordLogout`, `filmsFilmIdActivePUT`, `usersCurrentActiveFilmDELETE`, plus the two invalidation paths in §10 below); `attachRealtimeGateway` forwards to `hub.broadcast`. Test: `scripts/lab04-realtime-tests.js` login/update/logout scenarios (6 of the 12). |
| L6 | Schema-compliant JSON messages | **1** | `shared-services/src/realtime/wsMessageSchema.js` compiles `specifications/lab04/schemas/ws_message_schema.json` once with AJV; `PresenceWebSocketHub.sendTo` validates every outgoing message (snapshot and broadcast alike) before sending. Test: `scripts/lab04-schema-tests.js` (21 valid/invalid assertions); every message a realtime-test client receives is independently re-validated against the same schema before any content assertion. |
| L7 | WebSocket client integrated into the React client | **1** | `shared-services/lab04/client-app/src/realtime/{onlineStatusSocket,useOnlineStatus}.js`. Test: `src/test/onlineStatusSocket.test.js` (7 Vitest tests: URL derivation, safe parsing, reconnect, no-reconnect-after-close). |
| L8 | Online page and sidebar update immediately | **1** | Both `OnlinePage` and `Sidebar` render from the same `useOnlineStatus()` state, updated via the shared `applyOnlineStatusMessage` reducer on every incoming message — no polling, no manual refresh. Test: `src/test/onlineListReducer.test.js` (10 Vitest tests: add/replace/remove/no-duplicate/functional-update). |
| L9 | Complete automated tests | **1** | 3 backend files (schema, service, realtime) + 17 client Vitest tests, all passing this session (§10). |
| L10 | No regression of Labs 01–03 | **1** | `npm run test:lab01`, `test:lab02`, `test:lab02:integration`, `test:lab03`, `smoke` all pass unchanged this session (§11), except one **intentionally corrected** smoke assertion (§9). |
| L11 | Auth checks on `usersOnlineGET`/`filmsFilmIdActivePUT`/`usersCurrentActiveFilmDELETE` | **1** | All three now call `requireUser()` explicitly, no longer relying solely on the OpenAPI-level `cookieAuth` security declaration. Test: `scripts/lab04-service-tests.js` §1 (401 for all three when unauthenticated). |
| L12 | Real session-identity-safe presence tracking | **1** | `userIdBySessionId: Map<sessionId, userId>` (source of truth) plus a derived `sessionIdsByUserId: Map<userId, Set<sessionId>>`, keyed by the real Express `request.sessionID` (see `sessionAuth.js`), not a count. Handles Passport's login-time session regeneration (session-fixation protection, which mints a *new* session id on every successful login, even for an already-authenticated cookie) via an explicit `previousSessionId` continuation check, so a same-cookie repeat login is recognized as the same session rather than counted as a second one. `recordLogin`/`recordLogout` only emit on the true first/last session transition; logout from an unregistered session id is a no-op that cannot affect another session. Session ids are never exposed over REST or WebSocket (only `userId` is). Test: `scripts/lab04-service-tests.js` §6 (11 sub-scenarios, direct session-id control) + §6i (Passport-regeneration continuation); `scripts/lab04-realtime-tests.js` "session-identity correctness" block (4 of the 16 scenarios, over real HTTP sessions/cookie jars, including a real Passport login observed via manual `curl`/debug trace to confirm the regeneration behavior this fix accounts for). |
| L13 | Active-state invalidation (invitation/film deletion) | **1** | `filmsFilmIdReviewsReviewerIdDELETE` and `filmsFilmIdDELETE` both capture affected active reviewers before mutating and emit a corrective `update` (no `filmId`) afterward. Test: `scripts/lab04-service-tests.js` §8–9. |
| L14 | No client-message spoofing | **1** | `PresenceWebSocketHub.addClient` attaches a `message` handler that is an intentional no-op — nothing a client sends is ever interpreted as a state change. Test: `scripts/lab04-realtime-tests.js` "spoofed client messages" scenario: a client-sent fake `logout` neither changes `GET /api/users/online` nor triggers a broadcast to other clients. |
| L15 | Deterministic startup/shutdown; WS resources close with the HTTP server | **1** | `expressServer.js`'s `launch()` now stores `this.server`; `close()` awaits `realtimeGateway.close()` then the HTTP server's `close()` callback. `index.js` handles `SIGTERM`/`SIGINT`. Test: `scripts/lab04-realtime-tests.js` asserts the spawned server exits via `SIGTERM` without needing `SIGKILL`; manually verified end-to-end (stdout log shows "Received SIGTERM, shutting down." → "Server on port … shut down", port freed). |
| L16 | Professor solution untracked | **1** | `shared-services/lab04/lab04-solution-main/` removed from the git index (`git rm -r --cached`, preserved on disk), `.gitignore` entry added, matching Lab02/Lab03 precedent. Verified beforehand that no production code references it (only comments and the schema-regression test, which explicitly reads it as a documented negative example). |
| L17 | Manual REST verification (Postman) | **1** | `postman/lab04/lab04.postman_collection.json`, following the `postman/lab02/lab02.postman_collection.json` convention (collection variables, folder-per-scenario, `pm.test` assertions on status + key fields). Covers login, current session, films-to-review, online snapshot, select-then-replace active film, clear active film, and all three rejection paths (401/403/404), ending in logout. Does **not** claim to verify broadcast delivery, reconnect, or multi-session semantics — those remain exclusively covered by `scripts/lab04-realtime-tests.js`. Verified by running the collection with `newman` against a live server: 17 requests, 31 assertions, 0 failures. |
| L18a | WS client close/error cleanup | **1** | `PresenceWebSocketHub.addClient` registers `close`/`error` handlers that remove the client from the broadcast set. Test: `scripts/lab04-realtime-tests.js` "closed clients" scenario (a client that disconnects does not disrupt delivery to the remaining clients). |
| L18b | WS heartbeat / ping-pong stale half-open client detection | **N/A — not required** | **Not implemented, and correctly not claimed as implemented.** The authoritative `specifications/lab04/material/Lab04.pdf` was read in full for this correction: it specifies only "logged in", "selects a new film", and "logs out" as the three broadcast triggers, and describes the initial-snapshot / login / update / logout message flow — it makes **no mention** of heartbeat, ping/pong, keep-alive, or detecting a silently-dead (half-open) TCP connection. This is therefore an unrequired hardening feature, not a missing requirement; it is listed here explicitly, separate from L18a, so it is never silently folded into "close/error cleanup: implemented" the way an earlier version of this document did. |

**Totals: 17 of 17 required canonical rows (L1–L17) at classification 1. L18 is split into L18a (implemented,
tested) and L18b (out of scope — not required by the authoritative PDF, not counted toward or against the
total).**

---

## 5. Backend (`FilmManagerService`) findings

- **Exclusivity bug removed** (`filmsFilmIdActivePUT`): the `conflicting` lookup that rejected a film
  already active for a different reviewer is gone; only the current user's own previous active review is
  deactivated. The now-unreachable `409` response was also removed from `openapi/openapi.yaml` (§14.3).
- **Presence tracking rewritten around real session identity** (§14.1): `userIdBySessionId: Map<sessionId,
  userId>` is the source of truth; `sessionIdsByUserId: Map<userId, Set<sessionId>>` is a derived,
  kept-in-sync per-user view. `recordLogin(userId, sessionId, previousSessionId)` and
  `recordLogout(userId, sessionId)` require the real Express `request.sessionID`, not a boolean or a
  count. A `previousSessionId` continuation check handles Passport's login-time session regeneration.
- **`emitUpdateFor(userId)`** centralizes the null-guard (a `webSocketStatusMessage` that resolves to no
  user must never reach `emit`), used by `filmsFilmIdActivePUT`, `usersCurrentActiveFilmDELETE`, and both
  invalidation paths.
- **`webSocketSnapshot()`** now sorts `[...sessionIdsByUserId.keys()]` ascending before mapping to
  messages.
- **Auth checks added** to `usersOnlineGET`, `filmsFilmIdActivePUT`, `usersCurrentActiveFilmDELETE` —
  each now starts with `requireUser()`, consistent with every other authenticated method in the class.
- **Real HTTP login/logout path traced precisely**: `adapters/openapi-generator/sessionAuth.js` registers
  `/api/sessions` (POST) and `/api/sessions/current` (GET/DELETE) directly on the Express app, *before*
  the generated OpenAPI-validated routes are registered — confirmed by reading `expressServer.js`'s
  middleware registration order. This means the generated `FilmManagerService.sessionsPOST`/
  `sessionsCurrentDELETE` methods are not on the real request path; `recordLogin`/`recordLogout` (and
  therefore the login/logout broadcast) are correctly wired at the point they are *actually* called —
  `sessionAuth.js` — not merely at the vestigial generated-path methods.

## 6. Realtime transport findings

- `PresenceWebSocketHub`: sends only to clients with `readyState === OPEN`; a per-client `send()`
  failure is caught and only removes that one client (isolated, never breaks the broadcast loop); every
  outgoing message (snapshot and broadcast) is schema-validated before sending; incoming client messages
  are discarded, never interpreted.
- `attachRealtimeGateway`: a broadcast/schema failure is caught inside the gateway's event listener and
  logged, never re-thrown into `FilmManagerService.emit(...)` — this decouples broadcast correctness from
  REST success, so a hub bug can never turn an already-committed, successful REST operation into an
  error response.
- `close()` removes exactly the listeners it added (stored by reference, not `removeAllListeners`), so
  repeated attach/close cycles across process restarts or tests never accumulate duplicate
  `FilmManagerService` event listeners or leave a stray `WebSocketServer`.

## 7. React client findings

- `deriveWebSocketUrl` derives `ws:`/`wss:` and host from `window.location` — never a hard-coded host or
  port (the professor reference's `const url = 'ws://localhost:5000'` in `App.jsx` was confirmed, read
  directly, and deliberately not reproduced).
- `connectOnlineStatusSocket` reconnects with exponential backoff (500 ms initial, doubling, capped at
  8 s) until `close()` is called; `close()` is idempotent, cancels any pending reconnect timer, detaches
  all handlers, and closes the live socket.
- `useOnlineStatus` opens exactly one socket per mount (empty-dependency `useEffect`) and closes it on
  unmount; verified safe under React 18 `StrictMode`'s dev-mode double-invoke.
- `applyOnlineStatusMessage`: functional (never mutates input), no duplicate entries (`login`/`update`
  both add-or-replace by `userId`), `logout` removes, an unknown/malformed message is ignored rather than
  thrown.
- `FilmsToReviewPage` calls the real `PUT /api/films/:id/active`; the resulting WebSocket `update`
  broadcast — not local optimistic state — is what actually refreshes the Online page and sidebar for
  every connected client, including the one that made the request.

## 8. Schema compliance

`shared-services/src/realtime/wsMessageSchema.js` compiles
`specifications/lab04/schemas/ws_message_schema.json` once at module load with AJV (`allErrors: true,
strict: true, strictRequired: false`, matching the project's existing Lab01 AJV convention). Every
message the hub sends — snapshot or broadcast — passes through this same compiled validator; there is no
second, looser code path.

## 9. Professor-reference findings (not reproduced)

- **`ws_message_schema.json` defect**: `shared-services/lab04/lab04-solution-main/ws_message_schema.json`
  uses `"taskName"` where the authoritative schema (and this project) uses `"filmTitle"`, and is missing
  the authoritative schema's `required: ["typeMessage","userId"]` and several `allOf` constraints (e.g. it
  does not forbid a `logout` message from carrying `userName`/`filmId`/`filmTitle`). Confirmed directly
  with `diff` against `specifications/lab04/schemas/ws_message_schema.json`, and with a regression test
  (`scripts/lab04-schema-tests.js`) proving the professor copy rejects a canonical, correctly-shaped
  message.
- **Hard-coded WebSocket URL** (`App.jsx:18`, `const url = 'ws://localhost:5000'`) — read directly,
  confirmed, not reproduced; see §7.
- **No reconnect logic, no cleanup on unmount** in the professor's `App.jsx` WebSocket `useEffect` (no
  returned cleanup function; `let socket = useRef(null)` declared but never assigned or used) — read
  directly, confirmed, not reproduced; see §7.
- **Duplicate-login no-op instead of replace**: the professor client's `messageReceived` handler, on a
  `login` message for an already-listed user, returns the array unchanged rather than replacing the
  entry — not reproduced; the project's reducer always replaces on `login`/`update`.

None of these were worked around or reproduced in project code.

## 10. Automated test evidence (this session)

| Suite | File | Result |
|---|---|---|
| Schema | `scripts/lab04-schema-tests.js` | **PASS** — 3 authoritative examples + 4 additional valid cases + 11 invalid cases + 2 `assertValidMessage` cases + 1 professor-schema regression guard, all as expected. |
| Service (direct, no HTTP) | `scripts/lab04-service-tests.js` | **PASS** — auth checks, assigned/unassigned reviewer, one-active-film-per-user, two-users-same-film, snapshot ordering, real session-identity tracking (§14.1: same-session idempotency, two-independent-sessions, unregistered-session no-op, Passport-regeneration continuation), broadcast success/failure gating, active-state invalidation on invitation removal, active-state invalidation on film deletion. |
| Realtime (full end-to-end) | `scripts/lab04-realtime-tests.js` | **PASS** — 16 scenarios against a really-spawned server and real `ws` clients: initial snapshot, login broadcast, update broadcast, multi-client snapshot ordering, multi-client broadcast delivery (×2), multi-session no-duplicate-login, multi-session no-premature-logout, multi-session final-logout (cross-checked on two clients), closed-client resilience, spoofed-message rejection, failed-operation silence, and 4 session-identity scenarios added in §14.1 (same-cookie-jar repeat login, logout-after-repeat-login, two-independent-cookie-jars, failed-login-registers-nothing). Also asserts clean `SIGTERM` shutdown (no forced `SIGKILL`) as part of its teardown. Rerun 3 times for flakiness across this review; consistent every time. |
| React client | `shared-services/lab04/client-app` (`npm test`) | **PASS** — 17 Vitest tests (7 socket: URL derivation ×3, message handling ×2, reconnect ×2; 10 reducer). |
| Manual REST (Postman) | `postman/lab04/lab04.postman_collection.json` | **PASS** — run via `newman`: 17 requests, 31 assertions, 0 failures (§14.2). |

`npm run test:lab04` (schema + service + realtime) and `npm run test:lab04:client` (Vitest + `vite build`)
both run green this session; the exact final consolidated command-by-command output (including the full
Lab01–03 regression re-run after all six corrections in §14) is reported in the assistant's response for
this verification pass, not duplicated here.

## 11. Regression evidence (Labs 01–03)

| Command | Result |
|---|---|
| `npm run test:lab01` | **PASS** — unchanged output. |
| `npm run test:lab02` | **PASS** — unchanged output. |
| `npm run test:lab02:integration` | **PASS** — unchanged output. |
| `npm run test:lab03` | **PASS** — unchanged output (see the final terminal summary for the exact run used for this audit). |
| `npm run smoke` | **PASS** — 19 checks, **one intentionally corrected** from a prior incorrect assertion (see below). |

**Smoke test correction, not a regression**: `scripts/smoke-custom.js` had a step named "conflict when
Karen selects Frank active film" that asserted `409` when a second reviewer selected an already-active
film — this encoded exactly the incorrect exclusivity rule this task asked to remove (L2). It was
rewritten to "two reviewers may independently select the same active film," asserting `200` and that
both reviewers' reviews are simultaneously `active: true`. This is a correction of a wrong assertion, not
a weakening of a correct one — the smoke suite still fully exercises Lab01's film/review/session/image
surface unchanged otherwise.

## 12. Repository hygiene

| Check | Result |
|---|---|
| Professor solution tracked? | **No** — `git ls-files shared-services/lab04/lab04-solution-main` returns 0 after `git rm -r --cached`; content preserved on disk; `.gitignore` entry added. |
| Dependency on the professor copy from production code? | **No** — `grep` before untracking found only comments (`wsMessageSchema.js`) and the explicit, documented regression-guard read in `scripts/lab04-schema-tests.js`. |
| Generated output modified by hand? | **No** — `generated-openapi-generator-custom/expressServer.js` and `index.js` are both reproduced byte-for-byte by `npm run generate:final` from the two edited `out/*.mustache` templates; `git status` after regeneration shows only those two files changed, nothing else. |
| React client build artifacts tracked? | **No** — `shared-services/lab04/client-app/dist/` added to `.gitignore`; `node_modules/` already covered by the existing root pattern. |
| Unrelated files touched? | **No** — `.vscode/settings.json` left untouched throughout. |
| Duplicate schema paths can drift silently? | **No** — see §14.5: the pre-existing, unused `shared-services/lab04/schemas/ws_message_schema.json` is now protected by an automated byte-for-byte consistency test against the canonical `specifications/lab04/schemas/ws_message_schema.json`. |
| Postman collection is valid, parseable JSON? | **Yes** — `node -e "JSON.parse(...)"` succeeds; `newman run` executes all 17 requests / 31 assertions with 0 failures (§14.2). |

## 13. Residual risks / not implemented (out of scope by design)

- **Full professor-app feature parity was deliberately not built.** The React client covers exactly the
  Lab04-relevant surface (login, sidebar, Online page, Films-to-Review active-film selection) and
  intentionally does not reimplement private-film CRUD, review forms, or image upload UI — those already
  exist and are already tested at the API level by Lab01/Lab02; duplicating them in this new client would
  be scope creep unrelated to the WebSocket work this task asked for.
- **No component-level (DOM-rendering) React tests.** Vitest coverage is deliberately scoped to the pure
  reducer and the socket module (both framework-agnostic and fully unit-testable without a DOM); full
  component rendering tests (e.g. via Testing Library) were not added, in favor of the real end-to-end
  backend integration tests in §10 proving the actual client/server contract. `npm run test:lab04:client`
  does include a real `vite build`, proving the whole app — including all JSX — compiles.
- **`npm audit` reports 5 dev-only advisories** in the client-app's Vite/esbuild toolchain (a known,
  moderate-severity "dev server accepts cross-origin requests" issue, not present in the built output or
  any production code path). Fixing it requires a breaking major-version jump across the whole
  vite/vitest toolchain; deferred as disproportionate to this task's scope. Documented here rather than
  silently ignored.
- **No production hardening beyond what Lab04 asks for** (e.g. no WebSocket authentication/authorization
  on the socket itself, no rate limiting) — the channel is read-only from the client's perspective by
  design (see L14), so there is no state-changing surface to protect beyond what the existing
  session-cookie-gated REST API already protects.
- **Presence tracking is process-local, in-memory state — an architectural characteristic of this
  single-process academic deployment, not a defect.** `userIdBySessionId` and `sessionIdsByUserId`
  (§14.1) live only in the memory of the one Node.js process running `FilmManagerService`; they are not
  shared across multiple server instances, and presence state resets whenever the process restarts.
  Horizontal scaling (running more than one instance behind a load balancer) would require a shared
  external presence/session store (e.g. Redis, or an equivalent pub/sub-backed session store) so every
  instance sees the same set of logged-in users and can broadcast to WebSocket clients connected to a
  *different* instance. Redis or similar distributed infrastructure was **intentionally not introduced**:
  it is outside the Lab04 requirements and outside this project's scope, which targets a single Film
  Manager process. This is documented here as a known scope boundary, not as something left broken.

None of the above are treated as blocking gaps.

## 14. Corrections applied in response to reviewer verification (second pass)

An independent verification pass accepted the evidence in §1–§13 as accurate but withheld a merge
recommendation, raising six focused findings. All six were corrected in this same branch (still
uncommitted). This section documents each finding, the fix, and the evidence, so a reviewer does not have
to take "it's fixed" on faith.

### 14.1 Session identity was a count, not a real session

**Finding:** `sessionCountByUserId: Map<userId, count>` incremented on every `recordLogin` call. It could
not distinguish "the same HTTP session logging in twice" (must be idempotent) from "two different
sessions" (must both be tracked), so a duplicate login could over-count presence, and — depending on
ordering — a logout could leave a user incorrectly online or strand their presence.

**Fix:** Replaced with `userIdBySessionId: Map<sessionId, userId>` (source of truth) plus a derived,
kept-in-sync `sessionIdsByUserId: Map<userId, Set<sessionId>>`
(`shared-services/src/services/FilmManagerService.js`). `sessionId` is the real Express
`request.sessionID`, threaded through from `adapters/openapi-generator/sessionAuth.js`.

**A real complication surfaced during testing, not assumed away:** Passport (0.6+) regenerates the
session — and therefore its id — on *every* successful login, as session-fixation protection. This was
confirmed empirically (manual `curl -b/-c` round trip showed two different `connect.sid` values across
two logins from the same cookie jar) before concluding the fix was correct. A naive "same sessionId ⇒
idempotent" check would therefore have still double-broadcast on every real repeat login, because the id
is never literally the same twice. The fix captures the incoming request's session id in Express
middleware **before** `passport.authenticate` runs (`request.incomingSessionId`) and passes it to
`recordLogin` as `previousSessionId`; if `previousSessionId` already maps to the same user,
`recordLogin` treats it as a continuation of that session (swaps the tracked id, emits nothing) instead of
a new one.

Logout requires the given session id to already map to that same user — an unknown/unregistered session
id, or one belonging to someone else, is a no-op and cannot affect a different session. Session ids are
never returned by `usersOnlineGET`, the WebSocket snapshot, or any broadcast — only `userId`/`userName` are.

**Tests added:**
- `scripts/lab04-service-tests.js` §6 (11 sub-scenarios: first-session login, same-session repeat login is
  idempotent — no duplicate presence, no duplicate event — logout after a repeated same-session login,
  two independent sessions both tracked, unregistered-session logout is a no-op, final-session logout,
  `recordLogin` requires a real session id) and §6i (the Passport-regeneration continuation path,
  specifically: a rotated same-session id replaces rather than adds a tracked session).
- `scripts/lab04-realtime-tests.js` "session-identity correctness" block, 4 scenarios over real HTTP
  sessions/cookie jars: repeated login from the same cookie jar does not double-broadcast or double-list;
  logging out that session correctly marks the user offline; two independent cookie jars remain
  multi-session-safe end-to-end (login/login/logout/logout, checked via both the WS broadcast stream and
  `GET /api/users/online`); a failed login (`401`) registers no session and never appears online.
- A first draft of this test (using an already-online seed user, and reading the WebSocket client's
  message count before its initial snapshot had actually arrived) produced a false failure from a test
  race, not a code bug — traced with a temporary debug instrumentation pass (reverted before finalizing),
  then fixed by using a confirmed-offline user and waiting for the snapshot to settle before measuring.
  Documented here so the fix isn't mistaken for having been accepted on the first try.

Verified: `node scripts/lab04-service-tests.js` and `node scripts/lab04-realtime-tests.js` (run 3 times) —
all pass, no flakiness observed.

### 14.2 No Postman collection existed for Lab04

**Finding:** `postman/lab01` (as `postman/film-manager-api.postman_collection.json`) and `postman/lab02/`
both exist; Lab04 had no equivalent, breaking the established per-lab convention and leaving no manual REST
verification artifact.

**Fix:** Added `postman/lab04/lab04.postman_collection.json`, following the same conventions as
`postman/lab02/lab02.postman_collection.json` (collection variables for `baseUrl`/credentials/film ids,
one folder per scenario, `pm.test` assertions on status codes and key response fields). Covers: login,
current session, films-to-review, online snapshot, select-then-replace active film (with online-snapshot
verification of the replacement), clear active film, unauthenticated (`401`), unassigned-reviewer (`403`),
missing-film (`404`), private-film (`404`), and logout. The collection's own `info.description` explicitly
states it verifies REST behavior only, and does **not** verify broadcast delivery to multiple clients,
reconnect, or multi-session semantics — those remain covered exclusively by
`scripts/lab04-realtime-tests.js`. No WebSocket request items were added to the collection itself (Postman
collection-level WS request support is non-standard across Postman versions); instead the description
points a manual tester at the real `ws://.../ws` endpoint as an optional supplemental check.

Verified: `node -e "JSON.parse(...)"` confirms valid JSON; `npx newman run
postman/lab04/lab04.postman_collection.json` against a live server — **17 requests, 31 assertions, 0
failures**. The first run surfaced a real ordering assumption: the collection initially asserted Frank's
*seed* active film (film 1) without establishing it, so running the collection against a server that
`npm run smoke` had already mutated (smoke leaves Frank's active film as 2) failed one assertion. Fixed by
adding an explicit "Establish known active film (film 1)" request before that check, making the collection
self-contained regardless of prior server state — re-verified by deliberately running `npm run smoke`
immediately before `newman run`, against the same already-mutated server: 17/17 requests, 31/31 assertions,
0 failures.

### 14.3 Dead `409` response on the active-film endpoint

**Finding:** `PUT /api/films/{filmId}/active` still declared a `409` response in `openapi/openapi.yaml`,
left over from the removed cross-user exclusivity rule. Grepping `FilmManagerService.js` confirmed no
`409` throw remains anywhere in `filmsFilmIdActivePUT` — the response was unreachable.

**Fix:** Removed the `409` entry from the operation in `openapi/openapi.yaml` (no replacement conflict
condition was introduced, since none is legitimate per the authoritative requirement: "at most one active
film per user" has no scenario left that should reject with a conflict). Regenerated with `npm run
generate:final`; `git status --short generated-openapi-generator-custom` showed only
`api/openapi.yaml` (the copied spec) plus the two intentionally-templated files changed — no hand-patched
generated file.

Verified: `npm run test:lab04` and a fresh `npm run smoke` run both pass unchanged after the regeneration.

### 14.4 Heartbeat/close-cleanup conflation in this document

**Finding:** An earlier version of this audit's L14 row ("no client-message spoofing") and its surrounding
narrative did not clearly separate "closed/errored client cleanup" (which is implemented and tested) from
"heartbeat/ping-pong detection of a silently-dead (half-open) connection" (which was never implemented),
risking the reader assuming the latter was covered by the former.

**Fix:** Read `specifications/lab04/material/Lab04.pdf` in full specifically to check this. It specifies
only three broadcast triggers (login, active-film selection, logout) and the initial-snapshot behavior —
it contains no mention of heartbeat, ping/pong, keep-alive, or half-open-connection detection anywhere.
§4 now lists these as two separate rows: **L18a** (close/error cleanup — implemented, tested) and **L18b**
(heartbeat/stale-connection detection — explicitly marked "not implemented, and correctly not claimed as
implemented", classified N/A-not-required rather than silently counted as a pass).

### 14.5 Two copies of the WebSocket schema, no drift protection

**Finding:** `specifications/lab04/schemas/ws_message_schema.json` (canonical, actually loaded by
`shared-services/src/realtime/wsMessageSchema.js`) and `shared-services/lab04/schemas/ws_message_schema.json`
(pre-existing project scaffolding, part of the original — orphaned — Lab04 design artifacts, confirmed
unreferenced by any production code via `grep`) were byte-identical but had no mechanism keeping them that
way.

**Fix:** Rather than deleting a pre-existing tracked file outside this task's stated scope, added a
documentation note to `shared-services/lab04/README.md` stating plainly which path is canonical and which
is a synchronized reference copy, plus an automated consistency assertion in
`scripts/lab04-schema-tests.js` that fails the suite the moment the two files diverge.

Verified: `node scripts/lab04-schema-tests.js` passes, including the new "no silent drift" assertion.

### 14.6 Shutdown could hang or silently exit 0 on a failed close

**Finding:** `index.mustache`'s SIGTERM/SIGINT handler called `await expressServer.close(); process.exit(0);`
with no `try`/`catch`. Since a signal handler's returned promise is never awaited by Node itself, a
rejected `close()` would either hang the process (never reaching `process.exit`) or surface as an
unhandled rejection depending on Node's configuration — never a clean, logged, non-zero exit. Separately,
`expressServer.close()` closed the realtime gateway and the HTTP server sequentially with no error
isolation: a `realtimeGateway.close()` rejection would propagate immediately and skip closing `this.server`
entirely, leaving the HTTP server open.

**Fix:**
- `out/expressServer.mustache`: `close()` now attempts both resource closes independently (collecting
  errors rather than short-circuiting), so a failure in one never skips the other; it re-throws the first
  collected error only after both have been attempted, and always clears both references.
- `out/index.mustache`: the shutdown handler wraps `close()` in `try`/`catch` — success calls
  `process.exit(0)` only after `close()` actually resolves; failure logs via `logger.error` and calls
  `process.exit(1)`.
- No forced exit was introduced to hide leaked handles in any test: the only `process.exit` calls in the
  whole Lab04 surface are these two signal-handler branches (0 on success, 1 on failure), both reached only
  after `close()` settles.

**Test added:** a new in-process check in `scripts/lab04-realtime-tests.js` constructs a real
(unmodified, freshly regenerated) `ExpressServer` instance, injects a `realtimeGateway.close()` that
throws and a `server.close()` that succeeds, and asserts: both closes are attempted, `close()` rejects
with the injected error (proving it is surfaced, not swallowed), and both instance references are cleared
regardless. Regenerated via `npm run generate:final` before running.

Verified: `node scripts/lab04-realtime-tests.js` — "Shutdown-robustness check passed" plus the existing
real-`SIGTERM`-without-`SIGKILL` assertion in the main scenario block.

---

## 15. Final GO / NO-GO decision

- All 17 required canonical requirement rows (L1–L17) at classification 1 — **confirmed** (§4). L18 is
  explicitly split into implemented (L18a) and correctly-marked-not-required (L18b), per §14.4.
- Real WebSocket transport, sharing the HTTP server, deterministic lifecycle, resilient shutdown —
  **confirmed** (§5–6, §10, §14.6).
- Real session-identity-safe presence tracking, including the Passport session-regeneration case —
  **confirmed** (§14.1).
- Schema-compliant messages only, canonical schema (with drift protection), professor defect avoided —
  **confirmed** (§8–9, §14.5).
- React client with the required reconnect/cleanup/no-duplicate/immediate-update behavior — **confirmed**
  (§7, §10).
- Complete automated tests (backend + client), plus a manual REST verification collection — **confirmed**
  (§10, §14.2).
- Dead OpenAPI response removed, not silently retained — **confirmed** (§14.3).
- No Lab01–03 regression (one test assertion intentionally corrected, not weakened) — **confirmed** (§11).
- Repository hygiene (professor solution untracked, no hand-patched generated output, no schema drift) —
  **confirmed** (§12, §14.5).

No mandatory requirement is unsatisfied. No classification-1 claim in §4 lacks direct, named test evidence.

## **FINAL DECISION: GO**

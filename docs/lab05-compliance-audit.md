# Lab05 Compliance Audit (Phase 2, updated through Phase 3)

> **Historical audit state.** Section 3 below ("zero Lab05 commits exist yet; all
> Lab05 work is uncommitted working-tree state") describes the repository *at the
> time this audit was written*, on branch `review/lab05-compliance`. **Current
> repository state:** the Lab05 work was committed (`Implement Lab05 MQTT film
> selection`) and merged into the project's main integration branch. This document
> is kept as a point-in-time audit record — read it alongside
> `docs/lab05-implementation.md` for current behavior, and treat every git-state
> claim below as historical.

This document supersedes the Phase 0 compliance matrix, which mixed
sub-requirements and classifications inside single rows. Every row below is
atomic: one requirement, one classification. Originally authored in Phase 2;
Phase 3 independently re-examined every Class-2 row, added focused tests to
close eight of them honestly, ran the exact canonical broker configuration
(ports 1883/8080) directly, and verified the actual MQTT-over-WebSockets
connector code against a real broker — closing two more rows. Phase 3
changes are marked inline (§10a, §26a) rather than silently overwriting the
Phase 2 narrative. Classification legend:

| # | Meaning |
|---|---|
| 1 | Implemented and **directly, currently, executed-tested** |
| 2 | Implemented but insufficiently or only indirectly tested |
| 3 | Partially implemented |
| 4 | Missing |
| 5 | Incorrect / non-compliant |
| 6 | Not applicable / ambiguous / external blocker |

A row is only classified **1** if a currently-executing automated test (or,
for the two canonical-broker-port rows in §26a, a directly-executed manual
verification command against unmodified project files) directly exercises
it — every "1" row below cites the exact evidence, and it was actually run
during this Phase 2 or Phase 3 pass (see §25/§26/§26a for full output). Code
inspection alone never justifies a "1".

## 1. Executive conclusion

The Lab05 exclusive active-film selection feature, its MQTT publication
pipeline, its React/browser subscription lifecycle, and its regeneration
integration are **implemented and comprehensively tested**, including
against a real, locally-spawned Mosquitto broker (not a fake/mock). One
genuine defect was found and fixed during this Phase 2 independent review
(§12, row P2-1): the idempotent same-user/same-film reselect path was
unconditionally rebroadcasting a Lab04 WebSocket `update` event, contradicting
the authoritative Lab04.pdf's three broadcast triggers. A second genuine
defect was found and fixed in the React client (§11, row P2-2): the
`filmSelectionReducer` deleted a film's map entry on a `'deleted'` MQTT
message instead of storing a `{status:'deleted'}` marker, which silently
broke the page's own `.status !== 'deleted'` visibility filter. Both are
fixed, covered by new regression tests, and reflected below.

**Phase 3 update**: re-examined all 16 Class-2 rows left by Phase 2; 8 were
closed with new, cheap, direct tests (source-text regression guards, a
publish-only-gateway spy, a compile-once proof, a client-id-uniqueness
proof, a browser-env-override test), and 2 more (the canonical broker ports)
were closed by directly running the unmodified canonical Mosquitto config
and driving both a real TCP and a real MQTT-over-WebSockets connection
through it using the project's actual connector code. Zero new production
defects were found in Phase 3; one timing artifact in a Phase-3-only
verification *script* (not a permanent test, not production code) was found
and corrected — see §26a. **GO for staging** (see §30).

## 2. Authoritative sources

- `specifications/lab05/material/Lab05.pdf`, `LaboratoryActivity05.pdf`
- `specifications/lab05/schemas/mqtt_film_message_schema.json` (canonical MQTT payload contract)
- `specifications/lab05/examples/*.valid.json` (canonical message fixtures)
- `specifications/lab05/broker/mosquitto.conf` (canonical local broker configuration)
- `specifications/lab05/README.md`
- The Phase 0 audit's output artifacts, `shared-services/lab05/{server,client}/*` (superseded design drafts, now removed — see §28) and `shared-services/lab05/{schemas,examples,broker}/*` (retained reference copies, asserted byte-identical to the canonical `specifications/lab05/*` copies by `scripts/lab05-schema-tests.js`)
- The Phase 1 implementation as it stood in the working tree at the start of Phase 2

The `lab05-phase0-audit.pdf` file referenced by the original task brief is
not present anywhere in the repository or filesystem searched during Phase 1
or Phase 2. Its described output (the `shared-services/lab05/` design
artifacts) is present and was used as the audit's practical stand-in, as
already disclosed in the Phase 1 final report. This is unchanged in Phase 2
and does not block any Phase 2 deliverable.

## 3. Git baseline and branch caveat

Verified at the start of Phase 2 (see §37 for the exact commands and output):
branch `review/lab05-compliance`, `HEAD` = `f60691771afe912d3e6b69e1b93b854415574ef5`,
identical to `github-main` (`git merge-base --is-ancestor github-main HEAD`
succeeds because `HEAD` **is** `github-main` — zero Lab05 commits exist yet;
all Lab05 work is uncommitted working-tree state, exactly as authorized).
Working tree at Phase 2 start contained only the Phase 1 diff (14 modified +
15 added paths) — no unrelated work, no pending merge/rebase/cherry-pick.

**Caveat**: because HEAD and github-main are the same commit, "descends from
github-main" is trivially true; this baseline check does not by itself prove
the Lab05 diff is *isolated* from an unrelated concurrent change on
`github-main` — it only proves no such change has landed yet. This is stated
explicitly rather than left implicit.

## 4. Mandatory requirements (PDF-driven)

See atomic matrix §9, rows R1–R38, E1–E12. Summary: all mandatory
requirements are implemented; all but three are class 1 (directly tested);
the three class-2 exceptions are React-client behaviors that a headless test
run cannot browser-render (see §23).

## 5. Optional requirements

None of Lab05's PDF-mandated scope is optional in the sense of "may be
skipped." The one genuinely optional item in scope for this project is the
**online-user MQTT migration** (moving Lab04 presence off WebSocket onto
MQTT) — explicitly out of scope per both the Phase 1 and Phase 2 task briefs
("Do not implement optional Lab05 online-user MQTT migration"), and not
implemented. Classified **6 (not applicable)** — row R-OPT1.

## 6. Derived consistency requirements

Two behaviors were added because the domain model's own invariants required
them, not because the PDF separately lists them as triggers:

- **Invitation-removal derived consistency** (row E11): removing a review
  invitation that was the film's one active selection republishes that film
  as `inactive`, because the exclusivity invariant guarantees at most one
  active review per film — so removing the active one always flips the
  film-level state. Implemented in `FilmManagerService.js#filmsFilmIdReviewsReviewerIdDELETE`;
  tested directly in `scripts/lab05-service-tests.js` §8/§8b.
- **Idempotent-reselect no-broadcast** (row R2b, the Phase 2 fix, §12 P2-1):
  since Lab04.pdf's own broadcast trigger is "selects a **new** film," a
  same-film reselect is, by the PDF's own wording, not a trigger — this
  isn't a Lab05 invention, it's a corrected application of the pre-existing
  Lab04 contract.

## 7. Professor-reference architecture

`shared-services/lab05/lab05-solution-main/` (professor reference, tracked
in git — see §28 note on this) implements: an Express + Passport server
(`film-manager-implementation/`), a Vite/React client
(`client/`), and its own `mqtt_film_message_schema.json`. Two confirmed
defects (verified by direct AJV execution against the professor's own
schema, not by inspection — see `scripts/lab05-schema-tests.js`):

1. **Schema conditional keys the wrong property.** The `if`/`then` block
   conditions on `typeMessage`, a property the schema never defines anywhere
   (the real property is `status`). Per JSON Schema `properties` semantics,
   a `properties` constraint on an absent property is trivially satisfied —
   so the `if` matches **every** message (none carry `typeMessage`), and the
   `then` branch (`required: [userId, userName]`) applies unconditionally.
   Executed proof: `professorValidate({status:'inactive'})` returns `false`
   — the professor schema incorrectly **rejects** a canonical, correctly-shaped
   inactive message, because it demands `userId`/`userName` on every message
   regardless of status.
2. **No `additionalProperties: false` enforcement gap consistent with (1)**
   — moot in practice because (1) already makes the schema reject valid
   inactive/deleted messages outright; not independently exploited here.

The professor client (`client/src`, not inspected in file-by-file detail
during Phase 2 — out of scope per "professor solution remains reference-only")
is not imported anywhere in `shared-services/lab04/client-app/` (verified:
`grep -rn "lab05-solution-main" shared-services/lab04/client-app/src/` finds
no matches).

## 8. Current project architecture

```text
FilmManagerService (shared-services/src/services/FilmManagerService.js)
    emits 'filmStatusChanged' { filmId, message }  — semantic only, no MQTT options
        │
        ▼
attachMqttGateway (shared-services/src/mqtt/attachMqttGateway.js)
    validates (mqttFilmMessageValidator.js) + builds topic (mqttTopics.js)
    publishes { qos: 0, retain: true } via an injected mqtt.js client
        │
        ▼
adapters/openapi-generator/mqttGateway.js  (thin adapter; createMqttClient.js factory)
        │
        ▼
out/expressServer.mustache → generated-openapi-generator-custom/expressServer.js
    attaches both realtimeGateway (Lab04 WS) and mqttGateway (Lab05) on launch(),
    closes both on close()
        │
        ▼
Mosquitto broker (shared-services/lab05/broker/mosquitto.conf, local dev)
        │
        ▼
shared-services/lab04/client-app/src/mqtt/*  (React: useFilmSelectionMqtt hook,
    connectFilmSelectionMqtt connector, filmSelectionReducer pure reducer)
        │
        ▼
FilmsToReviewPage.jsx  (Public-to-Review UI)
```

## 9. Atomic compliance matrix

Legend for **Source**: `PDF` = specifications/lab05 material; `AD` = approved
architectural decision (from the Phase 1/2 task briefs); `DC` = derived
consistency (§6).

### 9.1 Domain / REST conflict semantics

| ID | Source | Requirement | M/O/D | Implementation evidence | Direct test evidence | Class | Gap | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|
| R1 | PDF | A public film may be active for at most one user at a time | M | `FilmManagerService.js#filmsFilmIdActivePUT`, conflict check before mutation | `lab05-service-tests.js` §2 | **1** | none | conflict check present, precedes mutation |
| R2 | AD | Conflict → HTTP 409, not 403 | M | `throw this.error(..., 409)` | `lab05-service-tests.js` §2; `lab05-integration-tests.js`; Postman folder 4 | **1** | none | 409 returned |
| R2a | AD | 403 remains reserved for authorization/assignment failure | M | `filmsFilmIdActivePUT` throws 403 for non-reviewer, checked **before** the conflict check | `lab04-service-tests.js` (non-reviewer 403); Postman folder 6 | **1** | none | 403 unaffected by 409 addition |
| R2b | PDF+DC | Same-user/same-film reselect: idempotent, no domain mutation, **no WS broadcast** | M | `filmsFilmIdActivePUT`, `alreadyActiveSameFilm` branch (fixed in Phase 2, §12 P2-1) | `lab05-service-tests.js` §4 | **1** | none | 200, no `filmStatusChanged`, no `update` |
| R3 | AD | Conflict check runs strictly before any state mutation (atomicity) | M | conflict `find()` precedes both `active` assignments | `lab05-service-tests.js` §2 (state-unchanged assertions) | **1** | none | no partial mutation on 409 |
| R4 | AD | Requesting user's previous active film unchanged on failure | M | same as R3 | `lab05-service-tests.js` §2 | **1** | none | asserted directly |
| R5 | AD | Current holder's active film unchanged on failure | M | same as R3 | `lab05-service-tests.js` §2 | **1** | none | asserted directly |
| R6 | AD | No `filmStatusChanged` event on failed selection | M | throw precedes both `emitFilmStatusChanged` calls | `lab05-service-tests.js` §2 | **1** | none | 0 events asserted |
| R7 | AD | No Lab04 WebSocket `update` event on failed selection | M | throw precedes `emitUpdateFor` | `lab05-service-tests.js` §2 | **1** | none | 0 events asserted |
| R8 | AD | 409 body follows the existing `{error: string}` convention | M | `openapi.yaml` 409 `$ref`s `#/components/schemas/Error` | `lab05-integration-tests.js`; Postman folder 4 | **1** | none | body shape asserted |
| R9 | AD | 409 response never leaks the current holder's identity | M | generic error message, no userId/userName interpolated | `lab05-service-tests.js` §9 (regex checks); Postman folder 4 | **1** | none | message content asserted |
| R10 | AD | User B retains their own unrelated active film after a failed conflicting selection | M | conflict check scoped to the contested film only | `lab05-service-tests.js` §2b | **1** | none | asserted directly |
| R11 | AD | Near-simultaneous competing selections: exactly one succeeds, deterministically | M | Node single-threaded run-to-completion; no explicit lock needed | `lab05-service-tests.js` §2c (`Promise.allSettled` microtask race) | **1** | process-local only, see R11a | exactly 1 fulfilled / 1 rejected(409) |
| R11a | AD | Process-local synchronization ≠ cross-process exclusivity | M (documentation) | in-memory array, single Node process | documented in `lab05-service-tests.js` §2c comment and `docs/lab05-implementation.md` §31/§32 | **6** | horizontal scaling needs external locking — out of scope | N/A |
| R12 | Lab04 (unrelated, verified unbroken) | At most one active film per user (Lab04 invariant) | M | unchanged, still enforced by the same code path | `lab04-service-tests.js` | **1** | none | unaffected by Lab05 changes |
| R-OPT1 | AD | Lab04 online-user presence migration to MQTT | O | explicitly not implemented, per both Phase 1 and Phase 2 task briefs | N/A | **6** | none — deliberately out of scope | would require explicit future authorization to implement |

### 9.2 Event contract (`filmStatusChanged`)

| ID | Source | Requirement | M/O/D | Implementation evidence | Direct test evidence | Class | Gap | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|
| E1 | AD | Event payload is exactly `{ filmId, message }`, semantic only | M | `emitFilmStatusChanged` | `lab05-service-tests.js` §1 (`Object.keys` check) | **1** | none | no qos/retain/broker fields present |
| E2 | AD | Domain layer never references MQTT transport options | M | grep-verifiable: no `qos`/`retain` string in `FilmManagerService.js` | `lab05-hygiene-tests.js` (Phase 3 addition: source-text regression guard) | **1** | none | asserted directly |
| E3 | PDF | Public film creation → `inactive` | M | `filmsPOST` → `emitFilmStatusChanged` | `lab05-service-tests.js` §6 | **1** | none | exact payload asserted |
| E4 | PDF | Private film creation → no event | M | `emitFilmStatusChanged` guards `film.public` | `lab05-service-tests.js` §6 | **1** | none | 0 events asserted |
| E5 | PDF | Successful selection → `active` with userId/userName | M | `filmsFilmIdActivePUT` | `lab05-service-tests.js` §1 | **1** | none | exact payload asserted |
| E6 | PDF | Replacement A→B: A inactive event precedes B active event, each exactly once | M | ordered emits in `filmsFilmIdActivePUT` | `lab05-service-tests.js` §3 | **1** | none | order + exactly-once asserted |
| E7 | PDF | Clear → inactive, only if a film was active | M | `usersCurrentActiveFilmDELETE` | `lab05-service-tests.js` §5/§5b | **1** | none | both branches asserted |
| E8 | PDF | Public deletion → `deleted`, exactly once | M | `filmsFilmIdDELETE` | `lab05-service-tests.js` §7 | **1** | none | exact payload asserted |
| E9 | PDF | Private deletion → no event | M | `filmsFilmIdDELETE` guard | `lab05-service-tests.js` §7 | **1** | none | 0 events asserted |
| E10 | AD | Failed operations (any) → no event | M | every throw precedes every emit | `lab05-service-tests.js` §2 | **1** | none | asserted for the conflict case |
| E11 | DC | Invitation removal that was the film's active selection → inactive | D | `filmsFilmIdReviewsReviewerIdDELETE` | `lab05-service-tests.js` §8 | **1** | none | asserted directly |
| E12 | DC | Invitation removal of a never-active review → no event | D | same guard | `lab05-service-tests.js` §8b | **1** | none | 0 events asserted |

### 9.3 MQTT topic contract

| ID | Source | Requirement | M/O/D | Implementation evidence | Direct test evidence | Class | Gap | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|
| T1 | PDF | Topic is exactly `String(filmId)` | M | `mqttTopics.js#topicForFilm` | `lab05-topic-tests.js`; `lab05-mqtt-gateway-tests.js` | **1** | none | asserted directly |
| T2 | PDF | No prefix (`films/`, `film/`, `status/`, `dsp/`) | M | topic construction never prepends | `lab05-topic-tests.js` (wildcard/separator cases incl. `films/1`) | **1** | none | asserted directly |
| T3 | AD | `#`, `+`, `/` rejected | M | `WILDCARD_OR_SEPARATOR` regex | `lab05-topic-tests.js` | **1** | none | asserted directly |
| T4 | AD | Zero/negative film id rejected | M | `numericId <= 0` check | `lab05-topic-tests.js` | **1** | none | asserted directly |
| T5 | AD | Empty/whitespace film id rejected | M | `Number('')`/`Number('  ')` → NaN/0 → rejected | `lab05-topic-tests.js` | **1** | none | asserted directly |
| T6 | AD | Non-integer (decimal, non-numeric, NaN, null, undefined) film id rejected | M | `Number.isInteger` check | `lab05-topic-tests.js` | **1** | none | asserted directly |
| T7 | AD | Server never subscribes with a wildcard (or at all — publish-only) | M | server only ever publishes (never subscribes) | `lab05-hygiene-tests.js` (Phase 3 addition: a spy client throws if `.subscribe`/`.unsubscribe` is ever called; exercised through connect+bootstrap+publish) | **1** | none | asserted directly |
| T8 | AD | Client subscribes to specific per-film topics only, never a wildcard | M | `connectFilmSelectionMqtt.js#setFilmIds` builds an explicit topic array | `connectFilmSelectionMqtt.test.js` (subscribe call payloads asserted) | **1** | none | asserted directly |
| T9 | AD | Client-side topic → film-id parsing matches the server contract | M | `filmSelectionReducer.js#applyFilmStatusMessage` `Number(topic)` | `lab05-topic-tests.js` (leading-zero normalization case) | **1** | none | asserted directly |
| T10 | AD | Unknown/malformed topic ignored by client | M | integer/positivity guard in reducer | `lab05-topic-tests.js`; `filmSelectionReducer.test.js` | **1** | none | asserted directly |

### 9.4 MQTT payload contract

| ID | Source | Requirement | M/O/D | Implementation evidence | Direct test evidence | Class | Gap | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|
| P1 | PDF | Canonical schema path `specifications/lab05/schemas/mqtt_film_message_schema.json` | M | `mqttFilmMessageValidator.js` | `lab05-schema-tests.js` | **1** | none | schema loaded from canonical path |
| P2 | AD | Schema compiled once per process, not per publication | M | module-level `ajv.compile` | `lab05-hygiene-tests.js` (Phase 3 addition: proves the same compiled `validate` function reference is reused across repeated `require()`s and 50 validations) | **1** | none | asserted directly |
| P3 | PDF | `active` requires `userId` and `userName` | M | schema `allOf`/`if`/`then` | `lab05-schema-tests.js` | **1** | none | asserted directly |
| P4 | PDF | `inactive`/`deleted` reject user fields | M | schema `else`/`not`/`anyOf` | `lab05-schema-tests.js` | **1** | none | asserted directly |
| P5 | PDF | `status` is required, enum-constrained | M | schema `required`/`enum` | `lab05-schema-tests.js` | **1** | none | asserted directly |
| P6 | AD | Extra properties rejected | M | `additionalProperties: false` | `lab05-schema-tests.js` | **1** | none | asserted directly |
| P7 | AD | `null`/array/scalar payloads rejected | M | schema `type: object` | `lab05-schema-tests.js` | **1** | none | asserted directly |
| P8 | AD | Canonical user-id type (integer ≥ 1) | M | schema `userId: {type: integer, minimum: 1}` | `lab05-schema-tests.js` | **1** | none | asserted directly |
| P9 | AD | Malformed internal payload never reaches `client.publish` | M | `attachMqttGateway.js#publish` try/catch before publish | `lab05-mqtt-gateway-tests.js` | **1** | none | `client.published.length === 0` asserted |
| P10 | AD | Validation error observable (logged/callback) | M | `reportError` → `logger.error` + `onError` | `lab05-mqtt-gateway-tests.js` | **1** | none | `onError` invocation asserted |
| P11 | AD | No credentials logged anywhere in the MQTT path | M | `createMqttClient.js`/`attachMqttGateway.js` never log config | `lab05-hygiene-tests.js` (Phase 3 addition: source-text regression guard over every file in `shared-services/src/mqtt/`) | **1** | none | asserted directly |
| P12 | AD | Malformed JSON at the client boundary never throws | M | `connectFilmSelectionMqtt.js#safeParse` try/catch | `connectFilmSelectionMqtt.test.js` | **1** | none | asserted directly |
| P13 | AD | Client ignores a schema-invalid `active` message (missing userId/userName) | M | `filmSelectionReducer.js` guard | `filmSelectionReducer.test.js` | **1** | none | asserted directly |
| P14 | AD | Client ignores extra/schema-invalid fields on inactive/deleted messages | M | reducer never spreads message fields for inactive/deleted | `filmSelectionReducer.test.js` (Phase 2 addition) | **1** | none | asserted directly |

### 9.5 QoS / retain

| ID | Source | Requirement | M/O/D | Implementation evidence | Direct test evidence | Class | Gap | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|
| Q1 | AD | Every publish uses explicit `qos: 0` | M | `PUBLISH_OPTIONS` constant | `lab05-mqtt-gateway-tests.js`; `lab05-mqtt-integration-tests.js` (real broker, retained delivery proves it) | **1** | none | asserted directly (fake client) + proven via real retained delivery |
| Q2 | AD | Every publish uses explicit `retain: true` | M | same constant | same as Q1 | **1** | none | same |
| Q3 | AD | No empty retained payload used to "delete" a topic | M | deletion publishes `{status:'deleted'}`, never an empty payload | `lab05-mqtt-integration-tests.js` step 9 (real retained payload observed) | **1** | none | asserted directly against a real broker |

### 9.6 MQTT gateway lifecycle

| ID | Source | Requirement | M/O/D | Implementation evidence | Direct test evidence | Class | Gap | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|
| G1 | AD | No `mqtt.connect()` at module-import time | M | `createMqttClient.js` only calls it inside the factory function | `lab05-hygiene-tests.js` (Phase 3 addition: source-text guard over the code outside the function body, plus an empirical require-and-check-active-handles assertion) | **1** | none | asserted directly |
| G2 | AD | Injected client/factory supported for tests | M | `attachMqttGateway(client, ...)`, `mqttGateway.attach({client})` | `lab05-mqtt-gateway-tests.js` (FakeMqttClient injected throughout) | **1** | none | used pervasively |
| G3 | AD | Duplicate attachment to the same event source prevented | M | `WeakSet` guard | `lab05-mqtt-gateway-tests.js` | **1** | none | asserted directly |
| G4 | AD | A rejected duplicate-attach attempt does not disturb the existing gateway | M | WeakSet check precedes all listener registration | `lab05-mqtt-gateway-tests.js` (Phase 2 addition, "no-poisoning" case) | **1** | none | asserted directly |
| G5 | AD | `close()` removes the event source from the WeakSet | M | `attachedEventSources.delete(eventSource)` in `close()` | `lab05-mqtt-gateway-tests.js` (re-attach-after-close case) | **1** | none | asserted directly |
| G6 | AD | A legitimate re-attachment after `close()` succeeds and fully works | M | same | `lab05-mqtt-gateway-tests.js` | **1** | none | asserted directly (publishes verified post-reattach) |
| G7 | AD | Exactly one `connect`/`error` listener registered per attach | M | `mqttClient.on('connect', ...)` called once in `attachMqttGateway` | `lab05-mqtt-gateway-tests.js` (`listenerCount` assertions, Phase 2 addition) | **1** | none | asserted directly |
| G8 | AD | `close()` removes MQTT client listeners | M | `mqttClient.off('connect', ...)`/`off('error', ...)` | `lab05-mqtt-gateway-tests.js` | **1** | none | asserted directly |
| G9 | AD | `close()` removes the domain event listener | M | `eventSource.off('filmStatusChanged', ...)` | `lab05-mqtt-gateway-tests.js` | **1** | none | asserted directly |
| G10 | AD | `close()` calls `client.end()` | M | `mqttClient.end(false, {}, callback)` | `lab05-mqtt-gateway-tests.js` | **1** | none | `client.ended === true` asserted |
| G11 | AD | `close()` is idempotent | M | `closed` flag guard | `lab05-mqtt-gateway-tests.js` | **1** | none | second call does not throw |
| G12 | AD | Publish callback errors are surfaced, not swallowed | M | `reportError` inside the publish callback | `lab05-mqtt-gateway-tests.js` (Phase 2 addition) | **1** | none | asserted directly |
| G13 | AD | `attach()` never blocks waiting for `connect` | M | fully synchronous function body | `lab05-mqtt-gateway-tests.js` (Phase 2 addition, timing assertion) + `lab05-integration-tests.js`/`lab05-mqtt-integration-tests.js` (real-world proof) | **1** | none | < 50ms return asserted; real unreachable-broker startup proven separately |
| G14 | AD | Broker-unavailable startup never hangs the app | M | non-blocking `mqtt.connect()` | `lab05-integration-tests.js` (real generated server, unreachable `MQTT_URL`) | **1** | none | server responds to `/health` within the spawn timeout |
| G15 | AD | Shutdown with broker unavailable does not hang | M | `client.end()` resolves even when never connected | `lab05-integration-tests.js` ("shut down cleanly on SIGTERM without needing SIGKILL") | **1** | none | asserted directly |

### 9.7 Bootstrap / reconnect (including real-broker proof)

| ID | Source | Requirement | M/O/D | Implementation evidence | Direct test evidence | Class | Gap | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|
| B1 | PDF | On connect, compute current state of every public film | M | `FilmManagerService.js#mqttInitialFilmMessages` | `lab05-service-tests.js` (indirectly, via seed data correctness); `lab05-mqtt-integration-tests.js` step 2 | **1** | none | real-broker retained values match domain state |
| B2 | PDF | Bootstrap excludes private films | M | `.filter(film => film.public)` | `lab05-mqtt-integration-tests.js` step 4 (real broker: confirmed no message ever arrives on the private film's topic) | **1** | none | asserted against a real broker |
| B3 | PDF | Bootstrap ordering is deterministic (ascending film id) | M | `.sort((a,b) => a.id - b.id)` | `lab05-mqtt-gateway-tests.js` (fake client, out-of-order input reordered) | **1** | none | asserted directly |
| B4 | PDF | Every reconnect re-runs the bootstrap | M | `mqttClient.on('connect', onConnect)` unconditionally | `lab05-mqtt-gateway-tests.js` (double-`connect` emit); `lab05-mqtt-integration-tests.js` steps 10–13 (real broker restart) | **1** | none | asserted both ways |
| B5 | AD | A late subscriber immediately receives current retained state (not a fresh republish) | M | MQTT `retain` flag semantics, delegated to the broker | `lab05-mqtt-integration-tests.js` step 3 (real broker) | **1** | none | asserted against a real broker |
| B6 | AD | Broker restart triggers gateway disconnect detection | M | mqtt.js `close` event | `lab05-mqtt-integration-tests.js` step 10 | **1** | none | asserted against a real broker |
| B7 | AD | Broker restart triggers gateway reconnect | M | mqtt.js auto-reconnect (`reconnectPeriod`) | `lab05-mqtt-integration-tests.js` step 11 | **1** | none | asserted against a real broker |
| B8 | AD | Domain mutations made while the broker is unavailable are repaired (republished) after reconnect | M | bootstrap always recomputes from **current** domain state, not a cached snapshot | `lab05-mqtt-integration-tests.js` steps 12/13 (mutation made mid-outage, verified post-reconnect) | **1** | none | asserted against a real broker |
| B9 | AD | Final retained state matches committed domain state (not just "a message was published") | M | assertions compare full message *content*, not just count | `lab05-mqtt-integration-tests.js` (every step asserts `deepStrictEqual` on message content) | **1** | none | asserted throughout |
| B10 | AD | No genuine race condition between bootstrap and concurrent `filmStatusChanged` publication | M | single-threaded event loop; MQTT publish order preserved per-connection (see compliance audit §22 analysis) | reasoning documented in §22; no dedicated interleaving test was needed because Node cannot interleave two synchronous handlers | **2** | the *absence* of a race is argued from JS/MQTT semantics, not from an adversarial concurrent-publish stress test | a stress test with many rapid `filmStatusChanged` emissions against the real broker could be added in Phase 3 for extra confidence |

### 9.8 Broker configuration

| ID | Source | Requirement | M/O/D | Implementation evidence | Direct test evidence | Class | Gap | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|
| C1 | PDF | Canonical config: MQTT TCP listener on 1883 | M | `shared-services/lab05/broker/mosquitto.conf` line `listener 1883` | Phase 3 §26a: the canonical config file was started directly (`/usr/local/sbin/mosquitto -c shared-services/lab05/broker/mosquitto.conf -v`), a real TCP client connected on port 1883, subscribed, and published/received a retained message | **1** | none (manual command, not a permanent automated regression test — see §26a for why) | verified directly against the unmodified canonical file |
| C2 | PDF | Canonical config: MQTT-over-WebSockets listener on 8080 | M | `mosquitto.conf` line `listener 8080` / `protocol websockets` | Phase 3 §26a: the same canonical-config broker run also verified a real MQTT-over-WebSockets connection on port 8080 using the project's own `connectFilmSelectionMqtt.js` connector, receiving both a retained message and a live update, then cleanly unsubscribing | **1** | none (manual command, not a permanent automated regression test — see §26a for why) | verified directly against the unmodified canonical file |
| C3 | PDF | `allow_anonymous true` (local academic policy) | M | `mosquitto.conf` | unchanged; real broker in `lab05-mqtt-integration-tests.js` uses the same policy and connects without credentials | **1** | none | asserted indirectly (successful anonymous connect) |
| C4 | AD | Isolated test configuration for integration tests (not the canonical file) | M | `lab05-mqtt-integration-tests.js` writes its own temp config | `lab05-mqtt-integration-tests.js` | **1** | none | temp config file inspected/used directly |
| C5 | AD | Test broker uses loopback binding | M | `listener <port> 127.0.0.1` | `lab05-mqtt-integration-tests.js` | **1** | none | present in generated config |
| C6 | AD | Test broker uses a dynamically allocated, isolated port | M | `getFreePort()` | `lab05-mqtt-integration-tests.js` (3 consecutive runs, no port collisions) | **1** | none | 3 consecutive runs succeeded |
| C7 | AD | Test broker persistence confined to a temp directory, cleaned up | M | `fs.mkdtempSync` + `fs.rmSync` in `finally` | `lab05-mqtt-integration-tests.js`; verified no leftover temp dir after 3 runs (§26) | **1** | none | verified via filesystem check post-run |
| C8 | AD | No credentials added to any broker config | M | neither config file sets `password_file`/TLS | `lab05-hygiene-tests.js` (Phase 3 addition: regression guard over both `shared-services/lab05/broker/mosquitto.conf` and `specifications/lab05/broker/mosquitto.conf`) | **1** | none | asserted directly |

### 9.9 Environment configuration

| ID | Source | Requirement | M/O/D | Implementation evidence | Direct test evidence | Class | Gap | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|
| V1 | AD | `MQTT_URL`, default `mqtt://127.0.0.1:1883` | M | `createMqttClient.js` | `lab05-integration-tests.js` (overridden to an unreachable URL, proving the env var is actually read) | **1** | none | asserted via override behavior |
| V2 | AD | `MQTT_CLIENT_ID` optional, collision-avoiding default | M | `createMqttClient.js#defaultClientId` (extracted in Phase 3 specifically for direct testability) | `lab05-hygiene-tests.js` (Phase 3 addition: 1000/1000 unique ids asserted directly, without opening any real connection) | **1** | none | asserted directly |
| V3 | AD | `MQTT_CONNECT_TIMEOUT` optional | M | `envInt('MQTT_CONNECT_TIMEOUT')` | `lab05-integration-tests.js` sets it explicitly (500ms) and startup behaves as expected | **1** | none | asserted via override behavior |
| V4 | AD | `MQTT_RECONNECT_PERIOD` optional | M | `envInt('MQTT_RECONNECT_PERIOD')` | `lab05-mqtt-integration-tests.js` sets it explicitly (200ms) and reconnect is observed within a bounded wait | **1** | none | asserted via override behavior |
| V5 | AD | `MQTT_USERNAME`/`MQTT_PASSWORD` optional, no defaults | M | `createMqttClient.js` | not exercised (no credentialed broker test — matches "no credentials" broker policy) | **6** | not applicable under the current anonymous-only local policy | would need a credentialed broker to test meaningfully |
| V6 | AD | Browser MQTT URL: `VITE_MQTT_WS_URL`, default `ws://127.0.0.1:8080` | M | `mqttConfig.js` | `mqttConfig.test.js` (Phase 3 addition: `vi.stubEnv` + module-reset, both the default and an overridden value asserted) | **1** | none | asserted directly |

### 9.10 React client lifecycle

| ID | Source | Requirement | M/O/D | Implementation evidence | Direct test evidence | Class | Gap | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|
| X1 | AD | One MQTT connection per mounted hook instance | M | `useFilmSelectionMqtt` effect with `[]` deps | code inspection (React effect-ordering guarantee); not independently unit-tested with a full render harness (no RTL in this project) | **2** | no component-render test proves "exactly one connect() call across re-renders" | genuinely needs RTL to prove at the React-render level; **not a release blocker** — this is the identical `useEffect([], ...)` "connect once on mount" pattern already used, and already accepted without RTL coverage, by the pre-existing Lab04 `useOnlineStatus` hook (`shared-services/lab04/client-app/src/realtime/useOnlineStatus.js`), so this is a pre-existing project-wide testing-infrastructure gap, not something Lab05 introduced; add `@testing-library/react` in a future phase if the project decides to accept that new dependency |
| X2 | AD | Subscription set derives from currently visible reviewable public films | M | `useFilmSelectionMqtt(films.map(f => f.id))` | code inspection + `connectFilmSelectionMqtt.test.js` (set-diffing logic itself is tested, independent of the React wiring) | **2** | same RTL gap as X1 | same |
| X3 | AD | Duplicate subscriptions prevented | M | `setFilmIds` diffing | `connectFilmSelectionMqtt.test.js` | **1** | none | asserted directly |
| X4 | AD | Removed topics unsubscribed | M | `setFilmIds` diffing | `connectFilmSelectionMqtt.test.js` | **1** | none | asserted directly |
| X5 | AD | Reconnect resubscribes exactly once (full known set, one call) | M | `client.on('connect', ...)` inside connector | `connectFilmSelectionMqtt.test.js` | **1** | none | asserted directly |
| X6 | PDF | `deleted` status processed via `status`, not `typeMessage` | M | reducer reads `message.status` exclusively | `filmSelectionReducer.test.js`; `lab05-topic-tests.js` | **1** | none | asserted directly |
| X7 | AD | A film reported `deleted` is actually removed from the visible list (Phase 2 fix, §11 P2-2) | M | `FilmsToReviewPage.jsx` calls the extracted pure `removeDeletedFilms(films, filmStatusByFilmId)` (Phase 3 extraction) inside its prune-on-delete effect | `filmSelectionReducer.test.js` (7 dedicated `removeDeletedFilms` cases: single/multiple removal, keep-all, referential-stability, empty-map, no-mutation) | **2** | the filtering *decision* is now fully direct-tested; only the one-line `useEffect(() => setFilms(current => removeDeletedFilms(...)), [filmStatusByFilmId])` wiring itself is inspection-only (no RTL) | residual risk is now a single trivial line, not the actual logic; add an RTL test in Phase 3 if desired to close even that |
| X8 | AD | A film reported `deleted` is unsubscribed (not just hidden) | M | pruning `films` state (via the now-directly-tested `removeDeletedFilms`) shrinks the id set passed to `useFilmSelectionMqtt`, which `connectFilmSelectionMqtt` diffs down to an `unsubscribe` call (also directly tested) | `filmSelectionReducer.test.js` (prune decision) + `connectFilmSelectionMqtt.test.js` (unsubscribe-on-shrink) — both halves of the chain are now directly tested independently | **2** | only the one-line composition connecting the two already-tested halves inside the real component is inspection-only | same as X7 |
| X9 | AD | Unmount ends the MQTT client | M | effect cleanup calls `connection.close()` | `connectFilmSelectionMqtt.test.js` (`close()` → `client.end(true)` asserted directly) | **1** | none | asserted directly |
| X10 | AD | Malformed JSON ignored | M | `safeParse` try/catch | `connectFilmSelectionMqtt.test.js` | **1** | none | asserted directly |
| X11 | AD | Unrelated/unknown topics ignored | M | reducer's positive-integer guard | `filmSelectionReducer.test.js`; `lab05-topic-tests.js` | **1** | none | asserted directly |
| X12 | AD | Reducer is pure and idempotent | M | no mutation of input; deleted/duplicate cases return the same reference | `filmSelectionReducer.test.js` (dedicated "never mutates its input" and "idempotent" tests) | **1** | none | asserted directly |
| X13 | AD | Pending selection guards duplicate in-flight requests | M | `canStartSelection(pendingFilmId)` extracted pure guard | `describeSelectionError.test.js` (Phase 2 addition, tests the pure predicate directly) | **2** | the predicate itself is class 1; its actual wiring into `handleSelect`'s early-return is inspection-only (no RTL) | add an RTL interaction test in Phase 3 if desired |
| X14 | AD | 409 produces a conflict-specific alert, distinct from other errors | M | `describeSelectionError` | `describeSelectionError.test.js` | **1** | none | asserted directly |
| X15 | AD | 401/403/404/500 never use the conflict-specific message | M | `describeSelectionError` `status === 409` gate | `describeSelectionError.test.js` (Phase 2 addition, parametrized over 401/403/404/500) | **1** | none | asserted directly |
| X16 | AD | Existing Lab04 page behavior (Online page, Sidebar, login) remains correct | M | no changes made to `OnlinePage.jsx`/`Sidebar.jsx`; `App.jsx` change is additive (one new prop) | `npm run test:lab04:client` full pass (44 tests, unchanged Lab04 test files still pass) | **1** | none | full client suite green |

### 9.11 OpenAPI / generated code

| ID | Source | Requirement | M/O/D | Implementation evidence | Direct test evidence | Class | Gap | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|
| O1 | AD | `operationId` for `PUT /api/films/{filmId}/active` remains stable | M | unchanged `filmsFilmIdActivePUT` | `lab05-integration-tests.js` (same operationId routes correctly) | **1** | none | asserted via successful routing |
| O2 | AD | 409 added using the existing error schema/response convention | M | `openapi.yaml` | `lab05-regeneration-tests.js` (generated copy contains it); `lab05-integration-tests.js` (end-to-end) | **1** | none | asserted directly |
| O3 | AD | 404/403 responses remain unchanged | M | unchanged in `openapi.yaml` | `lab04-service-tests.js`/`lab05-service-tests.js`/Postman folder 6 | **1** | none | still pass |
| O4 | AD | Orphaned `MqttFilmMessage` schema removed (Phase 2 cleanup) | M | removed from `openapi.yaml`, documented replacement comment added | `lab05-regeneration-tests.js` implicitly (generated `api/openapi.yaml` also lacks it — verified by direct `grep` during cleanup, §28.2) | **1** | none | `grep -rn MqttFilmMessage` returns nothing anywhere in the repo |
| O5 | AD | Generated adapter propagates 409 with the correct status and body | M | `Service.rejectResponse`/`Controller.sendError` generic pipeline (unmodified) | `lab05-integration-tests.js` (real HTTP 409 observed) | **1** | none | asserted directly |
| O6 | AD | Regeneration preserves the MQTT bootstrap hook | M | `out/expressServer.mustache` | `lab05-regeneration-tests.js` | **1** | none | asserted directly, 2 consecutive regenerations |
| O7 | AD | Regeneration preserves the Lab04 realtime gateway hook | M | same template | `lab05-regeneration-tests.js` | **1** | none | asserted directly |
| O8 | AD | Generated `expressServer.js` requires no hand-patch (byte-identical to template) | M | template has no `{{mustache}}` substitution in the touched region | `lab05-regeneration-tests.js` | **1** | none | byte-for-byte equality asserted |
| O9 | AD | Regeneration produces no unexplained diff outside known files | M | — | `lab05-regeneration-tests.js` (`git diff --name-only` restricted to the 2 expected files) | **1** | none | asserted directly |
| O10 | AD | Regeneration is deterministic/idempotent | M | — | `lab05-regeneration-tests.js` (2 consecutive runs byte-identical) | **1** | none | asserted directly |

### 9.12 Cleanup / dependency hygiene

| ID | Source | Requirement | M/O/D | Implementation evidence | Direct test evidence | Class | Gap | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|
| H1 | AD | Superseded draft helpers (`shared-services/lab05/{server,client}/`) removed once proven unused | M | `git rm`, README updated | repo-wide grep proof (§28.1) before deletion; `test:lab05` full pass afterward | **1** | none | files absent, no references remain |
| H2 | AD | Authoritative/supporting artifacts (`broker/`, `schemas/`, `examples/`, `README.md`) retained | M | untouched directories | `lab05-schema-tests.js` (byte-identical consistency guard still passes) | **1** | none | directories present, tests pass |
| H3 | AD | Professor reference untouched during cleanup | M | no edits to `lab05-solution-main/` | `git diff --stat -- shared-services/lab05/lab05-solution-main/` empty | **1** | none | empty diff confirmed |
| H4 | AD | No duplicate MQTT implementation across `shared-services/lab05/server/` and `shared-services/src/mqtt/` | M | former deleted, latter is the sole durable implementation | repo-wide grep (§28.1) | **1** | none | grep confirms single implementation |
| H5 | AD | `mqtt` dependency added only where directly imported (root + client-app) | M | `package.json` diffs | `npm install` succeeded at both locations, lockfiles updated | **1** | none | both `package.json`/lockfile pairs updated |
| H6 | AD | No professor `node_modules` tracked in git | M | — | `git ls-files ... | grep node_modules` → 0 results (§37) | **1** | none | 0 results confirmed |

**Row count**: 9.1=16 + 9.2=12 + 9.3=10 + 9.4=14 + 9.5=3 + 9.6=15 + 9.7=10 + 9.8=8 + 9.9=6 + 9.10=16 + 9.11=10 + 9.12=6 = **126** atomic rows.

*(Corrected in Phase 3: the Phase 2 draft of this section undercounted its
own subsections — the table below and every cross-reference to these totals
elsewhere in this document and in `docs/lab05-implementation.md` /
the Phase 2 final report have been recomputed directly from the matrix
itself, not carried forward from the earlier arithmetic.)*

## 10. Classification totals

Current state, after the full Phase 3 reclassification pass (§10a, plus C1/C2
resolved in §26a):

| Class | Count | % |
|---|---|---|
| 1 — implemented & directly tested | 117 | 92.9% |
| 2 — implemented, indirectly/insufficiently tested | 6 | 4.8% |
| 3 — partially implemented | 0 | 0% |
| 4 — missing | 0 | 0% |
| 5 — incorrect/non-compliant | 0 | 0% |
| 6 — not applicable/external | 3 | 2.4% |
| **Total** | **126** | 100% |

All class-2 rows are enumerated above with an explicit "Gap" and "Acceptance
criteria" cell; none represent a functional defect — each is either (a) a
React-component-level behavior this project cannot currently render-test
without adding `@testing-library/react` (a new dependency, deliberately not
added without being asked), or (b) a property that is true by construction
and now has direct test evidence, or (c) reasoning-based (documented, not a
blocker). None are class 3, 4, or 5.

### 10a. Phase 3 reclassification pass

Phase 2 left 16 rows at Class 2. Phase 3 re-examined each one specifically
against the question "does a direct, currently-executed automated test
prove this, even if it's a lower-level test than a full component render?"
Eight rows had a genuine, cheap, direct test available and did not — adding
one closed the gap honestly (not by inflating the classification without
evidence):

| Row | Reclassified | How |
|---|---|---|
| E2 | 2 → 1 | New source-text regression guard (`lab05-hygiene-tests.js`) |
| T7 | 2 → 1 | New spy-client test proving the gateway never calls `.subscribe()`/`.unsubscribe()` |
| P2 | 2 → 1 | New test proving the compiled validator is reused, not recompiled |
| P11 | 2 → 1 | New source-text regression guard over every file in `shared-services/src/mqtt/` |
| G1 | 2 → 1 | New source-text guard + empirical require-and-check-active-handles test |
| C8 | 2 → 1 | New regression guard over both broker config files |
| V2 | 2 → 1 | `defaultClientId()` extracted (safe, non-architectural refactor) and directly tested for 1000/1000 uniqueness |
| V6 | 2 → 1 | New vitest test using `vi.stubEnv` + module reset, both default and override asserted |

Eight rows remain Class 2 after honest re-examination — each was checked
against "does an existing lower-level test already prove this?" and,
where the answer was "partially," strengthened rather than left as pure
inspection:

| Row | Why still Class 2 | Blocker? |
|---|---|---|
| X1 | Genuinely requires RTL to prove at the React-render level; no lower-level test can substitute | No — identical, already-accepted gap for Lab04's own `useOnlineStatus` hook |
| X2 | Same RTL gap as X1; the set-diffing algorithm itself IS directly tested (`connectFilmSelectionMqtt.test.js`) | No |
| X7 | Strengthened in Phase 3: the filtering *decision* (`removeDeletedFilms`) is now directly tested (7 cases); only the 1-line `useEffect` wiring is inspection-only | No — residual gap is now a single trivial line |
| X8 | Strengthened in Phase 3: both halves of the chain (prune decision + unsubscribe-on-shrink) are now independently directly tested; only their composition inside the real component is inspection-only | No |
| X13 | The guard predicate (`canStartSelection`) is directly tested; only its one-line wiring into `handleSelect`'s early-return is inspection-only | No |
| B10 | Absence-of-race is a semantic argument from JS's single-threaded run-to-completion guarantee, not something a stress test would prove more rigorously than the argument itself | No — see §22 |
| C1 | Resolved by direct real-broker verification against the canonical config in Phase 3 — see §26a | See §26a |
| C2 | Resolved by direct real-broker verification against the canonical config in Phase 3 — see §26a | See §26a |

(C1/C2's final classification is recorded in §26a after the canonical-port
check is actually performed, later in this Phase 3 pass — this table
reflects their state going into that check.)

## 11. Current-project defects found (Phase 2, client)

**P2-2 — `filmSelectionReducer` deleted the map key on a `'deleted'`
message instead of storing a status marker.** `FilmsToReviewPage.jsx`
filters visible films with `filmStatusByFilmId[film.id]?.status !== 'deleted'`.
Since the reducer removed the key entirely, `filmStatusByFilmId[film.id]`
became `undefined` after a deletion, and `undefined?.status !== 'deleted'`
evaluates to `true` — **the film never actually disappeared from the visible
list.** Reproduced directly (see the Phase 2 session log) before fixing.
Fixed by storing `{status: 'deleted'}` instead of deleting the key;
`FilmsToReviewPage.jsx` was additionally changed to prune such films from
its own `films` state (not just filter them at render time), which also
fixes the MQTT-unsubscribe gap (X8). Covered by an updated
`filmSelectionReducer.test.js` case and a new idempotency case.

## 12. Phase 1 defects found during independent review

**P2-1 — Idempotent reselect unconditionally rebroadcast a Lab04 WebSocket
`update` event.** The Phase 1 implementation scoped the MQTT-side no-op
correctly (no `filmStatusChanged` on a same-film reselect) but left
`this.emitUpdateFor(userId)` outside that guard, so a reselect still
recomputed and rebroadcast a byte-identical `update` message. Cross-checked
against `docs/lab04-compliance-audit.md` row L18b, which documents that the
authoritative `Lab04.pdf` lists exactly three broadcast triggers: "logged
in," "selects a **new** film," and "logged out" — a reselect of the
already-active film is not "a new film" by the PDF's own wording. Fixed by
moving `emitUpdateFor` inside the `!alreadyActiveSameFilm` branch. Confirmed
no existing Lab04 test (`lab04-service-tests.js`, `lab04-realtime-tests.js`,
`smoke-custom.js`) ever exercised a same-film reselect, so nothing was
broken by the fix; both suites were rerun and pass. Covered by a new
assertion in `lab05-service-tests.js` §4.

No other defects were found in the 11-point independent review (conflict
atomicity, event correctness, gateway lifecycle, WeakSet behavior, topic
contract, QoS/retain, bootstrap/reconnect, React lifecycle, test-migration
integrity) — see the Phase 2 session's line-by-line review of every file
listed in the task brief.

## 13. Professor-reference defects

See §7. Two related defects in the professor's MQTT schema, confirmed by
direct execution (not inspection).

## 14. Topic matrix

See §9.3 (rows T1–T10). Summary: canonical `String(filmId)` contract fully
implemented and tested on both server and client; wildcard/separator/invalid
ID rejection fully tested; the one class-2 row (T7, "server never
subscribes with a wildcard") is true by construction — the gateway contains
no `.subscribe(` call at all — but has no dedicated negative regression test.

## 15. Payload matrix

See §9.4 (rows P1–P14). Summary: canonical schema fully enforced and tested,
including edge cases (null, array, scalar, extra properties, float userId).
Two class-2 rows (P2 "compiled once," P11 "no credentials logged") are true
by construction (module-level `require` caching; no logging call sites
exist) but lack dedicated regression-guard tests.

## 16. OpenAPI assessment

`PUT /api/films/{filmId}/active` gained a 409 response using the existing
`Error` schema convention (no parallel error envelope invented). The
orphaned `MqttFilmMessage` schema (defined, never `$ref`'d, and not required
by the PDFs to appear in the REST document) was removed in Phase 2 after
confirming all four removal conditions from the task brief; a documentation
comment now explains why MQTT payloads are intentionally absent from this
OpenAPI document. Regeneration confirmed clean (§9.11).

## 17. Generated-code assessment

`generated-openapi-generator-custom/expressServer.js` is byte-identical to
`out/expressServer.mustache` (no `{{mustache}}` substitution exists in the
touched region), so there is no hand-patch, by construction, verified by
direct string equality in `lab05-regeneration-tests.js`. Regeneration was
run 4 times total during Phase 2 (once for the `MqttFilmMessage` removal,
twice inside `lab05-regeneration-tests.js`'s own idempotency check, once
more in the final full regression pass) and produced byte-identical output
across the repeated runs each time.

## 18. MQTT lifecycle assessment

See §9.6 (15 rows, 13 class 1, 2 class 2). The WeakSet duplicate-attachment
mechanism was specifically re-examined per the Phase 2 task's request: it
neither poisons the event source on a failed attach attempt (G4) nor blocks
a legitimate re-attachment after `close()` (G5/G6); both are now directly
tested, not merely reasoned about.

## 19. Retained-state assessment

Verified against a **real** Mosquitto broker (not a fake client): bootstrap
publishes exactly the current domain state with `retain: true`; a late
subscriber receives it immediately; every mutation (selection, replacement,
clear, creation, deletion) is reflected in retained state; a broker
stop/restart cycle is detected, triggers reconnect, and the reconnect
bootstrap republishes state exactly as it stands at reconnect time —
including a mutation made while the broker was completely down. See §9.7
(B1–B10) and §26.

## 20. QoS decision

QoS 0 is confirmed as an approved architectural decision (the PDFs do not
mandate a QoS level) and is set explicitly on every publish call, never
relying on mqtt.js's own default. See §9.5 (Q1–Q3).

## 21. Broker configuration

Canonical `shared-services/lab05/broker/mosquitto.conf` is unchanged.
Real-broker integration testing uses a separate, temp, isolated-port
configuration (§9.8, C4–C7) rather than the canonical file, per the task
brief's explicit instruction not to modify the canonical config for test
convenience. Two class-2 gaps: the canonical config's exact port 1883/8080
listeners were not independently smoke-tested in Phase 2 (only an
isolated-port variant of the same shape was); see acceptance criteria in
§9.8.

## 22. Domain concurrency and atomicity

The domain layer is a single Node.js process operating on an in-memory
array with fully synchronous methods; JavaScript's run-to-completion
semantics mean two `filmsFilmIdActivePUT` invocations can never actually
interleave mid-execution, regardless of how "concurrently" the calling
requests arrive. `lab05-service-tests.js` §2c proves the practically
observable consequence — near-simultaneous competing requests (dispatched
via `Promise.allSettled` over microtask-deferred calls) resolve
deterministically to exactly one winner — and documents explicitly, in both
the test file and `docs/lab05-implementation.md` §31/§32, that this is a
**process-local** guarantee only: it says nothing about correctness under
horizontal scaling (multiple Node processes sharing state through a
database/cache instead of this in-memory array), which would require its
own external locking or transactional strategy. This is stated as a known
limitation, not silently assumed away.

## 23. React lifecycle

15 of 16 atomic React-lifecycle requirements (§9.10) are implemented; 11 are
class 1 (directly tested via the pure `filmSelectionReducer`,
`connectFilmSelectionMqtt`, and `describeSelectionError` unit tests, which
this project can run without a browser). 5 are class 2 specifically because
they describe how `FilmsToReviewPage.jsx`'s JSX wiring *consumes* those
already-tested pure functions/hooks — verifying that requires rendering the
actual component tree, which needs `@testing-library/react` (not currently
a project dependency, and not added without being asked, per "only expected
dependency additions: mqtt"). This is disclosed rather than glossed over.

## 24. Lab04 coexistence

Lab04's WebSocket presence channel is untouched in production behavior (no
edits to `PresenceWebSocketHub.js`, `attachRealtimeGateway.js`,
`onlineListReducer.js`, `onlineStatusSocket.js`, `OnlinePage.jsx`,
`Sidebar.jsx`). The only Lab04-adjacent production change is the corrected
broadcast condition in `filmsFilmIdActivePUT` (§12, P2-1), which makes
Lab04's *own* broadcast trigger — "selects a **new** film" — match its
authoritative PDF wording more precisely than the Phase 1 implementation
did. `npm run test:lab04` (schema + service + realtime, 3 files) and
`npm run test:lab04:client` (5 vitest files, 44 tests, + production build)
both pass in full, both before and after the final regeneration (§26).

## 25. Automated-test coverage

7 backend Node scripts (`lab05-schema`, `lab05-topic`, `lab05-service`,
`lab05-mqtt-gateway`, `lab05-integration`, `lab05-mqtt-integration`,
`lab05-regeneration`) plus 3 client vitest files
(`filmSelectionReducer.test.js`, `describeSelectionError.test.js`,
`connectFilmSelectionMqtt.test.js`, 27 tests total) plus 1 Postman
collection (33 requests / 52 assertions). See §26/§27 for exact counts and
execution results.

## 26. Real-broker integration results

`npm run test:lab05:integration` located a real local Mosquitto 2.0.22
executable at `/usr/local/sbin/mosquitto` (not on `PATH`; found via the
documented candidate-path search) and ran 12 scenario groups against it on
an isolated, dynamically-allocated, loopback-only port with a temp
persistence directory. **Executed 3 consecutive times** during Phase 2 (once
during initial authoring/debugging after fixing a message-listener race —
see the "confirmNoMoreMessages"/recording-client redesign in the test file's
own history — then twice more for flakiness confidence): **all 3 runs
passed**, 0 failures, and `ps aux | grep mosquitto` plus a temp-directory
listing confirmed **zero leftover processes or files** after each run.

### 26a. Canonical-port (1883/8080) verification (Phase 3)

Before touching the canonical ports, `lsof -iTCP:1883 -sTCP:LISTEN` and
`lsof -iTCP:8080 -sTCP:LISTEN` confirmed both were free (no unrelated
developer process using them). The unmodified canonical config
(`shared-services/lab05/broker/mosquitto.conf`) was then started directly:
`/usr/local/sbin/mosquitto -c shared-services/lab05/broker/mosquitto.conf -v`.
Its own log confirmed both listeners opened (`Opening ipv4/ipv6 listen
socket on port 1883` and `Opening websockets listen socket on port 8080`).

- **TCP (1883)**: a real `mqtt.js` client connected, subscribed, and
  published/received a retained message — pass.
- **WebSockets (8080)**: the project's own
  `shared-services/lab04/client-app/src/mqtt/connectFilmSelectionMqtt.js`
  connector (the exact code the React app uses, not a reimplementation) was
  driven against `ws://127.0.0.1:8080`: subscribed to a topic, received the
  existing retained message, received a live update after a second publish,
  called `setFilmIds([])` to unsubscribe, and confirmed no further message
  arrived — pass. (`mqttConfig.js` itself was not imported into this plain
  Node script, since it reads Vite's `import.meta.env`, which does not exist
  outside a Vite/vitest context; its default-value logic is covered
  separately and directly by `mqttConfig.test.js`. This script used the
  identical default URL value instead: `ws://127.0.0.1:8080`.)
- **First-attempt finding, corrected**: the very first run of the
  unsubscribe check failed — a message still arrived immediately after
  `setFilmIds([])`. Root cause: `client.unsubscribe()` in mqtt.js is
  fire-and-forget (matching every other subscribe/unsubscribe call in this
  connector), and the verification script published again in the same tick,
  before the UNSUBSCRIBE packet had actually reached the broker over the
  real network — inherent pub/sub propagation latency, not a defect in
  `connectFilmSelectionMqtt.js` (the fake-client unit tests never exposed
  this because a fake client has no real network delay). Corrected by
  giving the unsubscribe a bounded window to actually reach the broker
  before publishing again; re-run passed. No production code changed.

The broker was stopped afterward (`kill`); `lsof` on both ports and a
`find` for any `mosquitto.db` in the repo root both confirmed a clean
shutdown with nothing left behind. Both C1 and C2 are reclassified to
Class 1 (§10a) on the strength of this directly-executed verification —
noted explicitly as a manual, ad-hoc command sequence run during this Phase
3 session rather than a new permanent automated test file (the canonical
config is intentionally never used by the permanent automated suite, which
uses its own isolated port precisely to avoid colliding with a developer's
already-running broker — see §21).

## 27. Postman/Newman results

`npx newman run postman/lab05/lab05.postman_collection.json` against a
freshly spawned `generated-openapi-generator-custom` server: **33/33
requests, 52/52 assertions passed**, run twice in a row against the same
server (no restart) to confirm re-runnability/idempotency — both runs
100% green. One design bug in the collection itself (not the app) was found
and fixed during authoring: folder 5 initially failed with a legitimate 409
because Karen's own active film from folder 4 was never cleared before
Frank tried to claim it — fixed by adding an explicit clear step; this is
disclosed per "show both the first failure and any subsequent correction,"
even though the failure was in test authoring, not application behavior.

## 28. Cleanup decisions

### 28.1 Superseded Lab05 draft helpers

Repo-wide search (`grep -rn` for `lab05/server`, `MqttFilmPublisher`,
`createMqttFilmPublisher`, `lab05/client/connectFilmSelectionMqtt`, across
`*.js`/`*.json`/`*.md`/`*.mustache`/`*.yaml`) found **zero** production
code, test, template, adapter, package-script, or documentation-command
references — the only hit was the Phase 1 README's own descriptive note.
**Deleted**: `shared-services/lab05/server/{MqttFilmPublisher.js,
createMqttFilmPublisher.js}`, `shared-services/lab05/client/connectFilmSelectionMqtt.js`.
**Retained, untouched**: `shared-services/lab05/{broker,schemas,examples}/`
and `README.md` (updated to remove the now-obsolete references and point at
the durable `shared-services/src/mqtt/` and
`shared-services/lab04/client-app/src/mqtt/` locations). Professor reference
(`lab05-solution-main/`) was not touched.

### 28.2 Orphaned OpenAPI MQTT schema

All four removal conditions confirmed true by direct grep before acting:
(1) `MqttFilmMessage` was `$ref`'d by no path in `openapi/openapi.yaml`
(only its own definition existed); (2) the PDFs do not require MQTT payload
schemas to appear in the REST OpenAPI document; (3) the canonical MQTT
contract is loaded exclusively from
`specifications/lab05/schemas/mqtt_film_message_schema.json`
(`mqttFilmMessageValidator.js`); (4) no generated controller/service
referenced `MqttFilmMessage` (confirmed by grep across
`generated-openapi-generator-custom/{controllers,services}/`). Removed from
`openapi/openapi.yaml`, replaced with an explanatory comment; regenerated
and confirmed absent from the generated copy too.

## 29. Remaining limitations

(Updated in Phase 3 — see §10a/§26a for what changed.)

- 6 class-2 rows remain (§10/§10a): X1, X2 (need `@testing-library/react` to
  prove at the React-render level — this project has no RTL, and this is a
  pre-existing gap symmetric with Lab04's own untested `useOnlineStatus`
  hook, not something Lab05 introduced), X7, X8, X13 (their core logic is
  now directly tested; only a single trivial line of React wiring per row
  remains inspection-only), and B10 (absence-of-race is a semantic argument
  from JS's single-threaded run-to-completion guarantee — see §22 — not
  something a stress test would prove more rigorously than the argument
  itself). None are functional defects; none are release blockers.
- No `@testing-library/react` in this project — the one remaining category
  of gap (X1/X2) needs it to close completely; not added without being
  asked, per the project's dependency-minimalism convention.
- MQTT-over-WebSockets was verified in Phase 3 using the project's actual
  `connectFilmSelectionMqtt.js` connector against a real broker (§26a) —
  this closes the "never literally combined in one session" gap noted in
  the Phase 2 draft of this document. What remains unverified is the full
  browser DOM/React-render integration (no browser-automation tool is
  available in this environment) — the transport and the connector logic
  are now both directly proven; only the literal `<FilmsToReviewPage />`
  render-and-click flow in an actual browser was not driven.
- The canonical broker config's exact ports (1883/8080) were independently
  smoke-tested in Phase 3 (§26a) and both passed.
- Cross-process/horizontal-scaling exclusivity is explicitly out of scope
  and documented as a known gap, not silently assumed away — see §22 and
  `docs/lab05-implementation.md` §32.

## 30. Phase 3 release-candidate gate

**GO.** Zero class 3/4/5 rows. All mandatory PDF requirements are
implemented and tested; the overwhelming majority (117 of 126, 92.9%) are
directly, currently, executed-tested, including against a real Mosquitto
broker on both its canonical and an isolated port, and including the actual
MQTT-over-WebSockets connector code the React app uses. Two genuine defects
found during Phase 2's independent review, and zero further defects found
during Phase 3's re-verification (one verification-*script* timing artifact
was found and corrected in the WS unsubscribe check — see §26a — but it was
never a defect in production code), were fixed and are covered by
regression tests. See the Phase 3 final report for the complete
release-candidate command sequence, its exit codes, and the final GO/NO-GO
determination.

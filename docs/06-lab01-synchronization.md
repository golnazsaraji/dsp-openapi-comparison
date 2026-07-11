# Lab01 synchronization

This note records how the final, generator-neutral implementation satisfies Lab01. It does not replace or rewrite the historical experiments. The course PDFs and the professor's Lab01 solution remain reference material; the repository's final implementation remains the comparison target.

The Lab01 PDF and presentation are the primary authority. The professor solution is a valuable working baseline, but it is not imported at runtime and it does not override the written requirements.

## Source-to-implementation map

| Lab01 requirement | Contract or schema | Handwritten implementation | Verification |
|---|---|---|---|
| Draft 7 User, Film, and Review schemas | `specifications/lab01/schemas/` | Responses are shaped by `FilmManagerService` | `scripts/lab01-schema-tests.js` |
| Public film and review reads | `/api/films/public...` | `FilmManagerService` public methods | API smoke test |
| Login, current user, and logout | `/api/sessions...`, `cookieAuth` | `sessionAuth.js` uses Passport LocalStrategy, `express-session`, and bcrypt | API smoke test |
| Protected private-film operations | `/api/films...` | Session identity is passed to the shared service; private reads are owner-scoped | Service and API tests |
| User discovery | `/api/users`, `/api/users/{userId}` | Sanitized user DTOs never contain password data | API smoke test |
| Review invitations and completion | Film review paths | Owner checks, atomic invitation validation, reviewer checks, completion rules | Service tests |
| Balanced automatic assignments | `/api/films/public/assignments` | Only the current owner's unassigned public films are considered; ties are resolved by user id | Service tests |
| Pagination and HATEOAS | `FilmPage`, `ReviewPage`, resource links | Top-level counts plus `films` or `reviews`, with `self`, `next`, and `prev` | API smoke test |

## Authentication in plain language

A login no longer trusts a fixed user number. Passport checks the submitted email and password. Passwords are stored only as bcrypt hashes. After a successful login, the browser receives the standard `connect.sid` session cookie. Later protected requests use that session to identify the user, and only the numeric user id is serialized into the session. Logging out destroys the session.

`SESSION_SECRET` should be set outside the source code for a deployed server. The included fallback exists only so the academic project runs locally without extra setup.

## Intentional project decisions

The professor's solution uses SQLite. This comparison project intentionally keeps its domain records in memory so both generated-server approaches can call the same small handwritten service. Consequently, films, reviews, sessions, and assignment changes reset when the Node process restarts. This is an explicit academic simplification, not an accidental persistence claim.

The final server is generated from `openapi/openapi.yaml` with reusable templates in `out/`. Authentication integration and domain behavior live outside the disposable generated directory. Regeneration therefore does not require editing generated controllers or services.

Later-lab image, WebSocket, and MQTT endpoints remain in the shared final contract, but they are not part of this Lab01 synchronization assessment.

## Professor baseline: reused behavior and corrected defects

The final implementation reuses the professor solution's useful observable design: server-side sessions, email/password login, owner-controlled films and invitations, reviewer-controlled completion, public review navigation, pagination, and HATEOAS links. The SQLite implementation itself is retained only as reference material.

The following known baseline defects are intentionally not copied:

- film and review rating accept 0 through 10;
- boolean defaults are real booleans;
- public films cannot contain private-only fields;
- incomplete and completed reviews enforce their opposite field requirements;
- review pages use `reviews`, not `films`;
- `cookieAuth` describes `connect.sid`, not JWT;
- the balanced-assignment route is active, owner-scoped, deterministic, and implemented;
- Passport serializes only the user id and never the full user or hash;
- login compares the supplied password without creating a discarded hash;
- logout destroys the session and clears the cookie;
- invitation uniqueness and email uniqueness are enforced by the authoritative in-memory data model and operations.

Both historical generator experiments delegate through their adapters to `shared-services/src/services/FilmManagerService.js`. The active final OpenAPI Generator output additionally receives its authentication middleware from the external adapter. Generated directories therefore remain replaceable evidence/output rather than a second home for business rules.

Balanced assignment runs only when its API operation is called. Lab01 specifies an operation design, not a timer or background scheduler.

## Running the checks

Generate and start the final server:

```bash
npm run generate:final
npm start
```

In another terminal:

```bash
npm test
```

`npm test` first checks the Lab01 schemas and shared behavior, then runs the existing end-to-end smoke workflow against the running server.

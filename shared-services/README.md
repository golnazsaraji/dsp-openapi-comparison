# Shared Services

This directory contains handwritten business logic used by the generated server implementations.

The purpose of this directory is to keep application logic outside generated code. This makes the project safer to regenerate because changes to generated folders do not overwrite the core service implementation.

## Contents

| Directory | Meaning |
|---|---|
| `lab01/` | Lab01 Draft 7 JSON Schemas and valid JSON examples. |
| `lab02/` | Lab02 gRPC converter `.proto` contract and image-management notes. |
| `lab03/` | Lab03 TCP converter protocol notes and Java client/server sources. |
| `lab04/` | Lab04 WebSocket message schema and online-list helper code. |
| `lab05/` | Lab05 MQTT schema, broker configuration, and pub/sub helper code. |
| `src/` | Source code for handwritten shared services. |

The generated projects access this logic through the adapter layer in `adapters/`.

| Service | Purpose |
|---|---|
| `src/services/InitialFilmService.js` | Handwritten implementation for the restored initial simple OpenAPI example. |
| `src/services/FilmManagerService.js` | Handwritten implementation for the final Film Manager API. |
| `src/services/FilmService.js` | Compatibility export for older generated code; it re-exports `FilmManagerService.js`. |

## Relation to the Lab Specifications

The final shared service currently implements the Film Manager behavior as five lab-oriented
areas:

| Lab area | Shared-service responsibility |
|---|---|
| Session and status API | Login, logout/current-session behavior, and health checks. |
| Public film catalogue | Public film listing, single public-film reads, and public review reads. |
| Authenticated film management | Owned-film listing, creation, detail reads, updates, and deletion. |
| Review and image workflows | Reviewer invitation/removal, current-review completion, and Lab02 image metadata operations. |
| Realtime active-film behavior | Lab04 online-user snapshot, Lab05 MQTT film-selection messages, active-film selection, active-film clearing, and conflict detection when two reviewers select the same film. |

This separation is documentation-level only; the implementation intentionally remains in one shared in-memory service so both generator experiments exercise the same business state and the same error rules.

Film list operations implemented by the shared service return paginated response objects, matching the canonical OpenAPI contract in `../openapi/openapi.yaml`. Lab02 image listing intentionally returns a plain JSON array, as specified by the laboratory text.

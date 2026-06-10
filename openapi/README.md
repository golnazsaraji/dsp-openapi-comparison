# OpenAPI Specifications

This directory contains the OpenAPI contracts that are part of the final project.

The complete five-lab specification index is in `../specifications/README.md`. This directory intentionally contains only OpenAPI documents.

## Contents

| File | Meaning |
|---|---|
| `initial-example.yaml` | Small Film API example used as the initial generator-comparison specification. |
| `openapi.yaml` | Canonical Film Manager API used by the final project. |

The canonical Film Manager contract covers sessions, public films, owned films, reviews, Lab02 image management, Lab04 active film selection, Lab05 MQTT film-selection messages, and realtime status surfaces. It includes paginated film/review list responses, non-paginated Lab02 image metadata lists, HATEOAS `self` links, explicit error responses, and stable `operationId` values so generated services can delegate to the adapter layer predictably.

`openapi.yaml` is the input used by the final regeneration workflow:

```bash
npm start
```

When the final API contract changes, update `openapi.yaml` first and then regenerate the custom server.

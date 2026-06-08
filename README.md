# DSP OpenAPI Generator Comparison

This repository is one final project for the DSP laboratory work. It compares generated Node.js server stubs while keeping the Film Manager business logic outside generated code, so the API layer can be regenerated without losing handwritten implementation.

## Project Structure

| Path | Meaning |
|---|---|
| `openapi/` | OpenAPI specifications used by the project. |
| `shared-services/` | Shared handwritten Film Manager logic plus Lab01 and Lab02 artifacts. |
| `adapters/` | Adapter layer connecting generated services to `shared-services/`. |
| `out/` | Customized OpenAPI Generator templates. |
| `generated-openapi-generator/` | Earlier OpenAPI Generator output kept for comparison. |
| `generated-swaggerhub/` | SwaggerHub / Swagger Codegen output kept for comparison. |
| `generated-openapi-generator-custom/` | Regenerated server using the customized templates. |
| `scripts/` | Smoke test and historical helper scripts. |
| `postman/` | Postman collection for manual checks. |
| `docs/` | Written comparison and implementation notes. |

## Specifications

The visible OpenAPI specifications are:

| File | Purpose |
|---|---|
| `openapi/initial-example.yaml` | Restored initial simple Film API example used at the start of the comparison. |
| `openapi/openapi.yaml` | Canonical Film Manager API used by the final project. |

The canonical Film Manager contract includes session-based authentication, public film reads, owned-film CRUD, review invitations, review completion, the mandatory auto-invitation design endpoint, image metadata endpoints, active-film behavior, HATEOAS `self` links, paginated list responses, and explicit error responses.

Lab01 Draft 7 JSON Schemas and valid JSON examples are stored in:

```text
shared-services/lab01/
```

Lab02 image-management notes and the gRPC converter contract are stored in:

```text
shared-services/lab02/
```

Lab03 TCP converter client/server sources and protocol notes are stored in:

```text
shared-services/lab03/
```

Lab04 WebSocket message schema and reusable online-list helpers are stored in:

```text
shared-services/lab04/
```

Lab05 MQTT message schema, Mosquitto configuration, and MQTT client/server helpers are stored in:

```text
shared-services/lab05/
```

## Architecture

```text
OpenAPI specification
        ↓
Generated API layer
        ↓
Adapter layer
        ↓
Shared handwritten services
```

The generated folders are treated as artifacts. Handwritten behavior is kept in `shared-services/` and is reached through `adapters/`, which is the regeneration-safe part of the experiment.

## Running

From the project root:

```bash
npm start
```

This regenerates the customized OpenAPI Generator server from `openapi/openapi.yaml`, installs dependencies inside `generated-openapi-generator-custom/`, and starts the server.

If port `3000` is busy:

```bash
PORT=3101 BASE_URL=http://localhost:3101 npm start
```

In a second terminal, run the smoke test:

```bash
npm test
```

The smoke test checks health, public reads, login/session behavior, paginated list responses, authenticated film CRUD, review invitation/removal, and active-film conflict handling.

## Documentation

The main written analysis is in:

- `docs/01-swaggerhub-analysis.md`
- `docs/02-experimental-comparison.md`
- `docs/03-openapi-generator-options-analysis.md`
- `docs/04-service-url-reference.md`

These documents explain the generator comparison, the regeneration-safe adapter approach, and the final custom-template workflow.

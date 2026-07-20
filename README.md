# DSP OpenAPI Generator Comparison

This repository is one final project for the DSP laboratory work. It compares generated Node.js server stubs while keeping the Film Manager business logic outside generated code, so the API layer can be regenerated without losing handwritten implementation.

## Project Structure

| Path | Meaning |
|---|---|
| `openapi/` | OpenAPI specifications used by the project. |
| `specifications/` | Evaluation-facing folders for Lab01-Lab05 specifications and course material. |
| `shared-services/` | Shared handwritten Film Manager logic plus Lab01-Lab05 artifacts. |
| `adapters/` | Adapter layer connecting generated services to `shared-services/`. |
| `out/` | Customized OpenAPI Generator templates. |
| `generated-openapi-generator/` | Initial generated server for the initial simple OpenAPI example. |
| `generated-swaggerhub/` | Historical SwaggerHub / Swagger Codegen output kept for comparison. |
| `generated-openapi-generator-custom/` | Disposable regenerated server using the customized templates. |
| `runtime-data/uploaded_files/` | Persistent uploaded files kept outside the disposable generated server. |
| `scripts/` | Smoke test and historical helper scripts. |
| `postman/` | Postman collection for manual checks. |
| `docs/` | Written comparison and implementation notes. |

## Specifications

The five laboratory specifications are organized as separate folders in:

```text
specifications/
```

Each lab folder contains the course PDFs in `material/` plus the related JSON Schema, OpenAPI reference, Protocol Buffers, TCP protocol, WebSocket, or MQTT artifacts used by the project.

The visible OpenAPI specifications are:

| File | Purpose |
|---|---|
| `openapi/initial-example.yaml` | Initial simple Film API example used at the start of the comparison. |
| `openapi/openapi.yaml` | Canonical Film Manager API used by the final project. |

The initial simple example is complete:

| Part | Location |
|---|---|
| OpenAPI specification | `openapi/initial-example.yaml` |
| Generated OpenAPI Generator server | `generated-openapi-generator/` |
| Handwritten service implementation | `shared-services/src/services/InitialFilmService.js` |
| Adapter connecting generated code to handwritten code | `adapters/initial-example/DefaultServiceAdapter.js` |
| Smoke test | `scripts/smoke-initial.js` |

The canonical Film Manager contract includes session-based authentication, public film reads, owned-film CRUD, review invitations, review completion, the mandatory auto-invitation design endpoint, image metadata endpoints, active-film behavior, HATEOAS `self` links, paginated list responses, and explicit error responses.

Lab01 Draft 7 JSON Schemas and valid JSON examples are stored in:

```text
specifications/lab01/
```

The final Lab01 mapping, authentication design, intentional in-memory storage decision, and verification commands are documented in `docs/06-lab01-synchronization.md`.

Lab02 image-management notes and the gRPC converter contract are stored in:

```text
specifications/lab02/
```

Lab03 TCP converter client/server sources and protocol notes are stored in:

```text
specifications/lab03/
```

Lab04 WebSocket course material, message schema, and examples are stored in:

```text
specifications/lab04/
```

Lab05 MQTT course material, message schema, examples, and Mosquitto configuration are stored in:

```text
specifications/lab05/
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

## Requirements

The normal project workflow uses Node.js for the generated API server and smoke tests,
and Java for OpenAPI Generator. Use `npm run generate:final` when the specification or
templates change; `npm start` starts the already-generated final server.

Required tools:

| Purpose | Package or tool |
|---|---|
| Clone and manage the repository | `git` |
| Run the generated server and smoke tests | Node.js 18 or newer, with `npm` |
| Run OpenAPI Generator | Java 17 JDK or JRE |
| Regenerate the server from `openapi/openapi.yaml` | `@openapitools/openapi-generator-cli` using OpenAPI Generator `7.22.0` |

The project pins OpenAPI Generator version `7.22.0` in `openapitools.json`. Install the
CLI globally if it is not already available:

```bash
npm install -g @openapitools/openapi-generator-cli
```

### macOS

```bash
brew install git node openjdk@17
npm install -g @openapitools/openapi-generator-cli
```

Optional Lab05 MQTT broker:

```bash
brew install mosquitto
```

### Ubuntu / Debian

```bash
sudo apt update
sudo apt install git nodejs npm openjdk-17-jdk
npm install -g @openapitools/openapi-generator-cli
```

Optional Lab05 MQTT broker:

```bash
sudo apt install mosquitto
```

If the distribution Node.js package is older than Node.js 18, use NodeSource, `nvm`, or
the official Node.js installer instead.

### Fedora

```bash
sudo dnf install git nodejs npm java-17-openjdk-devel
npm install -g @openapitools/openapi-generator-cli
```

Optional Lab05 MQTT broker:

```bash
sudo dnf install mosquitto
```

### Windows

Using `winget`:

```powershell
winget install Git.Git
winget install OpenJS.NodeJS.LTS
winget install EclipseAdoptium.Temurin.17.JDK
npm install -g @openapitools/openapi-generator-cli
```

Optional Lab05 MQTT broker:

```powershell
winget install EclipseMosquitto.Mosquitto
```

The generated final server installs its own npm dependencies from
`generated-openapi-generator-custom/package.json` when `npm start` is executed from the
project root.

## Running

Start the final Film Manager API from the project root:

```bash
npm start
```

This runs `npm run start:final`: the generated package installs its dependencies through
its existing `prestart` lifecycle and starts the already-generated server. It does not
regenerate the server.

The `generated-openapi-generator-custom/` directory is disposable. Uploaded files persist
under `runtime-data/uploaded_files/` by default. Set `UPLOAD_DIR` to use a different upload
directory; the server creates the selected directory automatically.

To regenerate the final server without starting it, for example after changing the OpenAPI
contract or templates:

```bash
npm run generate:final
```

If port `3000` is busy:

```bash
PORT=3101 BASE_URL=http://localhost:3101 npm start
```

In a second terminal, run the smoke test:

```bash
npm test
```

The smoke test checks health, public reads, login/session behavior, paginated list responses, authenticated film CRUD, review invitation/removal, and active-film conflict handling.

To run the initial simple example instead:

```bash
npm run start:initial
```

Then, in a second terminal:

```bash
npm run test:initial
```

## Documentation

The main written analysis is in:

- `docs/01-swaggerhub-analysis.md`
- `docs/02-experimental-comparison.md`
- `docs/03-openapi-generator-options-analysis.md`
- `docs/04-service-url-reference.md`
- `docs/05-success-codes-and-upload-storage.md`
- `docs/06-lab01-synchronization.md`

These documents explain the generator comparison, the regeneration-safe adapter approach, and the final custom-template workflow.

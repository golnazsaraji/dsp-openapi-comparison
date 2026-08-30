# DSP OpenAPI Generator Comparison

## 1. Project overview

This is a DSP laboratory project. It compares generated Node.js server
stubs — OpenAPI Generator vs. SwaggerHub / Swagger Codegen — while keeping
all Film Manager business logic in a handwritten layer that survives
regeneration. On top of that comparison, the project implements five
labs (Lab01–Lab05) as successive features of one Film Manager API: schema
validation and authentication, image upload/conversion over gRPC, a raw
TCP image-conversion protocol, real-time WebSocket presence, and MQTT-based
exclusive active-film selection.

## 2. Repository structure

| Path | Contents |
|---|---|
| `openapi/` | OpenAPI specifications (`initial-example.yaml`, `openapi.yaml`). |
| `specifications/` | Course material and per-lab reference artifacts (`lab01/`–`lab05/`). |
| `shared-services/` | Handwritten Film Manager logic (`src/`) plus per-lab artifacts (`lab02/` Java Converter, `lab03/` TCP client/server, `lab04/` client app and realtime code, `lab05/` MQTT broker config). |
| `adapters/` | Regeneration-safe glue between generated services and `shared-services/`. |
| `out/` | Customized OpenAPI Generator Mustache templates — the source of truth for the generated server. |
| `generated-openapi-generator/` | Generated server for the initial simple example. |
| `generated-openapi-generator-custom/` | Disposable generated server for the final Film Manager API. |
| `generated-swaggerhub/` | Historical SwaggerHub / Swagger Codegen output, kept for comparison. |
| `runtime-data/` | Persistent data outside the disposable generated server (uploaded files, image metadata). |
| `scripts/` | Test suites and smoke-test scripts. |
| `postman/` | Postman collections for manual and automated (Newman) checks. |
| `docs/` | Written analysis, per-lab implementation docs, runbooks, and configuration reference. See `docs/README.md` for the full index. |

## 3. Architecture

```text
OpenAPI specification (openapi/openapi.yaml)
        ↓
Generated API layer (generated-openapi-generator-custom/, disposable)
        ↓
Adapter layer (adapters/openapi-generator/, regeneration-safe)
        ↓
Shared handwritten services (shared-services/src/, business logic)
```

The generated layer is treated as a build artifact: `npm run generate:final`
can delete and rebuild it at any time from `openapi/openapi.yaml` and the
templates in `out/`. All persistent behavior — the Film Manager domain
logic, the WebSocket presence gateway, and the MQTT gateway — lives in
`shared-services/src/` and is reached through the thin adapter layer in
`adapters/openapi-generator/`, so regeneration never loses handwritten code.

## 4. Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| `git` | any recent version | clone and manage the repository |
| Node.js + `npm` | 18 or newer | run the generated server, shared services, tests |
| Java JDK | 17 or newer | complete all-labs setup; satisfies the Lab02 Converter's Java 17 target and OpenAPI Generator's Java 11 minimum |
| `@openapitools/openapi-generator-cli` | globally installed; npm wrapper version is not pinned | invoke the OpenAPI Generator engine used to regenerate the server |
| Mosquitto | any recent version | optional MQTT broker for Lab05 |

### Java Requirements and Where Java Is Used

Java is required by specific development, generation, and lab workflows; it is
not a runtime dependency of the already-generated Node.js REST server.

| Component / operation | Java requirement | Reason |
|---|---|---|
| OpenAPI server regeneration | Java 11 or newer | OpenAPI Generator engine `7.22.0` runs as a Java JAR; see the [official OpenAPI Generator 7.22.0 documentation](https://github.com/OpenAPITools/openapi-generator/tree/v7.22.0#13---download-jar) |
| Response metadata generation | None | `scripts/generate-openapi-response-metadata.js` runs with Node.js and `js-yaml` |
| Generated Node.js server runtime | None | `generated-openapi-generator-custom/package.json` starts it with `node index.js` |
| Lab02 Converter | JDK 17 or newer | `shared-services/lab02/converter-java/pom.xml` sets `maven.compiler.release` to `17` |
| Lab03 Java demo and tests | JDK required; release not pinned | the Lab03 scripts invoke `javac` and `java`, but the repository sets no Java release for them |
| Complete all-labs setup | JDK 17 or newer | one JDK satisfies both OpenAPI Generator's Java 11 minimum and Lab02's Java 17 requirement |

The root commands have these requirements:

| Command | Java requirement |
|---|---|
| `npm run generate:server` | Java 11 or newer |
| `npm run generate:final` | Java 11 or newer for its `generate:server` stage; its `generate:response-metadata` stage does not use Java |
| `npm run generate:response-metadata` | None |
| `npm run converter:build` | JDK 17 or newer |
| `npm run converter:start` | JDK 17 or newer |
| `npm start` / `npm run start:final` | None; these start the already-generated Node.js server |

`openapitools.json` pins the **OpenAPI Generator engine** to `7.22.0`. The
`@openapitools/openapi-generator-cli` **npm wrapper** is not declared in the
root `package.json` or `package-lock.json`; the installation commands below
install it globally without pinning its npm package version. The wrapper reads
`openapitools.json`, selects engine `7.22.0`, and launches that engine's Java
JAR. Therefore Java 17 is the complete-project baseline because of Lab02, not
because OpenAPI regeneration specifically requires Java 17.

macOS:

```bash
brew install git node openjdk@17 mosquitto
npm install -g @openapitools/openapi-generator-cli
```

Ubuntu / Debian (use NodeSource or `nvm` instead if the distribution's
Node.js package is older than 18):

```bash
sudo apt update
sudo apt install git nodejs npm openjdk-17-jdk mosquitto
npm install -g @openapitools/openapi-generator-cli
```

Fedora:

```bash
sudo dnf install git nodejs npm java-17-openjdk-devel mosquitto
npm install -g @openapitools/openapi-generator-cli
```

Windows (`winget`):

```powershell
winget install Git.Git OpenJS.NodeJS.LTS EclipseAdoptium.Temurin.17.JDK EclipseMosquitto.Mosquitto
npm install -g @openapitools/openapi-generator-cli
```

## 5. Installation

```bash
npm install
npm run generate:final
```

`npm install` installs the root-level tooling (test scripts, smoke test).
`npm run generate:final` builds `generated-openapi-generator-custom/` from
`openapi/openapi.yaml` and `out/`; it does not install that directory's own
dependencies — that happens automatically the first time it starts (see
below).

## 6. Configuration

Every component runs with documented, local-development defaults and needs
no configuration to start. See `docs/configuration.md` for the full
environment-variable reference (server port, upload/storage paths, session
secret, WebSocket path, gRPC Converter address/port, MQTT broker URL and
credentials, React client build variable).

## 7. Running

```bash
npm start
```

Installs `generated-openapi-generator-custom/`'s own dependencies (via its
`prestart` script) and starts the already-generated server on port `3000`.
**This does not regenerate the server** — run `npm run generate:final`
first if `openapi/openapi.yaml` or a template in `out/` changed.

Override the port:

```bash
PORT=3101 BASE_URL=http://localhost:3101 npm start
```

To also exercise Lab02 (image conversion), Lab04 (WebSocket presence
client), or Lab05 (MQTT broker and live client updates), see the full
sequence in `docs/run-all-labs.md` — it covers starting the Java Converter,
Mosquitto, and the React client alongside the server.

To run the initial simple example instead of the final Film Manager API:

```bash
npm run start:initial   # then, in a second terminal:
npm run test:initial
```

## 8. Testing

```bash
npm test          # Lab01 tests + smoke test
npm run smoke      # smoke test only (server must already be running)
```

Every lab also has its own dedicated test command:

| Command | Covers |
|---|---|
| `npm run test:lab01` | JSON Schema validation, service-layer unit tests |
| `npm run test:lab02` | Image metadata service, Converter client |
| `npm run test:lab02:integration` | Real gRPC round-trip against the Java Converter |
| `npm run test:lab02:proto` | Protocol Buffers schema consistency |
| `npm run test:lab03` | TCP protocol, client robustness, server concurrency, large-file/matrix conversion, alpha-channel handling, interoperability |
| `npm run test:lab04` | WebSocket schema, service events, realtime gateway |
| `npm run test:lab04:client` | React client unit tests and production build |
| `npm run test:lab05` | MQTT schema, topics, service exclusivity logic, gateway, hygiene, in-process integration, regeneration safety |
| `npm run test:lab05:integration` | Real MQTT round-trip against a running Mosquitto broker |

`npm run test:lab02:integration` requires the Java Converter running
(`npm run converter:build && npm run converter:start`);
`npm run test:lab05:integration` requires Mosquitto running. See
`docs/run-all-labs.md` for the full startup/shutdown sequence and the
Postman/Newman commands.

## 9. Labs overview

| Lab | Adds | Current implementation doc |
|---|---|---|
| Lab01 | JSON Schema contract, session authentication, in-memory Film Manager domain | `docs/06-lab01-synchronization.md` |
| Lab02 | Image upload, metadata storage, gRPC-based Java image converter | `docs/lab02-implementation.md` |
| Lab03 | Raw TCP image-conversion protocol (client + concurrent server) | `shared-services/lab03/README.md` |
| Lab04 | Real-time WebSocket presence and active-film notifications | `docs/lab04-implementation.md` |
| Lab05 | MQTT-based exclusive active-film selection (supersedes Lab04's per-user rule with a global one; see `docs/lab04-implementation.md` for the current behavior) | `docs/lab05-implementation.md` |

## 10. Documentation index

See `docs/README.md` for the complete, categorized documentation index
(getting started, architecture/comparison analysis, per-lab implementation
docs, configuration, runbooks, and Postman guides). Start with:

- `docs/run-all-labs.md` — canonical end-to-end startup/test sequence
- `docs/configuration.md` — every environment variable
- `docs/01-swaggerhub-analysis.md` through `docs/06-lab01-synchronization.md` — the generator-comparison analysis this project is built around

## 11. Known limitations

- All state (films, reviews, sessions, WebSocket presence, MQTT-tracked
  active films) is held in memory in a single Node.js process and resets on
  restart. There is no database and no persistence beyond uploaded files
  and their metadata — an intentional academic simplification.
- The design does not horizontally scale: WebSocket and MQTT state is
  process-local, so running multiple server instances behind a load
  balancer would desynchronize presence and active-film state.
- The bundled Mosquitto configuration (`shared-services/lab05/broker/mosquitto.conf`)
  allows anonymous connections and uses no TLS — local development only.
- `SESSION_SECRET` defaults to a published, fixed development value and
  must be overridden before any non-local deployment.
- Postman/Newman collections verify HTTP-visible behavior only; they do not
  exercise the WebSocket or MQTT channels directly. Automated tests under
  `scripts/` cover those channels instead (see section 8).

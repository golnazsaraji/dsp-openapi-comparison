# Configuration reference

Every environment variable the project actually reads, verified directly
against source (not inferred). All variables are optional — every component
runs with its documented default if the variable is unset.

## Film Manager server

| Variable | Default | Required? | Purpose | Read by |
|---|---|---|---|---|
| `PORT` | `3000` | No | HTTP port for the Film Manager API (REST + WebSocket + static Swagger UI). | `generated-openapi-generator-custom/config.js` |
| `UPLOAD_DIR` | `runtime-data/uploaded_files/` (relative to the repository root) | No | Where uploaded image files (Lab02) are stored, outside the disposable generated server. Created automatically if missing. | `shared-services/src/images/ImageStorage.js` |
| `IMAGE_METADATA_PATH` | `runtime-data/image-metadata.json` | No | Path to the atomic JSON metadata store for uploaded images. | `shared-services/src/images/ImageMetadataRepository.js` |
| `SESSION_SECRET` | `dsp-lab01-development-session-secret` | No, but **set a real value before any non-local deployment** | express-session's cookie-signing secret. The default is intentionally a fixed, published string so the project runs locally with zero setup — it provides no real security and must never be used outside local development. | `adapters/openapi-generator/sessionAuth.js` |
| `WS_PATH` | `/ws` | No | Mount path for the Lab04 WebSocket presence gateway, on the same HTTP server/port as the REST API. | `adapters/openapi-generator/realtimeGateway.js` |

## Lab02 Java Converter (gRPC)

| Variable | Default | Required? | Purpose | Read by |
|---|---|---|---|---|
| `CONVERTER_GRPC_ADDRESS` | `localhost:50051` | No | Address the Film Manager's Node gRPC client connects to. Set this on the **Film Manager** side if the Converter runs elsewhere. | `shared-services/src/images/ConverterClient.js` |
| `CONVERTER_GRPC_PORT` | `50051` | No | Port the Java Converter itself listens on. Set this on the **Converter** side. | `shared-services/lab02/converter-java/src/main/java/dsp/lab02/converter/ConverterServer.java` |
| `CONVERTER_GRPC_DEADLINE_MS` | `10000` | No | Client-side deadline (ms) for a single conversion call. | `shared-services/src/images/ConverterClient.js` |
| `IMAGE_CONVERSION_CHUNK_SIZE` | `65536` (64 KiB) | No | Streaming chunk size (bytes) for gRPC image transfer. | `shared-services/src/images/ConverterClient.js` |
| `IMAGE_MAX_CONVERTED_BYTES` | `10485760` (10 MiB) | No | Upper bound on a converted image's size; larger output is rejected. | `shared-services/src/images/ConverterClient.js` |

## Lab05 MQTT (server side)

| Variable | Default | Required? | Purpose | Read by |
|---|---|---|---|---|
| `MQTT_URL` | `mqtt://127.0.0.1:1883` | No | Broker address the Film Manager's MQTT gateway connects to. | `shared-services/src/mqtt/createMqttClient.js` |
| `MQTT_CLIENT_ID` | generated per process (`dsp-lab05-<pid>-<random>`) | No | MQTT client identifier. The generated default avoids collisions between concurrent server/test instances. | `shared-services/src/mqtt/createMqttClient.js` |
| `MQTT_CONNECT_TIMEOUT` | mqtt.js library default (unset unless provided) | No | Connect timeout (ms), passed through to the underlying `mqtt.js` client only if set. | `shared-services/src/mqtt/createMqttClient.js` |
| `MQTT_RECONNECT_PERIOD` | mqtt.js library default (unset unless provided) | No | Reconnect interval (ms), passed through to `mqtt.js` only if set. | `shared-services/src/mqtt/createMqttClient.js` |
| `MQTT_USERNAME` | unset | No | Broker username. The bundled local Mosquitto config uses `allow_anonymous true`, so this is not needed for local development. | `shared-services/src/mqtt/createMqttClient.js` |
| `MQTT_PASSWORD` | unset | No | Broker password. Same note as `MQTT_USERNAME`. | `shared-services/src/mqtt/createMqttClient.js` |

## Lab04/05 React client (build-time)

| Variable | Default | Required? | Purpose | Read by |
|---|---|---|---|---|
| `VITE_MQTT_WS_URL` | `ws://127.0.0.1:8080` | No | MQTT-over-WebSockets URL the browser client connects to for live Lab05 film-status updates. Read at build time by Vite. | `shared-services/lab04/client-app/src/mqtt/mqttConfig.js` |

The Lab04/05 REST and WebSocket calls (`/api/*`, `/ws`) are same-origin and
need no configuration — the dev server (`npm run dev`) proxies them to
`localhost:3000` (see `shared-services/lab04/client-app/vite.config.js`); a
production build is served from the same origin as the API.

## Test scripts

| Variable | Default | Required? | Purpose | Read by |
|---|---|---|---|---|
| `BASE_URL` | `http://localhost:3000` | No | Target server for `npm run smoke` when the server runs on a non-default port. | `scripts/smoke-custom.js` |

## Security note

None of the defaults above are safe for a non-local deployment. In
particular, `SESSION_SECRET` must be replaced, and the Mosquitto
configuration (`allow_anonymous true`, no TLS) is documented as
local-development-only in `shared-services/lab05/README.md`.

# Run every lab, end to end

One canonical sequence for building, running, and testing all five labs from
a clean checkout. Individual lab documents link here instead of repeating
these steps. See `docs/configuration.md` for every environment variable used
below.

## 1. Prerequisites

Working directory: repository root.

| Check | Command | Expected |
|---|---|---|
| Git | `git --version` | any recent version |
| Node.js | `node -v` | `v18` or newer |
| npm | `npm -v` | bundled with Node.js |
| Java JDK | `java -version` and `javac -version` | 17 or newer for the complete all-labs setup |
| OpenAPI Generator CLI | `openapi-generator-cli version` | OpenAPI Generator engine `7.22.0` |
| Mosquitto (Lab05 only) | `mosquitto -h` | any recent version |

If any check fails, see the **Prerequisites** section of `README.md` for
install commands.

The JDK 17 baseline combines two different requirements: OpenAPI regeneration
uses the Java-based OpenAPI Generator engine `7.22.0`, which requires Java 11
or newer, while the Lab02 Converter explicitly targets Java 17. Lab03 also
invokes `javac` and `java` but does not pin a release. The response-metadata
generator and the already-generated Node.js server do not use Java. See
`README.md` under **Java Requirements and Where Java Is Used** for the command
matrix and version-pinning distinction.

## 2. Install and generate

Working directory: repository root.

```bash
npm install
npm run generate:final
```

Expected result: `generated-openapi-generator-custom/` is (re)built from
`openapi/openapi.yaml` using the templates in `out/`. No server starts yet.

## 3. Start the Film Manager server

Working directory: repository root.

```bash
npm start
```

Expected result: the terminal prints `Listening on port 3000` (or another
port if `PORT` is set). This command does **not** regenerate the server —
run step 2 first if `openapi/openapi.yaml` or a template changed.

Leave this terminal running. Stop it later with `Ctrl+C` — this closes the
HTTP server, the Lab04 WebSocket gateway, and the Lab05 MQTT client
together, deterministically.

If port 3000 is busy:

```bash
PORT=3101 BASE_URL=http://localhost:3101 npm start
```

## 4. Start Mosquitto (Lab05 only)

Working directory: repository root, a **separate** terminal.

```bash
mosquitto -v -c shared-services/lab05/broker/mosquitto.conf
```

Expected result: log lines showing `Opening ipv4 listen socket on port 1883`
and `Opening websockets listen socket on port 8080`. Required for
`npm run test:lab05:integration` and for live MQTT status updates in the
React client; the REST API and every other lab's tests work without it.

Stop it with `Ctrl+C` in that terminal.

## 5. Start the Java Converter (Lab02 only)

Working directory: repository root, a separate terminal.

```bash
npm run converter:build
npm run converter:start
```

Expected result: the second command prints a line confirming the gRPC
server is listening on port `50051`. Uses the committed Maven Wrapper
(`./mvnw`) — no global Maven installation is required.

Stop it with `Ctrl+C` in that terminal.

## 6. Start the React client (Lab04/05 only)

Working directory: `shared-services/lab04/client-app/`, a separate terminal.

```bash
cd shared-services/lab04/client-app
npm install
npm run dev
```

Expected result: Vite prints a local URL (typically
`http://localhost:5173`). The dev server proxies `/api` and `/ws` to
`localhost:3000` — the Film Manager server (step 3) must already be
running. For live MQTT updates, Mosquitto (step 4) must also be running.

Stop it with `Ctrl+C` in that terminal.

## 7. Run every test suite

Working directory: repository root. These scripts start and stop their own
server/broker/process instances — they do **not** require steps 3–6 to
already be running.

```bash
npm run test:lab01
npm run test:lab02
npm run test:lab02:integration
npm run test:lab02:proto
npm run test:lab03
npm run test:lab04
npm run test:lab04:client
npm run test:lab05
npm run test:lab05:integration
```

Each command exits `0` on success and prints a final `passed` line. None of
them leave a background process running when they finish.

## 8. Run the smoke test and Postman collections

Working directory: repository root. These require the Film Manager server
(step 3) to already be running.

```bash
npm run smoke
```

```bash
npx --yes newman run postman/film-manager-api.postman_collection.json
npx --yes newman run postman/lab02/lab02.postman_collection.json --working-dir .
npx --yes newman run postman/lab04/lab04.postman_collection.json
npx --yes newman run postman/lab05/lab05.postman_collection.json
```

See each collection's own `postman/lab0N/README.md` (or `postman/README.md`
for the base collection) for variable defaults and what each collection
does and does not verify. There is no Lab03 Postman collection — Lab03 is a
raw TCP protocol, outside Postman's HTTP model; see
`postman/lab03/README.md`.

## 9. Shut everything down

Press `Ctrl+C` in every terminal opened in steps 3–6, in any order. Each
process shuts down independently and cleanly; none depend on another's
shutdown order.

To confirm nothing was left running:

```bash
lsof -iTCP:3000 -iTCP:1883 -iTCP:8080 -iTCP:50051 -sTCP:LISTEN
```

Expected result: no output.

## Port-conflict handling

| Port | Used by | If busy |
|---|---|---|
| `3000` | Film Manager | `PORT=3101 BASE_URL=http://localhost:3101 npm start`, and update the Postman collection's `baseUrl` variable to match |
| `1883` | Mosquitto (MQTT) | Stop the conflicting process, or edit `shared-services/lab05/broker/mosquitto.conf`'s `listener` lines (see `docs/configuration.md` for why the canonical file should otherwise stay unmodified) |
| `8080` | Mosquitto (MQTT over WebSockets) | Same as above |
| `50051` | Java Converter (gRPC) | `CONVERTER_GRPC_PORT=<port>` when starting the Converter, and `CONVERTER_GRPC_ADDRESS=localhost:<port>` when starting the Film Manager |
| `5173` | React dev server | Vite automatically selects the next free port and prints the URL it chose |

## Lab-to-component quick reference

The steps above are organized by component (server, broker, client), not by
lab. Use this table to see which components a given lab actually needs —
skip the rest.

| Lab | Required components |
|---|---|
| Lab01 | Server |
| Lab02 | Server + Java Converter |
| Lab03 | TCP Converter (standalone; no Film Manager server involved) |
| Lab04 | Server + React client |
| Lab05 | Server + React client + Mosquitto |

## Known limitations

- All application state (films, reviews, sessions, MQTT/WebSocket
  presence) is held in memory in a single Node.js process and resets on
  restart. This is an intentional academic simplification, not a defect.
- Nothing here is a production deployment guide. Session secrets, MQTT
  credentials, and TLS are all local-development defaults — see
  `docs/configuration.md`.

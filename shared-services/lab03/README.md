# Lab03 TCP Converter

This directory contains the Lab03 TCP/IP socket implementation artifacts for the final project: a
concurrent image-conversion server and a command-line client, communicating over a raw TCP binary
protocol (no HTTP/REST/OpenAPI involved — see `postman/lab03/README.md` for why Postman does not apply).

## Protocol

The converter server listens on TCP port `2001` by default. Supported media types are exactly three:
`PNG`, `JPG`, and `GIF` (the wire token is `JPG`; `JPEG` is normalized to it internally). The client
sends:

| Field | Size | Meaning |
|---|---:|---|
| Original media type | 3 bytes | ASCII `PNG`, `JPG`, or `GIF` |
| Target media type | 3 bytes | ASCII `PNG`, `JPG`, or `GIF` |
| Image length | 4 bytes | Signed integer in network byte order (big-endian) |
| Image bytes | variable | File content to convert |

On success, the server replies with:

| Field | Size | Meaning |
|---|---:|---|
| Status | 1 byte | ASCII `0` |
| Converted length | 4 bytes | Signed integer in network byte order |
| Converted bytes | variable | Converted image file |

On failure, the server replies with status `1` (wrong request — bad type, bad/oversized/truncated
length, malformed or undecodable image, or a declared source type that doesn't match the actual image
content) or `2` (internal server error — an unexpected runtime/implementation failure), followed by a
4-byte big-endian error-message length and an ASCII error message. The server always consumes the full
request and, on error, always sends the complete length-prefixed message; the client always reads the
complete response before deciding success or failure.

### Alpha-channel images converted to JPG

JPEG (baseline) cannot encode transparency. A PNG or GIF decoded with an alpha channel — including one
that is *fully opaque* but still stored with an alpha-bearing color model, which is common for images
from screenshot tools, browsers, and most image editors — is automatically flattened onto an opaque
white background (`ConversionProtocol.prepareForTarget()`) before being encoded as JPEG. Fully or
partially transparent pixels become white (or a white blend, for partial transparency); fully opaque
pixels are unaffected. PNG and GIF targets are never flattened — alpha is preserved exactly as decoded.
This was a real defect found during manual testing (`ImageIO.write(argbImage, "jpeg", ...)` returns
`false` — not an exception — because the baseline JPEG writer cannot encode that color model, which the
server previously misreported as "No ImageIO writer available for JPG"); see
`docs/lab03-compliance-audit.md`, "Post-audit defect: alpha-channel JPEG conversion," for the full root
cause and fix.

## Source Files

| File | Meaning |
|---|---|
| `src/main/java/it/polito/dsp/lab03/ConversionProtocol.java` | Shared constants, protocol helpers, content-based type detection, the `convert()` implementation, and alpha-to-JPEG flattening (`prepareForTarget()`). |
| `src/main/java/it/polito/dsp/lab03/ConverterServer.java` | Concurrent TCP converter server: bounded worker pool, accept-loop resilience, clean shutdown. |
| `src/main/java/it/polito/dsp/lab03/ConversionRequestClient.java` | Command-line TCP client: input validation, connection handling, safe output-file writing. |
| `src/main/java/it/polito/dsp/lab03/WrongRequestException.java` | Marks a client-caused protocol violation (→ status `1`), distinct from an unexpected internal failure (→ status `2`). |
| `src/main/java/it/polito/dsp/lab03/ClientOperationException.java` | Marks an expected client-side failure (bad CLI usage, bad port, bad input file) reported as a message, never a stack trace. |
| `src/test/java/it/polito/dsp/lab03/FixtureGenerator.java` | Test-only: generates deterministic PNG/JPG/GIF fixtures at test time, including alpha-channel variants (`png-alpha`, `gif-alpha`, `png-opaque-alpha`). Never part of the production build. |
| `src/test/java/it/polito/dsp/lab03/ImageInspector.java` | Test-only: content-aware decode/inspect tool (via `ImageIO`) used to verify converted output by actual format/dimensions/alpha/pixel content. Never part of the production build. |

The server uses a bounded `ThreadPoolExecutor` (not an unbounded pool) so multiple clients are handled
concurrently without unbounded thread growth. Both client and server set socket read timeouts to avoid
deadlocks.

## Compile (production)

From this directory:

```bash
javac -d bin src/main/java/it/polito/dsp/lab03/*.java
```

This compiles only `src/main/java` — the test-only fixture/inspection tools under `src/test/java` are
never included in this command or in the shipped output.

## Run

Start the server on the default port (`2001`):

```bash
java -cp bin it.polito.dsp.lab03.ConverterServer
```

An optional port argument overrides the default:

```bash
java -cp bin it.polito.dsp.lab03.ConverterServer 3000
```

Run the client (mandatory three-argument form):

```bash
java -cp bin it.polito.dsp.lab03.ConversionRequestClient PNG JPG image.png
```

Optional `host`/`port` arguments may follow the mandatory three (`host` defaults to `127.0.0.1`, `port`
defaults to `2001`):

```bash
java -cp bin it.polito.dsp.lab03.ConversionRequestClient PNG JPG image.png 192.168.1.10 3000
```

The client first checks the provided path directly; if it is not found, it also checks
`image/<image_path>`, matching the laboratory note about the local `image` folder. The file is checked
**before** any connection is attempted. On success, the converted output is written next to the source
as `<basename>_converted.<target-extension>` (e.g. `image.png` → `image_converted.jpg`), written to a
same-directory temporary file first and atomically-enough replaced into place only once the full
response has been validated — no partial or leftover output file is ever produced on any error path.

### Configuration properties

All of the following are optional JVM system properties (`-Dproperty=value`); production behavior with
none of them set is unchanged from the plain `java -cp bin ...` invocations above.

| Property | Default | Effect |
|---|---|---|
| `lab03.workerThreads` | `16` | Server worker-pool size (fixed core/max). Must be a positive integer; an invalid value fails clearly at startup (message + non-zero exit), not silently. |
| `lab03.queueCapacity` | `64` | Server's bounded task queue depth beyond the active worker threads; once both are full, a new connection is rejected and its socket is closed immediately (no new wire-level status was introduced for this — see the compliance audit). Same validation as `workerThreads`. |
| `lab03.socketTimeoutMs` | `30000` | Connect/read timeout (ms) used by both client and server. An invalid (non-numeric) value silently falls back to the default, per the JDK's own `Integer.getInteger` contract — this is intentional and documented, not a bug. |
| `lab03.forceInternalError` | `false` | Server-only test seam: when `true`, every conversion deterministically fails as an unexpected internal error (status `2`). Not reachable through any client-controlled protocol input; exists solely to test status-`2` framing without depending on a real, unstable runtime failure. |
| `lab03.debugLogging` | `false` | Server-only test seam: prints one-line stdout markers (`worker-queued`, `worker-rejected`, `worker-started`) used to synchronize concurrency tests deterministically. Never touches wire-protocol bytes. |

## Tests

From the repository root:

```bash
npm run test:lab03
```

This runs five test files in a deterministic sequence, each building the Java sources fresh and cleaning
up its own processes/temp files/ports; the command fails on any unexpected project failure, while
confirmed professor-reference defects are reported as expected, separately-tracked observations rather
than hidden or silently mixed into a single pass/fail count:

| File | Covers |
|---|---|
| `scripts/lab03-protocol-tests.js` | Wire framing; the wrong-request (`1`) vs. internal-error (`2`) taxonomy; declared-vs-actual image type validation; unknown response-status rejection. |
| `scripts/lab03-client-robustness-tests.js` | CLI validation, connection-failure handling, output-file safety. |
| `scripts/lab03-server-concurrency-tests.js` | Concurrency, interruption recovery, the bounded worker pool, the `image/` fallback, clean shutdown. |
| `scripts/lab03-large-file-and-matrix-tests.js` | The full 6+3 conversion matrix, a measured ≥10 MiB transfer, the size boundary, explicit big-endian framing, default port 2001. |
| `scripts/lab03-alpha-conversion-tests.js` | Alpha-channel regression coverage: transparent/opaque-with-alpha PNG and GIF converted to JPG (flattened onto white), alpha preserved on PNG/GIF targets, plain-RGB regression. |
| `scripts/lab03-interoperability-tests.js` | The project client/server against the official professor reference (see below). |

## Interoperability testing

`scripts/lab03-interoperability-tests.js` exercises the project's client/server against the official
professor reference implementation:

- **Local reference path**: `shared-services/lab03/lab03-solution-main/` (gitignored, untracked — see
  `.gitignore`). It is a local-only copy of
  [`polito-DSP-2025-2026/lab03-solution`](https://github.com/polito-DSP-2025-2026/lab03-solution), never
  a runtime dependency of the project's own client/server. If that folder isn't present on a given
  machine, the test prints a clear `SKIPPED` line and exits successfully — **it is never downloaded
  automatically**, so `npm run test:lab03` never depends on internet access.
- **Build requirement**: none beyond the JDK already required for the rest of Lab03 — the reference
  `Client/client.jar` and `Server/server.jar` are prebuilt and are invoked directly (`java -jar ...`),
  the same way the lab PDF itself documents running them.
- **Four combinations tested**: project client → project server (baseline); professor client → project
  server; project client → professor server (including a few malformed-input cases); professor client →
  professor server (a reference-only baseline, never treated as compliance evidence for either side).
- **Professor defects, not project failures**: the professor server has known bugs (see
  `docs/lab03-compliance-audit.md`, "Known professor-reference defects") where certain malformed inputs
  (an oversized declared length with a truncated body, a genuinely truncated body, or undecodable image
  bytes) crash a handler thread via an uncaught exception *without ever closing the socket*. The test
  wraps every professor-server request in a hard timeout that force-destroys the connection, classifies
  a resulting hang as an **expected professor-defect observation** (not a failure), and fully restarts
  the professor server afterward before continuing — this is reported separately in the test's result
  matrix, never folded into a single pass/fail count.
- **The professor client is hard-coded to connect to `0.0.0.0:2001`** with no CLI override, and the
  professor server is hard-coded to listen on port `2001` with no CLI override either. The test verifies
  port 2001 is free before claiming it (never killing whatever else might be using it) and skips the
  professor-server-dependent combinations, with a clear message, if it isn't. Whether `0.0.0.0` actually
  works as a connect destination is environment-dependent; the test records the observed result but does
  not change project code to accommodate it either way.
- **Never commits professor artifacts**: no professor source, JAR, or generated build output is ever
  written back into a tracked location.

## Postman

Not applicable by protocol design — see `postman/lab03/README.md` for the full assessment. Lab03's raw
TCP binary framing cannot be executed by a standard Postman/Newman collection, and neither Lab03 PDF
requires Postman, HTTP, REST, or OpenAPI. `npm run test:lab03` is the cumulative, authoritative test
command.

## Known scope limitations

- **Static/first-frame GIF only.** The server decodes GIFs via `reader.read(0)` (first frame), matching
  plain `ImageIO` and both PDFs' silence on animation; no animated-GIF support exists or is planned.
- **Encoded request size is bounded (50 MiB) but decoded-raster size is not.** A highly compressible,
  extreme-dimension image could still decode to a much larger in-memory raster than its encoded byte
  count. Documented as a residual, non-mandatory hardening opportunity in `docs/lab03-compliance-audit.md`
  rather than fixed, per that document's memory/boundedness review.
- **`lab03.socketTimeoutMs` falls back silently on an invalid value**, while `lab03.workerThreads` /
  `lab03.queueCapacity` fail loudly — both are intentional, documented choices (see "Configuration
  properties" above), not an inconsistency needing a fix.

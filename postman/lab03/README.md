# Lab03 and Postman: not applicable by protocol design

There is deliberately no `lab03.postman_collection.json` in this directory. This file documents why,
and where Lab03's real, cumulative automated coverage actually lives.

## Why Postman does not apply here

Lab01 and Lab02 are HTTP/REST services generated from an OpenAPI specification, so a Postman collection
is a natural fit — every request is an HTTP call with a URL, headers, and a JSON/multipart body, which is
exactly the model Postman (and Newman, its CLI runner) is built around.

Lab03 is a raw TCP/IP socket protocol (see `shared-services/lab03/README.md` for the exact wire format):
three ASCII bytes for the source type, three for the target type, a 4-byte signed big-endian length, and
the raw file bytes — with no HTTP framing anywhere. A standard Postman request cannot open a raw TCP
socket, write an arbitrary binary frame, or read back a length-prefixed binary response; Postman's
request/test sandbox only sends HTTP(S) requests (`pm.sendRequest` is HTTP-only) and has no raw-socket
capability. Neither of the two Lab03 assignment PDFs (`specifications/lab03/material/Lab03.pdf`,
`LaboratoryActivity03.pdf`) mentions Postman, HTTP, REST, or OpenAPI anywhere — the PDFs' own "How to test
your client and server" section describes exactly two things: manual interoperability against the
reference `client.jar`/`server.jar`, and robustness testing by killing the client or server mid-transfer.
Neither requires Postman.

**Conclusion: not applicable by protocol design.** This is a genuine tooling mismatch, not a gap in
coverage — the project does not introduce an HTTP-to-TCP bridge, a REST wrapper, an OpenAPI document, or
a collection that only contains documentation placeholders while claiming to have exercised the protocol.
Any of those would misrepresent what was actually tested and would add an architecture layer the PDF never
asked for.

## What replaces it

```bash
npm run test:lab03
```

runs the full, cumulative, real-TCP-socket test suite — five files, executed in this deterministic order:

| File | Covers |
|---|---|
| `scripts/lab03-protocol-tests.js` | Exact wire framing; the wrong-request (`1`) vs. internal-error (`2`) taxonomy; declared-vs-actual image type validation; unknown response-status rejection. |
| `scripts/lab03-client-robustness-tests.js` | CLI argument validation; connection-failure handling (refused, unreachable, premature close, read timeout); output-file safety (no partial/leftover files); no raw stack traces on expected errors. |
| `scripts/lab03-server-concurrency-tests.js` | Simultaneous independent clients; a stalled or malformed client not blocking others; seven raw interruption scenarios each followed by proof of recovery; the bounded/configurable worker pool and queue rejection; the `image/` fallback path; clean server shutdown. |
| `scripts/lab03-large-file-and-matrix-tests.js` | All 6 mandatory cross-format conversions plus the 3 same-format extensions, each verified by real `ImageIO` decoding (not extension or magic bytes alone); a measured ≥10 MiB transfer; the maximum-request-size boundary; an explicit big-endian framing assertion; the default port 2001. |
| `scripts/lab03-interoperability-tests.js` | The project client/server against the official professor reference (`client.jar`/`server.jar`) in every runnable combination, with confirmed professor-reference defects reported separately from project failures. |

Every file starts real Java processes (the actual `ConverterServer`/`ConversionRequestClient`, and where
applicable the professor reference jars), drives them over real loopback TCP sockets with hand-built
protocol bytes, and cleans up its own processes and temporary files — this is a strictly stronger,
byte-level proof of protocol correctness than an HTTP-based collection could ever provide for a binary
socket protocol, faithful or not.

See `shared-services/lab03/README.md` for the protocol reference, build/run
instructions, configuration properties, test matrix, interoperability behavior,
and known limitations.

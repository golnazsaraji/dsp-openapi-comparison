# Lab02 Phase 3 implementation

## Protocol and Java service

The sole proto source is `shared-services/lab02/proto/converter.proto`. The bidirectional RPC state machine requires exactly one metadata message first, one or more bounded source chunks, and client half-close. The server returns output chunks followed by one terminal result, or one structured failure.

The stateless Java service is under `shared-services/lab02/converter-java`. Maven generates Java and gRPC types directly from the canonical sibling proto using `os-maven-plugin`; no platform classifier is hard-coded. Each RPC owns its input buffer and enforces a 5 MiB default. Java ImageIO implements all PNG/JPEG/GIF directions. GIF conversion uses the first decoded frame; animation is not preserved. Alpha is flattened deterministically onto white for JPEG.

## Node client

`ConverterClient` loads the canonical proto, sends metadata before bounded chunks, observes request and response backpressure, applies a deadline, limits output, rejects malformed ordering, and removes partial files on every failure. Defaults:

- `CONVERTER_GRPC_ADDRESS=localhost:50051`
- `CONVERTER_GRPC_DEADLINE_MS=10000`
- `IMAGE_CONVERSION_CHUNK_SIZE=65536`
- `IMAGE_MAX_CONVERTED_BYTES=10485760`

## Cache and concurrency

The original representation is selected first; otherwise the first persisted representation is used. Converted bytes are written to a unique temporary file, validated by target magic bytes, fsynced, atomically renamed to a UUID storage key, and then registered. Records include canonical media type, byte size, timestamp, original/converted flag, SHA-256 checksum, and conversion source. Absolute paths are never persisted.

One in-process promise is shared per `imageId + target media type`. Unrelated conversions do not share a lock. The promise is removed in `finally`, allowing retry after failure. Cache records persist across Film Manager restart and regeneration.

## HTTP mapping and cleanup

- 406 unsupported Accept
- 422 converter decode/conversion rejection
- 502 malformed converter response or other upstream failure
- 503 converter unavailable
- 504 converter deadline
- 500 local storage/cache failure

All errors are path-free JSON. Deleting an image or film enumerates every registered original and converted storage key; missing files do not block metadata cleanup.

## Commands

In separate terminals:

```bash
npm run converter:build
npm run converter:start
npm start
```

The Converter commands use the committed Maven Wrapper, so a global `mvn` installation is not required. The wrapper downloads its pinned Maven distribution on first use.

Tests:

```bash
npm run test:lab02
npm run test:lab02:integration
npm run test:lab01
```

The cumulative Postman collection uploads three sources, reads originals, triggers PNG→JPEG and JPEG→GIF, repeats both cache reads, verifies authorization, then deletes all images and their representations.

Optional future hardening includes a cross-process/distributed conversion lock and richer image-dimension validation. Those are not required for the single Film Manager process used by this lab.

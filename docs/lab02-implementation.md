# Lab02 implementation

Lab02 adds authenticated image upload, persistent metadata and local representations, HTTP content negotiation, and on-demand gRPC conversion to the existing Film Manager. Handwritten behavior remains outside generated output so OpenAPI regeneration does not remove implementation or runtime data.

## Architecture

- `openapi/openapi.yaml` defines the image REST contract.
- `adapters/openapi-generator/DefaultServiceAdapter.js` connects generated operations to the shared Film Manager.
- `shared-services/src/images/` owns validation, metadata persistence, storage, negotiation responses, conversion caching, and the Node gRPC client.
- `shared-services/lab02/proto/converter.proto` is the single canonical streaming contract.
- `shared-services/lab02/converter-java/` is the stateless Java Converter and includes a Maven Wrapper.
- `runtime-data/` holds image metadata and representations outside disposable generated output.
- `postman/lab02/lab02.postman_collection.json` is the one cumulative Lab02 collection; its project-owned fixtures are under `postman/lab02/fixtures/`.

The Film Manager uses port `3000` by default. The Converter uses port `50051` by default.

## Storage, validation, and negotiation

Uploaded files and versioned image metadata live under `runtime-data/`, outside
the disposable generated server. Upload validation cross-checks the extension,
declared media type, and PNG/JPEG/GIF file structure; rejected temporary files
are removed. Accepted files receive server-owned UUID storage keys, while only
safe display metadata is exposed through the API. Metadata updates use a
same-directory temporary file and atomic rename, and image/film deletion removes
every registered representation while tolerating already-missing files.

Image retrieval authorizes the film owner or an assigned reviewer before
resolving a representation. Content negotiation supports JSON metadata, PNG,
JPEG, and GIF, including wildcards and quality values. `image/jpg` is accepted
as a request alias, while responses use canonical `image/jpeg`. Missing supported
representations are generated on demand rather than exposing storage paths.

## Conversion and cache behavior

`shared-services/lab02/proto/converter.proto` defines one bidirectional-streaming
RPC: metadata is sent first, followed by bounded input chunks; the Converter
returns bounded output chunks and one terminal result. The stateless Java
service handles every PNG/JPEG/GIF direction. GIF conversion uses the first
decoded frame, and alpha is flattened onto white for JPEG.

The Node client enforces deadlines and output limits, validates response ordering,
and removes partial output after failures. Converted files are validated, fsynced,
atomically renamed, and registered with checksum and provenance metadata. An
in-process promise per image and target type coalesces concurrent requests; cache
records survive Film Manager restart and server regeneration. This lock is
process-local and would need replacement for a multi-process deployment.

Conversion failures map to path-free JSON responses: `406` for unsupported
negotiation, `422` for rejected input/conversion, `502` for malformed upstream
responses, `503` when the Converter is unavailable, `504` on its deadline, and
`500` for local storage/cache failures.

## Run

Start the Converter and Film Manager in separate terminals:

```bash
npm run converter:build
npm run converter:start
npm start
```

Run the cumulative collection from the repository root:

```bash
npx --yes newman run postman/lab02/lab02.postman_collection.json \
  --env-var baseUrl=http://localhost:3000 \
  --working-dir .
```

For Postman Desktop working-directory and local-file setup, see `postman/lab02/README.md`.

## Validate

```bash
npm run test:lab01
npm run test:lab02
npm run test:lab02:integration
npm run test:lab02:proto
npm run smoke
npm run generate:final
```

This file describes the final cumulative project state.

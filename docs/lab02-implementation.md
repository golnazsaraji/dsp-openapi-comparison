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

This file describes the final cumulative project state. The phase-by-phase
development history is preserved in `docs/appendix/`:
[Phase 1](appendix/lab02-phase1-implementation.md) (uploads and metadata),
[Phase 2](appendix/lab02-phase2-implementation.md) (content negotiation),
[Phase 3](appendix/lab02-phase3-implementation.md) (gRPC conversion).

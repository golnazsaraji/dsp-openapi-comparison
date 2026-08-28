# Lab02 Phase 2 implementation

> **Historical document.** This describes an intermediate development phase
> of Lab02, superseded by later phases and merged work. For current Lab02
> behavior, see [`../lab02-implementation.md`](../lab02-implementation.md).

## Scope

Phase 2 adds source-image responses and HTTP content negotiation to Phase 1. It does not invoke gRPC or Java, convert representations, or create a conversion cache.

## Response descriptors

Handwritten services return descriptors from `shared-services/src/http/ResponseDescriptor.js`: `json` for public metadata, `file` for an authorized stored source, and `no-content` for empty success responses. Internal paths never enter JSON.

The customized controller template streams file descriptors with `fs.createReadStream`, canonical Content-Type, and Content-Length from `stat`. Stream errors become a generic path-free 500. Regeneration reproduces this behavior from `out/controllers/Controller.mustache`.

## Negotiation

`AcceptNegotiation.js` parses comma-separated ranges and parameters. Missing Accept defaults to `application/json`. Exact types, type wildcards, `*/*`, and q values are supported; q=0 excludes a representation. The most specific matching range controls each representation. Candidates are ordered by quality, specificity, then `application/json`, `image/png`, `image/jpeg`, `image/gif`.

Thus `*/*` defaults to JSON and equal-quality exact ties use that stable order. `image/jpg` is a request alias for `image/jpeg`; responses use canonical `image/jpeg`.

## Resolution and errors

The service authorizes the film owner or assigned reviewer before film-scoped lookup. Storage selects only a representation registered on that image, derives the path from a server-owned key, and verifies a regular file.

A supported but absent representation returns JSON 406 stating that it is not locally available yet. Unsupported-only Accept also returns JSON 406. Missing physical storage returns controlled JSON 500 without a key or path.

## Contract, tests, and remaining work

OpenAPI documents JSON, PNG, JPEG, and GIF success bodies; the JPEG alias; cookie and owner/reviewer rules; and 400/401/403/404/406/500 errors.

`npm run test:lab02` is cumulative. The single Postman collection uploads PNG/JPEG/GIF into one film, checks metadata and binary negotiation, authorization and 406 behavior, then deletes all images and the film.

Phase 3 remains: gRPC/Java conversion, converted-representation persistence, concurrency control, and cache behavior. Phase 2 deliberately returns 406 rather than converting.

# Lab02 Phase 1 implementation

> **Historical document.** This describes an intermediate development phase
> of Lab02, superseded by later phases and merged work. For current Lab02
> behavior, see [`../lab02-implementation.md`](../lab02-implementation.md).

## Scope

Phase 1 implements strict uploads, durable metadata, owner/reviewer authorization, and complete registered-file cleanup. Binary image responses, gRPC conversion, and converted-image caching remain intentionally out of scope.

## Architecture

The generated controller passes structured multipart metadata to the existing handwritten adapter. `FilmManagerService` delegates image work to focused handwritten modules under `shared-services/src/images/`:

- `ImageService.js` owns authorization and image workflows.
- `ImageValidation.js` validates extension, MIME type, and actual file structure.
- `ImageStorage.js` owns temporary cleanup, UUID physical names, and representation cleanup.
- `ImageMetadataRepository.js` owns durable metadata and atomic persistence.

No handwritten image logic or persistent data lives in generated output. Template changes in `out/` regenerate the multipart adaptation and 5 MiB limits.

## Persistence model

The default repository is `runtime-data/image-metadata.json`. Writes use a same-directory temporary file followed by atomic rename. The versioned document contains a monotonic next ID and records with:

- image ID and film ID;
- original display filename;
- canonical source media type;
- UUID physical storage key;
- creation timestamp;
- a representation list containing media type and storage key.

Only public DTO fields (`id`, `filmId`, `name`, `mediaType`, `self`) leave the service. Absolute paths are never persisted. The representation list allows later conversion phases to register variants without changing deletion semantics.

## Storage and validation

Files remain under `runtime-data/uploaded_files/` by default. Multer writes a random temporary key and accepts exactly one file up to 5 MiB. Handwritten validation requires all of the following to agree:

- case-insensitive `.png`, `.jpg`, `.jpeg`, or `.gif` extension;
- `image/png`, `image/jpeg`, `image/jpg`, or `image/gif` multipart MIME type;
- PNG/JPEG/GIF signature and basic structural/trailer checks.

Empty, corrupt, unsupported, and mismatched uploads are rejected. Every rejected staged file is removed. Accepted uploads are renamed to a UUID plus canonical extension, preventing traversal, collisions, and client-filename overwrite. The original basename is retained only as display metadata.

## Authorization

All image methods require authentication through OpenAPI session security and the shared service.

- Upload: existing public film and current owner only.
- List/metadata read: resolve film, require public, allow owner, otherwise require an exact-film reviewer assignment.
- Delete: existing public film, current owner, and an image matched by both film ID and image ID.

An authorized owner/reviewer receives an empty array for a film with no images. Authorization does not depend on an inner join or on any reviewer row existing for owner access.

## Deletion behavior

Image deletion enumerates the record's registered representations, tolerates missing files, removes no unregistered/other-image key, and then removes metadata. Film deletion uses cascade cleanup: all registered representations and image metadata for that film are removed before the film/reviews are removed.

## Configuration

- `UPLOAD_DIR`: physical original/representation root. Default: `runtime-data/uploaded_files/`.
- `IMAGE_METADATA_PATH`: versioned metadata JSON file. Default: `runtime-data/image-metadata.json`.
- Upload size limit: 5 MiB per request, one file.

Both paths should be outside generated output. Tests override both with an isolated temporary directory.

## Tests

Run:

```bash
npm run test:lab02
```

The suite covers 37 Phase 1 behavioral checks: authentication; valid PNG/JPEG/GIF and multiple uploads; all required rejection/cleanup cases; generated key uniqueness; repository reload persistence; owner/reviewer/unrelated authorization; empty lists and film-scoped lookup; owner-only deletion; missing-file tolerance; representation enumeration; isolation between images; and film cascade cleanup.

Regression commands:

```bash
npm run test:lab01
BASE_URL=http://localhost:3000 npm run smoke
git diff --check
```

## Remaining gaps

- **Phase 2:** stream real PNG/JPEG/GIF HTTP bodies with exact negotiated `Content-Type`. Phase 1 explicitly returns 501 for supported binary Accept values while retaining the OpenAPI declarations and implementation note.
- **Phase 3:** consistent protobuf, Node gRPC client, Java Converter, chunk streaming, typed failure mapping, atomic converted-file persistence, and cache-hit behavior.
- Persistence is deliberately a lightweight atomic JSON repository. If multi-process writers are introduced, migrate the repository abstraction to SQLite or another transactional store without changing domain/storage APIs.

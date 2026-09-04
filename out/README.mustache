# Customized OpenAPI Generator Server

This directory contains the final generated Node.js/Express server used by the project.

The server is generated from `../openapi/openapi.yaml` with the customized templates in `../out/`. Generated service files delegate to `../adapters/openapi-generator/DefaultServiceAdapter.js`, which forwards requests to the handwritten Film Manager implementation in `../shared-services/src/services/FilmManagerService.js`.

## Role In The Project

| Path | Meaning |
|---|---|
| `api/openapi.yaml` | Generated copy of the canonical OpenAPI contract. |
| `controllers/` | Generated request/response controllers. |
| `services/` | Generated adapter-facing service layer. |
| `utils/`, `expressServer.js`, `index.js` | Generated Express/OpenAPI runtime. |

Do not put handwritten business logic directly in this directory. Regeneration may overwrite generated files. Persistent behavior belongs in `../shared-services/`, and generator-specific glue belongs in `../adapters/openapi-generator/` or `../out/`.

This generated directory is disposable. Uploaded files persist in
`../runtime-data/uploaded_files/` by default. Set `UPLOAD_DIR` before starting the server to
use another location; the upload directory is created automatically.

## Running

`npm start` (from the repository root, or from inside this directory) starts
the already-generated server. It does **not** install dependencies or
regenerate anything. From a fresh checkout, run `npm run setup` at the
repository root first. Regenerate if
`../openapi/openapi.yaml` or a template in `../out/` changed:

```bash
npm run generate:final   # from the repository root; rebuilds this directory
npm ci --prefix generated-openapi-generator-custom
npm start                # from the repository root, or from inside this directory
```

The server defaults to port `3000`. Override it with:

```bash
PORT=3101 BASE_URL=http://localhost:3101 npm start
```

## Checks

From the repository root, run:

```bash
npm test
```

The smoke test exercises health, login/session behavior, paginated film lists, authenticated film CRUD, review invitations, image metadata endpoints, and active-film conflict handling.

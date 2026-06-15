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

## Running

From the repository root:

```bash
npm start
```

This regenerates this directory, installs its dependencies, and starts the server.

To run this generated server directly after dependencies are installed:

```bash
npm start
```

from inside `generated-openapi-generator-custom/`.

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

# Initial OpenAPI Generator Server

This directory contains the generated Node.js/Express server for the initial simple Film API example.

It corresponds to:

```text
../openapi/initial-example.yaml
```

This is the example the project started from before moving to the final Film Manager API in `../openapi/openapi.yaml`.

## What Is Here

| Path | Meaning |
|---|---|
| `api/openapi.yaml` | Generated copy of the initial example OpenAPI contract. |
| `controllers/` | Generated OpenAPI Generator controllers. |
| `services/` | Generated service layer patched to call the initial-example adapter. |
| `utils/`, `expressServer.js`, `index.js` | Generated Express/OpenAPI runtime. |

## Handwritten Implementation

The generated service layer delegates to:

```text
../adapters/initial-example/DefaultServiceAdapter.js
```

That adapter calls the handwritten service implementation:

```text
../shared-services/src/services/InitialFilmService.js
```

This keeps the initial example consistent with the final project architecture: generated API files remain separate from handwritten service logic.

## Running

From the repository root:

```bash
npm run start:initial
```

Then, from another terminal:

```bash
npm run test:initial
```

Useful URLs after startup:

```text
http://localhost:3000/status
http://localhost:3000/films
http://localhost:3000/films/1
http://localhost:3000/api-docs
```

If port `3000` is busy:

```bash
PORT=3101 BASE_URL=http://localhost:3101 npm run start:initial
```

and run:

```bash
BASE_URL=http://localhost:3101 npm run test:initial
```

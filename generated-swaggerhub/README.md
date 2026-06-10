# Historical SwaggerHub Generated Server

This directory contains the server stub generated through SwaggerHub / Swagger Codegen during the comparison experiment.

It is kept as a historical comparison artifact. The final runnable project server is `../generated-openapi-generator-custom/`, and the restored initial OpenAPI Generator example is `../generated-openapi-generator/`.

## What Is Here

| Path | Meaning |
|---|---|
| `api/openapi.yaml` | Generated-project OpenAPI document from the SwaggerHub experiment. |
| `controllers/` | Swagger Codegen controller layer. |
| `service/` | Generated service layer patched to call `../adapters/swaggerhub/DefaultServiceAdapter.js`. |
| `utils/`, `index.js` | Swagger Codegen runtime files. |

## Handwritten Implementation

The generated service layer delegates through:

```text
../adapters/swaggerhub/DefaultServiceAdapter.js
```

The adapter calls the shared handwritten service implementation in:

```text
../shared-services/src/services/FilmManagerService.js
```

## Running

From this directory:

```bash
npm install
npm start
```

Useful URL after startup:

```text
http://localhost:8080/docs
```

This folder is not the final workflow used for evaluation. Use `npm start` from the repository root for the final custom-template OpenAPI Generator server.

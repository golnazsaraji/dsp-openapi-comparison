# Adapters

This directory contains handwritten adapter code that connects generated service layers to the shared handwritten business logic.

The adapters are intentionally placed outside the generated project directories. This protects them from being overwritten when the server stubs are regenerated from the OpenAPI specification.

## Contents

| Directory | Meaning |
|---|---|
| `initial-example/` | Adapter implementation used by the restored initial generated OpenAPI example. |
| `openapi-generator/` | Adapter implementation used by the OpenAPI Generator server stub. |
| `swaggerhub/` | Adapter implementation used by the SwaggerHub / Swagger Codegen server stub. |

Each adapter exposes functions matching the operation IDs generated from its OpenAPI specification, such as `filmsGET`, `filmsIdGET`, `filmsPOST`, `filmsIdDELETE`, and `statusGET` for the initial example.

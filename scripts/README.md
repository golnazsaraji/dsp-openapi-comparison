# Scripts

This directory contains helper scripts used during earlier regeneration experiments.

## Contents

- `patch-openapi-generator.js`: rewrites the generated OpenAPI Generator service file so it delegates to `adapters/openapi-generator/DefaultServiceAdapter.js`.
- `patch-swaggerhub.js`: rewrites the generated SwaggerHub service file so it delegates to `adapters/swaggerhub/DefaultServiceAdapter.js`.

These scripts are kept as historical examples. The final OpenAPI Generator workflow uses customized templates so regenerated services delegate to the adapter layer without a post-generation patch step.

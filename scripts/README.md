# Scripts

This directory contains helper scripts used during the regeneration experiment.

## Contents

- `patch-openapi-generator.js`: rewrites the generated OpenAPI Generator service file so it delegates to `adapters/openapi-generator/DefaultServiceAdapter.js`.
- `patch-swaggerhub.js`: rewrites the generated SwaggerHub service file so it delegates to `adapters/swaggerhub/DefaultServiceAdapter.js`.

These scripts are needed because generated service files can be overwritten during regeneration. Running the correct patch script after regeneration restores the connection between generated code and handwritten business logic.

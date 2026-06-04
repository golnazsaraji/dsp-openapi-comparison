# Scripts

This directory contains helper scripts used for regeneration experiments and automated
verification.

## Contents

- `smoke-custom.js`: runs representative API requests against the generated custom server.
- `patch-openapi-generator.js`: rewrites the generated OpenAPI Generator service file so it delegates to `adapters/openapi-generator/DefaultServiceAdapter.js`.
- `patch-swaggerhub.js`: rewrites the generated SwaggerHub service file so it delegates to `adapters/swaggerhub/DefaultServiceAdapter.js`.

These scripts are kept as historical examples. The final OpenAPI Generator workflow uses customized templates so regenerated services delegate to the adapter layer without a post-generation patch step.

Use the root npm script for the normal workflow:

```bash
npm start
```

Then, in another terminal, run the optional smoke test:

```bash
npm test
```

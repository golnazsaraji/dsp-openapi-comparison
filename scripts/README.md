# Scripts

This directory contains helper scripts used for regeneration experiments and automated
verification.

## Contents

- `smoke-custom.js`: runs representative API requests against the generated custom server.
- `smoke-initial.js`: runs representative API requests against the initial generated server.
- `patch-openapi-generator.js`: historical helper that rewrites the initial OpenAPI Generator service file so it delegates to `adapters/initial-example/DefaultServiceAdapter.js`.
- `patch-swaggerhub.js`: rewrites the generated SwaggerHub service file so it delegates to `adapters/swaggerhub/DefaultServiceAdapter.js`.

The patch scripts are kept as historical examples. The final OpenAPI Generator workflow uses customized templates so regenerated services delegate to the adapter layer without a post-generation patch step.

Use the root npm script for the final workflow:

```bash
npm start
```

Then, in another terminal, run the optional smoke test:

```bash
npm test
```

For the initial example:

```bash
npm run start:initial
```

Then, in another terminal:

```bash
npm run test:initial
```

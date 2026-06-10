# Baseline OpenAPI Generator Output

This directory contains the earlier Node.js/Express server generated with the default OpenAPI Generator workflow.

It is kept as a comparison artifact for the project documentation. The final runnable server is `../generated-openapi-generator-custom/`, which is regenerated from `../openapi/openapi.yaml` using the customized templates in `../out/`.

## Role In The Project

| Path | Meaning |
|---|---|
| `api/openapi.yaml` | Generated copy of the OpenAPI contract used during the baseline experiment. |
| `controllers/` | Generated controller layer. |
| `services/` | Generated service stubs patched during the experiment. |
| `utils/`, `expressServer.js`, `index.js` | Generated Express/OpenAPI runtime. |

This directory is not the place for persistent handwritten business logic. The project keeps reusable behavior in `../shared-services/` and generator-specific wiring in `../adapters/`.

## Related Documentation

- `../docs/02-experimental-comparison.md`
- `../docs/03-openapi-generator-options-analysis.md`

Use the repository-level commands for the final workflow:

```bash
npm start
npm test
```

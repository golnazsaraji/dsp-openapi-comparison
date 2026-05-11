# DSP OpenAPI Generator Comparison

This project compares two ways of generating Node.js server stubs from the same OpenAPI specification:

- OpenAPI Generator
- SwaggerHub / Swagger Codegen

The goal is not only to generate runnable server code, but also to evaluate how each generated project can be integrated with handwritten business logic in a regeneration-safe way.

## Project Idea

Generated server stubs are useful because they create routing, controller, and service scaffolding from an OpenAPI contract. However, generated files can be overwritten when the API specification changes and the project is regenerated.

For this reason, this project separates:

- the OpenAPI specification
- generated server code
- handwritten business logic
- adapter code that connects generated services to handwritten services
- patch scripts that restore the integration after regeneration

The experiment shows that handwritten logic should not be placed directly inside generated files. Instead, it should live outside the generated folders and be connected through adapters or post-generation scripts.

## Main Directories

| Directory | Meaning |
|---|---|
| `openapi/` | Contains the source OpenAPI specification used as the contract for both generators. |
| `generated-openapi-generator/` | Contains the Node.js/Express server stub generated with OpenAPI Generator. |
| `generated-swaggerhub/` | Contains the Node.js server stub generated from SwaggerHub / Swagger Codegen. |
| `shared-services/` | Contains handwritten business logic shared by both generated servers. |
| `adapters/` | Contains adapter layers that translate generated service calls into calls to the shared handwritten services. |
| `scripts/` | Contains post-generation patch scripts used to reconnect regenerated code to the adapters. |
| `docs/` | Contains the written analysis and experimental comparison notes. |

Each directory also contains its own `README.md` with a more specific explanation of its contents.

## API Used in the Experiment

The example API is a small film API with the following operations:

- `GET /films`
- `POST /films`
- `GET /films/{id}`
- `DELETE /films/{id}`
- `GET /status`

The canonical specification is stored in:

```text
openapi/openapi.yaml
```

## Running the Generated Servers

Each generated server is an independent Node.js project.

To run the OpenAPI Generator version:

```bash
cd generated-openapi-generator
npm start
```

To run the SwaggerHub / Swagger Codegen version:

```bash
cd generated-swaggerhub
npm start
```

Both generated projects use port `8080` by default, so they should be run one at a time unless the port configuration is changed.

## Patch Workflow

After regenerating a server stub, generated service files may be overwritten. The project includes patch scripts that restore the connection to the external adapter layer.

For OpenAPI Generator:

```bash
node scripts/patch-openapi-generator.js
```

For SwaggerHub / Swagger Codegen:

```bash
node scripts/patch-swaggerhub.js
```

These scripts are part of the experiment because they demonstrate one practical strategy for keeping handwritten code outside generated files while still allowing repeated regeneration.

## Documentation

The main written analysis is in:

- `docs/01-swaggerhub-analysis.md`
- `docs/02-experimental-comparison.md`

These documents describe the observations about SwaggerHub, the runtime tests, the regeneration experiment, and the final symmetric adapter/patch architecture.

## Current Status

This is a first complete project draft for the comparison experiment. The repository contains the source API contract, both generated server stubs, the shared handwritten service layer, adapter integrations, patch scripts, and written analysis.

Useful feedback on this version would be whether the experimental comparison is sufficiently clear, whether the regeneration-safe architecture is convincing, and whether additional tests or metrics should be added to strengthen the evaluation.

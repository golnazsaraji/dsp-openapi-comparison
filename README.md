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


# Regeneration-Safe Architecture

## Objective

The objective of this project is to investigate whether OpenAPI-based code generation tools can support a clean separation between generated API code and handwritten business logic.

A particular focus of the project is regeneration safety: after modifying the OpenAPI specification and regenerating the API layer, handwritten implementation code should not be overwritten.

---

# Project Structure

```text
dsp-openapi-comparison/
├── openapi/
├── generated-openapi-generator/
├── generated-openapi-generator-custom/
├── generated-swaggerhub/
├── adapters/
├── shared-services/
├── out/
├── scripts/
└── docs/

```

Architecture

The project uses the following layered architecture:

OpenAPI Specification
        ↓
Generated API Layer
        ↓
Adapter Layer
        ↓
Shared Handwritten Services

The handwritten business logic is intentionally isolated inside:

shared-services/

The generated API layer delegates requests to adapter modules, which connect the generated server stubs with the handwritten implementation.

This approach minimizes coupling between generated code and handwritten business logic.

OpenAPI Generator Workflow
Standard Generation
openapi-generator-cli generate \
-i openapi/openapi.yaml \
-g nodejs-express-server \
-o generated-openapi-generator
Template Extraction
openapi-generator-cli author template -g nodejs-express-server

This command extracts the internal generator templates into the out/ directory.

Customized Generation
openapi-generator-cli generate \
-i openapi/openapi.yaml \
-g nodejs-express-server \
-t out \
-o generated-openapi-generator-custom

The -t out option instructs OpenAPI Generator to use the customized templates stored in the out/ directory.

Custom Template Strategy

The default generated services originally returned placeholder responses such as:

resolve(Service.successResponse({}));

The service.mustache template was customized so that generated services automatically delegate to the external adapter layer:

const result = await DefaultServiceAdapter.{{operationId}}(...);
resolve(Service.successResponse(result));

This removes the need for post-generation patch scripts.

Runtime Verification

The customized generated server was successfully executed.

The following endpoints were verified:

GET /films
GET /films/1
GET /status

The responses were successfully produced by the handwritten implementation stored in shared-services/.

Current Conclusions

The experiments suggest that:

OpenAPI Generator does not directly expose built-in configuration options for handwritten/generated code separation.
Post-generation patching is possible but difficult to maintain for larger projects.
Template customization provides a more scalable and regeneration-safe approach.
Local automated generation workflows are preferable to manual web-based workflows.

Further investigation may include:

additional generators,
advanced template customization,
and comparison with alternative OpenAPI-related tools.
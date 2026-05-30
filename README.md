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
- custom template generation strategies
- optional experimental patch scripts kept as historical examples

The experiment shows that handwritten logic should not be placed directly inside generated files. Instead, it should live outside the generated folders and be connected through adapters and customized generation templates.

## Main Directories

| Directory | Meaning |
|---|---|
| `openapi/` | Contains the source OpenAPI specification used as the contract for both generators. |
| `generated-openapi-generator/` | Contains the Node.js/Express server stub generated with OpenAPI Generator. |
| `generated-swaggerhub/` | Contains the Node.js server stub generated from SwaggerHub / Swagger Codegen. |
| `shared-services/` | Contains handwritten business logic shared by both generated servers. |
| `adapters/` | Contains adapter layers that translate generated service calls into calls to the shared handwritten services. |
| `scripts/` | Contains experimental patch scripts from earlier regeneration experiments. |
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

The generated projects may use different ports depending on the generator configuration.

During the experiments:

- OpenAPI Generator was executed on port `3000`
- SwaggerHub / Swagger Codegen was executed on port `8080`

## Simplified Regeneration Workflow

The final workflow no longer relies on post-generation patch scripts.

Instead, OpenAPI Generator templates are customized so that the generated services automatically delegate requests to the adapter layer.

The root `package.json` contains helper scripts that simplify regeneration:

```json
{
  "scripts": {
    "regenerate": "openapi-generator-cli generate -i openapi/openapi.yaml -g nodejs-express-server -t out -o generated-openapi-generator-custom",
    "install:custom": "cd generated-openapi-generator-custom && npm install",
    "start:custom": "cd generated-openapi-generator-custom && npm start"
  }
}
```

## Documentation

The main written analysis is in:

- `docs/01-swaggerhub-analysis.md`
- `docs/02-experimental-comparison.md`
- `docs/03-openapi-generator-options-analysis.md`

These documents describe the observations about SwaggerHub, the runtime tests, the regeneration experiment, and the final adapter/template architecture.

## Current Status

This is a first complete project draft for the comparison experiment. The repository contains the source API contract, both generated server stubs, the shared handwritten service layer, adapter integrations, customized OpenAPI Generator templates, historical patch scripts, and written analysis.

Useful feedback on this version would be whether the experimental comparison is sufficiently clear, whether the regeneration-safe architecture is convincing, and whether additional tests or metrics should be added to strengthen the evaluation.


## Regeneration-Safe Architecture

### Objective

The objective of this project is to investigate whether OpenAPI-based code generation tools can support a clean separation between generated API code and handwritten business logic.

A particular focus of the project is regeneration safety: after modifying the OpenAPI specification and regenerating the API layer, handwritten implementation code should not be overwritten.

---

## Project Structure

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

## Architecture

The project uses the following layered architecture:

```text
OpenAPI Specification

        ↓

Generated API Layer

        ↓

Adapter Layer

        ↓

Shared Handwritten Services

```

The handwritten business logic is intentionally isolated inside:

```text
shared-services/
```

The generated API layer delegates requests to adapter modules, which connect the generated server stubs with the handwritten implementation.

This approach minimizes coupling between generated code and handwritten business logic.

## OpenAPI Generator Workflow

### Standard Generation

```text
openapi-generator-cli generate \
-i openapi/openapi.yaml \
-g nodejs-express-server \
-o generated-openapi-generator

```

### Template Extraction

```text
openapi-generator-cli author template -g nodejs-express-server
```

This command extracts the internal generator templates into the out/ directory.

### Customized Generation

```text
openapi-generator-cli generate \
-i openapi/openapi.yaml \
-g nodejs-express-server \
-t out \
-o generated-openapi-generator-custom
```

The -t out option instructs OpenAPI Generator to use the customized templates stored in the out/ directory.

## Custom Template Strategy

The default generated services originally returned placeholder responses such as:

```text
resolve(Service.successResponse({}));
```

The service.mustache template was customized so that generated services automatically delegate to the external adapter layer:

```text
const result = await DefaultServiceAdapter.{{operationId}}(...);
resolve(Service.successResponse(result));
```

This removes the need for post-generation patch scripts.

## Runtime Verification

The customized generated server was successfully executed.

The following endpoints were verified:

```text
GET /films
GET /films/1
GET /status
```

The responses were successfully produced by the handwritten implementation stored in shared-services/.

## Current Conclusions

The experiments suggest that:

- OpenAPI Generator does not directly expose built-in configuration options for handwritten/generated code separation.
- Post-generation patching is possible but difficult to maintain for larger projects.
- Template customization provides a more scalable and regeneration-safe approach.
- Local automated generation workflows are preferable to manual web-based workflows.

Further investigation may include:

- additional generators,
- advanced template customization,
- and comparison with alternative OpenAPI-related tools.

# OpenAPI Generator Options Analysis

## Objective

The objective of this step is to investigate whether OpenAPI Generator provides built-in configuration options that can support a clean separation between generated API code and handwritten service implementation code.

This investigation was motivated by the need to avoid post-generation patching and to make the regeneration workflow more scalable and suitable for real projects.

---

## Generator Analyzed

The generator analyzed in this step was:

```text
nodejs-express-server
```

The following command was executed from the project root:

openapi-generator-cli config-help -g nodejs-express-server

The output was saved into:

commands.txt


Observed Configuration Options

The available configuration options for nodejs-express-server were mainly related to:

Unicode identifiers
Additional properties behavior
Parameter naming
Parameter ordering
Discriminator behavior
Server port configuration

Examples of available options include:

allowUnicodeIdentifiers
disallowAdditionalPropertiesIfNotPresent
ensureUniqueParams
enumUnknownDefaultCase
legacyDiscriminatorBehavior
prependFormOrBodyParameters
serverPort
sortModelPropertiesByRequiredFlag
sortParamsByRequiredFlag
Missing Options

The analyzed generator did not expose configuration options related to:

delegatePattern
interfaceOnly
skipOverwrite
serviceImplementation
serviceInterface
custom service implementation separation
Interpretation

This means that the nodejs-express-server generator does not provide an obvious built-in configuration mechanism for separating generated API code from handwritten service implementation code.

The available options are mostly related to naming, validation behavior, parameter ordering, and server port configuration. They do not directly address the main architectural requirement of the project: preserving handwritten service logic during regeneration.

Architectural Implication

At this stage, the current implementation based on patch scripts cannot be considered a scalable long-term solution.

Although the patch-based approach successfully restores the connection between generated code and handwritten code after regeneration, it still relies on overwriting generated files after the generation process.

For larger or evolving projects, this approach becomes difficult to maintain because:

patch scripts become increasingly complex,
generator output may change between versions,
generated file structures may evolve,
and the handwritten integration logic becomes tightly coupled to generated file contents.

As a consequence, the regeneration problem should ideally be solved at the generator architecture level rather than through post-processing scripts.

Conclusion

The initial analysis suggests that nodejs-express-server alone is not sufficient to solve the regeneration-safety problem through configuration options only.

Therefore, the next steps are:

Investigate other OpenAPI Generator targets for Node.js or TypeScript.
Check whether other generators provide better support for separation patterns.
Investigate custom templates as a possible alternative to post-generation patching.
Compare whether other tools provide a more scalable local regeneration workflow.



## Additional Generator: typescript-node

The `typescript-node` generator was also inspected to check whether it provides better support for separating generated code from handwritten implementation code.

The following command was executed:

```bash
openapi-generator-cli config-help -g typescript-node > typescript-node-options.txt
```

ES6 support, and schema behavior.

Examples include:

enumNameSuffix
enumPropertyNaming
modelPropertyNaming
npmName
npmVersion
paramNaming
supportsES6

However, this generator also does not expose options such as:

delegatePattern
interfaceOnly
serviceImplementation
custom implementation folder
skipOverwrite

Therefore, typescript-node does not appear to provide a built-in configuration-based solution for preserving handwritten service implementation during regeneration.


## Template Extraction Investigation

After confirming that the available configuration options of `nodejs-express-server` do not directly support handwritten/generated code separation, the next step was to investigate OpenAPI Generator template customization.

The following command was executed:

```bash
openapi-generator-cli author template -g nodejs-express-server
```

The command successfully extracted the generator templates into the out/ directory.

The extracted directory contains templates such as:

service.mustache
controller.mustache
model.mustache
index.mustache
package.mustache

The generated service implementation is controlled by:
out/service.mustache


Inside this template, the placeholder response generation logic was found:

resolve(Service.successResponse({
  ...
}));

This confirms that the generated placeholder service implementation is not hard-coded inside the generator binary only; it can be modified through custom templates.

This is an important finding because it suggests that a more scalable solution may be possible by customizing the generator templates instead of applying post-generation patch scripts.

The next step is to modify service.mustache so that generated service functions delegate to an external adapter layer at generation time.

## Custom Template Experiment

After extracting the default templates of the `nodejs-express-server` generator, the `service.mustache` template was modified to generate service functions that delegate directly to an external adapter layer.

The goal was to replace the previous post-generation patch approach with a generation-time customization approach.

The custom generation command was:

```bash
openapi-generator-cli generate -i openapi/openapi.yaml -g nodejs-express-server -t out -o generated-openapi-generator-custom
```

The -t out option instructs OpenAPI Generator to use the customized templates extracted in the out/ directory.

Customized Service Template Behavior

The original generated service implementation produced placeholder responses such as:

resolve(Service.successResponse({
}));

After modifying service.mustache, the generated service functions now delegate to the external adapter layer:

const result = await DefaultServiceAdapter.{{operationId}}(
  {{#allParams}}
    {{paramName}},
  {{/allParams}}
);

resolve(Service.successResponse(result));

As a result, the generated DefaultService.js file now includes the adapter import automatically:

const DefaultServiceAdapter = require('../../adapters/openapi-generator/DefaultServiceAdapter');

This means that the connection between the generated API layer and the handwritten implementation layer is now produced during generation, instead of being restored afterward by a patch script.

Runtime Verification

The customized generated project is now executed from the project root with:

```bash
npm start
```

This command regenerates the custom OpenAPI Generator project, installs its dependencies,
and leaves the generated server running. The smoke test is run separately from another
terminal with:

```bash
npm test
```

The following representative endpoints were tested:

```text
GET /health
GET /api/films/public
POST /api/sessions
GET /api/sessions/current
GET /api/films/to-review
PUT /api/films/2/active
POST /api/films
PUT /api/films/{filmId}
DELETE /api/films/{filmId}
PUT /api/films/2/active as Karen -> 409 conflict
```

The endpoints returned data from the external handwritten `shared-services`
implementation through the adapter layer.

During the experiment, the adapter interface was also adjusted to match the parameter-passing style generated by the customized template. In particular, path parameters such as id are now passed directly to the adapter functions instead of being wrapped inside an object.

Result

This experiment demonstrates that OpenAPI Generator can support a more scalable regeneration-safe workflow through custom templates.

Compared with the previous patch-based approach, the custom template approach is preferable because:

it avoids post-generation overwriting of generated files,
it keeps the workflow local and automatable,
it integrates the adapter connection at generation time,
it is more maintainable than text-based patch scripts,
and it better supports the separation between generated API code and handwritten service implementation code.
Updated Interpretation

The earlier patch-based approach should be considered only a proof of concept.

The custom template approach is a stronger solution because it addresses the regeneration problem at the generator customization level rather than through post-processing.

Therefore, for OpenAPI Generator, the recommended direction is to continue with customized templates instead of patch scripts.


# Validation of Template-Based Regeneration

## Objective

After implementing the custom `service.mustache` template, the objective was to verify that API regeneration would preserve the handwritten business logic integration without requiring any post-generation patching.

---

## Initial Problem

The generated service layer originally delegated requests using the default generated implementation.

A previous solution relied on post-generation patch scripts to reconnect the generated services to the handwritten adapter layer.

This approach had several drawbacks:

- Additional maintenance effort
- Manual execution after regeneration
- Poor scalability for larger projects
- Tight coupling to generated source code

Based on project feedback, a more robust solution was required.

---

## Template Customization

The OpenAPI Generator templates were extracted using:

```bash
openapi-generator-cli author template -g nodejs-express-server
```

The `service.mustache` template was then modified so that generated services directly delegate requests to the adapter layer.

Instead of relying on the default generated implementation, generated operations now invoke:

```js
DefaultServiceAdapter.{{operationId}}(...)
```

This removes the need for any post-generation patching.

---

## POST Endpoint Validation

During testing, the following endpoint initially failed:

```http
POST /films
```

Request body:

```json
{
  "title": "Inception"
}
```

Initial error:

```text
Cannot read properties of undefined (reading 'title')
```

---

## Root Cause Analysis

The generated service originally used:

```js
const filmsPOST = ({ newFilm }) => ...
```

while the customized delegation logic expected a different parameter structure.

As a result, the adapter received an undefined value instead of the request body.

---

## Final Solution

The template was updated to generate:

```js
const filmsPOST = (params = {}) => ...
```

and body parameters are now forwarded using:

```js
params.newFilm || params.body || params
```

This approach supports the generated parameter structure while preserving adapter-based delegation.

---

## Regeneration Validation

The following regeneration command was executed:

```bash
openapi-generator-cli generate \
-i openapi/openapi.yaml \
-g nodejs-express-server \
-t out \
-o generated-openapi-generator-custom
```

After regeneration:

- GET /films worked correctly
- GET /films/{id} worked correctly
- POST /films successfully created new records
- Adapter delegation remained intact
- No patch script execution was required

Example successful request:

```http
POST /films
```

```json
{
  "title": "Movie Test"
}
```

Successful response:

```json
{
  "id": 2,
  "title": "Movie Test"
}
```

---

## Conclusion

The template-based solution successfully replaces the previous patch-based approach.

The handwritten business logic remains isolated in:

```text
shared-services/
```

while regeneration can be performed repeatedly without modifying generated files manually.

The solution demonstrates a regeneration-safe architecture based on OpenAPI Generator template customization rather than post-generation source code patching.

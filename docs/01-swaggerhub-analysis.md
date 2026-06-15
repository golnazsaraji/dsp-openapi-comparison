## Important Note About the Current Account

The current Swagger Studio account is running under a 30-day Swagger Enterprise Trial, as shown in the user interface. Therefore, the features observed during this phase may not correspond exactly to the permanent free plan.

For this reason, the analysis distinguishes between:

1. Features experimentally available in the current trial environment.
2. Features that are expected to remain available without a paid license.
3. Features that may require a paid subscription after the trial expires.

## Observed Features in the Trial Environment

| Feature | Status | Notes |
|---|---|---|
| Import OpenAPI specification | Available | The `openapi.yaml` file was successfully imported. |
| Online YAML editor | Available | The imported API can be edited in the browser. |
| API documentation preview | Available | Swagger UI-style documentation is generated automatically. |
| Export API definition | Available | JSON/YAML resolved and unresolved exports are available. |
| Server stub generation | Available | The Codegen menu includes Server Stub generation. |
| Node.js server stub | Available | `nodejs-server` appears among the available server stub targets. |
| Free-plan certainty | Not confirmed | The current account is a 30-day Enterprise Trial. |

## Preliminary Conclusion

Swagger Studio is technically suitable for the experimental part of the DSP project during the trial period, because it supports importing the OpenAPI specification, visualizing the API documentation, and generating a Node.js server stub.

However, at this stage it is not yet possible to conclude that the same workflow is fully available in the permanent free plan, because the current account is explicitly marked as an Enterprise Trial. Therefore, the next step is to download the generated Node.js server stub and test whether it can be integrated with the same separated service/adapter architecture used for OpenAPI Generator.


## Generated Project Structure Analysis

After generating a Node.js server stub from Swagger Studio, the resulting project structure was analyzed and compared with the one produced by OpenAPI Generator.

The generated SwaggerHub project includes:

- `controllers/`
- `service/`
- `utils/`
- `api/`

This architecture is very similar to the structure generated previously with OpenAPI Generator.

Additionally, the generated project contains `.swagger-codegen` metadata files, suggesting that Swagger Studio internally relies on the Swagger Codegen ecosystem for server stub generation.

The generated controllers delegate the request handling to generated service files. For example:

```javascript
var Default = require('../service/DefaultService');
```

This demonstrates that Swagger Studio also separates controller logic from service logic at generation time.

However, the generated service files are still part of the generated layer. Therefore, handwritten business logic added directly inside these files would likely be overwritten after regenerating the project from an updated OpenAPI specification.

This suggests that the handwritten/generated code separation problem is architectural rather than tool-specific. Both OpenAPI Generator and Swagger Studio require an external handwritten layer (e.g., adapters and shared services) to achieve regeneration-safe development.



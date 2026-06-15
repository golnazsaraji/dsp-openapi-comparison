
## Runtime Experiment with the Generated Server Stub

The generated SwaggerHub Node.js server stub was executed locally using Node.js and npm.

The project dependencies were installed successfully using:

```bash
npm install
```

The generated server was then started with:

```bash
npm start
```

During the experiment, the server started successfully on port `8080`.

This behavior differs from the OpenAPI specification server URL (`http://localhost:3000`) defined inside the OpenAPI document. Therefore, the runtime port configuration appears to be determined internally by the generated server implementation rather than directly by the OpenAPI `servers` section.

Initially, the generated endpoints returned empty responses because the generated service implementations only contained placeholder stubs such as:

```javascript
exports.filmsGET = function() {
  return new Promise(function(resolve, reject) {
    resolve();
  });
}
```

This confirms that SwaggerHub generates endpoint scaffolding and routing logic, but does not generate actual business logic implementations.

To solve this limitation, the generated service layer was connected to the external handwritten `shared-services` implementation through a dedicated adapter layer:

```text
adapters/swaggerhub/DefaultServiceAdapter.js
```

After integrating the handwritten service layer, the generated endpoints successfully returned application data through the generated routes.

The following endpoints were successfully tested:

- `GET /films`
- `GET /films/1`

This experiment demonstrates that SwaggerHub-generated server stubs can be integrated with an external handwritten architecture in a regeneration-safe manner, similarly to the approach adopted for OpenAPI Generator.


## Regeneration and Overwrite Behavior

A regeneration experiment was performed after modifying the OpenAPI specification by adding a new endpoint:

```text
GET /status
```

After regenerating the OpenAPI Generator server stub, the generated service file was overwritten.

In particular, the manual connection to the external adapter layer was removed from:

```text
generated-openapi-generator/services/DefaultService.js
```

The regenerated file returned to placeholder implementations and included the newly generated statusGET function.

This confirms that manual changes inside generated files are not regeneration-safe.

However, the external handwritten layers were preserved because they were located outside the generated output folder:

```text
shared-services/
adapters/
```

Therefore, the experiment confirms the need for a regeneration-safe architecture where handwritten business logic and adapter code are kept outside the generated codebase.

A possible practical solution is to use a post-generation patch script or customized generator templates to automatically reconnect the generated service layer to the external adapter layer after each regeneration.


## Post-Generation Patch Strategy

To address the overwrite problem observed during regeneration, a post-generation patch strategy was implemented.

A custom Node.js patch script was created:

```text
scripts/patch-openapi-generator.js
```

The purpose of this script is to automatically restore the connection between the regenerated service layer and the external handwritten adapter layer after each regeneration cycle.

The workflow becomes:

```text
1. Regenerate the server stub
2. Execute the patch script
3. Restore the handwritten integration automatically
```

The patch script rewrites the generated service implementation file and reconnects it to:

```text
adapters/openapi-generator/DefaultServiceAdapter.js
```

After executing the patch script, all endpoints were successfully restored and tested again:

- `GET /films`
- `GET /films/1`
- `GET /status`

This experiment demonstrates that regeneration-safe development can be achieved without directly storing handwritten business logic inside generated files.

The adopted solution separates:

- generated routing/controller infrastructure
- handwritten business logic
- regeneration recovery logic

This architecture significantly reduces the risk of losing handwritten code during repeated regeneration cycles.



## Symmetric Adapter and Patch Architecture

To maintain a fair comparison between OpenAPI Generator and SwaggerHub, the same handwritten architecture strategy was applied to both generated projects.

Both generated server stubs were connected to:

```text
shared-services/
```

through dedicated adapter layers:

```text
adapters/openapi-generator/
adapters/swaggerhub/
```

Additionally, post-generation patch scripts were introduced for both tools:

```text
scripts/patch-openapi-generator.js
scripts/patch-swaggerhub.js
```

The purpose of these scripts is to automatically restore the integration between regenerated generated files and the external handwritten layers after regeneration.

This approach allows both tools to support a regeneration-safe workflow without storing handwritten business logic directly inside generated files.

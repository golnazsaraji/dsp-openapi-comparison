# Success Codes and Upload Storage: Plain-Language Guide

This document describes the current final implementation. The older documents in this
folder are kept because they record how the project developed and which earlier approaches
were tested.

## The Two Problems This Change Solves

The server is partly generated from the OpenAPI description. Generated files are useful,
but they are similar to a printed copy of a form: when the form is generated again, the old
copy can be replaced.

Two kinds of information therefore needed safer homes:

1. The exact success code returned by each operation.
2. Files uploaded by real users.

The success rules are now kept in handwritten adapter code, and uploaded files are kept in
a persistent directory outside the generated server.

## What Is a Success Code?

Every HTTP response contains a number that briefly describes the result:

| Code | Plain-language meaning | Example in this project |
|---|---|---|
| `200` | The request succeeded and information is being returned. | Reading a film. |
| `201` | A new item was created successfully. | Creating a film or uploading an image. |
| `204` | The request succeeded, but there is no response body to show. | Deleting an item. |

Previously, some of these choices were embedded in the generated service template. That
made an application rule look like disposable generated code. A future regeneration could
replace a manual correction made inside the generated server.

The operation-specific success choices now live in:

```text
adapters/openapi-generator/DefaultServiceAdapter.js
```

The generated services ask this adapter which success code to use. For example, an image
upload uses `201`, while a successful deletion can use `204`. The generated controller does
not need to know why a particular operation uses a particular number; it simply sends the
response it receives.

This separation matters because the adapter is handwritten and is not replaced when the
server is generated again.

### Where To Make a Change

The OpenAPI file remains the public description of which responses the API supports:

```text
openapi/openapi.yaml
```

The current runtime mapping for operation-specific success codes is in:

```text
adapters/openapi-generator/DefaultServiceAdapter.js
```

Do not edit a generated service under `generated-openapi-generator-custom/services/` to
change a success code. Such an edit would be temporary and could disappear during the next
generation.

## Why Uploaded Files Were Moved

The final generated server lives in:

```text
generated-openapi-generator-custom/
```

This directory is disposable. It can be regenerated from the OpenAPI contract and the
templates. In the earlier layout, uploaded files were stored inside it:

```text
generated-openapi-generator-custom/uploaded_files/
```

That was unsafe. Deleting the generated server before a clean regeneration could also
delete a person's uploaded images. It would be like keeping personal photographs inside a
temporary installation folder.

Uploaded files are now stored at the repository level:

```text
runtime-data/uploaded_files/
```

The generated server can be replaced without replacing this directory. Uploaded file
contents are ignored by Git, while the directory is represented by `.gitkeep` so a fresh
checkout has the expected structure.

The server creates the upload directory automatically if it does not exist. Users do not
need to create it manually.

## Choosing Another Upload Directory

An administrator can select another location with the `UPLOAD_DIR` environment variable:

```bash
UPLOAD_DIR=/path/to/persistent/uploads npm start
```

If `UPLOAD_DIR` is not provided, the server uses `runtime-data/uploaded_files/`.

Both the multipart upload middleware and the generated controller use the same resolved
absolute path. The existing upload endpoint, multipart field name (`image`), timestamped
filename behavior, response body, and `201` success response remain unchanged.

## Regenerating and Starting the Server

Generation and startup now have separate responsibilities:

```bash
npm run generate:final
```

This recreates the generated server but does not start it.

```bash
npm start
```

This starts the already-generated server. It does not regenerate it again.

The normal test command remains `npm test`. The smoke test includes a real multipart upload
check and confirms that the file is written to the configured persistent upload directory.

## Postman Reminder

The example service keeps film data in memory. Restarting the server resets films created
during the previous run, but Postman can still remember an old `createdFilmId` value.

After each server restart:

1. Run **Login as Frank**.
2. Run **Create public film**.
3. Open **Upload image**.
4. Select a file manually under **Body → form-data → image**.

The create request saves the new film ID. The upload request validates that ID and reports
either a clear `201` success or the actual API error.

## Summary

| Concern | Previous location or behavior | Current safe owner |
|---|---|---|
| Operation-specific success codes | Generated service-template behavior | Handwritten OpenAPI Generator adapter |
| Uploaded user files | Inside the disposable generated server | `runtime-data/uploaded_files/` or `UPLOAD_DIR` |
| Server generation | Also happened during `npm start` | `npm run generate:final` only |
| Server startup | Regenerated before starting | Starts the already-generated server |

The key idea is simple: generated code may be replaced, while application rules and user
data must remain outside the disposable generated output.

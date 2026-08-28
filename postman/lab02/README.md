# Lab02 cumulative Postman collection

This single collection covers metadata, authorization, deletion, source negotiation, gRPC conversion, and cache behavior.

The multipart upload is configured as:

- field: `image`
- type: `File`
- repository paths: `postman/lab02/fixtures/valid.png`, `valid.jpg`, and `valid.gif`

The repository also contains `valid.jpg` and `valid.gif`. These fixtures belong to this collection and do not depend on files in the professor solution.

## Newman from the repository root

The file path in an exported Postman collection is only a path reference; the binary is not embedded in the JSON. Newman resolves that reference relative to its working directory. Run from the repository root and pass that directory explicitly:

```bash
npx --yes newman run postman/lab02/lab02.postman_collection.json \
  --env-var baseUrl=http://localhost:3000 \
  --working-dir .
```

With `--working-dir .`, Newman resolves the configured sources under:

`<repository-root>/postman/lab02/fixtures/`

## Postman Desktop Runner

Postman Desktop also stores file paths rather than embedding local files in exported collection JSON. Importing the collection does not upload or copy the fixture into Postman.

Use one of these modes:

### Local working-directory mode

1. Open Postman Settings → General → Working Directory.
2. Choose the absolute repository root: `dsp-openapi-comparison`.
3. Open the PNG, JPEG, and GIF upload requests.
4. In Body → form-data, keep field `image` and type **File**.
5. Select the matching `valid.png`, `valid.jpg`, and `valid.gif` files from inside that working directory.
6. Save the request.
7. Close and reopen it to confirm the saved selection remains.
8. Run the collection from **Clear stale Runner session** in its existing order.

This mode is reliable on the configured computer, but it is not portable to teammates unless they clone the repository and configure the same logical working directory. A yellow warning triangle means Postman still considers the selected file outside or unavailable from its working directory.

### Postman-uploaded file mode

Use the cloud-upload icon beside the selected file to upload it to the Postman team, then save the request. This removes the local working-directory dependency for Desktop/team/cloud-backed runs, but requires Postman workspace access and consumes team file storage. The cloud-backed reference is Postman workspace state and is not embedded in the exported repository JSON. Newman should continue using the committed local fixture and `--working-dir .`.

## Runner state and failure behavior

The first request clears stale authentication. The collection-level script clears `filmId`, `imageId`, `pngImageId`, `jpegImageId`, `gifImageId`, and upload state exactly once. It does not reset IDs between later requests.

Film and image IDs accept a positive integer returned as either a JSON number or numeric string and are stored as normalized strings. Each format-specific ID is set only after status 201, valid JSON, and a valid ID.

If an upload fails, that request reports one assertion failure. Requests depending on its format-specific ID are skipped without failed guard assertions; session transitions and film cleanup continue. No unresolved ID is sent.

Content-negotiation requests verify JSON metadata, PNG/JPEG/GIF source bytes, the `image/jpg` alias, and canonical `image/jpeg`. Conversion requests trigger PNG→JPEG and JPEG→GIF, repeat both reads from the persistent cache, and verify reviewer access and unrelated-user denial. Automated tests are authoritative for proving that cache hits avoid another gRPC call.

Before running the complete collection, start the Converter in one terminal with `npm run converter:start` and wait for `Lab02 Converter listening on 50051`. Then start Film Manager in another with `npm start`. The Converter command uses the committed Maven Wrapper and does not require global Maven. A 503 on every conversion request means the Converter is not listening or `CONVERTER_GRPC_ADDRESS` points elsewhere. The **Failure Cases** folder contains always-safe HTTP failures. To test Converter-down behavior, run a conversion request against a fresh image while the Converter is stopped and expect the documented 503; do not include that operational test in the normal happy-path run.

## Troubleshooting

- **Manual Send succeeds but Runner gets 415:** the open request can read a local selection that the saved Runner request cannot. Save the request and use one of the two Desktop modes above.
- **Yellow warning triangle beside the file:** it is outside or unavailable from Postman's working directory. Re-select it from `postman/lab02/fixtures` after setting the repository root, or upload it to Postman.
- **Anonymous check gets 200:** start from **Clear stale Runner session** so a cookie left by manual testing is removed.
- **Upload gets 401:** Runner did not preserve Alice's `connect.sid` cookie.
- **Upload gets 403:** the active user does not own the newly created film.
- **Upload gets 400/404:** `filmId` was not saved correctly.
- **Upload gets 415:** the file is unreadable/unavailable, has an unsupported type, or its extension, multipart MIME type, and bytes disagree.

The upload contract accepts canonical metadata types `image/png`, `image/jpeg`, `image/jpg`, and `image/gif`.

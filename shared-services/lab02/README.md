# Lab02 Image And gRPC Artifacts

This directory keeps the Lab02 design material inside the shared service area of the final project.

## Lab02 Scope

Lab02 extends the Film Manager service with image management for public films:

| Requirement | Project location |
|---|---|
| Upload PNG, JPG, or GIF images for a public film owned by the current user. | `../../openapi/openapi.yaml`, `../src/services/FilmManagerService.js` |
| List image metadata for a public film owned by the user or assigned to the user for review. | `../../openapi/openapi.yaml`, `../src/services/FilmManagerService.js` |
| Retrieve one image as JSON metadata or as image bytes depending on the `Accept` header. | `../../openapi/openapi.yaml` |
| Delete an image from a public film owned by the current user. | `../../openapi/openapi.yaml`, `../src/services/FilmManagerService.js` |
| Define and run the gRPC converter service contract. | `proto/converter.proto`, `converter-java/` |

The project contains an active handwritten Node client and a portable stateless Java Converter. The professor solution remains reference material and is not used at runtime.

## Supported Media Types

The REST API accepts these image media types:

- `image/png`
- `image/jpg`
- `image/jpeg`
- `image/gif`

`image/jpeg` is accepted as the standard media type for JPEG files, while `image/jpg` is also documented because the Lab02 text names JPG explicitly.

# Lab02 Specifications

This folder contains the Lab02 course material and the gRPC converter specification.

## Contents

| Path | Meaning |
|---|---|
| `material/` | Lab02 PDF material provided for the course. |
| `proto/converter.proto` | Protocol Buffers contract for the image converter service. |

The Lab02 REST image-management endpoints are specified in the canonical OpenAPI contract:

```text
../../openapi/openapi.yaml
```

The shared service keeps a working copy of the `.proto` file under `../../shared-services/lab02/`.

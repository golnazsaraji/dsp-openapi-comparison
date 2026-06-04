# OpenAPI Specification

This directory contains the canonical OpenAPI contract used by the project.

## Contents

- `openapi.yaml`: source OpenAPI 3.0 specification for the DSP Film Manager API.

The contract now covers the Film Manager service described across the DSP labs:
sessions, public films, owned films, reviews, image metadata, active film selection,
and realtime status surfaces. Stable `operationId` values are included so generated
services can delegate to the adapter layer predictably.

This file is the input used to generate both server stubs:

- `generated-openapi-generator/`
- `generated-swaggerhub/`

When the API contract changes, this file should be updated first. The generated server projects can then be regenerated from this specification.

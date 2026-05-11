# OpenAPI Specification

This directory contains the canonical OpenAPI contract used by the project.

## Contents

- `openapi.yaml`: source OpenAPI 3.0 specification for the DSP Film API.

This file is the input used to generate both server stubs:

- `generated-openapi-generator/`
- `generated-swaggerhub/`

When the API contract changes, this file should be updated first. The generated server projects can then be regenerated from this specification.

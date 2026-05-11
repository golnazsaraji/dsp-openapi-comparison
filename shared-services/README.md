# Shared Services

This directory contains handwritten business logic shared by both generated server implementations.

The purpose of this directory is to keep application logic outside generated code. This makes the project safer to regenerate because changes to generated folders do not overwrite the core service implementation.

## Contents

| Directory | Meaning |
|---|---|
| `src/` | Source code for handwritten shared services. |

The generated projects access this logic through the adapter layer in `adapters/`.

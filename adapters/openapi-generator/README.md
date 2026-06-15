# OpenAPI Generator Adapter

This directory contains the adapter used by the final custom OpenAPI Generator server.

## Contents

- `DefaultServiceAdapter.js`: maps final OpenAPI Generator service calls to the shared handwritten `FilmManagerService`.

The customized generated service layer calls adapter functions with arguments derived from the OpenAPI operation parameters. This adapter forwards those calls to `shared-services/src/services/FilmManagerService.js`.

This file is handwritten and should remain outside the generated project directory.

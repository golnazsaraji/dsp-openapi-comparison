# OpenAPI Generator Adapter

This directory contains the adapter used by the server stub generated with OpenAPI Generator.

## Contents

- `DefaultServiceAdapter.js`: maps OpenAPI Generator service calls to the shared handwritten `FilmService`.

The OpenAPI Generator generated service layer passes parameters using object-style arguments, for example `{ id }` or `{ newFilm }`. This adapter follows that calling convention and forwards the request to `shared-services/src/services/FilmService.js`.

This file is handwritten and should remain outside the generated project directory.
